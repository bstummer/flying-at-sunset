// What a change costs the GPU: the per-pass GPU times (?cpuprof) of the working tree's build against
// another commit's, interleaved A B B A A B and a view at a time (CLAUDE.md §9: the NVIDIA laptop's
// clocks drift between runs, the same bake 2× apart, separate captures ±25%; and two pages side by
// side share the GPU, each pass's time taking in the other's work).
//
//   node tools/cost.js [--against HEAD] [--views start,sun,side,tower,high2,close] [--frames 200]
//                      [--rounds 3] [--size 960x540] [--scale 0.5] [--seed 7] [--label L]
//                      [--gl auto|hardware|swiftshader]
//
// A: the commit --against names (after committing a change: --against HEAD~1), built in a git
// worktree of its own in the system's temp folder (its node_modules a link to this one's); B: the
// working tree, built first and copied aside (a build while it runs changes nothing). Both run
// with these tools, each rendered once first and not counted (the first render warms up the
// browser and the GPU's clocks). Prints per view and pass the totals over the run (ms), the
// change, and how far each side's runs spread (±: half their range, of their mean; a change within
// it is noise; `world` and `sunmap` are mostly the first frame's bakes, and spread widely), and
// keeps every run in screenshots/cost/<label>.json. The worktree goes at the end, or on Ctrl+C, its
// link first (removing it whole would reach into node_modules); one a run stopped hard left
// behind, the next run removes.
// About 9 s a view and run on that laptop: 6 views, 3 rounds, ~6 minutes with the builds. The same
// build against itself reads the trace 0 to +2% (its runs within 3%): a change past ~3% is real;
// `world` and `sunmap` −15 to +130%, nothing to go by. Two runs of the same comparison differ by
// up to 4% a view (leg 8's trace: +2–11%, then +6–11% before each side's first render was set
// aside; +8–12% two pages at a time). SwiftShader's numbers are only relative (CLAUDE.md §3).
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFreshBuild, BUILT_HTML, launch, ROOT, testRender } from './browser.js';
import { defaultLabel, gitDescribe, labelFolder } from './labels.js';
import { findView } from './views.js';

// (rounds: at least two, A B B A: one run a side has no spread, and the laptop's drift alone made
// the same build 6-7% slower on its second run)
const DEFAULTS = { against: 'HEAD', views: 'start,sun,side,tower,high2,close', frames: '200', rounds: '3', size: '960x540', scale: '0.5' };
const OPTIONS = new Set(['against', 'views', 'frames', 'rounds', 'size', 'scale', 'seed', 'label', 'gl']);
const SHOWN_MS = 0.5;   // passes under this over a whole run on both sides are left out of the table

