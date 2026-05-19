import {
    extractFormat1
} from "../extractors/format1Extractor.js";

const sampleText = `
Phase
Voltage 220
Current 15
Machine PumpA
`;

const result =
    extractFormat1(sampleText);

console.log(result);