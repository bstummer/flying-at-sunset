// Behaviour checks of the built page, beyond its stills: CHECKS below, each with what it holds the
// piece to. A check fails on a broken promise of the piece, and on any problem the page's watcher
// hears (tools/browser.js: errors, a lost device, a network request, a crash, a timeout).
//
//   node tools/checks.js [names...] [--gl auto|hardware|swiftshader]     into screenshots/checks/
//   (tools/screenshot.js --checks runs them all after a capture, into <label>/checks/: npm run verify)
//
// Two at a time, in CHECKS' order (the longest first); player and benchmark last, alone: they time
// the page by the wall clock, and pages drawing side by side wait for each other's frames. The
// steering checks run ?test&live (a fixed time step, input read as in normal use), with thresholds
// far below what the page does: they catch what is broken, not tuning.
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFreshBuild, launch, pageUrl, pool, ROOT, testRender, until, watchdog, watchPage } from './browser.js';
import { flyAll, LOG } from './flights.js';
import { decodePng } from './png.js';
import { parseParams } from '../src/core/params.js';

const AT_ONCE = 2;
const LIVE = { test: '', live: '', log: '', w: '64', h: '36', scale: '0.3', dt: '0.05', frames: '100000' };

export const CHECKS = [
  { name: 'streaming', what: 'flying 8 km streams in the same world volumes a fresh start at that place bakes', run: checkStreaming },
  { name: 'top-speed', what: 'flying level at top speed, the domes around the bird come before it reaches their edge: the page never grows the world itself', run: checkTopSpeed },
  { name: 'flight', what: 'scripted flights: dives gain speed, climbs trade it for height, turns bank, the bird is kept from sinking deep into the sea', run: checkFlight },
  { name: 'steering', what: 'mouse, keys and touch bank, climb and dive the bird, and letting go levels it out', run: checkSteering },
  { name: 'reproducible', what: 'a capture renders the same, byte for byte, every time, and handing over more frames changes it not at all', run: checkReproducible },
  { name: 'out-of-memory', what: 'GPU memory running out for what never changes, at start, on a resize and for good: the page says so, retries smaller, keeps running, or says so', run: checkOutOfMemory },
  { name: 'volumes', what: 'the baked world volumes: no NaNs, no cloud cut off at a volume\'s ceiling, sound column maps, the sun map baked and within 0..1', run: checkVolumes },
  { name: 'pointer-and-keys', what: 'the pointer leaving levels out; Cmd/Ctrl shortcuts don\'t steer; Meta clears held keys; P logs the moment\'s pose as a view', run: checkPointerAndKeys },
  { name: 'errors', what: 'the tools hear what nothing on screen shows: a WebGPU validation error, a lost device', run: checkErrors },
  { name: 'player', what: 'as a visitor sees it: the canvas fades in, the steering hint comes and goes, on a desktop, a phone, with ?debug and after a 12 s frame', run: checkPlayer, alone: true },
  { name: 'benchmark', what: '?bench flies its route, measures every leg and ends with a summary to paste', run: checkBenchmark, alone: true },
];

// Runs checks (all, or those named) with `browser` and reports each; what they write (images,
// benchmark.txt) goes into `outDir`. Returns [{ name, problems: [{ kind, text }], notes: [string] }].
export async function runChecks(browser, { names, outDir } = {}) {
  const chosen = names?.length ? names.map((n) => CHECKS.find((c) => c.name === n) ?? unknown(n)) : CHECKS;
  console.log(`\nchecks: ${chosen.map((c) => c.name).join(', ')}`);
  const run = async (check) => {
    const started = Date.now();
    const result = { name: check.name, problems: [], notes: [] };
    const fail = (text, kind = 'check') => result.problems.push({ kind, text });
    try {
      await check.run(browser, { fail, note: (text) => result.notes.push(text), problems: result.problems, outDir });
    } catch (err) {
      fail(err.stack ?? err.message, 'exception');
    }
    console.log(`  ${result.problems.length ? 'FAIL' : 'ok  '} ${check.name.padEnd(17)} ${((Date.now() - started) / 1000).toFixed(0).padStart(4)} s  ${check.what}`);
    for (const n of result.notes) console.log(`         ${n}`);
    for (const p of result.problems) console.log(`         [${p.kind}] ${p.text.split('\n').join('\n         ')}`);
    return result;
  };
  const together = await pool(chosen.filter((c) => !c.alone), AT_ONCE, run);
  const alone = [];
  for (const check of chosen.filter((c) => c.alone)) alone.push(await run(check));
  return [...together, ...alone];
}

function unknown(name) {
  throw new Error(`unknown check "${name}". Checks: ${CHECKS.map((c) => c.name).join(', ')}`);
}

// A page of its own, watched for errors and closed after `timeoutMs` (whatever waits on it then
// fails): { page, context, done() } (done() collects WebGPU errors into `problems` and closes it).
async function openPage(browser, problems, contextOptions = { viewport: { width: 400, height: 300 } }, { timeoutMs = 900_000 } = {}) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  // The pointer rests in the middle of the page, where it steers nothing. Playwright's starts at
  // (0, 0), the top left corner, and headless Chromium on CI now and then delivers a pointer move
  // there, which steers the bird up and left: letting go of the keys banked it -40° (steering), and
  // the hint went as it came, the page counting it as the visitor steering (player).
  const view = page.viewportSize();
  if (view) await page.mouse.move(view.width / 2, view.height / 2);
  const watched = await watchPage(page);
  const dog = watchdog(context, timeoutMs);
  let crashed = false;
  page.once('crash', () => { crashed = true; });
  return {
    page,
    context,
    done: async () => {
      dog.stop();
      if (crashed) problems.push({ kind: 'page crash', text: 'the page crashed' });
      else if (dog.fired) problems.push({ kind: 'timeout', text: `not done within ${timeoutMs / 1000} s` });
      else await watched.gpuErrors();
      problems.push(...watched.problems);
      await context.close().catch(() => {});
    },
  };
}

// ---------------------------------------------------------------- the page as a visitor sees it

