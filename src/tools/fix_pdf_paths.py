import fitz
import os
import math

def get_dist(p1, p2):
    return math.sqrt((p1.x-p2.x)**2 + (p1.y-p2.y)**2)

def fix_pdf(input_path, output_path, pages_to_fix):
    doc = fitz.open(input_path)
    print(f"Memproses {input_path}...")

    for page_idx in pages_to_fix:
        page = doc[page_idx]
        drawings = page.get_drawings()
        
        # PyMuPDF tidak bisa langsung 'mengubah' drawing yang ada dengan mudah
        # Jadi kita akan menggambar ulang path yang 'di-fix' sebagai overlay putih (background) 
        # atau kita hanya menggunakan ini sebagai validasi.
        
        # Wait, cara paling efektif di PyMuPDF adalah menggunakan Shape
        shape = page.new_shape()
        fixed_count = 0
        
        for d in drawings:
            items = d.get("items", [])
            if not items: continue
            
            # Cek jika unclosed
            p_start = items[0][1]
            p_end = items[-1][-1]
            
            dist = get_dist(p_start, p_end)
            
            if 0.1 < dist < 50:
                # Gambar ulang path ini dengan flag close=True
                pts = []
                for item in items:
                    if item[0] == "l":
                        pts.append(item[1])
                        pts.append(item[2])
                    elif item[0] == "c":
                        pts.append(item[1])
                        pts.append(item[4])
                
                if len(pts) >= 3:
                    shape.draw_polyline(pts)
                    shape.finish(closepath=True)
                    fixed_count += 1
        
        shape.commit()
        print(f"  Halaman {page_idx+1}: Menambahkan {fixed_count} penutup path.")

    doc.save(output_path)
    doc.close()
    print(f"PDF diperbaiki tersimpan di: {output_path}")

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(__file__)
    IN_PDF = os.path.abspath(os.path.join(BASE_DIR, "../../assets/maps/peta-blok.pdf"))
    OUT_PDF = os.path.abspath(os.path.join(BASE_DIR, "../../assets/maps/peta-blok-fixed.pdf"))
    
    # Blok 013, 014, 015
    fix_pdf(IN_PDF, OUT_PDF, [12, 13, 14])
