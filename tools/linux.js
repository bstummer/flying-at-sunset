// Runs a command in a Linux container like CI's runner (tools/linux.Dockerfile),
// with the repo mounted, for machines whose own Chromium lacks what CI has:
// on Windows, WebGPU has no SwiftShader adapter, so SwiftShader captures that
// compare with CI's come from here.
//
//   node tools/linux.js npm run verify:ci          (verify as CI runs it)
//   node tools/linux.js node tools/screenshot.js --gl swiftshader --size 320x180 --frames 8 --no-measurements --views start,tower
//
// Needs Docker, running. The image is built on first use (and again when the
// Dockerfile or the Playwright of package-lock.json changes: the image installs
// that version's system libraries). node_modules and Playwright's browsers live
// in Docker volumes, as the host's are for another OS; `npm ci` runs there
// whenever package-lock.json changed.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCKERFILE = join(ROOT, 'tools', 'linux.Dockerfile');
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12);
const PLAYWRIGHT = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')).packages['node_modules/playwright'].version;
const IMAGE = `flying-at-sunset-linux:${hash(DOCKERFILE)}-playwright-${PLAYWRIGHT}`;
const VOLUMES = ['-v', 'flying-at-sunset-node-modules:/repo/node_modules', '-v', 'flying-at-sunset-browsers:/root/.cache/ms-playwright'];

function docker(args, options = {}) {
  const result = spawnSync('docker', args, { stdio: 'inherit', ...options });
  if (result.error) throw new Error(`docker: ${result.error.message}. Is Docker running?`);
  return result.status ?? 1;
}

function run(command) {
  return docker(['run', '--rm', '--init', '--shm-size=2g', '-v', `${ROOT}:/repo`, ...VOLUMES, '-e', 'CI', IMAGE, 'bash', '-c', command]);
}

function main(args) {
  if (!args.length) {
    console.log('usage: node tools/linux.js <command> [args...]');
    return 2;
  }
  let images;
  try {
    images = execFileSync('docker', ['images', '-q', IMAGE], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch (err) {
    const why = err.code === 'ENOENT' ? 'Docker is not installed' : (err.stderr?.toString().trim().split('\n')[0] || err.message);
    console.error(`linux: ${why}. Is Docker running?`);
    return 1;
  }
  const build = ['build', '-t', IMAGE, '--build-arg', `PLAYWRIGHT=${PLAYWRIGHT}`, '-f', DOCKERFILE, join(ROOT, 'tools')];
  if (!images && docker(build) !== 0) return 1;

  const lock = hash(join(ROOT, 'package-lock.json'));
  const stamp = 'node_modules/.linux-lock';
  const install = `[ "$(cat ${stamp} 2>/dev/null)" = "${lock}" ] || { npm ci --no-audit --no-fund && echo ${lock} > ${stamp}; }`;
  const quoted = args.map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' ');
  return run(`${install} && ${quoted}`);
}

process.exitCode = main(process.argv.slice(2));
