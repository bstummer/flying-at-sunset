// What a tower's bubbles add up to: its cross-sections up its height, and from them how top-heavy
// it is and how far it leans. For tools/world/stats.js and tests/world.test.js (a module of its
// own: a tool must not reach itself through its imports).
//
// towerShape(W, t, bs, { G, N }): t a tower's summary (world/cells.js), bs its own bubbles, united
// as the bake unites them (a smooth min by each bubble's k) and sampled on a grid of G m at N
// heights. Returns { heavy, lean, top, mid }: heavy, the widest section of the upper third over the
// narrowest of the middle third (a mushroom: well over 1); lean, how far the section 85% up lies
// off the one 15% up, per metre of height between them (tan of the lean); top and mid, those two
// areas (km2).

const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

export function towerShape(W, t, bs, { G = 250, N = 18 } = {}) {
  const rise = t.top - t.y0;
  // a cross-section at height y: its area (km2) and its middle
  const section = (y) => {
    const c = bs.filter((b) => y > b.y - b.ryD - b.k && y < b.y + b.ryU + b.k);
    if (!c.length) return { area: 0, x: t.x, z: t.z };
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const b of c) { x0 = Math.min(x0, b.x - b.br); x1 = Math.max(x1, b.x + b.br); z0 = Math.min(z0, b.z - b.br); z1 = Math.max(z1, b.z + b.br); }
    let n = 0, sx = 0, sz = 0;
    for (let z = z0 + G / 2; z < z1; z += G) for (let x = x0 + G / 2; x < x1; x += G) {
      let d = 2000;
      for (const b of c) if (Math.abs(b.x - x) < b.br + 2000 && Math.abs(b.z - z) < b.br + 2000) d = smin(d, W.ellDist(b, x, y, z), b.k);
      if (d < 0) { n++; sx += x; sz += z; }
    }
    return { area: n * G * G / 1e6, x: n ? sx / n : t.x, z: n ? sz / n : t.z };
  };
  const sec = Array.from({ length: N }, (_, i) => section(t.y0 + rise * (i + 0.5) / N).area);
  const top = Math.max(...sec.slice(2 * N / 3)), mid = Math.min(...sec.slice(N / 3, 2 * N / 3));
  const lo = section(t.y0 + 0.15 * rise), hi = section(t.y0 + 0.85 * rise);
  return { heavy: top / Math.max(mid, G * G / 1e6), lean: hi.area && lo.area ? Math.hypot(hi.x - lo.x, hi.z - lo.z) / (0.7 * rise) : 0, top, mid };
}
