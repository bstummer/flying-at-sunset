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
  { name: 'skim', params: { preset: 'skim' }, brief: 'Just over the cloud tops: billows at every size, crisp where the sun catches them.' },
  { name: 'high2', params: { preset: 'high2' }, brief: 'From 5 km up: the sea\'s swells and valleys, heaps and towers from above, haze showing the scale.' },
  { name: 'tower', params: { preset: 'tower' }, brief: 'A big tower from 9 km, sunlit from the side: broad base swelling out of the sea, cauliflower domes, deep folds.',
    crops: { domes: [0.45, 0.02, 0.25, 0.25] } },
  { name: 'giant', params: { preset: 'giant' }, brief: 'The tallest tower within 70 km, from afar: it must dominate the view.' },
  { name: 'anvil', params: { preset: 'anvil' }, brief: 'A storm that hit the ceiling and spread, seen high and far against the sun, as from an airliner.' },
  { name: 'close', params: { preset: 'close' }, brief: 'Up against a tower\'s flank, looking up: domes dense and solid, never soft pillows.',
    crops: { domes: [0.15, 0.1, 0.25, 0.25] } },
  { name: 'under', params: { preset: 'under' }, brief: 'Beneath an overhang, looking up at it: something to fly under.' },
  { name: 'inside', params: { preset: 'inside' }, brief: 'Inside a tower: drifting mist and in-cloud light, not a white wall.' },
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
