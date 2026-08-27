/**
 * graph.js
 * Canvas-based function plotter. Evaluates each function expression at a
 * dense sample of x values across the current view window and draws the
 * resulting polyline, skipping segments where the function is undefined
 * or jumps discontinuously (e.g. tan(x) asymptotes).
 *
 * Graphing always evaluates trig in radians regardless of the calculator's
 * global angle mode — that's the near-universal convention for y=f(x) plots
 * and keeps curves like sin(x) recognizable over a -10..10 window.
 */
const Graph = (() => {
  const PALETTE = ['#f2a93b', '#4fd6d0', '#ef6461', '#8f7fe8', '#6fcf97'];

  function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    let view = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };
    let functions = []; // [{ expr, color, error }]
    let dpr = window.devicePixelRatio || 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    }

    function toPixel(x, y, w, h) {
      const px = ((x - view.xMin) / (view.xMax - view.xMin)) * w;
      const py = h - ((y - view.yMin) / (view.yMax - view.yMin)) * h;
      return [px, py];
    }

    function niceStep(range, targetLines = 10) {
      const raw = range / targetLines;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw / mag;
      let step;
      if (norm < 1.5) step = 1;
      else if (norm < 3.5) step = 2;
      else if (norm < 7.5) step = 5;
      else step = 10;
      return step * mag;
    }

    function render() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const styles = getComputedStyle(document.documentElement);
      const gridColor = styles.getPropertyValue('--graph-grid').trim() || '#333';
      const axisColor = styles.getPropertyValue('--graph-axis').trim() || '#888';
      const textColor = styles.getPropertyValue('--text-dim').trim() || '#999';

      // Grid
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = textColor;

      const xStep = niceStep(view.xMax - view.xMin);
      const yStep = niceStep(view.yMax - view.yMin);

      ctx.beginPath();
      for (let x = Math.ceil(view.xMin / xStep) * xStep; x <= view.xMax; x += xStep) {
        const [px] = toPixel(x, 0, w, h);
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(view.yMin / yStep) * yStep; y <= view.yMax; y += yStep) {
        const [, py] = toPixel(0, y, w, h);
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
      }
      ctx.stroke();

      // Axes
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const [zx] = toPixel(0, 0, w, h);
      const [, zy] = toPixel(0, 0, w, h);
      if (view.xMin <= 0 && view.xMax >= 0) { ctx.moveTo(zx, 0); ctx.lineTo(zx, h); }
      if (view.yMin <= 0 && view.yMax >= 0) { ctx.moveTo(0, zy); ctx.lineTo(w, zy); }
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = textColor;
      for (let x = Math.ceil(view.xMin / xStep) * xStep; x <= view.xMax; x += xStep) {
        if (Math.abs(x) < xStep / 1000) continue;
        const [px] = toPixel(x, 0, w, h);
        const labelY = view.yMin <= 0 && view.yMax >= 0 ? zy + 14 : h - 6;
        ctx.fillText(formatTick(x), px + 3, labelY);
      }
      for (let y = Math.ceil(view.yMin / yStep) * yStep; y <= view.yMax; y += yStep) {
        if (Math.abs(y) < yStep / 1000) continue;
        const [, py] = toPixel(0, y, w, h);
        const labelX = view.xMin <= 0 && view.xMax >= 0 ? zx + 4 : 4;
        ctx.fillText(formatTick(y), labelX, py - 3);
      }

      // Functions
      functions.forEach((f, idx) => {
        f.error = null;
        const color = f.color || PALETTE[idx % PALETTE.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let drawing = false;
        let prevY = null;
        const samples = Math.min(2000, Math.max(400, Math.floor(w)));
        for (let i = 0; i <= samples; i++) {
          const x = view.xMin + ((view.xMax - view.xMin) * i) / samples;
          let y;
          try {
            y = ExprParser.evaluate(f.expr, { variables: { x }, angleMode: 'RAD' });
          } catch (err) {
            drawing = false;
            continue;
          }
          if (!Number.isFinite(y)) { drawing = false; continue; }
          // Detect asymptote-like jumps and break the line
          if (prevY !== null && Math.abs(y - prevY) > (view.yMax - view.yMin) * 4) {
            drawing = false;
          }
          const [px, py] = toPixel(x, y, w, h);
          if (!drawing) { ctx.moveTo(px, py); drawing = true; } else { ctx.lineTo(px, py); }
          prevY = y;
        }
        ctx.stroke();
      });
    }

    function formatTick(v) {
      const r = Math.round(v * 1000) / 1000;
      return String(r);
    }

    function setFunctions(fns) { functions = fns; render(); }
    function getView() { return { ...view }; }
    function setView(v) { view = { ...view, ...v }; render(); }

    function pan(dxPixels, dyPixels) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const xRange = view.xMax - view.xMin;
      const yRange = view.yMax - view.yMin;
      const dx = -(dxPixels / w) * xRange;
      const dy = (dyPixels / h) * yRange;
      view = {
        xMin: view.xMin + dx, xMax: view.xMax + dx,
        yMin: view.yMin + dy, yMax: view.yMax + dy,
      };
      render();
    }

    function zoom(factor, cx = 0.5, cy = 0.5) {
      const xRange = (view.xMax - view.xMin) * factor;
      const yRange = (view.yMax - view.yMin) * factor;
      const xCenter = view.xMin + (view.xMax - view.xMin) * cx;
      const yCenter = view.yMin + (view.yMax - view.yMin) * (1 - cy);
      view = {
        xMin: xCenter - xRange / 2, xMax: xCenter + xRange / 2,
        yMin: yCenter - yRange / 2, yMax: yCenter + yRange / 2,
      };
      render();
    }

    function resetView() {
      view = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };
      render();
    }

    window.addEventListener('resize', resize);
    resize();

    return { render, setFunctions, getView, setView, pan, zoom, resetView, resize };
  }

  return { createRenderer };
})();
