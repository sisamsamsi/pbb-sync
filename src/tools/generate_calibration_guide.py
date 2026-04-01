import fitz

def generate_guide(pdf_path, page_idx, points, output_path):
    doc = fitz.open(pdf_path)
    page = doc[page_idx]
    
    # Draw points on the page
    for wp, coord in points.items():
        px, py = coord
        # Draw a red cross (X)
        size = 15
        # Horizontal line
        page.draw_line(fitz.Point(px - size, py), fitz.Point(px + size, py), color=(1, 0, 0), width=2)
        # Vertical line
        page.draw_line(fitz.Point(px, py - size), fitz.Point(px, py + size), color=(1, 0, 0), width=2)
        # Label
        page.insert_text(fitz.Point(px + 20, py), f"Point {wp}", color=(1, 0, 0), fontname="helv", fontsize=24)

    # Export to high-res PNG (2.0 scale)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    pix.save(output_path)
    doc.close()

if __name__ == "__main__":
    # Pixels found earlier:
    # 1: 381.4 , 611.9
    # 238: 155.0 , 1443.1
    # 204: 1404.5 , 1792.1
    
    points = {
        "0001 (1)": (381.4, 611.9),
        "0238": (155.0, 1443.1),
        "0204": (1404.5, 1792.1)
    }
    
    pdf = "assets/maps/peta-blok.pdf"
    output = "src/tools/calibration_guide_013.png"
    generate_guide(pdf, 12, points, output)
    print(f"Guide saved to {output}")
