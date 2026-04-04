import fitz
import os

PDF_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../assets/maps/peta-blok.pdf"))

def investigate_z(page_idx):
    doc = fitz.open(PDF_PATH)
    page = doc[page_idx]
    drawings = page.get_drawings()
    
    total_z = 0
    total_no_z = 0
    
    for d in drawings:
        items = d.get("items", [])
        has_z = any(item[0] == "z" for item in items)
        if has_z:
            total_z += 1
        else:
            total_no_z += 1
            
    print(f"Halaman {page_idx}:")
    print(f"  Total drawings: {len(drawings)}")
    print(f"  Drawings dengan item 'z': {total_z}")
    print(f"  Drawings TANPA item 'z' : {total_no_z}")
    
    # Lihat satu yang tidak punya Z tapi punya banyak items
    for d in drawings:
        items = d.get("items", [])
        if not any(item[0] == "z" for item in items) and len(items) > 3:
            print(f"\nContoh drawing tanpa Z (items: {len(items)}):")
            print(f"  Rect: {d['rect']}")
            print(f"  Points[0]: {items[0][1]}, Points[-1]: {items[-1][-1]}")
            break

    doc.close()

if __name__ == "__main__":
    investigate_z(12)
