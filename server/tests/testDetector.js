import {
    detectFormat
} from "../detectors/formatDetector.js";

const sampleText = `
Phase Voltage 220
Current
Machine Pump
`;

const result = detectFormat(sampleText);

console.log("Detected Format:");
console.log(result);