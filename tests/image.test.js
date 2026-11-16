import test from 'node:test';
import assert from 'node:assert/strict';
import { bandedShare, bandingView, createImage, crop, diffImage, flicker, heatImage, shrink, tile, zoom } from '../tools/image.js';
import { mulberry32 } from '../src/math.js';

// After tropical-island's tests of the same functions.

// A seeded stream of numbers in [0, 1), by name.
function stream(name) {
  let h = 0;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 2654435761);
  return { next: mulberry32(h) };
}

// An image whose grey value at each pixel is f(x, y), rounded and clamped to 8 bits.
function greyImage(width, height, f) {
  const image = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.max(0, Math.min(255, Math.round(f(x, y))));
      image.data.set([v, v, v], 4 * (y * width + x));
    }
  }
  return image;
}

const at = (image, x, y) => [...image.data.subarray(4 * (y * image.width + x), 4 * (y * image.width + x) + 3)];

// An image whose three channels differ and vary apart, so mixing them up shows.
function colourImage(width, height) {
  const image = createImage(width, height);
  for (let i = 0; i < width * height; i++) image.data.set([(37 * i) % 256, (101 * i + 50) % 256, (173 * i + 90) % 256], 4 * i);
  return image;
}

const MAGENTA = [255, 40, 200];

// ---------------------------------------------------------------- layout

test('crop takes the region and clamps it to the image', () => {
  const image = greyImage(10, 8, (x, y) => 10 * x + y);
  const part = crop(image, 2, 3, 4, 2);
  assert.deepEqual([part.width, part.height], [4, 2]);
  assert.deepEqual(at(part, 0, 0), at(image, 2, 3));
  assert.deepEqual(at(part, 3, 1), at(image, 5, 4));
  const edge = crop(image, 8, 7, 5, 5);
  assert.deepEqual([edge.width, edge.height], [2, 1]);
});
test('crop clamps a region off any side of the image into it, at whole pixels', () => {
  const image = colourImage(10, 8);
  // Every pixel of `part` is the image's, from (x0, y0) on, and nothing reaches past it.
  const from = (part, x0, y0) => {
    assert.ok(x0 + part.width <= image.width && y0 + part.height <= image.height, `${part.width} x ${part.height} at (${x0}, ${y0})`);
    for (let y = 0; y < part.height; y++) for (let x = 0; x < part.width; x++) assert.deepEqual(at(part, x, y), at(image, x0 + x, y0 + y));
  };
  from(crop(image, -3, -2, 4, 3), 0, 0);
  from(crop(image, 2.4, 3.6, 3, 2), 2, 4);
  from(crop(image, 7, -5, 6, 2), 7, 0);
  const past = crop(image, 15, 20, 3, 3);
  assert.deepEqual([past.width, past.height], [1, 1]);
  from(past, 9, 7);
});
test('zoom repeats pixels and shrink averages them back', () => {
  const image = greyImage(3, 2, (x, y) => 40 * x + 100 * y);
  const big = zoom(image, 2);
  assert.deepEqual([big.width, big.height], [6, 4]);
  assert.deepEqual(at(big, 5, 3), at(image, 2, 1));
  assert.deepEqual(at(big, 4, 2), at(image, 2, 1));
  assert.deepEqual(shrink(big, 2), image);
});
test('tile lays images out in rows with gaps', () => {
  const images = [0, 1, 2].map((n) => greyImage(4, 3, () => 50 * (n + 1)));
  const sheet = tile(images, { columns: 2, gap: 1, background: [7, 7, 7] });
  assert.deepEqual([sheet.width, sheet.height], [9, 7]);
  assert.deepEqual(at(sheet, 0, 0), [50, 50, 50]);
  assert.deepEqual(at(sheet, 5, 0), [100, 100, 100]);
  assert.deepEqual(at(sheet, 0, 4), [150, 150, 150]);
  assert.deepEqual(at(sheet, 4, 0), [7, 7, 7]); // gap
  assert.deepEqual(at(sheet, 5, 4), [7, 7, 7]); // empty cell
});
test('tile leaves gaps between rows too, and puts smaller images at the top left of cells the size of the largest', () => {
  const big = greyImage(4, 3, () => 200);
  const small = greyImage(2, 1, () => 100);
  const sheet = tile([big, small, small], { columns: 2, gap: 2, background: [7, 7, 7] });
  assert.deepEqual([sheet.width, sheet.height], [10, 8]);
  const background = [7, 7, 7];
  for (let x = 0; x < 10; x++) for (const y of [3, 4]) assert.deepEqual(at(sheet, x, y), background, `gap row at (${x}, ${y})`);
  for (let y = 0; y < 8; y++) for (const x of [4, 5]) assert.deepEqual(at(sheet, x, y), background, `gap column at (${x}, ${y})`);
  assert.deepEqual(at(sheet, 3, 2), [200, 200, 200]);
  assert.deepEqual([at(sheet, 6, 0), at(sheet, 7, 0), at(sheet, 8, 0), at(sheet, 6, 1)], [[100, 100, 100], [100, 100, 100], background, background]);
  assert.deepEqual([at(sheet, 0, 5), at(sheet, 1, 5), at(sheet, 2, 5), at(sheet, 0, 6)], [[100, 100, 100], [100, 100, 100], background, background]);
  const row = tile([big, small]);
  assert.deepEqual([row.width, row.height], [8, 3], 'one row by default, without gaps');
});
test('crop, zoom, shrink and tile keep the colour channels apart', () => {
  const image = colourImage(6, 4);
  assert.deepEqual(at(crop(image, 1, 1, 3, 2), 2, 1), at(image, 3, 2));
  assert.deepEqual(at(zoom(image, 3), 7, 10), at(image, 2, 3));
  const block = [[2, 2], [3, 2], [2, 3], [3, 3]].map(([x, y]) => at(image, x, y));
  assert.deepEqual(at(shrink(image, 2), 1, 1), [0, 1, 2].map((c) => Math.round(block.reduce((sum, p) => sum + p[c], 0) / 4)));
  assert.deepEqual(at(tile([image, image], { gap: 1 }), 9, 2), at(image, 2, 2));
});
// ---------------------------------------------------------------- banding

