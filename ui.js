/**
 * ui.js
 * All DOM wiring lives here: rendering the expression/result display,
 * handling clicks on the keypad via event delegation, physical keyboard
 * shortcuts, panel/tab switching, modals, toasts, and the tool panels
 * (variables, solver, matrix, vector, stats, converter, graph).
 *
 * app.js calls UI.init() once the DOM is ready.
 */
const UI = (() => {
  let els = {};
  let graphRenderer = null;
  let confirmCallback = null;
  let statsMode = 'population';
  let matrixSize = 2;
  let vectorDim = 3;
  let graphFns = []; // { id, expr, color, visible }
  let isPanning = false;
  let lastPointer = null;

  function q(id) { return document.getElementById(id); }

  function cacheEls() {
    els = {
      expressionInput: q('expression-input'),
      resultValue: q('result-value'),
      errorLine: q('error-line'),
      activeModeLabel: q('active-mode-label'),
      memoryIndicator: q('memory-indicator'),
      themeToggle: q('theme-toggle'),
      helpBtn: q('help-btn'),
      settingsBtn: q('settings-btn'),
      copyResultBtn: q('copy-result-btn'),
      constantsGrid: q('constants-grid'),
      historyList: q('history-list'),
      historyEmpty: q('history-empty'),
      variablesList: q('variables-list'),
      variablesEmpty: q('variables-empty'),
      variableForm: q('variable-form'),
      varName: q('var-name'),
      varValue: q('var-value'),
      toastContainer: q('toast-container'),
    };
  }

  // ------------------------------------------------------------------ toasts
  function toast(message, type = 'default') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    els.toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 160ms ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }, 2200);
  }

  // ------------------------------------------------------------------ modals
  function openModal(id) {
    const modal = q(id);
    if (!modal) return;
    modal.hidden = false;
    const focusTarget = modal.querySelector('button, input, select, [tabindex]');
    if (focusTarget) focusTarget.focus();
  }
  function closeModal(id) {
    const modal = q(id);
    if (modal) modal.hidden = true;
  }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach((m) => { m.hidden = true; });
  }

  function confirmAction(message, onConfirm) {
    q('confirm-message').textContent = message;
    confirmCallback = onConfirm;
    openModal('confirm-modal');
  }

  // -------------------------------------------------------------- rendering
  function renderExpression(state) {
    const { expression, cursor } = state;
    els.expressionInput.innerHTML = '';
    const before = document.createTextNode(expression.slice(0, cursor));
    const after = document.createTextNode(expression.slice(cursor));
    const caret = document.createElement('span');
    caret.className = 'cursor';
    caret.setAttribute('aria-hidden', 'true');
    els.expressionInput.appendChild(before);
    els.expressionInput.appendChild(caret);
    els.expressionInput.appendChild(after);
  }

  function renderAngleMode(mode) {
    document.querySelectorAll('.led-btn[data-action="angle-mode"]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.value === mode));
    });
    els.activeModeLabel.textContent = mode;
  }

  function renderMemory(state) {
    els.memoryIndicator.classList.toggle('has-value', !!state.hasValue);
    els.memoryIndicator.setAttribute('aria-label', state.hasValue ? `Memory: ${state.value}` : 'Memory (empty)');
  }

  function showError(message) {
    els.errorLine.hidden = false;
    els.errorLine.textContent = message;
    els.resultValue.textContent = '—';
  }
  function clearError() {
    els.errorLine.hidden = true;
    els.errorLine.textContent = '';
  }

  function livePreview() {
    const state = Calculator.getState();
    if (!state.expression.trim()) {
      clearError();
      els.resultValue.textContent = '0';
      return;
    }
    // Don't try to preview an obviously incomplete assignment
    try {
      const variables = Variables.getAll();
      const raw = state.expression.trim();
      const assignMatch = raw.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
      const exprToEval = assignMatch ? assignMatch[2] : raw;
      const value = ExprParser.evaluate(exprToEval, { variables, angleMode: state.angleMode });
      clearError();
      els.resultValue.textContent = Calculator.formatNumber(value);
    } catch (err) {
      // Live preview stays quiet on incomplete expressions; only "=" surfaces errors loudly.
      clearError();
      els.resultValue.textContent = '···';
    }
  }

  // ------------------------------------------------------------- constants
  function renderConstants() {
    const frag = document.createDocumentFragment();
    Object.entries(MathFn.CONSTANTS).forEach(([key, c]) => {
      frag.appendChild(makeConstantButton(c.symbol, c.name, c.value, c.value));
    });
    Object.entries(MathFn.SCIENTIFIC_CONSTANTS).forEach(([key, c]) => {
      frag.appendChild(makeConstantButton(c.symbol, `${c.name} (${c.unit})`, c.value, c.value));
    });
    els.constantsGrid.appendChild(frag);
  }
  function makeConstantButton(symbol, name, value, insertValue) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'const-btn';
    btn.title = `${name} = ${value}`;
    btn.innerHTML = `<span class="const-symbol">${symbol}</span><span class="const-name">${name}</span><span class="const-value">${value}</span>`;
    btn.addEventListener('click', () => {
      Calculator.insert(String(insertValue));
      livePreview();
    });
    return btn;
  }

  // -------------------------------------------------------------- history
  function renderHistory() {
    const items = History.getAll();
    els.historyList.innerHTML = '';
    els.historyEmpty.style.display = items.length ? 'none' : 'block';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.tabIndex = 0;
      li.innerHTML = `
        <div class="history-item-row">
          <div>
            <div class="history-expr">${escapeHtml(item.expression)}</div>
            <div class="history-result">= ${escapeHtml(item.result)}</div>
          </div>
          <div class="history-item-actions">
            <button type="button" data-hist-copy="${item.id}" title="Copy result" aria-label="Copy result">⧉</button>
            <button type="button" data-hist-delete="${item.id}" title="Delete" aria-label="Delete entry">✕</button>
          </div>
        </div>`;
      li.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        Calculator.setExpression(item.expression);
        livePreview();
      });
      els.historyList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ------------------------------------------------------------ variables
  function renderVariables() {
    const vars = Variables.getAll();
    const keys = Object.keys(vars);
    els.variablesList.innerHTML = '';
    els.variablesEmpty.style.display = keys.length ? 'none' : 'block';
    keys.forEach((name) => {
      const li = document.createElement('li');
      li.className = 'var-item';
      li.innerHTML = `
        <span><span class="var-item-name">${escapeHtml(name)}</span> = <span class="var-item-value">${Calculator.formatNumber(vars[name])}</span></span>
        <span class="var-item-actions">
          <button type="button" data-var-insert="${escapeHtml(name)}" title="Insert" aria-label="Insert ${escapeHtml(name)}">➜</button>
          <button type="button" data-var-delete="${escapeHtml(name)}" title="Delete" aria-label="Delete ${escapeHtml(name)}">✕</button>
        </span>`;
      els.variablesList.appendChild(li);
    });
  }

  // -------------------------------------------------------------- solver
  function renderSolverResult(html) {
    q('solver-result').innerHTML = html;
  }
  function runLinearSolve() {
    try {
      const a = parseFloat(q('lin-a').value);
      const b = parseFloat(q('lin-b').value);
      const c = parseFloat(q('lin-c').value);
      if ([a, b, c].some(Number.isNaN)) throw new CalcError('Enter valid numbers for a, b, c');
      const result = Solver.solveLinear(a, b, c);
      if (result.type === 'one') {
        renderSolverResult(`<div class="r-line"><span class="r-label">x =</span><strong>${result.x}</strong></div>`);
      } else {
        renderSolverResult(`<div class="r-line r-error">${result.message}</div>`);
      }
    } catch (err) {
      renderSolverResult(`<div class="r-line r-error">${err.message}</div>`);
    }
  }
  function runQuadraticSolve() {
    try {
      const a = parseFloat(q('quad-a').value);
      const b = parseFloat(q('quad-b').value);
      const c = parseFloat(q('quad-c').value);
      if ([a, b, c].some(Number.isNaN)) throw new CalcError('Enter valid numbers for a, b, c');
      const r = Solver.solveQuadratic(a, b, c);
      let lines = '';
      if (r.discriminant !== null && r.discriminant !== undefined) {
        lines += `<div class="r-line"><span class="r-label">discriminant (b²−4ac)</span><span>${r.discriminant}</span></div>`;
      }
      if (r.type === 'two') {
        lines += `<div class="r-line"><span class="r-label">x₁ =</span><strong>${r.x1}</strong></div>`;
        lines += `<div class="r-line"><span class="r-label">x₂ =</span><strong>${r.x2}</strong></div>`;
        lines += `<div class="r-line"><span class="r-label">${r.message}</span></div>`;
      } else if (r.type === 'oneDouble' || r.type === 'one') {
        lines += `<div class="r-line"><span class="r-label">x =</span><strong>${r.x}</strong></div>`;
        if (r.message) lines += `<div class="r-line"><span class="r-label">${r.message}</span></div>`;
      } else if (r.type === 'complex') {
        lines += `<div class="r-line"><span class="r-label">x₁ =</span><strong>${r.real} + ${r.imag}i</strong></div>`;
        lines += `<div class="r-line"><span class="r-label">x₂ =</span><strong>${r.real} − ${r.imag}i</strong></div>`;
        lines += `<div class="r-line r-error">${r.message}</div>`;
      } else {
        lines += `<div class="r-line r-error">${r.message}</div>`;
      }
      renderSolverResult(lines);
    } catch (err) {
      renderSolverResult(`<div class="r-line r-error">${err.message}</div>`);
    }
  }

  // -------------------------------------------------------------- matrix
  function buildMatrixInputs(container, size) {
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    for (let i = 0; i < size * size; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.value = i % (size + 1) === 0 ? '1' : '0'; // identity-ish default
      container.appendChild(input);
    }
  }
  function readMatrix(container, size) {
    const inputs = [...container.querySelectorAll('input')];
    const m = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        const v = parseFloat(inputs[r * size + c].value);
        if (Number.isNaN(v)) throw new CalcError('Matrix contains an invalid number');
        row.push(v);
      }
      m.push(row);
    }
    return m;
  }
  function renderMatrixResult(m) {
    if (Array.isArray(m) && Array.isArray(m[0])) {
      const html = m.map((row) => `[ ${row.map((v) => Calculator.formatNumber(v)).join('\u2002')} ]`).join('<br>');
      q('matrix-result').innerHTML = html;
    } else {
      q('matrix-result').innerHTML = `<div class="r-line"><strong>${Calculator.formatNumber(m)}</strong></div>`;
    }
  }
  function runMatrixOp(op) {
    try {
      const a = readMatrix(q('matrix-a'), matrixSize);
      const needsB = ['add', 'subtract', 'multiply'].includes(op);
      const b = needsB ? readMatrix(q('matrix-b'), matrixSize) : null;
      let result;
      switch (op) {
        case 'add': result = MatrixOps.add(a, b); break;
        case 'subtract': result = MatrixOps.subtract(a, b); break;
        case 'multiply': result = MatrixOps.multiply(a, b); break;
        case 'scalarA': {
          const k = parseFloat(q('matrix-scalar').value);
          if (Number.isNaN(k)) throw new CalcError('Enter a valid scalar k');
          result = MatrixOps.scalarMultiply(a, k);
          break;
        }
        case 'transposeA': result = MatrixOps.transpose(a); break;
        case 'detA': result = MatrixOps.determinant(a); break;
        case 'inverseA': result = MatrixOps.inverse(a); break;
        case 'traceA': result = MatrixOps.trace(a); break;
        case 'identity': result = MatrixOps.identity(matrixSize); break;
        default: return;
      }
      renderMatrixResult(result);
    } catch (err) {
      q('matrix-result').innerHTML = `<div class="r-line r-error">${err.message}</div>`;
    }
  }

  // -------------------------------------------------------------- vector
  function buildVectorInputs(container, dim) {
    container.innerHTML = '';
    for (let i = 0; i < dim; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.value = '0';
      container.appendChild(input);
    }
  }
  function readVector(container) {
    return [...container.querySelectorAll('input')].map((inp) => {
      const v = parseFloat(inp.value);
      if (Number.isNaN(v)) throw new CalcError('Vector contains an invalid number');
      return v;
    });
  }
  function renderVectorResult(v) {
    if (Array.isArray(v)) {
      q('vector-result').innerHTML = `<div class="r-line"><strong>( ${v.map((x) => Calculator.formatNumber(x)).join(', ')} )</strong></div>`;
    } else {
      q('vector-result').innerHTML = `<div class="r-line"><strong>${Calculator.formatNumber(v)}</strong></div>`;
    }
  }
  function runVectorOp(op) {
    try {
      const a = readVector(q('vector-a'));
      const b = readVector(q('vector-b'));
      let result;
      switch (op) {
        case 'add': result = VectorOps.add(a, b); break;
        case 'subtract': result = VectorOps.subtract(a, b); break;
        case 'dot': result = VectorOps.dot(a, b); break;
        case 'cross': result = VectorOps.cross(a, b); break;
        case 'magA': result = VectorOps.magnitude(a); break;
        case 'unitA': result = VectorOps.unit(a); break;
        case 'angle': result = VectorOps.angleBetween(a, b, Calculator.getAngleMode()); break;
        default: return;
      }
      renderVectorResult(result);
    } catch (err) {
      q('vector-result').innerHTML = `<div class="r-line r-error">${err.message}</div>`;
    }
  }

  // ---------------------------------------------------------------- stats
  function parseDataset(text) {
    return text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).map(Number);
  }
  function runStats() {
    try {
      const raw = parseDataset(q('stats-input').value);
      if (raw.some(Number.isNaN)) throw new CalcError('Dataset contains an invalid number');
      const summary = Statistics.summarize(raw, { sample: statsMode === 'sample' });
      const fmt = (v) => (v === null ? 'n/a' : Calculator.formatNumber(v));
      const rows = [
        ['Count', summary.count],
        ['Sum', fmt(summary.sum)],
        ['Mean', fmt(summary.mean)],
        ['Median', fmt(summary.median)],
        ['Mode', summary.mode.length ? summary.mode.map(fmt).join(', ') : 'none'],
        ['Min', fmt(summary.min)],
        ['Max', fmt(summary.max)],
        ['Range', fmt(summary.range)],
        [statsMode === 'sample' ? 'Sample variance' : 'Population variance', fmt(summary.variance)],
        [statsMode === 'sample' ? 'Sample std. dev.' : 'Population std. dev.', fmt(summary.stdDev)],
        ['Q1', fmt(summary.q1)],
        ['Q2 (median)', fmt(summary.q2)],
        ['Q3', fmt(summary.q3)],
        ['IQR', fmt(summary.iqr)],
      ];
      q('stats-result').innerHTML = rows.map(([label, val]) => `<div class="r-line"><span class="r-label">${label}</span><span>${val}</span></div>`).join('');
      drawStatsChart(summary.sorted);
    } catch (err) {
      q('stats-result').innerHTML = `<div class="r-line r-error">${err.message}</div>`;
      q('stats-canvas').hidden = true;
    }
  }
  function drawStatsChart(sorted) {
    const canvas = q('stats-canvas');
    canvas.hidden = false;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.height * dpr) || 120 * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = 120;
    ctx.clearRect(0, 0, w, h);
    if (!sorted.length) return;
    const min = sorted[0], max = sorted[sorted.length - 1];
    const range = max - min || 1;
    const barCount = Math.min(sorted.length, 16);
    const bucketSize = Math.max(1, Math.ceil(sorted.length / barCount));
    const buckets = [];
    for (let i = 0; i < sorted.length; i += bucketSize) buckets.push(sorted.slice(i, i + bucketSize).length);
    const maxCount = Math.max(...buckets, 1);
    const barW = w / buckets.length;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#4fd6d0';
    ctx.fillStyle = accent;
    buckets.forEach((count, i) => {
      const barH = (count / maxCount) * (h - 10);
      ctx.fillRect(i * barW + 2, h - barH, barW - 4, barH);
    });
  }

  // ----------------------------------------------------------- converter
  function populateConverterCategories() {
    const select = q('converter-category');
    select.innerHTML = '';
    Object.entries(Converter.CATEGORIES).forEach(([key, cat]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = cat.label;
      select.appendChild(opt);
    });
    populateConverterUnits(select.value || Object.keys(Converter.CATEGORIES)[0]);
  }
  function populateConverterUnits(category) {
    const units = Converter.unitsFor(category);
    const fromSel = q('converter-from-unit');
    const toSel = q('converter-to-unit');
    fromSel.innerHTML = units.map((u) => `<option value="${u}">${u}</option>`).join('');
    toSel.innerHTML = units.map((u) => `<option value="${u}">${u}</option>`).join('');
    if (units.length > 1) toSel.selectedIndex = 1;
    runConversion();
  }
  function runConversion() {
    try {
      const category = q('converter-category').value;
      const value = parseFloat(q('converter-from-value').value);
      const from = q('converter-from-unit').value;
      const to = q('converter-to-unit').value;
      if (Number.isNaN(value)) { q('converter-to-value').textContent = '—'; return; }
      const result = Converter.convert(category, value, from, to);
      q('converter-to-value').textContent = Calculator.formatNumber(result);
    } catch (err) {
      q('converter-to-value').textContent = err.message;
    }
  }

  // -------------------------------------------------------------- graph
  function addGraphFunction(expr = '', color) {
    const id = `f${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
    graphFns.push({ id, expr, color });
    renderGraphFunctionRows();
    updateGraph();
  }
  function renderGraphFunctionRows() {
    const container = q('graph-functions');
    container.innerHTML = '';
    graphFns.forEach((fn, idx) => {
      const row = document.createElement('div');
      row.className = 'graph-fn-row';
      const paletteColor = fn.color || Graph.PALETTE?.[idx % 5] || '#f2a93b';
      row.innerHTML = `
        <span class="fn-color" style="background:${paletteColor}"></span>
        <span style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text-dim)">y =</span>
        <input type="text" value="${escapeHtml(fn.expr)}" placeholder="sin(x)" data-graph-id="${fn.id}">
        <button type="button" class="text-btn danger" data-graph-remove="${fn.id}" aria-label="Remove function">✕</button>`;
      container.appendChild(row);
    });
  }
  function updateGraph() {
    if (!graphRenderer) return;
    const fns = graphFns.filter((f) => f.expr.trim()).map((f) => ({ expr: f.expr, color: f.color }));
    graphRenderer.setFunctions(fns);
    const v = graphRenderer.getView();
    q('graph-range').textContent = `x: [${v.xMin.toFixed(1)}, ${v.xMax.toFixed(1)}]  y: [${v.yMin.toFixed(1)}, ${v.yMax.toFixed(1)}]`;
  }

  function initGraph() {
    const canvas = q('graph-canvas');
    graphRenderer = Graph.createRenderer(canvas);
    addGraphFunction('sin(x)', '#f2a93b');
    addGraphFunction('x^2/6', '#4fd6d0');

    canvas.addEventListener('pointerdown', (e) => {
      isPanning = true;
      lastPointer = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!isPanning) return;
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      lastPointer = { x: e.clientX, y: e.clientY };
      graphRenderer.pan(dx, dy);
      updateGraph();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
      canvas.addEventListener(ev, () => { isPanning = false; });
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width;
      const cy = (e.clientY - rect.top) / rect.height;
      graphRenderer.zoom(e.deltaY > 0 ? 1.1 : 0.9, cx, cy);
      updateGraph();
    }, { passive: false });
  }

  // --------------------------------------------------------- calc actions
  function handleDigit(v) { Calculator.insert(v); livePreview(); }
  function handleDecimal() { Calculator.insert('.'); livePreview(); }
  function handleOp(v) { Calculator.insert(v); livePreview(); }
  function handleParen(v) { Calculator.insert(v); livePreview(); }
  function handleFunc(name) { Calculator.insertFunction(name); livePreview(); }
  function handleEquals() {
    const result = Calculator.evaluate();
    if (result.ok) {
      clearError();
      els.resultValue.textContent = result.display;
      if (result.assigned) {
        toast(`${result.assigned} = ${result.display}`, 'success');
        renderVariables();
      } else {
        History.add(result.expression, result.display);
        Calculator.insertResultAsNewExpression(result.value);
      }
    } else {
      showError(result.error);
    }
  }

  function playFeedback() {
    if (!Storage.get('soundEnabled', false)) return;
    // Lightweight haptic-style feedback via the vibration API where available; no audio asset dependency.
    if (navigator.vibrate) navigator.vibrate(6);
  }

  // ------------------------------------------------------------ delegation
  function onKeypadClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    playFeedback();
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 120);

    switch (action) {
      case 'digit': handleDigit(btn.dataset.value); break;
      case 'decimal': handleDecimal(); break;
      case 'op': handleOp(btn.dataset.value); break;
      case 'mod': Calculator.insert(' mod '); livePreview(); break;
      case 'paren': handleParen(btn.dataset.value); break;
      case 'func': handleFunc(btn.dataset.value); break;
      case 'power2': Calculator.insert('^2'); livePreview(); break;
      case 'power3': Calculator.insert('^3'); livePreview(); break;
      case 'reciprocal': Calculator.insert('1/('); livePreview(); break;
      case 'nthroot': Calculator.insert('root(,)'); Calculator.moveCursor(-2); livePreview(); break;
      case 'logb': Calculator.insert('logb(,)'); Calculator.moveCursor(-2); livePreview(); break;
      case 'randint': Calculator.insert('randint(,)'); Calculator.moveCursor(-2); livePreview(); break;
      case 'raw': Calculator.insert(btn.dataset.value); livePreview(); break;
      case 'factorial': Calculator.insert('!'); livePreview(); break;
      case 'doubleFactorial': Calculator.insert('!!'); livePreview(); break;
      case 'percent': Calculator.insert('%'); livePreview(); break;
      case 'sign': Calculator.toggleSign(); livePreview(); break;
      case 'clear-all': Calculator.clearAll(); clearError(); els.resultValue.textContent = '0'; break;
      case 'backspace': Calculator.backspace(); livePreview(); break;
      case 'equals': handleEquals(); break;
      case 'mem': handleMemory(btn.dataset.value); break;
      case 'open-panel': if (btn.dataset.panel) { /* memory indicator: no-op popover for now */ } break;
      default: break;
    }
  }

  function handleMemory(op) {
    const current = Calculator.evaluate();
    switch (op) {
      case 'MC': Memory.clear(); toast('Memory cleared'); break;
      case 'MR': Calculator.insertResultAsNewExpression(Memory.recall()); livePreview(); break;
      case 'M+':
        if (current.ok) { Memory.add(current.value); toast('Added to memory'); } else { toast('Nothing to add to memory', 'error'); }
        break;
      case 'M-':
        if (current.ok) { Memory.subtract(current.value); toast('Subtracted from memory'); } else { toast('Nothing to subtract from memory', 'error'); }
        break;
      default: break;
    }
  }

  // ------------------------------------------------------------- keyboard
  function onKeyDown(e) {
    if (document.querySelector('.modal-overlay:not([hidden])')) {
      if (e.key === 'Escape') closeAllModals();
      return;
    }
    const active = document.activeElement;
    const inTextField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
    if (inTextField) return; // let native field editing behave normally

    const key = e.key;
    if (/^[0-9]$/.test(key)) { handleDigit(key); e.preventDefault(); return; }
    if (key === '.') { handleDecimal(); e.preventDefault(); return; }
    if (['+', '-', '*', '/', '^'].includes(key)) { handleOp(key); e.preventDefault(); return; }
    if (key === '(' || key === ')') { handleParen(key); e.preventDefault(); return; }
    if (key === '%') { Calculator.insert('%'); livePreview(); e.preventDefault(); return; }
    if (key === '!') { Calculator.insert('!'); livePreview(); e.preventDefault(); return; }
    // Note: '=' is intentionally NOT bound to "calculate" — a literal "="
    // is needed to type assignment expressions like "x = 10", and falls
    // through to the generic printable-character handler below. Only
    // Enter triggers evaluation, matching the on-screen "=" button.
    if (key === 'Enter') { handleEquals(); e.preventDefault(); return; }
    if (key === 'Escape') { Calculator.clearAll(); clearError(); els.resultValue.textContent = '0'; e.preventDefault(); return; }
    if (key === 'Backspace') { Calculator.backspace(); livePreview(); e.preventDefault(); return; }
    if (key === 'Delete') { Calculator.deleteForward(); livePreview(); e.preventDefault(); return; }
    if (key === 'ArrowLeft') { Calculator.moveCursor(-1); e.preventDefault(); return; }
    if (key === 'ArrowRight') { Calculator.moveCursor(1); e.preventDefault(); return; }
    if (key === 'Home') { Calculator.home(); e.preventDefault(); return; }
    if (key === 'End') { Calculator.end(); e.preventDefault(); return; }

    // Fallback: any other single printable character (letters for function/variable
    // names, commas for multi-arg functions, etc.) is inserted verbatim so the
    // expression editor behaves like a real text field, not just a digit pad.
    if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      Calculator.insert(key);
      livePreview();
      e.preventDefault();
    }
  }

  // ---------------------------------------------------------- panel/tabs
  function setupTabs(tabSelector, tabAttr, contentSelector, contentAttr) {
    document.querySelectorAll(tabSelector).forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll(tabSelector).forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset[tabAttr];
        document.querySelectorAll(contentSelector).forEach((c) => {
          c.classList.toggle('active', c.dataset[contentAttr] === target);
        });
        if (target === 'graph' && graphRenderer) setTimeout(() => { graphRenderer.resize(); updateGraph(); }, 50);
      });
    });
  }

  // ----------------------------------------------------------------- init
  function init() {
    cacheEls();
    renderConstants();

    Calculator.onChange(renderExpression);
    Calculator.onChange((s) => renderAngleMode(s.angleMode));
    renderExpression(Calculator.getState());
    renderAngleMode(Calculator.getAngleMode());

    Memory.onChange(renderMemory);
    renderMemory(Memory.getState());

    History.onChange(renderHistory);
    renderHistory();

    Variables.onChange(renderVariables);
    renderVariables();

    document.querySelector('.keyboard').addEventListener('click', onKeypadClick);
    document.addEventListener('keydown', onKeyDown);

    setupTabs('.kbd-tab', 'target', '.kbd-group', 'group');
    setupTabs('.side-tab', 'panel', '.side-content', 'content');

    document.querySelectorAll('.led-btn[data-action="angle-mode"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Calculator.setAngleMode(btn.dataset.value);
        q('setting-angle').value = btn.dataset.value;
        livePreview();
      });
    });

    // Theme
    const savedTheme = Storage.get('theme', 'dark');
    document.body.dataset.theme = savedTheme;
    q('setting-theme').value = savedTheme;
    els.themeToggle.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      document.body.dataset.theme = next;
      Storage.set('theme', next);
      q('setting-theme').value = next;
      if (graphRenderer) graphRenderer.render();
    });
    q('setting-theme').addEventListener('change', (e) => {
      document.body.dataset.theme = e.target.value;
      Storage.set('theme', e.target.value);
      if (graphRenderer) graphRenderer.render();
    });

    // Precision
    q('setting-precision').value = Calculator.getPrecision();
    q('setting-precision').addEventListener('change', (e) => {
      Calculator.setPrecision(e.target.value);
      livePreview();
    });
    q('setting-angle').value = Calculator.getAngleMode();
    q('setting-angle').addEventListener('change', (e) => {
      Calculator.setAngleMode(e.target.value);
      livePreview();
    });
    q('setting-sound').checked = Storage.get('soundEnabled', false);
    q('setting-sound').addEventListener('change', (e) => Storage.set('soundEnabled', e.target.checked));

    // Modals
    els.helpBtn.addEventListener('click', () => openModal('help-modal'));
    els.settingsBtn.addEventListener('click', () => openModal('settings-modal'));
    document.querySelectorAll('[data-action="close-modal"]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay.id); });
    });

    // Copy result
    els.copyResultBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(els.resultValue.textContent);
        toast('Result copied', 'success');
      } catch {
        toast('Could not copy', 'error');
      }
    });

    // History actions
    els.historyList.addEventListener('click', (e) => {
      const copyId = e.target.closest('[data-hist-copy]');
      const delId = e.target.closest('[data-hist-delete]');
      if (copyId) {
        const item = History.getAll().find((h) => h.id === copyId.dataset.histCopy);
        if (item) navigator.clipboard.writeText(item.result).then(() => toast('Copied', 'success')).catch(() => {});
      }
      if (delId) History.remove(delId.dataset.histDelete);
    });
    document.querySelectorAll('[data-action="clear-history"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmAction('Clear all calculation history? This cannot be undone.', () => {
          History.clear();
          toast('History cleared');
        });
      });
    });

    // Variables
    els.variableForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = els.varName.value.trim();
      const rawValue = els.varValue.value.trim();
      if (!name || !rawValue) return;
      try {
        const value = ExprParser.evaluate(rawValue, { variables: Variables.getAll(), angleMode: Calculator.getAngleMode() });
        Variables.set(name, value);
        els.varName.value = '';
        els.varValue.value = '';
        toast(`${name} = ${Calculator.formatNumber(value)}`, 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    els.variablesList.addEventListener('click', (e) => {
      const insertBtn = e.target.closest('[data-var-insert]');
      const delBtn = e.target.closest('[data-var-delete]');
      if (insertBtn) { Calculator.insert(insertBtn.dataset.varInsert); livePreview(); }
      if (delBtn) Variables.remove(delBtn.dataset.varDelete);
    });
    document.querySelectorAll('[data-action="clear-variables"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmAction('Delete all variables? This cannot be undone.', () => {
          Variables.clearAll();
          toast('Variables cleared');
        });
      });
    });

    // Solver
    document.querySelectorAll('[data-solver]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-solver]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        q('solver-linear').hidden = btn.dataset.solver !== 'linear';
        q('solver-quadratic').hidden = btn.dataset.solver !== 'quadratic';
        renderSolverResult('');
      });
    });
    document.querySelector('[data-action="solve-linear"]').addEventListener('click', runLinearSolve);
    document.querySelector('[data-action="solve-quadratic"]').addEventListener('click', runQuadraticSolve);

    // Matrix
    buildMatrixInputs(q('matrix-a'), matrixSize);
    buildMatrixInputs(q('matrix-b'), matrixSize);
    q('matrix-size').addEventListener('change', (e) => {
      matrixSize = Number(e.target.value);
      buildMatrixInputs(q('matrix-a'), matrixSize);
      buildMatrixInputs(q('matrix-b'), matrixSize);
      q('matrix-result').innerHTML = '';
    });
    document.querySelectorAll('[data-action="matrix-op"]').forEach((btn) => {
      btn.addEventListener('click', () => runMatrixOp(btn.dataset.op));
    });

    // Vector
    buildVectorInputs(q('vector-a'), vectorDim);
    buildVectorInputs(q('vector-b'), vectorDim);
    q('vector-dim').addEventListener('change', (e) => {
      vectorDim = Number(e.target.value);
      buildVectorInputs(q('vector-a'), vectorDim);
      buildVectorInputs(q('vector-b'), vectorDim);
      q('vector-result').innerHTML = '';
    });
    document.querySelectorAll('[data-action="vector-op"]').forEach((btn) => {
      btn.addEventListener('click', () => runVectorOp(btn.dataset.op));
    });

    // Stats
    document.querySelectorAll('[data-stats-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-stats-mode]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        statsMode = btn.dataset.statsMode;
      });
    });
    document.querySelector('[data-action="compute-stats"]').addEventListener('click', runStats);

    // Converter
    populateConverterCategories();
    q('converter-category').addEventListener('change', (e) => populateConverterUnits(e.target.value));
    q('converter-from-unit').addEventListener('change', runConversion);
    q('converter-to-unit').addEventListener('change', runConversion);
    q('converter-from-value').addEventListener('input', runConversion);

    // Graph
    initGraph();
    document.querySelector('[data-action="graph-add-function"]').addEventListener('click', () => addGraphFunction(''));
    q('graph-functions').addEventListener('input', (e) => {
      const input = e.target.closest('[data-graph-id]');
      if (!input) return;
      const fn = graphFns.find((f) => f.id === input.dataset.graphId);
      if (fn) { fn.expr = input.value; updateGraph(); }
    });
    q('graph-functions').addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-graph-remove]');
      if (!removeBtn) return;
      graphFns = graphFns.filter((f) => f.id !== removeBtn.dataset.graphRemove);
      renderGraphFunctionRows();
      updateGraph();
    });
    document.querySelectorAll('[data-action="graph-zoom"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        graphRenderer.zoom(btn.dataset.value === 'in' ? 0.85 : 1.18);
        updateGraph();
      });
    });
    document.querySelector('[data-action="graph-reset"]').addEventListener('click', () => {
      graphRenderer.resetView();
      updateGraph();
    });

    // Confirm dialog
    document.querySelector('[data-action="confirm-ok"]').addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      confirmCallback = null;
      closeModal('confirm-modal');
    });
    document.querySelector('[data-action="confirm-cancel"]').addEventListener('click', () => {
      confirmCallback = null;
      closeModal('confirm-modal');
    });

    // Reset app data
    q('reset-app-btn').addEventListener('click', () => {
      confirmAction('Reset all app data (history, variables, memory, settings)? This cannot be undone.', () => {
        Storage.clearAll();
        toast('App data reset — reloading…');
        setTimeout(() => window.location.reload(), 600);
      });
    });

    els.expressionInput.addEventListener('click', () => els.expressionInput.focus());
  }

  return { init, toast };
})();
