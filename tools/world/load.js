// The CPU world generator in Node, so the world can be generated, measured and drawn without a
// browser: the very modules the page runs (src/world/, which never touches the page or the GPU,
// and the constants and maths it imports), as ES modules.
//
//   import { loadWorld } from './load.js';
//   const W = await loadWorld();             // every export of src/world/, constants.js and math.js
//   QS="seed=3&towers=1.5" node tool.js      // the URL parameters the world reads (?seed, ?towers)
//   WSRC=path/to/src/world node tool.js      // the world of another checkout, to compare with
//
// A process holds one world: modules load once, and the world reads its parameters as it loads
// (the spawn draw in world/cells.js runs then). tests/world.test.js runs a world per seed in
// worker threads.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodePng } from '../png.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WORLD_DIR = join(ROOT, 'src', 'world');

let loaded = null;

export async function loadWorld({ query = process.env.QS ?? '', dir = process.env.WSRC || WORLD_DIR } = {}) {
  const key = `${resolve(dir)}?${query}`;
  if (loaded) {
    if (loaded.key !== key) throw new Error(`this process already holds the world ${loaded.key}: one world per process`);
    return loaded.world;
  }
  globalThis.location = { search: query ? `?${query.replace(/^\?/, '')}` : '' };
  const files = [
    ...readdirSync(dir).filter((n) => n.endsWith('.js')).sort().map((n) => join(dir, n)),
    join(dir, '..', 'constants.js'),
    join(dir, '..', 'math.js'),
  ];
  const spaces = [];
  for (const file of files) spaces.push(await import(pathToFileURL(file).href));
  // Read through to the modules, so an export a module reassigns (world/air.js's REST_O) reads
  // as it does in the page.
  const world = new Proxy({ source: relative(process.cwd(), dir) || dir }, {
    get: (own, name) => (name in own ? own[name] : spaces.find((s) => name in s)?.[name]),
  });
  loaded = { key, world };
  return world;
}

// Where a world tool writes an image: the path given, else screenshots/world/<name>
// (screenshots/ is not committed).
export function outPath(given, name) {
  const path = resolve(given || join(ROOT, 'screenshots', 'world', name));
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

// Writes an RGB image (3 bytes a pixel, rows from the top) as a PNG.
export function savePng(path, width, height, rgb) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[4 * i] = rgb[3 * i];
    data[4 * i + 1] = rgb[3 * i + 1];
    data[4 * i + 2] = rgb[3 * i + 2];
    data[4 * i + 3] = 255;
  }
  writeFileSync(path, encodePng({ width, height, data }));
}
