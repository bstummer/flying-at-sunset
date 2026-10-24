// Shared helpers for the browser-driven tools: find Playwright, launch Chromium with software GL
// (SwiftShader, so renders are the same on every machine without a GPU), and locate the page.
//
//   PAGE=path/to/page.html   the page to test (default: index.html at the repo root, which
//                             build.mjs writes from src/)
//   PLAYWRIGHT_MODULE=...     where to import Playwright from, if `import('playwright')` fails
//   CHROMIUM_ARGS="..."       replace the default Chromium flags (e.g. to try a real GPU)
import fs from 'fs';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { build } from '../../build.mjs';

const here = path.dirname(url.fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const TOOLS = path.resolve(here, '..');

let checked = false;
export function pagePath() {
  const p = process.env.PAGE ? path.resolve(process.env.PAGE) : path.join(ROOT, 'index.html');
  if (!fs.existsSync(p)) throw new Error('page not found: ' + p + ' (set PAGE=...)');
  // (the built page should be what src/ builds to: say so once if it is not)
  if (!process.env.PAGE && !checked) {
    checked = true;
    try { if (fs.readFileSync(p, 'utf8') !== build()) console.error('warning: index.html is not built from the current src/ (run node build.mjs)'); }
    catch (e) { console.error('warning: src/ does not build: ' + e.message); }
  }
  return p;
}
// file:// URL of the page with a query string (without the leading '?')
export function pageURL(query = '', page = pagePath()) {
  return url.pathToFileURL(page).href + (query ? '?' + query : '');
}

let pw = null;
export async function playwright() {
  if (pw) return pw;
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
  // also look next to the current directory and in global module folders
  try { tries.push(createRequire(path.join(process.cwd(), 'x.js')).resolve('playwright')); } catch (_) { /* not there */ }
  for (const t of tries) {
    if (!t) continue;
    try {
      const m = await import(t.startsWith('/') ? url.pathToFileURL(t).href : t);
      pw = m.chromium ? m : m.default;
      if (pw && pw.chromium) return pw;
    } catch (_) { /* try the next one */ }
  }
  throw new Error('Playwright not found. Install it (npm i -D playwright) or set PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs');
}

export const SWGL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-gpu-watchdog', '--disable-features=GpuWatchdog'];

export async function launch() {
  const { chromium } = await playwright();
  const args = process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.split(/\s+/).filter(Boolean) : SWGL_ARGS;
  return chromium.launch({ args });
}

// open a page, collect console messages and page errors
export async function openPage(browser, viewport = { width: 640, height: 360 }, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport, ...ctxOpts });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  return { ctx, page, logs };
}

// wait until a ?test render finished (window.__done) or failed (window.__error)
export async function waitDone(page, timeoutMs = 1200000) {
  await page.waitForFunction(() => window.__done || window.__error, null, { timeout: timeoutMs, polling: 500 });
}

// the canvas as PNG bytes (the page keeps its drawing buffer in ?test mode)
export async function canvasPNG(page) {
  const dataUrl = await page.evaluate(() => document.getElementById('view').toDataURL('image/png'));
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

// compare two PNG files (Buffers) in the browser: per-channel absolute differences
export async function comparePNG(browser, a, b) {
  const { ctx, page } = await openPage(browser, { width: 64, height: 64 });
  try {
    return await page.evaluate(async ([da, db]) => {
      const load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
      const [ia, ib] = await Promise.all([load(da), load(db)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { sizeMismatch: [ia.width, ia.height, ib.width, ib.height] };
      const px = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
      const pa = px(ia), pb = px(ib);
      let sum = 0, max = 0, over4 = 0, over16 = 0;
      for (let i = 0; i < pa.length; i += 4) {
        let m = 0;
        for (let c = 0; c < 3; c++) { const d = Math.abs(pa[i + c] - pb[i + c]); sum += d; if (d > m) m = d; }
        if (m > max) max = m;
        if (m > 4) over4++;
        if (m > 16) over16++;
      }
      const n = pa.length / 4;
      return { mean: sum / (n * 3), max, over4: over4 / n, over16: over16 / n };
    }, ['data:image/png;base64,' + a.toString('base64'), 'data:image/png;base64,' + b.toString('base64')]);
  } finally { await ctx.close(); }
}

// run async jobs with at most `n` at a time (software GL is CPU bound: 2 is a good default)
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const k = next++; out[k] = await fn(items[k], k); }
  }));
  return out;
}
