// Pure image helpers for the tools: crops, zooms, tiles, the compares' diff (tools/screenshot.js)
// and the measurements' banding, flicker, tone and contrast by octave (tools/measure.js). Images are { width, height, data },
// data RGBA bytes, rows from the top, as tools/png.js decodes them. Tested in tests/image.test.js.

export function createImage(width, height, [r, g, b] = [0, 0, 0]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

// The w x h region at (x, y), clamped to the image.
export function crop(image, x, y, w, h) {
  x = Math.max(0, Math.min(Math.round(x), image.width - 1));
  y = Math.max(0, Math.min(Math.round(y), image.height - 1));
  w = Math.min(w, image.width - x);
  h = Math.min(h, image.height - y);
  const out = createImage(w, h);
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * image.width + x) * 4;
    out.data.set(image.data.subarray(from, from + w * 4), row * w * 4);
  }
  return out;
}

// Integer upscale with hard pixel edges, so single pixels stay visible.
export function zoom(image, factor) {
  const out = createImage(image.width * factor, image.height * factor);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const from = (Math.floor(y / factor) * image.width + Math.floor(x / factor)) * 4;
      out.data.set(image.data.subarray(from, from + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

// Integer downscale by averaging factor x factor blocks.
export function shrink(image, factor) {
  const w = Math.floor(image.width / factor);
  const h = Math.floor(image.height / factor);
  const out = createImage(w, h);
  const area = factor * factor;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) sum += image.data[((y * factor + dy) * image.width + x * factor + dx) * 4 + c];
        }
        out.data[(y * w + x) * 4 + c] = Math.round(sum / area);
      }
    }
  }
  return out;
}

// Lays images out left to right, top to bottom, in cells the size of the largest one.
export function tile(images, { columns = images.length, gap = 0, background = [21, 23, 26] } = {}) {
  const cellW = Math.max(...images.map((i) => i.width));
  const cellH = Math.max(...images.map((i) => i.height));
  const rows = Math.ceil(images.length / columns);
  const out = createImage(columns * cellW + (columns - 1) * gap, rows * cellH + (rows - 1) * gap, background);
  images.forEach((image, n) => {
    const x0 = (n % columns) * (cellW + gap);
    const y0 = Math.floor(n / columns) * (cellH + gap);
    for (let row = 0; row < image.height; row++) {
      out.data.set(image.data.subarray(row * image.width * 4, (row + 1) * image.width * 4), ((y0 + row) * out.width + x0) * 4);
    }
  });
  return out;
}

// How B differs from A, drawn as the compare sheet draws it: B dimmed to grey, every pixel that
// changed in magenta, brighter the larger the largest channel's change, faint for 1 or 2 levels.
// Returns { image, changed, large (more than 2 levels), max, total } (counts of pixels).
export function diffImage(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('images of different sizes');
  const image = createImage(a.width, a.height);
  let changed = 0, large = 0, max = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a.data[i + c] - b.data[i + c]));
    const grey = 0.25 * (0.2126 * b.data[i] + 0.7152 * b.data[i + 1] + 0.0722 * b.data[i + 2]);
    const k = d === 0 ? 0 : d <= 2 ? 0.15 : Math.min(1, 0.3 + d / 48);
    image.data[i] = Math.round(grey + (255 - grey) * k);
    image.data[i + 1] = Math.round(grey + (40 - grey) * k);
    image.data[i + 2] = Math.round(grey + (200 - grey) * k);
    if (d) {
      changed++;
      if (d > 2) large++;
      max = Math.max(max, d);
    }
  }
  return { image, changed, large, max, total: a.width * a.height };
}

// Contrast-boosted copy: each channel's deviation from its local mean, times `gain`, around
// mid-grey. Banding shows up as contour lines that follow the gradient; dithering (the final
// pass's grain) as fine noise; flat areas stay grey. Real edges (any channel off its local mean
// by more than `edge` levels) are drawn in flat dark grey, so they don't drown out bands of a
// level or two.
export function bandingView(image, { radius = 6, gain = 32, edge = 6 } = {}) {
  const { width, height } = image;
  const n = width * height;
  const out = createImage(width, height);
  const channel = new Float32Array(n);
  const blurred = new Float32Array(n);
  const scratch = new Float32Array(n);
  const isEdge = new Uint8Array(n);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < n; i++) channel[i] = image.data[4 * i + c];
    boxBlur(channel, blurred, scratch, width, height, radius);
    for (let i = 0; i < n; i++) {
      const deviation = channel[i] - blurred[i];
      if (Math.abs(deviation) > edge) isEdge[i] = 1;
      out.data[4 * i + c] = clamp(128 + gain * deviation);
    }
  }
  for (let i = 0; i < n; i++) if (isEdge[i]) out.data.set([64, 64, 64], 4 * i);
  return out;
}

