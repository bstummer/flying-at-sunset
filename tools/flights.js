// The scripted flights' logs (?log: window.__log, CLAUDE.md §7), recorded and compared.
//
//   node tools/flights.js [--label before] [--gl auto|hardware|swiftshader]
//   node tools/flights.js --compare <labelA> <labelB>
//
// A still is a fifth of a second of flight; these are 15 s each, from the start and from just
// over the cloud tops: the flight model, the input scripts, and the probe that feeds the flight
// (the lift in cloud, read from the GPU's clouds). Recording writes screenshots/flights/<label>.json;
// compare says per flight whether the logs are identical, else where they part and by how much.
// Like captures, the logs repeat exactly on the same backend (the probe makes them depend on it),
// so a change that keeps the flight shows "identical" for every flight. tools/checks.js's flight
// check judges the same flights.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFreshBuild, launch, pool, ROOT, testRender } from './browser.js';
import { defaultLabel, labelFolder } from './labels.js';

const DIR = join(ROOT, 'screenshots', 'flights');
// 300 frames at 1/20 s, small: what matters is the log
const PARAMS = { log: '', w: '48', h: '27', scale: '0.3', dt: '0.05', frames: '300' };
export const FLIGHTS = {
  dive: { script: 'dive' },
  climb: { script: 'climb' },
  turn: { script: 'turn' },
  weave: { script: 'weave' },
  // from just over the cloud tops, diving and held there: into the heaps, kept from sinking deep
  skim: { preset: 'skim', script: 'holddive' },
};
// the columns of a log row (src/core/capture.js)
export const LOG = { t: 0, x: 1, alt: 2, z: 3, speed: 4, bank: 5, gamma: 6, yaw: 7, sea: 8, cloud: 9, roll: 10, fov: 11 };
const AT_ONCE = 2;

// Flies `names` (default all) in `browser`: { name: { log, problems } }.
export async function flyAll(browser, names = Object.keys(FLIGHTS)) {
  const out = {};
  await pool(names, AT_ONCE, async (name) => {
    const r = await testRender(browser, { ...PARAMS, ...FLIGHTS[name] }, { read: () => window.__log ?? [] });
    out[name] = { log: r.read ?? [], problems: r.problems };
  });
  return out;
}

async function record(args) {
  const label = labelFolder(args.label ?? defaultLabel());
  assertFreshBuild();
  const { browser, kind, gl } = await launch(args.gl ?? 'auto', (m) => console.log(`flights: ${m}`));
  try {
    console.log(`flights: WebGPU adapter = ${kind} (${gl}), Chromium ${browser.version()}`);
    const flown = await flyAll(browser);
    let failed = 0;
    for (const [name, { log, problems }] of Object.entries(flown)) {
      console.log(`  ${problems.length ? 'FAIL' : 'ok  '} ${name.padEnd(6)} ${log.length} frames`);
      for (const p of problems) console.log(`         [${p.kind}] ${p.text}`);
      failed += problems.length ? 1 : 0;
    }
    mkdirSync(DIR, { recursive: true });
    const file = join(DIR, `${label}.json`);
    const flights = Object.fromEntries(Object.entries(flown).map(([name, { log }]) => [name, log]));
    writeFileSync(file, `${JSON.stringify({ label, createdAt: new Date().toISOString(), backend: kind, gl, browser: browser.version(), flights })}\n`);
    console.log(`  ${relative(ROOT, file)}`);
    return failed ? 1 : 0;
  } finally {
    await browser.close();
  }
}

function compare([labelA, labelB]) {
  const [a, b] = [labelA, labelB].map((label) => {
    const file = join(DIR, `${labelFolder(label)}.json`);
    if (!existsSync(file)) throw new Error(`no flights recorded as "${label}": ${relative(ROOT, file)} does not exist`);
    return JSON.parse(readFileSync(file, 'utf8'));
  });
  console.log(`flights: compare ${a.label} vs ${b.label}`);
  if (a.gl !== b.gl || a.browser !== b.browser) console.log(`  WARN different backends: "${a.gl}" (Chromium ${a.browser}) vs "${b.gl}" (Chromium ${b.browser})`);
  let differ = 0;
  for (const name of new Set([...Object.keys(a.flights), ...Object.keys(b.flights)])) {
    const line = describeDifference(a.flights[name], b.flights[name]);
    if (line !== 'identical') differ++;
    console.log(`  ${name.padEnd(6)} ${line}`);
  }
  return differ ? 1 : 0;
}

// "identical", or where two logs part and how far the bird's height, speed and bank drift apart.
export function describeDifference(a, b) {
  if (!a || !b) return `recorded on one side only`;
  const n = Math.min(a.length, b.length);
  const first = a.findIndex((row, i) => i >= n || JSON.stringify(row) !== JSON.stringify(b[i]));
  if (first === -1 && a.length === b.length) return 'identical';
  const most = (k) => Math.max(...a.slice(0, n).map((row, i) => Math.abs(row[k] - b[i][k])));
  const at = first === -1 ? n : first;
  return `differ from frame ${at} (t = ${a[Math.min(at, a.length - 1)][LOG.t]} s): up to ${most(LOG.alt).toFixed(1)} m in height, ${most(LOG.speed).toFixed(2)} m/s, ${most(LOG.bank).toFixed(1)}° of bank${a.length !== b.length ? `; ${a.length} vs ${b.length} frames` : ''}`;
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--compare') out.compare = [argv[++i], argv[++i]];
    else if (argv[i] === '--label' || argv[i] === '--gl') out[argv[i].slice(2)] = argv[++i];
    else throw new Error(`unexpected argument "${argv[i]}". Usage: [--label L] [--gl auto|hardware|swiftshader] | --compare A B`);
  }
  if (out.compare && !(out.compare[0] && out.compare[1])) throw new Error('usage: --compare <labelA> <labelB>');
  return out;
}

const invokedPath = process.argv[1] && existsSync(process.argv[1]) ? realpathSync.native(process.argv[1]) : null;
if (invokedPath === realpathSync.native(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    process.exitCode = args.compare ? compare(args.compare) : await record(args);
  } catch (err) {
    console.error(`\nflights: ${err.message}`);
    process.exitCode = 1;
  }
}
