// Headless captures of the built dist/index.html, contact sheets, and before/after compares.
//
//   node tools/screenshot.js [--views start,tower] [--label before] [--size 960x540] [--frames 12]
//                            [--scale 0.5] [--seed 7] [--query "dbg=1&exp=16"]
//                            [--gl auto|hardware|swiftshader] [--profile] [--checks]
//                            [--no-measurements]
//   node tools/screenshot.js --compare <labelA> <labelB> [--views sun,anvil]
//
// Capture: each view of tools/views.js in the page's test mode, two at a time, into
// screenshots/<label>/ (a reused label replaces its capture): <view>.png, contact-sheet.png,
// info.json, and the view's measurements in <view>/ (tools/measure.js: its render runs on for the
// motion strip, once more held still for the shimmer, and once more with other jitter for the
// grain; --no-measurements leaves them out).
// Refuses a build older than its sources (npm run shot builds first). --profile adds ?cpuprof's
// per-pass GPU times; --checks then runs tools/checks.js into <label>/checks/ (npm run verify).
// Exits non-zero on any problem a view or check reports (tools/browser.js).
// Compare: compare/<A>_vs_<B>.png, A | B | diff per view, with how many pixels differ (captures are
// deterministic: on one backend any difference is real) and how the measurements and GPU times
// changed; for each view that differs, compare/<A>_vs_<B>/<view>.png at full size, crops zoomed.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFreshBuild, CHROMIUM, launch, pool, ROOT, testRender } from './browser.js';
import { diffImage, tile } from './image.js';
import { defaultLabel, gitDescribe, labelFolder } from './labels.js';
import { describeMeasurements, describeWarning, grainParams, measurementChanges, measureView, motionParams, shimmerParams, zoomCrops } from './measure.js';
import { decodeDataUrl, decodePng, encodePng } from './png.js';
import { findView, VIEWS } from './views.js';

const SHOTS = join(ROOT, 'screenshots');
const DEFAULT_SIZE = '960x540';
const DEFAULT_FRAMES = '12'; // enough for the temporal upsampling to settle
const DEFAULT_SCALE = '0.5'; // the clouds' resolution, as a share of the canvas's
const AT_ONCE = 2; // renders side by side: the first frame bakes the world on the CPU
const SHEET_ORIGIN = 'http://contact-sheet.local';

const OPTIONS = new Set(['views', 'label', 'size', 'frames', 'scale', 'seed', 'query', 'gl']);
const FLAGS = new Set(['checks', 'profile', 'no-measurements']);

// ---------------------------------------------------------------- capture

