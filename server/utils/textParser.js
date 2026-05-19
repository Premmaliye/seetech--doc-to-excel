/**
 * Rule-based industrial text parser.
 * Extracts structured data from clean PDF text WITHOUT any AI API calls.
 * Handles common industrial document patterns (AHU, voltage, current, status, etc.)
 */

// Known field patterns - expand this list to handle more document types
const FIELD_PATTERNS = [
    { key: "AHU",       regex: /\b(AHU[-\s]?\d+[\w]*|AHU)\b/i },
    { key: "machine",   regex: /\b(blower|pump|motor|fan|scrubber|compressor|chiller|cooler|heater|transformer|panel)\b/i },
    { key: "voltage",   regex: /(?:voltage|volts?|v)\s*[:\-]?\s*(\d+\.?\d*)/i },
    { key: "current",   regex: /(?:current|amps?|a)\s*[:\-]?\s*(\d+\.?\d*)/i },
    { key: "power",     regex: /(?:power|kw|watt)\s*[:\-]?\s*(\d+\.?\d*)/i },
    { key: "pf",        regex: /(?:power\s*factor|p\.?f\.?)\s*[:\-]?\s*(\d+\.?\d*)/i },
    { key: "rpm",       regex: /\b(\d{3,4})\s*rpm\b/i },
    { key: "phase",     regex: /\bphase\s*[:\-]?\s*([RYBrybAvg]+|R\/Y\/B|Average)/i },
    { key: "status",    regex: /\b(auto|manual|on|off|active|inactive|good|fault|running|stopped|trip)\b/i },
    { key: "make",      regex: /(?:make|brand|manufacturer)\s*[:\-]?\s*([\w\s]+)/i },
    { key: "model",     regex: /(?:model|type)\s*[:\-]?\s*([\w\s\-]+)/i },
    { key: "location",  regex: /(?:location|area|zone|floor|room)\s*[:\-]?\s*([\w\s\-]+)/i },
    { key: "rating",    regex: /(?:rating|rated|capacity)\s*[:\-]?\s*([\d\.]+\s*[\w]+)/i },
];

/**
 * Extract a single value from a text line using a pattern
 */
function extractValue(line, pattern) {
    const match = line.match(pattern.regex);
    if (!match) return null;
    // Return capture group if present, else full match
    return (match[1] || match[0]).trim();
}

/**
 * Parse a block of text lines into a structured row object.
 */
function parseTextBlock(lines) {
    const row = {};

    // Also check for simple "Key Value" or "Key: Value" patterns on each line
    for (const line of lines) {
        const kvMatch = line.match(/^([A-Za-z][A-Za-z\s]{1,20}?)\s*[:\-]\s*(.+)$/);
        if (kvMatch) {
            const k = kvMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
            const v = kvMatch[2].trim();
            if (k && v && !row[k]) {
                row[k] = v;
            }
        }

        // Also scan for known field patterns
        for (const pattern of FIELD_PATTERNS) {
            if (!row[pattern.key]) {
                const val = extractValue(line, pattern);
                if (val) row[pattern.key] = val;
            }
        }
    }

    return Object.keys(row).length > 0 ? row : null;
}

/**
 * Main parser: takes full document text (all pages combined) and returns rows.
 */
export function parseDocumentText(fullText) {
    const rows = [];

    // Split by page markers if present
    const pageBlocks = fullText.split(/===\s*PAGE\s*\d+\s*===/i).filter(b => b.trim());

    for (const block of pageBlocks) {
        const lines = block.split("\n").map(l => l.trim()).filter(l => l.length > 2);
        if (lines.length === 0) continue;

        // Group lines into equipment records
        // A new record starts when we detect an equipment ID or a header-like line
        const groups = [];
        let currentGroup = [];

        for (const line of lines) {
            const isNewEquipment = 
                /\b(AHU|PUMP|MOTOR|FAN|BLOWER|CHILLER|PANEL)\s*[-#]?\s*\d+/i.test(line) ||
                /^\d+[\.\)]\s+/.test(line) || // Numbered list: "1. Equipment"
                (currentGroup.length > 5); // Limit group size

            if (isNewEquipment && currentGroup.length > 0) {
                groups.push([...currentGroup]);
                currentGroup = [];
            }
            currentGroup.push(line);
        }
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        // Parse each group into a row
        for (const group of groups) {
            const row = parseTextBlock(group);
            if (row) {
                rows.push(row);
            }
        }

        // If no structured groups were found, parse the whole block as one record
        if (groups.length === 0 || rows.length === 0) {
            const fallbackRow = parseTextBlock(lines);
            if (fallbackRow) rows.push(fallbackRow);
        }
    }

    // Final fallback: if still empty, do a flat line-by-line scan
    if (rows.length === 0) {
        const allLines = fullText.split("\n").map(l => l.trim()).filter(l => l.length > 2);
        const flatRow = parseTextBlock(allLines);
        if (flatRow) rows.push(flatRow);
    }

    console.log(`>>> [TEXT PARSER] Extracted ${rows.length} records from document text.`);
    return rows;
}
