import Tesseract from 'tesseract.js';

export async function performOCR(imagePath: string | Buffer): Promise<string> {
  console.log("[OCR] Starting extraction layer...");
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          // Log progress if needed
        }
      }
    });
    console.log("[OCR] Layer 1 complete. Extracted text length:", text.length);
    return text;
  } catch (err) {
    console.error("[OCR] Failed:", err);
    return ""; // Fallback to raw AI vision if OCR fails
  }
}
