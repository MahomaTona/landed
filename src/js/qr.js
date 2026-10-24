/* QR: Codes anzeigen und scannen, Einladungslinks, Kopplung ohne Server und Geräte-Umzug.

   Kopplung (echt serverlos, z.B. im Skatepark ohne Netz):
     Handy A zeigt Angebot-QR  ->  Handy B scannt, tritt ggf. der Crew bei und zeigt Antwort-QR
     ->  Handy A scannt die Antwort  ->  direkter WebRTC-Kanal, beide synchronisieren alles.
   Statt Scannen geht auch Kopieren/Einfügen des Codes (z.B. per Messenger). */

const QR = {
  svg(text) {
    const q = qrcode(0, text.length > 900 ? 'L' : 'M');
    q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  },
  box(text) {
    const el = h('div.qr');
    try { el.innerHTML = this.svg(text); } catch { el.textContent = 'Code zu lang für QR – bitte „Kopieren“ nutzen.'; }
    return el;
  },
  copyBtn(text, label = '📋 Code kopieren') {
    return h('button.btn.ghost', {
      onclick: async () => {
        try { await navigator.clipboard.writeText(text); UI.toast('Kopiert', { icon: '📋' }); }
        catch { UI.form('Code', [{ key: 'c', label: 'Markieren und kopieren', type: 'textarea', value: text }], { ok: 'Fertig' }); }
      },
    }, label);
  },

  /** Kamera-Scanner mit Einfüge-Feld. Rückgabe: gelesener Text oder null */
  scan(title = 'QR-Code scannen', hint = 'Halte die Kamera auf den Code.') {
    return new Promise((resolve) => {
      let stream = null, done = false, raf = 0;
      const video = h('video', { playsInline: true, muted: true });
      const paste = h('textarea', { rows: 2, placeholder: '… oder Code/Link hier einfügen' });
      const finish = (val, close) => { if (done) return; done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); resolve(val); close?.(); };
      const s = UI.sheet(title, (close) => [
        h('p.muted', hint),
        h('div.scan-wrap', video, h('div.scan-frame')),
        paste,
        h('div.row.end', h('button.btn', { onclick: () => paste.value.trim() && finish(paste.value.trim(), close) }, 'Übernehmen')),
      ], { onClose: () => finish(null) });
      (async () => {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
        catch { $('.scan-wrap', s.el).replaceWith(h('p.warn', '📷 Keine Kamera verfügbar – füge den Code unten ein.')); return; }
        if (done) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = stream; await video.play().catch(() => {});
        const cv = h('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
        const tick = () => {
          if (done) return;
          if (video.videoWidth) {
            const k = Math.min(1, 720 / video.videoWidth);
            cv.width = video.videoWidth * k; cv.height = video.videoHeight * k;
            ctx.drawImage(video, 0, 0, cv.width, cv.height);
            const r = jsQR(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
            if (r?.data) { UI.vibrate([30]); return finish(r.data, s.close); }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      })();
    });
  },

  /* ---------- Einladung ---------- */
  inviteLink(crew) {
    const u = new URL(location.href.split('#')[0].split('?')[0]);
    u.searchParams.set('crew', crew.code);
    return u.toString() + (crew.pin ? '#pin=' + encodeURIComponent(crew.pin) : '');
  },
  parseInvite(text) {
    try {
      const u = new URL(text);
      const code = u.searchParams.get('crew');
      if (!code) return null;
      const pin = new URLSearchParams(u.hash.slice(1)).get('pin') || '';
      return { code, pin };
    } catch { return null; }
  },

  /** Universal-Scan: Einladungslink, Kopplungs-Angebot (Crew oder Umzug) */
  async scanAny() {
    const text = await this.scan('Scannen', 'Einladung, Kopplungs-Code oder Umzugs-Code der anderen Person.');
    if (!text) return;
    const inv = this.parseInvite(text);
    if (inv) { await App.joinCrew(inv.code, inv.pin); return; }
    if (/^[zu][A-Za-z0-9_-]+$/.test(text)) return this.answerFlow(text);
    UI.toast('Unbekannter Code', { icon: '🤔', kind: 'bad' });
  },

  /* ---------- Kopplung: Seite A (zeigt Angebot) ---------- */
  async offerFlow(crew) {
    if (typeof RTCPeerConnection === 'undefined') return UI.toast('Dieser Browser kann kein WebRTC', { kind: 'bad' });
    const s = UI.sheet('Direkt koppeln', () => [h('p.lead', 'Erzeuge Code …'), h('div.spinner')]);
    let pair;
    try { pair = await Pair.offer({ id: Me.id, n: Me.profile.name, kind: 'crew', crew: { code: crew.code, pin: crew.pin } }); }
    catch (e) { s.close(); return UI.toast('Kopplung fehlgeschlagen: ' + e.message, { kind: 'bad' }); }
    const waitEl = h('p.muted', 'Schritt 1: Die andere Person scannt diesen Code (Landed → Scannen).');
    fill(s.body,
      waitEl,
      this.box(pair.code),
      h('div.row.center', this.copyBtn(pair.code)),
      h('p.muted', 'Schritt 2: Dann scannst du den Antwort-Code von ihrem Handy.'),
      h('div.row.center', h('button.btn', {
        onclick: async () => {
          const ans = await this.scan('Antwort scannen', 'Scanne den Antwort-Code der anderen Person.');
          if (!ans) return;
          try {
            const a = await Pair.finish(pair.pc, ans);
            fill(s.body, h('p.lead', `Verbinde mit ${esc(a.n || 'Freund')} …`), h('div.spinner'));
            await Pair.waitOpen(pair.dc);
            crew.mesh.adopt(a.id, pair.pc, pair.dc);
            s.close();
            UI.toast(`Direkt verbunden mit ${a.n || 'Freund'} – Daten werden abgeglichen`, { icon: '🤝', ms: 3500 });
            UI.beep('land');
          } catch (e) { UI.toast(e.message, { kind: 'bad', icon: '⚠️' }); }
        },
      }, '📷 Antwort scannen')),
    );
  },

  /* ---------- Kopplung: Seite B (scannt Angebot, zeigt Antwort) ---------- */
  async answerFlow(code) {
    let remote;
    try { remote = JSON.parse(await unpackText(code)); } catch { return UI.toast('Code ist beschädigt', { kind: 'bad' }); }
    if (remote.a) return UI.toast('Das ist ein Antwort-Code – den muss die andere Person scannen.', { icon: '↩️', ms: 4000 });
    if (remote.kind === 'move') return Backup.receiveMove(code, remote);
    if (!Me.profile) return UI.toast('Lege zuerst dein Profil an', { kind: 'bad' });
    let crew = null;
    if (remote.kind === 'crew') {
      crew = Crews.map.get(Cipher.norm(remote.crew.code));
      if (!crew) {
        if (!(await UI.confirm(`${remote.n} lädt dich in die Crew „${remote.crew.code}“ ein. Beitreten?`, { ok: 'Beitreten' }))) return;
        crew = await App.joinCrew(remote.crew.code, remote.crew.pin, { quiet: true });
      }
    }
    const s = UI.sheet('Antwort zeigen', () => [h('p.lead', 'Erzeuge Antwort …'), h('div.spinner')]);
    try {
      const ans = await Pair.answer(code, { id: Me.id, n: Me.profile.name });
      fill(s.body,
        h('p.muted', `Jetzt scannt ${esc(remote.n || 'die andere Person')} diesen Code.`),
        this.box(ans.code),
        h('div.row.center', this.copyBtn(ans.code)),
        h('p.muted.center', 'Wartet auf Verbindung …'), h('div.spinner'));
      const dc = await Promise.race([ans.dcP, sleep(120000).then(() => null)]);
      if (!dc) throw new Error('Zeit abgelaufen');
      await Pair.waitOpen(dc);
      crew.mesh.adopt(remote.id, ans.pc, dc);
      s.close();
      UI.toast(`Direkt verbunden mit ${remote.n} – Daten werden abgeglichen`, { icon: '🤝', ms: 3500 });
      UI.beep('land');
    } catch (e) { s.close(); UI.toast('Kopplung fehlgeschlagen: ' + e.message, { kind: 'bad' }); }
  },
};
