export function normalizeOCRText(text) {

    const corrections = {

        "insnection": "inspection",
        "voltuze": "voltage",
        "nachine": "machine",
        "gcod": "good",
        "tetrepor": "temperature",
        "syppyjynem": "supply system",
        "mergureg": "merger",
        "brd hdor": "bird door"

    };

    let normalized =
        text.toLowerCase();

    for (const wrong in corrections) {

        const correct =
            corrections[wrong];

        const regex =
            new RegExp(wrong, "gi");

        normalized =
            normalized.replace(regex, correct);
    }

    return normalized;
}