async function checkPlayer(browser, { fail, note, problems }) {
  const variants = [
    { label: 'desktop', options: { viewport: { width: 640, height: 360 } }, params: {}, hint: /^Move the mouse to steer/ },
    { label: 'desktop ?debug', options: { viewport: { width: 640, height: 360 } }, params: { debug: '' }, hint: /^Move the mouse to steer/, stats: true },
    { label: 'phone', options: { viewport: { width: 300, height: 600 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, params: {}, hint: /^Touch and drag to steer/ },
    // a slow device (as SwiftShader on CI): the frames after the bird shows take long, here one 12 s
    { label: 'a 12 s frame', options: { viewport: { width: 640, height: 360 } }, params: {}, hint: /^Move the mouse to steer/, stall: 12 },
  ];
  for (const v of variants) {
    const { page, done } = await openPage(browser, problems, v.options);
    try {
      if (v.stall) {
        await page.addInitScript((seconds) => addEventListener('DOMContentLoaded', () => {
          const view = document.getElementById('view');
          const once = new MutationObserver(() => {
            if (!view.classList.contains('on')) return;
            once.disconnect();
            for (const end = performance.now() + seconds * 1000; performance.now() < end;);
          });
          once.observe(view, { attributes: true, attributeFilter: ['class'] });
        }), v.stall);
      }
      // Every class change of the hint and the canvas, timed in the page (src/main.js times the
      // hint by the wall clock), with the class it changed to: the class when the observer runs
      // would hide an "on" and an "off" within one frame.
      await page.addInitScript(() => {
        window.__ui = [];
        addEventListener('DOMContentLoaded', () => {
          for (const id of ['hint', 'view']) {
            const el = document.getElementById(id);
            new MutationObserver((records) => {
              const t = performance.now() / 1000;
              records.forEach((r, k) => window.__ui.push([t, id, /\bon\b/.test((k + 1 < records.length ? records[k + 1].oldValue : el.className) ?? '')]));
            }).observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
          }
        });
      });
      await page.goto(pageUrl(v.params));
      // until the hint has come and gone (1.8 s after the canvas faded in, for 8.2 s), and with
      // ?debug the overlay shows its numbers (after 30 frames)
      await until(page, (stats) => window.__error
        || (window.__ui.filter((e) => e[1] === 'hint').length >= 2 && (!stats || /fps/.test(document.getElementById('stats')?.textContent ?? ''))), Boolean(v.stats));
      const s = await page.evaluate(() => ({
        events: window.__ui,
        hint: document.getElementById('hint').innerText.replace(/\n/g, ' | '),
        stats: document.getElementById('stats')?.textContent ?? null,
        steered: window.__debug?.input.activeTime ?? 0,
        error: window.__error ?? null,
        note: getComputedStyle(document.getElementById('note')).display,
      }));
      const at = (id, on) => s.events.find((e) => e[1] === id && e[2] === on)?.[0];
      const shown = at('view', true), on = at('hint', true), off = at('hint', false);
      if (s.error) fail(`${v.label}: the page's note says: ${s.error}`);
      if (s.note !== 'none') fail(`${v.label}: the error note is showing`);
      if (shown === undefined) fail(`${v.label}: the canvas never faded in`);
      if (on === undefined || off === undefined) fail(`${v.label}: the hint ${on === undefined ? 'never showed' : 'never went away'}`);
      // (8.2 s; the page changes it between frames, which take a second or two on SwiftShader)
      else if (!(off - on > 5)) fail(`${v.label}: the hint showed for only ${(off - on).toFixed(1)} s (expected about 8 s; the page counted ${s.steered.toFixed(1)} s of steering)`);
      else if (on < shown) fail(`${v.label}: the hint showed before the canvas faded in`);
      if (!v.hint.test(s.hint)) fail(`${v.label}: the hint says "${s.hint}"`);
      if (v.stats && !/fps/.test(s.stats ?? '')) fail(`${v.label}: no frame rate in the debug overlay (${JSON.stringify(s.stats)})`);
      note(`${v.label}: canvas at ${shown?.toFixed(1)} s, hint from ${on?.toFixed(1)} to ${off?.toFixed(1)} s`);
    } finally {
      await done();
    }
  }
}

// ---------------------------------------------------------------- steering

// A live page (fixed time step, real input): { page, state(), waitSim(seconds), done() }.
async function livePage(browser, problems, options) {
  const opened = await openPage(browser, problems, options);
  const { page } = opened;
  await page.goto(pageUrl(LIVE));
  await until(page, () => window.__frame > 2 || window.__error);
  const last = () => page.evaluate(() => window.__log.at(-1));
  return {
    ...opened,
    state: async () => {
      const [row, steer] = await page.evaluate(() => [window.__log.at(-1), window.__debug.input.kind]);
      return { t: row[LOG.t], bank: row[LOG.bank], gamma: row[LOG.gamma], speed: row[LOG.speed], steer };
    },
    waitSim: async (seconds) => {
      const t0 = (await last())[LOG.t];
      await until(page, (t) => window.__log.at(-1)[0] > t || window.__error, t0 + seconds, { pollMs: 100 });
    },
  };
}

const fmt = (s) => `bank ${s.bank}°, pitch ${s.gamma}°`;
const level = (s) => Math.abs(s.bank) < 5 && Math.abs(s.gamma) < 5;

async function checkSteering(browser, { fail, note, problems }) {
  await Promise.all(['mouse', 'keys', 'touch'].map(async (mode) => {
    const live = await livePage(browser, problems, { viewport: { width: 400, height: 300 }, hasTouch: mode === 'touch' });
    const { page, state, waitSim } = live;
    const expect = (what, s, ok) => {
      if (!ok) fail(`${mode}: ${what}: ${fmt(s)} (steered by ${s.steer})`);
    };
    try {
      if (mode === 'mouse') {
        await page.mouse.move(390, 150);
        await waitSim(2.5);
        const right = await state();
        expect('pointing right should bank right', right, right.bank > 40);
        await page.mouse.move(200, 20);
        await waitSim(2.5);
        const up = await state();
        expect('pointing up should climb', up, up.gamma > 15);
        await page.mouse.move(200, 150);
        await waitSim(3);
        const centre = await state();
        expect('the pointer in the centre should level out', centre, level(centre));
        note(`mouse: right ${fmt(right)} · up ${fmt(up)} · centre ${fmt(centre)}`);
      } else if (mode === 'keys') {
        await page.keyboard.down('ArrowLeft');
        await waitSim(2.5);
        const left = await state();
        expect('the left arrow should bank left', left, left.bank < -40);
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.down('KeyS');
        await waitSim(2.5);
        const dive = await state();
        expect('S should dive', dive, dive.gamma < -15);
        await page.keyboard.up('KeyS');
        await waitSim(3);
        const released = await state();
        expect('letting go should level out', released, level(released));
        note(`keys: left ${fmt(left)} · S ${fmt(dive)} · released ${fmt(released)}`);
      } else {
        const cdp = await live.context.newCDPSession(page);
        const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
        await touch('touchStart', 200, 150);
        for (let i = 1; i <= 10; i++) await touch('touchMove', 200 + i * 6, 150);
        await waitSim(2.5);
        const right = await state();
        expect('dragging right should bank right', right, right.bank > 40);
        for (let i = 1; i <= 10; i++) await touch('touchMove', 260 - i * 6, 150 - i * 6);
        await waitSim(2.5);
        const up = await state();
        expect('dragging up should climb', up, up.gamma > 15);
        await touch('touchEnd');
        await waitSim(3);
        const released = await state();
        expect('letting go should level out', released, level(released));
        const ring = await page.evaluate(() => document.getElementById('touch').className);
        if (ring) fail(`touch: the touch ring still shows after letting go (class "${ring}")`);
        note(`touch: right ${fmt(right)} · up ${fmt(up)} · released ${fmt(released)}`);
      }
    } finally {
      await live.done();
    }
  }));
}

async function checkPointerAndKeys(browser, { fail, note, problems }) {
  const live = await livePage(browser, problems, { viewport: { width: 400, height: 300 } });
  const { page, state, waitSim } = live;
  const input = () => page.evaluate(() => ({ mouse: window.__debug.input.mouse, keys: [...window.__debug.input.keys] }));
  try {
    await page.mouse.move(390, 150);
    await waitSim(2.5);
    const right = await state();
    if (!(right.bank > 40)) fail(`pointing right should bank right: ${fmt(right)}`);
    await page.evaluate(() => document.getElementById('view').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
    if ((await input()).mouse !== null) fail('the pointer left the window, but the page still steers by it');
    await waitSim(3);
    const left = await state();
    if (!level(left)) fail(`the pointer leaving should level out: ${fmt(left)}`);
    await page.keyboard.down('Meta');
    await page.keyboard.down('ArrowLeft');
    await waitSim(1.5);
    const shortcut = await state();
    if ((await input()).keys.length) fail(`Cmd + arrow (a shortcut) holds keys: ${JSON.stringify((await input()).keys)}`);
    if (!level(shortcut)) fail(`Cmd + arrow (a shortcut) steers: ${fmt(shortcut)}`);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('Meta');
    await page.keyboard.down('ArrowLeft');
    await waitSim(2.5);
    const arrow = await state();
    if (!(arrow.bank < -40)) fail(`the left arrow should bank left: ${fmt(arrow)}`);
    // macOS drops the key-ups of keys released while Cmd is held: tapping Meta clears them.
    await page.keyboard.down('Meta');
    await page.keyboard.up('Meta');
    await waitSim(0.2);
    if ((await input()).keys.length) fail(`tapping Meta should clear held keys: ${JSON.stringify((await input()).keys)}`);
    await page.keyboard.up('ArrowLeft');
    // P: the bird's pose of 12 test frames (0.2 s) before the key, so a capture's still lands on the
    // moment, as a view whose pose the page reads
    const logged = [];
    page.on('console', (m) => logged.push(m.text()));
    await page.keyboard.press('KeyP');
    const flown = await page.evaluate(() => window.__log.map((row) => [row[0], row[1], row[2], row[3]]));
    await waitSim(0.2);
    const entry = logged.find((l) => l.startsWith("{ name: 'new-view', params: { pose: '"));
    const pose = entry ? parseParams(`?test&pose=${/pose: '([^']*)'/.exec(entry)[1]}`) : null;
    if (!pose || pose.errors.length || pose.pose.length !== 7) fail(`P should log a view whose pose the page reads, x,y,z,yaw,pitch,bank,speed: ${entry}`);
    else {
      const [px, py, pz] = pose.pose;
      const at = flown.findLast(([, x, y, z]) => Math.hypot(x - px, y - py, z - pz) < 0.2);
      const lead = at ? flown.at(-1)[0] - at[0] : null;
      if (lead === null || lead < 0.15 || lead > 0.35) fail(`P's pose should be where the bird flew 0.2 s before the key: ${lead === null ? 'nowhere it flew' : `${lead.toFixed(2)} s before`}`);
    }
    note(`banks: pointer ${right.bank}° · after it left ${left.bank}° · Cmd + left ${shortcut.bank}° · left ${arrow.bank}°; P: ${entry}`);
  } finally {
    await live.done();
  }
}

// ---------------------------------------------------------------- flight

// The flights of tools/flights.js, judged.
const JUDGE = {
  dive: (log) => {
    const gain = Math.max(...log.map((r) => r[LOG.speed])) - log[0][LOG.speed];
    return [gain > 20 && Math.min(...log.map((r) => r[LOG.gamma])) < -25, `speed +${gain.toFixed(0)} m/s`];
  },
  climb: (log) => {
    const rise = Math.max(...log.map((r) => r[LOG.alt])) - log[0][LOG.alt];
    const loss = log[0][LOG.speed] - Math.min(...log.map((r) => r[LOG.speed]));
    return [rise > 60 && loss > 10, `height +${rise.toFixed(0)} m for ${loss.toFixed(0)} m/s`];
  },
  turn: (log) => {
    const bank = Math.max(...log.map((r) => Math.abs(r[LOG.bank])));
    const turned = Math.abs(log.at(-1)[LOG.yaw] - log[0][LOG.yaw]);
    return [bank > 40 && turned > 90, `bank up to ${bank}°, turned ${turned.toFixed(0)}°`];
  },
  weave: (log) => {
    const right = Math.max(...log.map((r) => r[LOG.bank])), left = Math.min(...log.map((r) => r[LOG.bank]));
    return [right > 30 && left < -30, `bank ${left}° .. ${right}°`];
  },
  // held in a dive from just over the tops: into the heaps (the probe's distance to the cloud at
  // the bird goes below 0), and the lift in cloud keeps it from sinking deep
  skim: (log) => {
    const deepest = Math.min(...log.map((r) => r[LOG.cloud] ?? Infinity));
    return [deepest < 0 && deepest > -150, `into the cloud ${(-deepest).toFixed(0)} m deep at most`];
  },
};

async function checkFlight(browser, { fail, note, problems }) {
  const flown = await flyAll(browser, Object.keys(JUDGE));
  for (const [name, { log, problems: own }] of Object.entries(flown)) {
    problems.push(...own);
    if (log.length < 250) {
      fail(`${name}: the flight logged ${log.length} frames of 300`);
      continue;
    }
    if (log.some((r) => r.slice(0, LOG.sea + 1).some((v) => !Number.isFinite(v)))) fail(`${name}: values that are not finite in the flight log`);
    // the hard floor: 170 m under the sea's top
    const deepest = Math.min(...log.map((r) => r[LOG.alt] - r[LOG.sea]));
    if (deepest < -170) fail(`${name}: the bird sank ${(-deepest).toFixed(0)} m into the sea`);
    const [ok, what] = JUDGE[name](log);
    if (!ok) fail(`${name}: ${what}`);
    note(`${name}: ${what}`);
  }
}

// ---------------------------------------------------------------- out of memory

// Makes the next `n` out-of-memory error scopes after the first `skip` report running out, and
// counts them all. What the page's modules make as they load opens the first (src/render/gpu.js,
// closed by main.js before the first frame), each allocation of the size-dependent render targets
// one after it (src/render/targets.js).
const forceOutOfMemory = (n, skip = 0) => {
  const D = GPUDevice.prototype, push = D.pushErrorScope, pop = D.popErrorScope;
  let left = n, fake = 0;
  window.__forced = 0;
  window.__scopes = 0;
  D.pushErrorScope = function (filter) {
    if (filter === 'out-of-memory') {
      window.__scopes++;
      if (skip > 0) skip--;
      else if (left > 0) {
        left--;
        fake++;
        window.__forced++;
      }
    }
    return push.call(this, filter);
  };
  D.popErrorScope = function () {
    const r = pop.call(this);
    if (fake > 0) {
      fake--;
      return r.then(() => new GPUOutOfMemoryError('forced by tools/checks.js'));
    }
    return r;
  };
};

async function checkOutOfMemory(browser, { fail, note, problems }) {
  const state = (page) => page.evaluate(() => ({
    forced: window.__forced,
    scopes: window.__scopes,
    frame: window.__frame ?? 0,
    error: window.__error ?? null,
    note: getComputedStyle(document.getElementById('note')).display,
    on: document.getElementById('view').classList.contains('on'),
    size: window.__debug ? [window.__debug.R.w, window.__debug.R.h] : null,
  }));
  {
    // what never changes, made as the page loads, runs out: the page says so, and draws nothing
    const own = [];
    const { page, done } = await openPage(browser, own, { viewport: { width: 200, height: 120 } });
    try {
      await page.addInitScript(`(${forceOutOfMemory})(1)`);
      await page.goto(pageUrl({ test: '', frames: '3', w: '160', h: '90' }));
      await until(page, () => window.__done || window.__error);
      const s = await state(page);
      if (s.forced !== 1 || s.scopes !== 1) fail(`what never changes: ${s.forced} out-of-memory errors forced of 1, ${s.scopes} allocations (did the allocation change?)`);
      if (!/^Out of GPU memory: the piece needs about \d+ MB/.test(s.error ?? '') || s.note === 'none' || s.on || s.frame) fail(`what never changes: the page doesn't say it ran out of GPU memory, or drew: ${JSON.stringify(s)}`);
      else note(`what never changes: the note says "${s.error}"`);
    } finally {
      await done();
    }
    // (its note is an error on the console, as it should be)
    problems.push(...own.filter((p) => !(p.kind === 'console error' && /Out of GPU memory/.test(p.text))));
  }
  {
    // at start: the first allocation of the targets runs out, and the page retries with fewer pixels
    const { page, done } = await openPage(browser, problems, { viewport: { width: 400, height: 240 } });
    try {
      await page.addInitScript(`(${forceOutOfMemory})(1, 1)`);
      await page.goto(pageUrl({ test: '', frames: '3', w: '1280', h: '720', scale: '0.3' }));
      await until(page, () => window.__done || window.__error);
      const s = await state(page);
      if (s.forced !== 1 || s.scopes < 3) fail(`at start: ${s.forced} out-of-memory errors forced of 1, ${s.scopes} allocations (did the allocation change?)`);
      if (s.error || s.note !== 'none' || !s.on || s.frame < 3) fail(`at start: the page didn't recover: ${JSON.stringify(s)}`);
      if (!(s.size?.[0] * s.size?.[1] < 1280 * 720)) fail(`at start: the page retried at ${s.size?.join('x')}, no smaller than 1280x720`);
      note(`at start: recovered at ${s.size?.join('x')}, frame ${s.frame}`);
    } finally {
      await done();
    }
  }
  {
    // on a resize: twice in a row
    const { page, done } = await openPage(browser, problems, { viewport: { width: 480, height: 270 } });
    try {
      await page.goto(pageUrl({ debug: '' }));
      await until(page, () => window.__frame > 3 || window.__error);
      await page.evaluate(`(${forceOutOfMemory})(2)`);
      await page.setViewportSize({ width: 640, height: 360 });
      const before = (await state(page)).frame;
      await until(page, (f) => window.__frame > f + 12 || window.__error, before);
      const s = await state(page);
      if (s.forced !== 2 || s.scopes < 3) fail(`on a resize: ${s.forced} out-of-memory errors forced of 2, ${s.scopes} allocations (did the allocation change?)`);
      if (s.error || s.note !== 'none' || s.frame <= before + 12) fail(`on a resize: the page didn't recover: ${JSON.stringify(s)}`);
      note(`on a resize: recovered at ${s.size?.join('x')}, frame ${s.frame}`);
    } finally {
      await done();
    }
  }
  {
    // for good: after four in a row the page gives up and says so
    const own = [];
    const { page, done } = await openPage(browser, own, { viewport: { width: 200, height: 120 } });
    try {
      await page.addInitScript(`(${forceOutOfMemory})(4, 1)`);
      await page.goto(pageUrl({ test: '', frames: '12', w: '160', h: '90' }));
      await until(page, () => window.__done || window.__error);
      const s = await state(page);
      if (!/out of GPU memory/.test(s.error ?? '') || s.note === 'none') fail(`for good: the page doesn't say it ran out of GPU memory: ${JSON.stringify(s)}`);
      else note('for good: the note says so');
    } finally {
      await done();
    }
    // (its note is an error on the console, as it should be)
    problems.push(...own.filter((p) => !(p.kind === 'console error' && /out of GPU memory/.test(p.text))));
  }
}

// ---------------------------------------------------------------- the world

// Per clipmap level (and the shadow volume): its window, whether it has settled, and per texel
// column (all slices) the column map's hash and the volume's mean, for comparing two pages.
const readLevels = async () => {
  const D = window.__debug, N = 256;
  const base64 = (array) => {
    const bytes = new Uint8Array(array.buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  };
  const out = {};
  const levels = [['L0', D.LEVELS[0]], ['L1', D.LEVELS[1]], ['L2', D.LEVELS[2]], ['shadow', D.TSVL]];
  // (a clipmap's billows, their scale and liveliness, are a volume of their own)
  for (const [name, L] of [...levels]) if (L.bs) levels.push([name + ' billows', { ...L, vol: L.bs, col: null, second: ' lively' }]);
  for (const [name, L] of levels) {
    const vol = await D.readTexture(L.vol, 0, L.nz); // slice after slice, rows packed, the channels of a texel together
    // (a channel each: the shadow volume's through the cloud a texel is in, and through those beyond;
    // the billows' scale and liveliness)
    const comps = vol.length / (N * N * L.nz), means = Array.from({ length: comps }, () => new Float64Array(N * N));
    for (let k = 0; k < vol.length; k++) means[k % comps][Math.floor(k / comps) % (N * N)] += vol[k] / L.nz;
    let col = null;
    if (L.col) {
      const bits = new Uint32Array((await D.readTexture(L.col)).buffer);
      col = new Uint32Array(N * N).fill(2166136261);
      for (let k = 0; k < bits.length; k++) col[k >> 2] = Math.imul(col[k >> 2] ^ bits[k], 16777619);
    }
    means.forEach((mean, c) => {
      out[name + (c ? L.second ?? ' beyond' : '')] = { gi: L.gi, gj: L.gj, step: L.step, pending: L.pending, valid: L.valid, mean: base64(mean), col: col && base64(col) };
    });
  }
  // (the sun map's levels: each one's window, and per texel column along the sun's way and across
  // it, all heights, the mean of the light it lets through)
  const sun = [];
  for (const [W, t] of [[D.SUNMAPS[0], D.T.sunMap], [D.SUNMAPS[1], D.T.sunMapC]]) {
    const sm = await D.readTexture(t, 0, t.d), mean = new Float64Array(t.w * t.h);
    for (let k = 0; k < sm.length; k++) mean[k % (t.w * t.h)] += sm[k] / t.d;
    sun.push({ K0: W.K0, A0: W.A0, steps: W.steps, valid: W.valid, nw: t.w, na: t.h, mean: base64(mean) });
  }
  const b = D.bird;
  return { pose: [...b.pos, b.yaw, b.gamma, b.bank], levels: out, sun };
};

// Most a level's volume may differ between the flown and the fresh page, as the mean over a texel
// column: the clipmap levels hold the same (half-float rounding aside; their billow scales, up to
// 2000 m, round to a metre, their liveliness, 0..1, to a thousandth); the shadow volume is
// marched through them as they were when it was baked (its channels: through the cloud a texel is
// in, up to 30, and through the clouds beyond, up to 14). The first flips where the edge of L1's
// window crosses a texel's march (L1 and L2 disagree there whether the march is still in its cloud):
// up to ~11 at texels by that edge, 65 km out.
const VOLUME_TOLERANCE = { L0: 0.5, L1: 0.5, L2: 0.5, 'L0 billows': 2, 'L1 billows': 2, 'L2 billows': 2, 'L0 billows lively': 0.01, 'L1 billows lively': 0.01, 'L2 billows lively': 0.01, shadow: 15, 'shadow beyond': 10 };

async function checkStreaming(browser, { fail, note, problems, outDir }) {
  // 2 minutes of flight from the start (about 8 km, every level shifting at least once), then a
  // fresh start at the exact pose the flight ended at. Where both windows overlap (but for their
  // edges, never sampled) the column maps must be the same bit for bit and the volumes the same,
  // the sun map too: what entered was generated and baked where it belongs, and nothing stale
  // stayed behind.
  const size = { w: '320', h: '180', scale: '0.5' };
  const flown = await testRender(browser, { ...size, preset: 'start', frames: '480', dt: '0.25' }, { timeoutMs: 1_800_000, read: readLevels });
  problems.push(...flown.problems);
  if (!flown.png || !flown.read) return fail('the flight rendered no image');
  const fresh = await testRender(browser, { ...size, frames: '12', pose: flown.read.pose.join(',') }, { read: readLevels });
  problems.push(...fresh.problems);
  if (!fresh.png || !fresh.read) return fail('the fresh start rendered no image');
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'streaming-flown.png'), flown.png);
    writeFileSync(join(outDir, 'streaming-fresh.png'), fresh.png);
  }
  const lines = [];
  for (const [name, a] of Object.entries(flown.read.levels)) {
    const b = fresh.read.levels[name];
    const r = compareLevels(a, b);
    if (a.pending || b.pending || !a.valid) fail(`${name}: not settled after the flight (${a.pending} jobs pending)`);
    if (Math.abs(a.gi - b.gi) > a.step || Math.abs(a.gj - b.gj) > a.step) {
      fail(`${name}: its window stayed at cell ${a.gi}, ${a.gj}; a fresh start there centres it at ${b.gi}, ${b.gj}`);
      continue;
    }
    if (r.columnsDiffer) fail(`${name}: ${r.columnsDiffer} of ${r.compared} texel columns of the column map differ from a fresh start's`);
    if (!(r.volumeMax <= VOLUME_TOLERANCE[name])) fail(`${name}: the volume differs from a fresh start's by up to ${r.volumeMax.toFixed(2)} (mean over a texel column) at cell ${r.worst.join(', ')}`);
    lines.push(`${name} ${r.volumeMax.toFixed(2)}`);
  }
  // (each level of the sun map, where both are valid: the same light, but where the march past its
  // window starts elsewhere, through coarser cloud)
  flown.read.sun.forEach((sa, k) => {
    const sb = fresh.read.sun[k], name = ['sun map', 'sun map coarse'][k];
    if (!sa.valid || !sb.valid) fail(`${name}: not baked after the flight`);
    else if (Math.abs(sa.K0 - sb.K0) > sa.steps[0] + 2 || Math.abs(sa.A0 - sb.A0) > sa.steps[1] + 2) {
      fail(`${name}: its window stayed at texel ${sa.K0}, ${sa.A0}; a fresh start there places it at ${sb.K0}, ${sb.A0}`);
    } else {
      const r = compareSunMaps(sa, sb);
      if (!(r.max <= SUN_TOLERANCE[k])) fail(`${name}: the light differs from a fresh start's by up to ${r.max.toFixed(3)} (mean over a texel column) at texel ${r.worst.join(', ')}`);
      lines.push(`${name} ${r.max.toFixed(3)} (${r.compared} columns)`);
    }
  });
  const d = difference(decodePng(flown.png), decodePng(fresh.png));
  note(`flown to ${flown.read.pose.slice(0, 3).map((v) => (v / 1000).toFixed(1)).join(', ')} km; volumes differ from a fresh start's by at most: ${lines.join(', ')}`);
  note(`images: mean ${d.mean.toFixed(2)} levels, ${(100 * d.over16).toFixed(1)}% of pixels more than 16 levels off (a flown page has 480 frames of history behind it, a fresh one 12)`);
  if (d.mean > 8 || d.over16 > 0.12) fail(`the streamed world looks different from a fresh start: mean ${d.mean.toFixed(2)}, ${(100 * d.over16).toFixed(1)}% more than 16 levels off`);
}

// Two pages' sun maps (readLevels().sun) where both are valid as the lookups read them (a texel in
// from the window's edge away from the sun, three toward it, two across: render/sungrid.js,
// lookupUniforms): { compared, max, worst }. Texel (K mod nw, A mod na) holds world texel K along
// the sun's way, A across.
// Most each level's may differ (the mean light over a texel column, 0..1): where its window ends
// the march past it takes over from the window's stretches (points 200 m apart against steps of
// 80 m), and from the coarse level's, 49 km toward the sun, it crosses L1's edge within ~15 km: a
// window that ends elsewhere sees a little other light there. After 8 km of flight the fine level's
// differ by up to ~0.007, the coarse level's by ~0.045 (p99 0.018).
const SUN_TOLERANCE = [0.05, 0.08];
export function compareSunMaps(a, b) {
  const [ma, mb] = [a.mean, b.mean].map((s) => new Float64Array(Uint8Array.from(Buffer.from(s, 'base64')).buffer));
  const mod = (x, n) => ((x % n) + n) % n;
  let compared = 0, max = 0, worst = null;
  for (let K = Math.max(a.valid[0], b.valid[0]) + 1; K < Math.min(a.valid[1], b.valid[1]) - 3; K++) {
    for (let A = Math.max(a.valid[2], b.valid[2]) + 2; A < Math.min(a.valid[3], b.valid[3]) - 2; A++) {
      const p = mod(A, a.na) * a.nw + mod(K, a.nw), d = Math.abs(ma[p] - mb[p]);
      compared++;
      if (d > max) [max, worst] = [d, [K, A]];
    }
  }
  return { compared, max, worst };
}

// Two pages' readLevels() of one level, over where both windows overlap but for their edges:
// { compared, columnsDiffer, volumeMax, worst }. Texel (i & 255, j & 255) holds world cell (i, j).
export function compareLevels(a, b) {
  const decode = (s, Type) => (s ? new Type(Uint8Array.from(Buffer.from(s, 'base64')).buffer) : null);
  const [ca, cb] = [a.col, b.col].map((s) => decode(s, Uint32Array));
  const [ma, mb] = [a.mean, b.mean].map((s) => decode(s, Float64Array));
  const i0 = Math.max(a.gi, b.gi) + 1, i1 = Math.min(a.gi, b.gi) + 255;
  const j0 = Math.max(a.gj, b.gj) + 1, j1 = Math.min(a.gj, b.gj) + 255;
  let compared = 0, columnsDiffer = 0, volumeMax = 0, worst = null;
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const p = (j & 255) * 256 + (i & 255);
      compared++;
      if (ca && ca[p] !== cb[p]) columnsDiffer++;
      const d = Math.abs(ma[p] - mb[p]);
      if (d > volumeMax) [volumeMax, worst] = [d, [i, j]];
    }
  }
  return { compared, columnsDiffer, volumeMax, worst };
}

