/* Storage: IndexedDB for library + metadata cache, localStorage for user state */
(function () {
  'use strict';
  const DB_NAME = 'cinematheque', DB_VER = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const s of ['kv', 'meta', 'coll', 'person']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode); const s = t.objectStore(store);
      let out; Promise.resolve(fn(s)).then(v => { out = v; });
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  const DB = {
    get: (store, key) => tx(store, 'readonly', s => req(s.get(key))),
    put: (store, key, val) => tx(store, 'readwrite', s => { s.put(val, key); }),
    del: (store, key) => tx(store, 'readwrite', s => { s.delete(key); }),
    clear: store => tx(store, 'readwrite', s => { s.clear(); }),
    async all(store) {
      const db = await open();
      return new Promise((res, rej) => {
        const out = {}; const t = db.transaction(store, 'readonly');
        const c = t.objectStore(store).openCursor();
        c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
        t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
      });
    }
  };

  /* ---- user state (watched, watchlist, ratings, episode progress, game) ---- */
  const UKEY = 'cin.user.v1';
  function loadUser() {
    try { return Object.assign({ watched: {}, list: {}, rate: {}, eps: {}, game: {} }, JSON.parse(localStorage.getItem(UKEY) || '{}')); }
    catch (e) { return { watched: {}, list: {}, rate: {}, eps: {}, game: {} }; }
  }
  const User = loadUser();
  let saveT = null;
  function saveUser() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(UKEY, JSON.stringify(User)); } catch (e) {} }, 150); }

  const Settings = {
    get(k, d) { try { const v = localStorage.getItem('cin.set.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cin.set.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  window.DB = DB; window.User = User; window.saveUser = saveUser; window.Settings = Settings;
})();
