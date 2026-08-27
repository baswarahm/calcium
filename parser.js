/**
 * parser.js
 * A hand-written tokenizer + recursive-descent parser + tree evaluator for
 * calculator expressions. Deliberately does NOT use eval() or Function() —
 * user input is only ever interpreted as data by this grammar, never as code.
 *
 * Grammar (precedence low -> high):
 *   expression := term (('+' | '-') term)*
 *   term       := unary (('*' | '/' | '%mod' | implicit) unary)*
 *   unary      := ('-' | '+') unary | power
 *   power      := postfix ('^' unary)?              // right-associative
 *   postfix    := primary ('!' '!'? | '%')*          // factorial / percent
 *   primary    := NUMBER | IDENT '(' argList ')' | IDENT | '(' expression ')'
 */

const FUNCTION_NAMES = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'ln', 'log', 'log2', 'sqrt', 'cbrt', 'exp',
  'abs', 'floor', 'ceil', 'sign',
  'root', 'logb', 'npr', 'ncr', 'gcd', 'lcm', 'min', 'max', 'randint', 'rand',
]);

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const s = input;
  while (i < s.length) {
    const c = s[i];

    if (/\s/.test(c)) { i++; continue; }

    if (/[0-9.]/.test(c)) {
      let j = i;
      let sawDot = false;
      let sawExp = false;
      while (j < s.length) {
        const ch = s[j];
        if (ch >= '0' && ch <= '9') { j++; continue; }
        if (ch === '.' && !sawDot && !sawExp) { sawDot = true; j++; continue; }
        if ((ch === 'e' || ch === 'E') && !sawExp && j > i) {
          // only treat as exponent marker if followed by digit or sign+digit
          const next = s[j + 1];
          if (next && (/[0-9]/.test(next) || ((next === '+' || next === '-') && /[0-9]/.test(s[j + 2] || '')))) {
            sawExp = true; j++;
            if (s[j] === '+' || s[j] === '-') j++;
            continue;
          }
        }
        break;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }

    if (/[a-zA-Z_π]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      const name = s.slice(i, j);
      if (name.toLowerCase() === 'mod') {
        // Dedicated token so "a mod b" never collides with postfix "%" percent.
        tokens.push({ type: 'MOD', value: 'mod' });
      } else {
        tokens.push({ type: 'IDENT', value: name });
      }
      i = j;
      continue;
    }

    if (c === 'π') { tokens.push({ type: 'IDENT', value: 'pi' }); i++; continue; }
    if (c === '√') { tokens.push({ type: 'IDENT', value: 'sqrt' }); i++; continue; }

    if ('+-*/^%(),!'.includes(c)) {
      tokens.push({ type: c, value: c });
      i++;
      continue;
    }
    if (c === '×') { tokens.push({ type: '*', value: '*' }); i++; continue; }
    if (c === '÷') { tokens.push({ type: '/', value: '/' }); i++; continue; }
    if (c === '−') { tokens.push({ type: '-', value: '-' }); i++; continue; }

    throw new CalcError(`Invalid syntax near "${c}"`);
  }
  return tokens;
}

