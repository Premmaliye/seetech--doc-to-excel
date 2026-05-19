import path from "path";

import {
    processDocument
} from "../pipeline/documentProcessor.js";

async function run() {

    const pdfPath = path.join(
        process.cwd(),
        "sample.pdf"
    );

    const result =
        await processDocument(pdfPath);

    console.log(result);
}

run();