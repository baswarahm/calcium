/**
 * statistics.js
 * Descriptive statistics over a flat numeric dataset. Population and
 * sample variance/std-dev are both computed since which one applies
 * depends on whether the dataset is the whole population or a sample.
 */
const Statistics = (() => {
  function requireData(data) {
    if (!Array.isArray(data) || data.length === 0) throw new CalcError('Enter at least one number');
    if (data.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new CalcError('Dataset contains an invalid number');
    }
  }

  function sum(data) { return data.reduce((s, v) => s + v, 0); }
  function mean(data) { return sum(data) / data.length; }

  function median(data) {
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    const mid = Math.floor(n / 2);
    return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  function mode(data) {
    const counts = new Map();
    data.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    const maxCount = Math.max(...counts.values());
    if (maxCount === 1) return []; // no repeats -> no mode
    return [...counts.entries()].filter(([, c]) => c === maxCount).map(([v]) => v).sort((a, b) => a - b);
  }

  function variance(data, sample = false) {
    const m = mean(data);
    const divisor = sample ? data.length - 1 : data.length;
    if (divisor <= 0) throw new CalcError('Sample variance needs at least 2 data points');
    return data.reduce((s, v) => s + (v - m) ** 2, 0) / divisor;
  }

  function stdDev(data, sample = false) { return Math.sqrt(variance(data, sample)); }

  function quartiles(data) {
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    const q2 = median(sorted);
    const lowerHalf = n % 2 === 0 ? sorted.slice(0, n / 2) : sorted.slice(0, (n - 1) / 2);
    const upperHalf = n % 2 === 0 ? sorted.slice(n / 2) : sorted.slice((n + 1) / 2);
    const q1 = lowerHalf.length ? median(lowerHalf) : sorted[0];
    const q3 = upperHalf.length ? median(upperHalf) : sorted[n - 1];
    return { q1, q2, q3, iqr: q3 - q1 };
  }

  function summarize(data, { sample = false } = {}) {
    requireData(data);
    const sorted = [...data].sort((a, b) => a - b);
    const q = quartiles(data);
    return {
      count: data.length,
      sum: sum(data),
      mean: mean(data),
      median: median(data),
      mode: mode(data),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      range: sorted[sorted.length - 1] - sorted[0],
      variance: data.length > (sample ? 1 : 0) ? variance(data, sample) : null,
      stdDev: data.length > (sample ? 1 : 0) ? stdDev(data, sample) : null,
      q1: q.q1,
      q2: q.q2,
      q3: q.q3,
      iqr: q.iqr,
      sorted,
    };
  }

  return { summarize, mean, median, mode, variance, stdDev, quartiles, sum };
})();
