/**
 * solver.js
 * Solves linear (ax + b = c) and quadratic (ax² + bx + c = 0) equations.
 * Input is parsed loosely: users type coefficients directly rather than a
 * free-form equation string, which keeps the parser small and the results
 * unambiguous (matches the "a, b, c" fields the Equation Solver UI exposes).
 */
const Solver = (() => {
  function solveLinear(a, b, c) {
    // a*x + b = c  =>  x = (c - b) / a
    if (a === 0) {
      if (b === c) return { type: 'infinite', message: 'Every real number is a solution' };
      return { type: 'none', message: 'No solution exists' };
    }
    const x = (c - b) / a;
    return { type: 'one', x: MathFn.cleanFloat(x, null) };
  }

  function solveQuadratic(a, b, c) {
    if (a === 0) {
      // Degenerates to linear: bx + c = 0
      if (b === 0) {
        if (c === 0) return { type: 'infinite', message: 'Every real number is a solution', a, b, c };
        return { type: 'none', message: 'No solution exists', a, b, c };
      }
      const x = -c / b;
      return { type: 'one', x: MathFn.cleanFloat(x, null), a, b, c, discriminant: null };
    }

    const discriminant = b * b - 4 * a * c;
    const base = { a, b, c, discriminant: MathFn.cleanFloat(discriminant, null) };

    if (discriminant > 0) {
      const sqrtD = Math.sqrt(discriminant);
      const x1 = (-b + sqrtD) / (2 * a);
      const x2 = (-b - sqrtD) / (2 * a);
      return {
        ...base,
        type: 'two',
        x1: MathFn.cleanFloat(x1, null),
        x2: MathFn.cleanFloat(x2, null),
        message: 'Two distinct real solutions',
      };
    }
    if (discriminant === 0) {
      const x = -b / (2 * a);
      return { ...base, type: 'oneDouble', x: MathFn.cleanFloat(x, null), message: 'One real solution (repeated root)' };
    }
    const real = -b / (2 * a);
    const imag = Math.sqrt(-discriminant) / (2 * a);
    return {
      ...base,
      type: 'complex',
      real: MathFn.cleanFloat(real, null),
      imag: MathFn.cleanFloat(Math.abs(imag), null),
      message: 'No real solution (two complex solutions)',
    };
  }

  return { solveLinear, solveQuadratic };
})();
