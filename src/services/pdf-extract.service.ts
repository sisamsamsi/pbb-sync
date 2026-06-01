import * as pdfjsLib from "pdfjs-dist";

// Konfigurasi worker PDF.js secara dinamis mencocokkan versi library npm yang terinstall
const pdfjsVersion = pdfjsLib.version || "6.0.227";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

export interface PdfVectorPolygon {
  points: Array<{ x: number; y: number }>;
  wasClosed: boolean;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Mengesktrak vector path (moveTo/lineTo/closePath) dari halaman PDF tertentu secara in-browser
 */
export const extractVectorsFromPdf = async (
  file: File | string,
  pageNumber: number = 1,
  onProgress?: (progress: number) => void
): Promise<PdfVectorPolygon[]> => {
  let pdfData: ArrayBuffer;

  // 1. Load file PDF (bisa dari File upload atau URL string)
  if (typeof file === "string") {
    const res = await fetch(file);
    pdfData = await res.arrayBuffer();
  } else {
    pdfData = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  // 2. Load PDF document
  onProgress?.(10);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  
  onProgress?.(30);
  if (pageNumber > pdf.numPages) {
    throw new Error(`Halaman ${pageNumber} melebihi jumlah halaman PDF (${pdf.numPages})`);
  }

  // 3. Ambil Halaman
  const page = await pdf.getPage(pageNumber);
  
  // 4. Dapatkan Operator List (Drawing Commands)
  onProgress?.(50);
  const opList = await page.getOperatorList();
  
  onProgress?.(80);
  const fnArray = opList.fnArray;
  const argsArray = opList.argsArray;

  // Konstanta kode operasi PDF.js (secara dinamis menyesuaikan versi PDF.js, versi 6 = 91)
  const CONSTRUCT_PATH_OP = (pdfjsLib as any).OPS?.constructPath ?? 91;

  // Konstanta sub-operasi di dalam constructPath (ops)
  const SUB_OPS = {
    MOVE_TO: 0,
    LINE_TO: 1,
    CURVE_TO: 2, // bezierCurveTo
    CURVE_TO_V: 3,
    CURVE_TO_Y: 4,
    RECT: 5,
    CLOSE_PATH: 13,
  };

  const polygons: PdfVectorPolygon[] = [];

  // 5. Parse Operator List
  for (let i = 0; i < fnArray.length; i++) {
    const fnCode = fnArray[i];

    if (fnCode === CONSTRUCT_PATH_OP) {
      const args = argsArray[i];
      if (!args || args.length < 2) continue;

      const subOps = args[0] as number[]; // Array kode sub-operasi (misal: 0, 1, 1, 13)
      const coords = args[1] as number[]; // Array koordinat datar (flat x, y)

      let coordIndex = 0;
      let currentPath: Array<{ x: number; y: number }> = [];
      let wasClosed = false;

      for (let j = 0; j < subOps.length; j++) {
        const op = subOps[j];

        if (op === SUB_OPS.MOVE_TO) {
          // Jika ada path sebelumnya yang menggantung, simpan jika valid
          if (currentPath.length >= 3) {
            polygons.push(createPolygonObject(currentPath, wasClosed));
          }
          currentPath = [];
          wasClosed = false;

          const x = coords[coordIndex++];
          const y = coords[coordIndex++];
          currentPath.push({ x, y });
        } else if (op === SUB_OPS.LINE_TO) {
          const x = coords[coordIndex++];
          const y = coords[coordIndex++];
          currentPath.push({ x, y });
        } else if (op === SUB_OPS.CURVE_TO) {
          // Abaikan control points untuk curve, ambil target koordinat akhir (x3, y3)
          coordIndex += 4; // Lewati x1, y1, x2, y2
          const x3 = coords[coordIndex++];
          const y3 = coords[coordIndex++];
          currentPath.push({ x: x3, y: y3 });
        } else if (op === SUB_OPS.CURVE_TO_V || op === SUB_OPS.CURVE_TO_Y) {
          coordIndex += 2; // Lewati x1, y1 atau x2, y2
          const x2 = coords[coordIndex++];
          const y2 = coords[coordIndex++];
          currentPath.push({ x: x2, y: y2 });
        } else if (op === SUB_OPS.RECT) {
          const rx = coords[coordIndex++];
          const ry = coords[coordIndex++];
          const rw = coords[coordIndex++];
          const rh = coords[coordIndex++];
          
          currentPath = [
            { x: rx, y: ry },
            { x: rx + rw, y: ry },
            { x: rx + rw, y: ry + rh },
            { x: rx, y: ry + rh },
          ];
          wasClosed = true;
        } else if (op === SUB_OPS.CLOSE_PATH) {
          wasClosed = true;
          if (currentPath.length >= 3) {
            polygons.push(createPolygonObject(currentPath, wasClosed));
          }
          currentPath = [];
        }
      }

      // Sisa path jika valid
      if (currentPath.length >= 3) {
        polygons.push(createPolygonObject(currentPath, wasClosed));
      }
    }
  }

  // 6. Filter & Bersihkan Polygon (Abaikan garis tunggal, polygon super kecil, atau jalanan lurus)
  const cleanedPolygons = polygons.filter((p) => {
    if (p.points.length < 3) return false;
    
    // Hitung dimensi bounding box
    const width = p.boundingBox.maxX - p.boundingBox.minX;
    const height = p.boundingBox.maxY - p.boundingBox.minY;
    
    // Abaikan noise kecil (misal noise render font/ikon kecil < 3 PDF pt)
    if (width < 3 || height < 3) return false;
    
    return true;
  });

  onProgress?.(100);
  return cleanedPolygons;
};

/**
 * Helper untuk membuat objek polygon terstruktur beserta perhitungan bounding box
 */
function createPolygonObject(
  points: Array<{ x: number; y: number }>,
  wasClosed: boolean
): PdfVectorPolygon {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  return {
    points,
    wasClosed,
    boundingBox: { minX, minY, maxX, maxY },
  };
}
