import sys
import fitz
import os
import json

def convert_pdf_to_images(pdf_path, output_dir):
    try:
        doc = fitz.open(pdf_path)
        image_paths = []
        for i in range(len(doc)):
            page = doc.load_page(i)
            pix = page.get_pixmap(dpi=150) # 150 DPI is usually enough for OCR
            out_path = os.path.join(output_dir, f"page_{i}.png")
            pix.save(out_path)
            image_paths.append(out_path)
        doc.close()
        print(json.dumps({"success": True, "images": image_paths}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
    else:
        convert_pdf_to_images(sys.argv[1], sys.argv[2])
