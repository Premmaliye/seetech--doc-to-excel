import { findNearestValue }
    from "../utils/proximityExtractor.js";

export function extractEntities(text) {

    const entities = {};

    // AHU
    const ahuValue =
        findNearestValue(
            text,
            "ahu"
        );

    if (ahuValue) {

        entities.ahu =
            ahuValue;
    }

    // RPM
    const rpmValue =
        findNearestValue(
            text,
            "rpm"
        );

    if (rpmValue) {

        entities.rpm =
            rpmValue;
    }

    // TEMPERATURE
    const tempValue =
        findNearestValue(
            text,
            "temperature"
        );

    if (tempValue) {

        entities.temperature =
            tempValue;
    }

    // VOLTAGE
    const voltageValue =
        findNearestValue(
            text,
            "voltage"
        );

    if (voltageValue) {

        entities.voltage =
            voltageValue;
    }

    // CURRENT
    const currentValue =
        findNearestValue(
            text,
            "current"
        );

    if (currentValue) {

        entities.current =
            currentValue;
    }

    // FLOOR
    const floorMatch =
        text.match(
            /([0-9]+)(st|nd|rd|th)?floor/i
        );

    if (floorMatch) {

        entities.floor =
            floorMatch[0];
    }

    // BELT
    if (
        text.includes("belt")
    ) {

        entities.belt =
            "Detected";
    }

    // EXHAUST
    if (
        text.includes("exhaust")
    ) {

        entities.exhaust =
            "Detected";
    }

    // MOTOR
    if (
        text.includes("motor")
    ) {

        entities.motor =
            "Detected";
    }

    // SUPPLY SYSTEM
    if (
        text.includes(
            "supply system"
        )
    ) {

        entities.supplySystem =
            "Detected";
    }

    // BIRD DOOR
    if (
        text.includes(
            "bird door"
        )
    ) {

        entities.birdDoor =
            "Detected";
    }

    return entities;
}