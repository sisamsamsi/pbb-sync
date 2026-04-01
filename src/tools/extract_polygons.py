import fitz
import json
import os
import math

# ── Load konfigurasi georef
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "georef_config.json")
with open(CONFIG_PATH, "r") as f:
    GEOREF = json.load(f)

# ── Kalkulasi affine transform matrix dari 3 titik kontrol
# lat = a*px + b*py + c
# lng = d*px + e*py + f
def calc_matrix(control_points):
    if len(control_points) < 3:
        print("ERROR: butuh minimal 3 titik kontrol untuk georeferencing")
        return None
        
    p = control_points
    # Gunakan 3 titik pertama
    p0, p1, p2 = p[0], p[1], p[2]

    dx1 = p1["px"] - p0["px"]
    dy1 = p1["py"] - p0["py"]
    dx2 = p2["px"] - p0["px"]
    dy2 = p2["py"] - p0["py"]

    dLat1 = p1["lat"] - p0["lat"]
    dLng1 = p1["lng"] - p0["lng"]
    dLat2 = p2["lat"] - p0["lat"]
    dLng2 = p2["lng"] - p0["lng"]

    det = dx1 * dy2 - dx2 * dy1
    if abs(det) < 1e-10:
        print("ERROR: titik kontrol collinear atau skala nol")
        return None

    a = (dLat1 * dy2 - dLat2 * dy1) / det
    b = (dx1 * dLat2 - dx2 * dLat1) / det
    c = p0["lat"] - a * p0["px"] - b * p0["py"]

    d = (dLng1 * dy2 - dLng2 * dy1) / det
    e = (dx1 * dLng2 - dx2 * dLng1) / det
    f = p0["lng"] - d * p0["px"] - e * p0["py"]

    return {"a": a, "b": b, "c": c, "d": d, "e": e, "f": f}

# ── Konversi pixel → GPS
def pixel_to_gps(px, py, matrix):
    lat = matrix["a"] * px + matrix["b"] * py + matrix["c"]
    lng = matrix["d"] * px + matrix["e"] * py + matrix["f"]
    return {"lat": round(lat, 7), "lng": round(lng, 7)}

# ── Cek apakah titik ada di dalam polygon (Ray Casting)
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

# ── Proses satu blok
def process_blok(blok_num, doc, config):
    page_idx  = config["page"]      # 0-indexed
    ctrl_pts  = config["control_points"]
    matrix    = calc_matrix(ctrl_pts)

    if not matrix:
        print(f"  ✗ Gagal kalkulasi matrix untuk blok {blok_num}")
        return []

    page = doc[page_idx]
    print(f"\n=== Blok {blok_num} — Halaman {page_idx + 1} ===")
    print(f"  Page rect: {page.rect}")

    # ── Extract semua path/drawing dari halaman
    drawings = page.get_drawings()
    print(f"  Total drawings: {len(drawings)}")

    # ── Extract text dengan posisi (untuk nomor petak)
    text_blocks = page.get_text("dict")["blocks"]
    texts = []
    for block in text_blocks:
        if block.get("type") == 0:  # type 0 = text
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    txt = span["text"].strip()
                    if txt and txt.isdigit():  # hanya nomor
                        bbox = span["bbox"]
                        cx = (bbox[0] + bbox[2]) / 2
                        cy = (bbox[1] + bbox[3]) / 2
                        texts.append({
                            "nomor": txt.zfill(4),
                            "cx": cx,
                            "cy": cy,
                        })

    print(f"  Total nomor petak ditemukan: {len(texts)}")

    print(f"  Total nomor petak ditemukan: {len(texts)}")

    # ── Filter drawing yang merupakan polygon petak
    polygons = []
    page_area = page.rect.width * page.rect.height
    
    # Area limit: Maksimal 3% dari luas halaman (untuk blok sawah besar)
    # Ini akan memblokir pembatas blok raksasa yang biasanya > 10% halaman.
    MAX_PARCEL_AREA = page_area * 0.03 

    for drawing in drawings:
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
                pts = [(r.x0, r.y0), (r.x1, r.y0),
                       (r.x1, r.y1), (r.x0, r.y1)]

        if len(pts) < 3: continue

        # Kalkulasi Area
        n = len(pts)
        area = 0
        for i in range(n):
            j = (i + 1) % n
            area += pts[i][0] * pts[j][1]
            area -= pts[j][0] * pts[i][1]
        area = abs(area) / 2

        # ── Smart Filtering
        if area < 10 or area > MAX_PARCEL_AREA:
            continue

        points_inside = 0
        for t in texts:
            if point_in_polygon(t["cx"], t["cy"], pts):
                points_inside += 1
        
        # Petak sejati biasanya hanya punya 1 label
        if points_inside > 2:
            continue 

        polygons.append({
            "pts_px": pts,
            "area": area,
        })

    print(f"  Polygon valid: {len(polygons)}")

    # ── Match setiap nomor teks ke polygon
    best_matches = {} 
    unmatched_nomor = []
    
    for text_item in texts:
        nomor = text_item["nomor"]
        if nomor == "0000": continue

        tx, ty = text_item["cx"], text_item["cy"]
        matched = None
        best_area = float('inf') 

        for poly in polygons:
            if point_in_polygon(tx, ty, poly["pts_px"]):
                # Ambil yang terkecil agar tidak kena blok
                if poly["area"] < best_area:
                    best_area = poly["area"]
                    matched = poly

        if matched:
            # Check if we already have a match for this parcel number
            if nomor in best_matches:
                if matched["area"] >= best_matches[nomor]["area"]:
                    continue

            gps_points = [
                pixel_to_gps(px, py, matrix)
                for px, py in matched["pts_px"]
            ]

            seen = set()
            unique_pts = []
            for pt in gps_points:
                key = (pt["lat"], pt["lng"])
                if key not in seen:
                    seen.add(key)
                    unique_pts.append(pt)

            if len(unique_pts) >= 3:
                best_matches[nomor] = {
                    "area": matched["area"],
                    "data": {
                        "blok":        blok_num,
                        "nomor_petak": nomor,
                        "nop":         f"34.02.070.002.{blok_num}.{nomor}.0",
                        "points":      unique_pts,
                        "point_count": len(unique_pts),
                    }
                }
        else:
            unmatched_nomor.append(nomor)

    results = [m["data"] for m in best_matches.values()]
    print(f"  Berhasil di-match: {len(results)}")
    if unmatched_nomor:
        print(f"  X Tidak ter-match: {len(unmatched_nomor)} nomor")
        # limit unmatched output to first 10
        if len(unmatched_nomor) <= 15:
            print(f"    {', '.join(unmatched_nomor)}")
        else:
            print(f"    {', '.join(unmatched_nomor[:15])} ...")
    return results

def main():
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)

    pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../assets/maps/peta-blok.pdf"))
    if not os.path.exists(pdf_path):
        print(f"ERROR: PDF tidak ditemukan di {pdf_path}")
        return

    doc = fitz.open(pdf_path)
    print(f"PDF: {doc.page_count} halaman")

    total_all = 0
    for blok_num in ["013", "014", "015"]:
        if blok_num not in GEOREF:
            continue

        config  = GEOREF[blok_num]
        results = process_blok(blok_num, doc, config)

        if results:
            out_file = os.path.join(output_dir, f"polygons_{blok_num}.json")
            with open(out_file, "w") as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            print(f"  [OK] Tersimpan: {out_file} ({len(results)} polygon)")
            total_all += len(results)

    doc.close()
    print(f"\nTOTAL POLYGON BERHASIL: {total_all}")

if __name__ == "__main__":
    main()
