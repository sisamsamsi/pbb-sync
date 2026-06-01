export interface LatLng {
  lat: number;
  lng: number;
}

export interface PixelPoint {
  px: number;
  py: number;
}

export interface ControlPoint extends LatLng, PixelPoint {}

export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * Kalkulasi affine transform matrix dari 3 atau 4 titik kontrol
 * Menggunakan rumus sistem persamaan linear untuk Affine Transform 2D:
 *   lat = a*px + b*py + c
 *   lng = d*px + e*py + f
 */
export const calcTransformMatrix = (controlPoints: ControlPoint[]): AffineMatrix | null => {
  if (controlPoints.length < 3) return null;

  // Menggunakan 3 titik kontrol pertama untuk kalkulasi Affine Transform
  const [p0, p1, p2] = controlPoints;

  const dx1 = p1.px - p0.px;
  const dy1 = p1.py - p0.py;
  const dx2 = p2.px - p0.px;
  const dy2 = p2.py - p0.py;

  const dLat1 = p1.lat - p0.lat;
  const dLng1 = p1.lng - p0.lng;
  const dLat2 = p2.lat - p0.lat;
  const dLng2 = p2.lng - p0.lng;

  // Determinan matriks 2D
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-12) return null;

  // Koefisien untuk lintang (Latitude)
  const a = (dLat1 * dy2 - dLat2 * dy1) / det;
  const b = (dx1 * dLat2 - dx2 * dLat1) / det;
  const c = p0.lat - a * p0.px - b * p0.py;

  // Koefisien untuk bujur (Longitude)
  const d = (dLng1 * dy2 - dLng2 * dy1) / det;
  const e = (dx1 * dLng2 - dx2 * dLng1) / det;
  const f = p0.lng - d * p0.px - e * p0.py;

  return { a, b, c, d, e, f };
};

/**
 * Konversi satu titik pixel PDF (px, py) → koordinat GPS (lat, lng) menggunakan matriks Affine
 */
export const pixelToLatLng = (
  px: number,
  py: number,
  matrix: AffineMatrix | null
): LatLng | null => {
  if (!matrix) return null;
  return {
    lat: matrix.a * px + matrix.b * py + matrix.c,
    lng: matrix.d * px + matrix.e * py + matrix.f,
  };
};

/**
 * Menghitung titik tengah (centroid) dari sekelompok koordinat polygon GPS (untuk penempatan label nama WP)
 */
export const getCentroid = (points: LatLng[]): LatLng => {
  if (points.length === 0) return { lat: 0, lng: 0 };
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  return { lat, lng };
};

/**
 * Mendeteksi apakah suatu titik GPS berada di dalam bidang polygon
 * Menggunakan Algoritma Ray Casting (Even-Odd Rule)
 */
export const isPointInPolygon = (
  point: LatLng,
  polygon: LatLng[]
): boolean => {
  let inside = false;
  const { lat: x, lng: y } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
};

/**
 * Mengubah string koordinat JSON database menjadi Array LatLng
 */
export const parsePoints = (pointsJson: string): LatLng[] => {
  try {
    return JSON.parse(pointsJson);
  } catch {
    return [];
  }
};
