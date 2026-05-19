import { performGeminiExtraction } from "../services/geminiExtractor.js";
import { extractWithOpenRouter } from "../services/openRouterVision.js";

// ─────────────────────────────────────────────
// MAIN DOCUMENT PROCESSOR
// Tries Gemini Vision first (if key set), falls back to OpenRouter vision models.
// Converts grid[][] output to rows[] so the frontend Excel exporter works correctly.
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

export async function processDocument(filePath: string, customPrompt?: string) {
    console.log(">>> [PIPELINE] STARTING...");

    let finalResult: any = null;

    // --- Attempt 1: Gemini Vision (if API key is configured) ---
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
        try {
            console.log(">>> [PIPELINE] Trying Gemini Vision API...");
            finalResult = await performGeminiExtraction(filePath, customPrompt);
            console.log(">>> [PIPELINE] Gemini extraction succeeded.");
        } catch (err: any) {
            console.warn(">>> [PIPELINE] Gemini failed:", err.message, "— falling back to OpenRouter.");
            finalResult = null;
        }
    } else {
        console.log(">>> [PIPELINE] GEMINI_API_KEY not set. Skipping Gemini, using OpenRouter vision.");
    }

    // --- Attempt 2: OpenRouter Vision (uses OPENAI_API_KEY / OPENROUTER_API_KEY) ---
    if (!finalResult || (!finalResult.sheets && !Array.isArray(finalResult))) {
        try {
            console.log(">>> [PIPELINE] Trying OpenRouter Vision...");
            finalResult = await extractWithOpenRouter(filePath, customPrompt);
            console.log(">>> [PIPELINE] OpenRouter extraction succeeded.");
        } catch (err: any) {
            console.error(">>> [PIPELINE] OpenRouter also failed:", err.message);
            finalResult = null;
        }
    }

    // --- Fallback: Return error sheet ---
    if (!finalResult) {
        finalResult = {
            detectedFormatId: "format-a",
            sheets: [{
                name: "Extraction_Failed",
                grid: [
                    ["Error"],
                    ["Both Gemini and OpenRouter extraction failed. Check API keys and network."]
                ]
            }]
        };
    }

    // Convert grid[][] → rows[] so the Excel exporter gets proper data
    finalResult = gridToSheets(finalResult);

    // Handle legacy array-of-rows format from Gemini
    if (Array.isArray(finalResult)) {
        finalResult = {
            detectedFormatId: "format-a",
            sheets: [{ name: "Audit_Data", rows: finalResult, formatId: "format-a" }]
        };
    }

    console.log(`>>> [PIPELINE] COMPLETE. Sheets: ${finalResult?.sheets?.length || 0}`);
    return finalResult;
}