export function validateEntities(data) {

    // TEMPERATURE
    if (data.temperature) {

        const temp =
            parseFloat(data.temperature);

        if (
            temp < 10 ||
            temp > 80
        ) {

            data.temperature =
                "INVALID";
        }
    }

    // VOLTAGE
    if (data.voltage) {

        const voltage =
            parseFloat(data.voltage);

        if (
            voltage < 100 ||
            voltage > 500
        ) {

            data.voltage =
                "INVALID";
        }
    }

    // CURRENT
    if (data.current) {

        const current =
            parseFloat(data.current);

        if (
            current < 0 ||
            current > 100
        ) {

            data.current =
                "INVALID";
        }
    }

    // RPM
    if (data.rpm) {

        const rpm =
            parseFloat(data.rpm);

        if (
            rpm < 100 ||
            rpm > 5000
        ) {

            data.rpm =
                "INVALID";
        }
    }

    // AHU
    if (data.ahu) {

        const ahu =
            parseFloat(data.ahu);

        if (
            ahu < 1 ||
            ahu > 20000
        ) {

            data.ahu =
                "INVALID";
        }
    }

    // POWER FACTOR (PF)
    if (data.pf) {
        const pf = parseFloat(data.pf);
        if (pf < 0 || pf > 1) {
            data.pf = "INVALID";
        }
    }

    // FREQUENCY (Hz)
    if (data.frequency) {
        const freq = parseFloat(data.frequency);
        if (freq < 45 || freq > 65) {
            data.frequency = "INVALID";
        }
    }

    return data;

}