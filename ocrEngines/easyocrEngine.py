import easyocr
import fitz
import cv2
import numpy as np
import os

# Initialize EasyOCR Reader (Local models)
reader = easyocr.Reader(['en'], gpu=False)

def preprocess_image(image_path):
    img = cv2.imread(image_path)
    if img is None: return image_path
    
    # 1. Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 2. Adaptive Threshold
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11)
    
    # Save to a temporary PNG so OpenCV has a valid extension
    temp_path = image_path + "_pre.png"
    cv2.imwrite(temp_path, thresh)
    return temp_path

def run_easyocr(file_path):
    pages_data = []
    
    if file_path.lower().endswith('.pdf'):
        pdf = fitz.open(file_path)
        for page_num in range(len(pdf)):
            page = pdf.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(4, 4))
            image_path = f"temp_page_{page_num}.png"
            pix.save(image_path)
            processed_path = preprocess_image(image_path)
            
            # EasyOCR Extraction
            results = reader.readtext(processed_path)
            
            structured_lines = []
            for (bbox, text, prob) in results:
                paddle_box = [ [float(p[0]), float(p[1])] for p in bbox ]
                structured_lines.append({
                    "text": text,
                    "confidence": float(prob),
                    "box": paddle_box
                })
                
            pages_data.append({"page": page_num + 1, "lines": structured_lines})
            if os.path.exists(image_path): os.remove(image_path)
            if os.path.exists(processed_path): os.remove(processed_path)
            
    else:
        processed_path = preprocess_image(file_path)
        results = reader.readtext(processed_path)
        structured_lines = []
        for (bbox, text, prob) in results:
            paddle_box = [ [float(p[0]), float(p[1])] for p in bbox ]
            structured_lines.append({
                "text": text,
                "confidence": float(prob),
                "box": paddle_box
            })
        pages_data.append({"page": 1, "lines": structured_lines})
        if processed_path != file_path and os.path.exists(processed_path):
            os.remove(processed_path)
        
    return pages_data