// Share of the image (percent) in visible bands: runs of at least `minRun` identical pixels
// along a row or a column whose neighbouring run differs by 1 to `maxStep` levels, the
// staircase of an undithered gradient (a sky's runs down the columns). Dither breaks such runs
// up; flat areas and real edges have no stepped neighbour.
export function bandedShare({ width, height, data }, { minRun = 16, maxStep = 3 } = {}) {
  const banded = new Uint8Array(width * height);
  // Marks the banded runs along `lines` lines of `length` pixels; pixel(line, k) is the pixel index.
  const scan = (lines, length, pixel) => {
    for (let line = 0; line < lines; line++) {
      const runs = [];
      for (let k = 0, start = 0; k <= length; k++) {
        const i = 4 * pixel(line, k);
        const j = 4 * pixel(line, start);
        if (k < length && data[i] === data[j] && data[i + 1] === data[j + 1] && data[i + 2] === data[j + 2]) continue;
        runs.push({ start, length: k - start, at: j });
        start = k;
      }
      const stepped = (a, b) => {
        if (!b || a.length < minRun || b.length < minRun) return false;
        const d = Math.max(...[0, 1, 2].map((c) => Math.abs(data[a.at + c] - data[b.at + c])));
        return d >= 1 && d <= maxStep;
      };
      runs.forEach((run, n) => {
        if (!stepped(run, runs[n - 1]) && !stepped(run, runs[n + 1])) return;
        for (let k = run.start; k < run.start + run.length; k++) banded[pixel(line, k)] = 1;
      });
    }
  };
  scan(height, width, (y, x) => y * width + x);
  scan(width, height, (x, y) => y * width + x);
  return (100 * banded.reduce((sum, b) => sum + b, 0)) / (width * height);
}

// How much frames of a scene that should hold still differ: `heat` holds each pixel's largest
// channel range (max - min across the frames, in 8-bit levels), and `percent` is the share of
// pixels whose range reaches `threshold`, as heatImage() marks them.
export function flicker(frames, { threshold = 4 } = {}) {
  const n = frames[0].width * frames[0].height;
  const heat = new Float32Array(n);
  let flickering = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 4 * i; c < 4 * i + 3; c++) {
      let min = 255;
      let max = 0;
      for (const frame of frames) {
        const v = frame.data[c];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (max - min > heat[i]) heat[i] = max - min;
    }
    if (heat[i] >= threshold) flickering++;
  }
  return { percent: (100 * flickering) / n, heat };
}

// How much pairs of frames differ: `heat` holds each pixel's largest channel difference over the
// pairs, `percent` the share of pixels differing by `threshold` or more, as a mean over the pairs,
// and `regions` the same within each region ({ name: [x, y, w, h] } as fractions of the frame from
// its top left). (The grain: two renders of one flight whose jitter differs, tools/measure.js.)
export function pairDiff(pairs, { threshold = 4, regions = {} } = {}) {
  const { width, height } = pairs[0][0];
  const n = width * height;
  const heat = new Float32Array(n);
  const boxes = Object.entries(regions).map(([name, [x, y, w, h]]) => ({
    name, x0: Math.round(x * width), y0: Math.round(y * height), x1: Math.round((x + w) * width), y1: Math.round((y + h) * height), hits: 0,
  }));
  let hits = 0;
  for (const [{ data: a }, { data: b }] of pairs) {
    for (let i = 0; i < n; i++) {
      const c = 4 * i;
      const d = Math.max(Math.abs(a[c] - b[c]), Math.abs(a[c + 1] - b[c + 1]), Math.abs(a[c + 2] - b[c + 2]));
      if (d > heat[i]) heat[i] = d;
      if (d < threshold) continue;
      hits++;
      const x = i % width;
      const y = (i - x) / width;
      for (const r of boxes) if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) r.hits++;
    }
  }
  const share = (count, area) => (area > 0 ? (100 * count) / (area * pairs.length) : 0);
  return {
    percent: share(hits, n),
    regions: Object.fromEntries(boxes.map((r) => [r.name, share(r.hits, (r.x1 - r.x0) * (r.y1 - r.y0))])),
    heat,
  };
}