async function capture(args) {
  const plan = planCapture(args);
  assertFreshBuild();
  const outDir = join(SHOTS, plan.label);
  const { browser, kind, gl } = await launch(args.gl ?? 'auto', (m) => console.log(`screenshot: ${m}`));
  console.log(`screenshot: WebGPU adapter = ${kind} (${gl}), Chromium ${browser.version()}`);
  const measured = plan.measure ? ' with their measurements' : '';
  console.log(`screenshot: ${plan.views.length} view(s)${measured} at ${plan.width}x${plan.height}, ${plan.frames} frames -> ${rel(outDir)}${args.checks ? ', then the checks' : ''}`);

  const started = Date.now();
  let checks = null;
  try {
    // A reused label replaces the old capture, so no file of it lingers into a compare. Only
    // now: a capture that can't start keeps the old one.
    removeCapture(outDir);
    mkdirSync(outDir, { recursive: true });
    const results = await pool(plan.views, AT_ONCE, async (view) => {
      const params = viewParams(plan, view);
      const result = {
        view: view.name, brief: view.brief, params, file: null, ms: 0, frame: null, gpu: null,
        measurements: null, warnings: [], files: [], problems: [], consoleWarnings: [],
      };
      // (whatever goes wrong with one view, the others and the sheet still get done)
      try {
        // With measurements the flight goes on after the still, which is the first frame handed over.
        const frames = () => window.__frames;
        const r = await testRender(browser, plan.measure ? { ...params, ...motionParams() } : params, { read: plan.measure ? frames : undefined });
        const file = `${view.name}.png`;
        if (r.png) writeFileSync(join(outDir, file), r.png);
        Object.assign(result, { file: r.png ? file : null, ms: r.ms, frame: r.frame, gpu: plan.profile ? r.gpu : null, problems: r.problems, consoleWarnings: r.warnings });
        if (plan.measure && r.png) {
          const held = await testRender(browser, { ...params, ...shimmerParams() }, { read: frames });
          result.problems.push(...held.problems.map((p) => ({ ...p, kind: `${p.kind}, frames held still` })));
          result.consoleWarnings.push(...held.warnings);
          const other = await testRender(browser, { ...params, ...grainParams() }, { read: frames });
          result.problems.push(...other.problems.map((p) => ({ ...p, kind: `${p.kind}, other jitter` })));
          result.consoleWarnings.push(...other.warnings);
          if (held.read && r.read && other.read) {
            const m = measureView({
              motion: r.read.map(decodeDataUrl), still: held.read.map(decodeDataUrl), grain: other.read.map(decodeDataUrl),
              crops: view.crops, limits: view.limits, dir: join(outDir, view.name),
            });
            Object.assign(result, { measurements: m.measurements, warnings: m.warnings, files: m.files.map((f) => `${view.name}/${f}`) });
          }
        }
      } catch (err) {
        result.problems.push({ kind: 'tool error', text: err.stack ?? err.message });
      }
      report(result);
      return result;
    });
    const info = {
      label: plan.label,
      createdAt: new Date().toISOString(),
      commit: gitDescribe(),
      backend: kind,
      gl,
      browser: browser.version(),
      size: [plan.width, plan.height],
      frames: plan.frames,
      scale: plan.scale,
      seed: plan.seed ?? null,
      extra: plan.extra,
      measured: plan.measure,
      results,
    };
    writeFileSync(join(outDir, 'info.json'), `${JSON.stringify(info, null, 1)}\n`);
    await renderPage(browser, contactSheetHtml(info), stillsOf(outDir, results), join(outDir, 'contact-sheet.png'));
    if (args.checks) {
      const { runChecks } = await import('./checks.js');
      checks = await runChecks(browser, { outDir: join(outDir, 'checks') });
      info.checks = checks.map(({ name, problems, notes }) => ({ name, problems, notes }));
      writeFileSync(join(outDir, 'info.json'), `${JSON.stringify(info, null, 1)}\n`);
    }
    const failed = results.filter((r) => r.problems.length).length + (checks ?? []).filter((c) => c.problems.length).length;
    console.log(`\nscreenshot: ${failed ? `FAILED (${failed})` : 'OK'} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
    console.log(`  ${rel(join(outDir, 'contact-sheet.png'))}`);
    return failed ? 1 : 0;
  } finally {
    await browser.close();
  }
}

// The URL parameters of a view's render.
export function viewParams(plan, view) {
  return {
    w: String(plan.width),
    h: String(plan.height),
    frames: plan.frames,
    scale: plan.scale,
    ...view.params,
    ...(plan.seed ? { seed: plan.seed } : {}),
    ...plan.extra,
    ...(plan.profile ? { cpuprof: '' } : {}),
  };
}

function report(r) {
  const gpu = r.gpu ? `  gpu ${Object.entries(r.gpu).map(([k, v]) => `${k} ${v}`).join(' ')}` : '';
  const numbers = r.measurements ? `  ${describeMeasurements(r.measurements)}` : '';
  console.log(`  ${r.problems.length ? 'FAIL' : 'ok  '} ${r.view.padEnd(9)} ${String((r.ms / 1000).toFixed(1)).padStart(6)} s${numbers}${gpu}`);
  for (const p of r.problems) console.log(indent(`[${p.kind}] ${p.text}`, 7));
  for (const w of r.warnings) console.log(indent(`WARN ${describeWarning(w)}`, 7));
  if (r.consoleWarnings.length) console.log(indent(`${r.consoleWarnings.length} console warning(s); first: ${r.consoleWarnings[0]}`, 7));
}

// ---------------------------------------------------------------- compare

async function compare(args) {
  const sides = args.compare.map((label) => readCapture(label));
  const [labelA, labelB] = sides.map((side) => side.label);
  // views.js order first, then anything else found on disk.
  const names = [...new Set([...sides[0].pngs, ...sides[1].pngs].map((f) => f.slice(0, -4)))];
  const order = VIEWS.map((v) => v.name);
  names.sort((a, b) => (order.indexOf(a) + 1 || 1e9) - (order.indexOf(b) + 1 || 1e9) || a.localeCompare(b));
  if (args.views) {
    const asked = args.views.split(',').map((name) => name.trim());
    const missing = asked.filter((name) => !names.includes(name));
    if (missing.length) throw new Error(`no still of ${missing.join(', ')} in either capture`);
    names.splice(0, names.length, ...names.filter((name) => asked.includes(name)));
  }
  if (!names.length) throw new Error('no view screenshots to compare');

  const files = new Map();
  const rows = names.map((name) => {
    const cell = (side, i) => {
      if (!side.pngs.has(`${name}.png`)) return null;
      const path = `/${i ? 'b' : 'a'}/${name}.png`;
      files.set(path, join(side.dir, `${name}.png`));
      return path;
    };
    const [a, b] = sides.map((side) => side.info?.results?.find((r) => r.view === name) ?? {});
    const changes = [...measurementChanges(a.measurements, b.measurements), ...gpuChanges(a.gpu, b.gpu).map((c) => `gpu ${c}`)];
    return { name, a: cell(sides[0], 0), b: cell(sides[1], 1), changes };
  });

  const outDir = join(SHOTS, 'compare');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${labelA}_vs_${labelB}.png`);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, ...CHROMIUM.options });
  try {
    const stats = await renderPage(browser, compareSheetHtml(sides, rows), files, out);
    console.log(`screenshot: compare ${labelA} vs ${labelB}`);
    for (const warning of mismatchWarnings(sides)) console.log(`  WARN ${warning}`);
    for (const { name, a, b, changes } of rows) {
      const summary = stats?.find((s) => s.name === name)?.summary ?? `no still in ${[!a && labelA, !b && labelB].filter(Boolean).join(' and ')}`;
      console.log(`  ${name.padEnd(9)} ${summary}${changes.length ? `; ${changes.join(', ')}` : ''}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`  ${rel(out)}`);
  const detail = writeViewCompares(sides, rows.filter((r) => r.a && r.b).map((r) => r.name), join(outDir, `${labelA}_vs_${labelB}`));
  if (detail.length) console.log(`  ${rel(join(outDir, `${labelA}_vs_${labelB}`))}${sep}: ${detail.join(', ')} at full size, with their crops`);
  return 0;
}

// For each view whose stills differ: <dir>/<view>.png, A | B | diff at full size, then each of the
// view's crops (tools/views.js; else the centre) zoomed, A | B | diff. Returns the views written.
function writeViewCompares(sides, names, dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  const written = [];
  for (const name of names) {
    const [a, b] = sides.map((side) => decodePng(readFileSync(join(side.dir, `${name}.png`))));
    if (a.width !== b.width || a.height !== b.height) continue;
    const diff = diffImage(a, b);
    if (!diff.changed) continue;
    const crops = [a, b, diff.image].map((image) => Object.values(zoomCrops(image, VIEWS.find((v) => v.name === name)?.crops)));
    const cells = [a, b, diff.image, ...crops[0].flatMap((_, k) => crops.map((c) => c[k]))];
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.png`), encodePng(tile(cells, { columns: 3, gap: 6 })));
    written.push(name);
  }
  return written;
}

