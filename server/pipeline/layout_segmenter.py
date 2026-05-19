import cv2
import numpy as np
import sys
import json

def segment_layout(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return {"error": "Image not found"}

    height, width = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 1. Detect Tables (Vertical and Horizontal lines)
    # Using morphological operations to find lines
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
    
    # Horizontal lines
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (width // 40, 1))
    detect_horizontal = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
    
    # Vertical lines
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 40))
    detect_vertical = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
    
    # Combine
    table_mask = cv2.addWeighted(detect_horizontal, 0.5, detect_vertical, 0.5, 0.0)
    table_mask = cv2.threshold(table_mask, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    
    # Find table contours
    cnts, _ = cv2.findContours(table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    tables = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if w > width * 0.2 and h > height * 0.05: # Minimum size for a table
            tables.append({"x": x, "y": y, "w": w, "h": h, "type": "table"})

    # 2. Identify Regions
    # Header: Top 15%
    header = {"x": 0, "y": 0, "w": width, "h": int(height * 0.15), "type": "header"}
    
    # Footer: Bottom 10%
    footer = {"x": 0, "y": int(height * 0.9), "w": width, "h": int(height * 0.1), "type": "footer"}

    regions = [header, footer] + tables
    
    return {
        "width": width,
        "height": height,
        "regions": regions
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        img_path = sys.argv[1]
        result = segment_layout(img_path)
        print(json.dumps(result))
