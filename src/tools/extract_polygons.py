import fitz
import json
import os
import math

# ── Load konfigurasi georef
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "georef_config.json")
with open(CONFIG_PATH, "r") as f:
    GEOREF = json.load(f)

def calc_matrix(control_points):
    if len(control_points) < 3: return None
    p = control_points
    p0, p1, p2 = p[0], p[1], p[2]
    dx1, dy1 = p1["px"] - p0["px"], p1["py"] - p0["py"]
    dx2, dy2 = p2["px"] - p0["px"], p2["py"] - p0["py"]
    dLat1, dLng1 = p1["lat"] - p0["lat"], p1["lng"] - p0["lng"]
    dLat2, dLng2 = p2["lat"] - p0["lat"], p2["lng"] - p0["lng"]
    det = dx1 * dy2 - dx2 * dy1
    if abs(det) < 1e-10: return None
    a = (dLat1 * dy2 - dLat2 * dy1) / det
    b = (dx1 * dLat2 - dx2 * dLat1) / det
    c = p0["lat"] - a * p0["px"] - b * p0["py"]
    d = (dLng1 * dy2 - dLng2 * dy1) / det
    e = (dx1 * dLng2 - dx2 * dLng1) / det
    f = p0["lng"] - d * p0["px"] - e * p0["py"]
    return {"a": a, "b": b, "c": c, "d": d, "e": e, "f": f}

def pixel_to_gps(px, py, matrix):
    lat = matrix["a"] * px + matrix["b"] * py + matrix["c"]
    lng = matrix["d"] * px + matrix["e"] * py + matrix["f"]
    return {"lat": round(lat, 7), "lng": round(lng, 7)}

