import stringSimilarity from "string-similarity";

const KEYWORDS = [
    "voltage", "current", "rpm", "temperature", "temp", "load", "status", "ahu", "machine", "pf", "frequency", "phase"
];

// Industrial Unit Map for normalization
const UNIT_CLEANER = {
    "v": "voltage",
    "kv": "voltage",
    "a": "current",
    "amp": "current",
    "hz": "frequency",
    "rpm": "rpm",
    "deg": "temperature",
    "c": "temperature"
};

export function extractLayoutEntities(rows) {
    const results = [];
    const allText = rows.map(r => r.items.map(i => i.text).join(" ")).join("\n");
    const allWords = allText.split(/\s+/);

    // Track extracted fields to prevent duplicates
    const finalData = {};

    // 1. ADVANCED KEYWORD-NUMERIC PROXIMITY
    KEYWORDS.forEach(keyword => {
        // Look for the keyword in the text
        const regex = new RegExp(keyword, "i");
        const match = allText.match(regex);

        if (match) {
            // Found keyword! 
            if (keyword === "machine") {
                // For machine, take the rest of the line
                const line = allText.split("\n").find(l => l.toLowerCase().includes(keyword));
                finalData[keyword] = line ? line.trim() : "Unknown";
            } else {
                // For others, look for the NEAREST number within 50 characters
                const searchWindow = allText.substring(match.index, match.index + 50);
                const valueMatch = searchWindow.match(/(\d+[.,]?\d*)/);
                if (valueMatch) {
                    finalData[keyword] = valueMatch[1].replace(",", ".");
                }
            }
        }

    });

    // 2. UNIT-BASED BACKWARDS EXTRACTION
    // If we see "415V", we know it's voltage even without the word "Voltage"
    Object.entries(UNIT_CLEANER).forEach(([unit, field]) => {
        const regex = new RegExp(`(\\d+[.,]?\\d*)\\s*${unit}\\b`, "i");
        const match = allText.match(regex);
        if (match && !finalData[field]) {
            finalData[field] = match[1].replace(",", ".");
        }
    });

    // 3. FALLBACK FOR SPECIFIC ROWS
    for (const row of rows) {
        const rowText = row.items.map(i => i.text).join(" ").toLowerCase();
        
        // Handle common industrial patterns like "V1: 230" or "R-Phase: 415"
        const voltageMatch = rowText.match(/v\d?\s*[:=]?\s*(\d+[.,]?\d*)/);
        if (voltageMatch && !finalData.voltage) finalData.voltage = voltageMatch[1];
        
        const currentMatch = rowText.match(/i\d?\s*[:=]?\s*(\d+[.,]?\d*)/);
        if (currentMatch && !finalData.current) finalData.current = currentMatch[1];
    }

    if (Object.keys(finalData).length > 0) {
        results.push(finalData);
    }

    return results;
}
