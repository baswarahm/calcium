/**
 * converter.js
 * Unit conversion across common categories. Linear categories store a
 * factor relative to a base unit; temperature needs its own affine
 * conversion functions since it isn't a simple multiplicative scale.
 */
const Converter = (() => {
  const CATEGORIES = {
    length: {
      label: 'Length', base: 'm',
      units: {
        mm: 0.001, cm: 0.01, m: 1, km: 1000,
        in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
      },
    },
    mass: {
      label: 'Mass', base: 'g',
      units: { mg: 0.001, g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 },
    },
    temperature: { label: 'Temperature', base: 'C', special: true },
    area: {
      label: 'Area', base: 'm2',
      units: {
        mm2: 1e-6, cm2: 1e-4, m2: 1, km2: 1e6,
        in2: 0.00064516, ft2: 0.09290304, acre: 4046.8564224, hectare: 10000,
      },
    },
    volume: {
      label: 'Volume', base: 'l',
      units: {
        ml: 0.001, l: 1, m3: 1000,
        tsp: 0.00492892, tbsp: 0.0147868, cup: 0.24, pt: 0.473176,
        qt: 0.946353, gal: 3.78541,
      },
    },
    speed: {
      label: 'Speed', base: 'm/s',
      units: { 'm/s': 1, 'km/h': 0.277778, mph: 0.44704, knot: 0.514444, 'ft/s': 0.3048 },
    },
    time: {
      label: 'Time', base: 's',
      units: { ms: 0.001, s: 1, min: 60, h: 3600, day: 86400, week: 604800, year: 31557600 },
    },
    energy: {
      label: 'Energy', base: 'J',
      units: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6, eV: 1.602176634e-19 },
    },
    pressure: {
      label: 'Pressure', base: 'Pa',
      units: { Pa: 1, kPa: 1000, bar: 1e5, atm: 101325, psi: 6894.757, mmHg: 133.322 },
    },
    data: {
      label: 'Data', base: 'B',
      units: {
        bit: 0.125, B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4,
      },
    },
  };

  function toCelsius(v, unit) {
    switch (unit) {
      case 'C': return v;
      case 'F': return (v - 32) * (5 / 9);
      case 'K': return v - 273.15;
      default: throw new CalcError(`Unknown temperature unit: ${unit}`);
    }
  }
  function fromCelsius(v, unit) {
    switch (unit) {
      case 'C': return v;
      case 'F': return v * (9 / 5) + 32;
      case 'K': return v + 273.15;
      default: throw new CalcError(`Unknown temperature unit: ${unit}`);
    }
  }

  function convert(category, value, fromUnit, toUnit) {
    const cat = CATEGORIES[category];
    if (!cat) throw new CalcError(`Unknown category: ${category}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new CalcError('Enter a valid number');

    if (cat.special) { // temperature
      return fromCelsius(toCelsius(value, fromUnit), toUnit);
    }
    const fFrom = cat.units[fromUnit];
    const fTo = cat.units[toUnit];
    if (fFrom === undefined || fTo === undefined) throw new CalcError('Unknown unit for this category');
    const base = value * fFrom;
    return base / fTo;
  }

  function unitsFor(category) {
    const cat = CATEGORIES[category];
    if (!cat) return [];
    if (cat.special) return ['C', 'F', 'K'];
    return Object.keys(cat.units);
  }

  return { CATEGORIES, convert, unitsFor };
})();