// --name value or --name=value, each of OPTIONS; checked and with the defaults filled in
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) throw new Error(`unexpected argument "${argv[i]}"`);
    if (!OPTIONS.has(m[1])) throw new Error(`unknown option --${m[1]}`);
    const value = m[2] ?? argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${m[1]} needs a value`);
    out[m[1]] = value;
  }
  const args = { ...DEFAULTS, ...out };
  const int = (k, lo, hi) => { const n = Number(args[k]); if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`--${k} must be a whole number from ${lo} to ${hi}`); return n; };
  const size = /^(\d+)x(\d+)$/.exec(args.size);
  if (!size) throw new Error('--size must be WxH, e.g. 960x540');
  const scale = Number(args.scale);
  if (!(scale > 0 && scale <= 1)) throw new Error('--scale must be in (0, 1]');
  return {
    against: args.against, views: args.views.split(',').map((v) => findView(v.trim())), frames: int('frames', 1, 100000), rounds: int('rounds', 2, 10),
    width: Number(size[1]), height: Number(size[2]), scale, seed: args.seed ?? null, label: args.label ?? null, gl: args.gl ?? 'auto',
  };
}

// A B, B A, A B, ...: each side as often first as second, so a drift of the clocks falls on both
export const runOrder = (rounds) => Array.from({ length: rounds }, (_, k) => (k % 2 ? ['B', 'A'] : ['A', 'B'])).flat();

// runs: [{ side: 'A' | 'B', gpu: { view: { pass: ms over the run } } }]. Per view and pass: each
// side's totals, their means, B against A, and each side's spread (half its range, of its mean).
export function summarize(runs) {
  const rows = [];
  const views = [...new Set(runs.flatMap((r) => Object.keys(r.gpu)))];
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const spread = (xs) => (xs.length > 1 && mean(xs) > 0 ? (Math.max(...xs) - Math.min(...xs)) / 2 / mean(xs) : 0);
  for (const view of views) {
    const passes = [...new Set(runs.flatMap((r) => Object.keys(r.gpu[view] ?? {})))];
    for (const pass of passes) {
      const of = (side) => runs.filter((r) => r.side === side && r.gpu[view]?.[pass] != null).map((r) => r.gpu[view][pass]);
      const a = of('A'), b = of('B');
      if (!a.length || !b.length) continue;
      rows.push({ view, pass, a, b, meanA: mean(a), meanB: mean(b), change: mean(b) / mean(a) - 1, spreadA: spread(a), spreadB: spread(b) });
    }
  }
  return rows;
}

const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%`;
export function describeRows(rows) {
  const lines = [];
  for (const view of [...new Set(rows.map((r) => r.view))]) {
    const cells = rows.filter((r) => r.view === view && Math.max(r.meanA, r.meanB) >= SHOWN_MS)
      .map((r) => `${r.pass} ${r.meanA.toFixed(1)} → ${r.meanB.toFixed(1)} ${pct(r.change)} (±${(r.spreadA * 100).toFixed(0)}/${(r.spreadB * 100).toFixed(0)}%)`);
    lines.push(`  ${view.padEnd(9)}${cells.join('  ')}`);
  }
  const trace = rows.filter((r) => r.pass === 'trace');
  if (trace.length) lines.push(`  the trace: ${trace.map((r) => `${r.view} ${pct(r.change)}`).join(', ')}`);
  return lines;
}

// ---------------------------------------------------------------- the two builds

const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
function build(cwd) {
  // (one command line: npm is a script on Windows, which only a shell runs)
  const r = spawnSync('npm run build', { cwd, shell: true, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`the build in ${cwd} failed:\n${r.stdout}${r.stderr}`);
}
const TREE = /[\\/]fas-cost-[^\\/]+[\\/]tree$/;
function addWorktree(rev) {
  const parent = mkdtempSync(join(tmpdir(), 'fas-cost-')), dir = join(parent, 'tree');
  try { git('worktree', 'add', '--detach', dir, rev); } catch (err) { rmSync(parent, { recursive: true, force: true }); throw err; }
  // (a junction on Windows: no rights needed; elsewhere a link to the folder)
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'junction');
  return { parent, dir };
}
// The link to node_modules first, alone: a worktree removed whole would remove what it links to.
// Again and again alike (on Ctrl+C, then at the end).
function removeWorktree({ parent, dir }) {
  const link = join(dir, 'node_modules');
  try { if (lstatSync(link).isSymbolicLink()) unlinkSync(link); } catch { /* not there */ }
  if (existsSync(link)) {
    console.error(`cost: ${link} is still there. Remove that link alone (never what it links to), then: git worktree remove --force ${dir}`);
    return;
  }
  try {
    if (existsSync(dir)) git('worktree', 'remove', '--force', dir);
  } catch (err) {
    console.error(`cost: couldn't remove ${dir} (${err.message.split('\n')[0]}): remove it by hand, then git worktree prune`);
    return;
  }
  rmSync(parent, { recursive: true, force: true });
}
// the worktrees of git's list (--porcelain) that a run of this tool made
export const ownWorktrees = (list) => [...list.matchAll(/^worktree (.+)$/gm)].map((m) => m[1].trim()).filter((d) => TREE.test(d));
// those an earlier run left, stopped hard (a killed process: no handler runs)
function removeLeftovers() {
  for (const dir of ownWorktrees(git('worktree', 'list', '--porcelain'))) {
    console.log(`cost: removing a worktree an earlier run left: ${dir}`);
    removeWorktree({ parent: dirname(dir), dir });
  }
  git('worktree', 'prune');
}

