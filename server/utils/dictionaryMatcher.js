import stringSimilarity
    from "string-similarity";

const engineeringDictionary = [
    "temperature", "inspection", "machine", "voltage", "current", "status", "supply", "system", 
    "motor", "exhaust", "floor", "terrace", "belt", "pump", "analysis", "health", "report", 
    "bird", "door", "return", "ahu", "rpm", "inspector", "phase", "measured", "efficiency",
    "rated", "frequency", "suction", "discharge", "pressure", "vfd", "frame", "mounting",
    "pulley", "bearing", "greasing", "alignment", "vibration", "noise", "loading", "annual"
];


// WORDS WE NEVER AUTO-CORRECT
const protectedWords = [

    "inspector",
    "john",
    "johne",
    "motor",
    "pump",
    "active",
    "good"

];

export function correctOCRWords(text) {

    const words =
        text.split(/\s+/);

    const correctedWords =
        words.map(word => {

            const lowerWord =
                word.toLowerCase();

            // SKIP NUMBERS
            if (/^[0-9.\-]+$/.test(lowerWord)) {

                return lowerWord;
            }

            // PROTECTED WORDS
            if (
                protectedWords.includes(
                    lowerWord
                )
            ) {

                return lowerWord;
            }

            // FIND BEST MATCH
            const matches =
                stringSimilarity.findBestMatch(
                    lowerWord,
                    engineeringDictionary
                );

            const bestMatch =
                matches.bestMatch;

            // STRICTER CONFIDENCE
            if (bestMatch.rating > 0.88) {

                // AVOID SAME-WORD REPLACEMENT
                if (
                    bestMatch.target !==
                    lowerWord
                ) {

                    console.log(
                        `CORRECTED: ${lowerWord} -> ${bestMatch.target}`
                    );
                }

                return bestMatch.target;
            }

            return lowerWord;
        });

    return correctedWords.join(" ");
}