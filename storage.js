/**
 * storage.js
 * Single point of contact with localStorage. Every other module reads/writes
 * through this object instead of calling localStorage directly, so the
 * persistence strategy (keys, versioning, JSON handling) lives in one place.
 */
const Storage = (() => {
  const PREFIX = 'sciCalc:';
  const VERSION = 1;

  function key(name) {
    return `${PREFIX}v${VERSION}:${name}`;
  }

  function get(name, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key(name));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('Storage.get failed for', name, err);
      return fallback;
    }
  }

  function set(name, value) {
    try {
      window.localStorage.setItem(key(name), JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn('Storage.set failed for', name, err);
      return false;
    }
  }

  function remove(name) {
    try {
      window.localStorage.removeItem(key(name));
    } catch (err) {
      console.warn('Storage.remove failed for', name, err);
    }
  }

  function clearAll() {
    try {
      const toRemove = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(PREFIX)) toRemove.push(k);
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch (err) {
      console.warn('Storage.clearAll failed', err);
    }
  }

  return { get, set, remove, clearAll };
})();
