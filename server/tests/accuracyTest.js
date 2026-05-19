import fs from "fs";
import path from "path";

import { processDocument }
    from "../pipeline/documentProcessor.js";

async function runBenchmark() {

    const pdfFolder =
        "./server/tests/benchmarkPdfs";

    const files =
        fs.readdirSync(pdfFolder);

    const results = [];

    for (const file of files) {

        const validExtensions = [
            ".pdf",
            ".png",
            ".jpg",
            ".jpeg"
        ];

        const ext =
            path.extname(file).toLowerCase();

        if (!validExtensions.includes(ext)) {
            continue;
        }

        console.log("\n====================");
        console.log("TESTING:");
        console.log(file);
        console.log("====================");

        const start =
            Date.now();

        try {

            const result =
                await processDocument(
                    path.join(pdfFolder, file)
                );

            const end =
                Date.now();

            const runtime =
                (end - start) / 1000;

            console.log("RUNTIME:");
            console.log(runtime + " sec");

            results.push({
                file,
                runtime,
                pages: result.length,
                status: "success"
            });

        } catch (error) {

            console.log("FAILED:");
            console.log(error.message);

            results.push({
                file,
                runtime: null,
                pages: 0,
                status: "failed"
            });
        }
    }

    console.log("\nFINAL RESULTS:");
    console.table(results);
}

runBenchmark();