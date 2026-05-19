export function extractFormat1(text) {

    const data = {
        phase: null,
        voltage: null,
        current: null,
        machine: null,
        confidence: "low"
    };

    const lowerText =
        text.toLowerCase();

    // VOLTAGE KEYWORDS
    const voltageKeywords = [
        "voltage",
        "voltuze",
        "voitage"
    ];

    // CURRENT KEYWORDS
    const currentKeywords = [
        "current",
        "curent"
    ];

    // MACHINE KEYWORDS
    const machineKeywords = [
        "machine",
        "nachine"
    ];

    // PHASE KEYWORDS
    const phaseKeywords = [
        "phase",
        "pnas"
    ];

    // FIND VOLTAGE
    for (const keyword of voltageKeywords) {

        const regex =
            new RegExp(
                `${keyword}\\s*(\\d+)`,
                "i"
            );

        const match =
            text.match(regex);

        if (match) {
            data.voltage = match[1];
            break;
        }
    }

    // FIND CURRENT
    for (const keyword of currentKeywords) {

        const regex =
            new RegExp(
                `${keyword}\\s*(\\d+)`,
                "i"
            );

        const match =
            text.match(regex);

        if (match) {
            data.current = match[1];
            break;
        }
    }

    // FIND MACHINE
    for (const keyword of machineKeywords) {

        const regex =
            new RegExp(
                `${keyword}\\s*([A-Za-z0-9 ]+)`,
                "i"
            );

        const match =
            text.match(regex);

        if (match) {
            data.machine =
                match[1].trim();
            break;
        }
    }

    // FIND PHASE
    for (const keyword of phaseKeywords) {

        if (lowerText.includes(keyword)) {
            data.phase = "Detected";
            break;
        }
    }

    // CONFIDENCE SCORE
    let score = 0;

    if (data.phase) score++;
    if (data.voltage) score++;
    if (data.current) score++;
    if (data.machine) score++;

    if (score >= 3) {
        data.confidence = "high";
    }

    else if (score >= 2) {
        data.confidence = "medium";
    }

    return data;
}