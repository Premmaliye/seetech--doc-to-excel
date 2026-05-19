import os
import sys
import json
import logging
import cv2
import numpy as np
import fitz

# Suppress verbose logs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['FLAGS_enable_onednn'] = '0'
logging.getLogger().setLevel(logging.ERROR)

def run_engine():
    try:
        from paddleocr import PaddleOCR
        
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No file path provided"}))
            return

        file_path = sys.argv[1]
        if not os.path.exists(file_path):
            print(json.dumps({"error": f"File not found: {file_path}"}))
            return

        def is_pdf(fp):
            with open(fp, 'rb') as f:
                return f.read(4) == b'%PDF'

        # Initialize PaddleOCR (Highly Effective Config)
        ocr = PaddleOCR(
            use_angle_cls=True, 
            lang='en', 
            use_gpu=False, 
            show_log=False,
            det_db_thresh=0.3,
            det_db_box_thresh=0.5,
            rec_batch_num=1
        )

        pages_data = []

        def process_image(img):
            # 1. Advanced Preprocessing for PaddleOCR
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Adaptive thresholding to clean up scans
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
            
            # Denoising
            denoised = cv2.fastNlMeansDenoising(thresh, None, 10, 7, 21)
            
            # Convert back to BGR for Paddle
            final_img = cv2.cvtColor(denoised, cv2.COLOR_GRAY2BGR)
            
            res = ocr.ocr(final_img, cls=True)
            lines = []
            if res:
                for page_res in res:
                    if page_res:
                        for line in page_res:
                            box = line[0]
                            text = line[1][0]
                            conf = line[1][1]
                            if conf > 0.1:
                                lines.append({
                                    "text": text,
                                    "confidence": float(conf),
                                    "box": [
                                        [float(box[0][0]), float(box[0][1])],
                                        [float(box[1][0]), float(box[1][1])],
                                        [float(box[2][0]), float(box[2][1])],
                                        [float(box[3][0]), float(box[3][1])]
                                    ]
                                })
            return lines

        if is_pdf(file_path):
            doc = fitz.open(file_path)
            for i in range(len(doc)):
                page = doc.load_page(i)
                # 4x resolution for high accuracy
                pix = page.get_pixmap(matrix=fitz.Matrix(4, 4))
                img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
                
                if pix.n == 4:
                    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
                elif pix.n == 3:
                    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                else:
                    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)

                lines = process_image(img_bgr)
                if lines:
                    pages_data.append({"page": i + 1, "lines": lines})
            doc.close()

        else:
            img = cv2.imread(file_path)
            if img is None:
                print(json.dumps({"error": f"Cannot read image: {file_path}"}))
                return

            # Upscale if small
            h, w = img.shape[:2]
            if h < 2000:
                img = cv2.resize(img, (w*2, h*2), interpolation=cv2.INTER_LANCZOS4)

            lines = process_image(img)
            pages_data.append({"page": 1, "lines": lines})

        if not pages_data:
            print(json.dumps({"error": "OCR engine could not detect any text. Check image quality."}))
        else:
            print(json.dumps(pages_data))

    except Exception as e:
        print(json.dumps({"error": f"Engine failure: {str(e)}"}))

if __name__ == "__main__":
    run_engine()