def point_in_polygon(px, py, polygon_pts):
    inside = False
    n = len(polygon_pts)
    j = n - 1
    for i in range(n):
        xi, yi = polygon_pts[i]
        xj, yj = polygon_pts[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

def get_dist(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def categorize_gap(dist):
    if dist < 0.1: return "closed", False
    if dist < 2.0: return "tiny_gap", False
    if dist < 10.0: return "small_gap", False
    if dist < 50.0: return "medium_gap", True
    return "large_gap", True

def process_blok(blok_num, doc, config):
    page_idx = config["page"]
    matrix = calc_matrix(config["control_points"])
    if not matrix: return []

    page = doc[page_idx]
    print(f"\n=== Blok {blok_num} — Halaman {page_idx + 1} ===")

    # 1. Ekstrak drawing dan ubah ke list of points (pts)
    drawings = page.get_drawings()
    raw_paths = []
    for d in drawings:
        items = d.get("items", [])
        pts = []
        def add_pt(p):
            if not pts or get_dist(pts[-1], (p.x, p.y)) > 0.05:
                pts.append((p.x, p.y))

        for item in items:
            if item[0] == "l":
                add_pt(item[1]); add_pt(item[2])
            elif item[0] == "c":
                add_pt(item[1]); add_pt(item[4])
            elif item[0] == "re":
                r = item[1]
                pts = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1), (r.x0, r.y0)]
                break
        if len(pts) >= 2:
            raw_paths.append(pts)

    # 2. Gabungkan path yang ujung-ujungnya berhimpitan
    print(f"  Awal: {len(raw_paths)} raw drawing paths")
    
    merged = True
    while merged:
        merged = False
        new_paths = []
        skip_indices = set()
        
        for i in range(len(raw_paths)):
            if i in skip_indices: continue
            p1 = raw_paths[i]
            
            for j in range(i + 1, len(raw_paths)):
                if j in skip_indices: continue
                p2 = raw_paths[j]
                
                # Cek 4 kemungkinan penyambungan ujung
                # p1_end to p2_start
                if get_dist(p1[-1], p2[0]) < 0.5:
                    p1 = p1 + p2[1:]
                    skip_indices.add(j)
                    merged = True
                # p1_start to p2_end
                elif get_dist(p1[0], p2[-1]) < 0.5:
                    p1 = p2 + p1[1:]
                    skip_indices.add(j)
                    merged = True
                # p1_end to p2_end (p2 perlu dibalik)
                elif get_dist(p1[-1], p2[-1]) < 0.5:
                    p1 = p1 + p2[::-1][1:]
                    skip_indices.add(j)
                    merged = True
                # p1_start to p2_start (p2 perlu dibalik)
                elif get_dist(p1[0], p2[0]) < 0.5:
                    p1 = p2[::-1] + p1[1:]
                    skip_indices.add(j)
                    merged = True
            
            new_paths.append(p1)
            
        raw_paths = new_paths
        if merged: print(f"    Sisa: {len(raw_paths)} paths...")

    # 3. Label Teks
    text_blocks = page.get_text("dict")["blocks"]
    texts = []
    for block in text_blocks:
        if block.get("type") == 0:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    txt = span["text"].strip()
                    if txt and txt.isdigit() and txt != "0":
                        bbox = span["bbox"]
                        cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
                        texts.append({"nomor": txt.zfill(4), "cx": cx, "cy": cy})
    
    # 4. Kandidat Polygon (yang area-nya masuk akal)
    page_area = page.rect.width * page.rect.height
    MAX_AREA = page_area        # Auto-close: abaikan kategori gap, biarkan Shoelace menutup seberapapun besarnya.
    
    candidates = []
    for pts in raw_paths:
        if len(pts) < 3: continue
        
        # Hitung Area (Shoelace akan otomatis menutup path)
        n = len(pts)
        area = 0
        for i in range(n):
            p1 = pts[i]
            p2 = pts[(i+1)%len(pts)]
            area += p1[0]*p2[1] - p2[0]*p1[1]
        area = abs(area)/2
        
        # Tingkatkan toleransi area ke 20% halaman
        if area < 10 or area > (page_area * 0.20):
            continue
        
        dist = get_dist(pts[0], pts[-1])
        cat, review = categorize_gap(dist)
        
        candidates.append({
            "pts": pts,
            "area": area,
            "cat": cat,
            "dist": dist,
            "review": review
        })

    print(f"  Kandidat polygon setelah merging: {len(candidates)}")

    # 5. Matching Label
    best_matches = {}
    for t in texts:
        nomor = t["nomor"]
        tx, ty = t["cx"], t["cy"]
        matched_poly = None
        min_area = float('inf')
        
        for poly in candidates:
            if point_in_polygon(tx, ty, poly["pts"]):
                if poly["area"] < min_area:
                    min_area = poly["area"]
                    matched_poly = poly
                    
        if matched_poly:
            gps_pts = [pixel_to_gps(p[0], p[1], matrix) for p in matched_poly["pts"]]
            best_matches[nomor] = {
                "blok": blok_num,
                "nomor_petak": nomor,
                "nop": f"34.02.070.002.{blok_num}.{nomor}.0",
                "points": gps_pts,
                "point_count": len(gps_pts),
                "was_closed": matched_poly["cat"] == "closed",
                "gap_distance": round(matched_poly["dist"], 4),
                "gap_category": matched_poly["cat"],
                "needs_review": matched_poly["review"]
            }

    results = list(best_matches.values())
    print(f"  Match berhasil: {len(results)} dari {len(texts)} label")
    return results

def main():
    pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../assets/maps/peta-blok-fixed.pdf"))
    if not os.path.exists(pdf_path):
        # Fallback to original if fixed not found
        pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../assets/maps/peta-blok.pdf"))
    
    doc = fitz.open(pdf_path)
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)

    total_all = 0
    for blok_num in ["013", "014", "015"]:
        if blok_num not in GEOREF: continue
        res = process_blok(blok_num, doc, GEOREF[blok_num])
        if res:
            out_file = os.path.join(output_dir, f"polygons_{blok_num}.json")
            with open(out_file, "w") as f: json.dump(res, f, indent=2)
            total_all += len(res)

    doc.close()
    print(f"\nTOTAL POLYGON AKHIR: {total_all}")

if __name__ == "__main__":
    main()
