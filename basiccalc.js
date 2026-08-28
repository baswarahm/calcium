/**
 * basiccalc.js
 * Drives "Normal Mode": the everyday, phone-style calculator experience
 * (press digits, choose an operation, press equals). It is a dedicated
 * state manager — currentInput / previousValue / pendingOperator /
 * waitingForOperand / lastOperator / lastOperand — completely separate
 * from Expression Mode's free-text cursor buffer in calculator.js.
 *
 * Internally it still leans on the existing, battle-tested ExprParser to
 * evaluate, so operator precedence, angle mode, and formatting all stay
 * consistent with Expression Mode. Button presses just build up a small
 * expression behind the scenes instead of eagerly combining numbers, which
 * is what lets "2 + 3 × 4 =" correctly return 14 instead of 20.
 */
const UNARY_FUNCS = {
  sin: { label: 'sin', tmpl: (v) => `sin(${v})` },
  cos: { label: 'cos', tmpl: (v) => `cos(${v})` },
  tan: { label: 'tan', tmpl: (v) => `tan(${v})` },
  asin: { label: 'sin⁻¹', tmpl: (v) => `asin(${v})` },
  acos: { label: 'cos⁻¹', tmpl: (v) => `acos(${v})` },
  atan: { label: 'tan⁻¹', tmpl: (v) => `atan(${v})` },
  sinh: { label: 'sinh', tmpl: (v) => `sinh(${v})` },
  cosh: { label: 'cosh', tmpl: (v) => `cosh(${v})` },
  tanh: { label: 'tanh', tmpl: (v) => `tanh(${v})` },
  asinh: { label: 'sinh⁻¹', tmpl: (v) => `asinh(${v})` },
  acosh: { label: 'cosh⁻¹', tmpl: (v) => `acosh(${v})` },
  atanh: { label: 'tanh⁻¹', tmpl: (v) => `atanh(${v})` },
  ln: { label: 'ln', tmpl: (v) => `ln(${v})` },
  log: { label: 'log', tmpl: (v) => `log(${v})` },
  log2: { label: 'log₂', tmpl: (v) => `log2(${v})` },
  sqrt: { label: '√', tmpl: (v) => `sqrt(${v})` },
  cbrt: { label: '∛', tmpl: (v) => `cbrt(${v})` },
  exp: { label: 'eˣ', tmpl: (v) => `exp(${v})` },
  pow10: { label: '10ˣ', tmpl: (v) => `10^(${v})` },
  abs: { label: 'abs', tmpl: (v) => `abs(${v})` },
  floor: { label: 'floor', tmpl: (v) => `floor(${v})` },
  ceil: { label: 'ceil', tmpl: (v) => `ceil(${v})` },
  signfn: { label: 'sign', tmpl: (v) => `sign(${v})` },
  sq: { label: '²', suffix: true, tmpl: (v) => `(${v})^2` },
  cube: { label: '³', suffix: true, tmpl: (v) => `(${v})^3` },
  recip: { label: '1/x', tmpl: (v) => `1/(${v})`, noFirst: true },
  fact: { label: '!', suffix: true, tmpl: (v) => `(${v})!` },
  dfact: { label: '!!', suffix: true, tmpl: (v) => `(${v})!!` },
};

