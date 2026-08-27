/**
 * vector.js
 * 2D/3D vector operations. Cross product is only defined for 3D in the
 * classic sense, so 2D vectors are treated as having a zero z-component
 * when cross product is requested.
 */
const VectorOps = (() => {
  function pad3(v) { return v.length === 2 ? [v[0], v[1], 0] : v; }

  function sameDims(a, b) { return a.length === b.length; }

  function add(a, b) {
    if (!sameDims(a, b)) throw new CalcError('Vectors must have the same number of components');
    return a.map((v, i) => v + b[i]);
  }
  function subtract(a, b) {
    if (!sameDims(a, b)) throw new CalcError('Vectors must have the same number of components');
    return a.map((v, i) => v - b[i]);
  }
  function dot(a, b) {
    if (!sameDims(a, b)) throw new CalcError('Vectors must have the same number of components');
    return a.reduce((sum, v, i) => sum + v * b[i], 0);
  }
  function cross(a, b) {
    const [a1, a2, a3] = pad3(a);
    const [b1, b2, b3] = pad3(b);
    return [a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1];
  }
  function magnitude(a) {
    return Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  }
  function unit(a) {
    const m = magnitude(a);
    if (m === 0) throw new CalcError('Cannot normalize the zero vector');
    return a.map((v) => v / m);
  }
  function angleBetween(a, b, mode = 'DEG') {
    const ma = magnitude(a), mb = magnitude(b);
    if (ma === 0 || mb === 0) throw new CalcError('Cannot find angle with a zero vector');
    let cosTheta = dot(a, b) / (ma * mb);
    cosTheta = Math.max(-1, Math.min(1, cosTheta));
    const rad = Math.acos(cosTheta);
    return MathFn.fromRadians(rad, mode);
  }

  return { add, subtract, dot, cross, magnitude, unit, angleBetween };
})();
