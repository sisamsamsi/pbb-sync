import fitz

def generate_guide(pdf_path, page_idx, points, output_path, title):
    doc = fitz.open(pdf_path)
    page = doc[page_idx]
    
    for label, coord in points.items():
        px, py = coord
        size = 15
        page.draw_line(fitz.Point(px-size, py), fitz.Point(px+size, py), color=(1,0,0), width=2)
        page.draw_line(fitz.Point(px, py-size), fitz.Point(px, py+size), color=(1,0,0), width=2)
        page.insert_text(fitz.Point(px+20, py), f"{label}", color=(1,0,0), fontname="helv", fontsize=24)

    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    pix.save(output_path)
    doc.close()

if __name__ == "__main__":
    pdf = "assets/maps/peta-blok.pdf"
    
    # Blok 014 (Pg 14)
    pts014 = {
        "TL: 1": (282.7, 373.4),
        "TR: 191": (1522.2, 696.1),
        "BL: 150": (163.4, 1547.7),
        "BR: 014": (1351.7, 2263.9)
    }
    generate_guide(pdf, 13, pts014, "src/tools/calibration_guide_014.png", "Blok 014")

    # Blok 015 (Pg 15)
    pts015 = {
        "TL: 0": (754.3, 269.2),
        "TR: 1": (860.2, 211.1),
        "BL: 148": (518.7, 1937.3),
        "BR: 015": (1351.7, 2263.9)
    }
    generate_guide(pdf, 14, pts015, "src/tools/calibration_guide_015.png", "Blok 015")
    
    print("Guides for 014 and 015 generated successfully.")
