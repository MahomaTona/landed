/* Blobs: Fotos und Videos.
   Lokal liegen alle Dateien in IndexedDB (BlobStore, crewübergreifend).
   Verteilt wird auf Anfrage pro Crew (CrewBlobs): Wer die Datei hat, schickt sie –
   über die direkte WebRTC-Verbindung, sonst in Chunks verschlüsselt über den Broker.
   Jeder, der die Datei einmal hat, kann sie weitergeben – auch wenn der Absender offline ist. */

const CHUNK_RTC = 48 * 1024, CHUNK_RELAY = 20 * 1024;

const BlobStore = Object.assign(new Emitter(), {
  urls: new Map(),
  async save(id, blob) { await IDB.put('blobs', id, { blob, ts: Date.now() }); this.emit('ready', id); },
  async get(id) { return (await IDB.get('blobs', id))?.blob || null; },
  async has(id) { return !!(await IDB.get('blobs', id)); },
  async url(id) {
    if (this.urls.has(id)) return this.urls.get(id);
    const b = await this.get(id); if (!b) return null;
    const u = URL.createObjectURL(b); this.urls.set(id, u); return u;
  },
  /** Datei holen: lokal, sonst bei allen Crews anfragen */
  async need(id) {
    const u = await this.url(id);
    if (u) return u;
    Crews.list().forEach((c) => c.blobs.request(id));
    return null;
  },
});

class CrewBlobs {
  constructor(net) {
    this.net = net;
    this.wanted = new Set();
    this.recv = new Map();     // id -> { from, n, parts: Map, t }
    this.off = [
      net.on('ev', ([name], obj, own) => { if (name === 'blob-want' && !own) this._onWant(obj); }),
      net.on('in', (_, obj) => { if (obj.t?.startsWith('blob-')) this._onWire(obj.f, obj); }),
      net.on('link', () => this.wanted.forEach((id) => this._ask(id))),
      BlobStore.on('ready', (id) => this.wanted.delete(id)),
    ];
    this.retryT = setInterval(() => this.wanted.forEach((id) => this._ask(id)), 15000);
  }
  destroy() { clearInterval(this.retryT); this.off.forEach((f) => f()); }

  request(id) { if (this.wanted.has(id)) return; this.wanted.add(id); this._ask(id); }
  _ask(id) { if (!this.recv.has(id)) this.net.send('ev/blob-want', { id }, { broker: true }); }

  async _onWant({ id, f: requester }) {
    if (!(await BlobStore.has(id))) return;
    await sleep(this.net.linked(requester) ? 0 : Math.random() * 400);
    this.net.send('in/' + requester, { t: 'blob-have', id }, { link: requester });
  }

  async _onWire(from, m) {
    if (m.t === 'blob-have') {
      const cur = this.recv.get(m.id);
      if (!this.wanted.has(m.id) || (cur && Date.now() - cur.t < 30000)) return;
      this.recv.set(m.id, { from, n: 0, parts: new Map(), t: Date.now() });
      this.net.send('in/' + from, { t: 'blob-go', id: m.id }, { link: from });
    } else if (m.t === 'blob-go') {
      this._stream(from, m.id);
    } else if (m.t === 'blob-chunk') {
      const r = this.recv.get(m.id); if (!r || r.from !== from) return;
      r.n = m.n; r.t = Date.now(); r.parts.set(m.i, m.d);
      BlobStore.emit('progress', m.id, r.parts.size / r.n);
      if (r.parts.size === r.n) {
        this.recv.delete(m.id); this.wanted.delete(m.id);
        const chunks = Array.from({ length: r.n }, (_, i) => b64.dec(r.parts.get(i)));
        await BlobStore.save(m.id, new Blob(chunks, { type: m.mime || 'image/jpeg' }));
      }
    }
  }

  async _stream(to, id) {
    const blob = await BlobStore.get(id); if (!blob) return;
    const direct = this.net.linked(to);
    const size = direct ? CHUNK_RTC : CHUNK_RELAY;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const n = Math.max(1, Math.ceil(buf.length / size));
    for (let i = 0; i < n; i++) {
      const msg = { t: 'blob-chunk', id, i, n, mime: blob.type, d: b64.enc(buf.subarray(i * size, (i + 1) * size)) };
      await this.net.send('in/' + to, msg, { link: to });
      if (!direct) await sleep(60);
    }
  }
}
