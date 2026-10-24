// A camera pose looking at a point, for `?test&pose=x,y,z,yaw,pitch` (or tools/render.sh name=pose:...).
//
//   node tools/world/pose.js tx tz dist azDeg [y] [pitch]
//     -> x,y,z,yaw,pitch : standing `dist` m from (tx, tz) at azimuth azDeg (0 = on the -Z side,
//        the sun's; 90 = on the +X side), at height y (default 900 m above the cloud sea there),
//        looking at the point; pitch in radians (default 0.08)
//   node tools/world/pose.js --towers [R]      list towers near the start to pick from
const W = require('./load.js');
if (process.argv[2] === '--towers') {
  const R = +(process.argv[3] || 60000);
  for (const t of W.towersNear(0, 0, R).filter(t => t.top > 6000).sort((a, b) => b.top - a.top).slice(0, 20))
    console.log(`tower at ${t.x.toFixed(0)} ${t.z.toFixed(0)}  top ${(t.top / 1000).toFixed(1)} km  wide ${(t.wide / 1000).toFixed(1)} km  P ${t.P.toFixed(0)}`);
  process.exit(0);
}
const [tx, tz, dist, az, yy, gam] = process.argv.slice(2).map(Number);
if ([tx, tz, dist, az].some(v => isNaN(v))) { console.error('usage: pose.js tx tz dist azDeg [y] [pitch]  |  pose.js --towers [R]'); process.exit(2); }
const a = az * Math.PI / 180, x = tx + Math.sin(a) * dist, z = tz - Math.cos(a) * dist;
const y = isNaN(yy) ? W.seaSurfaceAt(x, z).floor + 900 : yy;
console.log([x.toFixed(0), y.toFixed(0), z.toFixed(0), Math.atan2(tx - x, -(tz - z)).toFixed(3), isNaN(gam) ? 0.08 : gam].join(','));