// (Rec. 709's weights on the sRGB levels, as the shaders' luma)
const lumaAt = (data, i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

// The tone of an image, as a photographer reads one: the share of its pixels (percent) whose luma
// lies under `dark` and over `bright` (of 255), and the mean colour of its darkest third and of its
// brightest tenth, [r, g, b] in levels (a navy shade, a tan light). Pixels are counted by their
// luma rounded to a level, a third or a tenth cut at a pixel.
export function tone({ width, height, data }, { dark = 96, bright = 200 } = {}) {
  const n = width * height;
  const count = new Float64Array(256);
  const sums = new Float64Array(256 * 3);
  for (let i = 0; i < 4 * n; i += 4) {
    const l = Math.round(lumaAt(data, i));
    count[l]++;
    for (let c = 0; c < 3; c++) sums[3 * l + c] += data[i + c];
  }
  // the mean colour of the `share` of pixels from level `from` on, `step` a level
  const meanOf = (share, from, step) => {
    let want = share * n, got = 0;
    const rgb = [0, 0, 0];
    for (let l = from; l >= 0 && l < 256 && want > 0; l += step) {
      const k = Math.min(count[l], want);
      if (k > 0) for (let c = 0; c < 3; c++) rgb[c] += (sums[3 * l + c] / count[l]) * k;
      got += k;
      want -= k;
    }
    return rgb.map((v) => (got > 0 ? Math.round(v / got) : 0));
  };
  let under = 0, over = 0;
  for (let l = 0; l < 256; l++) {
    if (l < dark) under += count[l];
    if (l > bright) over += count[l];
  }
  return { darkPercent: (100 * under) / n, brightPercent: (100 * over) / n, shade: meanOf(1 / 3, 0, 1), light: meanOf(0.1, 255, -1) };
}

// The contrast of an image octave by octave: a Laplacian pyramid of its luma, each band's root
// mean square in levels, the finest first (band k holds what is 2^k to 2^(k+1) pixels across), as
// many bands as halvings leave at least 4 pixels a side, up to `bands`. Natural texture spreads
// its contrast about evenly over the octaves; beads of one size are a bump at theirs, a blank
// gradient a steep slope down to the finest.
export function octaves({ width, height, data }, { bands = 6 } = {}) {
  let level = { w: width, h: height, v: new Float32Array(width * height) };
  for (let i = 0; i < width * height; i++) level.v[i] = lumaAt(data, 4 * i);
  const out = [];
  while (out.length < bands && level.w >= 8 && level.h >= 8) {
    const coarse = halve(level);
    let sq = 0;
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const d = level.v[y * level.w + x] - upsampled(coarse, x, y);
        sq += d * d;
      }
    }
    out.push(Math.sqrt(sq / (level.w * level.h)));
    level = coarse;
  }
  return out;
}

// (a pyramid's next level: 2 × 2 means, an odd last row or column dropped)
function halve({ w, h, v }) {
  const W = w >> 1, H = h >> 1, out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = 2 * y * w + 2 * x;
      out[y * W + x] = 0.25 * (v[i] + v[i + 1] + v[i + w] + v[i + w + 1]);
    }
  }
  return { w: W, h: H, v: out };
}

// (the coarser level at the finer level's pixel (x, y), interpolated between its texels' centres)
function upsampled({ w, h, v }, x, y) {
  const fx = Math.min(Math.max((x + 0.5) / 2 - 0.5, 0), w - 1), fy = Math.min(Math.max((y + 0.5) / 2 - 0.5, 0), h - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const tx = fx - x0, ty = fy - y0;
  const top = v[y0 * w + x0] * (1 - tx) + v[y0 * w + x1] * tx;
  const bottom = v[y1 * w + x0] * (1 - tx) + v[y1 * w + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

// A dimmed grey copy of `base` with every pixel whose heat reaches `threshold` in magenta, grown
// to its four neighbours so single pixels show, and fainter tints for heat under the threshold.
export function heatImage(base, heat, threshold) {
  const { width, height } = base;
  const out = createImage(width, height);
  const d = base.data;
  const hot = (x, y) => x >= 0 && y >= 0 && x < width && y < height && heat[y * width + x] >= threshold;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const grey = 0.6 * (0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]);
      const near = hot(x, y) || hot(x - 1, y) || hot(x + 1, y) || hot(x, y - 1) || hot(x, y + 1);
      const k = near ? 1 : 0.4 * (heat[i] / threshold);
      out.data[4 * i] = grey + (255 - grey) * k;
      out.data[4 * i + 1] = grey + (40 - grey) * k;
      out.data[4 * i + 2] = grey + (200 - grey) * k;
    }
  }
  return out;
}

// Separable box blur with a (2r+1)-wide window, shrunk at the borders.
function boxBlur(src, dst, scratch, width, height, r) {
  for (let y = 0; y < height; y++) blurLine(src, scratch, y * width, 1, width, r);
  for (let x = 0; x < width; x++) blurLine(scratch, dst, x, width, height, r);
}

function blurLine(src, dst, start, step, n, r) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i <= Math.min(r, n - 1); i++) {
    sum += src[start + i * step];
    count++;
  }
  for (let i = 0; i < n; i++) {
    dst[start + i * step] = sum / count;
    if (i + r + 1 < n) {
      sum += src[start + (i + r + 1) * step];
      count++;
    }
    if (i - r >= 0) {
      sum -= src[start + (i - r) * step];
      count--;
    }
  }
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}