// One side of a compare: the capture a label names, its info.json, and its stills: the ones
// info.json lists, so stray files from older captures stay out, that exist.
export function readCapture(label, shots = SHOTS) {
  const folder = labelFolder(label);
  const dir = join(shots, folder);
  if (!existsSync(dir)) throw new Error(`no capture labelled "${label}": ${rel(dir)} does not exist`);
  const infoFile = join(dir, 'info.json');
  const info = existsSync(infoFile) ? JSON.parse(readFileSync(infoFile, 'utf8')) : null;
  const listed = info?.results?.map((r) => r.file).filter(Boolean) ?? readdirSync(dir).filter((f) => f.endsWith('.png') && f !== 'contact-sheet.png');
  return { label: folder, dir, info, pngs: new Set(listed.filter((f) => existsSync(join(dir, f)))) };
}

// How the per-pass GPU times (--profile) changed, as "pass before → after (±n%)".
export function gpuChanges(a, b) {
  if (!a || !b) return [];
  return Object.keys(a)
    .filter((k) => Number.isFinite(a[k]) && Number.isFinite(b[k]) && a[k] !== b[k])
    .map((k) => `${k} ${a[k]} → ${b[k]}${a[k] ? ` (${b[k] >= a[k] ? '+' : ''}${(100 * (b[k] / a[k] - 1)).toFixed(0)}%)` : ''}`);
}

