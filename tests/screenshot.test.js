// The tools' logic that needs no browser: the screenshot tool's arguments, plans, labels and compares
// (tools/screenshot.js, labels.js, views.js), why a page stopped (browser.js), the flight logs'
// compare (flights.js), the streaming check's (checks.js) and the cost tool's runs (cost.js)

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffSummary, gpuChanges, mismatchWarnings, parseArgs, planCapture, removeCapture, viewParams } from '../tools/screenshot.js';
import { labelFolder } from '../tools/labels.js';
import { compareLevels, difference } from '../tools/checks.js';
import { whyStopped } from '../tools/browser.js';
import { describeDifference, parseArgs as flightArgs } from '../tools/flights.js';
import { describeRows, parseArgs as costArgs, runOrder, summarize } from '../tools/cost.js';
import { VIEWS } from '../tools/views.js';

test('arguments: options with or without "=", flags, and the compare pair', () => {
  assert.deepEqual(parseArgs(['--views', 'start,tower', '--size=320x180', '--checks']), { views: 'start,tower', size: '320x180', checks: true });
  assert.deepEqual(parseArgs(['--compare', 'before', 'after']), { compare: ['before', 'after'] });
  assert.deepEqual(parseArgs(['--compare', 'before', 'after', '--views', 'sun']), { compare: ['before', 'after'], views: 'sun' });
  assert.deepEqual(parseArgs(['--no-measurements']), { 'no-measurements': true });
  assert.throws(() => parseArgs(['--compare', 'before']), /usage: --compare/);
  assert.throws(() => parseArgs(['--bogus', '1']), /unknown option --bogus/);
  assert.throws(() => parseArgs(['--label']), /--label needs a value/);
  assert.throws(() => parseArgs(['--checks=yes']), /takes no value/);
  assert.throws(() => parseArgs(['start']), /unexpected argument/);
});

