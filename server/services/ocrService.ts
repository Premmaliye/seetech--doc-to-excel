import { exec } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), "server", "cache");
const OCR_CACHE = path.join(CACHE_DIR, "ocr");
const LAYOUT_CACHE = path.join(CACHE_DIR, "layout");

[OCR_CACHE, LAYOUT_CACHE].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function getFileHash(filePath: string) {
    return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

export function performLayoutAnalysis(filePath: string): Promise<any> {
  const cachePath = path.join(LAYOUT_CACHE, `${getFileHash(filePath)}.json`);
  if (fs.existsSync(cachePath)) {
    return Promise.resolve(JSON.parse(fs.readFileSync(cachePath, "utf8")));
  }

  return new Promise((resolve, reject) => {
    console.log("Analyzing Layout...");
    exec(
      `python server/pipeline/layout_segmenter.py "${filePath}"`,
      { 
        maxBuffer: 1024 * 1024 * 5,
        env: { ...process.env, FLAGS_use_mkldnn: "0" }
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          fs.writeFileSync(cachePath, JSON.stringify(parsed));
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

import Tesseract from "tesseract.js";

export async function performOCR(filePath: string): Promise<any> {
  const cachePath = path.join(OCR_CACHE, `${getFileHash(filePath)}.json`);
  
  if (fs.existsSync(cachePath)) {
    const cachedData = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (Array.isArray(cachedData) && cachedData.length > 0) {
      console.log(`[OCR CACHE] Hit: Loaded ${cachedData.length} pages.`);
      return cachedData;
    }
    console.log("[OCR CACHE] Found empty or invalid cache. Re-extracting...");
    fs.unlinkSync(cachePath);
  }

  console.log(">>> [TEXT EXTRACTOR] Starting PyMuPDF extraction (no ML required)...");
  return new Promise((resolve, reject) => {
    exec(
      `python text_extractor.py "${filePath}"`,
      { maxBuffer: 1024 * 1024 * 20 },
      async (error, stdout, stderr) => {
        if (error) {
          console.error(">>> [EXTRACTOR ERROR] Process failed:", stderr);
          return reject(new Error("Text extraction failed. Is PyMuPDF (fitz) installed?"));
        }
        
        try {
          const parsed = JSON.parse(stdout.trim());
          
          if (parsed.error || (!Array.isArray(parsed) || parsed.length === 0)) {
            const isScannedError = parsed.error ? parsed.error.includes("No text found") : true;
            
            if (isScannedError) {
              console.log(">>> [OCR FALLBACK] Scanned document or image detected. Running Tesseract.js OCR...");
              try {
                const ext = path.extname(filePath).toLowerCase();
                let imagePaths: string[] = [];
                
                // If it's a PDF without embedded text, convert pages to images
                if (ext === '.pdf' || !ext) {
                  console.log(">>> [OCR FALLBACK] Converting scanned PDF to images...");
                  const outputDir = path.join(process.cwd(), "uploads");
                  const scriptPath = path.join(process.cwd(), "pdf_to_images.py");
                  
                  await new Promise((res, rej) => {
                    exec(`python "${scriptPath}" "${filePath}" "${outputDir}"`, (err, so, se) => {
                      if (err) return rej(new Error("PDF to Image conversion failed"));
                      try {
                        const parsedRes = JSON.parse(so.trim());
                        if (parsedRes.success) {
                          imagePaths = parsedRes.images;
                          res(true);
                        } else {
                          rej(new Error(parsedRes.error));
                        }
                      } catch (e) {
                        rej(new Error("Failed to parse image converter output"));
                      }
                    });
                  });
                } else {
                  // It's already an image
                  imagePaths = [filePath];
                }

                if (imagePaths.length === 0) {
                  console.warn(">>> [OCR FALLBACK WARNING] No images generated for OCR fallback.");
                  return resolve([]); // Gracefully handle instead of crashing
                }

                console.log(`>>> [OCR FALLBACK] Running Tesseract on ${imagePaths.length} pages...`);
                const fallbackData = [];
                
                for (let i = 0; i < imagePaths.length; i++) {
                  const imgPath = imagePaths[i];
                  try {
                    const result = await Tesseract.recognize(imgPath, 'eng');
                    
                    // Tesseract returns raw text in result.data.text
                    const rawText = result?.data?.text || "";
                    const validLines = rawText.split('\n')
                      .map(text => ({
                        text: text.trim(),
                        confidence: 0.90, // Tesseract default confidence estimate
                        box: [[0,0], [0,0], [0,0], [0,0]]
                      }))
                      .filter(l => l.text.length > 0);
                      
                    if (validLines.length > 0) {
                      fallbackData.push({ page: i + 1, lines: validLines });
                    }
                  } catch (imgErr) {
                    console.warn(`>>> [OCR WARNING] Tesseract skipped a page due to size/quality:`, imgErr.message || imgErr);
                  } finally {
                    // Always cleanup temp images even if OCR throws an error
                    if (imgPath !== filePath) {
                      try { fs.unlinkSync(imgPath); } catch (e) {}
                    }
                  }
                }
                
                if (fallbackData.length > 0) {
                  fs.writeFileSync(cachePath, JSON.stringify(fallbackData));
                  console.log(`>>> [OCR FALLBACK SUCCESS] Extracted text via Tesseract.`);
                  return resolve(fallbackData);
                } else {
                  console.warn(">>> [OCR FALLBACK WARNING] Tesseract found no text.");
                  return resolve([]); // Gracefully return empty data instead of crashing
                }
              } catch (tessErr) {
                console.error(">>> [OCR FALLBACK ERROR] Tesseract failed:", tessErr);
                return resolve([]); // Gracefully return empty data instead of crashing
              }
            } else {
              console.error(">>> [EXTRACTOR ERROR] Logic failure:", parsed.error);
              return reject(new Error(parsed.error));
            }
          }

          if (Array.isArray(parsed) && parsed.length > 0) {
            fs.writeFileSync(cachePath, JSON.stringify(parsed));
            console.log(`>>> [EXTRACTOR SUCCESS] Extracted ${parsed.length} pages.`);
            resolve(parsed);
          }
        } catch (e) {
          console.error(">>> [EXTRACTOR ERROR] Malformed output:", stdout.substring(0, 200));
          reject(new Error("Extractor returned invalid JSON."));
        }
      }
    );
  });
}