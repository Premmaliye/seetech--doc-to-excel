/**
 * FORMAT DETECTOR
 * ──────────────────────────────────────────────────────────────────────────
 * Makes a lightweight vision call to classify the document format BEFORE
 * any extraction happens. This prevents cross-format field mixing.
 *
 * Returns one of: "format-a" | "format-b" | "format-c" | "format-d"
 */

import axios from "axios";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Use the fastest/cheapest model for detection — just needs to read headers
const DETECTION_MODEL = "google/gemini-2.0-flash-lite-001";

const DETECTION_PROMPT = `You are an industrial document classifier. Look at this document image and identify which format it belongs to.

FORMAT DEFINITIONS:

format-a — COMPREHENSIVE MOTOR/EQUIPMENT AUDIT
  Key identifiers: columns for Equipment Name + Rated Power KW + IE Class + Phase R/Y/B rows + Measured Voltage + Measured Current + Measured kW + Measured PF + Annual Energy Cost
  Also contains: Air compressor, Condenser, Evaporator, Cooling Tower, Blower data
  Row structure: 4 rows per equipment (Phase R, Phase Y, Phase B, Average)

format-b — AHU FAN AUDIT  
  Key identifiers: "AHU" or "Air Handling Unit" in equipment column + Design Flow in CFM + Static Pressure in MMWG + "belt / direct driven" column
  Row structure: 4 rows per AHU (Phase R, Phase Y, Phase B, Average)

format-c — EQUIPMENT NAMEPLATE / MOTOR AUDIT
  Key identifiers: Equipment Name + Frame Size + "Direct Mount / Pulley / Gear" column + VFD installed Y/N + Motor efficiency class
  Does NOT have pump-specific columns (no suction/discharge pressure, no flow in m3/hr)
  Row structure: 4 rows per motor (Phase R, Phase Y, Phase B, Average)

format-d — PUMP / ETP AUDIT
  Key identifiers: "Pump Name" column + Design Flow in m3/hr + Suction Pressure kg/cm2 + Discharge Pressure kg/cm2 + "Throttling Present" column
  Row structure: 4 rows per pump (Phase R, Phase Y, Phase B, Average)

DECISION RULES:
- If you see "AHU" or "CFM" or "MMWG" → format-b
- If you see "Pump" + "Suction" + "Discharge" + "Throttling" → format-d
- If you see "Equipment Name" + motor specs but NO pump/AHU specific columns → format-c
- If you see a large mixed table with motors + pumps + compressors + annual energy cost → format-a
- When unsure between format-a and format-c: if it has Annual Energy Cost or kWh columns → format-a, else → format-c

Return ONLY a single JSON object, nothing else:
{"formatId": "format-b", "confidence": 0.95, "reason": "AHU column with CFM and MMWG headers detected"}`;

export type FormatId = "format-a" | "format-b" | "format-c" | "format-d";

export interface DetectionResult {
  formatId: FormatId;
  confidence: number;
  reason: string;
}

export async function detectDocumentFormat(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<DetectionResult> {
  try {
    const response = await axios.post(OPENROUTER_URL, {
      model: DETECTION_MODEL,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: DETECTION_PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }],
      temperature: 0.0,   // Zero temp — deterministic classification
      max_tokens: 100
    }, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "DocuStruct AI Format Detector",
        "Content-Type": "application/json"
      },
      timeout: 30000
    });

    const raw = response.data?.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error(`No JSON in detection response: ${cleaned}`);

    const parsed = JSON.parse(jsonMatch[0]);
    const formatId = parsed.formatId as FormatId;

    // Validate it's one of our known formats
    if (!["format-a", "format-b", "format-c", "format-d"].includes(formatId)) {
      console.warn(`[DETECTOR] Unknown formatId "${formatId}" — defaulting to format-a`);
      return { formatId: "format-a", confidence: 0.3, reason: "Unknown format, defaulted" };
    }

    console.log(`[DETECTOR] Detected: ${formatId} (confidence: ${parsed.confidence}, reason: ${parsed.reason})`);
    return { formatId, confidence: parsed.confidence || 0.8, reason: parsed.reason || "" };

  } catch (err: any) {
    console.warn(`[DETECTOR] Detection failed: ${err.message} — defaulting to format-a`);
    return { formatId: "format-a", confidence: 0.3, reason: "Detection failed, defaulted" };
  }
}