test('a capture plan names its views, size and parameters, and refuses what the page would not take', () => {
  const plan = planCapture({ views: 'tower, start', size: '320x180', frames: '8', label: 'x' });
  assert.deepEqual(plan.views.map((v) => v.name), ['tower', 'start']);
  assert.equal(planCapture({ label: 'x' }).views.length, VIEWS.length);
  assert.deepEqual([plan.width, plan.height, plan.frames], [320, 180, '8']);
  assert.throws(() => planCapture({ views: 'nowhere', label: 'x' }), /unknown view "nowhere"/);
  assert.throws(() => planCapture({ size: '320', label: 'x' }), /--size/);
  assert.throws(() => planCapture({ frames: '0', label: 'x' }), /--frames/);
  assert.throws(() => planCapture({ scale: '2', label: 'x' }), /--scale/);
  assert.throws(() => planCapture({ seed: 'seven', label: 'x' }), /--seed/);
  assert.throws(() => planCapture({ query: 'w=10', label: 'x' }), /--query can't set w: use --size/);
  assert.throws(() => planCapture({ query: 'test', label: 'x' }), /--query can't set test/);
  for (const key of ['keep', 'every', 'freeze', 'dt']) assert.throws(() => planCapture({ query: `${key}=1`, label: 'x' }), /the measurements use it/, key);
  assert.equal(planCapture({ label: 'x' }).measure, true);
  assert.equal(planCapture({ 'no-measurements': true, label: 'x' }).measure, false);
});

test("a view's parameters: the capture's size and frames, the view's own, then --seed, --query and --profile", () => {
  const plan = planCapture({ size: '320x180', seed: '3', query: 'dbg=4&exp=16', profile: true, label: 'x' });
  assert.deepEqual(viewParams(plan, { params: { preset: 'side', dbg: '1' } }), {
    w: '320', h: '180', frames: '12', scale: '0.5', preset: 'side', dbg: '4', seed: '3', exp: '16', cpuprof: '',
  });
});

test('every view has a unique name, parameters and a brief', () => {
  assert.equal(new Set(VIEWS.map((v) => v.name)).size, VIEWS.length);
  for (const v of VIEWS) {
    assert.equal(labelFolder(v.name), v.name);
    assert.equal(typeof v.params, 'object', v.name);
    assert.ok(v.brief.length > 20, v.name);
    for (const [name, [x, y, w, h]] of Object.entries(v.crops ?? {})) {
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1, `${v.name}: the crop ${name} lies in the frame`);
    }
  }
});

test("a label names a folder of its own in screenshots/, never a tool's or none", () => {
  assert.equal(labelFolder('before'), 'before');
  assert.equal(labelFolder('round 10: after!'), 'round-10-after-');
  assert.equal(labelFolder('v1.2...'), 'v1.2');
  for (const label of ['', '.', '..', '---']) assert.throws(() => labelFolder(label), /needs a letter or a digit/, label);
  for (const label of ['compare', 'World', 'CHECKS', 'flights']) assert.throws(() => labelFolder(label), /is taken/, label);
});

test('removing a capture deletes only a capture folder right inside screenshots/', (t) => {
  const shots = mkdtempSync(join(tmpdir(), 'flying-shots-'));
  t.after(() => rmSync(shots, { recursive: true, force: true }));
  for (const name of ['before', 'compare', 'nested/deeper']) mkdirSync(join(shots, name), { recursive: true });
  removeCapture(join(shots, 'before'), shots);
  assert.equal(existsSync(join(shots, 'before')), false);
  assert.throws(() => removeCapture(join(shots, 'compare'), shots), /refusing to delete/);
  assert.throws(() => removeCapture(join(shots, 'nested', 'deeper'), shots), /refusing to delete/);
  assert.throws(() => removeCapture(shots, shots), /refusing to delete/);
  assert.throws(() => removeCapture(join(shots, '..'), shots), /refusing to delete/);
  assert.ok(existsSync(join(shots, 'compare')) && existsSync(join(shots, 'nested', 'deeper')));
});

test('a compare says "identical" only for no change at all, and never rounds a change to 0%', () => {
  assert.equal(diffSummary({ changed: 0, large: 0, max: 0, total: 100 }), 'identical');
  assert.match(diffSummary({ changed: 1, large: 0, max: 1, total: 1e7 }), /^0\.000010% \(1 px\) of pixels differ, 0\.00% \(0 px\) by more than 2 levels \(max channel delta 1\)$/);
  assert.match(diffSummary({ changed: 50, large: 10, max: 30, total: 100 }), /^50\.00% \(50 px\).*10\.00% \(10 px\)/);
});

test('per-pass GPU times: changes with their share, nothing when either side has none', () => {
  assert.deepEqual(gpuChanges({ trace: 10, sky: 1 }, { trace: 12, sky: 1 }), ['trace 10 → 12 (+20%)']);
  assert.deepEqual(gpuChanges({ trace: 10 }, { trace: 5 }), ['trace 10 → 5 (-50%)']);
  assert.deepEqual(gpuChanges(null, { trace: 5 }), []);
});

test('the image difference the streaming check judges by', () => {
  const image = (rgb) => ({ width: 2, height: 1, data: Uint8Array.from([...rgb.slice(0, 3), 255, ...rgb.slice(3), 255]) });
  assert.deepEqual(difference(image([0, 0, 0, 10, 10, 10]), image([0, 0, 0, 10, 10, 10])), { mean: 0, over16: 0 });
  assert.deepEqual(difference(image([0, 0, 0, 0, 0, 0]), image([0, 0, 30, 6, 6, 6])), { mean: 8, over16: 0.5 });
  assert.throws(() => difference(image([0, 0, 0, 0, 0, 0]), { width: 1, height: 1, data: new Uint8Array(4) }), /different sizes/);
});

test('a compare warns when the captures were made differently, a seed left out being the default', () => {
  const side = (info) => ({ info: { gl: 'gpu', browser: '159', size: [640, 360], frames: '12', scale: '0.5', extra: {}, measured: false, ...info } });
  assert.deepEqual(mismatchWarnings([side({}), side({ seed: null })]), []);
  assert.deepEqual(mismatchWarnings([side({ seed: '3' }), side({})]), ['different seed: "3" vs null']);
  assert.match(mismatchWarnings([side({}), side({ size: [320, 180] })])[0], /^different size/);
  assert.deepEqual(mismatchWarnings([{ info: null }, side({})]), ['info.json missing on one side; cannot check capture settings']);
});

test('why waiting on a page failed: a crash, the watchdog, a stall, anything else', () => {
  const err = new Error(['Target page, context or browser has been closed', 'Call log: ...'].join('\n'));
  assert.deepEqual(whyStopped(err, { crashed: true, fired: true, timeoutMs: 1000 }), { kind: 'page crash', text: 'the page crashed' });
  assert.deepEqual(whyStopped(err, { crashed: false, fired: true, timeoutMs: 90_000 }), { kind: 'timeout', text: 'not done within 90 s' });
  assert.deepEqual(whyStopped(Object.assign(new Error('no frame drawn for 300 s'), { stalled: true }), {}), { kind: 'timeout', text: 'no frame drawn for 300 s' });
  assert.deepEqual(whyStopped(err, {}), { kind: 'tool error', text: 'Target page, context or browser has been closed' });
});

test('flight logs: identical, or where they part and how far', () => {
  const row = (t, alt, speed, bank) => [t, 0, alt, 0, speed, bank, 0, 0, 900, 50, 0, 47];
  const a = [row(0, 1600, 60, 0), row(0.05, 1601, 60, 1)];
  assert.equal(describeDifference(a, a.map((r) => [...r])), 'identical');
  assert.equal(describeDifference(a, [a[0], row(0.05, 1603, 60.5, 3)]), 'differ from frame 1 (t = 0.05 s): up to 2.0 m in height, 0.50 m/s, 2.0° of bank');
  assert.match(describeDifference(a, a.slice(0, 1)), /^differ from frame 1 .*; 2 vs 1 frames$/);
  assert.equal(describeDifference(a, undefined), 'recorded on one side only');
  assert.deepEqual(flightArgs(['--compare', 'a', 'b']), { compare: ['a', 'b'] });
  assert.throws(() => flightArgs(['--bogus']), /unexpected argument/);
});

test('streamed levels are compared where both windows overlap, by world cell, without their edges', () => {
  // two windows 8 cells apart; texel (i & 255, j & 255) holds world cell (i, j)
  const level = (gi, gj, value) => {
    const mean = new Float64Array(256 * 256), col = new Uint32Array(256 * 256);
    for (let j = gj; j < gj + 256; j++) for (let i = gi; i < gi + 256; i++) {
      mean[(j & 255) * 256 + (i & 255)] = value(i, j);
      col[(j & 255) * 256 + (i & 255)] = (i * 7919 + j) >>> 0;
    }
    const b64 = (array) => Buffer.from(array.buffer).toString('base64');
    return { gi, gj, mean: b64(mean), col: b64(col) };
  };
  const world = (i, j) => Math.sin(i) + j;
  const same = compareLevels(level(-128, -128, world), level(-120, -128, world));
  assert.deepEqual([same.compared, same.columnsDiffer, same.volumeMax], [246 * 254, 0, 0]);
  // a stale line inside the overlap is found; one on a window's edge is never sampled, so not compared
  const stale = compareLevels(level(-128, -128, (i, j) => world(i, j) + (i === 0 ? 50 : 0)), level(-120, -128, world));
  assert.deepEqual([stale.volumeMax, stale.worst[0]], [50, 0]);
  const edge = compareLevels(level(-128, -128, (i, j) => world(i, j) + (i === -120 ? 50 : 0)), level(-120, -128, world));
  assert.equal(edge.volumeMax, 0);
});


test('the cost tool: its arguments, its runs in turn, and what it makes of them', () => {
  const a = costArgs(['--views', 'tower, start', '--rounds=2', '--frames', '50', '--against', 'HEAD~1']);
  assert.deepEqual(a.views.map((v) => v.name), ['tower', 'start']);
  assert.deepEqual([a.rounds, a.frames, a.against, a.width, a.height, a.scale], [2, 50, 'HEAD~1', 960, 540, 0.5]);
  assert.equal(costArgs([]).views.length, 6);
  assert.throws(() => costArgs(['--rounds', '0']), /--rounds/);
  assert.throws(() => costArgs(['--size', '960']), /--size/);
  assert.throws(() => costArgs(['--views', 'nowhere']), /unknown view/);
  assert.throws(() => costArgs(['--bogus', '1']), /unknown option --bogus/);
  assert.throws(() => costArgs(['--against']), /--against needs a value/);
  assert.throws(() => costArgs(['HEAD']), /unexpected argument/);
  // (A B B A A B: each side first as often as second)
  assert.deepEqual(runOrder(3), ['A', 'B', 'B', 'A', 'A', 'B']);
  assert.deepEqual(runOrder(2), ['A', 'B', 'B', 'A']);
  const rows = summarize([
    { side: 'A', gpu: { start: { trace: 100, post: 0.2 } } }, { side: 'B', gpu: { start: { trace: 110, post: 0.2 } } },
    { side: 'B', gpu: { start: { trace: 130, post: 0.2 } } }, { side: 'A', gpu: { start: { trace: 100, post: 0.2 } } },
  ]);
  const t = rows.find((r) => r.pass === 'trace');
  assert.deepEqual([t.meanA, t.meanB, t.spreadA], [100, 120, 0]);
  assert.ok(Math.abs(t.change - 0.2) < 1e-12 && Math.abs(t.spreadB - 10 / 120) < 1e-12);
  // (a pass too small to matter is left out of the table, the trace's change summed up after it)
  const lines = describeRows(rows);
  assert.match(lines[0], /trace 100\.0 → 120\.0 \+20% \(±0\/8%\)/);
  assert.doesNotMatch(lines[0], /post/);
  assert.match(lines.at(-1), /the trace: start \+20%/);
});
