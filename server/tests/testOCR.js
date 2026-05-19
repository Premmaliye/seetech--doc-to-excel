import path from "path";

import {
    performOCR,
} from "../services/ocrService.js";

async function test() {

    try {

        const pdfPath = path.join(
            process.cwd(),
            "sample.pdf"
        );

        console.log("Testing OCR on:");
        console.log(pdfPath);

        const result =
            await performOCR(pdfPath);

        console.log("OCR RESULT:");
        console.log(result);

    } catch (err) {

        console.error("OCR FAILED");
        console.error(err);

    }

}

test();