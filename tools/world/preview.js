// CPU preview of the large shapes (no billows, no volumetric light): sphere-traces the generated
// world the way the GPU bake builds it (the sea's column heights united with the 3D bubbles) with a
// simple sun + sky shading. Seconds instead of minutes, and no GPU needed: for judging shapes,
// sizes and arrangement while tuning the generator.
//
//   node tools/world/preview.js out.png x,y,z,yawDeg,pitchDeg        camera pose (metres, degrees)
//   node tools/world/preview.js out.png --look tx,tz,dist,azDeg[,camY[,pitchDeg]]
//        look at the point (tx, tz) from `dist` metres away, from azimuth azDeg (0 = from -Z, the
//        sun side; 90 = from +X), camera height camY (default 3000)
//   OPT='{"w":640,"h":360,"fov":60,"half":60000,"cell":128,"tmax":120000,"sunEl":20,"sunAz":-60}'
// yaw 0 looks toward -Z (the sun), positive yaw turns right (toward +X).
const W = require('./load.js');
const { writePNG } = require('../lib/png.js');
const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

function build(cx, cz, half, cell) {
  // the sea height field via the real column fill, block by block
  const n = Math.ceil(2 * half / cell / 32) * 32, gi0 = Math.floor((cx - half) / cell), gj0 = Math.floor((cz - half) / cell);
  const lod = cell >= 2048 ? 2 : cell >= 512 ? 1 : 0;
  const hs = new Float32Array(n * n), blk = new Float32Array(32 * 32 * 4);
  for (let bj = 0; bj < n; bj += 32) for (let bi = 0; bi < n; bi += 32) {
    W.fillColumns(cell, lod, gi0 + bi, gj0 + bj, 32, 32, blk);
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) hs[(bj + j) * n + bi + i] = blk[(j * 32 + i) * 4];
  }
  const seaAt = (x, z) => {
    const u = (x / cell - gi0) - 0.5, v = (z / cell - gj0) - 0.5;
    const i = Math.max(0, Math.min(n - 2, Math.floor(u))), j = Math.max(0, Math.min(n - 2, Math.floor(v)));
    const fu = Math.min(Math.max(u - i, 0), 1), fv = Math.min(Math.max(v - j, 0), 1);
    return (hs[j * n + i] * (1 - fu) + hs[j * n + i + 1] * fu) * (1 - fv) + (hs[(j + 1) * n + i] * (1 - fu) + hs[(j + 1) * n + i + 1] * fu) * fv;
  };
  // bubbles binned on a coarse 3D grid
  const bub = [];
  W.forEachSys(cx - half, cz - half, cx + half, cz + half, c => { for (const b of c.bub) bub.push(b); });
  const B = 1000, nb = Math.ceil(2 * half / B), ny = 16, bins = new Array(nb * nb * ny), reach = 1200;
  for (const b of bub) {
    const e = b.br + reach;
    const i0 = Math.max(0, Math.floor((b.x - e - (cx - half)) / B)), i1 = Math.min(nb - 1, Math.floor((b.x + e - (cx - half)) / B));
    const j0 = Math.max(0, Math.floor((b.z - e - (cz - half)) / B)), j1 = Math.min(nb - 1, Math.floor((b.z + e - (cz - half)) / B));
    const y0 = Math.max(0, Math.floor((b.y - e) / B)), y1 = Math.min(ny - 1, Math.floor((b.y + e) / B));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (let y = y0; y <= y1; y++) { const k = (y * nb + j) * nb + i; (bins[k] || (bins[k] = [])).push(b); }
  }
  const sdf = (x, y, z) => {
    const above = y - seaAt(x, z);
    const i = Math.floor((x - (cx - half)) / B), j = Math.floor((z - (cz - half)) / B), yy = Math.floor(y / B);
    let acc = 1200;
    if (i >= 0 && j >= 0 && i < nb && j < nb && yy >= 0 && yy < ny) {
      const L = bins[(yy * nb + j) * nb + i];
      if (L) for (const b of L) acc = smin(acc, W.ellDist(b, x, y, z), b.k);
    }
    return smin(above * 0.9, acc, 700 + (60 - 700) * ss(0, 1800, above));   // as the bake shader
  };
  return { sdf, seaAt, nbub: bub.length };
}

