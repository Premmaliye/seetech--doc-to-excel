import express from "express";

import cors from "cors";

import multer from "multer";

import { processDocument }
    from "./server/pipeline/documentProcessor.ts";

const app = express();

app.use(cors());

const upload = multer({
    dest: "uploads/"
});

app.post(

    "/api/upload",

    upload.single("file"),

    async (req, res) => {

        try {

            console.log(
                "FILE RECEIVED"
            );

            const result =
                await processDocument(
                    req.file.path
                );

            const response = {
                detectedFormatId: result.detectedFormatId,
                sheets: [{ 
                    name: "OCR_Extraction", 
                    rows: result.rows, 
                    formatId: result.detectedFormatId 
                }]
            };

            res.json(response);
        }

        catch (error) {

            console.log(error);

            res.status(500).json({

                error:
                    "OCR processing failed"
            });
        }
    }
);

app.listen(5000, () => {

    console.log(
        "SERVER RUNNING ON PORT 5000"
    );
});