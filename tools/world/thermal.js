// How high single thermals rise: the entraining-parcel model (lift) for bubbles of several sizes
// in synthetic air of several restlessness values, with and without rising through earlier cloud
// ("prot": protected, mixing less). Air built with the same formulas as airAt (keep them in sync
// if airAt changes); AIRMOD='A.cap *= 0.5' tweaks the air for experiments.
//
//   node tools/world/thermal.js
const W = require('./load.js');
const lerp = (a, b, t) => a + (b - a) * t;
function air(I, deep = 1, moist = 0.5, capN = 0.5) {
  const A = W.airAt(0, 0);
  A.I = I; A.zs = 1650; A.ceil = 12500; A.moist = moist;
  // (as in airAt)
  A.cap = 0.2 * Math.exp(-2.6 * I) * lerp(0.7, 1.3, capN); A.dry = lerp(0.09, 0.05, moist) * (1 - 0.4 * I);
  A.bmax = 0.015 + 0.12 * Math.pow(I, 1.3); A.el = A.zs + 600 + (A.ceil - 1500 - A.zs - 600) * Math.pow(I, 0.5) * deep;
  if (process.env.AIRMOD) eval(process.env.AIRMOD);
  return A;
}
for (const I of [0.2, 0.4, 0.7, 1.0]) {
  const A = air(I), rows = [];
  for (const r0 of [600, 1000, 1500, 2200, 2800, 3500]) for (const prot of [false, true]) {
    const C = { A, age: 1e9, depth: 0, rootsOnly: true, paths: [], heads: [], cloudTop: () => prot ? 20000 : -1e9, path: [], top: -1e9, minR: 1e9 };
    const w0 = 1.5 + 4.5 * Math.sqrt(r0 / 1000);   // (launch speed as growCell gives it)
    const hd = W.lift(C, 0, A.zs - 0.6 * r0, 0, r0, w0, 1, 0, 0, 0, 0, W.mulberry32(1), [], null);
    rows.push(`r0 ${String(r0).padStart(4)}${prot ? ' prot' : '     '} -> head at ${(hd.y / 1000).toFixed(1)} km, r ${hd.r.toFixed(0)}, peak w ${hd.w.toFixed(1)} m/s, after ${hd.t.toFixed(0)} s, buoyancy there ${hd.bu.toFixed(3)}`);
  }
  console.log(`restlessness ${I}: inversion cap ${A.cap.toFixed(3)} m/s2, bmax ${A.bmax.toFixed(3)}, equilibrium level ${(A.el / 1000).toFixed(1)} km, dry ${A.dry.toFixed(3)}\n  ` + rows.join('\n  '));
}
