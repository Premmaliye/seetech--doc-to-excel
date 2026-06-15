import path from "path";
import { performOCR } from "../services/ocrService.js";
import { generateOpenRouterExtraction } from "../services/aiService.js";
import { extractWithOpenRouter } from "../services/openRouterVision.js";

// ─────────────────────────────────────────────
// MAIN DOCUMENT PROCESSOR
// Strategy:
//   • Images (jpg/png/jpeg) → send directly to OpenRouter vision model (best accuracy)
//   • PDFs with embedded text → local OCR (PyMuPDF) → OpenRouter text model
//   • Scanned PDFs (no text) → convert to images → OpenRouter vision model
// ─────────────────────────────────────────────

/**
 * Convert a grid (array of arrays) into ExtractedSheet rows (array of objects).
 * The first row of the grid is treated as headers.
 */
function gridToSheets(rawResult: any): any {
    if (!rawResult || !rawResult.sheets) return rawResult;

    const convertedSheets = rawResult.sheets.map((s: any) => {
        if (s.rows) return s; // Already in row-object format

        const grid: string[][] = s.grid || [];
        if (grid.length < 2) {
            return { name: s.name, rows: [], formatId: rawResult.detectedFormatId || "format-a" };
        }

        const headers = grid[0];
        const rows = grid.slice(1)
            .map(row => {
                const obj: Record<string, string> = {};
                headers.forEach((h, i) => {
                    if (h) obj[h] = row[i] ?? "--";
                });
                return obj;
            })
            .filter(obj => Object.values(obj).some(v => v !== "--" && v !== ""));

        return {
            name: s.name,
            rows,
            formatId: rawResult.detectedFormatId || "format-a"
        };
    });

    return {
        detectedFormatId: rawResult.detectedFormatId || "format-a",
        sheets: convertedSheets
    };
}

function ocrPagesToRows(ocrPages: any[]): Record<string, any>[] {
    const rows: Record<string, any>[] = [];
    for (const page of ocrPages || []) {
        for (const line of page?.lines || []) {
            const text = (line?.text || "").trim();
            if (!text) continue;
            rows.push({
                page: page?.page ?? null,
                text,
                confidence: line?.confidence ?? null
            });
        }
    }
    return rows;
}

export async function processDocument(filePath: string, customPrompt?: string) {
    console.log(">>> [PIPELINE] STARTING...");

    const ext = path.extname(filePath).toLowerCase();
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"].includes(ext);

    let finalResult: any = null;

    // ── Strategy 1: Images go directly to vision model (most accurate) ──
    if (isImage) {
        try {
            console.log(">>> [PIPELINE] Image detected — sending directly to OpenRouter vision...");
            finalResult = await extractWithOpenRouter(filePath, customPrompt);
            console.log(">>> [PIPELINE] Vision extraction succeeded.");
        } catch (err: any) {
            console.error(">>> [PIPELINE] Vision extraction failed:", err.message || err);
            finalResult = null;
        }
    }

    // ── Strategy 2: PDFs — try local OCR first, then vision fallback ──
    if (!finalResult && !isImage) {
        let ocrPages: any[] = [];

        try {
            console.log(">>> [PIPELINE] Running local OCR (PyMuPDF)...");
            ocrPages = await performOCR(filePath);
            console.log(`>>> [PIPELINE] OCR produced ${ocrPages.length} page(s).`);

            if (ocrPages.length > 0) {
                console.log(">>> [PIPELINE] Sending OCR text to OpenRouter owl-alpha...");
                finalResult = await generateOpenRouterExtraction(ocrPages, customPrompt);
                console.log(">>> [PIPELINE] OpenRouter text extraction succeeded.");
            }
        } catch (err: any) {
            console.error(">>> [PIPELINE] OCR/text path failed:", err.message || err);
        }

        // If OCR path failed (scanned PDF with no text), try vision directly
        if (!finalResult) {
            try {
                console.log(">>> [PIPELINE] Falling back to vision extraction for PDF...");
                finalResult = await extractWithOpenRouter(filePath, customPrompt);
                console.log(">>> [PIPELINE] Vision fallback succeeded.");
            } catch (err: any) {
                console.error(">>> [PIPELINE] Vision fallback also failed:", err.message || err);
            }
        }

        // Last resort: return raw OCR text
        if (!finalResult) {
            const fallbackRows = ocrPagesToRows(ocrPages);
            finalResult = {
                detectedFormatId: "format-a",
                sheets: [{
                    name: fallbackRows.length > 0 ? "OCR_Extraction" : "Extraction_Failed",
                    rows: fallbackRows.length > 0 ? fallbackRows : [{
                        page: 1,
                        text: "Extraction failed. Check API keys and network.",
                        confidence: null
                    }],
                    formatId: "format-a"
                }]
            };
        }
    }

    // ── If vision failed for images, return error ──
    if (!finalResult) {
        finalResult = {
            detectedFormatId: "format-a",
            sheets: [{
                name: "Extraction_Failed",
                rows: [{ page: 1, text: "Extraction failed. Check API key and network.", confidence: null }],
                formatId: "format-a"
            }]
        };
    }

    // Convert grid[][] → rows[] so the Excel exporter gets proper data
    finalResult = gridToSheets(finalResult);

    // Handle legacy array-of-rows format
    if (Array.isArray(finalResult)) {
        finalResult = {
            detectedFormatId: "format-a",
            sheets: [{ name: "Audit_Data", rows: finalResult, formatId: "format-a" }]
        };
    }

    console.log(`>>> [PIPELINE] COMPLETE. Sheets: ${finalResult?.sheets?.length || 0}`);
    return finalResult;
}