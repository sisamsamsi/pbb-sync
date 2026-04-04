import fitz
import json
import os
import math

# ── Konfigurasi
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "georef_config.json")
PDF_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../assets/maps/peta-blok.pdf"))
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
REPORT_PATH = os.path.join(OUTPUT_DIR, "diagnosis_report.json")

def get_distance(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def categorize_gap(dist):
    if dist < 0.001: return "closed"
    if dist < 2.0: return "tiny_gap"
    if dist < 10.0: return "small_gap"
    if dist < 50.0: return "medium_gap"
    return "large_gap"

def point_in_polygon(px, py, polygon_pts):
    inside = False
    n = len(polygon_pts)
    if n < 3: return False
    j = n - 1
    for i in range(n):
        xi, yi = polygon_pts[i]
        xj, yj = polygon_pts[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

def diagnose_page(doc, page_idx, blok_num):
    page = doc[page_idx]
    drawings = page.get_drawings()
    
    # Extract text with position
    text_blocks = page.get_text("dict")["blocks"]
    texts = []
    for block in text_blocks:
        if block.get("type") == 0:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    txt = span["text"].strip()
                    if txt and txt.isdigit() and txt != "0":
                        bbox = span["bbox"]
                        cx = (bbox[0] + bbox[2]) / 2
                        cy = (bbox[1] + bbox[3]) / 2
                        texts.append({"nomor": txt.zfill(4), "cx": cx, "cy": cy})

    stats = {
        "blok": blok_num,
        "page_index": page_idx,
        "total_drawings": len(drawings),
        "closed_paths": 0,
        "unclosed_paths": 0,
        "by_gap_category": {
            "tiny_gap": 0,
            "small_gap": 0,
            "medium_gap": 0,
            "large_gap": 0
        },
        "unclosed_details": []
    }

    page_area = page.rect.width * page.rect.height
    MAX_PARCEL_AREA = page_area * 0.03

    unclosed_list = []

    for d_idx, drawing in enumerate(drawings):
        items = drawing.get("items", [])
        if not items: continue

        pts = []
        for item in items:
            kind = item[0]
            if kind == "l":
                pts.append((item[1].x, item[1].y))
                pts.append((item[2].x, item[2].y))
            elif kind == "c":
                pts.append((item[1].x, item[1].y))
                pts.append((item[4].x, item[4].y))
            elif kind == "re":
                r = item[1]
                pts = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]

        if len(pts) < 2: continue
        
        # Unique points to check if closed
        # Note: PyMuPDF sometimes repeats line points, we care about first and last
        first = pts[0]
        last = pts[-1]
        dist = get_distance(first, last)
        cat = categorize_gap(dist)

        # Calculate Area (even if unclosed, treat as closed for label matching)
        n = len(pts)
        area = 0
        for i in range(n):
            j = (i + 1) % n
            area += pts[i][0] * pts[j][1]
            area -= pts[j][0] * pts[i][1]
        area = abs(area) / 2

        if area < 10 or area > MAX_PARCEL_AREA:
            continue

        if cat == "closed":
            stats["closed_paths"] += 1
        else:
            stats["unclosed_paths"] += 1
            stats["by_gap_category"][cat] += 1
            
            # Find matching parcel number
            matched_nomor = None
            for t in texts:
                if point_in_polygon(t["cx"], t["cy"], pts):
                    matched_nomor = t["nomor"]
                    break
            
            if matched_nomor:
                stats["unclosed_details"].append({
                    "nomor_petak": matched_nomor,
                    "gap_distance": round(dist, 4),
                    "category": cat,
                    "first_point": [round(first[0], 2), round(first[1], 2)],
                    "last_point": [round(last[0], 2), round(last[1], 2)],
                    "point_count": len(pts),
                    "area": round(area, 2)
                })

    return stats

def main():
    if not os.path.exists(PDF_PATH):
        print(f"ERROR: PDF not found at {PDF_PATH}")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    
    report = {}
    total_unclosed = 0
    
    # Blok mapping from georef_config
    with open(CONFIG_PATH, "r") as f:
        georef = json.load(f)
    
    for blok_num, config in georef.items():
        page_idx = config["page"]
        print(f"Diagnosing Blok {blok_num} (Page {page_idx})...")
        page_stats = diagnose_page(doc, page_idx, blok_num)
        report[f"blok_{blok_num}"] = page_stats
        total_unclosed += page_stats["unclosed_paths"]

    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\nDiagnosis complete. Report saved to: {REPORT_PATH}")
    print(f"Total unclosed paths found: {total_unclosed}")
    
    for blok, s in report.items():
        print(f"\n{blok.upper()}:")
        print(f"  Closed: {s['closed_paths']}")
        print(f"  Unclosed: {s['unclosed_paths']}")
        for cat, count in s['by_gap_category'].items():
            if count > 0:
                print(f"    - {cat}: {count}")

    doc.close()

if __name__ == "__main__":
    main()
