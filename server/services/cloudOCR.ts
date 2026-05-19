import axios from "axios";
import fs from "fs";

export async function performCloudOCR(filePath: string) {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("API Key missing for Cloud OCR");

    const imageBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
    
    console.log(">>> [CLOUD OCR] Requesting high-accuracy vision extraction...");
    console.log("    [TRAINING] Injecting Industrial Domain Knowledge into Vision Model...");

    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
            {
                role: "system",
                content: `You are an expert Industrial Document Digitizer. 
                You are reading facility audit tables (Motors, Pumps, AHUs).
                PRECISION RULES:
                1. TABLE STRUCTURE: Preserve the horizontal and vertical alignment of data.
                2. NUMERIC ACCURACY: Ensure technical specs (kW, RPM, Voltage, Current) are read exactly.
                3. INDUSTRIAL TERMS: Correct obvious OCR typos (e.g., 'Slower' -> 'Blower').
                4. OUTPUT: Return ONLY a JSON array of objects: {text, confidence, box: [[x,y],[x,y],[x,y],[x,y]]}. Use 0-1000 coordinates.`
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "Perform OCR on this industrial document." },
                    { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
                ]
            }
        ]
    }, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
    });

    const content = response.data.choices[0].message.content;
    const cleaned = content.replace(/```json|```/g, "").trim();
    const lines = JSON.parse(cleaned);

    return [{ page: 1, lines }];
}
