// Measurements of a captured view (tools/screenshot.js), from frames the page hands over in its
// test mode (?keep, ?every: CLAUDE.md §7), written into the view's folder, screenshots/<label>/<view>/:
//
//   banding.png       the still, contrast-boosted: bands show as contour lines, the grain as fine noise
//   crop-<name>.png   zoomed regions of the still (a view's `crops` in tools/views.js, else the centre)
//   shimmer.png       where the image flickers while nothing moves, in magenta: the flight held and
//                     the clock stopped (?freeze&dt=0), so only the clouds' jittered trace and its
//                     temporal upsampling change from frame to frame
//   grain.png         where the flight is grainy: the motion strip's frames against the same flight
//                     rendered with its jitter sequences 8 frames on (?jit). Whatever moves moves
//                     alike in both; only the noise the history can't average in motion differs
//                     (the author's "noise that changes as you move", at clouds' edges in turns and
//                     dives), which the shimmer at rest is blind to, and frames a step apart mix
//                     with all that moves. Over the strip: the still alone, 12 frames in, shows a
//                     history still young
//   motion.png        the flight on from the still, a quarter of a second a frame, left to right,
//                     top to bottom: what a still can't show
//
// and, with no image of their own, the still's tone (the share of the frame under luma 96 and over
// 200, the colour of its darkest third and its brightest tenth: navy shade, a frame underexposed),
// each crop's texture (its contrast octave by octave, the finest first: beads of one size are a
// bump, a blank gradient a steep slope down to the finest) and the strip's motion (the share of
// pixels that change from one of its frames to the next: at the start, whether anything moves).
// Those guard and don't steer: they get limits from rows the author has approved.
//
// The numbers go to info.json, with a warning above LIMITS (they warn, they don't fail). The
// analysis is in tools/image.js.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bandedShare, bandingView, crop, flicker, heatImage, octaves, pairDiff, shrink, tile, tone, zoom } from './image.js';
import { encodePng } from './png.js';

export const MEASURE = {
  motion: { frames: 8, every: 15 }, // frames of the strip, and how many frames apart (dt 1/60 s)
  shimmer: { frames: 8, threshold: 6 }, // frames held still (the jitter cycles over 16), and the levels a pixel may change by
  grain: { jit: 8, threshold: 4 }, // the jitter's other start (frames), and the levels the two renders may differ by
  banding: { radius: 6, gain: 32, edge: 6 },
  crop: { zoom: 3, centre: [0.375, 0.375, 0.25, 0.25] }, // the default crop: the middle quarter across
  tone: { dark: 96, bright: 200 }, // luma levels: under the first a photograph's shade is dull, over the second its light bright
  texture: { bands: 6 }, // octaves: 1 to 64 pixels
  motionThreshold: 8, // the levels a pixel must change by between two of the strip's frames
};

// Percent of the frame: banded, the share in visible bands (tools/image.js bandedShare);
// shimmer, the share that flickers by `threshold` levels or more while nothing moves. (grain,
// the share where two renders of the flight differing in their jitter differ by `threshold` or
// more, over the strip's frames, the frame and each crop, has no limit yet; nor have the tone, the
// texture and the motion.)
export const LIMITS = { bandedPercent: 1, shimmerPercent: 0.5 };

// The URL parameters that make the page hand over what the measurements need: the frames of the
// motion strip from the still on (the first is the still itself), and the frames held still.
export const motionParams = () => ({ keep: String(MEASURE.motion.frames), every: String(MEASURE.motion.every) });
export const shimmerParams = () => ({ freeze: '', dt: '0', keep: String(MEASURE.shimmer.frames) });
// (and the strip again, the jitter sequences started elsewhere)
export const grainParams = () => ({ ...motionParams(), jit: String(MEASURE.grain.jit) });

