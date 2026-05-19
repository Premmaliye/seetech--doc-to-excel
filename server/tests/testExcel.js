import {
    generateExcel
} from "../excel/excelGenerator.js";

const sampleData = [
    {
        phase: "Detected",
        voltage: "220",
        current: "15",
        machine: "PumpA",
    }
];

generateExcel(sampleData);