/**
 * calculator.js
 * Owns the live expression buffer (as an array of characters so a text
 * cursor can move through it), talks to the parser to evaluate, and
 * formats results according to the user's precision setting.
 */
const Calculator = (() => {
  let expr = []; // array of characters
  let cursor = 0; // index into expr where the caret sits
  let lastResult = null;
  let angleMode = 'DEG';
  let precision = 'auto'; // 'auto' | 0-10 | 'sci'

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => fn(getState())); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function getState() {
    return {
      expression: expr.join(''),
      cursor,
      angleMode,
      precision,
    };
  }

  function setAngleMode(mode) {
    angleMode = mode;
    Storage.set('angleMode', mode);
    emit();
  }
  function getAngleMode() { return angleMode; }

  function setPrecision(p) {
    precision = p;
    Storage.set('precision', p);
    emit();
  }
  function getPrecision() { return precision; }

  function loadSettings() {
    angleMode = Storage.get('angleMode', 'DEG');
    precision = Storage.get('precision', 'auto');
  }

  function insert(text) {
    expr.splice(cursor, 0, ...text.split(''));
    cursor += text.length;
    emit();
  }

  function insertFunction(name) {
    insert(`${name}(`);
  }

  function moveCursor(delta) {
    cursor = Math.max(0, Math.min(expr.length, cursor + delta));
    emit();
  }
  function setCursor(pos) {
    cursor = Math.max(0, Math.min(expr.length, pos));
    emit();
  }
  function home() { cursor = 0; emit(); }
  function end() { cursor = expr.length; emit(); }

  function backspace() {
    if (cursor > 0) {
      expr.splice(cursor - 1, 1);
      cursor -= 1;
      emit();
    }
  }
  function deleteForward() {
    if (cursor < expr.length) {
      expr.splice(cursor, 1);
      emit();
    }
  }
  function clearAll() {
    expr = [];
    cursor = 0;
    emit();
  }
  function clearEntry() { clearAll(); }

  function setExpression(str) {
    expr = str.split('');
    cursor = expr.length;
    emit();
  }

  function toggleSign() {
    // Wrap the whole expression in -( ... ) for simplicity & predictability,
    // unless it already starts with a unary minus wrapper we just added.
    const current = expr.join('');
    if (current.startsWith('-(') && current.endsWith(')')) {
      setExpression(current.slice(2, -1));
    } else if (current.length) {
      setExpression(`-(${current})`);
    }
  }

  function formatNumber(v) {
    if (typeof v !== 'number') return String(v);
    let formatted;
    if (precision === 'sci') {
      formatted = MathFn.cleanFloat(v, 'sci');
    } else if (precision === 'auto') {
      const clean = MathFn.cleanFloat(v, null);
      formatted = trimTrailingZeros(clean);
    } else {
      formatted = MathFn.cleanFloat(v, Number(precision)).toFixed(Number(precision));
    }
    return String(formatted);
  }

  function trimTrailingZeros(n) {
    if (Number.isInteger(n)) return n;
    // Use a bounded number of significant digits then strip trailing zeros
    let s = n.toPrecision(12);
    if (s.includes('e')) return n;
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return Number(s);
  }

  /**
   * Evaluate the current expression. Supports "x = expr" assignment syntax
   * by delegating variable storage to Variables module (loaded separately).
   * Returns { ok: true, value, display } or { ok: false, error }.
   */
  function evaluate() {
    const raw = expr.join('').trim();
    if (!raw) return { ok: false, error: 'Nothing to calculate' };

    try {
      const assignMatch = raw.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
      if (assignMatch && typeof Variables !== 'undefined') {
        const [, name, rhs] = assignMatch;
        const value = ExprParser.evaluate(rhs, {
          variables: Variables.getAll(),
          angleMode,
        });
        Variables.set(name, value);
        lastResult = value;
        const display = formatNumber(value);
        emit();
        return { ok: true, value, display, assigned: name };
      }

      const variables = typeof Variables !== 'undefined' ? Variables.getAll() : {};
      const value = ExprParser.evaluate(raw, { variables, angleMode });
      lastResult = value;
      const display = formatNumber(value);
      return { ok: true, value, display, expression: raw };
    } catch (err) {
      if (err instanceof CalcError) return { ok: false, error: err.message };
      console.error(err);
      return { ok: false, error: 'Invalid expression' };
    }
  }

  function getLastResult() { return lastResult; }

  function insertResultAsNewExpression(value) {
    setExpression(formatNumber(value));
  }

  loadSettings();

  return {
    onChange,
    getState,
    insert,
    insertFunction,
    moveCursor,
    setCursor,
    home,
    end,
    backspace,
    deleteForward,
    clearAll,
    clearEntry,
    setExpression,
    toggleSign,
    evaluate,
    formatNumber,
    setAngleMode,
    getAngleMode,
    setPrecision,
    getPrecision,
    getLastResult,
    insertResultAsNewExpression,
  };
})();