export function mismatchWarnings([a, b]) {
  if (!a.info || !b.info) return ['info.json missing on one side; cannot check capture settings'];
  const warnings = [];
  if (a.info.gl !== b.info.gl) warnings.push(`different WebGPU adapters: "${a.info.gl}" vs "${b.info.gl}"`);
  if (a.info.browser !== b.info.browser) warnings.push(`different Chromium builds: ${a.info.browser} vs ${b.info.browser}`);
  for (const key of ['size', 'frames', 'scale', 'seed', 'extra', 'measured']) {
    const [x, y] = [a, b].map((side) => JSON.stringify(side.info[key] ?? null));
    if (x !== y) warnings.push(`different ${key}: ${x} vs ${y}`);
  }
  return warnings;
}

// ---------------------------------------------------------------- sheets

// Renders an HTML page (served from a fake origin so images are same-origin and canvas-readable)
// and saves a full-page PNG. Returns window.__SHEET_DONE__.
async function renderPage(browser, html, files, outPath) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 1 });
  try {
    await page.route(`${SHEET_ORIGIN}/**`, (route) => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname);
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: html });
      const file = files.get(path);
      // A missing file would leave the request hanging, and the sheet with it.
      return file && existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: 'not found' });
    });
    await page.goto(`${SHEET_ORIGIN}/`);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.setViewportSize({ width, height: 600 });
    const done = await page.waitForFunction(() => window.__SHEET_DONE__, null, { timeout: 120_000 });
    await page.screenshot({ path: outPath, fullPage: true });
    // Awaited here: a bare `return` would let `finally` close the page mid-read.
    return await done.jsonValue();
  } finally {
    await page.close();
  }
}

// The stills of `results` in `dir` that exist, by their path on the sheet's page.
function stillsOf(dir, results) {
  return new Map(results.filter((r) => r.file && existsSync(join(dir, r.file))).map((r) => [`/${r.file}`, join(dir, r.file)]));
}

const SHEET_CSS = `
  body { margin: 0; padding: 24px; background: #15171a; color: #e8e4dc; font: 14px/1.4 system-ui, 'Segoe UI', sans-serif; width: max-content; }
  h1 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
  .meta { color: #9aa0a8; margin-bottom: 18px; }
  .warn { color: #ffb454; margin: 4px 0 12px; }
  .grid { display: grid; gap: 16px; }
  figure { margin: 0; }
  figure img, figure canvas { display: block; width: var(--cell); height: auto; background: #000; }
  figcaption { padding: 6px 2px 0; width: var(--cell); }
  figcaption b { font-size: 16px; }
  figcaption span { color: #9aa0a8; margin-left: 8px; }
  .brief { color: #c9c3b8; display: block; }
  .bad { outline: 3px solid #ff4d4d; }
  .missing { width: var(--cell); aspect-ratio: var(--aspect); display: grid; place-items: center; background: #222; color: #777; }
  .row-label { display: flex; align-items: baseline; gap: 10px; }
  .same { color: #6fd08c; } .diff { color: #ffb454; }
`;

function contactSheetHtml(info) {
  const [w, h] = info.size;
  const cols = info.results.length <= 1 ? 1 : info.results.length <= 4 ? 2 : 3;
  const cell = Math.min(w, 640);
  const extra = Object.entries(info.extra).map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join('&');
  const figures = info.results.map((r) => {
    const status = r.problems.length ? ` · <span class="diff">${r.problems.length} problem(s)</span>` : '';
    const numbers = r.measurements ? ` · ${esc(describeMeasurements(r.measurements))}` : '';
    const warnings = r.warnings.map((w) => `<span class="brief diff">⚠ ${esc(describeWarning(w))}</span>`).join('');
    const picture = r.file ? `<img src="/${esc(r.file)}" class="${r.problems.length ? 'bad' : ''}">` : '<div class="missing bad">no still</div>';
    return `<figure>${picture}
      <figcaption><b>${esc(r.view)}</b><span>${(r.ms / 1000).toFixed(1)} s${numbers}${status}</span><span class="brief">${esc(r.brief ?? '')}</span>${warnings}</figcaption></figure>`;
  });
  return htmlDocument(`
    <h1>${esc(info.label)}</h1>
    <div class="meta">${w}×${h}, ${esc(info.frames)} frames, clouds at ${esc(info.scale)} · ${esc(info.backend)}: ${esc(info.gl)} · Chromium ${esc(info.browser)}${extra ? ` · ${esc(extra)}` : ''} · ${esc(info.commit)} · ${esc(info.createdAt)}</div>
    <div class="grid" style="--cell:${cell}px; --aspect:${w} / ${h}; grid-template-columns: repeat(${cols}, ${cell}px)">${figures.join('')}</div>
    <script>
      Promise.all([...document.images].map((img) => img.decode().catch(() => {}))).then(() => { window.__SHEET_DONE__ = true; });
    </script>`);
}