// Mean channel difference (0..255) of two images, and the share of pixels off by more than 16.
export function difference(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('images of different sizes');
  let sum = 0, over16 = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let max = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a.data[i + c] - b.data[i + c]);
      sum += d;
      max = Math.max(max, d);
    }
    if (max > 16) over16++;
  }
  const n = a.width * a.height;
  return { mean: sum / (3 * n), over16: over16 / n };
}

// The flight asks for the sea's surface under the bird every frame, answered from a patch of domes
// the world's worker sends (src/core/world.js), the next asked for 6 km before the bird reaches the
// edge of the one it has, behind whatever the volumes asked for before it. Here the page runs as a
// visitor's does (its worker answering in its own time), the bird held at its top speed (the glider
// can't keep it there level: its speed set past it each frame, the flight clamps it) for
// TOP_SPEED_S, about 18 km, two patches on: each must come before the bird reaches the edge of the
// last, or the page grows the world's cells itself (a stall).
const TOP_SPEED_S = 100;
async function checkTopSpeed(browser, { fail, note, problems }) {
  const { page, done } = await openPage(browser, problems, { viewport: { width: 320, height: 180 } });
  try {
    await page.goto(pageUrl({}));
    await until(page, () => window.__frame > 2 || window.__error);
    await page.evaluate(() => {
      const { bird, input } = window.__debug;
      input.script = () => [0, 0];
      // (frame times from a second on: the first frames still warm up)
      const start = [...bird.pos], frames = [], from = performance.now() + 1000;
      let last = 0;
      const hold = (now) => { bird.speed = 1000; if (last > from) frames.push(now - last); last = now; requestAnimationFrame(hold); };
      requestAnimationFrame(hold);
      window.__topSpeed = { start, frames };
    });
    await until(page, (s) => performance.now() > s || window.__error, await page.evaluate((s) => performance.now() + s * 1000, TOP_SPEED_S), { pollMs: 1000 });
    const s = await page.evaluate(() => {
      const { bird, patchStats } = window.__debug, { start, frames } = window.__topSpeed;
      return { error: window.__error ?? null, patch: { ...patchStats }, km: Math.hypot(bird.pos[0] - start[0], bird.pos[2] - start[2]) / 1000,
        frames: frames.length, slow: frames.filter((ms) => ms > 50).length, longest: Math.max(...frames) };
    });
    if (s.error) return fail(`the page's note says: ${s.error}`);
    const p = s.patch;
    if (p.asked < 3) fail(`${p.asked} patches asked for over ${s.km.toFixed(1)} km: the bird didn't fly far enough to need two more`);
    if (p.grown) fail(`the page grew the world's cells itself ${p.grown} times (${p.grownMs.toFixed(0)} ms): a patch came too late (the longest took ${(p.maxWait / 1000).toFixed(1)} s)`);
    note(`${s.km.toFixed(1)} km in ${TOP_SPEED_S} s, ${p.asked} patches, the longest ${(p.maxWait / 1000).toFixed(1)} s to come (asked for ${(p.edge / 1000 / (s.km / TOP_SPEED_S)).toFixed(0)} s before the edge), the bird ${(p.minLead / 1000).toFixed(1)} km from an edge at the nearest; frames over 50 ms ${s.slow} of ${s.frames} (the longest ${s.longest.toFixed(0)} ms)`);
  } finally {
    await done();
  }
}

