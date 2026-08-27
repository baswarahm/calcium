/**
 * history.js
 * Stores {expression, result, timestamp} entries, capped at MAX_ENTRIES,
 * persisted to localStorage so history survives a page refresh.
 */
const History = (() => {
  const MAX_ENTRIES = 100;
  let entries = Storage.get('history', []);

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => fn(getAll())); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function persist() { Storage.set('history', entries); }

  function getAll() { return [...entries]; }

  function add(expression, resultDisplay) {
    entries.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      expression,
      result: resultDisplay,
      timestamp: Date.now(),
    });
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    persist();
    emit();
  }

  function remove(id) {
    entries = entries.filter((e) => e.id !== id);
    persist();
    emit();
  }

  function clear() {
    entries = [];
    persist();
    emit();
  }

  return { onChange, getAll, add, remove, clear, MAX_ENTRIES };
})();
