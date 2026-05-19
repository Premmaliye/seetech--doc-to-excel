import fs from "fs";

import path from "path";

import { processDocument }
    from "../pipeline/documentProcessor.js";

async function runMetrics() {

    console.log("=================================");
    console.log("RUNNING BENCHMARK TEST");
    console.log("=================================");

    // CHANGE THIS FOLDER
    const benchmarkFolder =
        "benchmarkPdfs/clean";

    // GET FILES
    const files =
        fs.readdirSync(benchmarkFolder);

    console.log("FILES:");
    console.log(files);

    let totalFiles = 0;

    let totalRows = 0;

    let totalValidExtractions = 0;

    let totalInvalidFields = 0;

    const startTime =
        Date.now();

    for (const file of files) {

        const filePath =
            path.join(
                benchmarkFolder,
                file
            );

        console.log("=================================");
        console.log("PROCESSING FILE:");
        console.log(filePath);
        console.log("=================================");

        try {

            const results =
                await processDocument(
                    filePath
                );

            totalFiles++;

            totalRows +=
                results.length;

            for (const row of results) {

                for (const key in row) {

                    const value =
                        row[key];

                    // INVALID
                    if (
                        value === "INVALID"
                    ) {

                        totalInvalidFields++;
                    }

                    // VALID EXTRACTION
                    if (

                        key !== "page" &&
                        key !== "rawText" &&
                        key !== "rowText" &&
                        key !== "ocrQuality" &&
                        key !== "validRatio" &&
                        key !== "meaningfulRatio" &&
                        key !== "symbolRatio" &&

                        value &&
                        value !== "INVALID"

                    ) {

                        totalValidExtractions++;
                    }
                }
            }

        }

        catch (error) {

            console.log("FAILED:");
            console.log(filePath);

            console.log(error.message);
        }
    }

    const endTime =
        Date.now();

    console.log("=================================");
    console.log("FINAL METRICS");
    console.log("=================================");

    console.log("TOTAL FILES:");
    console.log(totalFiles);

    console.log("TOTAL ROWS:");
    console.log(totalRows);

    console.log("VALID EXTRACTIONS:");
    console.log(totalValidExtractions);

    console.log("INVALID FIELDS:");
    console.log(totalInvalidFields);

    console.log("TOTAL TIME:");
    console.log(
        ((endTime - startTime) / 1000)
        + " sec"
    );

    console.log("=================================");
}

runMetrics();