// Mean distance from mid-grey of each column's average: high where bands line up
// down the columns, low where the output is only noise.
function columnContrast(image) {
  let total = 0;
  for (let x = 0; x < image.width; x++) {
    let sum = 0;
    for (let y = 0; y < image.height; y++) sum += image.data[4 * (y * image.width + x)];
    total += Math.abs(sum / image.height - 128);
  }
  return total / image.width;
}

test('the banding view turns an undithered gradient into lines and a dithered one into noise', () => {
  const r = stream('image-test/dither');
  const slope = 1 / 16; // one 8-bit level every 16 pixels, a slow gradient
  const banded = greyImage(160, 40, (x) => 100 + Math.floor(x * slope));
  const dithered = greyImage(160, 40, (x) => 100 + x * slope + r.next() - 0.5);
  const flat = greyImage(160, 40, () => 100);

  const bands = columnContrast(bandingView(banded));
  const noise = columnContrast(bandingView(dithered));
  assert.ok(bands > 5, `banded gradient: column contrast ${bands.toFixed(2)}`);
  assert.ok(noise < bands / 3, `dithered gradient: column contrast ${noise.toFixed(2)} vs ${bands.toFixed(2)}`);
  assert.ok(bandingView(flat).data.every((v, i) => v === (i % 4 === 3 ? 255 : 128)), 'a flat image stays mid-grey');
});
test('banded share: an undithered slow gradient is all bands, a dithered one, a flat image and hard edges none', () => {
  const r = stream('image-test/banded');
  const slope = 1 / 32;
  assert.ok(bandedShare(greyImage(320, 4, (x) => 100 + Math.floor(x * slope))) > 90);
  assert.equal(bandedShare(greyImage(320, 4, (x) => 100 + x * slope + r.next() + r.next() - 1)), 0);
  assert.equal(bandedShare(greyImage(320, 4, () => 100)), 0);
  assert.equal(bandedShare(greyImage(320, 4, (x) => (Math.floor(x / 40) % 2 ? 30 : 220))), 0);
});
test('banded share: bands across the rows count too, as in a sky gradient', () => {
  const r = stream('image-test/banded-sky');
  const slope = 1 / 32;
  assert.ok(bandedShare(greyImage(4, 320, (x, y) => 100 + Math.floor(y * slope))) > 90);
  assert.equal(bandedShare(greyImage(64, 320, (x, y) => 100 + y * slope + r.next() + r.next() - 1)), 0);
});
test('banded share: bands in one channel count', () => {
  const blueSteps = createImage(320, 4);
  for (let i = 0; i < 320 * 4; i++) blueSteps.data.set([30, 60, 150 + Math.floor((i % 320) / 32)], 4 * i);
  assert.ok(bandedShare(blueSteps) > 90);
});
test('the banding view draws real edges in flat dark grey', () => {
  const view = bandingView(greyImage(40, 8, (x) => (x < 20 ? 30 : 220)));
  assert.deepEqual(at(view, 19, 4), [64, 64, 64]);
  assert.deepEqual(at(view, 2, 4), [128, 128, 128]);
});
test('the banding view shows banding in a single channel', () => {
  const blueSteps = createImage(64, 8);
  for (let i = 0; i < 64 * 8; i++) blueSteps.data.set([30, 60, 150 + Math.floor((i % 64) / 16)], 4 * i);
  const view = bandingView(blueSteps);
  const blue = [...Array(64).keys()].map((x) => view.data[4 * (4 * 64 + x) + 2]);
  assert.ok(Math.max(...blue) - Math.min(...blue) > 20, 'blue steps show');
  assert.equal(view.data[4 * (4 * 64 + 16)], 128, 'red stays flat');
});
// ---------------------------------------------------------------- flicker and its map