function compareSheetHtml(sides, rows) {
  const [a, b] = sides;
  const size = a.info?.size ?? b.info?.size ?? [960, 540];
  const cell = Math.min(size[0], 640);
  const describe = (s) => (s.info ? `${s.info.backend}: ${s.info.gl} · Chromium ${s.info.browser} · ${s.info.size.join('×')} · ${s.info.commit}` : 'no info.json');
  const warnings = mismatchWarnings(sides).map((w) => `<div class="warn">⚠ ${esc(w)}</div>`).join('');
  const img = (src) => (src ? `<img src="${esc(src)}">` : '<div class="missing">missing</div>');
  const body = rows.map((r) => `
    <div class="row-label"><b style="font-size:16px">${esc(r.name)}</b><span class="stat" data-view="${esc(r.name)}"></span>
      ${r.changes.length ? `<span class="diff">${esc(r.changes.join(' · '))}</span>` : ''}</div>
    <div class="grid" style="grid-template-columns: repeat(3, ${cell}px); margin-bottom: 22px">
      <figure>${img(r.a)}<figcaption>A · ${esc(a.label)}</figcaption></figure>
      <figure>${img(r.b)}<figcaption>B · ${esc(b.label)}</figcaption></figure>
      <figure>${r.a && r.b ? `<canvas data-a="${esc(r.a)}" data-b="${esc(r.b)}" data-view="${esc(r.name)}"></canvas>` : '<div class="missing">no diff</div>'}
        <figcaption>diff over B: magenta, brighter = larger change; faint = 1-2 levels</figcaption></figure>
    </div>`);
  return htmlDocument(`
    <h1>${esc(a.label)} <span style="color:#9aa0a8">vs</span> ${esc(b.label)}</h1>
    <div class="meta">A: ${esc(describe(a))}<br>B: ${esc(describe(b))}</div>
    ${warnings}
    <div style="--cell:${cell}px; --aspect:${size[0]} / ${size[1]}">${body.join('')}</div>
    <script>
      const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
      const pixels = (img) => {
        const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, c.width, c.height).data;
      };
      async function diff(canvas) {
        const [ia, ib] = await Promise.all([load(canvas.dataset.a), load(canvas.dataset.b)]);
        if (ia.naturalWidth !== ib.naturalWidth || ia.naturalHeight !== ib.naturalHeight) {
          return { name: canvas.dataset.view, summary: 'size mismatch', changed: -1 };
        }
        const w = ia.naturalWidth, h = ia.naturalHeight, pa = pixels(ia), pb = pixels(ib);
        const out = new ImageData(w, h);
        let changed = 0, large = 0, max = 0;
        for (let i = 0; i < pa.length; i += 4) {
          const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
          const grey = 0.25 * (0.2126 * pb[i] + 0.7152 * pb[i + 1] + 0.0722 * pb[i + 2]);
          const k = d === 0 ? 0 : d <= 2 ? 0.15 : Math.min(1, 0.3 + d / 48);
          out.data[i] = grey + (255 - grey) * k;
          out.data[i + 1] = grey + (40 - grey) * k;
          out.data[i + 2] = grey + (200 - grey) * k;
          out.data[i + 3] = 255;
          if (d) { changed++; if (d > 2) large++; if (d > max) max = d; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').putImageData(out, 0, 0);
        return { name: canvas.dataset.view, summary: diffSummary({ changed, large, max, total: w * h }), changed, maxDelta: max };
      }
      ${diffSummary}
      Promise.all([...document.images].map((i) => i.decode().catch(() => {})))
        .then(() => Promise.all([...document.querySelectorAll('canvas[data-a]')].map(diff)))
        .then((stats) => {
          for (const s of stats) {
            const el = document.querySelector('.stat[data-view="' + CSS.escape(s.name) + '"]');
            el.textContent = s.summary;
            el.className = 'stat ' + (s.changed === 0 ? 'same' : 'diff');
          }
          window.__SHEET_DONE__ = stats;
        });
    </script>`);
}

