/**
 * OpenRouter Vision Service
 * ──────────────────────────────────────────────────────────────────────────
 * Entry point for file-based extraction.
 *
 * PDF handling strategy:
 *   - Local dev (Python available): convert PDF pages → PNG images via PyMuPDF
 *   - Vercel / no Python: send PDF directly as base64 (Gemini supports PDF natively)
 *
 * Then delegates to: detect format → isolated extractor → normalized output.
 */

import fs from "fs";
import path from "path";
import { processAllPages } from "../extractors/extractorRouter";

/** Try to convert PDF to images using Python/PyMuPDF. Returns null if Python unavailable. */
async function tryPdfToImagesViaPython(
  filePath: string
): Promise<{ base64: string; mimeType: string }[] | null> {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const outputDir = path.join(path.dirname(filePath), `_pdf_pages_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      const scriptPath = path.join(process.cwd(), "pdf_to_images.py");
      const { stdout } = await execAsync(
        `python "${scriptPath}" "${filePath}" "${outputDir}"`,
        { timeout: 60000 }
      );

      const result = JSON.parse(stdout.trim());
      if (!result.success || !result.images?.length) return null;

      const pages: { base64: string; mimeType: string }[] = [];
      for (const imgPath of result.images) {
        const buf = fs.readFileSync(imgPath);
        pages.push({ base64: buf.toString("base64"), mimeType: "image/png" });
        try { fs.unlinkSync(imgPath); } catch {}
      }
      return pages;
    } finally {
      try { fs.rmdirSync(outputDir); } catch {}
    }
  } catch {
    // Python not available (Vercel) or script failed — fall through to direct PDF
    return null;
  }
}

/**
 * Main extraction entry point.
 * Accepts a file path (image or PDF), returns structured extraction result.
 */
export async function extractWithOpenRouter(filePath: string, _customPrompt?: string): Promise<any> {
  const apiKey = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)?.trim();
  if (!apiKey) {
    throw new Error("No OpenRouter API key found. Set OPENROUTER_API_KEY in .env");
  }

  const ext = path.extname(filePath).toLowerCase();
  const fileBuffer = fs.readFileSync(filePath);
  const isPDF = ext === ".pdf" || fileBuffer.slice(0, 4).toString() === "%PDF";

  let pages: { base64: string; mimeType: string }[];

  if (isPDF) {
    console.log(">>> [VISION] PDF detected — trying Python conversion...");
    const pythonPages = await tryPdfToImagesViaPython(filePath);

    if (pythonPages && pythonPages.length > 0) {
      console.log(`>>> [VISION] Python converted ${pythonPages.length} page(s) to PNG.`);
      pages = pythonPages;
    } else {
      // Vercel / no Python: send PDF directly — Gemini 2.5 Flash supports PDF natively
      console.log(">>> [VISION] Python unavailable — sending PDF directly to vision model.");
      pages = [{ base64: fileBuffer.toString("base64"), mimeType: "application/pdf" }];
    }
  } else {
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    pages = [{ base64: fileBuffer.toString("base64"), mimeType }];
  }

  return processAllPages(pages, apiKey);
}
