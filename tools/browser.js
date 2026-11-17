// Headless Chromium for the tools (screenshot.js, checks.js, flights.js): launch() with a WebGPU
// adapter (hardware: the machine's GPU; swiftshader: Chromium's software GPU, CI's, on Linux only,
// elsewhere through node tools/linux.js; auto: the hardware, else SwiftShader), the built page
// (assertFreshBuild refuses a build older than its sources), watchPage() for problems (console,
// page and WebGPU errors, a lost device, any network request), testRender(): the page's test mode
// (CLAUDE.md §7) to its last frame, a PNG, and pool(): jobs n at a time.
// Nothing a page does can hang a tool: one that draws no frame for STALL_MS fails (until), and one
// not done in its time is closed (watchdog: while a page's main thread hangs it answers nothing,
// and Playwright's own timeouts don't fire).
import { chromium } from 'playwright';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BUILT_HTML = join(ROOT, 'dist', 'index.html');
// A page that draws no frame for this long has stopped. SwiftShader's first frame bakes the whole
// world: under a minute for a page alone, a few with others beside it.
export const STALL_MS = 300_000;

// WebGPU in the headless shell needs --enable-unsafe-webgpu. On Windows its real GPU (D3D12) needs
// Dawn to compile with FXC: the shell ships without DXC.
const HARDWARE_ARGS = {
  win32: ['--disable-dawn-features=use_dxc'],
  darwin: [],
  linux: ['--enable-features=Vulkan'],
};
export const BACKENDS = {
  hardware: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', ...(HARDWARE_ARGS[process.platform] ?? [])],
  // The compositor shows a WebGPU canvas through GL: without ANGLE on SwiftShader too, presenting
  // loses the device. A first frame bakes the whole world, which takes SwiftShader long enough for
  // the GPU watchdog to step in.
  swiftshader: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog', '--disable-features=GpuWatchdog'],
};
const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render|warp/i;
const PROBE_URL = 'http://localhost/'; // see probeWebGPU()

// mode: 'auto' (hardware, falling back to SwiftShader), 'hardware' or 'swiftshader'.
// Returns { browser, kind, gl } (gl: the adapter, as "vendor architecture device description").
export async function launch(mode = 'auto', log = console.log) {
  if (!['auto', 'hardware', 'swiftshader'].includes(mode)) throw new Error(`--gl must be auto, hardware or swiftshader (got "${mode}")`);
  const order = mode === 'auto' ? ['hardware', 'swiftshader'] : [mode];
  const tried = [];
  for (const kind of order) {
    let browser;
    try {
      // Headless shell only: no `channel:`, never headed. Other modes can clip the user's real mouse on Windows.
      if (kind === 'swiftshader' && process.platform !== 'linux') {
        throw new Error('WebGPU has a SwiftShader adapter on Linux only: run this in a Linux container (node tools/linux.js node tools/...)');
      }
      browser = await chromium.launch({ headless: true, args: BACKENDS[kind] });
      const { gl, fallback } = (await probeWebGPU(browser)) ?? {};
      if (!gl) throw new Error('no WebGPU adapter');
      if (kind === 'hardware' && (SOFTWARE_GPU.test(gl) || fallback)) throw new Error(`got a software adapter instead (${gl})`);
      if (kind === 'swiftshader' && !/swiftshader/i.test(gl)) throw new Error(`got another adapter instead (${gl})`);
      return { browser, kind, gl };
    } catch (err) {
      await browser?.close();
      tried.push(`${kind}: ${explainLaunchError(err.message)}`);
      if (order.length > 1 && kind === 'hardware') log(`hardware WebGPU unavailable (${tried.at(-1)}), trying SwiftShader`);
    }
  }
  throw new Error(`could not start headless Chromium with WebGPU.\n  ${tried.join('\n  ')}`);
}

// Playwright's first error line can be generic ("Target page, context or browser has
// been closed") while the cause sits in the browser log below it. Returns one line.
export function explainLaunchError(message) {
  const lib = /error while loading shared libraries: ([^:\s]+)/.exec(message)?.[1];
  if (lib) return `missing system library ${lib}. Install Chromium's dependencies: npx playwright install-deps chromium (needs root or sudo)`;
  if (message.includes("Executable doesn't exist")) return 'the Chromium headless shell is not installed. Run: npx playwright install --only-shell chromium';
  return message.split('\n')[0];
}

