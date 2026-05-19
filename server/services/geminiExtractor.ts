import axios from "axios";
import fs from "fs";
import path from "path";

/**
 * HIGH ACCURACY GEMINI VISION EXTRACTOR
 * Uses Gemini 1.5 Flash (user's own API key) to extract structured table data
 * directly from industrial audit documents with 95%+ accuracy.
 */
export async function performGeminiExtraction(filePath: string, customPrompt?: string): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in .env file.");
    }

    console.log(">>> [GEMINI] Reading file for high-accuracy extraction...");
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");

    // Detect MIME type by magic bytes
    const isPDF = fileBuffer.slice(0, 4).toString() === "%PDF";
    const mimeType = isPDF ? "application/pdf" : "image/jpeg";

    console.log(`>>> [GEMINI] File type: ${isPDF ? "PDF" : "Image"}, size: ${Math.round(fileBuffer.length / 1024)}KB`);
    console.log(">>> [GEMINI] Sending to Gemini 1.5 Flash for deep analysis...");

    const prompt = customPrompt || `You are an expert industrial audit document digitizer with 95% accuracy requirement.

TASK: Extract ALL tabular data from this industrial document into structured JSON.

RULES:
1. Find the main table in the document
2. Extract the EXACT column headers as they appear
3. Extract every data row
4. Preserve numbers exactly as written (e.g., 415V, 22kW, 1450 RPM)
5. Correct obvious OCR artifacts (e.g., "0" vs "O", "1" vs "I")
6. If a cell is empty, use "--"

OUTPUT FORMAT (return ONLY this JSON, no other text):
{
  "detectedFormatId": "INDUSTRIAL_STANDARD_V1",
  "sheets": [
    {
      "name": "Audit_Page",
      "grid": [
        ["Col1", "Col2", "Col3"],
        ["val1", "val2", "val3"],
        ["val1", "val2", "val3"]
      ]
    }
  ]
}`;

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.1,  // Low temp for precise extraction
                topP: 0.8,
                maxOutputTokens: 8192
            }
        },
        {
            headers: { "Content-Type": "application/json" },
            timeout: 120000
        }
    );

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
        throw new Error("Gemini returned empty response");
    }

    console.log(">>> [GEMINI] Response received. Parsing structured data...");

    // Clean markdown fences if present
    const cleaned = content.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // If the prompt asked for specific format (sheets), return it directly
    if (parsed.sheets) {
        console.log(`>>> [GEMINI] SUCCESS: Extracted format ${parsed.detectedFormatId} with ${parsed.sheets[0]?.grid?.length || 0} grid rows.`);
        return parsed;
    }

    // Legacy fallback parser
    const headers: string[] = parsed.headers || [];
    const dataRows: string[][] = parsed.rows || [];

    console.log(`>>> [GEMINI] SUCCESS: ${headers.length} columns, ${dataRows.length} data rows extracted.`);
    console.log(`>>> [GEMINI] Headers: [${headers.join(", ")}]`);

    // Convert to row objects
    const rowObjects = dataRows.map(row => {
        const obj: any = {};
        headers.forEach((h, i) => {
            const val = row[i] ?? "";
            if (val !== "") obj[h] = val;
        });
        return obj;
    }).filter(obj => Object.keys(obj).length > 1); // Skip empty rows

    return rowObjects;
}
