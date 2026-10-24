// Clouds: what the trace, the shadow volume, the probe and the mist share
// The world lives in camera-centred clipmaps (render space: world minus a snapped origin):
// three 3D distance volumes of the large shapes (sea relief, heaps, towers), 128 m / 512 m / 2 km,
// each with a 2D map of per-column data, addressed toroidally so they stream as the bird flies.

export const GLSL_CLOUD = /* glsl */ `
uniform highp sampler3D uVol0;
uniform highp sampler3D uVol1;
uniform highp sampler3D uVol2;
uniform sampler2D uCol0;
uniform sampler2D uCol1;
uniform sampler2D uCol2;
uniform vec4 uLvA[3];       // per level: 1 / extent, toroidal offset x, z, 1 / height
uniform vec4 uLvV[3];       // per level: valid window (min x, min z, max x, max z)
uniform vec4 uTsvA;         // shadow volume: the same
uniform vec4 uTsvV;
uniform vec4 uWarpPh;       // phases of the billow warp at the render origin
uniform vec2 uWarpPh2;
uniform sampler3D uShape;
uniform sampler3D uDetail;
uniform sampler3D uTSV;
uniform vec3 uShapeOff;     // slow evolution of the sea billows (wrapped)
uniform vec3 uDetailOff;
uniform vec3 uSunDir;
uniform vec3 uSunCol[16];

const float INV2R = 0.5 / 6360000.0;
const float SEA_BASE = 520.0;
const float CLOUD_TOP = 14000.0;
const float SHAPE_TILE = 5120.0;
const float DETAIL_TILE = 512.0;
const float SIGMA = 0.035;        // extinction inside clouds (1/m)
const float EDGE_W = 80.0;        // soft boundary thickness (m)
const float LV_MARGIN[3] = float[3](80.0, 260.0, 750.0);   // interpolation error of each level

vec3 sunColorAt(float h) {
  float f = clamp(h / 750.0, 0.0, 14.99);
  int i = int(f);
  return mix(uSunCol[i], uSunCol[i + 1], f - float(i));
}

float octave(float d, float n, float shell, float k) {
  // spheres may only bulge out to "shell" beyond the current surface; the clip is wide and soft
  // so over-sized spheres become rounded swells instead of flat-topped plateaus
  n = smax(n, d - shell, max(k, shell * 1.6));
  // a tight union: crisp, defined creases between the billows (the clip above keeps every sphere
  // within the shell, so none floats detached)
  return smin(n, d, mix(max(k * 0.8, shell * 1.05), shell * 0.5 + 4.0, 0.7));
}
float shellOf(float a) { return 400.0 * a + 120.0; }    // highest billows above the large shapes

bool inLv(vec2 xz, int l) { vec4 v = uLvV[l]; return xz.x > v.x && xz.y > v.y && xz.x < v.z && xz.y < v.w; }
// the clipmap level for a sample at distance t (dithered handover); coarser outside a window
int levelAt(vec2 xz, float t, float dith) {
  int l = t < 7000.0 + 3000.0 * dith ? 0 : (t < 40000.0 + 15000.0 * dith ? 1 : 2);
  if (l == 0 && !inLv(xz, 0)) l = 1;
  if (l == 1 && !inLv(xz, 1)) l = 2;
  return l;
}
// distance to the large shapes (no billows yet) in level l
float macroAt(vec3 p, int l) {
  vec4 a = uLvA[l];
  vec3 uvw = vec3(p.x * a.x + a.y, p.z * a.x + a.z, p.y * a.w);
  if (l == 0) return textureLod(uVol0, uvw, 0.0).r;
  if (l == 1) return textureLod(uVol1, uvw, 0.0).r;
  if (!inLv(p.xz, 2)) return 20000.0;
  return textureLod(uVol2, uvw, 0.0).r;
}
// column data: sea surface with heaps, billow strength, fine billows, sea level without heaps
vec4 colAt(vec2 xz, int l) {
  vec4 a = uLvA[l];
  vec2 uv = vec2(xz.x * a.x + a.y, xz.y * a.x + a.z);
  if (l == 0) return textureLod(uCol0, uv, 0.0);
  if (l == 1) return textureLod(uCol1, uv, 0.0);
  return textureLod(uCol2, uv, 0.0);
}
// a slow, seamless warp of the billow pattern: waves of unrelated lengths, it never repeats
vec3 warpLand(vec3 p) {
  vec2 q = p.xz;
  return p + vec3(240.0 * sin(q.y * 8.37e-4 + uWarpPh.x + 1.3 * sin(q.x * 3.41e-4 + uWarpPh.y)) + 150.0 * sin(q.y * 2.53e-4 + q.x * 1.49e-4 + uWarpPh.z), 0.0,
                  240.0 * sin(q.x * 9.29e-4 + uWarpPh.w + 1.3 * sin(q.y * 3.97e-4 + uWarpPh2.x)) + 150.0 * sin(q.x * 1.93e-4 - q.y * 2.91e-4 + uWarpPh2.y));
}

// Signed distance (m) to the cloud surface: the large shapes (dm, from a clipmap) with billows of
// spheres heaped on them. C: column data. lod: 0 = full detail.
float cloudSDF(vec3 wp, float h, float dm, vec4 C, float lod) {
  // squashed lookup: billows are wider than tall (heaps, not balls)
  vec4 sf = textureLod(uShape, (warpLand(wp) + uShapeOff) * (vec3(1.0, 1.35, 1.0) / SHAPE_TILE), 0.0) * 2.0 - 1.0;
  sf *= 1.0 / 1.35;
  float A = C.y;
  float ds = octave(dm, sf.x * 1280.0, 300.0 * A, 300.0);
  ds = octave(ds, sf.y * 640.0, 160.0 * A, 160.0);
  // cauliflower detail on the upper parts of the sea and on everything heaped above it; the
  // troughs stay smooth
  float topW = sat((h - min(C.x, C.w + 100.0) + 40.0) / 220.0);
  float w3 = (1.0 - smoothstep(0.8, 2.0, lod)) * topW;
  float w4 = (1.0 - smoothstep(0.35, 1.0, lod)) * topW;
  ds = octave(ds, sf.z * 320.0, 56.0 * w3 * C.z, 90.0);
  ds = octave(ds, sf.w * 160.0, 26.0 * w4 * C.z, 45.0);
  float d = ds;
  // near the camera: an extra pair of small billow octaves (crisp cauliflower texture up close)
  if (lod < 0.15 && abs(d) < 80.0) {   // only matters right at the surface
    float wn = 1.0 - smoothstep(0.05, 0.15, lod);
    vec4 sn = textureLod(uShape, (wp + uShapeOff * 2.0) * (8.0 / SHAPE_TILE), 0.0) * 2.0 - 1.0;
    d = octave(d, sn.y * 80.0, 20.0 * wn, 16.0);
    d = octave(d, sn.z * 40.0, 10.0 * wn, 8.0);
  }
  return d;
}
// the same, looking up the large shapes and column data of level l
float sceneSDF(vec3 wp, float h, int l, float lod) {
  return cloudSDF(wp, h, macroAt(vec3(wp.x, h, wp.z), l), colAt(wp.xz, l), lod);
}

// density (0..1) from the signed distance with wispy erosion at the soft boundary.
// edgeW: boundary softness; nearW: weight of extra-fine wisps close to the camera; farW: coarse
// fraying for distant silhouettes
float densityEx(float d, vec3 wp, float detailW, float edgeW, float nearW, float farW) {
  float x = -d;
  if (x <= 0.0) return 0.0;
  float dens = sat(x / edgeW);
  float er = 0.0;
  if (detailW > 0.01 && x < edgeW * 2.5) {
    vec4 dn = textureLod(uDetail, (wp + uDetailOff) * (1.0 / DETAIL_TILE), 0.0);
    float e = mix(dn.g, dn.r, sat(x / (edgeW * 1.5)));
    if (nearW > 0.01) {
      vec4 dn2 = textureLod(uDetail, (wp + uDetailOff * 2.0) * (4.0 / DETAIL_TILE) + dn.a * 0.35, 0.0);
      e = mix(e, e * 0.6 + dn2.r * 0.55, nearW);
    }
    er = e * 0.36 * detailW;
  } else if (nearW > 0.01) {
    // inside a cloud near the camera: drifting density variations so mist visibly streams past
    vec4 dn = textureLod(uDetail, (wp + uDetailOff * 2.0) * (2.0 / DETAIL_TILE), 0.0);
    dens *= mix(1.0, 0.25 + 1.1 * dn.r * dn.r + 0.3 * dn.g, nearW);
  }
  // far away: coarse erosion of the outermost rim only, so distant silhouettes fray instead of
  // ending in smooth outlines (the faces themselves stay crisp)
  if (farW > 0.01 && x < edgeW) {
    vec4 fn = textureLod(uDetail, wp * (1.0 / 4096.0), 0.0);
    er = max(er, (0.65 * fn.g + 0.35 * fn.r) * 0.3 * farW * (1.0 - x / edgeW));
  }
  if (er > 0.0) dens = sat((dens - er) / max(1.0 - er, 0.15));
  return dens;
}
float densityFromSDF(float d, vec3 wp, float detailW, float edgeW, float nearW) {
  return densityEx(d, wp, detailW, edgeW, nearW, 0.0);
}

// optical depth toward the sun from the shadow volume (no shadows outside its window)
float tsvTau(vec3 wp, float h) {
  vec4 v = uTsvV;
  float w = min(min(wp.x - v.x, v.z - wp.x), min(wp.z - v.y, v.w - wp.z));
  if (w <= 0.0) return 0.0;
  return textureLod(uTSV, vec3(wp.x * uTsvA.x + uTsvA.y, wp.z * uTsvA.x + uTsvA.z, h * uTsvA.w), 0.0).r * sat(w / 8000.0);
}

float HG(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}
// Multiple scattering approximation (Wrenninge): sum of octaves with reduced extinction & anisotropy
vec4 phaseOctaves(float c) {
  return vec4(mix(HG(c, -0.3), HG(c, 0.8), 0.62), mix(HG(c, -0.15), HG(c, 0.4), 0.62),
              mix(HG(c, -0.075), HG(c, 0.2), 0.62), mix(HG(c, -0.0375), HG(c, 0.1), 0.62));
}
float msScatterP(float tau, vec4 ph) {
  vec4 e = exp(-tau * vec4(1.0, 0.5, 0.25, 0.125));
  return dot(e * vec4(1.0, 0.55, 0.3025, 0.166375), ph);
}

// Optical depth toward the sun from a point (short march with growing steps). nS: how much the
// surface there faces the sun (-1..1), from the distance field along the first two steps.
// l, C: clipmap level and column data of the starting point.
float lightTauN(vec3 wp0, float h0, int l, vec4 C, float jit, float lod0, out float nS) {
  float tau = 0.0, s = 0.0, ds = 25.0, d1 = 0.0, s1 = 0.0;
  nS = 0.0;
  for (int i = 0; i < 5; i++) {
    float sm = s + ds * (0.25 + 0.5 * jit);
    vec3 wp = wp0 + uSunDir * sm;
    float h = h0 + uSunDir.y * sm;
    // the first steps keep the detail of the view sample: bulges shade themselves at any range
    float d = cloudSDF(wp, h, macroAt(vec3(wp.x, h, wp.z), l), C, lod0 + float(max(i - 1, 0)) * 0.6);
    if (i == 0) { d1 = d; s1 = sm; }
    else if (i == 1) nS = clamp((d - d1) / (sm - s1), -1.0, 1.0);
    // near steps: point density; long far steps: smooth coverage estimate (no contour rings)
    // the density ramp widens with the step length so long steps don't switch abruptly (and is
    // sharp right at the start, so each bulge shades the one beside it)
    tau += sat(-d / (mix(30.0, EDGE_W, sat(s / 200.0)) + ds * 0.35)) * ds * SIGMA;
    s += ds;
    ds *= 2.4;
  }
  return tau;
}
float lightTau(vec3 wp0, float h0, int l, vec4 C, float jit, float lod0) {
  float nS;
  return lightTauN(wp0, h0, l, C, jit, lod0, nS);
}
`;
