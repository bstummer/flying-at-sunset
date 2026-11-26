// Numbers about the generated world around a point: the start (the spawn draw's first tower), the
// sea, the towers (how high, how wide, how flat their tops, mushrooms and knobs), the bubble load.
//
//   node tools/world/stats.js [cx cz] [R]      (metres; default the start, R = 150 km)
//   QS="seed=3" node tools/world/stats.js      another world
//
// Towers are the convective cells that grew 3D bubbles; `rise` is top minus sea level, `wide` how
// far (radius) their top 2 km reach from the cell centre. Mushrooms: a tower's widest cross-section
// in its upper third against its narrowest in its middle third (its own bubbles, united as the bake
// unites them). Knobs: small bubbles perched on bigger ones, a ball on a ball.
import { loadWorld } from './load.js';
const W = await loadWorld();
const cx = +(process.argv[2] || 0), cz = +(process.argv[3] || 0), R = +(process.argv[4] || 150000);
const t0 = Date.now();
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const f0 = v => (+v).toFixed(0), f2 = v => (+v).toFixed(2);

// the start: what the spawn draw found (world/cells.js)
{
  const S = W.SPAWN;
  if (S.weather) console.log(`the start (the spawn draw, ${S.tries} tries${S.ok ? '' : ', none held: the best'}): the first tower ${(S.near / 1000).toFixed(1)} km ahead at the bird's height, its outline at bearings ${S.a0.toFixed(2)}..${S.a1.toFixed(2)}, top ${(S.top / 1000).toFixed(1)} km, P ${f0(S.P)}; strong cells in ${S.quarters} of the 6 quarters and ranges but the sun's | ?weather=${S.weather.join(',')}`);
  else console.log(`the start: ${W.weatherOf().join(',')} (?weather)`);
}
// the sea near the point
{
  const o = {}, amp = [], rest = [], fine = [];
  for (let j = 0; j < 60; j++) for (let i = 0; i < 60; i++) { W.columnFields(cx - 30000 + i * 1000, cz - 30000 + j * 1000, 0, o); amp.push(o.amp); rest.push(o.rest); fine.push(o.fine); }
  console.log(`sea (60 km box): restlessness p10/50/90 ${f2(q(rest, .1))} ${f2(q(rest, .5))} ${f2(q(rest, .9))} | billow strength ${f2(q(amp, .1))} ${f2(q(amp, .5))} ${f2(q(amp, .9))} | fine ${f2(q(fine, .5))}`);
  let nd = 0, hs = 0, big = 0;
  W.forEachDome(cx - 15000, cz - 15000, cx + 15000, cz + 15000, d => { nd++; hs += d.h; if (d.r > 1500) big++; });
  console.log(`domes on the sea (30 km box): ${nd}, mean height ${f0(hs / Math.max(nd, 1))} m, ${big} wider than 1.5 km`);
  let calm = 0, n = 0;
  for (let j = 0; j < 80; j++) for (let i = 0; i < 80; i++) { n++; if (W.restAt(cx - R + (i + 0.5) * R / 40, cz - R + (j + 0.5) * R / 40) < 0.1) calm++; }
  console.log(`calm air (restlessness < 0.1) over the ${f0(2 * R / 1000)} km box: ${(calm / n * 100).toFixed(0)}%`);
}
// towers, and the bubbles of each
const ts = W.towersNear(cx, cz, R);
const own = new Map();
W.forEachSys(cx - R, cz - R, cx + R, cz + R, c => { for (const b of c.bub) { const l = own.get(b.cell); if (l) l.push(b); else own.set(b.cell, [b]); } });
{
  const area = Math.PI * R * R / 1e6;
  console.log(`\ntowers within ${f0(R / 1000)} km: ${ts.length} (${(ts.length / area * 1e4).toFixed(1)} per 10^4 km2)`);
  for (const [a, b] of [[0, 1000], [1000, 2000], [2000, 3000], [3000, 5000], [5000, 9000]]) {
    const s = ts.filter(t => t.P >= a && t.P < b);
    if (!s.length) continue;
    const rise = s.map(t => t.top - t.y0), wide = s.map(t => t.wide);
    console.log(`  P ${String(a).padStart(4)}-${String(b).padEnd(4)} n ${String(s.length).padStart(4)}  rise p50 ${f0(q(rise, .5))} p90 ${f0(q(rise, .9))} max ${f0(q(rise, 1))}  | wide p50 ${f0(q(wide, .5))} p90 ${f0(q(wide, .9))}`);
  }
  console.log('  tops above', [6000, 9000, 11000, 12000].map(h => `${h / 1000} km: ${ts.filter(t => t.top > h).length}`).join(', '));
  for (const r of [20000, 40000, 80000]) {
    const s = ts.filter(t => Math.hypot(t.x - cx, t.z - cz) < r);
    console.log(`  within ${r / 1000} km: ${s.length} towers, tops > 6 km ${s.filter(t => t.top > 6000).length}, > 9 km ${s.filter(t => t.top > 9000).length}, > 11 km ${s.filter(t => t.top > 11000).length}`);
  }
  // how flat the tops are: the highest bubble's height over its radius, and where it stopped (at the
  // ceiling, or how far past the level el where the air stops buoying it up)
  const tops = [];
  for (const t of ts) {
    let b = null;
    for (const o of own.get(t.cell) || []) if (!b || o.y + o.ryU > b.y + b.ryU) b = o;
    if (b) tops.push({ f: b.ryU / b.rh, ceil: b.y + b.ryU > t.cell.A.ceil - 300, over: b.y - t.cell.A.el, rise: t.top - t.y0 });
  }
  const flat = s => `${(s.filter(o => o.f < 0.45).length / Math.max(s.length, 1) * 100).toFixed(0)}% of ${s.length}`;
  console.log(`  tops flatter than 0.45 (the top bubble's ryU/rh): ${flat(tops)} | at the ceiling ${flat(tops.filter(o => o.ceil))}, past el by over 1 km ${flat(tops.filter(o => !o.ceil && o.over > 1000))}, under 1 km ${flat(tops.filter(o => !o.ceil && o.over > 0 && o.over <= 1000))}, below el ${flat(tops.filter(o => !o.ceil && o.over <= 0))} | rising over 6 km ${flat(tops.filter(o => o.rise > 6000))}`);
  console.log('  nearest with tops above 5 km (bearing 0 = toward the sun, + = right):');
  for (const t of ts.filter(t => t.top > 5000).sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)).slice(0, 10)) {
    const c = t.cell;
    console.log(`    ${f0(Math.hypot(t.x - cx, t.z - cz) / 100) / 10} km bearing ${f2(Math.atan2(t.x - cx, -(t.z - cz)))}  P ${f0(t.P)}  top ${(t.top / 1000).toFixed(1)} km  wide ${(t.wide / 1000).toFixed(1)} km  age/life ${f2(c.age / c.life)}  restless ${f2(c.A.I)}  gen ${t.gen}`);
  }
}
// mushrooms and knobs, on the towers rising over 5 km
{
  const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  // (the union of bubbles bs at a point, as the bake's smooth min; 2000 m out at most)
  const union = (bs, x, y, z) => { let d = 2000; for (const b of bs) if (Math.abs(b.x - x) < b.br + 2000 && Math.abs(b.z - z) < b.br + 2000 && Math.abs(b.y - y) < b.br + 2000) d = smin(d, W.ellDist(b, x, y, z), b.k); return d; };
  const G = 250, N = 18, rows = [];
  for (const t of ts) {
    const rise = t.top - t.y0, bs = own.get(t.cell);
    if (rise < 5000 || !bs) continue;
    // a cross-section's area (km2): the grid points inside the union, over the box of the bubbles near that height
    const area = y => {
      const c = bs.filter(b => y > b.y - b.ryD - b.k && y < b.y + b.ryU + b.k);
      if (!c.length) return 0;
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const b of c) { x0 = Math.min(x0, b.x - b.br); x1 = Math.max(x1, b.x + b.br); z0 = Math.min(z0, b.z - b.br); z1 = Math.max(z1, b.z + b.br); }
      let n = 0;
      for (let z = z0 + G / 2; z < z1; z += G) for (let x = x0 + G / 2; x < x1; x += G) if (union(c, x, y, z) < 0) n++;
      return n * G * G / 1e6;
    };
    const sec = Array.from({ length: N }, (_, i) => area(t.y0 + rise * (i + 0.5) / N));
    const top = Math.max(...sec.slice(2 * N / 3)), mid = Math.min(...sec.slice(N / 3, 2 * N / 3));
    // knobs: a bubble whose top stands out of the union of the bubbles over 2.5 times its size by more
    // than half its height, while its centre lies within its size of their surface (it sits on them)
    let knobs = 0, knobsTop = 0;
    for (const b of bs) {
      const big = bs.filter(o => o.rh > 2.5 * b.rh && Math.abs(o.x - b.x) < o.br + b.br && Math.abs(o.z - b.z) < o.br + b.br && Math.abs(o.y - b.y) < o.br + b.br);
      if (!big.length || union(big, b.x, b.y, b.z) > b.rh || union(big, b.x, b.y + b.ryU, b.z) < 0.5 * b.ryU) continue;
      knobs++;
      if (b.y + b.ryU > t.top - 2500) knobsTop++;
    }
    rows.push({ t, rise, ratio: top / Math.max(mid, G * G / 1e6), top, mid, knobs, knobsTop, n: bs.length });
  }
  const r = rows.map(o => o.ratio), k = rows.map(o => o.knobs), kt = rows.map(o => o.knobsTop);
  console.log(`\nmushrooms, ${rows.length} towers rising over 5 km (the widest section of the upper third / the narrowest of the middle third):`);
  console.log(`  ratio p50 ${f2(q(r, .5))} p90 ${f2(q(r, .9))} max ${f2(q(r, 1))} | over 1.6x ${r.filter(v => v > 1.6).length}, over 2x ${r.filter(v => v > 2).length}, over 4x ${r.filter(v => v > 4).length}`);
  for (const o of rows.sort((a, b) => b.ratio - a.ratio).slice(0, 5)) console.log(`    ${f2(o.ratio)}x  (${(o.t.x / 1000).toFixed(1)}, ${(o.t.z / 1000).toFixed(1)}) km  rise ${(o.rise / 1000).toFixed(1)} km  top ${o.top.toFixed(1)} km2 over ${o.mid.toFixed(1)} km2  P ${f0(o.t.P)}`);
  console.log(`  knobs (a bubble perched on ones 2.5x its size, over half of it standing out): per tower p50 ${q(k, .5)} p90 ${q(k, .9)} max ${q(k, 1)}, ${k.reduce((a, b) => a + b, 0)} in all; in the top 2.5 km p50 ${q(kt, .5)} p90 ${q(kt, .9)}, towers with any there ${kt.filter(v => v > 0).length} of ${rows.length}`);
}
// bubble load (what the bakes have to loop over)
{
  const cls = [[0, 1000], [1000, 2000], [2000, 3000], [3000, 9000]], st = cls.map(() => ({ cells: 0, bub: 0 }));
  let n = 0;
  W.forEachSys(cx - 60000, cz - 60000, cx + 60000, cz + 60000, c => {
    const per = new Map();
    for (const b of c.bub) { n++; per.set(b.cell, (per.get(b.cell) || 0) + 1); }
    for (const [cell, k] of per) { const i = cls.findIndex(([a, b]) => cell.P >= a && cell.P < b); st[i].cells++; st[i].bub += k; }
  });
  console.log(`\nbubbles in the 120 km box: ${n}  ` + cls.map(([, b], i) => `P<${b}: ${st[i].cells} cells x ${f0(st[i].bub / Math.max(1, st[i].cells))}`).join(' | '));
}
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
