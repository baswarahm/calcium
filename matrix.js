/**
 * matrix.js
 * Generic matrix operations implemented with plain 2D arrays. Designed
 * around 2x2 and 3x3 (the sizes the UI exposes) but the algorithms are
 * dimension-general via cofactor expansion, so larger square matrices work
 * for everything except the closed-form 2x2/3x3 shortcuts aren't needed.
 */
const MatrixOps = (() => {
  function sameDims(a, b) {
    return a.length === b.length && a.every((row, i) => row.length === b[i].length);
  }

  function add(a, b) {
    if (!sameDims(a, b)) throw new CalcError('Matrix dimension mismatch');
    return a.map((row, i) => row.map((v, j) => v + b[i][j]));
  }

  function subtract(a, b) {
    if (!sameDims(a, b)) throw new CalcError('Matrix dimension mismatch');
    return a.map((row, i) => row.map((v, j) => v - b[i][j]));
  }

  function scalarMultiply(a, k) {
    return a.map((row) => row.map((v) => v * k));
  }

  function multiply(a, b) {
    const aRows = a.length, aCols = a[0].length;
    const bRows = b.length, bCols = b[0].length;
    if (aCols !== bRows) throw new CalcError('Matrix dimension mismatch: inner dimensions must match');
    const result = Array.from({ length: aRows }, () => new Array(bCols).fill(0));
    for (let i = 0; i < aRows; i++) {
      for (let j = 0; j < bCols; j++) {
        let sum = 0;
        for (let k = 0; k < aCols; k++) sum += a[i][k] * b[k][j];
        result[i][j] = sum;
      }
    }
    return result;
  }

  function transpose(a) {
    const rows = a.length, cols = a[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) result[j][i] = a[i][j];
    return result;
  }

  function isSquare(a) { return a.length > 0 && a.every((row) => row.length === a.length); }

  function minor(a, row, col) {
    return a
      .filter((_, i) => i !== row)
      .map((r) => r.filter((_, j) => j !== col));
  }

  function determinant(a) {
    if (!isSquare(a)) throw new CalcError('Determinant requires a square matrix');
    const n = a.length;
    if (n === 1) return a[0][0];
    if (n === 2) return a[0][0] * a[1][1] - a[0][1] * a[1][0];
    let det = 0;
    for (let j = 0; j < n; j++) {
      const sign = j % 2 === 0 ? 1 : -1;
      det += sign * a[0][j] * determinant(minor(a, 0, j));
    }
    return det;
  }

  function trace(a) {
    if (!isSquare(a)) throw new CalcError('Trace requires a square matrix');
    return a.reduce((sum, row, i) => sum + row[i], 0);
  }

  function identity(n) {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  }

  function inverse(a) {
    if (!isSquare(a)) throw new CalcError('Inverse requires a square matrix');
    const n = a.length;
    const det = determinant(a);
    if (Math.abs(det) < 1e-12) throw new CalcError('Matrix is singular (determinant is 0); no inverse exists');

    if (n === 1) return [[1 / a[0][0]]];

    // Cofactor / adjugate method — fine for the 2x2/3x3 sizes the UI supports.
    const cofactors = a.map((row, i) => row.map((_, j) => {
      const sign = (i + j) % 2 === 0 ? 1 : -1;
      return sign * determinant(minor(a, i, j));
    }));
    const adjugate = transpose(cofactors);
    return adjugate.map((row) => row.map((v) => v / det));
  }

  return { add, subtract, scalarMultiply, multiply, transpose, determinant, trace, identity, inverse, isSquare, sameDims };
})();
