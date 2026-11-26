// The views tools/screenshot.js captures: where the bird starts (the page's ?preset, src/flight/presets.js,
// or an exact ?pose), and a brief: what the shot is for, in the vision's terms (CLAUDE.md §1), which
// reviews judge it against (the contact sheet shows it under the view).
// `crops`: regions of the still to zoom into (tools/measure.js), { name: [x, y, w, h] } as
// fractions of the frame from its top left; without them, the middle. `limits`: a view's own
// measurement limits (null: not judged), over tools/measure.js's LIMITS. `aspect`: the view's own
// width over height (a screen of another shape), as many pixels as the capture's size.
// Keep existing views stable so captures stay comparable over time; add one for anything new
// worth watching, and retire one whose work is done (each costs verify ~13 s here, ~40 s on CI;
// PLAN.md keeps the retired ones' poses). The views by preset look around the start and at towers
// the world generated near it, so they follow the world when it changes; a view by pose keeps the
// world it was made in (?weather, when the spawn draw has moved since).

// The world the views from before leg 14 were made in (moments caught with P, poses at its start):
// its restless air as the spawn draw then moved it, the cells where they lay (?weather).
const BEFORE_14 = '-2515099.4220748544,-283357.23700001836,0,0';

export const VIEWS = [
  { name: 'start', params: {}, brief: 'What a visitor sees first: the low sun, a billowy sea to the horizon, the first tower beside the sun rising far above the bird, two or three minutes ahead, more towers beyond; near clouds below; not much open space.',
    crops: { tower: [0.42, 0.06, 0.25, 0.25], bird: [0.41, 0.71, 0.18, 0.18] } },
  // (the start on screens of other shapes: the start's heading and the field of view follow it,
  // flight/camera.js)
  { name: 'start-tablet', params: {}, aspect: 3 / 4, brief: 'The start on a tablet held upright: the sun in frame, the first tower beside it, more sky than near sea, the bird whole.',
    crops: { bird: [0.37, 0.72, 0.26, 0.16] } },
  { name: 'start-phone', params: {}, aspect: 9 / 19.5, brief: 'The start on a phone held upright (41° across): the sun in frame, the first tower beside it, more sky than near sea, the bird whole.',
    crops: { bird: [0.32, 0.73, 0.36, 0.13] } },
  { name: 'sun', params: { preset: 'sun' }, brief: 'Into the sun: bright and dazzling, thin edges shining where the light comes through, backlit billows in luminous shade with golden rims, never navy or brown.',
    crops: { rim: [0.72, 0.04, 0.25, 0.25] } },
  { name: 'away', params: { preset: 'away' }, brief: 'The sun behind: faces glowing gold, orange and peach, long shadows across the sea, the far clouds melting into blue haze.',
    crops: { bird: [0.41, 0.69, 0.18, 0.18] } },
  { name: 'side', params: { preset: 'side' }, brief: 'The sun to the left: lit and shaded sides, the sea\'s swells, valleys and heaps, its shade a luminous cool blue and violet, never navy or brown.' },
  // (the side view flown through banking turns: its motion strip and grain are the turn's)
  { name: 'turn', params: { preset: 'side', script: 'weave' }, brief: 'Banking through a turn over the sea: the edges of the clouds and their lit rims steady in motion, not grainy.' },
  // (the preset's way, 400 m over the sea's top: just over its billows, which rise 300-380 m over it
  // there; the preset itself lies 170 m over it, in the billows, where the skim flight dives through)
  { name: 'skim', params: { pose: '0,1493,0,0.35,-0.03,0', weather: BEFORE_14 }, brief: 'Just over the cloud tops: a billowy sea with large relief, and near the bird mist, not a surface: soft and smooth as in nature, but never perfectly even, its edge ragged; no sharp ridgelines.' },
  // (the pose a held climb settles in, flight.js: 26° up at 51 m/s; the camera sinks behind the bird, camera.js)
  { name: 'climb', params: { pose: '0,3200,0,0.45,0.45,0,51.4' }, brief: 'In a held climb, 2 km over the sea: the bird whole in the frame, not sunk to its bottom edge, the towers rising ahead far above it, the sea falling away below.',
    crops: { bird: [0.36, 0.69, 0.28, 0.25] } },
  { name: 'high2', params: { preset: 'high2' }, brief: 'From 5 km up: the sea\'s swells and valleys, heaps and towers from above, never evenly spread; the farther, the hazier, paler and bluer.' },
  { name: 'tower', params: { preset: 'tower' }, brief: 'A big tower from 9 km or more, sunlit from the side: a heap of turrets on a broad base swelling out of the sea, big ones carrying smaller ones, crisp cauliflower domes, shadowed folds kept luminous, sides that bulge and lean.',
    crops: { domes: [0.45, 0.02, 0.25, 0.25] } },
  { name: 'giant', params: { preset: 'giant' }, brief: 'The tallest tower within 70 km, from twice its height away: it must dominate the view, rising far above the bird, a few great turrets carrying smaller ones, not one texture of beads.',
    crops: { turrets: [0.35, 0.02, 0.3, 0.3] } },
  { name: 'far', params: { preset: 'far' }, brief: 'The tallest tower from 40 km or more and 7 km up, against the sun, as from an airliner: a heap of turrets in silhouette with shining rims, broad where it rises out of the sea, never a mushroom on a thin stem.' },
  { name: 'close', params: { preset: 'close' }, brief: 'Up against a tower\'s flank, under it, looking up: cloud, not pillow and not rock, soft up close but never perfectly even, its edge ragged, its shade luminous, never navy or brown.',
    crops: { domes: [0.15, 0.1, 0.25, 0.25] } },
  { name: 'under', params: { preset: 'under' }, brief: 'Beneath an overhang, looking up at it: something to fly under, part of the tower it leans out from, nothing broken off.' },
  { name: 'inside', params: { preset: 'inside' }, brief: 'Inside a tower: surrounded by drifting mist and the light inside the cloud, not a white wall.' },
  // (the skim flight 5.4 s in, its camera about to pass a metre under the top of the billow ahead)
  { name: 'entry', params: { pose: '116.8,1307.5,-314.7,0.354,0.105,0', weather: BEFORE_14 }, brief: 'The camera crossing the top of a billow: one cloud inside and out, the clouds behind clear through its shreds, no blocks or seams.',
    crops: { top: [0.3, 0.3, 0.45, 0.3] } },
  // (a moment the author caught with P, flying out of a cloud's edge: its fog clears over the motion strip)
  { name: 'exit', params: { pose: '-1151.9,1431.9,-2975.1,-1.0983,0.0382,0.2111,92.9', weather: BEFORE_14 }, brief: 'Out of a billow\'s side, banking: the far clouds\' outlines clean against the sky as the fog clears (no pale rim), the fog itself smooth (no lattice).',
    crops: { outlines: [0.29, 0.31, 0.52, 0.15], fog: [0.16, 0, 0.42, 0.3] } },
  // (two moments the author caught with P, flying past clouds a few hundred metres off: their grain
  // over the motion strip is the near clouds', which the history can't average as they move past)
  { name: 'past', params: { pose: '-51.6,1641.7,-3229.7,-5.8792,-0.0261,-0.0343,73.1', weather: BEFORE_14 }, brief: 'Past a near cloud and into its side: its soft edge and its face clean as they slide by, no grain or speckle, the far clouds clear beside it.',
    crops: { edge: [0.38, 0.25, 0.2, 0.35] } },
  { name: 'gap', params: { pose: '1454,1805.6,-2187.1,0.1262,0.1233,-0.0043,62.9', weather: BEFORE_14 }, brief: 'Through a gap between near clouds toward the sun: their edges and thin veils soft and clean in flight, no grain, the sunlit sea beyond clear.',
    crops: { edge: [0.45, 0.2, 0.25, 0.4] } },
  // (a moment the author caught with P, looking along the sun's rays: there a texel of the sun map,
  // 64 × 32 m and 320 m long, lies end-on, a rectangle on screen)
  { name: 'backlit', params: { pose: '433.9,1691.7,-1104,0.05,0.0322,-0.0126,70.4', weather: BEFORE_14 }, brief: 'Straight into the sun past a near lobe that lies in the shadow of the cloud behind it: its shade whole and soft, no bright box on it; only edges the sun really reaches shine.',
    crops: { lobe: [0.42, 0.46, 0.27, 0.35] } },
  // (a moment the author caught with P, 16 km from the start: a tower's flank leaning out over the
  // bird, in shade; where a ray's first sample fell in the frayed edge's air, the sky's taps were
  // never taken, and the flank was spotted with the open sky's blue)
  { name: 'belly', params: { pose: '5141.4,1849.7,-16052.4,7.0839,0.2905,-0.1009,53', weather: BEFORE_14 }, brief: 'Under a tower\'s flank that leans out overhead, in shade: lit warm from the sunlit sea below, the sky\'s blue only on what faces up, its shade whole, no spots.',
    crops: { flank: [0.3, 0.3, 0.3, 0.3] } },
  { name: 'seed3', params: { seed: '3' }, brief: 'Another world\'s start: the generator, not just the piece\'s seed; towers in view, nothing placed, nothing repeating.' },
  // (the pose places the bird diving steeply at 8 km: the camera behind it looks almost straight down)
  { name: 'down', params: { pose: '0,8000,0,0.45,-1.5,0' }, brief: 'Straight down from 8 km over the start: the sea as a map, heaps and billows at every size, towers in clusters, walls, lone giants and open stretches, never evenly spread, nothing repeating.',
    crops: { billows: [0.62, 0.05, 0.25, 0.25], bird: [0.42, 0.47, 0.16, 0.16] } },
];

export function findView(name) {
  const view = VIEWS.find((v) => v.name === name);
  if (!view) throw new Error(`unknown view "${name}". Views: ${VIEWS.map((v) => v.name).join(', ')}`);
  return view;
}
