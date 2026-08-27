/**
 * variables.js
 * User-defined variables (x = 10, y = 25, ...) usable inside expressions.
 * Reserved names that collide with functions or built-in constants are
 * rejected to avoid silently shadowing them.
 */
const Variables = (() => {
  let vars = Storage.get('variables', {});

  const RESERVED = new Set([
    ...Object.keys(MathFn.CONSTANTS),
    ...FUNCTION_NAMES,
  ]);

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => fn(getAll())); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function persist() { Storage.set('variables', vars); }

  function getAll() { return { ...vars }; }

  function set(name, value) {
    if (!/^[a-zA-Z_]\w*$/.test(name)) {
      throw new CalcError(`Invalid variable name: ${name}`);
    }
    if (RESERVED.has(name.toLowerCase())) {
      throw new CalcError(`"${name}" is reserved and can't be used as a variable`);
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new CalcError('Variable value must be a finite number');
    }
    vars[name] = value;
    persist();
    emit();
  }

  function remove(name) {
    delete vars[name];
    persist();
    emit();
  }

  function clearAll() {
    vars = {};
    persist();
    emit();
  }

  return { onChange, getAll, set, remove, clearAll };
})();
