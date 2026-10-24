/* Net: verschlüsselter Nachrichtenbus für eine Crew.
   Transport 1: WebRTC-Datenkanäle direkt zu anderen Handys (Mesh, Nachrichten werden weitergereicht)
   Transport 2: BroadcastChannel (Tabs im selben Browser, offline-tauglich)
   Transport 3: MQTT-over-WebSocket über öffentliche Broker (Fallback, wenn man nicht zusammen ist)

   Topics:  ld1/<rid>/doc/<kind>/<id>     geteilte Dokumente (retained, Last-Writer-Wins)
            ld1/<rid>/ev/<name>           Ereignisse (Präsenz, Datei-Anfragen …)
            ld1/<rid>/in/<peerId>         Direktnachrichten (WebRTC-Signaling, Datei-Chunks) */

class Net extends Emitter {
  constructor(cipher, peerId) {
    super();
    this.cipher = cipher;
    this.rid = cipher.rid;
    this.me = peerId;
    this.prefix = `ld1/${this.rid}/`;
    this.seen = new Set();      // Roh-Schlüssel bereits verarbeiteter Pakete
    this.mine = new Set();      // eigene Pakete, deren Broker-Echo als Bestätigung zählt
    this.links = new Map();     // peerId -> RTCDataChannel
    this.mqtt = null;
    this.bc = null;
    this.status = { mqtt: false, local: false, broker: '', links: 0 };
  }

  start() {
    try {
      if (Net.noLocal) throw new Error('aus');
      this.bc = new BroadcastChannel('ld1-' + this.rid);
      this.bc.onmessage = (e) => this._inbound(e.data.topic, e.data.payload, 'bc');
      this.status.local = true;
    } catch { this.status.local = false; }

    this.mqtt = new MqttClient({
      clientId: (this.me + this.rid).slice(0, 14) + uid(6),
      filter: this.prefix + '#',
      onMessage: (topic, payload) => { if (topic.startsWith(this.prefix)) this._inbound(topic, payload, 'mqtt'); },
      onStatus: (s, broker) => {
        this.status.mqtt = s === 'up';
        this.status.broker = s === 'up' ? broker : '';
        this.emit('status', this.status);
        if (s === 'up') this.emit('connected');
      },
    });
    if (!Net.noBroker) this.mqtt.connect();
    this.emit('status', this.status);
  }

  stop() {
    this.mqtt?.disconnect();
    this.bc?.close();
    this.links.forEach((dc) => { try { dc.close(); } catch { /* egal */ } });
    this.links.clear();
    this.mqtt = this.bc = null;
  }

  get online() { return !!this.mqtt?.connected; }

  /* ---------- Direktverbindungen (WebRTC) ---------- */
  attach(peerId, dc) {
    const old = this.links.get(peerId);
    if (old && old !== dc) { try { old.close(); } catch { /* egal */ } }
    this.links.set(peerId, dc);
    dc.onmessage = (e) => { try { const { topic, payload } = JSON.parse(e.data); this._inbound(topic, payload, peerId); } catch { /* defekt */ } };
    dc.onclose = () => { if (this.links.get(peerId) === dc) { this.links.delete(peerId); this._linksChanged(); this.emit('unlink', peerId); } };
    this._linksChanged();
    this.emit('link', peerId);
  }
  linked(peerId) { return this.links.get(peerId)?.readyState === 'open'; }
  _linksChanged() { this.status.links = [...this.links.values()].filter((d) => d.readyState === 'open').length; this.emit('status', this.status); }

  _toLinks(topic, payload, except) {
    const msg = JSON.stringify({ topic, payload });
    for (const [pid, dc] of this.links) {
      if (pid === except || dc.readyState !== 'open') continue;
      try { dc.send(msg); } catch { /* voll/zu */ }
    }
  }

  /** Verschlüsselt senden.
      link: nur über diese Direktverbindung (Fallback Broker), z.B. für Datei-Chunks.
      Rückgabe: true, wenn mindestens ein Transport bereit war. */
  async send(sub, obj, { retain = false, link = null, broker = true } = {}) {
    const env = { ...obj, f: this.me };
    const payload = await this.cipher.seal(env);
    const topic = this.prefix + sub;
    const key = payload.slice(2, 26);
    this.seen.add(key); this.mine.add(key);
    this._trim();
    if (link) {
      const dc = this.links.get(link);
      if (dc?.readyState === 'open') {
        try { while (dc.bufferedAmount > 512 * 1024) await sleep(15); dc.send(JSON.stringify({ topic, payload })); return true; } catch { /* Broker */ }
      }
      try { this.bc?.postMessage({ topic, payload }); } catch { /* egal */ }
      return this.mqtt?.publish(topic, payload, retain) ?? false;
    }
    try { this.bc?.postMessage({ topic, payload }); } catch { /* egal */ }
    this._toLinks(topic, payload, null);
    const viaBroker = broker && (this.mqtt?.publish(topic, payload, retain) ?? false);
    return viaBroker || this.status.links > 0 || this.status.local;
  }

  /** Nur an eine Direktverbindung, ohne Weiterleitung (für Sync beim Verbinden) */
  async sendRaw(peerId, sub, obj) {
    const dc = this.links.get(peerId);
    if (dc?.readyState !== 'open') return false;
    const payload = await this.cipher.seal({ ...obj, f: this.me });
    this.seen.add(payload.slice(2, 26));
    while (dc.bufferedAmount > 512 * 1024) await sleep(15);
    try { dc.send(JSON.stringify({ topic: this.prefix + sub, payload })); return true; } catch { return false; }
  }

  /** Gespeicherte (retained) Nachricht auf dem Broker löschen */
  clearRetained(sub) { this.mqtt?.publish(this.prefix + sub, '', true); }

  _trim() {
    if (this.seen.size > 3000) this.seen = new Set([...this.seen].slice(-1500));
    if (this.mine.size > 1500) this.mine = new Set([...this.mine].slice(-700));
  }

  async _inbound(topic, payload, src) {
    if (!payload || !topic?.startsWith(this.prefix)) return;
    const key = payload.slice(2, 26);
    let own = false;
    if (src === 'mqtt' && this.mine.has(key)) { this.mine.delete(key); own = true; }  // Broker-Echo = Bestätigung
    else if (this.seen.has(key)) return;
    else { this.seen.add(key); this._trim(); }
    const sub = topic.slice(this.prefix.length);
    const direct = sub.startsWith('in/');
    const forMe = direct && sub.slice(3) === this.me;
    // weiterreichen, damit auch Handys ohne Internet alles bekommen (Direktnachrichten an mich nicht)
    if (!own && !forMe) this._toLinks(topic, payload, src);
    if (direct && !forMe) return;
    const obj = await this.cipher.open(payload);
    if (!obj || !obj.f) return;
    if (obj.f === this.me && !own) return;
    const [kind, ...rest] = sub.split('/');
    this.emit(kind, rest, obj, own || obj.f === this.me, src);
  }
}
Net.noBroker = false;   // ?nobroker=1 (Tests: nur lokal/direkt)
Net.noLocal = false;    // ?nolocal=1 (Tests: nur Broker/direkt)
