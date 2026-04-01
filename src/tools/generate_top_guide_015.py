import fitz

def generate_top_guide(pdf_path, page_idx, points, output_path):
    doc = fitz.open(pdf_path)
    page = doc[page_idx]
    
    for label, coord in points.items():
        px, py = coord
        size = 15
        page.draw_line(fitz.Point(px-size, py), fitz.Point(px+size, py), color=(1,0,0), width=2)
        page.draw_line(fitz.Point(px, py-size), fitz.Point(px, py+size), color=(1,0,0), width=2)
        page.insert_text(fitz.Point(px+20, py), f"Point {label}", color=(1,0,0), fontname="helv", fontsize=24)

    # Zoom into the TOP area (Rect from 0,0 to width, 800)
    clip_rect = fitz.Rect(0, 0, 1684, 800)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip_rect)
    pix.save(output_path)
    doc.close()

if __name__ == "__main__":
    # Top candidates for Blok 015
    points = {
        "1 (Top)": (860.2, 211.1),
        "2": (914.5, 342.3), # Estimated from earlier
        "166": (889.6, 380.0)
    }
    
    generate_top_guide("assets/maps/peta-blok.pdf", 14, points, "src/tools/calibration_guide_015_top.png")
    print("Top-focus guide for Blok 015 generated.")