// ---------------------------------------------------------------- main

async function run(args) {
  let hashA;
  try { hashA = git('rev-parse', '--short', `${args.against}^{commit}`); } catch { throw new Error(`--against: no commit "${args.against}"`); }
  const hashB = gitDescribe();
  const label = labelFolder(args.label ?? `${hashA}_vs_${defaultLabel()}`);
  console.log(`cost: A ${hashA} (${args.against}) against B ${hashB} (the working tree): ${args.views.length} view(s), ${args.frames} frames, ${runOrder(args.rounds).join(' ')}`);
  removeLeftovers();
  console.log('cost: building B');
  build(ROOT);
  assertFreshBuild();
  console.log(`cost: building A in a worktree of ${hashA}`);
  const tree = addWorktree(hashA);
  const stop = () => { console.error('\ncost: stopped'); removeWorktree(tree); process.exit(130); };
  process.once('SIGINT', stop);
  let browser;
  try {
    const html = { A: join(tree.dir, 'dist', 'index.html'), B: join(tree.parent, 'B.html') };
    copyFileSync(BUILT_HTML, html.B);
    build(tree.dir);
    const launched = await launch(args.gl, (m) => console.log(`cost: ${m}`));
    browser = launched.browser;
    console.log(`cost: WebGPU adapter = ${launched.kind} (${launched.gl}), Chromium ${browser.version()}`);
    const render = async (side, view, frames) => {
      const params = { w: String(args.width), h: String(args.height), frames: String(frames), scale: String(args.scale), ...view.params, ...(args.seed ? { seed: args.seed } : {}), cpuprof: '' };
      const r = await testRender(browser, params, { html: html[side] });
      if (r.problems.length || !r.gpu) throw new Error(`${side}, ${view.name}: ${r.problems.map((p) => `${p.kind}: ${p.text}`).join('; ') || 'no GPU times (no timestamp queries on this adapter?)'}`);
      return r.gpu;
    };
    for (const side of ['A', 'B']) await render(side, args.views[0], 60);
    const runs = [];
    for (const [k, side] of runOrder(args.rounds).entries()) {
      const gpu = {};
      for (const view of args.views) gpu[view.name] = await render(side, view, args.frames);
      runs.push({ side, gpu });
      console.log(`  run ${k + 1}: ${side}  ${args.views.map((v) => `${v.name} ${gpu[v.name].trace ?? '-'}`).join(' · ')} (the trace, ms)`);
    }
    const rows = summarize(runs);
    console.log(`\ncost: per pass, A → B over ${args.frames} frames (ms), the change, and each side's spread:`);
    for (const line of describeRows(rows)) console.log(line);
    const out = join(ROOT, 'screenshots', 'cost', `${label}.json`);
    mkdirSync(join(ROOT, 'screenshots', 'cost'), { recursive: true });
    writeFileSync(out, JSON.stringify({ A: { rev: args.against, hash: hashA }, B: hashB, gl: launched.gl, browser: browser.version(), frames: args.frames,
      size: [args.width, args.height], scale: args.scale, seed: args.seed, order: runOrder(args.rounds), runs, rows }, null, 1));
    console.log(`  ${relative(ROOT, out)}`);
    return 0;
  } finally {
    process.removeListener('SIGINT', stop);
    await browser?.close();
    removeWorktree(tree);
  }
}

const invokedPath = process.argv[1] && existsSync(process.argv[1]) ? realpathSync.native(process.argv[1]) : null;
if (invokedPath === realpathSync.native(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = await run(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(`\ncost: ${err.message}`);
    process.exitCode = 1;
  }
}
