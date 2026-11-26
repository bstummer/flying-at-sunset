// An unpicked sample of the world's towers, rendered: the towers nearest the start (none within
// 10 km of one already taken; rising 3.5 km or more), each from two sides, the sun beside and
// behind the viewer and against the light. The tower presets choose sunlit towers in clear sight,
// which flatters the generator: a change to the world's shapes is judged here.
//
//   node tools/survey.js [--label L] [--towers 8] [--seed 3] [--size 640x360]
//   node tools/survey.js --label after --poses before     the cameras and the weather of another
//                                                         survey: two builds or two worlds, view for view
//
// Writes screenshots/survey/<label>/: NN-k.png (tower NN, side k), sheet-K.png (four towers a
// sheet, a row each, both sides) and poses.json. A camera stands 3.2 times the tower's height from
// it (14 km at least), 0.4 of the way up it, clear of every tower by 3.5 km; the flight is frozen.
// Fails as tools/screenshot.js does: on any problem a render reports.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertFreshBuild, launch, pool, ROOT, testRender } from './browser.js';
import { tile } from './image.js';
import { defaultLabel, labelFolder } from './labels.js';
import { decodePng, encodePng } from './png.js';
import { loadWorld } from './world/load.js';

const SURVEYS = join(ROOT, 'screenshots', 'survey');
const SIDES = [-Math.PI / 2 + 1.1, Math.PI / 2 - 0.7];   // from the tower to the camera (0: +X; the sun stands toward −Z)

function options(argv) {
  const o = { label: defaultLabel(), towers: '8', size: '640x360' };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!['label', 'towers', 'seed', 'size', 'poses'].includes(k) || argv[i + 1] === undefined) throw new Error(`usage: node tools/survey.js [--label L] [--towers 8] [--seed N] [--size 640x360] [--poses <label>] (got ${argv[i]})`);
    o[k] = argv[i + 1];
  }
  return o;
}

// the cameras: for each tower two poses (?pose), or none where no clear place is found
async function cameras(seed, count) {
  const W = await loadWorld({ query: seed ? `seed=${seed}` : '' });
  const towers = [];
  for (const t of W.towersNear(0, 0, 90000).filter((t) => t.top - t.y0 > 3500).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))) {
    if (towers.length < count && towers.every((p) => Math.hypot(p.x - t.x, p.z - t.z) > 10000)) towers.push(t);
  }
  const views = [];
  towers.forEach((t, n) => SIDES.forEach((dir, k) => {
    const H = t.top - t.y0;
    let pose = null;
    for (let d = Math.max(3.2 * H, 14000); d < 80000 && !pose; d += 500) {
      const x = t.x + Math.cos(dir) * d, z = t.z + Math.sin(dir) * d, y = Math.max(W.cloudTopAt(x, z) + 900, t.y0 + 0.4 * H);
      if (W.towerDistAt(x, y, z, 5000) < 3500) continue;
      pose = [x.toFixed(0), y.toFixed(0), z.toFixed(0), Math.atan2(t.x - x, -(t.z - z)).toFixed(3), Math.atan2(t.y0 + 0.55 * H - y, d).toFixed(3), 0].join(',');
    }
    views.push({ n, k, pose, tower: { x: Math.round(t.x), z: Math.round(t.z), top: Math.round(t.top), P: Math.round(t.P) } });
  }));
  return { seed: seed ?? null, weather: W.weatherOf().join(','), views };
}

async function main() {
  const o = options(process.argv.slice(2)), out = join(SURVEYS, labelFolder(o.label));
  const [w, h] = o.size.split('x').map(Number);
  assertFreshBuild();
  let plan;
  if (o.poses) {
    const from = join(SURVEYS, labelFolder(o.poses), 'poses.json');
    if (!existsSync(from)) throw new Error(`no survey "${o.poses}" to take the poses from (${from})`);
    plan = JSON.parse(readFileSync(from, 'utf8'));
  } else plan = await cameras(o.seed, Number(o.towers));
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'poses.json'), JSON.stringify(plan, null, 1));
  for (const v of plan.views.filter((v) => v.k === 0)) console.log(`  ${String(v.n).padStart(2, '0')}: (${(v.tower.x / 1000).toFixed(1)}, ${(v.tower.z / 1000).toFixed(1)}) km  top ${(v.tower.top / 1000).toFixed(1)} km  P ${v.tower.P}`);
  const { browser } = await launch('auto', (m) => console.log(`survey: ${m}`));
  let failed = 0;
  try {
    const images = await pool(plan.views, 2, async (v) => {
      if (!v.pose) return null;
      const r = await testRender(browser, { w, h, frames: 12, scale: 0.5, freeze: '', ...(plan.seed ? { seed: plan.seed } : {}), weather: plan.weather, pose: v.pose });
      for (const p of r.problems) { failed++; console.log(`  FAIL ${v.n}-${v.k} [${p.kind}] ${p.text}`); }
      if (!r.png) return null;
      writeFileSync(join(out, `${String(v.n).padStart(2, '0')}-${v.k}.png`), r.png);
      return decodePng(r.png);
    });
    const blank = { width: w, height: h, data: new Uint8Array(w * h * 4).fill(40) };
    for (let s = 0; s * 8 < images.length; s++) writeFileSync(join(out, `sheet-${s}.png`), encodePng(tile(images.slice(s * 8, s * 8 + 8).map((i) => i ?? blank), { columns: 2, gap: 4 })));
  } finally {
    await browser.close();
  }
  console.log(`survey: ${failed ? 'FAILED' : 'OK'} -> ${out}`);
  return failed ? 1 : 0;
}

process.exitCode = await main();
