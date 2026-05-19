/**
 * EXTRACTOR ROUTER
 * ──────────────────────────────────────────────────────────────────────────
 * Routes each document to its correct isolated extractor based on detected format.
 *
 * Pipeline:
 *   Image/PDF page
 *     → detectDocumentFormat()       (lightweight classification call)
 *     → routeToExtractor()           (picks the right prompt)
 *     → callVisionModel()            (full extraction with format-specific rules)
 *     → normalizeToSchema()          (maps to unified master schema)
 */

import axios from "axios";
import { detectDocumentFormat, FormatId } from "../detectors/formatDetector.ts";
import { FORMAT_A_PROMPT, FORMAT_A_HEADERS } from "./formatAExtractor.ts";
import { FORMAT_B_PROMPT, FORMAT_B_HEADERS } from "./formatBExtractor.ts";
import { FORMAT_C_PROMPT, FORMAT_C_HEADERS } from "./formatCExtractor.ts";
import { FORMAT_D_PROMPT, FORMAT_D_HEADERS } from "./formatDExtractor.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Primary extraction model — best accuracy
const EXTRACTION_MODEL_PRIMARY = "google/gemini-2.5-flash";
const EXTRACTION_MODEL_FALLBACK = "google/gemini-2.0-flash-001";

/** Map formatId → its isolated extraction prompt */
function getExtractionPrompt(formatId: FormatId): string {
  switch (formatId) {
    case "format-a": return FORMAT_A_PROMPT;
    case "format-b": return FORMAT_B_PROMPT;
    case "format-c": return FORMAT_C_PROMPT;
    case "format-d": return FORMAT_D_PROMPT;
    default: return FORMAT_A_PROMPT;
  }
}

/** Map formatId → its expected headers (for validation) */
function getExpectedHeaders(formatId: FormatId): string[] {
  switch (formatId) {
    case "format-a": return FORMAT_A_HEADERS;
    case "format-b": return FORMAT_B_HEADERS;
    case "format-c": return FORMAT_C_HEADERS;
    case "format-d": return FORMAT_D_HEADERS;
    default: return FORMAT_A_HEADERS;
  }
}

