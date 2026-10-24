// The shapes cloud is made of: domes on the sea, bubbles in the air

import { smoothstep } from '../math.js';

// ---- domes: what lies on the sea (2D: they raise its surface)
// a dome's profile: a round cap (prof < 1) or a soft-shouldered hill (prof > 1), always with a
// smooth foot (no cliffs where it reaches beyond what it grew from); tabulated over u^2
const PROF = new Map();
function profileTable(prof) {
  const k = Math.round(prof * 20) / 20;
  let t = PROF.get(k);
  if (!t) {
    t = new Float32Array(258);
    for (let i = 0; i <= 256; i++) { const u2 = i / 256; t[i] = Math.pow(1 - u2, k) * (u2 > 0.49 ? smoothstep(1, 0.7, Math.sqrt(u2)) : 1); }
    PROF.set(k, t);
  }
  return t;
}
export const domeProfile = (t, u2) => { const f = u2 * 256, i = f | 0; return t[i] + (t[i + 1] - t[i]) * (f - i); };
export function makeDome(x, z, r, h, base, prof, ex, ang, sea, root) {
  return { x, z, r, h, base, top: base + h, prof: profileTable(prof), ex, ang, ca: Math.cos(ang), sa: Math.sin(ang), reach: r * ex, sea, root };
}
export function domeHeightAt(d, x, z) {   // its surface above (x, z), or -1e9 outside
  const dx = x - d.x, dz = z - d.z;
  const a = (dx * d.ca + dz * d.sa) / d.ex, b = -dx * d.sa + dz * d.ca;
  const u2 = (a * a + b * b) / (d.r * d.r);
  return u2 >= 1 ? -1e9 : d.base + d.h * domeProfile(d.prof, u2);
}

// ---- bubbles: ellipsoids, rounder or flatter above than below (3D)
// approximate distance from (x, y, z) to bubble b (negative inside)
export function ellDist(b, x, y, z) {
  const dx = x - b.x, dz = z - b.z, ca = Math.cos(b.ang), sa = Math.sin(b.ang);
  const qx = dx * ca + dz * sa, qz = -dx * sa + dz * ca, qy = y - b.y;
  const rx = b.rh * b.an, rz = b.rh / b.an, ry = qy > 0 ? b.ryU : b.ryD;
  const k0 = Math.hypot(qx / rx, qy / ry, qz / rz), k1 = Math.hypot(qx / (rx * rx), qy / (ry * ry), qz / (rz * rz));
  return k0 * (k0 - 1) / Math.max(k1, 1e-9);
}

// smooth maximum (heaps merging into what they stand on)
export const smaxJS = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0); return Math.max(a, b) + h * h / (4 * k); };
