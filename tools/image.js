// Pure image helpers for the tools: crops, zooms, tiles, the compares' diff (tools/screenshot.js)
// and the measurements' banding and flicker (tools/measure.js). Images are { width, height, data },
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