async function checkVolumes(browser, { fail, note, problems }) {
  const { page, done } = await openPage(browser, problems, { viewport: { width: 200, height: 120 } });
  try {
    await page.goto(pageUrl({ test: '', frames: '2', w: '160', h: '90' }));
    await until(page, () => window.__done || window.__error);
    const res = await page.evaluate(async () => {
      const D = window.__debug, N = 256, out = {};
      for (const [name, L] of [['L0', D.LEVELS[0]], ['L1', D.LEVELS[1]], ['L2', D.LEVELS[2]], ['shadow', D.TSVL]]) {
        const v = await D.readTexture(L.vol, 0, L.nz); // the channels of each texel, slice after slice
        const top = (L.nz - 1) * (v.length / L.nz);
        let nan = 0, topNeg = 0;
        for (let k = 0; k < v.length; k++) {
          if (!Number.isFinite(v[k])) nan++;
          else if (v[k] < 0 && k >= top) topNeg++;
        }
        out[name] = { nan, topNeg };
      }
      // (the sun map's levels: the light that gets through other clouds, 0..1)
      for (const [name, W, t] of [['sun map', D.SUNMAPS[0], D.T.sunMap], ['sun map coarse', D.SUNMAPS[1], D.T.sunMapC]]) {
        const sm = await D.readTexture(t, 0, t.d);
        out[name] = { nan: sm.filter((x) => !Number.isFinite(x)).length, outside: sm.filter((x) => x < 0 || x > 1).length, baked: !!W.valid };
      }
      for (const [name, L] of [['L0', D.LEVELS[0]], ['L1', D.LEVELS[1]], ['L2', D.LEVELS[2]]]) {
        const c = await D.readTexture(L.col);
        let bad = 0, sunk = 0, lowest = Infinity;
        for (let p = 0; p < N * N; p++) {
          for (let k = 0; k < 4; k++) if (!Number.isFinite(c[p * 4 + k])) bad++;
          if (c[p * 4] < c[p * 4 + 3] - 1) sunk++; // (half floats)
          lowest = Math.min(lowest, c[p * 4]);
        }
        out[name].columns = { bad, sunk, lowest };
      }
      return out;
    });
    for (const [name, r] of Object.entries(res)) {
      if (r.nan) fail(`${name}: ${r.nan} texels that are not finite`);
      if (r.topNeg) fail(`${name}: cloud in ${r.topNeg} texels of the volume's top slice (cut off at its ceiling)`);
      if (r.columns?.bad) fail(`${name}: ${r.columns.bad} column values that are not finite`);
      if (r.outside) fail(`${name}: ${r.outside} texels outside 0..1`);
      if (r.baked === false) fail(`${name}: not baked after the first frame`);
      if (r.columns?.sunk) fail(`${name}: in ${r.columns.sunk} columns the heaps lower the sea instead of raising it`);
    }
    note(`sea surface from ${Math.min(res.L0.columns.lowest, res.L1.columns.lowest, res.L2.columns.lowest).toFixed(0)} m; no NaNs, nothing at a ceiling`);
  } finally {
    await done();
  }
}

