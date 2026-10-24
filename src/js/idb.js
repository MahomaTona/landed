/* IndexedDB: große Binärdaten (Fotos, Videos, Hintergrundbild). */

const IDB = {
  _db: null,
  open() {
    if (this._db) return this._db;
    this._db = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB nicht verfügbar'));
      const rq = indexedDB.open('landed' + (PROFILE ? '-' + PROFILE : ''), 1);
      rq.onupgradeneeded = () => {
        rq.result.createObjectStore('blobs');
        rq.result.createObjectStore('misc');
      };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
    this._db.catch(() => { this._db = null; });
    return this._db;
  },
  async _tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const res = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(res && 'result' in res ? res.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  },
  async get(store, key) { try { return await this._tx(store, 'readonly', (s) => s.get(key)); } catch { return undefined; } },
  async put(store, key, val) { try { await this._tx(store, 'readwrite', (s) => s.put(val, key)); return true; } catch { return false; } },
  async del(store, key) { try { await this._tx(store, 'readwrite', (s) => s.delete(key)); } catch { /* egal */ } },
  async count(store) { try { return await this._tx(store, 'readonly', (s) => s.count()); } catch { return 0; } },
  async clear(store) { try { await this._tx(store, 'readwrite', (s) => s.clear()); } catch { /* egal */ } },
};
