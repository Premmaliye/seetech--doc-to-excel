import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Vision-capable models — confirmed working 2026-05-18
const MODELS = [
  "google/gemini-2.5-flash",          // Best: vision + high accuracy
  "google/gemini-2.0-flash-001",      // Fallback
  "google/gemini-2.0-flash-lite-001", // Lightweight fallback
];




export async function generateAIResponse(messages: any[]) {
  const apiKey = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)?.trim();
  
  if (!apiKey) {
    throw new Error("AI API Key is missing from server environment.");
  }

  let lastError = null;

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    if (i > 0) {
      // Wait 2 seconds between retries to avoid rate-limit cascades
      await new Promise(r => setTimeout(r, 2000));
    }
    try {
      console.log(`[BACKEND AI] Attempting model: ${model}`);
      
      const response = await axios.post(OPENROUTER_URL, {
        model,
        messages,
        temperature: 0.1,
        max_tokens: 4000
      }, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "DocuStruct AI Production",
          "Content-Type": "application/json"
        },
        timeout: 60000
      });

      console.log(`[BACKEND AI] Model ${model} responded successfully`);
      
      const data = response.data;
      const rawContent = data.choices?.[0]?.message?.content || "";
      
      // DEBUG: Save raw response for accuracy analysis
      try {
        const debugDir = path.join(process.cwd(), "scratch");
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
        fs.writeFileSync(path.join(debugDir, "last_ai_response.txt"), rawContent);
        console.log("[DEBUG] Saved raw response to scratch/last_ai_response.txt");
      } catch (dErr) {
        console.error("[DEBUG ERROR] Failed to save debug log:", dErr);
      }

      // Basic Structure Validation
      if (!data.choices?.[0]?.message?.content) {
        console.warn(`[BACKEND AI] Model ${model} returned empty content. Full response:`, JSON.stringify(data));
        throw new Error(`Empty response from model ${model}`);
      }


      return data;
    } catch (err: any) {
      const status = err.response?.status;
      const errorData = err.response?.data;
      console.error(`[BACKEND AI ERROR] Model ${model} (Status ${status}):`, 
        errorData?.error?.message || errorData?.error || err.message);
      
      lastError = errorData?.error?.message || errorData?.error || err.message;
      console.warn(`[BACKEND AI] Falling back from ${model}...`);
      continue;
    }
  }

  throw new Error(`AI Extraction Pipeline Failed. Last error: ${lastError}`);
}
