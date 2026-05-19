import { processDocument } from "../pipeline/documentProcessor.js";
import { generateAIResponse } from "../services/aiService.js";
import fs from "fs";
import path from "path";

const GROUND_TRUTH = JSON.parse(fs.readFileSync("./server/tests/groundTruth.json", "utf8"));

async function calculateAccuracy(actual, expected) {
    let correct = 0;
    const total = Object.keys(expected).length;
    
    for (const [field, expectedValue] of Object.entries(expected)) {
        const actualValue = actual[field];
        if (String(actualValue).toLowerCase() === String(expectedValue).toLowerCase()) {
            correct++;
        }
    }
    return (correct / total) * 100;
}

async function runBenchmark() {
    console.log("\n🚀 LOCAL ENGINE ACCURACY BENCHMARK\n");
    const results = [];
    
    for (const [filename, data] of Object.entries(GROUND_TRUTH)) {
        const filePath = path.join(process.cwd(), filename);
        if (!fs.existsSync(filePath)) continue;

        console.log(`\n📄 Testing: ${filename}`);
        try {
            const classicalResult = await processDocument(filePath);
            const flatClassical = {};
            classicalResult.forEach(row => Object.assign(flatClassical, row));
            
            const acc = await calculateAccuracy(flatClassical, data.expected);
            results.push({ File: filename, Accuracy: acc.toFixed(2) + "%", Status: acc > 80 ? "✅" : "⚠️" });
            
            console.log("EXTRACTED:", JSON.stringify(flatClassical, null, 2));
        } catch (e) {
            results.push({ File: filename, Accuracy: "CRASH", Status: "❌" });
        }
    }
    console.table(results);
}


runBenchmark();