// `motion`: decoded frames, the still first; `still`: decoded frames held still; `grain`: the motion's
// frames rendered with other jitter (none: not measured); `crops`: { name: [x, y, w, h] } as
// fractions of the frame; `limits`: the view's own (tools/views.js). Returns { measurements,
// warnings, files }.
export function measureView({ motion, still, grain, crops, limits, dir }) {
  mkdirSync(dir, { recursive: true });
  const files = [];
  const save = (name, image) => {
    writeFileSync(join(dir, name), encodePng(image));
    files.push(name);
  };
  const [first] = motion;

  save('banding.png', bandingView(first, MEASURE.banding));
  for (const [name, zoomed] of Object.entries(zoomCrops(first, crops))) save(`crop-${name}.png`, zoomed);
  const held = flicker(still, MEASURE.shimmer);
  save('shimmer.png', heatImage(still[0], held.heat, MEASURE.shimmer.threshold));
  save('motion.png', tile(motion.map((f) => shrink(f, 2)), { columns: 4, gap: 4 }));

  const measurements = { bandedPercent: round(bandedShare(first)), shimmerPercent: round(held.percent) };
  const t = tone(first, MEASURE.tone);
  Object.assign(measurements, { darkPercent: round(t.darkPercent, 1), brightPercent: round(t.brightPercent, 1), shade: t.shade, light: t.light });
  measurements.texture = Object.fromEntries(Object.entries(cropsOf(first, crops)).map(([name, part]) => [name, octaves(part, MEASURE.texture).map((v) => round(v, 1))]));
  if (motion.length > 1) {
    const steps = motion.slice(1).map((f, k) => [motion[k], f]);
    measurements.motionPercent = round(pairDiff(steps, { threshold: MEASURE.motionThreshold }).percent, 1);
  }
  if (grain?.length) {
    const pairs = grain.slice(0, motion.length).map((g, k) => [motion[k], g]);
    const noisy = pairDiff(pairs, { threshold: MEASURE.grain.threshold, regions: crops ?? { centre: MEASURE.crop.centre } });
    save('grain.png', heatImage(first, noisy.heat, MEASURE.grain.threshold));
    measurements.grainPercent = round(noisy.percent);
    measurements.grain = Object.fromEntries(Object.entries(noisy.regions).map(([name, v]) => [name, round(v)]));
  }
  return { measurements, warnings: checkLimits(measurements, { ...LIMITS, ...limits }), files };
}

// A view's crops of `image` (`crops`: { name: [x, y, w, h] } as fractions of the frame; without
// any, the centre): { name: image }; zoomed, the measurements' crop-*.png and the compares' rows.
function cropsOf(image, crops) {
  const { width, height } = image;
  return Object.fromEntries(Object.entries(crops ?? { centre: MEASURE.crop.centre }).map(([name, [x, y, w, h]]) => [
    name, crop(image, x * width, y * height, Math.round(w * width), Math.round(h * height)),
  ]));
}
export function zoomCrops(image, crops) {
  return Object.fromEntries(Object.entries(cropsOf(image, crops)).map(([name, part]) => [name, zoom(part, MEASURE.crop.zoom)]));
}

// The measurements past their limits (a null limit judges nothing), as { metric, value, limit }.
export function checkLimits(measurements, limits = LIMITS) {
  return Object.entries(limits)
    .filter(([metric, limit]) => limit !== null && Number.isFinite(measurements[metric]) && measurements[metric] > limit)
    .map(([metric, limit]) => ({ metric, value: measurements[metric], limit }));
}

const LABELS = { bandedPercent: 'banded', shimmerPercent: 'shimmer', grainPercent: 'grain', darkPercent: 'dark', brightPercent: 'bright', motionPercent: 'motion' };

// (each measurement taken, as [label, how it prints]: the grain's and the texture's in each crop)
const labelled = (m) => [
  ...Object.entries(LABELS).filter(([k]) => Number.isFinite(m[k])).map(([k, label]) => [label, `${m[k]}%`]),
  ...Object.entries(m.grain ?? {}).map(([name, v]) => [`grain ${name}`, `${v}%`]),
  ...['shade', 'light'].filter((k) => Array.isArray(m[k])).map((k) => [k, `(${m[k].join(',')})`]),
  ...Object.entries(m.texture ?? {}).map(([name, v]) => [`texture ${name}`, v.join(' ')]),
];

export function describeMeasurements(m) {
  return m ? labelled(m).map(([label, v]) => `${label} ${v}`).join(' · ') : '';
}

export function describeWarning({ metric, value, limit }) {
  return `${LABELS[metric] ?? metric} ${value}% is above its limit of ${limit}%`;
}

// How the measurements changed between two captures, as "label before → after".
export function measurementChanges(a, b) {
  if (!a || !b) return [];
  const before = new Map(labelled(a));
  return labelled(b)
    .filter(([label, v]) => before.has(label) && before.get(label) !== v)
    .map(([label, v]) => `${label} ${before.get(label)} → ${v}`);
}

function round(v, digits = 3) {
  return Number(v.toFixed(digits));
}
