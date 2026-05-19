"""
Lightweight PDF/Image text extractor using PyMuPDF only.
No PaddleOCR, no GPU, no ML models - just pure text extraction.
Output format matches the existing pipeline expectation.
"""
import sys
import json
import os

def extract_text(file_path):
    try:
        import fitz  # PyMuPDF

        if not os.path.exists(file_path):
            print(json.dumps({"error": f"File not found: {file_path}"}))
            return

        pages_data = []

        doc = fitz.open(file_path)
        for i in range(len(doc)):
            page = doc.load_page(i)
            text = page.get_text("text")  # Plain text extraction

            # Split into lines and build the expected format
            lines_raw = [l.strip() for l in text.split("\n") if l.strip()]

            if not lines_raw:
                continue

            # Build lines in the format the pipeline expects
            lines = []
            y_pos = 0
            for line_text in lines_raw:
                lines.append({
                    "text": line_text,
                    "confidence": 0.95,  # High confidence - direct text extraction
                    "box": [
                        [0, y_pos],
                        [500, y_pos],
                        [500, y_pos + 20],
                        [0, y_pos + 20]
                    ]
                })
                y_pos += 20

            if lines:
                pages_data.append({"page": i + 1, "lines": lines})

        doc.close()

        if not pages_data:
            print(json.dumps({"error": "No text found in document."}))
        else:
            print(json.dumps(pages_data))

    except Exception as e:
        print(json.dumps({"error": f"Extraction failed: {str(e)}"}))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
    else:
        extract_text(sys.argv[1])
