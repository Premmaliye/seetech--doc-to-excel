export function checkOCRQuality(text) {

    const words =
        text.split(/\s+/);

    // VALID WORDS
    const validWords =
        words.filter(word =>
            /^[a-zA-Z0-9]+$/.test(word)
        );

    // MEANINGFUL WORDS
    const meaningfulWords =
        words.filter(word =>
            /^[a-zA-Z]{3,}$/.test(word)
        );

    // SYMBOL COUNT
    const symbolWords =
        words.filter(word =>
            /[^a-zA-Z0-9]/.test(word)
        );

    const validRatio =
        validWords.length / words.length;

    const meaningfulRatio =
        meaningfulWords.length / words.length;

    const symbolRatio =
        symbolWords.length / words.length;

    let quality = "low";

    // BETTER QUALITY LOGIC
    if (
        meaningfulRatio > 0.5 &&
        symbolRatio < 0.2
    ) {
        quality = "high";
    }

    else if (
        meaningfulRatio > 0.25
    ) {
        quality = "medium";
    }

    return {
        quality,

        validRatio:
            validRatio.toFixed(2),

        meaningfulRatio:
            meaningfulRatio.toFixed(2),

        symbolRatio:
            symbolRatio.toFixed(2),

        totalWords:
            words.length,

        meaningfulWords:
            meaningfulWords.length
    };
}