function render(out, pose, opt = {}) {
  const [px, py, pz, yawD, pitD] = pose;
  const w = opt.w || 640, h = opt.h || 360, fov = (opt.fov || 60) * Math.PI / 180, half = opt.half || 60000;
  const t0 = Date.now();
  const world = build(px, pz, half, opt.cell || 128);
  const tb = Date.now() - t0;
  const yaw = yawD * Math.PI / 180, pit = pitD * Math.PI / 180;
  const F = [Math.sin(yaw) * Math.cos(pit), Math.sin(pit), -Math.cos(yaw) * Math.cos(pit)];
  const R = [Math.cos(yaw), 0, Math.sin(yaw)];
  const U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
  const sunEl = (opt.sunEl || 20) * Math.PI / 180, sunAz = (opt.sunAz || -60) * Math.PI / 180;
  const S = [Math.sin(sunAz) * Math.cos(sunEl), Math.sin(sunEl), -Math.cos(sunAz) * Math.cos(sunEl)];
  const img = Buffer.alloc(w * h * 3), th = Math.tan(fov / 2), tmax = opt.tmax || 120000;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = ((i + 0.5) / w * 2 - 1) * th * w / h, v = (1 - (j + 0.5) / h * 2) * th;
    let d = [F[0] + u * R[0] + v * U[0], F[1] + u * R[1] + v * U[1], F[2] + u * R[2] + v * U[2]];
    const dl = Math.hypot(...d); d = d.map(c => c / dl);
    let t = 5, hit = false, x, y, z;
    for (let k = 0; k < 400; k++) {
      x = px + d[0] * t; y = py + d[1] * t; z = pz + d[2] * t;
      if (y > 15000 || y < 0 || t > tmax) break;
      const s = world.sdf(x, y, z);
      if (s < 2 + t * 0.0015) { hit = true; break; }
      t += Math.max(s * 0.85, 4 + t * 0.002);
    }
    const p = (j * w + i) * 3;
    const sky = [150 + 70 * Math.max(0, 1 - Math.max(d[1], 0) * 3), 175 + 50 * Math.max(0, 1 - Math.max(d[1], 0) * 3), 225];
    if (!hit) { img[p] = sky[0]; img[p + 1] = sky[1]; img[p + 2] = sky[2]; continue; }
    const e = 6 + t * 0.002;
    let nx = world.sdf(x + e, y, z) - world.sdf(x - e, y, z), ny = world.sdf(x, y + e, z) - world.sdf(x, y - e, z), nz = world.sdf(x, y, z + e) - world.sdf(x, y, z - e);
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    let sh = 1, st = 30;   // soft shadow toward the sun
    for (let k = 0; k < 48 && st < 40000; k++) {
      const s = world.sdf(x + S[0] * st, y + S[1] * st, z + S[2] * st);
      if (s < 0) { sh = 0; break; }
      sh = Math.min(sh, 8 * s / st);
      st += Math.max(s, 40 + st * 0.03);
    }
    sh = Math.max(sh, 0);
    let ao = 0;            // occlusion along the normal
    for (let k = 1; k <= 4; k++) { const dd = 120 * k; ao += Math.max(0, dd - world.sdf(x + nx * dd, y + ny * dd, z + nz * dd)) / dd; }
    ao = 1 - 0.18 * ao;
    const dif = Math.max(0, nx * S[0] + ny * S[1] + nz * S[2]) * sh, amb = (0.32 + 0.18 * ny) * ao, fog = Math.exp(-t / 70000);
    const c = [255 * (0.95 * dif + amb * 0.75), 240 * (0.9 * dif + amb * 0.8), 215 * (0.8 * dif + amb * 1.0)];
    for (let k = 0; k < 3; k++) img[p + k] = Math.min(255, Math.max(0, c[k] * fog + sky[k] * (1 - fog)));
  }
  writePNG(out, w, h, img);
  return { buildMs: tb, ms: Date.now() - t0, bubbles: world.nbub };
}
module.exports = { render, build };

if (require.main === module) {
  const out = process.argv[2], opt = JSON.parse(process.env.OPT || '{}');
  if (!out || !process.argv[3]) { console.error('usage: preview.js out.png x,y,z,yawDeg,pitchDeg  |  out.png --look tx,tz,dist,azDeg[,camY[,pitchDeg]]'); process.exit(2); }
  let pose;
  if (process.argv[3] === '--look') {
    const [tx, tz, dist, az, camY = 3000, pitch = 8] = process.argv[4].split(',').map(Number);
    const a = az * Math.PI / 180, x = tx + Math.sin(a) * dist, z = tz - Math.cos(a) * dist;
    pose = [x, camY, z, Math.atan2(tx - x, -(tz - z)) * 180 / Math.PI, pitch];
    opt.half = opt.half || Math.max(dist * 1.6, 40000); opt.tmax = opt.tmax || dist * 2.5;
  } else pose = process.argv[3].split(',').map(Number);
  console.log(JSON.stringify(render(out, pose, opt)));
}