// { gl, fallback } of the adapter the browser gives, or null without one. WebGPU needs a secure
// context, which about:blank isn't here: an empty page at localhost, served by the tool (nothing
// leaves the browser).
async function probeWebGPU(browser) {
  const page = await browser.newPage();
  try {
    await page.route(PROBE_URL, (route) => route.fulfill({ contentType: 'text/html', body: '' }));
    await page.goto(PROBE_URL);
    return await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return null;
      const { vendor, architecture, device, description, isFallbackAdapter } = adapter.info ?? {};
      return { gl: [vendor, architecture, device, description].filter(Boolean).join(' ') || 'unknown adapter', fallback: Boolean(isFallbackAdapter) };
    });
  } finally {
    await page.close();
  }
}

// The built page's file:// URL with URL parameters (an object, or a query string).
export function pageUrl(params = {}) {
  if (!existsSync(BUILT_HTML)) throw new Error('dist/index.html not found. Run `npm run build` first.');
  const query = new URLSearchParams(params).toString().replace(/=(?=&|$)/g, '');
  return pathToFileURL(BUILT_HTML).href + (query ? `?${query}` : '');
}

// Throws if a source of the page changed after dist/index.html was built: the tools test the
// build, and would test an older one. (npm run shot and npm run verify build first.)
export function assertFreshBuild(root = ROOT) {
  const built = join(root, 'dist', 'index.html');
  if (!existsSync(built)) throw new Error('dist/index.html not found. Run `npm run build` first.');
  const time = statSync(built).mtimeMs;
  const sources = [join(root, 'index.html'), join(root, 'vite.config.js'), ...filesIn(join(root, 'src'))];
  const newer = sources.filter((f) => existsSync(f) && statSync(f).mtimeMs > time).map((f) => relative(root, f));
  if (newer.length) {
    const named = `${newer.slice(0, 3).join(', ')}${newer.length > 3 ? ` and ${newer.length - 3} more` : ''}`;
    throw new Error(`dist/index.html is older than ${named}: run \`npm run build\` first`);
  }
}

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesIn(join(dir, e.name)) : [join(dir, e.name)]));
}

// Console warnings that say nothing about the piece.
const NOISE = [/powerPreference option is currently ignored/];

// Watches a page: console errors, page errors, WebGPU errors (validation, out of memory, internal:
// the page doesn't catch them, so they are heard on the device) and requests for anything but the
// page itself become problems; other console warnings are kept as warnings. Call before goto().
export async function watchPage(page) {
  const problems = [];
  const warnings = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') problems.push({ kind: /GPU device was lost/.test(text) ? 'device lost' : 'console error', text });
    else if (msg.type() === 'warning' && !NOISE.some((re) => re.test(text))) warnings.push(text);
  });
  page.on('pageerror', (err) => problems.push({ kind: 'page error', text: err.stack ?? err.message }));
  page.on('request', (req) => {
    const url = req.url();
    if (!isSameFile(url, pathToFileURL(BUILT_HTML).href) && !/^(data|blob):/.test(url)) problems.push({ kind: 'network request', text: url });
  });
  // A WebSocket is no request to Playwright.
  page.on('websocket', (ws) => problems.push({ kind: 'network request', text: ws.url() }));
  await page.addInitScript(() => {
    window.__gpuErrors = [];
    window.__gpuLost = null;
    if (!window.GPUAdapter) return;
    const request = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (...args) {
      const device = await request.apply(this, args);
      device.addEventListener('uncapturederror', (e) => {
        if (window.__gpuErrors.length < 50) window.__gpuErrors.push(`${e.error.constructor.name}: ${e.error.message}`);
      });
      // Chromium logs no error for every kind of loss: heard here.
      device.lost.then((info) => { window.__gpuLost = `${info.reason ?? 'unknown'}: ${info.message}`; });
      return device;
    };
  });
  // The WebGPU errors and a lost device so far, added to the problems once. (Errors arrive from
  // the GPU process only while the page talks to it: wait for the queue first, a few seconds at most.)
  const gpuErrors = async () => {
    const { errors, lost } = await page.evaluate(async () => {
      const device = window.__debug?.device;
      if (device && !window.__gpuLost) {
        await Promise.race([device.queue.onSubmittedWorkDone(), new Promise((r) => setTimeout(r, 5000))]);
        await new Promise((r) => setTimeout(r, 200));
      }
      const out = { errors: window.__gpuErrors ?? [], lost: window.__gpuLost };
      window.__gpuErrors = [];
      window.__gpuLost = null;
      return out;
    }).catch(() => ({ errors: [], lost: null }));
    for (const text of errors) problems.push({ kind: 'webgpu error', text });
    if (lost && !problems.some((p) => p.kind === 'device lost')) problems.push({ kind: 'device lost', text: lost });
  };
  return { problems, warnings, gpuErrors };
}

