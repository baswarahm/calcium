/**
 * memory.js
 * Classic calculator memory (MC/MR/M+/M-) plus a small set of named memory
 * slots for keeping a few labeled values around at once.
 */
const Memory = (() => {
  let value = Storage.get('memoryValue', 0);
  let hasValue = Storage.get('memoryHasValue', false);
  let slots = Storage.get('memorySlots', {}); // { label: number }

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => fn(getState())); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function persist() {
    Storage.set('memoryValue', value);
    Storage.set('memoryHasValue', hasValue);
    Storage.set('memorySlots', slots);
  }

  function getState() {
    return { value, hasValue, slots: { ...slots } };
  }

  function clear() {
    value = 0;
    hasValue = false;
    persist();
    emit();
  }

  function recall() {
    return hasValue ? value : 0;
  }

  function add(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return;
    value = MathFn.checkFinite(value + amount);
    hasValue = true;
    persist();
    emit();
  }

  function subtract(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return;
    value = MathFn.checkFinite(value - amount);
    hasValue = true;
    persist();
    emit();
  }

  function setSlot(label, v) {
    if (!label) return;
    slots[label] = v;
    persist();
    emit();
  }
  function deleteSlot(label) {
    delete slots[label];
    persist();
    emit();
  }
  function getSlots() { return { ...slots }; }

  return { onChange, getState, clear, recall, add, subtract, setSlot, deleteSlot, getSlots };
})();