/** Call vision model with a specific prompt and return raw parsed JSON */
async function callVisionModel(
  model: string,
  base64: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<any> {
  const response = await axios.post(OPENROUTER_URL, {
    model,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
      ]
    }],
    temperature: 0.1,
    max_tokens: 8192
  }, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "DocuStruct AI Extractor",
      "Content-Type": "application/json"
    },
    timeout: 120000
  });

  const rawContent: string = response.data?.choices?.[0]?.message?.content || "";
  if (!rawContent) throw new Error(`Model ${model} returned empty content`);

  const cleaned = rawContent.replace(/```json\n?|```\n?/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in response from ${model}: ${cleaned.substring(0, 200)}`);

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.sheets?.length) throw new Error(`No sheets in response from ${model}`);

  return parsed;
}

/**
 * Convert grid[][] to rows[] (array of objects keyed by header).
 * Filters out completely empty rows.
 */
function gridToRows(grid: string[][]): Record<string, string>[] {
  if (!grid || grid.length < 2) return [];
  const headers = grid[0];
  return grid.slice(1)
    .map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = (row[i] ?? "--").toString().trim();
      });
      return obj;
    })
    .filter(obj => Object.values(obj).some(v => v !== "--" && v !== ""));
}

/**
 * Validate that the extracted grid uses the expected headers.
 * Returns a warning string if headers don't match, empty string if OK.
 */
function validateHeaders(grid: string[][], formatId: FormatId): string {
  if (!grid || grid.length === 0) return "Empty grid";
  const actualHeaders = grid[0];
  const expectedHeaders = getExpectedHeaders(formatId);

  // Check that at least 60% of expected headers are present (fuzzy tolerance for OCR)
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedActual = actualHeaders.map(normalize);
  const matchCount = expectedHeaders.filter(eh =>
    normalizedActual.some(ah => ah.includes(normalize(eh).substring(0, 6)) || normalize(eh).includes(ah.substring(0, 6)))
  ).length;

  const matchRatio = matchCount / expectedHeaders.length;
  if (matchRatio < 0.4) {
    return `Header mismatch: only ${Math.round(matchRatio * 100)}% of expected ${formatId} headers found`;
  }
  return "";
}

/**
 * Main router function.
 * Takes a single page image, detects format, routes to correct extractor.
 */
export async function routeAndExtract(
  base64: string,
  mimeType: string,
  apiKey: string,
  pageNum: number = 1
): Promise<{ formatId: FormatId; rows: Record<string, string>[]; sheetName: string; headers: string[] }> {

  // ── Step 1: Detect format ──────────────────────────────────────────────
  console.log(`[ROUTER] Page ${pageNum}: Running format detection...`);
  const detection = await detectDocumentFormat(base64, mimeType, apiKey);
  console.log(`[ROUTER] Page ${pageNum}: Detected ${detection.formatId} (${Math.round(detection.confidence * 100)}% confidence) — ${detection.reason}`);

  // ── Step 2: Get format-specific prompt ────────────────────────────────
  const extractionPrompt = getExtractionPrompt(detection.formatId);

  // ── Step 3: Extract with isolated format extractor ────────────────────
  let rawResult: any = null;
  let lastError = "";

  for (const model of [EXTRACTION_MODEL_PRIMARY, EXTRACTION_MODEL_FALLBACK]) {
    try {
      console.log(`[ROUTER] Page ${pageNum}: Extracting with ${model} using ${detection.formatId} extractor...`);
      rawResult = await callVisionModel(model, base64, mimeType, extractionPrompt, apiKey);

      // Validate headers match expected format
      const grid = rawResult.sheets?.[0]?.grid;
      const warning = validateHeaders(grid, detection.formatId);
      if (warning) {
        console.warn(`[ROUTER] Page ${pageNum}: ${warning}`);
      }

      console.log(`[ROUTER] Page ${pageNum}: Extraction SUCCESS — ${grid?.length || 0} rows`);
      break;
    } catch (err: any) {
      lastError = err.message;
      console.warn(`[ROUTER] Page ${pageNum}: Model ${model} failed: ${lastError}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!rawResult) {
    throw new Error(`Extraction failed for page ${pageNum}: ${lastError}`);
  }

  // ── Step 4: Convert grid to rows ──────────────────────────────────────
  const grid: string[][] = rawResult.sheets[0]?.grid || [];
  const headers = grid[0] || getExpectedHeaders(detection.formatId);
  const rows = gridToRows(grid);

  const sheetNames: Record<FormatId, string> = {
    "format-a": "Comprehensive_Audit",
    "format-b": "AHU_Fan_Audit",
    "format-c": "Equipment_Nameplate",
    "format-d": "Pump_ETP_Audit"
  };

  return {
    formatId: detection.formatId,
    rows,
    sheetName: sheetNames[detection.formatId],
    headers
  };
}

/**
 * Process multiple pages and group results by format.
 * Pages of the same format are merged into one sheet.
 * Pages of different formats get separate sheets.
 */
export async function processAllPages(
  pages: { base64: string; mimeType: string }[],
  apiKey: string
): Promise<{ detectedFormatId: string; sheets: { name: string; rows: Record<string, string>[]; formatId: string }[] }> {

  // Process all pages (sequentially to avoid rate limits)
  const pageResults: { formatId: FormatId; rows: Record<string, string>[]; sheetName: string }[] = [];

  for (let i = 0; i < pages.length; i++) {
    try {
      const result = await routeAndExtract(pages[i].base64, pages[i].mimeType, apiKey, i + 1);
      pageResults.push(result);
    } catch (err: any) {
      console.error(`[ROUTER] Page ${i + 1} failed completely: ${err.message}`);
    }
  }

  if (pageResults.length === 0) {
    throw new Error("All pages failed extraction");
  }

  // Group pages by format — same format pages merge into one sheet
  const formatGroups = new Map<FormatId, Record<string, string>[]>();
  const formatSheetNames = new Map<FormatId, string>();

  for (const result of pageResults) {
    if (!formatGroups.has(result.formatId)) {
      formatGroups.set(result.formatId, []);
      formatSheetNames.set(result.formatId, result.sheetName);
    }
    formatGroups.get(result.formatId)!.push(...result.rows);
  }

  // Build final sheets array
  const sheets = Array.from(formatGroups.entries()).map(([formatId, rows]) => ({
    name: formatSheetNames.get(formatId) || formatId,
    rows,
    formatId
  }));

  // Primary format = the one with the most rows
  const primaryFormat = sheets.reduce((a, b) => a.rows.length >= b.rows.length ? a : b);

  console.log(`[ROUTER] Final result: ${sheets.length} sheet(s), formats: ${sheets.map(s => s.formatId).join(", ")}`);

  return {
    detectedFormatId: primaryFormat.formatId,
    sheets
  };
}
