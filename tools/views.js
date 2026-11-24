// The views tools/screenshot.js captures: where the bird starts (the page's ?preset, src/flight/presets.js,
// or an exact ?pose), and a brief: what the shot is for, in the vision's terms (CLAUDE.md §1), which
// reviews judge it against (the contact sheet shows it under the view).
// `crops`: regions of the still to zoom into (tools/measure.js), { name: [x, y, w, h] } as
// fractions of the frame from its top left; without them, the middle. `limits`: a view's own
// measurement limits (null: not judged), over tools/measure.js's LIMITS.
// Keep existing views stable so captures stay comparable over time; add one for anything new
// worth watching, and retire one whose work is done (each costs verify ~13 s here, ~40 s on CI;
// PLAN.md keeps the retired ones' poses). The tower views look at towers the world generated near the start, so they
// follow the world when it changes.

export const VIEWS = [
  { name: 'start', params: {}, brief: 'What a visitor sees first: the low sun, a billowy sea to the horizon, enormous towers off to the right rising far above the bird, lit from the side; not much open space.',
    crops: { tower: [0.42, 0.06, 0.25, 0.25], bird: [0.42, 0.66, 0.16, 0.16] } },
  { name: 'sun', params: { preset: 'sun' }, brief: 'Into the sun: bright and dazzling, thin edges shining where the light comes through, backlit billows in luminous shade with golden rims, never navy or brown.',
    crops: { rim: [0.72, 0.04, 0.25, 0.25] } },
  { name: 'away', params: { preset: 'away' }, brief: 'The sun behind: faces glowing gold, orange and peach, long shadows across the sea, the far clouds melting into blue haze.',
    crops: { bird: [0.42, 0.66, 0.16, 0.16] } },
  { name: 'side', params: { preset: 'side' }, brief: 'The sun to the left: lit and shaded sides, the sea\'s swells, valleys and heaps, its shade a luminous cool blue and violet, never navy or brown.' },
  // (the side view flown through banking turns: its motion strip and grain are the turn's)
  { name: 'turn', params: { preset: 'side', script: 'weave' }, brief: 'Banking through a turn over the sea: the edges of the clouds and their lit rims steady in motion, not grainy.' },
  // (the preset's way, 400 m over the sea's top: just over its billows, which rise 300-380 m over it
  // there; the preset itself lies 170 m over it, in the billows, where the skim flight dives through)
  { name: 'skim', params: { pose: '0,1493,0,0.35,-0.03,0' }, brief: 'Just over the cloud tops: billows at every size, bulges on bulges down to metres, crisp where the sun catches them, soft edges, never sharp ridgelines or smooth pillows.' },
  { name: 'high2', params: { preset: 'high2' }, brief: 'From 5 km up: the sea\'s swells and valleys, heaps and towers from above, never evenly spread; the farther, the hazier, paler and bluer.' },
  { name: 'tower', params: { preset: 'tower' }, brief: 'A big tower from 9 km or more, sunlit from the side: broad base swelling out of the sea, a few huge lobes carrying smaller ones, crisp cauliflower domes, shadowed folds kept luminous, sides that bulge and lean.',
    crops: { domes: [0.45, 0.02, 0.25, 0.25] } },
  { name: 'giant', params: { preset: 'giant' }, brief: 'The tallest tower within 70 km, from twice its height away: it must dominate the view, rising far above the bird, a few great turrets carrying smaller ones, not one texture of beads.',
    crops: { turrets: [0.35, 0.02, 0.3, 0.3] } },
  { name: 'anvil', params: { preset: 'anvil' }, brief: 'A storm that hit the ceiling and spread: a wide flat anvil far away against the sun, as from an airliner, on a massive broad column, never a mushroom on a thin stem.' },
  { name: 'close', params: { preset: 'close' }, brief: 'Up against a tower\'s flank, under it, looking up: crisp domes on domes down to metres, never soft pillows, nor solid like rock or dough: the folds luminous with the light inside.',
    crops: { domes: [0.15, 0.1, 0.25, 0.25] } },
  { name: 'under', params: { preset: 'under' }, brief: 'Beneath an overhang, looking up at it: something to fly under, part of the tower it leans out from, nothing broken off.' },
  { name: 'inside', params: { preset: 'inside' }, brief: 'Inside a tower: surrounded by drifting mist and the light inside the cloud, not a white wall.' },
  // (the skim flight 5.4 s in, its camera about to pass a metre under the top of the billow ahead)
  { name: 'entry', params: { pose: '116.8,1307.5,-314.7,0.354,0.105,0' }, brief: 'The camera crossing the top of a billow: one cloud inside and out, the clouds behind clear through its shreds, no blocks or seams.',
    crops: { top: [0.3, 0.3, 0.45, 0.3] } },
  // (a moment the author caught with P, flying out of a cloud's edge: its fog clears over the motion strip)
  { name: 'exit', params: { pose: '-1151.9,1431.9,-2975.1,-1.0983,0.0382,0.2111,92.9' }, brief: 'Out of a billow\'s side, banking: the far clouds\' outlines clean against the sky as the fog clears (no pale rim), the fog itself smooth (no lattice).',
    crops: { outlines: [0.29, 0.31, 0.52, 0.15], fog: [0.16, 0, 0.42, 0.3] } },
  { name: 'seed3', params: { seed: '3' }, brief: 'Another world\'s start: the generator, not just the piece\'s seed; towers in view, nothing placed, nothing repeating.' },
  // (the pose places the bird diving steeply at 8 km: the camera behind it looks almost straight down)
  { name: 'down', params: { pose: '0,8000,0,0.45,-1.5,0' }, brief: 'Straight down from 8 km over the start: the sea as a map, heaps and billows at every size, towers in clusters, walls, lone giants and open stretches, never evenly spread, nothing repeating.',
    crops: { billows: [0.62, 0.05, 0.25, 0.25], bird: [0.42, 0.43, 0.16, 0.16] } },
];

export function findView(name) {
  const view = VIEWS.find((v) => v.name === name);
  if (!view) throw new Error(`unknown view "${name}". Views: ${VIEWS.map((v) => v.name).join(', ')}`);
  return view;
}
