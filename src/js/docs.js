/* DocStore: geteilte Dokumente einer Crew (Trick-Logs, Feed, Spiele, Spots …).
   - offline-first: lokal in localStorage, Änderungen werden nachgeliefert
   - Konfliktlösung: Last-Writer-Wins pro Dokument (rev = Zeitstempel, monoton)
   - Broker speichert Dokumente als "retained" -> Nachzügler bekommen alles automatisch
   - Neue Direktverbindung -> beide Seiten schicken sich ihren kompletten Stand */

class DocStore extends Emitter {
  constructor() {
    super();
    this.kinds = new Map();   // kind -> Map(id -> doc)
    this.dirty = new Set();   // "kind/id", noch nicht vom Broker bestätigt
    this.net = null;
    this.me = '';
    this.key = '';
    this._save = debounce(() => this._persist(), 600);
  }

  init(net, rid, meId) {
    this.net = net; this.me = meId; this.key = LS_PREFIX + 'docs:' + rid;
    this.kinds.clear(); this.dirty.clear();
    const saved = LS.get(this.key, null);
    if (saved) {
      for (const d of saved.docs) this._set(d);
      saved.dirty.forEach((k) => this.dirty.add(k));
    }
    net.on('doc', ([kind, ...id], obj, own) => this._remote(kind, id.join('/'), obj, own));
    net.on('connected', () => this.flush());
    net.on('link', (pid) => this.dumpTo(pid));
    clearInterval(this._flushT);
    this._flushT = setInterval(() => this.flush(), 9000);
  }

  destroy() { clearInterval(this._flushT); this._persist(); }

  _map(kind) { return this.kinds.get(kind) || this.kinds.set(kind, new Map()).get(kind); }
  _set(d) { this._map(d.k).set(d.id, d); }

  get(kind, id) { const d = this.kinds.get(kind)?.get(id); return d && !d.del ? d : null; }
  list(kind) { return [...(this.kinds.get(kind)?.values() || [])].filter((d) => !d.del); }
  /** Inhalt eines Dokuments (ohne Meta) */
  data(kind, id) { return this.get(kind, id)?.d || null; }
  all(kind) { return this.list(kind).map((d) => d.d); }

  put(kind, id, data) {
    const prev = this._map(kind).get(id);
    const doc = { k: kind, id, rev: Math.max(Date.now(), (prev?.rev || 0) + 1), by: this.me, del: 0, d: data };
    this._set(doc);
    this._publish(doc);
    this._changed(kind, id, doc, 'local');
    return doc;
  }

  remove(kind, id) {
    const prev = this._map(kind).get(id);
    if (!prev || prev.del) return;
    const doc = { k: kind, id, rev: Math.max(Date.now(), prev.rev + 1), by: this.me, del: 1, d: {} };
    this._set(doc);
    this._publish(doc);
    this._changed(kind, id, doc, 'local');
  }

  _wire(doc) { return { k: doc.k, id: doc.id, rev: doc.rev, by: doc.by, del: doc.del, d: doc.d }; }

  async _publish(doc) {
    this.dirty.add(`${doc.k}/${doc.id}`);
    this._save();
    await this.net?.send(`doc/${doc.k}/${doc.id}`, this._wire(doc), { retain: true });
  }

  flush() {
    if (!this.net?.online || !this.dirty.size) return;
    for (const key of [...this.dirty]) {
      const i = key.indexOf('/');
      const doc = this.kinds.get(key.slice(0, i))?.get(key.slice(i + 1));
      if (doc) this._publish(doc); else this.dirty.delete(key);
    }
  }

  /** Kompletten Stand an ein frisch verbundenes Handy schicken */
  async dumpTo(peerId) {
    for (const m of this.kinds.values()) {
      for (const doc of m.values()) {
        if (!(await this.net.sendRaw(peerId, `doc/${doc.k}/${doc.id}`, this._wire(doc)))) return;
      }
    }
  }

  _remote(kind, id, obj, own) {
    const key = `${kind}/${id}`;
    const cur = this.kinds.get(kind)?.get(id);
    if (own) { // Echo vom Broker = Bestätigung
      if (cur && cur.rev === obj.rev && this.dirty.delete(key)) this._save();
      return;
    }
    if (cur && (cur.rev > obj.rev || (cur.rev === obj.rev && cur.by >= obj.by))) return;
    const doc = { k: kind, id, rev: obj.rev, by: obj.by, del: obj.del ? 1 : 0, d: obj.d || {} };
    this._set(doc);
    this._save();
    this._changed(kind, id, doc, 'remote');
  }

  _changed(kind, id, doc, source) {
    this.emit('change', kind, id, doc, source);
    this.emit('change:' + kind, id, doc, source);
  }

  _persist() {
    if (!this.key) return;
    const docs = [];
    for (const m of this.kinds.values()) for (const d of m.values()) docs.push(d);
    // Platz sparen: alte Tombstones (>30 Tage) nicht mehr lokal halten
    const keep = docs.filter((d) => !d.del || Date.now() - d.rev < 30 * DAY);
    LS.set(this.key, { docs: keep, dirty: [...this.dirty] });
  }
}
