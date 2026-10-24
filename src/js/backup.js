/* Backup & Geräte-Umzug: alles Persönliche als Datei sichern/laden oder per QR + WebRTC direkt aufs neue Handy schieben. */

const Backup = {
  async build(withMedia = true) {
    const data = {
      app: 'landed', v: 1, ts: Date.now(),
      profile: Me.profile, logs: Me.logs, custom: Me.custom, badges: Me.badges, settings: Me.settings,
      crews: Crews.list().map((c) => ({ code: c.code, pin: c.pin, joined: c.joined })),
      sessions: Session.history(), sesscount: LS.get(LS_PREFIX + 'sesscount', 0),
      media: {},
    };
    if (withMedia) {
      const ids = new Set();
      for (const log of Object.values(Me.logs)) for (const c of Object.values(log.cells)) for (const m of c.media || []) ids.add(m.id);
      for (const id of ids) { const b = await BlobStore.get(id); if (b) data.media[id] = await blobToDataUrl(b); }
    }
    return data;
  },

  async restore(data) {
    if (data?.app !== 'landed' || !data.profile) throw new Error('Keine Landed-Sicherung');
    for (const [id, url] of Object.entries(data.media || {})) await BlobStore.save(id, await dataUrlToBlob(url));
    LS.set(Me._key, { profile: data.profile, logs: data.logs || {}, custom: data.custom || {}, badges: data.badges || {}, settings: data.settings || Me.settings });
    const cur = LS.get(Crews._key, { crews: [], active: '' });
    const codes = new Set(cur.crews.map((c) => c.code));
    for (const c of data.crews || []) if (!codes.has(c.code)) cur.crews.push(c);
    if (!cur.active && cur.crews[0]) cur.active = cur.crews[0].code;
    LS.set(Crews._key, cur);
    LS.set(LS_PREFIX + 'sesshist', data.sessions || []);
    LS.set(LS_PREFIX + 'sesscount', data.sesscount || 0);
  },

  async exportDialog() {
    const withMedia = await UI.confirm('Fotos und Clips mitsichern? (Datei wird dann größer)', { ok: 'Mit Medien' });
    const data = await this.build(withMedia);
    download(`landed-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data));
    UI.toast('Backup gespeichert', { icon: '💾' });
  },

  async importDialog() {
    const f = await pickFile('application/json,.json');
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!(await UI.confirm(`Backup von ${data.profile?.name || '?'} (${fmtDate(data.ts)}) laden? Dein aktueller Stand auf diesem Gerät wird ersetzt.`, { ok: 'Laden', danger: true }))) return;
      await this.restore(data);
      UI.toast('Backup geladen – starte neu …', { icon: '✅' });
      setTimeout(() => location.reload(), 900);
    } catch (e) { UI.toast('Backup ungültig: ' + e.message, { kind: 'bad' }); }
  },

  /* ---------- Umzug: altes Handy (sendet) ---------- */
  async sendMove() {
    if (typeof RTCPeerConnection === 'undefined') return UI.toast('Dieser Browser kann kein WebRTC – nutze Backup als Datei', { kind: 'bad' });
    const s = UI.sheet('Auf neues Handy umziehen', () => [h('p.lead', 'Erzeuge Code …'), h('div.spinner')]);
    const pair = await Pair.offer({ id: Me.id, n: Me.profile.name, kind: 'move' });
    fill(s.body,
      h('p.muted', '1. Auf dem neuen Handy Landed öffnen → „Vom alten Handy übernehmen“ (oder Ich → Crews → Scannen) und diesen Code scannen.'),
      QR.box(pair.code), h('div.row.center', QR.copyBtn(pair.code)),
      h('p.muted', '2. Dann den Antwort-Code des neuen Handys hier scannen.'),
      h('div.row.center', h('button.btn', {
        onclick: async () => {
          const ans = await QR.scan('Antwort scannen');
          if (!ans) return;
          try {
            await Pair.finish(pair.pc, ans);
            fill(s.body, h('p.lead', 'Verbinde …'), h('div.spinner'));
            const dc = await Pair.waitOpen(pair.dc);
            fill(s.body, h('p.lead', 'Übertrage Daten …'), h('div.bar', h('i#move-bar')));
            const text = JSON.stringify(await this.build(true));
            const size = 60000, n = Math.ceil(text.length / size);
            dc.send(JSON.stringify({ t: 'meta', n }));
            for (let i = 0; i < n; i++) {
              while (dc.bufferedAmount > 1024 * 1024) await sleep(20);
              dc.send(JSON.stringify({ t: 'c', i, d: text.slice(i * size, (i + 1) * size) }));
              $('#move-bar') && ($('#move-bar').style.width = ((i + 1) / n) * 100 + '%');
            }
            await new Promise((res) => { dc.onmessage = (e) => { if (JSON.parse(e.data).t === 'ok') res(); }; setTimeout(res, 30000); });
            fill(s.body, h('p.lead', '✅ Umzug fertig!'), h('p.muted', 'Dein Profil läuft jetzt auf dem neuen Handy. Nutze dieses Gerät am besten nicht mehr parallel mit demselben Profil.'));
          } catch (e) { UI.toast('Umzug fehlgeschlagen: ' + e.message, { kind: 'bad' }); }
        },
      }, '📷 Antwort scannen')));
  },

  /* ---------- Umzug: neues Handy (empfängt) ---------- */
  async receiveMove(code, remote) {
    if (!(await UI.confirm(`Profil „${remote.n}“ vom anderen Handy übernehmen?${Me.profile ? ' Dein aktueller Stand hier wird ersetzt.' : ''}`, { ok: 'Übernehmen' }))) return;
    const s = UI.sheet('Umzug', () => [h('p.lead', 'Erzeuge Antwort …'), h('div.spinner')]);
    try {
      const ans = await Pair.answer(code, { id: Me.id || 'new', n: Me.profile?.name || 'Neues Handy' });
      fill(s.body, h('p.muted', 'Jetzt scannt das alte Handy diesen Code.'), QR.box(ans.code), h('div.row.center', QR.copyBtn(ans.code)), h('div.bar', h('i#move-bar')));
      const dc = await Promise.race([ans.dcP, sleep(180000).then(() => null)]);
      if (!dc) throw new Error('Zeit abgelaufen');
      const parts = [];
      let n = 0;
      await new Promise((res, rej) => {
        dc.onmessage = (e) => {
          const m = JSON.parse(e.data);
          if (m.t === 'meta') n = m.n;
          if (m.t === 'c') { parts[m.i] = m.d; const bar = $('#move-bar'); if (bar) bar.style.width = (parts.filter(Boolean).length / n) * 100 + '%'; }
          if (n && parts.filter((x) => x != null).length === n) res();
        };
        dc.onclose = () => rej(new Error('Verbindung abgebrochen'));
      });
      await this.restore(JSON.parse(parts.join('')));
      dc.send(JSON.stringify({ t: 'ok' }));
      fill(s.body, h('p.lead', '✅ Daten übernommen – starte neu …'));
      setTimeout(() => location.reload(), 1200);
    } catch (e) { s.close(); UI.toast('Umzug fehlgeschlagen: ' + e.message, { kind: 'bad' }); }
  },
};