class Parser {
  constructor(tokens, context) {
    this.tokens = tokens;
    this.pos = 0;
    this.context = context; // { variables, angleMode }
  }

  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }
  atEnd() { return this.pos >= this.tokens.length; }

  expect(type) {
    const t = this.next();
    if (!t || t.type !== type) {
      throw new CalcError('Invalid expression: missing ' + type);
    }
    return t;
  }

  parse() {
    if (this.tokens.length === 0) throw new CalcError('Invalid expression');
    const node = this.parseExpression();
    if (!this.atEnd()) throw new CalcError('Invalid syntax: unexpected input');
    return node;
  }

  parseExpression() {
    let node = this.parseTerm();
    while (!this.atEnd() && (this.peek().type === '+' || this.peek().type === '-')) {
      const op = this.next().type;
      const right = this.parseTerm();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  startsFactor() {
    if (this.atEnd()) return false;
    const t = this.peek().type;
    return t === 'NUMBER' || t === 'IDENT' || t === '(';
  }

  parseTerm() {
    let node = this.parseUnary();
    while (!this.atEnd()) {
      const t = this.peek().type;
      if (t === '*' || t === '/' || t === 'MOD') {
        const op = this.next().type;
        const right = this.parseUnary();
        node = { type: 'binary', op, left: node, right };
      } else if (this.startsFactor()) {
        // implicit multiplication: 2π, 2(3+4), 3sin(30)
        const right = this.parseUnary();
        node = { type: 'binary', op: '*', left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  parseUnary() {
    if (!this.atEnd() && (this.peek().type === '-' || this.peek().type === '+')) {
      const op = this.next().type;
      const operand = this.parseUnary();
      return { type: 'unary', op, operand };
    }
    return this.parsePower();
  }

  parsePower() {
    const base = this.parsePostfix();
    if (!this.atEnd() && this.peek().type === '^') {
      this.next();
      const exponent = this.parseUnary(); // right-associative, allows -2^-2
      return { type: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  parsePostfix() {
    let node = this.parsePrimary();
    for (;;) {
      if (!this.atEnd() && this.peek().type === '!') {
        this.next();
        if (!this.atEnd() && this.peek().type === '!') {
          this.next();
          node = { type: 'postfix', op: '!!', operand: node };
        } else {
          node = { type: 'postfix', op: '!', operand: node };
        }
      } else if (!this.atEnd() && this.peek().type === '%') {
        this.next();
        node = { type: 'postfix', op: '%', operand: node };
      } else {
        break;
      }
    }
    return node;
  }

  parseArgList() {
    const args = [];
    if (this.peek() && this.peek().type === ')') return args;
    args.push(this.parseExpression());
    while (!this.atEnd() && this.peek().type === ',') {
      this.next();
      args.push(this.parseExpression());
    }
    return args;
  }

  parsePrimary() {
    if (this.atEnd()) throw new CalcError('Invalid expression: unexpected end');
    const t = this.next();

    if (t.type === 'NUMBER') return { type: 'number', value: t.value };

    if (t.type === '(') {
      const node = this.parseExpression();
      this.expect(')');
      return node;
    }

    if (t.type === 'IDENT') {
      const lower = t.value.toLowerCase();
      if (!this.atEnd() && this.peek().type === '(' && FUNCTION_NAMES.has(lower)) {
        this.next(); // consume '('
        const args = this.parseArgList();
        this.expect(')');
        return { type: 'call', name: lower, args };
      }
      return { type: 'ident', name: t.value };
    }

    throw new CalcError('Invalid syntax: unexpected token');
  }
}

function resolveIdent(name, context) {
  const lower = name.toLowerCase();
  if (MathFn.CONSTANTS[lower]) return MathFn.CONSTANTS[lower].value;
  if (MathFn.SCIENTIFIC_CONSTANTS[name]) return MathFn.SCIENTIFIC_CONSTANTS[name].value;
  if (MathFn.SCIENTIFIC_CONSTANTS[lower]) return MathFn.SCIENTIFIC_CONSTANTS[lower].value;
  if (context.variables && Object.prototype.hasOwnProperty.call(context.variables, name)) {
    return context.variables[name];
  }
  if (context.variables && Object.prototype.hasOwnProperty.call(context.variables, lower)) {
    return context.variables[lower];
  }
  throw new CalcError(`Undefined variable: ${name}`);
}

function evaluateNode(node, context) {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'ident':
      return resolveIdent(node.name, context);

    case 'unary': {
      const v = evaluateNode(node.operand, context);
      return node.op === '-' ? -v : v;
    }

    case 'postfix': {
      const v = evaluateNode(node.operand, context);
      if (node.op === '!') return MathFn.factorial(v);
      if (node.op === '!!') return MathFn.doubleFactorial(v);
      if (node.op === '%') return v / 100;
      break;
    }

    case 'binary': {
      const a = evaluateNode(node.left, context);
      const b = evaluateNode(node.right, context);
      switch (node.op) {
        case '+': return MathFn.checkFinite(a + b);
        case '-': return MathFn.checkFinite(a - b);
        case '*': return MathFn.checkFinite(a * b);
        case '/':
          if (b === 0) throw new CalcError('Cannot divide by zero');
          return MathFn.checkFinite(a / b);
        case 'MOD':
          if (b === 0) throw new CalcError('Cannot divide by zero');
          return MathFn.checkFinite(a % b);
        case '^':
          if (a === 0 && b < 0) throw new CalcError('Cannot divide by zero');
          if (a < 0 && !Number.isInteger(b)) throw new CalcError('Domain error: fractional power of negative number');
          return MathFn.checkFinite(Math.pow(a, b));
        default:
          throw new CalcError('Invalid syntax');
      }
    }

    case 'call':
      return evaluateCall(node.name, node.args, context);

    default:
      throw new CalcError('Invalid syntax');
  }
}

function evaluateCall(name, argNodes, context) {
  const mode = context.angleMode || 'DEG';
  const args = argNodes.map((n) => evaluateNode(n, context));
  const arity1 = (fn) => {
    if (args.length !== 1) throw new CalcError(`${name}() needs exactly 1 argument`);
    return fn(args[0]);
  };
  const arity2 = (fn) => {
    if (args.length !== 2) throw new CalcError(`${name}() needs exactly 2 arguments`);
    return fn(args[0], args[1]);
  };

  switch (name) {
    case 'sin': return arity1((x) => MathFn.sin(x, mode));
    case 'cos': return arity1((x) => MathFn.cos(x, mode));
    case 'tan': return arity1((x) => MathFn.tan(x, mode));
    case 'asin': return arity1((x) => MathFn.asin(x, mode));
    case 'acos': return arity1((x) => MathFn.acos(x, mode));
    case 'atan': return arity1((x) => MathFn.atan(x, mode));
    case 'sinh': return arity1(MathFn.sinh);
    case 'cosh': return arity1(MathFn.cosh);
    case 'tanh': return arity1(MathFn.tanh);
    case 'asinh': return arity1(MathFn.asinh);
    case 'acosh': return arity1(MathFn.acosh);
    case 'atanh': return arity1(MathFn.atanh);
    case 'ln': return arity1((x) => MathFn.logBase(x, Math.E));
    case 'log': return args.length === 2 ? MathFn.logBase(args[0], args[1]) : arity1((x) => MathFn.logBase(x, 10));
    case 'log2': return arity1((x) => MathFn.logBase(x, 2));
    case 'logb': return arity2((x, b) => MathFn.logBase(x, b));
    case 'sqrt': return arity1((x) => {
      if (x < 0) throw new CalcError('Domain error: square root of negative number');
      return Math.sqrt(x);
    });
    case 'cbrt': return arity1((x) => MathFn.nthRoot(x, 3));
    case 'root': return arity2((x, n) => MathFn.nthRoot(x, n));
    case 'exp': return arity1((x) => MathFn.checkFinite(Math.exp(x)));
    case 'abs': return arity1(Math.abs);
    case 'floor': return arity1(Math.floor);
    case 'ceil': return arity1(Math.ceil);
    case 'sign': return arity1(Math.sign);
    case 'npr': return arity2(MathFn.nPr);
    case 'ncr': return arity2(MathFn.nCr);
    case 'gcd': return arity2(MathFn.gcd);
    case 'lcm': return arity2(MathFn.lcm);
    case 'min': return args.length ? Math.min(...args) : (() => { throw new CalcError('min() needs at least 1 argument'); })();
    case 'max': return args.length ? Math.max(...args) : (() => { throw new CalcError('max() needs at least 1 argument'); })();
    case 'randint': return arity2((a, b) => MathFn.randomInt(a, b));
    case 'rand': return Math.random();
    default:
      throw new CalcError(`Unknown function: ${name}`);
  }
}

const ExprParser = {
  /**
   * Evaluate a raw expression string.
   * context: { variables: {name: number}, angleMode: 'DEG'|'RAD'|'GRAD' }
   * Returns a plain number.
   */
  evaluate(input, context = {}) {
    if (typeof input !== 'string' || input.trim() === '') {
      throw new CalcError('Invalid expression');
    }
    const tokens = tokenize(input);
    const ast = new Parser(tokens, context).parse();
    return evaluateNode(ast, context);
  },

  tokenize,
};
