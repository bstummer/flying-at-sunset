// Load the CPU world generator (the modules in src/world/ and what they import) into Node, so the
// world can be generated, measured and drawn without a browser.
//
//   const W = require('./load.js');          // the world of src/, seed 7
//   WSRC=dir node tool.js                    // another world: a directory of modules (e.g. the
//                                            // src/world of another checkout), or module files
//                                            // joined with ':'
//   QS="seed=3&towers=1.5" node tool.js      // URL parameters the world code reads (Q)
//
// The modules are joined into one function, each after the modules it imports (as build.mjs joins
// them for the page), with `location` faked for the URL parameters. The world must stay free of
// the DOM and of WebGL. The names handed back are listed in NAMES.
const fs = require('fs');
const path = require('path');

const IMPORT = /^import\s+(?:\{[^}]*\}\s+from\s+)?(['"])([^'"\n]+)\1;?[ \t]*(?:\n|$)/gm;
const where = process.env.WSRC || path.join(__dirname, '..', '..', 'src', 'world');
const entries = where.split(path.delimiter).flatMap(f => {
  f = path.resolve(f);
  return fs.statSync(f).isDirectory() ? fs.readdirSync(f).filter(n => n.endsWith('.js')).sort().map(n => path.join(f, n)) : [f];
});
const code = [], seen = new Set();
const visit = file => {
  if (seen.has(file)) return;
  seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT)) visit(path.resolve(path.dirname(file), m[2]));
  code.push(src.replace(IMPORT, '').replace(/^export\s+/gm, ''));
};
entries.forEach(visit);

const prelude = "'use strict';\nconst location = { search: '?' + (process.env.QS || '') };\n";
const NAMES = ['WORLD_SEED', 'mulberry32', 'restAt', 'restOf', 'warpOf', 'fbm', 'vnoise', 'hashU', 'columnFields', 'seaLevelAt',
  'airAt', 'buoyAt', 'lift', 'settle', 'placeDome', 'growCell', 'pruneBubbles', 'dropAdrift', 'tierSites', 'subsidenceAt', 'tierCell',
  'TIERS', 'forEachTierCell', 'forEachDome', 'forEachSys', 'seaSurfaceAt', 'seaTopAt', 'cloudTopAt', 'towersNear', 'towerDistAt',
  'fillColumns', 'gatherBubbles', 'domeHeightAt', 'ellDist', 'worldGC', 'cellDensity', 'START_Y', 'WIND_ANG', 'SUN_DIR', 'CLOUD_TOP',
  'ORIGIN_Q', 'R_TH', 'H_FLAT', 'P_MIN', 'P_CUT', 'ALPHA', 'SUB_R'];
const ret = '\nreturn {' + NAMES.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '};';
module.exports = new Function(prelude + code.join('\n') + ret)();
module.exports.source = path.relative(process.cwd(), where) || where;
