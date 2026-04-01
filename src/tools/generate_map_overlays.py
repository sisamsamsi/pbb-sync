import fitz
import json
import os
from PIL import Image

def solve_matrix(points):
    # Same logic as in extract_polygons.py to get a,b,c,d,e,f
    p0, p1, p2 = points[0], points[1], points[2]
    dx1, dy1 = p1['px'] - p0['px'], p1['py'] - p0['py']
    dx2, dy2 = p2['px'] - p0['px'], p2['py'] - p0['py']
    dL1, dG1 = p1['lat'] - p0['lat'], p1['lng'] - p0['lng']
    dL2, dG2 = p2['lat'] - p0['lat'], p2['lng'] - p0['lng']
    
    det = dx1 * dy2 - dx2 * dy1
    a = (dL1 * dy2 - dL2 * dy1) / det
    b = (dx1 * dL2 - dx2 * dL1) / det
    c = p0['lat'] - a * p0['px'] - b * p0['py']
    
    d = (dG1 * dy2 - dG2 * dy1) / det
    e = (dx1 * dG2 - dx2 * dG1) / det
    f = p0['lng'] - d * p0['px'] - e * p0['py']
    
    return (a, b, c, d, e, f)

def get_gps(x, y, matrix):
    a, b, c, d, e, f = matrix
    lat = a * x + b * y + c
    lng = d * x + e * y + f
    return {"latitude": lat, "longitude": lng}

def process_overlays(pdf_path, config_path, output_dir):
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    doc = fitz.open(pdf_path)
    overlays_data = {}

    for blok_id, data in config.items():
        print(f"Processing Overlay for Blok {blok_id}...")
        page_idx = data['page']
        page = doc[page_idx]
        width = data['pdf_width']
        height = data['pdf_height']
        
        # Calculate Matrix
        matrix = solve_matrix(data['control_points'])
        
        # Calculate 4 Corners (for React Native MapOverlay)
        # Bounding box is NorthEast, SouthWest
        # We need to find the extremes
        corners = [
            get_gps(0, 0, matrix),
            get_gps(width, 0, matrix),
            get_gps(width, height, matrix),
            get_gps(0, height, matrix)
        ]
        
        lats = [c['latitude'] for c in corners]
        lngs = [c['longitude'] for c in corners]
        
        # Determine Bounds
        bounds = [
            [max(lats), max(lngs)], # NorthEast
            [min(lats), min(lngs)]  # SouthWest
        ]
        
        # Export Page to PNG
        # Scale 2.5 for high fidelity but manageable size
        pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5))
        img_path = os.path.join(output_dir, f"overlay_{blok_id}.png")
        pix.save(img_path)
        
        # Post-process for Transparency (Remove White)
        img = Image.open(img_path).convert("RGBA")
        datas = img.getdata()
        
        new_data = []
        for item in datas:
            # If color is near white (240+), make it transparent
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
        
        img.putdata(new_data)
        img.save(img_path, "PNG")
        
        overlays_data[blok_id] = {
            "image": f"overlay_{blok_id}.png",
            "bounds": bounds,
            "corners": corners
        }

    # Save Config for App
    with open(os.path.join(output_dir, "overlays_config.json"), 'w') as f:
        json.dump(overlays_data, f, indent=2)

    print("Success! Overlays generated in output folder.")

if __name__ == "__main__":
    pdf = "assets/maps/peta-blok.pdf"
    cfg = "src/tools/georef_config.json"
    out = "src/tools/output"
    os.makedirs(out, exist_ok=True)
    process_overlays(pdf, cfg, out)
