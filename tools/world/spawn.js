// What the start looks like for several seeds: restlessness at and around the start, and the big
// towers within 50 km in the start view (bearing -0.24 .. 1.14 rad for a 16:9 screen at the start
// yaw of 0.45; bearing 0 = toward the sun). Each seed runs in its own process.
//
//   node tools/world/spawn.js [seed ...]       (default: 1 3 7 11 42 99 2024)
const { execFileSync } = require('child_process');
const seeds = process.argv.slice(2).length ? process.argv.slice(2) : ['1', '3', '7', '11', '42', '99', '2024'];
if (process.env.SPAWN_CHILD) {
  const t0 = Date.now(), W = require('./load.js'), drawMs = Date.now() - t0;
  const near = [0, 1, 2, 3, 4, 5, 6, 7].map(i => W.restAt(Math.sin(i * 0.785) * 5000, Math.cos(i * 0.785) * 5000)).reduce((a, b) => a + b) / 8;
  const ts = W.towersNear(0, 0, 50000).filter(t => { const a = Math.atan2(t.x, -t.z); return t.top > 8000 && a > -0.24 && a < 1.14; });
  console.log(`seed ${String(W.WORLD_SEED).padStart(5)}: world load ${drawMs} ms, restless at start ${W.restAt(0, 0).toFixed(2)}, within 5 km ${near.toFixed(2)}; towers > 8 km in view: ${ts.length}  ` +
    ts.map(t => `${(Math.hypot(t.x, t.z) / 1000).toFixed(0)} km/${(t.top / 1000).toFixed(1)}`).join(' '));
} else {
  for (const s of seeds) process.stdout.write(execFileSync(process.execPath, [__filename], { env: { ...process.env, SPAWN_CHILD: '1', QS: 'seed=' + s } }));
}
