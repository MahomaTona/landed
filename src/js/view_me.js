/* Ich-Tab: Profil, Level, Statistiken & Timeline, Jahresrückblick, Badges, Crews, Einstellungen, Backup. */

const MeView = {
  seg: 'stats',

  render() {
    const root = $('#view-me');
    const xp = xpOfLogs(Me.logs), lv = levelOf(xp);
    fill(root,
      h('div.view-head',
        h('div.profile',
          h('button.avatar-btn', { onclick: () => this.editProfile(), title: 'Profil bearbeiten' }, UI.avatar(Me.profile, 64)),
          h('div.grow', h('h1', Me.profile.name), h('p.muted', `Level ${lv.lvl} · ${lv.title} · ${fmtNum(xp)} XP`),
            h('div.bar.xpbar', h('i', { style: { width: lv.pct * 100 + '%' } })), h('small.muted', `${fmtNum(lv.need - lv.into)} XP bis Level ${lv.lvl + 1}`))),
        h('div.seg', ...[['stats', '📈 Stats'], ['badges', '🏅 Badges'], ['crew', '👥 Crews'], ['settings', '⚙️ Einstellungen']].map(([s, l]) => h('button', { class: this.seg === s ? 'on' : '', onclick: () => { this.seg = s; this.render(); } }, l)))),
      h('div', this[this.seg]()));
  },

  /* ---------- Statistiken ---------- */
  stats() {
    const s = statsOf(Me.logs);
    const avg = s.firstToLand.length ? sum(s.firstToLand) / s.firstToLand.length : null;
    const firstLand = s.events.filter((e) => e.stage === 2);
    const hist = Session.history();
    return [
      h('div.stats-grid',
        h('div.stat', h('b', s.landed), h('small', 'gestanden')), h('div.stat', h('b', s.mastered), h('small', 'gemeistert')),
        h('div.stat', h('b', s.practicing), h('small', 'übe ich')), h('div.stat', h('b', s.tricks.size), h('small', 'versch. Tricks')),
        h('div.stat', h('b', avg ? fmtDuration(avg) : '–'), h('small', 'Ø üben → gestanden')), h('div.stat', h('b', hist.length), h('small', 'Sessions'))),
      h('section.card', h('h2', '📈 Fortschritt'), this.lineChart(firstLand)),
      h('section.card', h('h2', '📅 Neue Tricks pro Monat'), this.monthBars(firstLand)),
      h('section.card', h('h2', '🧩 Nach Kategorie'), this.hbars(CATS.map((c) => [c.icon + ' ' + c.name, s.cats[c.id] || 0]))),
      h('section.card', h('h2', '🧍 Nach Stance'), this.hbars(STANCES.map((st) => [st.name, s.stances[st.id] || 0]))),
      h('section.card', h('h2', '🗓 Timeline'), this.timeline(s.events)),
      h('div.row.center', h('button.btn.big', { onclick: () => this.yearReview() }, `🎞 Jahresrückblick ${new Date().getFullYear()}`)),
    ];
  },

  lineChart(events) {
    if (events.length < 2) return h('p.muted', 'Sobald du ein paar Tricks gestanden hast, siehst du hier deine Kurve.');
    const W = 320, H = 140, P = 24;
    const t0 = events[0].ts, t1 = Math.max(events[events.length - 1].ts, t0 + DAY);
    const x = (t) => P + ((t - t0) / (t1 - t0)) * (W - P * 1.5), y = (n) => H - P - (n / events.length) * (H - P * 1.6);
    const pts = events.map((e, i) => `${x(e.ts).toFixed(1)},${y(i + 1).toFixed(1)}`);
    const area = `M${x(t0)},${H - P} L${pts.join(' L')} L${x(t1)},${H - P} Z`;
    return h('div.chart', { html: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gestandene Tricks über die Zeit">
      <path d="${area}" class="c-area"/><polyline points="${pts.join(' ')}" class="c-line"/>
      <line x1="${P}" y1="${H - P}" x2="${W - P / 2}" y2="${H - P}" class="c-axis"/>
      <text x="${P}" y="${H - 6}" class="c-lbl">${fmtDateShort(t0)}</text><text x="${W - P / 2}" y="${H - 6}" class="c-lbl" text-anchor="end">${fmtDateShort(t1)}</text>
      <text x="${P - 4}" y="${y(events.length) + 4}" class="c-lbl" text-anchor="end">${events.length}</text></svg>` });
  },

  monthBars(events) {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: `${d.getFullYear()}-${d.getMonth()}`, l: d.toLocaleDateString('de-DE', { month: 'short' }).slice(0, 3), n: 0 }); }
    for (const e of events) { const d = new Date(e.ts); const m = months.find((x) => x.k === `${d.getFullYear()}-${d.getMonth()}`); if (m) m.n++; }
    const max = Math.max(1, ...months.map((m) => m.n));
    return h('div.bars', months.map((m) => h('div.bcol', { title: `${m.l}: ${m.n}` }, h('small', m.n || ''), h('i', { style: { height: (m.n / max) * 100 + '%' } }), h('span', m.l))));
  },

  hbars(rows) {
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return h('div.hbars', rows.filter((r) => r[1]).map(([l, n]) => h('div.hb', h('span', l), h('div.hb-track', h('i', { style: { width: (n / max) * 100 + '%' } })), h('b', n))),
      rows.every((r) => !r[1]) ? h('p.muted', 'Noch keine Daten.') : null);
  },

  timeline(events) {
    if (!events.length) return h('p.muted', 'Noch leer.');
    const out = [];
    let lastDay = '';
    for (const e of events.slice().reverse().slice(0, 60)) {
      const day = fmtDate(e.ts);
      if (day !== lastDay) { lastDay = day; out.push(h('div.tl-day', day)); }
      out.push(h('button.tl-item', { onclick: () => TricksView.detail(e.tid) }, h('span', STAGES[e.stage].icon), cellName(getTrick(e.tid).name, e.ck), h('small.muted', ' ', STAGES[e.stage].name)));
    }
    return h('div.timeline', out);
  },

  /** Jahresrückblick als Bild (Canvas) zum Speichern/Teilen */
  async yearReview() {
    const year = new Date().getFullYear();
    const evs = statsOf(Me.logs).events.filter((e) => new Date(e.ts).getFullYear() === year);
    const landed = evs.filter((e) => e.stage === 2);
    const hardest = landed.map((e) => ({ e, t: getTrick(e.tid) })).sort((a, b) => b.t.diff - a.t.diff).slice(0, 5);
    const months = Array(12).fill(0); landed.forEach((e) => months[new Date(e.ts).getMonth()]++);
    const best = months.indexOf(Math.max(...months));
    const sess = Session.history().filter((s) => new Date(s.start).getFullYear() === year);
    const hours = sum(sess.map((s) => (s.end - s.start) / 3600e3));
    const cv = h('canvas', { width: 1080, height: 1350 });
    const g = cv.getContext('2d');
    const css = getComputedStyle(document.body);
    const acc = css.getPropertyValue('--acc').trim() || '#ff3d7f', acc2 = css.getPropertyValue('--acc2').trim() || '#3dffb4';
    const bg = new Image();
    bg.src = Theme.preview(document.body.dataset.theme || 'street');
    await new Promise((r) => { bg.onload = r; bg.onerror = r; });
    g.fillStyle = '#111'; g.fillRect(0, 0, 1080, 1350);
    try { g.drawImage(bg, 0, -200, 1080, 2160); } catch { /* egal */ }
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = '#fff'; g.font = '900 96px Impact, "Arial Black", sans-serif';
    g.fillText(`MEIN ${year}`, 70, 170);
    g.font = '700 44px system-ui, sans-serif'; g.fillStyle = acc2; g.fillText(`${Me.profile.avatar} ${Me.profile.name} · Landed`, 70, 240);
    const tile = (x, y, big, small) => { g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, y, 450, 200); g.fillStyle = acc; g.font = '900 96px Impact, sans-serif'; g.fillText(big, x + 30, y + 115); g.fillStyle = '#ddd'; g.font = '600 34px system-ui, sans-serif'; g.fillText(small, x + 30, y + 170); };
    tile(70, 300, String(landed.length), 'neue Tricks gestanden');
    tile(560, 300, String(evs.filter((e) => e.stage === 4).length), 'Tricks gemeistert');
    tile(70, 530, String(sess.length), 'Sessions');
    tile(560, 530, hours.toFixed(0) + ' h', 'auf dem Board');
    g.fillStyle = '#fff'; g.font = '800 46px system-ui, sans-serif'; g.fillText('Die härtesten:', 70, 830);
    g.font = '600 40px system-ui, sans-serif';
    hardest.forEach((x, i) => { g.fillStyle = i ? '#eee' : acc2; g.fillText(`${i + 1}. ${cellName(x.t.name, x.e.ck)}  (${x.t.diff}/10)`, 70, 900 + i * 62); });
    if (!hardest.length) { g.fillStyle = '#bbb'; g.fillText('Noch nichts – ab aufs Board!', 70, 900); }
    if (landed.length) { g.fillStyle = '#ddd'; g.font = '600 38px system-ui, sans-serif'; g.fillText(`Bester Monat: ${new Date(year, best, 1).toLocaleDateString('de-DE', { month: 'long' })} (${months[best]} Tricks)`, 70, 1250); }
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const url = URL.createObjectURL(blob);
    UI.sheet(`Jahresrückblick ${year}`, () => [
      h('img.review', { src: url, alt: 'Jahresrückblick' }),
      h('div.row.center',
        h('button.btn', { onclick: () => download(`landed-${year}.png`, blob) }, '⬇ Speichern'),
        navigator.canShare?.({ files: [new File([blob], 'x.png', { type: 'image/png' })] }) && h('button.btn.ghost', { onclick: () => navigator.share({ files: [new File([blob], `landed-${year}.png`, { type: 'image/png' })], title: `Mein Skate-Jahr ${year}` }).catch(() => {}) }, '📤 Teilen')),
    ], { wide: true, onClose: () => URL.revokeObjectURL(url) });
  },

  /* ---------- Badges ---------- */
  badges() {
    const got = BADGES.filter((b) => Me.badges[b.id]).length;
    return [
      h('p.muted', `${got} von ${BADGES.length} Abzeichen`),
      h('div.badges', BADGES.map((b) => h('div.badge', { class: Me.badges[b.id] ? 'got' : '' },
        h('span.bi', b.icon), h('b', b.name), h('small', b.desc), Me.badges[b.id] ? h('small.muted', fmtDate(Me.badges[b.id])) : null))),
    ];
  },

  /* ---------- Crews ---------- */
  crew() {
    const active = Crews.active;
    return [
      h('div.row.wrap',
        h('button.btn', { onclick: () => App.joinDialog() }, '＋ Crew beitreten / gründen'),
        h('button.btn.ghost', { onclick: () => QR.scanAny() }, '📷 Scannen')),
      ...Crews.list().map((c) => {
        const st = c.net?.status || {};
        const on = c === active;
        return h('section.card.crew-card', { class: on ? 'on' : '' },
          h('div.row.between', h('div', h('h2', c.name), h('small.muted', `Code: ${c.code}${c.pin ? ' · mit PIN' : ''}`)),
            !on ? h('button.btn.sm', { onclick: () => { Crews.select(c.code); this.render(); } }, 'Aktiv setzen') : h('span.tag', 'aktiv')),
          h('div.row.wrap.small',
            h('span.tag', { class: st.mqtt ? 'ok' : '' }, st.mqtt ? '🌐 Broker verbunden' : '🌐 kein Broker'),
            h('span.tag', { class: st.links ? 'ok' : '' }, `🤝 ${st.links || 0} direkt`),
            h('span.tag', c.cipher.secure ? '🔒 Ende-zu-Ende' : '⚠️ unverschlüsselt (kein HTTPS)')),
          h('div.members', c.members().map((m) => h('span.who', { class: c.online(m.id) ? 'on' : '' }, UI.avatar(m, 28), m.name, c.online(m.id) ? h('i.online') : null))),
          h('div.row.wrap',
            h('button.btn.sm', { onclick: () => this.invite(c) }, '🔗 Einladen'),
            h('button.btn.sm.ghost', { onclick: () => QR.offerFlow(c) }, '🤝 Direkt koppeln (ohne Netz)'),
            h('button.btn.sm.ghost', { onclick: async () => { const r = await UI.form('Crew umbenennen', [{ key: 'n', label: 'Name', value: c.name }]); if (r?.n) { c.docs.put('info', 'crew', { name: r.n }); this.render(); } } }, '✏️'),
            h('button.btn.sm.ghost.danger', { onclick: async () => { if (await UI.confirm(`Crew „${c.name}“ verlassen? Deine Daten bleiben bei dir.`, { ok: 'Verlassen', danger: true })) { Crews.leave(c.code); this.render(); App.updateTop(); } } }, 'Verlassen')));
      }),
      !Crews.list().length && UI.empty('👥', 'Du bist noch in keiner Crew.'),
    ];
  },

  invite(c) {
    const link = QR.inviteLink(c);
    UI.sheet(`In „${c.name}“ einladen`, () => [
      h('p.muted', 'Freunde scannen den Code mit der Handy-Kamera oder in Landed („Scannen“). Der Link enthält Crew-Code und PIN – nur mit deiner Crew teilen!'),
      QR.box(link),
      h('p.code', c.code, c.pin ? h('span.muted', ` · PIN ${c.pin}`) : null),
      h('div.row.center',
        QR.copyBtn(link, '📋 Link kopieren'),
        navigator.share && h('button.btn.ghost', { onclick: () => navigator.share({ title: 'Landed – komm in meine Crew', text: `Komm in meine Skate-Crew „${c.name}“ bei Landed:`, url: link }).catch(() => {}) }, '📤 Teilen')),
      h('p.muted.small', 'Kein Netz im Park? Nutze „🤝 Direkt koppeln“ – dann verbinden sich eure Handys direkt per QR-Code.'),
    ]);
  },

  /* ---------- Einstellungen ---------- */
  settings() {
    const S = Me.settings;
    const set = (k, v) => { S[k] = v; Me.save(); };
    const toggle = (k, label, onOn) => h('label.switch', h('input', { type: 'checkbox', checked: !!S[k], onchange: async (e) => { set(k, e.target.checked); if (e.target.checked) await onOn?.(); } }), h('span', label));
    return [
      h('section.card', h('h2', '🎨 Theme'),
        h('div.themes', THEMES.map((t) => h('button.theme', {
          class: S.theme === t.id ? 'on' : '', style: { backgroundImage: `url("${Theme.preview(t.id)}")` },
          onclick: () => { set('theme', t.id); Theme.apply(S.theme, S.bg); this.render(); },
        }, h('span', t.icon, ' ', t.name), h('small', t.desc)))),
        h('h3', 'Hintergrund'),
        h('div.seg', ...[['scene', '🖼 Mit Bild'], ['none', '🎨 Nur Farben'], ['photo', '📷 Eigenes Foto']].map(([v, l]) => h('button', {
          class: S.bg === v ? 'on' : '',
          onclick: async () => {
            if (v === 'photo' && !(await IDB.get('misc', 'bgphoto'))) { const f = await pickFile('image/*'); if (!f) return; await Theme.setPhoto(f); }
            set('bg', v); await Theme.apply(S.theme, S.bg); this.render();
          },
        }, l))),
        S.bg === 'photo' && h('button.btn.ghost.sm', { onclick: async () => { const f = await pickFile('image/*'); if (f) { await Theme.setPhoto(f); Theme.apply(S.theme, S.bg); } } }, 'Anderes Foto wählen')),
      h('section.card', h('h2', '🔔 Hinweise'),
        toggle('notify', 'System-Benachrichtigungen (wenn die App im Hintergrund offen ist)', async () => { if (!(await UI.askNotify())) UI.toast('Benachrichtigungen im Browser nicht erlaubt', { kind: 'bad' }); }),
        toggle('sound', 'Töne'), toggle('vibrate', 'Vibration'),
        h('p.muted.small', 'Ohne eigenen Server gibt es keine Push-Nachrichten, wenn die App ganz geschlossen ist.')),
      h('section.card', h('h2', '💾 Backup & Umzug'),
        h('p.muted.small', 'Deine Trick-Historie gehört dir und liegt nur auf deinem Handy (und verschlüsselt bei deiner Crew).'),
        h('div.row.wrap',
          h('button.btn', { onclick: () => Backup.exportDialog() }, '⬇ Backup speichern'),
          h('button.btn.ghost', { onclick: () => Backup.importDialog() }, '⬆ Backup laden'),
          h('button.btn.ghost', { onclick: () => Backup.sendMove() }, '📲 Auf neues Handy umziehen'))),
      h('section.card', h('h2', 'ℹ️ Über Landed'),
        h('p.muted.small', 'Landed läuft komplett ohne eigenen Server: Handys verbinden sich direkt per WebRTC. Für den Verbindungsaufbau aus der Ferne werden öffentliche MQTT-Broker genutzt – alles Ende-zu-Ende-verschlüsselt mit eurem Crew-Code + PIN.'),
        h('p.muted.small', `Profil-ID: ${Me.id}`)),
    ];
  },

  editProfile() {
    let av = Me.profile.avatar, col = Me.profile.color;
    UI.sheet('Profil', (close) => {
      const name = h('input', { value: Me.profile.name, maxLength: 24 });
      return [
        h('label.field', h('span', 'Name'), name),
        h('div.field', h('span', 'Avatar'), h('div.chips.wrap', AVATARS.map((a) => h('button.chip.av', { class: a === av ? 'on' : '', onclick: (e) => { av = a; $$('.av', e.currentTarget.parentNode).forEach((c) => c.classList.toggle('on', c === e.currentTarget)); } }, a)))),
        h('div.field', h('span', 'Farbe'), h('div.chips.wrap', COLORS.map((c) => h('button.swatch', { class: c === col ? 'on' : '', style: { background: c }, onclick: (e) => { col = c; $$('.swatch', e.currentTarget.parentNode).forEach((x) => x.classList.toggle('on', x === e.currentTarget)); } })))),
        h('div.row.end', h('button.btn', { onclick: () => { Me.profile = { ...Me.profile, name: name.value.trim() || Me.profile.name, avatar: av, color: col }; Me.save(); Crews.publishMe(); close(); this.render(); } }, 'Speichern')),
      ];
    });
  },
};
Nav.register('me', MeView);