// ---------------------------------------------------------------- captures, the benchmark, errors

// What the compares and the measurements rely on (tools/screenshot.js): the same capture twice
// is the same image, and the still of a capture that hands over more frames (?keep, ?every) is
// the still of one that doesn't.
async function checkReproducible(browser, { fail, note, problems }) {
  const params = { w: '320', h: '180', frames: '8', preset: 'tower' };
  const renders = await Promise.all([params, params, { ...params, keep: '3', every: '2' }].map((p) => testRender(browser, p)));
  for (const r of renders) problems.push(...r.problems);
  if (renders.some((r) => !r.png)) return fail('a render gave no image');
  const [a, b, kept] = renders.map((r) => r.png);
  if (!a.equals(b)) fail(`two captures of the same view differ: mean ${difference(decodePng(a), decodePng(b)).mean.toFixed(3)} levels`);
  if (!a.equals(kept)) fail(`handing over more frames changed the still: mean ${difference(decodePng(a), decodePng(kept)).mean.toFixed(3)} levels`);
  note('the tower view, 3 times: identical');
}

async function checkBenchmark(browser, { fail, note, problems, outDir }) {
  const { page, done } = await openPage(browser, problems, { viewport: { width: 320, height: 180 } });
  try {
    // (whether the hint ever showed: by the end it would be gone again)
    await page.addInitScript(() => {
      window.__hintShown = false;
      addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('hint');
        new MutationObserver(() => { if (el.classList.contains('on')) window.__hintShown = true; }).observe(el, { attributes: true, attributeFilter: ['class'] });
      });
    });
    await page.goto(pageUrl({ bench: '', benchSeconds: '1', benchWarmup: '0.5' }));
    await until(page, () => window.__BENCH__?.done || window.__error);
    const s = await page.evaluate(() => ({
      error: window.__error ?? null,
      summary: window.__BENCH__?.summary ?? '',
      legs: (window.__BENCH__?.legs ?? []).map((l) => ({ name: l.name, frames: l.frameMs.length })),
      panel: !document.getElementById('bench').hidden,
      copy: !document.querySelector('#bench button').hidden,
      hint: window.__hintShown || document.getElementById('hint').classList.contains('on'),
      steered: window.__debug.input.script !== null,
    }));
    if (s.error) return fail(`the page's note says: ${s.error}`);
    if (outDir && s.summary) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'benchmark.txt'), `${s.summary}\n`);
    }
    if (!s.legs.length) fail('no legs measured');
    for (const leg of s.legs) {
      if (!leg.frames) fail(`the leg "${leg.name}" measured no frames`);
      if (!new RegExp(`^${leg.name} +\\d`, 'm').test(s.summary)) fail(`the summary has no row for the leg "${leg.name}"`);
    }
    for (const line of ['build', 'gpu', 'browser', 'screen', 'memory', 'measured', 'gpu timer', 'bakes', 'all legs']) {
      if (!new RegExp(`^${line} +\\S`, 'm').test(s.summary)) fail(`the summary has no "${line}" line`);
    }
    if (!s.panel || !s.copy) fail('the summary panel or its copy button is hidden');
    if (s.hint) fail('the steering hint showed during the benchmark');
    if (s.steered) fail('the route still steers after the benchmark ended');
    note(`legs: ${s.legs.map((l) => `${l.name} ${l.frames} frames`).join(', ')}${outDir ? ' (benchmark.txt)' : ''}`);
  } finally {
    await done();
  }
}