test('the heat map grows a flagged pixel to its four neighbours only, and tints heat under the threshold', () => {
  const heat = new Float32Array(25);
  heat[2 * 5 + 2] = 16; // at the threshold: flagged
  heat[0] = 15.9; // just under it
  const out = heatImage(greyImage(5, 5, () => 100), heat, 16);
  for (const [x, y] of [[2, 2], [1, 2], [3, 2], [2, 1], [2, 3]]) assert.deepEqual(at(out, x, y), MAGENTA, `(${x}, ${y})`);
  for (const [x, y] of [[1, 1], [3, 1], [1, 3], [3, 3], [0, 2], [4, 2], [2, 0], [2, 4], [1, 0], [0, 1]]) {
    assert.deepEqual(at(out, x, y), [60, 60, 60], `(${x}, ${y}): neither flagged nor next to one`);
  }
  const [r, g, b] = at(out, 0, 0);
  assert.ok(r > 60 && r < 255 && g < 60 && b > 60 && b < 200, `a faint tint, ${[r, g, b]}`);
});
test('flicker measures the share of pixels that change across the frames', () => {
  const still = greyImage(10, 10, () => 50);
  const half = greyImage(10, 10, (x) => (x < 5 ? 50 : 90));
  assert.equal(flicker([still, still, still]).percent, 0);
  assert.equal(flicker([still, half]).percent, 50);
  assert.equal(flicker([still, half, still]).percent, 50);
  assert.equal(flicker([still]).percent, 0);
  assert.equal(flicker([still, half]).heat[9], 40, 'the map holds the range per pixel');
});
test('a slow drift counts as flicker even when no single step passes the threshold', () => {
  const frames = [0, 1, 2, 3, 4, 5].map((k) => greyImage(10, 10, () => 100 + 2 * k));
  assert.equal(flicker(frames, { threshold: 4 }).percent, 100);
});
test('flicker counts the pixels its map marks: those whose range reaches the threshold', () => {
  const still = greyImage(7, 1, () => 100);
  const moved = greyImage(7, 1, (x) => 100 + [0, 3, 0, 4, 0, 0, 5][x]);
  const { percent, heat } = flicker([still, moved], { threshold: 4 });
  assert.equal(percent, (100 * 2) / 7);
  const map = heatImage(still, heat, 4);
  assert.deepEqual([at(map, 3, 0), at(map, 6, 0)], [MAGENTA, MAGENTA]);
  assert.notDeepEqual(at(map, 1, 0), MAGENTA);
});
test('flicker counts a change in any one channel', () => {
  const still = createImage(4, 1, [10, 20, 30]);
  const moved = createImage(4, 1, [10, 20, 30]);
  moved.data.set([90, 20, 30], 0);
  moved.data.set([10, 90, 30], 4);
  moved.data.set([10, 20, 90], 8);
  assert.equal(flicker([still, moved]).percent, 75);
});

test('the diff of two images counts changed pixels, those off by more than 2 levels, the largest change, and marks them', () => {
  const a = createImage(4, 1, [100, 100, 100]);
  const b = createImage(4, 1, [100, 100, 100]);
  b.data[4 + 1] = 101; // pixel 1: one level, in green
  b.data[8 + 2] = 130; // pixel 2: 30 levels, in blue
  const d = diffImage(a, b);
  assert.deepEqual([d.changed, d.large, d.max, d.total], [2, 1, 30, 4]);
  const px = (k) => [...d.image.data.subarray(4 * k, 4 * k + 4)];
  assert.equal(px(0)[0], px(0)[1], 'unchanged: grey');
  assert.ok(px(1)[0] > px(0)[0] && px(1)[0] < px(2)[0], 'a level or two faint, more brighter');
  assert.ok(px(2)[0] > 150 && px(2)[1] < 60, 'a large change in magenta');
  assert.equal(diffImage(a, a).changed, 0);
  assert.throws(() => diffImage(a, createImage(2, 2)), /different sizes/);
});

