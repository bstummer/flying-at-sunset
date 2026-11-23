// The views tools/screenshot.js captures: where the bird starts (the page's ?preset, src/flight/presets.js,
// or an exact ?pose), and a brief: what the shot is for, which reviews judge it against.
// `crops`: regions of the still to zoom into (tools/measure.js), { name: [x, y, w, h] } as
// fractions of the frame from its top left; without them, the middle. `limits`: a view's own
// measurement limits (null: not judged), over tools/measure.js's LIMITS.
// Keep existing views stable so captures stay comparable over time; add one for anything new
// worth watching. The tower views look at towers the world generated near the start, so they
// follow the world when it changes.

export const VIEWS = [
  { name: 'start', params: {}, brief: 'What a visitor sees first: calm air toward the low sun, strong towers off to the right, lit from the side.',
    crops: { tower: [0.42, 0.06, 0.25, 0.25], bird: [0.42, 0.66, 0.16, 0.16] } },
  { name: 'sun', params: { preset: 'sun' }, brief: 'Into the sun: glare, bright silver linings, dark backlit billows with golden rims.',
    crops: { rim: [0.72, 0.04, 0.25, 0.25] } },
  { name: 'away', params: { preset: 'away' }, brief: 'The sun behind: faces glowing gold and peach, long shadows across the sea.',
    crops: { bird: [0.42, 0.66, 0.16, 0.16] } },
  { name: 'side', params: { preset: 'side' }, brief: 'The sun to the left: lit and shaded sides, the relief of the sea, cool blue and violet shade.' },
  // (the side view flown through banking turns: its motion strip and grain are the turn's)
  { name: 'turn', params: { preset: 'side', script: 'weave' }, brief: 'Banking through a turn over the sea: the edges of the clouds and their lit rims steady in motion, not grainy.' },
  // (the preset's way, 400 m over the sea's top: just over its billows, which rise 300-380 m over it
  // there; the preset itself lies 170 m over it, in the billows, where the skim flight dives through)
  { name: 'skim', params: { pose: '0,1493,0,0.35,-0.03,0' }, brief: 'Just over the cloud tops: billows at every size, crisp where the sun catches them.' },
  { name: 'high2', params: { preset: 'high2' }, brief: 'From 5 km up: the sea\'s swells and valleys, heaps and towers from above, haze showing the scale.' },
  { name: 'tower', params: { preset: 'tower' }, brief: 'A big tower from 9 km, sunlit from the side: broad base swelling out of the sea, cauliflower domes, deep folds.',
    crops: { domes: [0.45, 0.02, 0.25, 0.25] } },
  { name: 'giant', params: { preset: 'giant' }, brief: 'The tallest tower within 70 km, from afar: it must dominate the view.' },
  { name: 'anvil', params: { preset: 'anvil' }, brief: 'A storm that hit the ceiling and spread, seen high and far against the sun, as from an airliner.' },
  { name: 'close', params: { preset: 'close' }, brief: 'Up against a tower\'s flank, looking up: domes dense and solid, never soft pillows.',
    crops: { domes: [0.15, 0.1, 0.25, 0.25] } },
  { name: 'under', params: { preset: 'under' }, brief: 'Beneath an overhang, looking up at it: something to fly under.' },
  { name: 'inside', params: { preset: 'inside' }, brief: 'Inside a tower: drifting mist and in-cloud light, not a white wall.' },
  // (in the first metres of a billow over the start's sea, flying out of it; 70 m higher the view is clear)
  // (the skim flight 5.4 s in, its camera about to pass a metre under the top of the billow ahead)
  { name: 'entry', params: { pose: '116.8,1307.5,-314.7,0.354,0.105,0' }, brief: 'The camera crossing the top of a billow: one cloud inside and out, the clouds behind clear through its shreds, no blocks or seams.',
    crops: { top: [0.3, 0.3, 0.45, 0.3] } },
  { name: 'edge', params: { pose: '0,1400,0,-1.0,-0.03,0' }, brief: 'In a billow\'s edge, looking out: a thin fog, the world past it clear and still in flight, not grainy and not washed out.',
    crops: { horizon: [0.15, 0.29, 0.5, 0.1], ridge: [0.08, 0.46, 0.4, 0.12], sky: [0.3, 0.03, 0.4, 0.15] } },
  // (moments the author caught with P, flying out of a cloud's edge: its fog clears over the motion strip)
  { name: 'exit', params: { pose: '-1151.9,1431.9,-2975.1,-1.0983,0.0382,0.2111,92.9' }, brief: 'Out of a billow\'s side, banking: the far clouds\' outlines clean against the sky as the fog clears (no pale rim), the fog itself smooth (no lattice).',
    crops: { outlines: [0.29, 0.31, 0.52, 0.15], fog: [0.16, 0, 0.42, 0.3] } },
  { name: 'exitsun', params: { pose: '-236.2,1494.8,-4685.5,0.3133,0.2089,-0.049,67.9' }, brief: 'Out of a top toward the sun: the glow through the clearing fog, the towers\' outlines clean and not grainy.',
    crops: { towers: [0.55, 0.15, 0.4, 0.4] } },
  { name: 'seed3', params: { seed: '3' }, brief: 'Another world\'s start: the generator, not just the piece\'s seed.' },
  { name: 'geometry', params: { preset: 'side', dbg: '1' }, brief: 'The side view\'s cloud surface as normals: shapes without the light.',
    limits: { shimmerPercent: null } },
  // (the pose places the bird diving steeply at 8 km: the camera behind it looks almost straight down)
  { name: 'down', params: { pose: '0,8000,0,0.45,-1.5,0' }, brief: 'Straight down from 8 km over the start: the sea of clouds as a map, heaps and billows at every size, nothing repeating.',
    crops: { billows: [0.62, 0.05, 0.25, 0.25], bird: [0.42, 0.43, 0.16, 0.16] } },
];

export function findView(name) {
  const view = VIEWS.find((v) => v.name === name);
  if (!view) throw new Error(`unknown view "${name}". Views: ${VIEWS.map((v) => v.name).join(', ')}`);
  return view;
}