// A view's line in a compare: how many of its `total` pixels differ, and by more than 2 levels,
// as counts and as shares that never round a real change to zero. Also runs in the sheet's page,
// so it uses nothing outside itself.
export function diffSummary({ changed, large, max, total }) {
  if (!changed) return 'identical';
  const share = (n) => {
    const percent = (100 * n) / total;
    return `${n === 0 || percent >= 0.01 ? percent.toFixed(2) : percent.toPrecision(2)}% (${n} px)`;
  };
  return `${share(changed)} of pixels differ, ${share(large)} by more than 2 levels (max channel delta ${max})`;
}

function htmlDocument(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${SHEET_CSS}</style></head><body>${body}</body></html>`;
}

// ---------------------------------------------------------------- arguments

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument "${arg}"`);
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (key === 'compare') {
      out.compare = [argv[++i], argv[++i]];
      if (!out.compare[0] || !out.compare[1] || out.compare.some((l) => l.startsWith('--'))) throw new Error('usage: --compare <labelA> <labelB>');
      continue;
    }
    if (FLAGS.has(key)) {
      if (eq !== -1) throw new Error(`--${key} takes no value`);
      out[key] = true;
      continue;
    }
    if (!OPTIONS.has(key)) throw new Error(`unknown option --${key}. Options: --${[...OPTIONS, ...FLAGS].join(', --')}, --compare`);
    const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    out[key] = value;
  }
  return out;
}

// What a capture's args ask for. Throws for any arg that is wrong, before a capture deletes anything.
export function planCapture(args) {
  const views = !args.views || args.views === 'all' ? VIEWS : args.views.split(',').map((name) => findView(name.trim()));
  const m = /^(\d+)x(\d+)$/.exec(args.size ?? DEFAULT_SIZE);
  if (!m) throw new Error(`--size must look like 960x540 (got "${args.size}")`);
  const frames = args.frames ?? DEFAULT_FRAMES;
  if (!/^[1-9]\d*$/.test(frames)) throw new Error(`--frames must be a whole number above 0 (got "${frames}")`);
  const scale = args.scale ?? DEFAULT_SCALE;
  if (!(Number(scale) > 0 && Number(scale) <= 1)) throw new Error(`--scale must be above 0 and at most 1 (got "${scale}")`);
  if (args.seed !== undefined && !/^-?\d+$/.test(args.seed)) throw new Error(`--seed must be a whole number (got "${args.seed}")`);
  const extra = Object.fromEntries(new URLSearchParams(args.query ?? ''));
  for (const key of ['test', 'w', 'h', 'frames', 'scale', 'seed']) {
    if (key in extra) throw new Error(`--query can't set ${key}: use --${{ w: 'size', h: 'size' }[key] ?? key}${key === 'test' ? ' (always on)' : ''}`);
  }
  for (const key of ['keep', 'every', 'freeze', 'dt', 'jit']) {
    if (key in extra) throw new Error(`--query can't set ${key}: the measurements use it`);
  }
  return {
    views, width: Number(m[1]), height: Number(m[2]), frames, scale, seed: args.seed, extra,
    profile: Boolean(args.profile), measure: !args['no-measurements'], label: labelFolder(args.label ?? defaultLabel()),
  };
}

// Deletes a capture's folder, and refuses anything else, however `dir` came about: it must be a
// folder right inside `shots` that a label names.
export function removeCapture(dir, shots = SHOTS) {
  const path = resolve(dir);
  const name = basename(path);
  let isLabel = false;
  try {
    isLabel = labelFolder(name) === name;
  } catch {
    isLabel = false;
  }
  if (dirname(path) !== resolve(shots) || !isLabel) throw new Error(`refusing to delete ${path}: not a capture's folder in ${resolve(shots)}`);
  rmSync(path, { recursive: true, force: true });
}

function rel(path) {
  return relative(ROOT, path) || '.';
}

function indent(text, n) {
  return text.split('\n').map((line) => ' '.repeat(n) + line).join('\n');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------------------------------------------------------------- main
// Last, so every module-level constant above is initialised before it runs.
// Runs only when executed directly, not when imported by tests.

const invokedPath = process.argv[1] && existsSync(process.argv[1]) ? realpathSync.native(process.argv[1]) : null;
if (invokedPath === realpathSync.native(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    process.exitCode = args.compare ? await compare(args) : await capture(args);
  } catch (err) {
    console.error(`\nscreenshot: ${err.message}`);
    process.exitCode = 1;
  }
}
