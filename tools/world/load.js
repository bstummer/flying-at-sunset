// Load the CPU world generator (everything between the "world constants" and "WORLD END" markers of
// index.html) into Node, so the world can be generated, measured and drawn without a browser.
//
//   const W = require('./load.js');          // the world of index.html, seed 7
//   WSRC=path/to/file node tool.js           // another page, or a .js file holding the world
//   WSRC=src/a.js:src/b.js node tool.js      // the world split over several files, in this order
//   QS="seed=3&towers=1.5" node tool.js      // URL parameters the world code reads (Q)
//
// The world code uses a few helpers defined earlier in the page (the "small math kit"); the prelude
// below repeats them exactly. If the project is split into modules, either keep the markers in the
// built page (and point WSRC at it) or point WSRC at the world's source files: their import lines
// are dropped (the prelude provides the math kit) and export keywords removed. The names handed
// back are listed in NAMES.
const fs = require('fs');
const path = require('path');

const files = (process.env.WSRC || path.join(__dirname, '..', '..', 'index.html')).split(path.delimiter).map(f => path.resolve(f));
const A = '// ------------------------------------------------------------------ world constants';
const B = '// ==== WORLD END';
const plain = s => s
  .replace(/^[ \t]*import\s[^;]*?from\s*['"][^'"\n]+['"][ \t]*;?|^[ \t]*import\s*['"][^'"\n]+['"][ \t]*;?/gm, '')
  .replace(/^[ \t]*export\s*(\{[^}]*\}|\*(\s+as\s+\w+)?)(\s*from\s*['"][^'"\n]+['"])?[ \t]*;?/gm, '')
  .replace(/^([ \t]*)export\s+(default\s+)?/gm, '$1');
const body = files.map(file => {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes(A) && src.includes(B)) return src.slice(src.indexOf(A), src.indexOf(B));
  if (/\.m?js$/.test(file)) return plain(src);
  throw new Error(`no world section (markers "${A}" .. "${B}") in ${file}`);
}).join('\n');

const prelude = `
const Q = new URLSearchParams(process.env.QS || '');
const PI = Math.PI, DEG = PI / 180;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sat = x => clamp(x, 0, 1);
const smoothstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
`;
const NAMES = ['WORLD_SEED', 'restAt', 'restOf', 'warpOf', 'fbm', 'vnoise', 'hashU', 'columnFields', 'seaLevelAt', 'airAt', 'buoyAt',
  'lift', 'settle', 'placeDome', 'growCell', 'pruneBubbles', 'dropAdrift', 'tierSites', 'subsidenceAt', 'tierCell', 'TIERS',
  'forEachTierCell', 'forEachDome', 'forEachSys', 'seaSurfaceAt', 'seaTopAt', 'cloudTopAt', 'towersNear', 'towerDistAt',
  'fillColumns', 'gatherBubbles', 'domeHeightAt', 'ellDist', 'worldGC', 'cellDensity', 'START_Y', 'WIND_ANG', 'SUN_DIR',
  'CLOUD_TOP', 'ORIGIN_Q', 'R_TH', 'H_FLAT', 'P_MIN', 'P_CUT', 'ALPHA', 'SUB_R'];
const ret = '\nreturn {' + NAMES.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '};';
module.exports = new Function(prelude + body + ret)();
module.exports.mulberry32 = new Function(prelude + 'return mulberry32;')();
module.exports.source = files.join(path.delimiter);
