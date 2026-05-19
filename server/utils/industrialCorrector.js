import stringSimilarity from "string-similarity";

/**
 * MASTER INDUSTRIAL DICTIONARY
 * Trained on common audit document terminology for HVAC, Pumps, Motors, and ETP.
 */
const INDUSTRIAL_VOCABULARY = [
    // Mechanical
    "Blower", "Motor", "Pump", "Compressor", "Condenser", "Evaporator", "Chiller", "Impeller", "Fan",
    "Coupling", "Pulley", "Belt", "Gear", "Bearing", "Valve", "Suction", "Discharge", "Static", "Flow",
    "Pressure", "Temperature", "Throttling", "Lubrication", "Mounting", "Foot", "Flange", "Frame", "Size",
    
    // Electrical
    "Voltage", "Current", "Frequency", "Phase", "Power", "Efficiency", "IE1", "IE2", "IE3", "IE4",
    "RPM", "VFD", "Harmonics", "Load", "Loading", "PF", "Connection", "Star", "Delta", "Rated",
    
    // Directions & Locations
    "North", "South", "East", "West", "Floor", "Roof", "Basement", "Terrace", "Outdoor", "Indoor",
    
    // Audit Specific
    "Audit", "Measured", "Design", "Observations", "Equipment", "Application", "Make", "Model",
    "Serial", "Number", "Date", "Duration", "Hours", "Annual", "Energy", "Cost", "Savings"
];

const REPLACEMENT_PATTERNS = [
    { regex: /6outh/gi, replacement: "South" },
    { regex: /Tyof/gi, replacement: "Type of" },
    { regex: /Flpor/gi, replacement: "Floor" },
    { regex: /Plcmt/gi, replacement: "Placement" },
    { regex: /AHu/gi, replacement: "AHU" },
    { regex: /M\}/gi, replacement: "AHU" }, // Common typo for AHU
    { regex: /Si&e/gi, replacement: "Side" },
    { regex: /Notd\)/gi, replacement: "North" },
    { regex: /([0-9])o/gi, replacement: "$10" },
    { regex: /o([0-9])/gi, replacement: "0$1" },
    { regex: /([0-9])i/gi, replacement: "$11" },
    { regex: /l([0-9])/gi, replacement: "1$1" },
    { regex: /Tenrtco/gi, replacement: "Terrace" },
    { regex: /Slower/gi, replacement: "Blower" }
];

export function correctIndustrialOCR(text) {
    if (!text) return "";
    let corrected = text.trim();

    // 1. Apply pattern-based corrections
    REPLACEMENT_PATTERNS.forEach(p => {
        corrected = corrected.replace(p.regex, p.replacement);
    });

    // 2. Multi-word fuzzy dictionary matching
    const words = corrected.split(/\s+/);
    const correctedWords = words.map(word => {
        if (word.length < 4 || /[0-9]/.test(word)) return word;
        
        let bestMatch = word;
        let maxSim = 0.85; // Increased threshold to avoid false positives

        for (const term of INDUSTRIAL_VOCABULARY) {
            const sim = stringSimilarity.compareTwoStrings(term.toLowerCase(), word.toLowerCase());
            if (sim > maxSim) {
                maxSim = sim;
                bestMatch = term;
            }
        }
        return bestMatch;
    });

    const result = correctedWords.join(" ");
    
    if (result !== text) {
        console.log(`    [TRAINED_CORRECTOR] "${text}" -> "${result}"`);
    }

    return result;
}
