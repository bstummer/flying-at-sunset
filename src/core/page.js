// The page: its elements, the note shown when something fails, a request it refuses, the kind of
// pointer, fullscreen (a double-click or F)

import { TEST } from './params.js';

if (TEST) document.documentElement.classList.add('test');

export const canvas = document.getElementById('view');
export const hintEl = document.getElementById('hint');
const noteEl = document.getElementById('note');
export const touchEl = document.getElementById('touch');

export const COARSE = matchMedia('(pointer: coarse)').matches;   // primary pointer is a finger

export function fail(msg) {
  noteEl.style.display = 'flex';
  noteEl.textContent = msg;
  window.__error = msg;
  console.error(msg);
}

// A request the page can't serve (a URL parameter it can't read, a test view or route it doesn't
// have): in the test mode an error, which fails the capture (the first one names it); otherwise a
// warning, and the piece goes on without it.
export function refuse(why) {
  if (TEST) window.__error ||= why; else console.warn(why);
}

function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const el = d.documentElement; const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req) { const pr = req.call(el); if (pr && pr.catch) pr.catch(() => {}); } }
}
canvas.addEventListener('dblclick', toggleFullscreen);
window.addEventListener('keydown', e => { if (e.code === 'KeyF' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) toggleFullscreen(); });