const BasicCalc = (() => {
  // ---- state -------------------------------------------------------------
  let segments = [];        // committed { kind:'number'|'op', engine, display }
  let currentInput = '0';   // the operand currently being typed (bottom line)
  let pendingFunction = null;      // function key waiting for its operand ("sin" then a number)
  let lastFunctionDisplay = null;  // e.g. "√(25)" — display label for a just-wrapped number
  let awaitingOperand = false;     // true right after an operator/function is committed
  let justEvaluated = false;       // true right after "="
  let lastOperatorEngine = null;   // for repeated "="
  let lastOperandEngine = null;
  let lastOperandDisplay = null;
  let error = null;
  let resultHistoryLine = ''; // top line kept visible after "=" until the user types again

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => fn(getState())); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function ctx() {
    return {
      variables: typeof Variables !== 'undefined' ? Variables.getAll() : {},
      angleMode: Calculator.getAngleMode(),
    };
  }

  function evalExpr(str) {
    return ExprParser.evaluate(str, ctx());
  }

  function fmt(v) { return Calculator.formatNumber(v); }

  // ---- helpers -------------------------------------------------------------
  function appendDigit(current, d) {
    if (current === '0' || current === '-0') {
      return (current.startsWith('-') ? '-' : '') + d;
    }
    if (current.length >= 18) return current; // sane cap, avoid runaway overflow
    return current + d;
  }

  function resetForFreshEntry() {
    segments = [];
    justEvaluated = false;
    lastOperatorEngine = null;
    lastOperandEngine = null;
    lastOperandDisplay = null;
    resultHistoryLine = '';
  }

  function currentOperandTokens() {
    // Wrap the typed number with any pending function, and prefer a just
    // applied function's display label ("√(25)") over the raw digits.
    if (pendingFunction) {
      const meta = UNARY_FUNCS[pendingFunction];
      return {
        engine: meta.tmpl(currentInput),
        display: `${meta.label}(${currentInput})`,
      };
    }
    if (lastFunctionDisplay) {
      return { engine: currentInput, display: lastFunctionDisplay };
    }
    return { engine: currentInput, display: currentInput };
  }

  function commitCurrentOperand() {
    const tok = currentOperandTokens();
    segments.push({ kind: 'number', engine: tok.engine, display: tok.display });
    pendingFunction = null;
    lastFunctionDisplay = null;
  }

  function lastOpSegment() {
    const last = segments[segments.length - 1];
    return last && last.kind === 'op' ? last : null;
  }

  function lastNumberSegment() {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].kind === 'number') return segments[i];
    }
    return null;
  }

  // ---- state getters -------------------------------------------------------
  function getState() {
    let topLine = segments.map((s) => s.display).join(' ');
    if (pendingFunction) {
      topLine = (topLine ? topLine + ' ' : '') + `${UNARY_FUNCS[pendingFunction].label}(`;
    } else if (!segments.length && justEvaluated && resultHistoryLine) {
      topLine = resultHistoryLine;
    } else if (!segments.length && lastFunctionDisplay && !awaitingOperand) {
      topLine = lastFunctionDisplay;
    }
    return {
      topLine,
      bottomLine: currentInput,
      error,
      hasPendingOperator: !!lastOpSegment(),
      pendingOperatorDisplay: lastOpSegment() ? lastOpSegment().display : null,
      awaitingFunction: !!pendingFunction,
    };
  }

  function getCurrentValue() {
    const n = parseFloat(currentInput);
    return Number.isNaN(n) ? 0 : n;
  }

  // ---- entry actions ---------------------------------------------------------
  function digit(d) {
    error = null;
    if (justEvaluated) { resetForFreshEntry(); currentInput = d; awaitingOperand = false; emit(); return; }
    if (awaitingOperand) { currentInput = d === '0' ? '0' : d; awaitingOperand = false; lastFunctionDisplay = null; emit(); return; }
    currentInput = appendDigit(currentInput, d);
    lastFunctionDisplay = null;
    emit();
  }

  function decimal() {
    error = null;
    if (justEvaluated) { resetForFreshEntry(); currentInput = '0.'; awaitingOperand = false; emit(); return; }
    if (awaitingOperand) { currentInput = '0.'; awaitingOperand = false; lastFunctionDisplay = null; emit(); return; }
    if (!currentInput.includes('.')) currentInput += '.';
    lastFunctionDisplay = null;
    emit();
  }

  function toggleSign() {
    error = null;
    if (justEvaluated) justEvaluated = false;
    if (currentInput === '0') { emit(); return; }
    currentInput = currentInput.startsWith('-') ? currentInput.slice(1) : `-${currentInput}`;
    emit();
  }

  function backspace() {
    error = null;
    if (pendingFunction && currentInput === '0') { pendingFunction = null; emit(); return; }
    if (currentInput.length <= 1 || (currentInput.length === 2 && currentInput.startsWith('-'))) {
      currentInput = '0';
    } else {
      currentInput = currentInput.slice(0, -1);
    }
    emit();
  }

  function clearAll() {
    segments = [];
    currentInput = '0';
    pendingFunction = null;
    lastFunctionDisplay = null;
    awaitingOperand = false;
    justEvaluated = false;
    lastOperatorEngine = null;
    lastOperandEngine = null;
    lastOperandDisplay = null;
    error = null;
    resultHistoryLine = '';
    emit();
  }

  function seed(value) {
    clearAll();
    currentInput = fmt(value);
    emit();
  }

  // ---- operator ---------------------------------------------------------
  function pressOperator(engineOp, displaySymbol) {
    error = null;
    if (justEvaluated) {
      segments = [{ kind: 'number', engine: currentInput, display: currentInput }];
      segments.push({ kind: 'op', engine: engineOp, display: displaySymbol });
      justEvaluated = false;
      lastOperatorEngine = null;
      lastOperandEngine = null;
      resultHistoryLine = '';
      currentInput = '0';
      awaitingOperand = true;
      emit();
      return;
    }
    if (awaitingOperand) {
      const op = lastOpSegment();
      if (op) { op.engine = engineOp; op.display = displaySymbol; }
      else segments.push({ kind: 'op', engine: engineOp, display: displaySymbol });
      emit();
      return;
    }
    commitCurrentOperand();
    segments.push({ kind: 'op', engine: engineOp, display: displaySymbol });
    awaitingOperand = true;
    currentInput = '0';
    emit();
  }

  // ---- percent (context-aware) -------------------------------------------
  function percent() {
    error = null;
    const op = lastOpSegment();
    const val = parseFloat(currentInput) || 0;
    let result = val / 100;
    if (op && (op.engine === '+' || op.engine === '-')) {
      const baseExpr = segments.slice(0, -1).map((s) => s.engine).join('');
      try {
        const base = baseExpr ? evalExpr(baseExpr) : val;
        result = (base * val) / 100;
      } catch (e) {
        result = val / 100;
      }
    }
    currentInput = fmt(result);
    awaitingOperand = false;
    pendingFunction = null;
    lastFunctionDisplay = null;
    emit();
  }

  // ---- scientific functions (wrap current number, or function-first) -----
  function pressFunction(key) {
    error = null;
    const meta = UNARY_FUNCS[key];
    if (!meta) return;

    if (justEvaluated) {
      resetForFreshEntry();
      currentInput = '0';
      if (!meta.noFirst && !meta.suffix) {
        pendingFunction = key;
        awaitingOperand = false;
      } else {
        // suffix-style / reciprocal have nothing to wrap yet — just reset.
        awaitingOperand = false;
      }
      emit();
      return;
    }

    const isFresh = awaitingOperand || (!segments.length && currentInput === '0' && !pendingFunction);
    if (isFresh && !meta.noFirst && !meta.suffix) {
      pendingFunction = key;
      currentInput = '0';
      awaitingOperand = false;
      emit();
      return;
    }

    // Apply immediately, wrapping whatever is currently displayed.
    const original = currentInput;
    let engineExpr = meta.tmpl(original);
    if (pendingFunction) {
      // A function was already pending (rare double-press); resolve inner first.
      const innerMeta = UNARY_FUNCS[pendingFunction];
      engineExpr = meta.tmpl(innerMeta.tmpl(original));
    }
    try {
      const value = evalExpr(engineExpr);
      currentInput = fmt(value);
      lastFunctionDisplay = meta.suffix ? `${original}${meta.label}` : `${meta.label}(${original})`;
      pendingFunction = null;
      awaitingOperand = false;
      emit();
    } catch (err) {
      error = err instanceof CalcError ? err.message : 'Invalid operation';
      emit();
    }
  }

  // ---- constants / memory recall: drop a literal value in as the operand -
  function insertValue(value) {
    error = null;
    if (justEvaluated) resetForFreshEntry();
    currentInput = fmt(value);
    awaitingOperand = false;
    pendingFunction = null;
    lastFunctionDisplay = null;
    justEvaluated = false;
    emit();
  }

  // ---- equals -------------------------------------------------------------
  function equals() {
    error = null;
    try {
      let exprString;
      let historyDisplay;

      if (justEvaluated) {
        if (lastOperatorEngine === null) return { ok: true, noop: true };
        exprString = `(${currentInput})${lastOperatorEngine}(${lastOperandEngine})`;
        historyDisplay = `${currentInput} ${segments.length ? '' : ''}${lastOperandDisplay}`.trim();
        const opDisplay = lastOperatorEngine === '+' ? '+' : lastOperatorEngine === '-' ? '−'
          : lastOperatorEngine === '*' ? '×' : lastOperatorEngine === '/' ? '÷'
          : lastOperatorEngine.trim() === 'mod' ? 'mod' : lastOperatorEngine;
        historyDisplay = `${currentInput} ${opDisplay} ${lastOperandDisplay}`;
      } else if (awaitingOperand && lastOpSegment()) {
        const dup = lastNumberSegment();
        const dupEngine = dup ? dup.engine : currentInput;
        const dupDisplay = dup ? dup.display : currentInput;
        exprString = segments.map((s) => s.engine).join('') + `(${dupEngine})`;
        historyDisplay = segments.map((s) => s.display).join(' ') + ` ${dupDisplay}`;
        lastOperatorEngine = lastOpSegment().engine;
        lastOperandEngine = dupEngine;
        lastOperandDisplay = dupDisplay;
      } else {
        commitCurrentOperand();
        exprString = segments.map((s) => s.engine).join('');
        historyDisplay = segments.map((s) => s.display).join(' ');
        const opSeg = [...segments].reverse().find((s) => s.kind === 'op');
        if (opSeg) {
          const idx = segments.indexOf(opSeg);
          const numAfter = segments[idx + 1];
          lastOperatorEngine = opSeg.engine;
          lastOperandEngine = numAfter ? numAfter.engine : null;
          lastOperandDisplay = numAfter ? numAfter.display : null;
        } else {
          lastOperatorEngine = null;
          lastOperandEngine = null;
          lastOperandDisplay = null;
        }
      }

      if (!exprString || !exprString.trim()) return { ok: true, noop: true };

      const value = evalExpr(exprString);
      const display = fmt(value);

      if (typeof History !== 'undefined') History.add(historyDisplay, display);

      segments = [];
      currentInput = display;
      pendingFunction = null;
      lastFunctionDisplay = null;
      awaitingOperand = true;
      justEvaluated = true;
      resultHistoryLine = historyDisplay;
      emit();
      return { ok: true, value, display, expression: historyDisplay };
    } catch (err) {
      error = err instanceof CalcError ? err.message : 'Invalid expression';
      emit();
      return { ok: false, error };
    }
  }

  return {
    onChange,
    getState,
    getCurrentValue,
    digit,
    decimal,
    toggleSign,
    backspace,
    clearAll,
    seed,
    pressOperator,
    percent,
    pressFunction,
    insertValue,
    equals,
  };
})();