// Errors that leave nothing wrong on screen must still fail a capture or a check: a WebGPU
// validation error and a lost device, caused here on purpose. Those problems are expected; anything
// else fails the check, as does missing one of them.
async function checkErrors(browser, { fail, note, problems }) {
  const own = [];
  const { page, done } = await openPage(browser, own, { viewport: { width: 200, height: 120 } });
  try {
    await page.goto(pageUrl({ test: '', w: '64', h: '36', frames: '100000' }));
    await until(page, () => window.__frame > 2 || window.__error);
    await page.evaluate(async () => {
      const { device } = window.__debug;
      // (the error arrives on its own, later under load: before the device is lost)
      const heard = new Promise((resolve) => device.addEventListener('uncapturederror', resolve, { once: true }));
      device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.MAP_WRITE }); // not allowed together
      await Promise.race([heard, new Promise((resolve) => setTimeout(resolve, 10000))]);
      device.destroy();
      await device.lost;
    });
  } finally {
    await done();
  }
  const expected = [
    ['a validation error', (p) => p.kind === 'webgpu error' && /MAP_WRITE|MapWrite|usage/i.test(p.text)],
    ['a lost device', (p) => p.kind === 'device lost'],
  ];
  const seen = new Set();
  for (const p of own) {
    const matches = expected.filter(([, test]) => test(p));
    for (const [what] of matches) seen.add(what);
    if (!matches.length) problems.push(p);
  }
  const missed = expected.map(([what]) => what).filter((what) => !seen.has(what));
  if (missed.length) fail(`nothing reported ${missed.join(', ')}`);
  else note(`heard ${[...seen].join(' and ')}`);
}

// ---------------------------------------------------------------- main

const invokedPath = process.argv[1] && existsSync(process.argv[1]) ? realpathSync.native(process.argv[1]) : null;
if (invokedPath === realpathSync.native(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const gl = args.includes('--gl') ? args.splice(args.indexOf('--gl'), 2)[1] : 'auto';
  try {
    assertFreshBuild();
    const { browser, kind, gl: adapter } = await launch(gl, (m) => console.log(`checks: ${m}`));
    console.log(`checks: WebGPU adapter = ${kind} (${adapter}), Chromium ${browser.version()}`);
    try {
      const results = await runChecks(browser, { names: args, outDir: join(ROOT, 'screenshots', 'checks') });
      process.exitCode = results.some((r) => r.problems.length) ? 1 : 0;
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error(`\nchecks: ${err.message}`);
    process.exitCode = 1;
  }
}
