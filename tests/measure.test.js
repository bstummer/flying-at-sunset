// The measurements of a captured view (tools/measure.js): limits and warnings, how they print and
// change, the frames the page must hand over, and what they write into a view's folder

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLimits, describeMeasurements, describeWarning, grainParams, LIMITS, measurementChanges, measureView, MEASURE, motionParams, shimmerParams } from '../tools/measure.js';
import { createImage } from '../tools/image.js';
import { decodePng } from '../tools/png.js';

// A frame of `width` x `height` whose grey value at each pixel is f(x, y).
function frame(width, height, f) {
  const image = createImage(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) image.data.fill(Math.round(f(x, y)), 4 * (y * width + x), 4 * (y * width + x) + 3);
  return image;
}

test('limits: a measurement above its limit warns, at or under it not, and a null limit judges nothing', () => {
  assert.deepEqual(checkLimits({ bandedPercent: 0.2, shimmerPercent: 0.5 }), []);
  assert.deepEqual(checkLimits({ bandedPercent: 3, shimmerPercent: 0.6 }), [
    { metric: 'bandedPercent', value: 3, limit: LIMITS.bandedPercent },
    { metric: 'shimmerPercent', value: 0.6, limit: LIMITS.shimmerPercent },
  ]);
  assert.deepEqual(checkLimits({ bandedPercent: 0, shimmerPercent: 9 }, { ...LIMITS, shimmerPercent: null }), []);
  assert.match(describeWarning({ metric: 'shimmerPercent', value: 0.6, limit: 0.5 }), /^shimmer 0\.6% is above its limit of 0\.5%$/);
});

test('the measurements as the tools print them, and how they changed', () => {
  assert.equal(describeMeasurements({ bandedPercent: 0, shimmerPercent: 0.25 }), 'banded 0% · shimmer 0.25%');
  assert.equal(describeMeasurements(null), '');
  assert.deepEqual(measurementChanges({ bandedPercent: 0, shimmerPercent: 0.25 }, { bandedPercent: 0, shimmerPercent: 0.4 }), ['shimmer 0.25% → 0.4%']);
  assert.deepEqual(measurementChanges(null, { bandedPercent: 1 }), []);
  const grain = (g, sky) => ({ bandedPercent: 0, shimmerPercent: 0.1, grainPercent: g, grain: { sky } });
  assert.equal(describeMeasurements(grain(2, 0.5)), 'banded 0% · shimmer 0.1% · grain 2% · grain sky 0.5%');
  assert.deepEqual(measurementChanges(grain(2, 0.5), grain(1, 0.5)), ['grain 2% → 1%']);
  assert.deepEqual(measurementChanges(grain(2, 0.5), grain(2, 0)), ['grain sky 0.5% → 0%']);
  assert.deepEqual(measurementChanges({ bandedPercent: 0, shimmerPercent: 0.1 }, grain(2, 0)), [], 'nothing to compare a new measurement with');
});

test('the page hands over the frames the measurements need: the strip from the still on, and frames held still', () => {
  assert.deepEqual(motionParams(), { keep: String(MEASURE.motion.frames), every: String(MEASURE.motion.every) });
  assert.deepEqual(shimmerParams(), { freeze: '', dt: '0', keep: String(MEASURE.shimmer.frames) });
  assert.deepEqual(grainParams(), { ...motionParams(), jit: String(MEASURE.grain.jit) }, 'the strip again, its jitter started elsewhere');
});

test('the grain: where the strip and the strip rendered with other jitter differ, over its frames, the frame and each crop', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'flying-measure-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const [w, h] = [40, 20];
  const still = frame(w, h, () => 100);
  const other = frame(w, h, (x, y) => 100 + (x < w / 4 && y < h / 2 ? MEASURE.grain.threshold : 0));
  const { measurements, files } = measureView({ motion: [still, still], still: [still, still], grain: [other, still], crops: { corner: [0, 0, 0.25, 0.5], rest: [0.5, 0.5, 0.5, 0.5] }, dir });
  assert.equal(measurements.grainPercent, 6.25, 'an eighth of the frame in one pair of two');
  assert.deepEqual(measurements.grain, { corner: 50, rest: 0 });
  assert.ok(files.includes('grain.png'));
  const none = measureView({ motion: [still], still: [still, still], dir });
  assert.equal(none.measurements.grainPercent, undefined, 'not measured without the other render');
});

test('a view is measured from its frames into its folder: a banded still, flicker where frames held still differ', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'flying-measure-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const [w, h] = [64, 48];
  // an undithered slow gradient: all bands; and frames held still, one quarter of them flickering
  const still = frame(w, h, (x) => 100 + Math.floor(x / 16));
  const held = [0, 1, 2].map((k) => frame(w, h, (x, y) => 100 + (x < w / 2 && y < h / 2 ? 10 * (k % 2) : 0)));
  const motion = [still, frame(w, h, () => 120)];
  const { measurements, warnings, files } = measureView({ motion, still: held, crops: { corner: [0, 0, 0.5, 0.25] }, dir });
  assert.ok(measurements.bandedPercent > 90, `banded ${measurements.bandedPercent}`);
  assert.equal(measurements.shimmerPercent, 25);
  assert.deepEqual(warnings.map((x) => x.metric), ['bandedPercent', 'shimmerPercent']);
  assert.deepEqual(files.sort(), ['banding.png', 'crop-corner.png', 'motion.png', 'shimmer.png']);
  for (const f of files) assert.ok(existsSync(join(dir, f)), f);
  const crop = decodePng(readFileSync(join(dir, 'crop-corner.png')));
  assert.deepEqual([crop.width, crop.height], [(w / 2) * MEASURE.crop.zoom, (h / 4) * MEASURE.crop.zoom]);
  const strip = decodePng(readFileSync(join(dir, 'motion.png')));
  assert.equal(strip.height, h / 2, 'two frames at half size in one row');
});

test('without crops of its own a view gets the middle of the frame', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'flying-measure-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const still = frame(80, 40, () => 90);
  const { files } = measureView({ motion: [still], still: [still, still], dir });
  assert.ok(files.includes('crop-centre.png'));
  const crop = decodePng(readFileSync(join(dir, 'crop-centre.png')));
  assert.deepEqual([crop.width, crop.height], [20 * MEASURE.crop.zoom, 10 * MEASURE.crop.zoom]);
});
