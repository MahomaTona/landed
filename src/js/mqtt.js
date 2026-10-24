/* Minimaler MQTT-3.1.1-Client über WebSocket (QoS 0, Retain, Wildcards, Failover).
   Kein Server-Setup: nutzt freie öffentliche Broker. Daten sind vor dem Senden verschlüsselt. */

const BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081',
  'wss://mqtt.eclipseprojects.io:443/mqtt',
];

class MqttClient {
  constructor({ clientId, filter, onMessage, onStatus, brokers = BROKERS }) {
    this.clientId = ('ld' + clientId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 23);
    this.filter = filter;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.brokers = brokers;
    this.idx = 0;
    this.connected = false;
    this.want = false;
    this.fails = 0;
    this.buf = new Uint8Array(0);
    this.enc = new TextEncoder();
    this.dec = new TextDecoder();
  }

  connect() { this.want = true; this._open(); }

  disconnect() {
    this.want = false;
    clearTimeout(this.retryT); clearTimeout(this.connT); clearInterval(this.pingT);
    if (this.ws && this.connected) this._send(new Uint8Array([0xe0, 0]));
    this._drop();
    this.connected = false;
  }

  _drop() {
    if (!this.ws) return;
    this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
    try { this.ws.close(); } catch { /* egal */ }
    this.ws = null;
  }

  _open() {
    if (!this.want) return;
    this._drop();
    const url = this.brokers[this.idx % this.brokers.length];
    this.onStatus('connecting', url);
    try { this.ws = new WebSocket(url, ['mqtt']); } catch { return this._fail(); }
    this.ws.binaryType = 'arraybuffer';
    this.buf = new Uint8Array(0);
    this.connT = setTimeout(() => { if (!this.connected) this._fail(); }, 6000);
    this.ws.onopen = () => this._sendConnect();
    this.ws.onmessage = (e) => this._onData(new Uint8Array(e.data));
    this.ws.onerror = () => { /* onclose folgt */ };
    this.ws.onclose = () => { if (this.want) this._fail(); };
  }

  _fail() {
    clearTimeout(this.connT); clearInterval(this.pingT);
    const was = this.connected;
    this.connected = false;
    this._drop();
    this.fails++; this.idx++;
    if (was) this.onStatus('down');
    clearTimeout(this.retryT);
    this.retryT = setTimeout(() => this._open(), this.fails < this.brokers.length ? 200 : Math.min(15000, 1500 * this.fails));
  }

  static _len(n) {
    const out = [];
    do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0);
    return out;
  }
  _str(s) { const b = this.enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; }

  _sendConnect() {
    const vh = [0, 4, 77, 81, 84, 84, 4, 2, 0, 30]; // MQTT, v3.1.1, clean session, keepalive 30 s
    const pl = this._str(this.clientId);
    this._send(new Uint8Array([0x10, ...MqttClient._len(vh.length + pl.length), ...vh, ...pl]));
  }

  _send(bytes) { if (this.ws && this.ws.readyState === 1) this.ws.send(bytes); }

  subscribe(filter) {
    const body = [0, 1, ...this._str(filter), 0];
    this._send(new Uint8Array([0x82, ...MqttClient._len(body.length), ...body]));
  }

  /** payload: String; leerer String + retain löscht eine gespeicherte Nachricht */
  publish(topic, payload, retain = false) {
    if (!this.connected) return false;
    const t = this._str(topic), m = this.enc.encode(payload);
    const head = [0x30 | (retain ? 1 : 0), ...MqttClient._len(t.length + m.length)];
    const out = new Uint8Array(head.length + t.length + m.length);
    out.set(head); out.set(t, head.length); out.set(m, head.length + t.length);
    this._send(out);
    return true;
  }

  _onData(chunk) {
    const all = new Uint8Array(this.buf.length + chunk.length);
    all.set(this.buf); all.set(chunk, this.buf.length);
    let o = 0;
    while (o + 2 <= all.length) {
      const first = all[o];
      let p = o + 1, mul = 1, rem = 0, d, partial = false;
      do {
        if (p >= all.length) { partial = true; break; }
        d = all[p++]; rem += (d & 127) * mul; mul *= 128;
      } while (d & 128);
      if (partial || p + rem > all.length) break; // Paket noch unvollständig -> auf mehr Daten warten
      this._packet(first, all.subarray(p, p + rem));
      o = p + rem;
    }
    this.buf = all.slice(o);
  }

  _packet(first, body) {
    const type = first >> 4;
    if (type === 2) { // CONNACK
      clearTimeout(this.connT);
      if (body[1] !== 0) return this._fail();
      this.connected = true; this.fails = 0;
      this.subscribe(this.filter);
      clearInterval(this.pingT);
      this.pingT = setInterval(() => this._send(new Uint8Array([0xc0, 0])), 15000);
      this.onStatus('up', this.brokers[this.idx % this.brokers.length]);
    } else if (type === 3) { // PUBLISH
      const qos = (first >> 1) & 3, retained = !!(first & 1);
      const tl = (body[0] << 8) | body[1];
      const topic = this.dec.decode(body.subarray(2, 2 + tl));
      let p = 2 + tl;
      if (qos > 0) p += 2;
      this.onMessage(topic, this.dec.decode(body.subarray(p)), retained);
    }
  }
}