// Closes `context` once `ms` have passed: whatever waits on its pages then fails, rather than
// waiting forever. `fired` says whether it did; stop() when done.
export function watchdog(context, ms) {
  const dog = { fired: false };
  const timer = setTimeout(() => {
    dog.fired = true;
    context.close().catch(() => {});
  }, ms);
  dog.stop = () => clearTimeout(timer);
  return dog;
}

// Resolves to what `done(arg)` returns in the page once it is truthy (it must be serializable).
// Throws once the page has drawn no frame (window.__frame) for `stallMs`.
export async function until(page, done, arg, { stallMs = STALL_MS, pollMs = 250 } = {}) {
  let frame;
  let since = Date.now();
  for (;;) {
    const value = await page.evaluate(done, arg);
    if (value) return value;
    const now = await page.evaluate(() => window.__frame);
    if (now !== frame) {
      frame = now;
      since = Date.now();
    } else if (Date.now() - since > stallMs) {
      throw Object.assign(new Error(`no frame drawn for ${stallMs / 1000} s (the last: ${frame ?? 'none'})`), { stalled: true });
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

// Why waiting on a page failed, as a problem: it crashed, its time ran out (the watchdog closed
// it), it stopped drawing, or something else went wrong.
export function whyStopped(err, { crashed, fired, timeoutMs }) {
  if (crashed) return { kind: 'page crash', text: 'the page crashed' };
  if (fired) return { kind: 'timeout', text: `not done within ${timeoutMs / 1000} s` };
  if (err.stalled) return { kind: 'timeout', text: err.message };
  return { kind: 'tool error', text: err.message.split('\n')[0] };
}

// Whether a request URL is the page's own file:// URL, ignoring query and hash. Chromium
// upper-cases the Windows drive letter (file:///C:/...) while Node keeps the case of the working
// directory, and Windows paths ignore case anyway.
export function isSameFile(url, fileUrl, platform = process.platform) {
  const strip = (u) => u.split(/[?#]/)[0];
  return platform === 'win32' ? strip(url).toLowerCase() === strip(fileUrl).toLowerCase() : strip(url) === strip(fileUrl);
}

// Renders the page in test mode in a context of its own and waits for its last frame.
// params: URL parameters besides `test` (w, h, frames, scale, preset, pose, seed, ...).
// `read`: a function run in the page once it is done, whose result comes back as `read`.
// Never throws for what the page does: a crash, a hang, a lost device or no image is a problem.
// Returns { png (Buffer, or null), ms, frame, gpu (?cpuprof's per-pass ms, or null), read, problems, warnings }.
export async function testRender(browser, params, { timeoutMs = 900_000, viewport, read } = {}) {
  const w = Number(params.w ?? 960), h = Number(params.h ?? 540);
  const context = await browser.newContext({ viewport: viewport ?? { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const { problems, warnings, gpuErrors } = await watchPage(page);
  const started = Date.now();
  const dog = watchdog(context, timeoutMs);
  let crashed = false;
  page.once('crash', () => { crashed = true; });
  let state = {};
  let extra;
  try {
    await page.goto(pageUrl({ test: '', ...params }));
    await until(page, () => window.__done || window.__error);
    state = await page.evaluate(() => ({
      error: window.__error ?? null,
      frame: window.__frame ?? null,
      png: window.__png ?? null,
      gpu: window.__gpu ? Object.fromEntries(Object.entries(window.__gpu).map(([k, v]) => [k, Number(v.toFixed(2))])) : null,
    }));
    if (state.error) problems.push({ kind: 'page note', text: state.error });
    extra = read ? await page.evaluate(read) : undefined;
    await gpuErrors();
  } catch (err) {
    problems.push(whyStopped(err, { crashed, fired: dog.fired, timeoutMs }));
  } finally {
    dog.stop();
    await context.close().catch(() => {});
  }
  const png = state.png ? Buffer.from(state.png.slice(state.png.indexOf(',') + 1), 'base64') : null;
  if (!png && !problems.length) problems.push({ kind: 'no image', text: 'the page was done without handing over an image' });
  return { png, ms: Date.now() - started, frame: state.frame ?? null, gpu: state.gpu ?? null, read: extra, problems, warnings };
}

// Runs async jobs with at most `n` at a time, in order of the list; resolves to their results.
export async function pool(items, n, job) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await job(items[k], k);
    }
  }));
  return out;
}
