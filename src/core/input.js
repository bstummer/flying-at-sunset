// Steering: mouse, touch, keys, gamepad, or a route
//
// Mouse: the pointer's offset from the centre, with a dead zone and shaping. Touch: the drag from
// where the finger landed, shown by a ring that follows a finger dragged past it. Keys: arrows and
// WASD (Cmd/Ctrl/Alt combinations are shortcuts, not steering; releasing Meta clears held keys, as
// macOS drops their key-ups). Gamepad: the left stick. The pointer leaving the window levels the
// bird out. A route (input.script) steers instead of all of them: the benchmark's
// (core/benchmark.js), the test mode's (core/capture.js). updateInput smooths what steers into
// input.sx and sy (keys ramp in slower) and counts how long the viewer has steered (the hint).

import { canvas, touchEl } from './page.js';
import { damp } from '../math.js';

export const input = {
  mouse: null, touch: null, keys: new Set(), sx: 0, sy: 0, activeTime: 0,
  script: null,   // (time) => [right, up] in -1..1: a route that steers instead of the viewer
};

function shaping(v, dead) {
  const a = Math.abs(v);
  if (a < dead) return 0;
  const t = (a - dead) / (1 - dead);
  return Math.sign(v) * Math.pow(t, 1.35);
}

function bindInput() {
  const minDim = () => Math.min(innerWidth, innerHeight);
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
      input.mouse = { x: e.clientX, y: e.clientY };
    } else if (input.touch && e.pointerId === input.touch.id) {
      const r = minDim() * 0.16;
      let dx = (e.clientX - input.touch.ox) / r, dy = (e.clientY - input.touch.oy) / r;
      const l = Math.hypot(dx, dy);
      if (l > 1) { input.touch.ox = e.clientX - dx / l * r; input.touch.oy = e.clientY - dy / l * r; dx /= l; dy /= l; }
      input.touch.x = dx; input.touch.y = dy;
      input.touch.cx = e.clientX; input.touch.cy = e.clientY;
    }
  });
  canvas.addEventListener('pointerdown', e => {
    canvas.focus({ preventScroll: true });
    if (e.pointerType !== 'mouse' && !input.touch) {
      input.touch = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0, cx: e.clientX, cy: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
  });
  const endTouch = e => { if (input.touch && e.pointerId === input.touch.id) input.touch = null; };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  // pointer left the window: level out (document mouseleave alone does not fire in every browser)
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') input.mouse = null; });
  document.addEventListener('mouseleave', () => { input.mouse = null; });
  window.addEventListener('blur', () => { input.mouse = null; input.keys.clear(); });
  const keyMap = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;   // browser and system shortcuts
    const k = keyMap[e.code]; if (k) { input.keys.add(k); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => {
    const k = keyMap[e.code]; if (k) input.keys.delete(k);
    if (e.key === 'Meta') input.keys.clear();   // macOS drops key-ups of keys released while Cmd is held
  });
  window.addEventListener('contextmenu', e => e.preventDefault());
}
bindInput();

export function updateInput(dt, time) {
  let tx = 0, ty = 0, kind = 'none';
  if (input.keys.size) {
    tx = (input.keys.has('r') ? 1 : 0) - (input.keys.has('l') ? 1 : 0);
    ty = (input.keys.has('u') ? 1 : 0) - (input.keys.has('d') ? 1 : 0);
    kind = 'keys';
  } else if (input.touch) {
    tx = input.touch.x; ty = -input.touch.y; kind = 'touch';
  } else if (input.mouse) {
    const s = Math.min(innerWidth, innerHeight) * 0.42;
    tx = (input.mouse.x - innerWidth / 2) / s;
    ty = -(input.mouse.y - innerHeight * 0.5) / s;
    const l = Math.hypot(tx, ty);
    if (l > 1) { tx /= l; ty /= l; }
    tx = shaping(tx, 0.06); ty = shaping(ty, 0.08);
    kind = 'mouse';
  }
  // gamepad
  let pads = [];
  try { pads = navigator.getGamepads ? navigator.getGamepads() || [] : []; } catch (_) { /* blocked by policy */ }
  for (const gp of pads) {
    if (!gp) continue;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.hypot(ax, ay) > 0.15) { tx = shaping(ax, 0.12); ty = -shaping(ay, 0.12); kind = 'pad'; }
  }
  if (input.script) { [tx, ty] = input.script(time); kind = 'script'; }
  // smooth: keys ramp in gently; analog inputs follow a little faster
  const k = kind === 'keys' ? 2.6 : 5.5;
  input.sx = damp(input.sx, tx, k, dt);
  input.sy = damp(input.sy, ty, k, dt);
  if (Math.abs(tx) + Math.abs(ty) > 0.15) input.activeTime += dt;
  input.kind = kind;   // (which steers: for window.__debug)
  // touch indicator
  if (input.touch) {
    touchEl.classList.add('on');
    touchEl.children[0].style.left = input.touch.ox + 'px'; touchEl.children[0].style.top = input.touch.oy + 'px';
    touchEl.children[1].style.left = input.touch.cx + 'px'; touchEl.children[1].style.top = input.touch.cy + 'px';
  } else touchEl.classList.remove('on');
}
