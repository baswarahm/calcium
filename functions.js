/**
 * functions.js
 * Pure math helpers shared across the app: constants, angle-aware
 * trigonometry, combinatorics, number theory utilities, and the
 * CalcError type used for friendly error messages everywhere.
 */

class CalcError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CalcError';
  }
}

const MathFn = (() => {
  const PHI = (1 + Math.sqrt(5)) / 2;

  const CONSTANTS = {
    pi: { symbol: 'π', name: 'Pi', value: Math.PI },
    e: { symbol: 'e', name: "Euler's number", value: Math.E },
    phi: { symbol: 'φ', name: 'Golden ratio', value: PHI },
    sqrt2: { symbol: '√2', name: 'Square root of 2', value: Math.SQRT2 },
    sqrt3: { symbol: '√3', name: 'Square root of 3', value: Math.sqrt(3) },
    ln2: { symbol: 'ln2', name: 'Natural log of 2', value: Math.LN2 },
    ln10: { symbol: 'ln10', name: 'Natural log of 10', value: Math.LN10 },
  };

  const SCIENTIFIC_CONSTANTS = {
    c: { symbol: 'c', name: 'Speed of light', unit: 'm/s', value: 299792458 },
    h: { symbol: 'h', name: 'Planck constant', unit: 'J·s', value: 6.62607015e-34 },
    G: { symbol: 'G', name: 'Gravitational constant', unit: 'm³/(kg·s²)', value: 6.6743e-11 },
    qe: { symbol: 'qₑ', name: 'Elementary charge', unit: 'C', value: 1.602176634e-19 },
    kB: { symbol: 'kB', name: 'Boltzmann constant', unit: 'J/K', value: 1.380649e-23 },
    NA: { symbol: 'NA', name: 'Avogadro constant', unit: '1/mol', value: 6.02214076e23 },
  };

  // ---- angle mode helpers ----------------------------------------------
  function toRadians(value, mode) {
    switch (mode) {
      case 'DEG': return (value * Math.PI) / 180;
      case 'GRAD': return (value * Math.PI) / 200;
      default: return value; // RAD
    }
  }

  function fromRadians(value, mode) {
    switch (mode) {
      case 'DEG': return (value * 180) / Math.PI;
      case 'GRAD': return (value * 200) / Math.PI;
      default: return value; // RAD
    }
  }

  function checkFinite(v, msg = 'Overflow') {
    if (Number.isNaN(v)) throw new CalcError('Domain error');
    if (!Number.isFinite(v)) throw new CalcError(msg);
    return v;
  }

  // ---- trig (angle-mode aware) ------------------------------------------
  function makeTrig(fn) {
    return (x, mode) => checkFinite(fn(toRadians(x, mode)));
  }
  function makeInverseTrig(fn) {
    return (x, mode) => checkFinite(fromRadians(fn(x), mode));
  }

  const sin = makeTrig(Math.sin);
  const cos = makeTrig(Math.cos);
  const tan = makeTrig((r) => {
    const c = Math.cos(r);
    if (Math.abs(c) < 1e-12) throw new CalcError('Domain error: tan undefined here');
    return Math.tan(r);
  });
  const asin = (x, mode) => {
    if (x < -1 || x > 1) throw new CalcError('Domain error: asin needs -1..1');
    return makeInverseTrig(Math.asin)(x, mode);
  };
  const acos = (x, mode) => {
    if (x < -1 || x > 1) throw new CalcError('Domain error: acos needs -1..1');
    return makeInverseTrig(Math.acos)(x, mode);
  };
  const atan = makeInverseTrig(Math.atan);

  // ---- powers / roots / logs ---------------------------------------------
  function factorial(n) {
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
      throw new CalcError('Invalid factorial: needs a non-negative integer');
    }
    if (n > 170) throw new CalcError('Overflow');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function doubleFactorial(n) {
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
      throw new CalcError('Invalid double factorial: needs a non-negative integer');
    }
    if (n > 300) throw new CalcError('Overflow');
    let r = 1;
    for (let i = n; i > 0; i -= 2) r *= i;
    return r;
  }

  function nthRoot(x, n) {
    if (n === 0) throw new CalcError('Cannot take 0th root');
    if (x < 0) {
      if (Math.floor(n) !== n || n % 2 === 0) {
        throw new CalcError('Domain error: root of negative number');
      }
      return -Math.pow(-x, 1 / n);
    }
    return Math.pow(x, 1 / n);
  }

  function logBase(x, base) {
    if (x <= 0) throw new CalcError('Domain error: log needs x > 0');
    if (base <= 0 || base === 1) throw new CalcError('Domain error: invalid log base');
    return Math.log(x) / Math.log(base);
  }

  // ---- combinatorics -----------------------------------------------------
  function gcd(a, b) {
    a = Math.abs(Math.trunc(a));
    b = Math.abs(Math.trunc(b));
    while (b) { [a, b] = [b, a % b]; }
    return a;
  }

  function lcm(a, b) {
    if (a === 0 || b === 0) return 0;
    return Math.abs(a * b) / gcd(a, b);
  }

  function nPr(n, r) {
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) {
      throw new CalcError('nPr needs non-negative integers');
    }
    if (r > n) throw new CalcError('nPr needs r ≤ n');
    let result = 1;
    for (let i = 0; i < r; i++) result *= (n - i);
    return result;
  }

  function nCr(n, r) {
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) {
      throw new CalcError('nCr needs non-negative integers');
    }
    if (r > n) throw new CalcError('nCr needs r ≤ n');
    r = Math.min(r, n - r);
    let result = 1;
    for (let i = 0; i < r; i++) result = (result * (n - i)) / (i + 1);
    return Math.round(result);
  }

  function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (min > max) throw new CalcError('Invalid range for random integer');
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ---- clean float formatting ---------------------------------------------
  function cleanFloat(v, decimals /* null = automatic */) {
    if (!Number.isFinite(v)) {
      if (Number.isNaN(v)) throw new CalcError('Domain error');
      throw new CalcError('Overflow');
    }
    if (decimals === 'sci') {
      return v.toExponential(6).replace(/\.?0+e/, 'e');
    }
    if (typeof decimals === 'number') {
      return Number(v.toFixed(decimals));
    }
    // Automatic: kill binary floating point noise (0.1+0.2 -> 0.3)
    const rounded = Number(v.toPrecision(12));
    return rounded;
  }

  return {
    CONSTANTS,
    SCIENTIFIC_CONSTANTS,
    toRadians,
    fromRadians,
    checkFinite,
    sin, cos, tan, asin, acos, atan,
    sinh: (x) => checkFinite(Math.sinh(x)),
    cosh: (x) => checkFinite(Math.cosh(x)),
    tanh: (x) => checkFinite(Math.tanh(x)),
    asinh: (x) => checkFinite(Math.asinh(x)),
    acosh: (x) => {
      if (x < 1) throw new CalcError('Domain error: acosh needs x ≥ 1');
      return checkFinite(Math.acosh(x));
    },
    atanh: (x) => {
      if (x <= -1 || x >= 1) throw new CalcError('Domain error: atanh needs -1..1');
      return checkFinite(Math.atanh(x));
    },
    factorial,
    doubleFactorial,
    nthRoot,
    logBase,
    gcd,
    lcm,
    nPr,
    nCr,
    randomInt,
    cleanFloat,
  };
})();
