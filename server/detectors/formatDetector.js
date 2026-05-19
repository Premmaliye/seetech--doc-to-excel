import stringSimilarity from "string-similarity";

const FORMAT_SIGNATURES = {
    "format-a": ["Comprehensive Audit", "Air comp", "Condenser", "Evaporator", "Annual Energy Cost", "Q ,m3/hr"],
    "format-b": ["AHU Fan", "Design Flow, CFM", "Static Pressure, MMWG", "belt / direct driven", "MMWG"],
    "format-c": ["Equipment Nameplate", "Direct Mount/ Pulley/ Gear", "VFD details", "Motor Efficiency"],
    "format-d": ["Pump Name", "ETP Audit", "Design Flow (m3/hr)", "Suction Pressure (kg/cm2)", "Throttling Present"]
};

export function detectFormat(text) {
    if (!text) return "unknown";
    const lowerText = text.toLowerCase();
    
    let bestFormat = "format-a"; // Default fallback
    let maxScore = 0;

    for (const [formatId, keywords] of Object.entries(FORMAT_SIGNATURES)) {
        let currentScore = 0;
        
        keywords.forEach(keyword => {
            const lowerKeyword = keyword.toLowerCase();
            if (lowerText.includes(lowerKeyword)) {
                currentScore += 10; // Exact match bonus
            } else {
                // Fuzzy match for noisy OCR
                const words = lowerText.split(/\s+/);
                words.forEach(word => {
                    if (word.length < 4) return;
                    const sim = stringSimilarity.compareTwoStrings(lowerKeyword, word);
                    if (sim > 0.8) currentScore += sim * 5;
                });
            }
        });

        if (currentScore > maxScore) {
            maxScore = currentScore;
            bestFormat = formatId;
        }
        console.log(`    [DETECTOR] Score for ${formatId}: ${currentScore.toFixed(1)}`);
    }

    // If confidence is extremely low, stick to Format A as it's the most generic
    return maxScore > 2 ? bestFormat : "format-a";
}