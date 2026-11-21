// The light reference (tools/light/): its Monte Carlo against what is known in closed form, so its
// numbers can judge the trace's light; and the trace's light (its model, in step with the shaders)
// against those numbers

import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, SUN, ball, profile, radiance, slab, viewDir } from '../tools/light/mc.js';
import { traceRadiance } from '../tools/light/model.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Single scattering off a deep slab: p(θ) μ0 / (μ0 + μ), μ0 and μ the cosines of the sun and the view
// to the surface's normal, for a top lit at 5°, a slope and a face, from several sides
test('single scattering matches the closed form', () => {
  for (const [n, az, dep] of [[[0, 1, 0], 180, 30], [[0, 1, 0], 0, 20], [[0, 0.7, -0.7], 90, 25], [SUN, 160, 10]]) {
    const s = slab(n, 1e6), v = viewDir(az, dep);
    const mu0 = dot(s.n, SUN), mu = -dot(s.n, v);
    for (const ph of [PHASES.cloud, PHASES.trace]) {
      const want = ph.eval(dot(v, SUN)) * mu0 / (mu0 + mu);
      const { L, err } = radiance(s, v, { phase: ph, orders: 1, paths: 40000 });
      assert.ok(Math.abs(L - want) < 4 * err + 0.01 * want, `n ${s.n.map(x => x.toFixed(2))}, view ${az}/${dep}: ${L.toFixed(5)} ± ${err.toFixed(5)}, want ${want.toFixed(5)}`);
    }
  }
});

// No absorption: a deep slab sends back all the light that enters it, so under the sun its emergent
// radiance, summed over directions (∫ L μ dΩ), is the irradiance on it, μ0
test('a deep slab without absorption sends all the light back', () => {
  const s = slab([0, 0.6, -0.8], 3000), mu0 = dot(s.n, SUN);
  let flux = 0;
  const N = 8;
  for (let i = 0; i < N; i++) {
    // the outgoing hemisphere in bands of equal μ² (∫ L μ dΩ = π ∫ L d(μ²)), each at four headings
    const mu = Math.sqrt((i + 0.5) / N), el = Math.asin(mu);
    for (const phi of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
      // a direction toward the viewer at angle el above the surface, then the view looks back along it
      const t1 = [1, 0, 0], t2 = [0, 0.8, 0.6];
      const out = [0, 1, 2].map(k => s.n[k] * mu + Math.cos(el) * (Math.cos(phi) * t1[k] + Math.sin(phi) * t2[k]));
      flux += Math.PI / N / 4 * radiance(s, out.map(x => -x), { paths: 1000, seed: 7 + i }).L;
    }
  }
  assert.ok(Math.abs(flux - mu0) < 0.12 * mu0, `flux back ${flux.toFixed(3)}, in ${mu0.toFixed(3)}`);
});

// The medium thins toward the surface (constants.js): the sun's optical depth through it, in closed
// form, against the profile summed along the ray, from points near the surface and deep, every way
test('the optical depth along a ray is the profile summed', () => {
  const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  for (const s of [slab([0, 1, 0], 800), slab([0.3, 1, -0.2], 60), ball([0, 0, 1], 750), ball(SUN, 100)]) {
    for (const [p, w] of [[[0, -3, 0], SUN], [[0, -25, -10], nrm([0.2, -0.3, 1])], [[5, -50, 3], nrm([1, 0.1, 0.05])], [[0, -1, 0], nrm([0, -1, 0.01])]]) {
      if (s.sdf(p) >= 0) continue;
      const l = s.exit(...p, ...w), N = 20000;
      let sum = 0;
      for (let i = 0; i < N; i++) { const t = (i + 0.5) / N * l; sum += profile(-s.sdf([p[0] + w[0] * t, p[1] + w[1] * t, p[2] + w[2] * t])) * l / N; }
      const od = s.od(...p, ...w, l);
      assert.ok(Math.abs(od - sum) < 1e-3 * sum + 1e-3, `from ${p} along ${w.map(x => x.toFixed(2))}: ${od.toFixed(4)}, summed ${sum.toFixed(4)}`);
    }
  }
});

test('a ball\'s exit and distance agree with its surface', () => {
  const b = ball([0, 0, 1], 500);
  assert.ok(Math.abs(b.sdf([0, 0, 0])) < 1e-9);
  assert.ok(Math.abs(b.exit(0, 0, -1e-9, 0, 0, -1) - 1000) < 1e-6);
  assert.ok(b.sdf([0, 0, -500]) < -499);
});

// The trace's light (tools/light/model.js, in step with the shaders) against the Monte Carlo: within
// a factor two on a top seen from above and with the sun behind, a face square to the sun, a slope
// and the shaded side of a thick wall (the old light gave tops 4-9 times theirs and shade nothing)
test('the trace\'s light stays within a factor two of the reference', () => {
  const slope = a => { const r = a * Math.PI / 180; return [0, Math.cos(r), -Math.sin(r)]; };
  for (const [what, s, v, paths] of [['top from above', slab([0, 1, 0], 800), viewDir(0, 90), 6000], ['top, sun behind', slab([0, 1, 0], 800), viewDir(180, 30), 6000],
    ['face', slab(SUN, 2000), viewDir(180, 0), 3000], ['slope 45°', slab(slope(45), 2000), viewDir(180, 20), 3000], ['shade of 1.5 km', slab([0, 0, 1], 1500), viewDir(0, 0), 1500]]) {
    const ref = radiance(s, v, { paths, seed: 3 }).L, trace = traceRadiance(s, v);
    assert.ok(trace > ref / 2 && trace < ref * 2, `${what}: the trace ${trace.toFixed(4)}, the reference ${ref.toFixed(4)}`);
  }
});

// The outline's ramp follows the trace's pixel; the light must not (it ate the glare off the tops
// toward the sun, and changed with the resolution), also where the ramp is wider than the medium's
// profile (far clouds)
test('the trace\'s light does not change with the outline\'s width', () => {
  for (const [s, v] of [[slab([0, 1, 0], 800), viewDir(0, 10)], [slab(SUN, 2000), viewDir(180, 0)], [slab([0, 1, 0], 800), viewDir(180, 30)]]) {
    const [a, ...rest] = [1, 4, 16, 64].map(edgeW => traceRadiance(s, v, { edgeW }));
    assert.ok(rest.every(b => Math.abs(b / a - 1) < 0.01), [a, ...rest].map(x => x.toFixed(4)).join(' '));
  }
});
