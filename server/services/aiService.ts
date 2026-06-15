import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const OPENROUTER_URL = process.env.OPENROUTER_URL || "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim() || "openrouter/owl-alpha";

function buildDocumentPrompt(ocrText: string, customPrompt?: string) {
  const instructions = customPrompt || `You are an expert document digitizer.

Extract all tabular data from the following OCR text into structured JSON.

Rules:
1. Return ONLY valid JSON.
2. Use this shape:
{
  "detectedFormatId": "format-a",
  "sheets": [
    {
      "name": "OCR_Extraction",
      "rows": [
        { "column1": "value", "column2": "value" }
      ]
    }
  ]
}
3. If you cannot identify table columns confidently, return:
{
  "detectedFormatId": "format-a",
  "sheets": [
    {
      "name": "OCR_Extraction",
      "rows": [
        { "text": "raw line 1" }
      ]
    }
  ]
}
4. Preserve numeric values exactly.
5. Do not add commentary or markdown.`;

  return `${instructions}\n\nOCR_TEXT:\n${ocrText}`;
}

function buildOcrText(ocrPages: any[]): string {
  return (ocrPages || []).map((page, index) => {
    const lines = (page?.lines || []).map((line: any) => line?.text || "").filter(Boolean);
    return `PAGE ${page?.page ?? index + 1}\n${lines.join("\n")}`;
  }).filter(Boolean).join("\n\n");
}




export async function generateAIResponse(messages: any[]) {
  const apiKey = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)?.trim();
  
  if (!apiKey) {
    throw new Error("AI API Key is missing from server environment.");
  }

  try {
    console.log(`[BACKEND AI] Attempting OpenRouter model: ${OPENROUTER_MODEL}`);

    const response = await axios.post(OPENROUTER_URL, {
      model: OPENROUTER_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 6000
    }, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "DocuStruct AI Production",
        "Content-Type": "application/json"
      },
      timeout: 60000
    });

    const data = response.data;
    const rawContent = data.choices?.[0]?.message?.content || "";

    try {
      const debugDir = path.join(process.cwd(), "scratch");
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
      fs.writeFileSync(path.join(debugDir, "last_ai_response.txt"), rawContent);
      console.log("[DEBUG] Saved raw response to scratch/last_ai_response.txt");
    } catch (dErr) {
      console.error("[DEBUG ERROR] Failed to save debug log:", dErr);
    }

    if (!rawContent) {
      throw new Error(`Empty response from model ${OPENROUTER_MODEL}`);
    }

    return data;
  } catch (err: any) {
    const status = err.response?.status;
    const errorData = err.response?.data;
    console.error(`[BACKEND AI ERROR] Model ${OPENROUTER_MODEL} (Status ${status}):`,
      errorData?.error?.message || errorData?.error || err.message);
    throw new Error(errorData?.error?.message || errorData?.error || err.message || "OpenRouter request failed");
  }
}

export async function generateOpenRouterExtraction(ocrPages: any[], customPrompt?: string) {
  const prompt = buildDocumentPrompt(buildOcrText(ocrPages), customPrompt);
  const response = await generateAIResponse([
    { role: "user", content: prompt }
  ]);

  const rawContent = response.data?.choices?.[0]?.message?.content || response.choices?.[0]?.message?.content || "";
  const cleaned = rawContent.replace(/```json\n?|```\n?/g, "").trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`OpenRouter returned non-JSON content: ${cleaned.substring(0, 200)}`);
  }

  return JSON.parse(jsonMatch[0]);
}
