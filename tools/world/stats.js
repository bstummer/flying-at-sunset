// Numbers about the generated world around a point: the sea, the towers, the bubble load.
//
//   node tools/world/stats.js [cx cz] [R]      (metres; default the start, R = 150 km)
//   QS="seed=3" node tools/world/stats.js      another world
//
// Towers are the convective cells that grew 3D bubbles; `rise` is top minus sea level, `wide` how
// far (radius) their top 2 km reach from the cell centre.
const W = require('./load.js');
const cx = +(process.argv[2] || 0), cz = +(process.argv[3] || 0), R = +(process.argv[4] || 150000);
const t0 = Date.now();
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const f0 = v => (+v).toFixed(0), f2 = v => (+v).toFixed(2);

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
// towers
const ts = W.towersNear(cx, cz, R);
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
  console.log('  nearest with tops above 5 km (bearing 0 = toward the sun, + = right):');
  for (const t of ts.filter(t => t.top > 5000).sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)).slice(0, 10)) {
    const c = t.cell;
    console.log(`    ${f0(Math.hypot(t.x - cx, t.z - cz) / 100) / 10} km bearing ${f2(Math.atan2(t.x - cx, -(t.z - cz)))}  P ${f0(t.P)}  top ${(t.top / 1000).toFixed(1)} km  wide ${(t.wide / 1000).toFixed(1)} km  age/life ${f2(c.age / c.life)}  restless ${f2(c.A.I)}  gen ${t.gen}`);
  }
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
