/* App: Start, Willkommen/Profil, Crew-Beitritt, Abhaken (-> Feed, XP, Badges), Benachrichtigungen, Topbar. */

const WORDS_A = ['kickflip', 'heelflip', 'ollie', 'grind', 'bowl', 'ledge', 'rail', 'manual', 'bigspin', 'nollie', 'coping', 'griptape', 'slappy', 'boneless'];
const WORDS_B = ['fuchs', 'hai', 'eule', 'gecko', 'tiger', 'otter', 'falke', 'wolf', 'krake', 'luchs', 'biber', 'dachs'];
const randomCode = () => `${randomOf(WORDS_A)}-${randomOf(WORDS_B)}-${10 + Math.floor(Math.random() * 90)}`;

const App = {
  _lastLevel: 0,

  async boot() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !PROFILE) navigator.serviceWorker.register('sw.js').catch(() => {});
    const qs = new URLSearchParams(location.search);
    if (qs.has('nobroker')) Net.noBroker = true;
    if (qs.has('nolocal')) Net.noLocal = true;
    const hasProfile = Me.load();
    await Theme.apply(Me.settings.theme, Me.settings.bg);
    if (!hasProfile) return this.welcome();
    await this.start();
  },

  async start() {
    $('#welcome').hidden = true;
    $('#app').hidden = false;
    await Crews.boot();
    this._lastLevel = levelOf(xpOfLogs(Me.logs)).lvl;
    this.wire();
    Nav.go('tricks');
    this.updateTop();
    checkBadges();   // stille Erstprüfung (z.B. nach Import)
    // Einladungslink?
    const inv = QR.parseInvite(location.href);
    if (inv) {
      history.replaceState(null, '', location.pathname + (PROFILE ? `?profile=${PROFILE}` : ''));
      if (!Crews.map.has(Cipher.norm(inv.code))) await this.joinCrew(inv.code, inv.pin);
      else Crews.select(Cipher.norm(inv.code));
    }
  },

  wire() {
    $$('#tabbar button').forEach((b) => { b.onclick = () => Nav.go(b.dataset.tab); });
    $('#crew-pill').onclick = () => this.crewSwitcher();
    $('#btn-scan').onclick = () => QR.scanAny();
    $('#sess-pill').onclick = () => Nav.go('spots');
    Crews.on('list', () => { this.updateTop(); Nav.refresh(); });
    Crews.on('status', () => this.updateTop());
    Crews.on('presence', () => { this.updateTop(); this._rerender(); });
    Crews.on('change', (crew, kind, id, doc, src) => {
      if (src === 'remote') this.onRemote(crew, kind, doc);
      if (crew === Crews.active) this._rerender(kind);
    });
    Me.on('log', () => { if (Nav.tab === 'me') this._rerender(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) Nav.refresh(); });
    setInterval(() => this.updateTop(), 15000);
  },

  /** Neu zeichnen, aber nicht während jemand tippt */
  _rerender: debounce(function (kind) {
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && $('#main').contains(a)) { setTimeout(() => App._rerender(kind), 1500); return; }
    if ($('.sheet')) return;   // offene Dialoge zeichnen sich selbst
    if (kind === 'log' && Nav.tab === 'tricks') return;
    Nav.refresh();
  }, 400),

  /* ---------- Benachrichtigungen für Neues von anderen ---------- */
  onRemote(crew, kind, doc) {
    if (doc.del || !doc.d) return;
    const d = doc.d;
    const fresh = Date.now() - (d.ts || doc.rev) < 5 * 60e3;
    if (!fresh || d.u === Me.id) return;
    const who = crew.member(d.u).name;
    if (kind === 'post' && d.type === 'land') UI.notify(`${who} 🔥`, `hat ${cellName(getTrick(d.trick).name, d.cell)} gestanden`, { tag: d.id });
    else if (kind === 'post' && d.type !== 'land') UI.notify(who, (d.text || (d.type === 'badge' ? 'hat ein Abzeichen verdient' : d.type === 'level' ? `ist jetzt Level ${d.lvl}` : 'hat etwas gepostet')).slice(0, 80));
    else if (kind === 'cmt') { const p = crew.docs.data('post', d.p); if (p?.u === Me.id) UI.notify(`💬 ${who}`, d.text.slice(0, 80)); }
    else if (kind === 'react' && d.e) { const p = crew.docs.data('post', d.p); if (p?.u === Me.id) UI.toast(`${who} reagiert ${d.e}`, { icon: d.e }); }
    else if (kind === 'skmove') {
      const g = crew.docs.data('skate', d.g);
      if (g?.players.includes(Me.id) && d.type === 'set') UI.notify('🛹 S.K.A.T.E.', `${who} setzt ${getTrick(d.trick).name} vor – du bist dran!`);
      else if (g?.by === Me.id || g?.players.includes(Me.id)) UI.toast(`${who}: ${d.ok ? '✅ gestanden' : '❌ verpasst'}`, { icon: '🛹' });
    } else if (kind === 'skate' && d.players?.includes(Me.id) && d.by !== Me.id && !d.ended) UI.notify('🛹 Neue Partie', `${who} fordert dich zu ${d.word} heraus!`);
    else if (kind === 'chal' && d.by !== Me.id) UI.notify('⚡ Challenge', `${who}: ${d.title}`);
  },

  /* ---------- Abhaken ---------- */
  setStage(tid, ck, stage, extra = {}) {
    const prevBest = Math.max(0, ...Object.values(Me.logs[tid]?.cells || {}).map((c) => c.s));
    const milestone = Me.setStage(tid, ck, stage, { spot: extra.spot, media: extra.media });
    const c = Me.cell(tid, ck);
    let late = false;
    if (c && stage >= 2 && extra.date && c.h[2] !== extra.date) {
      c.h[2] = extra.date;
      if (c.h[1] > extra.date) c.h[1] = extra.date;
      late = Date.now() - extra.date > DAY / 2;
      Me.save();
    }
    Crews.publishLog(tid);
    const t = getTrick(tid);
    if (milestone) {
      const xp = cellXp(t, ck, stage) - (stage > 2 ? cellXp(t, ck, stage - 1) : 0);
      Crews.post({ type: 'land', trick: tid, cell: ck, stage, spot: c.spot || null, media: extra.media || [], xp, late, date: c.h[2] });
      const s = Session.get();
      if (s) Session.update((x) => { x.landed = [...(x.landed || []), { tid, ck, stage }]; });
      UI.confetti(); UI.beep('land'); UI.vibrate([40, 50, 80]);
      UI.toast(`${STAGES[stage].icon} ${cellName(t.name, ck)} – +${xp} XP`, { icon: '🔥', ms: 3200 });
      if (prevBest < 2) this.checkChallenges(tid, ck);
    } else if (extra.media?.length) {
      UI.toast('Gespeichert', { icon: '💾' });
    }
    this.afterChange();
  },

  checkChallenges(tid, ck) {
    for (const crew of Crews.list()) {
      for (const ch of crew.docs.all('chal')) {
        if (ch.kind !== 'first' || ch.trick !== tid || ch.cell !== ck) continue;
        const st = chalState(crew, ch);
        if (st.winner === Me.id && st.rows.length === 1) crew.post({ type: 'chal', text: `gewinnt die Challenge „${ch.title}“ ⚡🏆` });
      }
    }
  },

  /** Nach jeder Änderung: Level-Up und Badges prüfen, Profil spiegeln */
  afterChange() {
    const lv = levelOf(xpOfLogs(Me.logs));
    if (lv.lvl > this._lastLevel && this._lastLevel) {
      Crews.post({ type: 'level', lvl: lv.lvl, title: lv.title });
      UI.toast(`Level ${lv.lvl} – ${lv.title}!`, { icon: '🚀', ms: 3500 });
    }
    this._lastLevel = lv.lvl;
    for (const b of checkBadges()) {
      Crews.post({ type: 'badge', badge: b.id });
      setTimeout(() => UI.toast(`Abzeichen: ${b.name}`, { icon: b.icon, ms: 3500 }), 600);
    }
    Crews.publishMe();
    this.updateTop();
  },

  mySession() { return Session.get(); },
  sessionTry(tid, ck) { if (Session.get()) Session.update((s) => { const k = `${tid}|${ck}`; s.tries[k] = (s.tries[k] || 0) + 1; }); },

  /* ---------- Topbar ---------- */
  updateTop() {
    const c = Crews.active;
    const pill = $('#crew-pill');
    if (!pill) return;
    if (!c) { fill(pill, h('span', '👥 Keine Crew')); pill.className = 'pill warn'; }
    else {
      const st = c.net?.status || {};
      const online = c.members().filter((m) => m.id !== Me.id && c.online(m.id)).length;
      pill.className = 'pill ' + (st.links ? 'ok' : st.mqtt ? 'mid' : 'warn');
      pill.title = `${st.mqtt ? 'Broker verbunden' : 'kein Broker'} · ${st.links || 0} direkt verbunden`;
      fill(pill, h('i.dot'), h('span.cn', c.name), h('small', ` ${online ? '· ' + online + ' online' : ''}`), Crews.list().length > 1 ? h('span', ' ▾') : null);
    }
    const s = Session.get();
    $('#sess-pill').hidden = !s;
    if (s) fill($('#sess-pill'), '🟢 ', s.spot || 'Session', ' · ', fmtDuration(Date.now() - s.start));
  },

  crewSwitcher() {
    UI.sheet('Crew wählen', (close) => [
      ...Crews.list().map((c) => h('button.option', { class: c === Crews.active ? 'on' : '', onclick: () => { Crews.select(c.code); close(); } },
        h('b', c.name), h('small.muted', `${c.members().length} Mitglieder · ${c.net?.status.mqtt ? '🌐' : ''} ${c.net?.status.links ? '🤝 ' + c.net.status.links : ''}`))),
      h('div.row.wrap', h('button.btn', { onclick: () => { close(); this.joinDialog(); } }, '＋ Crew beitreten / gründen'), Crews.active && h('button.btn.ghost', { onclick: () => { close(); MeView.invite(Crews.active); } }, '🔗 Einladen')),
    ]);
  },

  noCrew() {
    return UI.empty('👥', 'Du bist noch in keiner Crew. Gründe eine oder tritt per Code/QR bei – dann seht ihr gegenseitig eure Tricks.',
      h('div.row.center.wrap', h('button.btn', { onclick: () => this.joinDialog() }, '＋ Crew gründen / beitreten'), h('button.btn.ghost', { onclick: () => QR.scanAny() }, '📷 Scannen')));
  },

  joinDialog() {
    UI.sheet('Crew', (close) => {
      const name = h('input', { placeholder: 'z.B. Montagscrew', maxLength: 30 });
      const code = h('input', { value: randomCode(), autocapitalize: 'off', spellcheck: false });
      const pin = h('input', { placeholder: 'optional, z.B. 4 Ziffern', inputMode: 'numeric', maxLength: 12 });
      const jcode = h('input', { placeholder: 'Crew-Code', autocapitalize: 'off', spellcheck: false });
      const jpin = h('input', { placeholder: 'PIN (falls gesetzt)', inputMode: 'numeric' });
      return [
        h('h3', '🆕 Neue Crew gründen'),
        h('label.field', h('span', 'Name'), name),
        h('label.field', h('span', 'Crew-Code (das Geheimnis – nicht erratbar wählen)'), h('div.row', code, h('button.icon-btn', { onclick: () => { code.value = randomCode(); }, title: 'Neu würfeln' }, '🎲'))),
        h('label.field', h('span', 'PIN'), pin),
        h('div.row.end', h('button.btn', { onclick: async () => { close(); await this.joinCrew(code.value, pin.value, { name: name.value.trim() || null }); } }, 'Gründen')),
        h('hr'),
        h('h3', '🤝 Bestehender Crew beitreten'),
        h('label.field', h('span', 'Crew-Code'), jcode), h('label.field', h('span', 'PIN'), jpin),
        h('div.row.end', h('button.btn.ghost', { onclick: () => { close(); QR.scanAny(); } }, '📷 QR scannen'), h('button.btn', { onclick: async () => { if (!jcode.value.trim()) return; close(); await this.joinCrew(jcode.value, jpin.value); } }, 'Beitreten')),
      ];
    });
  },

  async joinCrew(code, pin, { name = null, quiet = false } = {}) {
    try {
      const c = await Crews.join(code, pin, name);
      if (!quiet) UI.toast(`Willkommen in „${c.name}“`, { icon: '🤘' });
      this.updateTop();
      Nav.refresh();
      return c;
    } catch (e) { UI.toast(e.message, { kind: 'bad' }); return null; }
  },

  /* ---------- Willkommen ---------- */
  welcome() {
    const w = $('#welcome');
    w.hidden = false;
    let av = randomOf(AVATARS), col = randomOf(COLORS), theme = Me.settings.theme;
    const name = h('input', { placeholder: 'Dein Skater-Name', maxLength: 24, autocomplete: 'nickname' });
    fill(w, h('div.welcome-box',
      h('div.logo', h('img', { src: 'icon.svg', alt: '' }), h('h1', 'Landed')),
      h('p.lead', 'Dein Trick-Tagebuch – mit deiner Crew. Abhaken, wann du was gestanden hast, Feed, S.K.A.T.E. über Wochen. Ohne Server, direkt von Handy zu Handy.'),
      h('label.field', h('span', 'Name'), name),
      h('div.field', h('span', 'Avatar'), h('div.chips.wrap', AVATARS.map((a) => h('button.chip.av', { class: a === av ? 'on' : '', onclick: (e) => { av = a; $$('.av', w).forEach((c) => c.classList.toggle('on', c === e.currentTarget)); } }, a)))),
      h('div.field', h('span', 'Farbe'), h('div.chips.wrap', COLORS.map((c) => h('button.swatch', { class: c === col ? 'on' : '', style: { background: c }, onclick: (e) => { col = c; $$('.swatch', w).forEach((x) => x.classList.toggle('on', x === e.currentTarget)); } })))),
      h('div.field', h('span', 'Look'), h('div.themes.small', THEMES.map((t) => h('button.theme', {
        class: t.id === theme ? 'on' : '', style: { backgroundImage: `url("${Theme.preview(t.id)}")` },
        onclick: (e) => { theme = t.id; Me.settings.theme = t.id; Theme.apply(t.id, Me.settings.bg); $$('.theme', w).forEach((x) => x.classList.toggle('on', x === e.currentTarget)); },
      }, h('span', t.icon, ' ', t.name))))),
      h('button.btn.big.wide', {
        onclick: async () => {
          if (!name.value.trim()) { name.focus(); return UI.toast('Wie heißt du?'); }
          Me.create(name.value.trim(), av, col);
          await this.start();
          if (!Crews.list().length) this.joinDialog();
        },
      }, 'Los geht’s 🛹'),
      h('button.btn.ghost.wide', { onclick: async () => { const t = await QR.scan('Umzugs-Code scannen', 'Altes Handy: Ich → Einstellungen → „Auf neues Handy umziehen“.'); if (t) QR.answerFlow(t); } }, '📲 Vom alten Handy übernehmen'),
      h('button.btn.ghost.wide', { onclick: () => Backup.importDialog() }, '⬆ Backup-Datei laden')));
    setTimeout(() => name.focus(), 200);
  },
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.boot().catch((e) => { console.error(e); document.body.append(h('pre.fatal', 'Fehler beim Start: ' + e.message)); }));
