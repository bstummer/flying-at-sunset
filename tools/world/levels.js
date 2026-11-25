// How far the clipmap levels disagree, over boxes. Each level's large shapes are baked on the CPU as
// the GPU bakes them (the column data and the bubbles the world's worker hands over, block by block;
// the sea and the bubbles united as shaders/bake.wgsl unites them, without the largest lobes), read
// as the trace reads them (trilinear), and compared column by column at the finer level's cells: the
// top surface's height, the cloud's thickness above the sea level, the towers' peaks, the domes each
// level takes. The trace dithers between two levels over a handover (7–10 and 40–55 km): where they
// disagree, a lattice; a tower one level lacks pops in there.
//
//   node tools/world/levels.js [x,z ...] [--pairs 01,12] [--half01 m] [--half12 m]
//        boxes centred on (x, z) (metres; default the start, 30 km east, the towers right of the sun)
//   QS="seed=3" node tools/world/levels.js       another world
// Writes per box and pair the map of the top's difference (red: the coarser level higher, blue:
// lower; ±1 km full; the sun, −Z, up), beside the finer level's top (0 to 12 km, white), to
// screenshots/world/levels-<x>,<z>-<pair>.png.
import { loadWorld, outPath, savePng } from './load.js';
const W = await loadWorld();
const LV = W.CLIP_LEVELS, CHUNK = [32, 32, 16], BUB_MAX = 4096;
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const pairs = (opt('--pairs') || '01,12').split(',').map(s => [+s[0], +s[1]]);
const HALF = { '01': +(opt('--half01') || 10000), '12': +(opt('--half12') || 40000) };
const boxes = args.length ? args.map(s => s.split(',').map(Number)) : [[0, 0], [30000, 0], [20000, -22000]];
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const q = (a, p) => { const s = Float64Array.from(a).sort(); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const f0 = v => (+v).toFixed(0), f2 = v => (+v).toFixed(2);

// level l over the box, as the GPU holds it: the column data and the distance volume on the level's
// global cells (whole blocks, with two cells to spare for the interpolation)
function bake(l, x0, z0, x1, z1) {
  const L = LV[l], c = L.cell, ch = CHUNK[l], cv = L.cellV, nz = L.nz;
  const gi0 = Math.floor((x0 / c - 2) / ch) * ch, gj0 = Math.floor((z0 / c - 2) / ch) * ch;
  const ni = Math.ceil((x1 / c + 2) / ch) * ch - gi0, nj = Math.ceil((z1 / c + 2) / ch) * ch - gj0;
  const col = new Float32Array(ni * nj * 4), blk = new Float32Array(ch * ch * 4);
  for (let bj = 0; bj < nj; bj += ch) for (let bi = 0; bi < ni; bi += ch) {
    W.fillColumns(c, L.lod, gi0 + bi, gj0 + bj, ch, ch, blk);
    for (let j = 0; j < ch; j++) for (let i = 0; i < ch; i++) for (let k = 0; k < 4; k++) col[((bj + j) * ni + bi + i) * 4 + k] = blk[(j * ch + i) * 4 + k];
  }
  const hs = (i, j) => col[(Math.min(Math.max(j, 0), nj - 1) * ni + Math.min(Math.max(i, 0), ni - 1)) * 4];
  const vol = new Float32Array(ni * nj * nz), bub = new Float32Array(BUB_MAX * 12);
  let nbMax = 0, nbSum = 0, nBlk = 0;
  const acc = new Float64Array(nz);
  for (let bj = 0; bj < nj; bj += ch) for (let bi = 0; bi < ni; bi += ch) {
    const bx0 = (gi0 + bi) * c, bz0 = (gj0 + bj) * c;
    const nb = W.gatherBubbles(bx0, bz0, bx0 + ch * c, bz0 + ch * c, L.maxD + 300, L.minBR, 0, 0, bub, BUB_MAX, L.lod >= 2);
    nbMax = Math.max(nbMax, nb); nbSum += nb; nBlk++;
    const B = [];
    for (let b = 0; b < nb; b++) { const o = b * 12; B.push({ x: bub[o], y: bub[o + 1], z: bub[o + 2], rh: bub[o + 3], ryU: bub[o + 4], ryD: bub[o + 5], an: bub[o + 6], ca: Math.cos(bub[o + 7]), sa: Math.sin(bub[o + 7]), k: bub[o + 8], br: bub[o + 9] }); }
    for (let j = bj; j < bj + ch; j++) for (let i = bi; i < bi + ch; i++) {
      const px = (gi0 + i + 0.5) * c, pz = (gj0 + j + 0.5) * c, h = hs(i, j);
      const gx = hs(i + 1, j) - hs(i - 1, j), gz = hs(i, j + 1) - hs(i, j - 1);
      const cs = Math.max(1 / Math.sqrt(1 + (gx * gx + gz * gz) / (4 * c * c)), 0.3);
      acc.fill(L.maxD);
      for (const b of B) {
        const dx = px - b.x, dz = pz - b.z;
        if (Math.hypot(dx, dz) - b.br > L.maxD) continue;
        const qx = dx * b.ca + dz * b.sa, qz = -dx * b.sa + dz * b.ca, rx = b.rh * b.an, rz = b.rh / b.an;
        const k0 = Math.max(0, Math.floor((b.y - b.br - L.maxD) / cv)), k1 = Math.min(nz - 1, Math.ceil((b.y + b.br + L.maxD) / cv));
        for (let k = k0; k <= k1; k++) {
          const dy = (k + 0.5) * cv - b.y, ry = dy > 0 ? b.ryU : b.ryD;
          const e0 = Math.hypot(qx / rx, dy / ry, qz / rz), e1 = Math.hypot(qx / (rx * rx), dy / (ry * ry), qz / (rz * rz));
          acc[k] = smin(acc[k], e0 * (e0 - 1) / Math.max(e1, 1e-9), b.k);
        }
      }
      for (let k = 0; k < nz; k++) {
        const above = (k + 0.5) * cv - h;
        const r = smin(above * cs, acc[k], 700 + (60 - 700) * ss(0, 1800, above));
        vol[(k * nj + j) * ni + i] = Math.min(Math.max(r, -L.maxD), L.maxD);
      }
    }
  }
  // the field down a column (x, z), bilinear between the level's columns, at each of its layers
  const column = (x, z, out) => {
    const u = x / c - gi0 - 0.5, v = z / c - gj0 - 0.5, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    for (let k = 0; k < nz; k++) {
      const s = k * nj;
      out[k] = (vol[(s + j) * ni + i] * (1 - fu) + vol[(s + j) * ni + i + 1] * fu) * (1 - fv) + (vol[(s + j + 1) * ni + i] * (1 - fu) + vol[(s + j + 1) * ni + i + 1] * fu) * fv;
    }
    return out;
  };
  // the sea's surface with its heaps (the column data's R), bilinear
  const sea = (x, z) => {
    const u = x / c - gi0 - 0.5, v = z / c - gj0 - 0.5, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    return (hs(i, j) * (1 - fu) + hs(i + 1, j) * fu) * (1 - fv) + (hs(i, j + 1) * (1 - fu) + hs(i + 1, j + 1) * fu) * fv;
  };
  return { L, column, sea, nbMax, nbMean: nbSum / nBlk };
}
// from a column's layers: its top surface (the highest crossing into cloud) and how much of it lies
// in cloud above y0 (the sea level without heaps); linear between the layers, as the sampler is
function profile(L, v, y0) {
  const cv = L.cellV, nz = L.nz, y = k => (k + 0.5) * cv;
  let top = y(0), thick = 0;
  for (let k = nz - 1; k >= 0; k--) if (v[k] < 0) { top = k === nz - 1 ? y(k) : y(k) + cv * v[k] / (v[k] - v[k + 1]); break; }
  for (let k = 0; k < nz - 1; k++) {
    const a = v[k], b = v[k + 1];
    if (a >= 0 && b >= 0) continue;
    let s0 = y(k), s1 = y(k + 1);
    if (a < 0 && b >= 0) s1 = s0 + cv * a / (a - b); else if (a >= 0 && b < 0) s0 = s0 + cv * a / (a - b);
    thick += Math.max(0, s1 - Math.max(s0, y0));
  }
  return { top, thick };
}

for (const [cx, cz] of boxes) {
  console.log(`\n== box at ${f0(cx / 1000)},${f0(cz / 1000)} km`);
  for (const [lf, lc] of pairs) {
    const key = `${lf}${lc}`, half = HALF[key], t0 = Date.now();
    const x0 = cx - half, z0 = cz - half, x1 = cx + half, z1 = cz + half;
    const F = bake(lf, x0, z0, x1, z1), C = bake(lc, x0, z0, x1, z1);
    // compared at the finer level's cells
    const c = F.L.cell, n = Math.floor(2 * half / c), vf = new Float64Array(F.L.nz), vc = new Float64Array(C.L.nz), o = {};
    const topF = new Float32Array(n * n), topC = new Float32Array(n * n), d = [];
    let thF = 0, thC = 0, hpF = 0, hpC = 0;
    const ds = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * c, z = z0 + (j + 0.5) * c, y0 = W.columnFields(x, z, 0, o).hb;
      const a = profile(F.L, F.column(x, z, vf), y0), b = profile(C.L, C.column(x, z, vc), y0);
      topF[j * n + i] = a.top; topC[j * n + i] = b.top; d.push(b.top - a.top);
      thF += a.thick; thC += b.thick;
      const sf = F.sea(x, z), sc = C.sea(x, z);
      ds.push(sc - sf); hpF += Math.max(0, sf - y0); hpC += Math.max(0, sc - y0);
    }
    const ad = d.map(Math.abs), mean = d.reduce((s, v) => s + v, 0) / d.length;
    const km3 = th => th * c * c / 1e9;
    console.log(`L${lf} vs L${lc} over ${f0(2 * half / 1000)} km (${n}x${n} columns of ${c} m; bubbles a block: L${lf} mean ${f0(F.nbMean)} max ${F.nbMax}, L${lc} mean ${f0(C.nbMean)} max ${C.nbMax}; ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    console.log(`  top: L${lc} − L${lf} mean ${f0(mean)} m, |Δ| p50 ${f0(q(ad, 0.5))} p90 ${f0(q(ad, 0.9))} p99 ${f0(q(ad, 0.99))} m; |Δ| > 100 m on ${f0(100 * ad.filter(v => v > 100).length / ad.length)}%, > 300 m ${f0(100 * ad.filter(v => v > 300).length / ad.length)}%`);
    const ads = ds.map(Math.abs);
    console.log(`  the sea with its heaps alone (column data): L${lc} − L${lf} mean ${f0(ds.reduce((s, v) => s + v, 0) / ds.length)} m, |Δ| p90 ${f0(q(ads, 0.9))} m; heaps above the sea level L${lf} ${km3(hpF).toFixed(0)} km³, L${lc} ${km3(hpC).toFixed(0)} km³`);
    console.log(`  top p50: L${lf} ${f0(q(topF, 0.5))} L${lc} ${f0(q(topC, 0.5))} m; p90: ${f0(q(topF, 0.9))} ${f0(q(topC, 0.9))} m; cloud above the sea level: L${lf} ${km3(thF).toFixed(0)} km³, L${lc} ${km3(thC).toFixed(0)} km³ (${f0(100 * (thC / thF - 1))}%)`);
    // the towers: each one's peak in both levels, around its own top bubble
    const ts = W.towersNear(cx, cz, half - 3000).filter(t => t.top - t.y0 > 3000);
    const rows = { small: [], big: [] };
    for (const t of ts) {
      let tb = null;
      W.forEachSys(t.x - 1, t.z - 1, t.x + 1, t.z + 1, s => { for (const b of s.bub) if (b.cell === t.cell && (!tb || b.y + b.ryU > tb.y + tb.ryU)) tb = b; });
      if (!tb || Math.abs(tb.x - cx) > half - c || Math.abs(tb.z - cz) > half - c) continue;
      const R = Math.max(0.7 * tb.rh, 0.75 * c);
      let pf = 0, pc = 0;
      for (let j = Math.max(0, Math.floor((tb.z - R - z0) / c)); j < Math.min(n, Math.ceil((tb.z + R - z0) / c)); j++)
        for (let i = Math.max(0, Math.floor((tb.x - R - x0) / c)); i < Math.min(n, Math.ceil((tb.x + R - x0) / c)); i++) {
          if (Math.hypot(x0 + (i + 0.5) * c - tb.x, z0 + (j + 0.5) * c - tb.z) > R) continue;
          pf = Math.max(pf, topF[j * n + i]); pc = Math.max(pc, topC[j * n + i]);
        }
      rows[t.P < 1000 ? 'small' : 'big'].push({ t, rise: t.top - t.y0, rf: pf - t.y0, rc: pc - t.y0 });
    }
    for (const [k, r] of Object.entries(rows)) {
      if (!r.length) continue;
      // (alone: no taller cloud over its top in the finer level, a bigger tower beside it)
      const alone = r.filter(e => e.rf < 1.2 * e.rise), ratio = alone.map(e => e.rc / Math.max(e.rf, 1)), lost = alone.filter(e => e.rc < 0.5 * e.rf).length;
      console.log(`  towers rising > 3 km, ${k === 'small' ? 'small cells (P < 1000)' : 'P ≥ 1000'}: ${r.length}, ${alone.length} alone (rise p50 ${f0(q(alone.map(e => e.rise), 0.5))} m); their rise in L${lc} against L${lf} ×${f2(q(ratio, 0.5))} (p10 ${f2(q(ratio, 0.1))}), under half in ${lost}`);
    }
    // the domes each level takes over the box
    const cnt = [0, 0];
    W.forEachDome(x0, z0, x1, z1, () => cnt[0]++);
    W.forEachDome(x0, z0, x1, z1, () => cnt[1]++, true);
    console.log(`  domes over the box: ${cnt[0]}, in the cells grown for L2 ${cnt[1]}`);
    // the map of the difference, beside the finer level's top (grey: 0 to 12 km), each at least 480 px
    const z = Math.max(1, Math.ceil(480 / n)), w = 2 * n * z + 8, img = Buffer.alloc(w * n * z * 3, 255);
    for (let j = 0; j < n * z; j++) for (let i = 0; i < n * z; i++) {
      const e = (Math.floor(j / z) * n + Math.floor(i / z)), v = Math.max(-1, Math.min(1, d[e] / 1000)), g = 255 * (1 - Math.abs(v));
      let p = (j * w + i) * 3;
      img[p] = v > 0 ? 255 : g; img[p + 1] = g; img[p + 2] = v < 0 ? 255 : g;
      p = (j * w + n * z + 8 + i) * 3;
      img[p] = img[p + 1] = img[p + 2] = Math.max(0, Math.min(255, topF[e] / 12000 * 255));
    }
    savePng(outPath(null, `levels-${f0(cx)},${f0(cz)}-${key}.png`), w, n * z, img);
  }
}
