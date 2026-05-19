import os
import sys
import json
import cv2
import numpy as np
import fitz

# --- FORCED STABILITY FLAGS ---
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['FLAGS_enable_onednn'] = '0'
os.environ['FLAGS_cpu_deterministic'] = '1'
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'
os.environ['OMP_NUM_THREADS'] = '1'

try:
    import paddle
    from paddleocr import PaddleOCR
    
    ocr = PaddleOCR(
        use_angle_cls=True,
        lang='en',
        show_log=False,
        use_gpu=False,
        enable_mkldnn=False,
        rec_batch_num=1
    )
    print("DEBUG: PaddleOCR Initialized Successfully", file=sys.stderr)
except Exception as e:
    print(f"CRITICAL: Failed to initialize PaddleOCR Engine: {str(e)}", file=sys.stderr)
    sys.exit(1)

def preprocess_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        print(f"DEBUG: Failed to read image at {image_path}", file=sys.stderr)
        return image_path
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    save_path = image_path + "_proc.png"
    cv2.imwrite(save_path, enhanced)
    print(f"DEBUG: Preprocessing Complete. Saved to {save_path}", file=sys.stderr)
    return save_path

def run_paddleocr(file_path):
    try:
        pages_data = []
        print(f"DEBUG: Processing File -> {file_path}", file=sys.stderr)
        
        if file_path.lower().endswith('.pdf'):
            pdf = fitz.open(file_path)
            for i in range(len(pdf)):
                page = pdf.load_page(i)
                pix = page.get_pixmap(matrix=fitz.Matrix(3, 3))
                img_path = f"temp_page_{i}.png"
                pix.save(img_path)
                
                print(f"DEBUG: Running OCR on Page {i+1}...", file=sys.stderr)
                res = ocr.ocr(img_path, cls=True)
                print(f"DEBUG: Raw OCR result length: {len(res) if res else 0}", file=sys.stderr)
                
                lines = []
                if res:
                    for page_res in res:
                        if page_res:
                            for line in page_res:
                                lines.append({
                                    "text": line[1][0],
                                    "confidence": float(line[1][1]),
                                    "box": line[0]
                                })
                
                print(f"DEBUG: Page {i+1} total lines extracted: {len(lines)}", file=sys.stderr)
                pages_data.append({"page": i+1, "lines": lines})
                if os.path.exists(img_path): os.remove(img_path)
        else:
            processed_path = preprocess_image(file_path)
            res = ocr.ocr(processed_path, cls=True)
            print(f"DEBUG: Raw OCR result length: {len(res) if res else 0}", file=sys.stderr)
            
            lines = []
            if res:
                for page_res in res:
                    if page_res:
                        for line in page_res:
                            lines.append({
                                "text": line[1][0],
                                "confidence": float(line[1][1]),
                                "box": line[0]
                            })
            
            print(f"DEBUG: Total lines extracted: {len(lines)}", file=sys.stderr)
            pages_data.append({"page": 1, "lines": lines})
            if processed_path != file_path and os.path.exists(processed_path):
                os.remove(processed_path)
                
        return pages_data
    except Exception as e:
        print(f"ERROR during OCR execution: {str(e)}", file=sys.stderr)
        return []