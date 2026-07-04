// ═══════════════════════════════════════════════════════════════════════════
// FABLE TEXT LIB — shared helpers for the text motion-graphics patterns
//
// FABLE_TEXT_EVAL_LIB is prepended to pattern evaluateSource strings (like
// FABLE_EVAL_LIB). It rasterizes text with Canvas2D into fixed-size float
// RGBA textures (white ink, alpha = coverage) that flow to the GPU via the
// initData mechanism, plus an exact Euclidean distance transform for SDF
// text (crisp edges at any zoom, outlines, glow, 3D extrusion).
// ═══════════════════════════════════════════════════════════════════════════

export const FABLE_FONT_NAMES = ['sans', 'serif', 'mono', 'display', 'script']
export const FABLE_WEIGHT_NAMES = ['light', 'regular', 'bold', 'black']

export const FABLE_TEXT_EVAL_LIB = `
var FABLE_FONT_STACKS = {
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: '"SF Mono", Menlo, Consolas, "Courier New", monospace',
  display: '"Arial Black", "Avenir Next Heavy", "Helvetica Neue", sans-serif',
  script: '"Snell Roundhand", "Brush Script MT", "Segoe Script", cursive',
};
var FABLE_FONT_LIST = ['sans', 'serif', 'mono', 'display', 'script'];
var FABLE_WEIGHT_LIST = ['300', '400', '700', '900'];

// Rasterize text lines into a W×H float RGBA buffer (white, alpha=coverage).
// lines: [{ text, size, weight, gapBefore }] — size/gap in relative units,
// scaled uniformly so everything fits. opts: { width, height, font (index or
// name), pad, align ('center'|'left'|'right'), letterSpacing (em fraction) }.
function fableRasterText(lines, opts) {
  var W = opts.width || 1024, H = opts.height || 256;
  var fontName = typeof opts.font === 'number'
    ? FABLE_FONT_LIST[Math.max(0, Math.min(Math.round(opts.font), FABLE_FONT_LIST.length - 1))]
    : (opts.font || 'sans');
  var stack = FABLE_FONT_STACKS[fontName] || FABLE_FONT_STACKS.sans;
  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var c2 = canvas.getContext('2d');
  c2.clearRect(0, 0, W, H);
  c2.fillStyle = '#ffffff';
  c2.textBaseline = 'middle';
  var align = opts.align || 'center';
  c2.textAlign = align;

  var pad = opts.pad != null ? opts.pad : 0.07;
  var totalRel = 0, maxW = 0.0001;
  for (var i = 0; i < lines.length; i++) {
    totalRel += (lines[i].size || 1) + (lines[i].gapBefore || 0);
    c2.font = (lines[i].weight || '700') + ' 100px ' + stack;
    var w = c2.measureText(lines[i].text || ' ').width / 100 * (lines[i].size || 1);
    w *= 1 + (opts.letterSpacing || 0) * 0.9;
    if (w > maxW) maxW = w;
  }
  var unit = Math.min(H * (1 - 2 * pad) / totalRel, W * (1 - 2 * pad) / maxW);
  var x = align === 'left' ? W * pad : (align === 'right' ? W * (1 - pad) : W / 2);
  var y = H / 2 - totalRel * unit / 2;
  for (var i = 0; i < lines.length; i++) {
    y += (lines[i].gapBefore || 0) * unit;
    var px = Math.max((lines[i].size || 1) * unit, 1);
    c2.font = (lines[i].weight || '700') + ' ' + px.toFixed(1) + 'px ' + stack;
    try { c2.letterSpacing = ((opts.letterSpacing || 0) * px).toFixed(1) + 'px'; } catch (e) {}
    c2.fillText(lines[i].text || '', x, y + px * 0.54);
    y += px;
  }

  var img = c2.getImageData(0, 0, W, H).data;
  var data = new Float32Array(W * H * 4);
  // canvas rows are top-down, GL textures bottom-up
  for (var row = 0; row < H; row++) {
    var src = (H - 1 - row) * W * 4, dst = row * W * 4;
    for (var xx = 0; xx < W * 4; xx += 4) {
      var a = img[src + xx + 3] / 255;
      data[dst + xx] = a; data[dst + xx + 1] = a; data[dst + xx + 2] = a; data[dst + xx + 3] = a;
    }
  }
  return { data: data, width: W, height: H };
}

// exact 1D/2D squared Euclidean distance transform (Felzenszwalb-Huttenlocher)
function fableEdtPass(grid, W, H, alongX) {
  var n = alongX ? W : H, m = alongX ? H : W;
  var f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (var j = 0; j < m; j++) {
    for (var i = 0; i < n; i++) f[i] = grid[alongX ? j * W + i : i * W + j];
    var k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (var q = 1; q < n; q++) {
      var s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
    }
    k = 0;
    for (var q2 = 0; q2 < n; q2++) {
      while (z[k + 1] < q2) k++;
      var dq = q2 - v[k]; d[q2] = dq * dq + f[v[k]];
    }
    for (var i2 = 0; i2 < n; i2++) grid[alongX ? j * W + i2 : i2 * W + j] = d[i2];
  }
}

// Signed distance field from a raster: r = 0..1 (0.5 at the glyph edge,
// >0.5 inside), g = raw coverage alpha. spreadPx sets the falloff radius.
function fableTextSDF(raster, spreadPx) {
  var W = raster.width, H = raster.height, N = W * H, INF = 1e12;
  var outside = new Float64Array(N), inside = new Float64Array(N);
  for (var i = 0; i < N; i++) {
    var on = raster.data[i * 4 + 3] > 0.5;
    outside[i] = on ? 0 : INF;
    inside[i] = on ? INF : 0;
  }
  fableEdtPass(outside, W, H, true); fableEdtPass(outside, W, H, false);
  fableEdtPass(inside, W, H, true); fableEdtPass(inside, W, H, false);
  var data = new Float32Array(N * 4);
  for (var i2 = 0; i2 < N; i2++) {
    var d = Math.sqrt(outside[i2]) - Math.sqrt(inside[i2]);
    var v01 = Math.max(0, Math.min(1, 0.5 - d / (2 * spreadPx)));
    data[i2 * 4] = v01;
    data[i2 * 4 + 1] = raster.data[i2 * 4 + 3];
    data[i2 * 4 + 2] = 0;
    data[i2 * 4 + 3] = 1;
  }
  return { data: data, width: W, height: H };
}

// Cache a built text texture in frameState; bumps gen when cacheKey changes
// so the renderer re-uploads initData.
function fableTextState(fsCtx, id, cacheKey, builder) {
  var k = id + '_texttex';
  var st = fsCtx.frameState.get(k);
  if (!st || st.key !== cacheKey) {
    st = { key: cacheKey, tex: builder(), gen: (st ? st.gen + 1 : 0) };
    fsCtx.frameState.set(k, st);
  }
  return st;
}
`

// GLSL snippet: sample helpers shared by the text patterns
export const FABLE_TEXT_GLSL = `
// anti-aliased edge of an SDF stored in .r (0.5 = glyph boundary).
// aa is the SDF-units-per-screen-pixel width, computed CPU-side —
// no fwidth() so it works without the WebGL1 derivatives extension.
float fableSdfMask(float sdf, float threshold, float aa) {
  return smoothstep(threshold - aa, threshold + aa, sdf);
}
`
