/* Mesh: direkte WebRTC-Verbindungen zwischen den Handys einer Crew.
   - Automatisch: Wer sich über den Bus "sieht" (Präsenz), baut eine Direktverbindung auf
     (Signaling über den verschlüsselten Bus – Broker oder bereits verbundene Handys).
   - Manuell / ganz ohne Server: Pair tauscht Angebot und Antwort per QR-Code oder Text aus. */

const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] };

class Mesh {
  constructor(net) {
    this.net = net;
    this.conns = new Map();   // peerId -> { pc, dc, t }
    this.off = [
      net.on('in', (_, obj) => { if (obj.t === 'rtc') this._signal(obj.f, obj); }),
      net.on('unlink', (pid) => this.conns.delete(pid)),
    ];
  }

  destroy() {
    this.off.forEach((f) => f());
    this.conns.forEach((c) => { try { c.pc.close(); } catch { /* egal */ } });
    this.conns.clear();
  }

  /** Bei Präsenz eines anderen Handys aufrufen: baut ggf. die Direktverbindung auf */
  seen(peerId) {
    if (typeof RTCPeerConnection === 'undefined' || peerId === this.net.me) return;
    if (this.net.linked(peerId)) return;
    const c = this.conns.get(peerId);
    if (c && Date.now() - c.t < 20000) return;   // Versuch läuft noch
    if (this.net.me < peerId) this._call(peerId); // kleinere ID ruft an
    else this._sig(peerId, 'want', null);
  }

  _sig(to, k, d) { this.net.send('in/' + to, { t: 'rtc', k, d }); }

  _make(peerId) {
    const old = this.conns.get(peerId);
    if (old) { try { old.pc.close(); } catch { /* egal */ } }
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const c = { pc, dc: null, t: Date.now() };
    pc.onicecandidate = (e) => { if (e.candidate) this._sig(peerId, 'ice', e.candidate); };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState) && this.conns.get(peerId) === c) this.conns.delete(peerId);
    };
    pc.ondatachannel = (e) => this._wire(peerId, c, e.channel);
    this.conns.set(peerId, c);
    return c;
  }

  _wire(peerId, c, dc) {
    c.dc = dc;
    const go = () => this.net.attach(peerId, dc);
    if (dc.readyState === 'open') go(); else dc.addEventListener('open', go, { once: true });
  }

  async _call(peerId) {
    const c = this._make(peerId);
    this._wire(peerId, c, c.pc.createDataChannel('ld', { ordered: true }));
    await c.pc.setLocalDescription(await c.pc.createOffer());
    this._sig(peerId, 'offer', c.pc.localDescription);
  }

  async _signal(from, m) {
    try {
      if (m.k === 'want') { if (!this.net.linked(from) && this.net.me < from) await this._call(from); return; }
      let c = this.conns.get(from);
      if (m.k === 'offer') {
        c = this._make(from);
        await c.pc.setRemoteDescription(m.d);
        await c.pc.setLocalDescription(await c.pc.createAnswer());
        this._sig(from, 'answer', c.pc.localDescription);
      } else if (m.k === 'answer' && c && c.pc.signalingState === 'have-local-offer') await c.pc.setRemoteDescription(m.d);
      else if (m.k === 'ice' && c) await c.pc.addIceCandidate(m.d).catch(() => {});
    } catch (e) { console.warn('rtc', e); }
  }

  /** Eine per QR gekoppelte Verbindung übernehmen */
  adopt(peerId, pc, dc) {
    const c = { pc, dc: null, t: Date.now() };
    this.conns.set(peerId, c);
    this._wire(peerId, c, dc);
  }
}

/* ---------- Kopplung ohne Server (QR-Code / Text) ---------- */
const Pair = {
  async _gather(pc, ms = 4000) {
    if (pc.iceGatheringState === 'complete') return;
    await Promise.race([
      new Promise((res) => pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') res(); })),
      sleep(ms),
    ]);
  },
  /** SDP auf das Nötige kürzen, damit der QR-Code klein bleibt */
  _slim(sdp) {
    return sdp.split('\r\n').filter((l) => l && !/^a=(extmap|msid|ssrc|rtcp-fb|ice-options|max-message-size)/.test(l)).join('\r\n') + '\r\n';
  },

  /** Schritt 1 (zeigt QR): Angebot erzeugen. info = { id, name, kind, crew? } */
  async offer(info) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const dc = pc.createDataChannel('ld', { ordered: true });
    await pc.setLocalDescription(await pc.createOffer());
    await this._gather(pc);
    const code = await packText(JSON.stringify({ v: 1, o: 1, s: this._slim(pc.localDescription.sdp), ...info }));
    return { pc, dc, code };
  },

  /** Schritt 2 (scannt Angebot, zeigt Antwort-QR) */
  async answer(code, info) {
    const o = JSON.parse(await unpackText(code));
    if (!o.o) throw new Error('Das ist kein Kopplungs-Angebot.');
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const dcP = new Promise((res) => { pc.ondatachannel = (e) => res(e.channel); });
    await pc.setRemoteDescription({ type: 'offer', sdp: o.s });
    await pc.setLocalDescription(await pc.createAnswer());
    await this._gather(pc);
    const reply = await packText(JSON.stringify({ v: 1, a: 1, s: this._slim(pc.localDescription.sdp), ...info }));
    return { pc, dcP, code: reply, remote: o };
  },

  /** Schritt 3 (scannt Antwort) */
  async finish(pc, code) {
    const a = JSON.parse(await unpackText(code));
    if (!a.a) throw new Error('Das ist keine Kopplungs-Antwort.');
    await pc.setRemoteDescription({ type: 'answer', sdp: a.s });
    return a;
  },

  waitOpen(dc, ms = 20000) {
    return new Promise((res, rej) => {
      if (dc.readyState === 'open') return res(dc);
      const t = setTimeout(() => rej(new Error('Verbindung kam nicht zustande.')), ms);
      dc.addEventListener('open', () => { clearTimeout(t); res(dc); }, { once: true });
    });
  },
};
