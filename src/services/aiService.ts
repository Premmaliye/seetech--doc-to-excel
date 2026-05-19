import axios from "axios";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-7b-instruct:free"
];

export async function generateAIResponse(messages: any[]) {
  const apiKey = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)?.trim();
  
  if (!apiKey) {
    throw new Error("AI API Key is missing from environment variables.");
  }

  let lastError = null;

  for (const model of MODELS) {
    try {
      console.log(`[AI SERVICE] Attempting model: ${model}`);
      
      const response = await axios.post(OPENROUTER_URL, {
        model,
        messages,
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "DocuStruct AI Production",
          "Content-Type": "application/json"
        },
        timeout: 60000 // 60s timeout
      });

      console.log(`[AI SERVICE] Success with ${model}`);
      return response.data;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message;
      console.warn(`[AI SERVICE] Model ${model} failed: ${msg}`);
      lastError = msg;
      continue;
    }
  }

  throw new Error(`AI Extraction Pipeline Failed after multiple attempts. Last error: ${lastError}`);
}
