import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export async function aiExtract(ocrText, customPrompt = null) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('>>> [AI EXTRACTOR] No API key found in environment.');
        return [];
    }
    
    const prompt = customPrompt 
        ? `${customPrompt}\n\nDOCUMENT TEXT:\n${ocrText}`
        : `You are an expert industrial document digitizer.
Extract ALL equipment data from the following document text into a clean JSON array.

FIELDS TO EXTRACT per row:
- AHU: equipment ID or name (e.g., AHU-01, Pump A1, Motor X1)
- machine: equipment type (e.g., Blower, Pump, Motor, Fan, Scrubber)
- voltage: measured voltage (numeric only, or "--" if missing)
- current: measured current (numeric only, or "--" if missing)
- status: operational status (e.g., Auto, Manual, ON, OFF, Active, Good)
- phase: phase label if present (e.g., R, Y, B, Average, or "--")

RULES:
1. Return ONLY a valid JSON array of objects. No markdown, no explanation.
2. If a value is missing or unclear, use "--".
3. Extract ALL equipment entries from ALL pages.
4. Each piece of equipment should be one row (or multiple rows if it has R/Y/B phases).

DOCUMENT TEXT:
${ocrText}

Return ONLY the JSON array:`;

    const MODELS = [
        "google/gemma-4-31b-it:free",
        "nvidia/nemotron-nano-12b-v2-vl:free"
    ];

    for (const model of MODELS) {
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`>>> [AI EXTRACTOR] Calling ${model} (attempt ${attempt})...`);
                
                const response = await axios.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    {
                        model,
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.1
                    },
                    {
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json"
                        },
                        timeout: 60000
                    }
                );

                const content = response.data.choices[0]?.message?.content || "";
                console.log("[AI EXTRACTOR] Response received, parsing...");

                // Strip markdown fences then extract JSON
                const stripped = content.replace(/```json|```/g, "").trim();
                const arrayMatch = stripped.match(/\[\s*\{[\s\S]*\}\s*\]/);
                const objectMatch = stripped.match(/\{[\s\S]*\}/);
                const jsonStr = arrayMatch ? arrayMatch[0] : (objectMatch ? objectMatch[0] : stripped);

                try {
                    const parsed = JSON.parse(jsonStr);
                    const result = Array.isArray(parsed) ? parsed : [parsed];
                    console.log(`>>> [AI EXTRACTOR] Extracted ${result.length} rows successfully.`);
                    return result;
                } catch (parseError) {
                    console.error(">>> [AI EXTRACTOR] JSON Parse Failed. Raw:", jsonStr.substring(0, 200));
                    return [];
                }

            } catch (error) {
                const status = error.response?.status;
                const errMsg = error.response?.data?.error?.message || error.message;

                if (status === 429 && attempt < MAX_RETRIES) {
                    const delay = attempt * 4000;
                    console.warn(`>>> [AI EXTRACTOR] Rate limited (429) on ${model}. Retrying in ${delay/1000}s...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                console.error(`>>> [AI EXTRACTOR] ${model} failed: ${errMsg}`);
                break; // Try next model
            }
        }
    }

    console.error(">>> [AI EXTRACTOR] All models exhausted. Returning empty.");
    return [];
}