// The labels the tools name their output by in screenshots/: a capture's folder
// (tools/screenshot.js), a flight log's file (tools/flights.js). A module of its own: a tool must
// not import another tool, whose main would wait for it (tests/layout.test.js).
import { execFileSync } from 'node:child_process';
import { ROOT } from './browser.js';

// The tools' own folders in screenshots/, which no label may name.
const RESERVED_LABELS = {
  compare: 'compare sheets go there', world: 'the world tools write their images there',
  checks: 'tools/checks.js run alone writes its images there', flights: 'tools/flights.js writes its logs there',
};

// The commit the tools ran on: its short hash, with '-dirty' when the working tree has changes.
export function gitDescribe() {
  try {
    const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return `${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain') ? '-dirty' : ''}`;
  } catch {
    return 'nogit';
  }
}

// Without --label: the commit and the time (UTC), e.g. bc1fca3-dirty-20261116-222343.
export function defaultLabel() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return `${gitDescribe()}-${stamp}`;
}

// The name in screenshots/ a label gives: the label with each run of anything but letters,
// digits, '_', '.' and '-' made a '-', and without trailing dots, which Windows drops.
// Throws for a label that names nothing of its own there: one without a letter or digit
// ('', '.', '..'), or one of the tools' own folders, in any case.
export function labelFolder(label) {
  const folder = String(label).replace(/[^\w.-]+/g, '-').replace(/\.+$/, '');
  if (!/[a-z\d]/i.test(folder)) throw new Error(`the label "${label}" needs a letter or a digit`);
  const name = folder.toLowerCase();
  if (Object.hasOwn(RESERVED_LABELS, name)) throw new Error(`the label "${label}" is taken: ${RESERVED_LABELS[name]}`);
  return folder;
}
