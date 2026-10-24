/* Spiele-Tab: Game of S.K.A.T.E. (Langzeit per Video), Crew-Challenges, Trick-Roulette, Rangliste. */

/** Trick + Stance + Obstacle auswählen. Rückgabe { trick, cell } oder null */
function pickTrick(title = 'Trick wählen', { onlyLanded = false } = {}) {
  return new Promise((resolve) => {
    let done = false, chosen = null;
    const q = h('input.search', { type: 'search', placeholder: '🔎 Trick suchen …' });
    const list = h('div.pick-list');
    const stSel = h('select', STANCES.map((s) => h('option', { value: s.id }, s.name)));
    const obSel = h('select');
    const okBtn = h('button.btn', { disabled: true }, 'Übernehmen');
    const drawObst = () => { const c = catOf(chosen?.cat || 'flip'); fill(obSel, c.obst.map((o) => h('option', { value: o }, obstOf(o).name))); };
    const draw = () => {
      const s = q.value.trim().toLowerCase();
      let items = allTricks().filter((t) => !s || t.name.toLowerCase().includes(s));
      if (onlyLanded) items = items.filter((t) => TricksView.progress(t).best >= 2);
      items.sort((a, b) => TricksView.progress(b).best - TricksView.progress(a).best || a.diff - b.diff);
      fill(list, items.slice(0, 60).map((t) => h('button.pick', {
        class: chosen?.id === t.id ? 'on' : '',
        onclick: () => {
          chosen = t; okBtn.disabled = false; drawObst(); draw();
          // gestandene Zelle vorschlagen
          const landed = Object.entries(Me.logs[t.id]?.cells || {}).find(([, c]) => c.s >= 2);
          if (landed) { const { st, ob } = splitCell(landed[0]); stSel.value = st; obSel.value = ob; }
        },
      }, h('span', t.name), h('small.muted', ` ${STAGES[TricksView.progress(t).best].icon}`))));
      if (!items.length) fill(list, h('p.muted', onlyLanded ? 'Du hast noch keinen passenden Trick gestanden.' : 'Nichts gefunden.'));
    };
    q.oninput = draw;
    drawObst(); draw();
    UI.sheet(title, (close) => {
      okBtn.onclick = () => { done = true; resolve({ trick: chosen.id, cell: cellKey(stSel.value, obSel.value) }); close(); };
      return [q, list, h('div.row', h('label.field.grow', h('span', 'Stance'), stSel), h('label.field.grow', h('span', 'Obstacle'), obSel)), h('div.row.end', okBtn)];
    }, { onClose: () => { if (!done) resolve(null); } });
  });
}

const GamesView = {
  render() {
    const root = $('#view-games');
    const crew = Crews.active;
    if (!crew) return fill(root, App.noCrew());
    const games = crew.docs.all('skate').map((g) => ({ g, st: skateState(crew, g) })).sort((a, b) => (a.st.done - b.st.done) || b.g.start - a.g.start);
    const chals = crew.docs.all('chal').map((c) => ({ c, st: chalState(crew, c) })).sort((a, b) => (a.st.done - b.st.done) || a.c.end - b.c.end);
    fill(root,
      h('div.view-head', h('h1', 'Spiele'), h('p.muted', 'S.K.A.T.E. über Wochen, Challenges und Roulette für die Session.')),
      h('section.card',
        h('div.row.between', h('h2', '🛹 Game of S.K.A.T.E.'), h('button.btn.sm', { onclick: () => this.newGame(crew) }, '＋ Neue Partie')),
        h('p.muted.small', 'Vorsetzen per Clip, die anderen haben Zeit zum Nachstehen. Ehrensache: Clip ist Pflicht, markieren tust du selbst.'),
        games.length ? h('div.list', games.slice(0, 20).map(({ g, st }) => this.gameRow(crew, g, st))) : UI.empty('🎲', 'Noch keine Partie.')),
      h('section.card',
        h('div.row.between', h('h2', '⚡ Challenges'), h('button.btn.sm', { onclick: () => this.newChal(crew) }, '＋ Neu')),
        chals.length ? h('div.list', chals.slice(0, 20).map(({ c, st }) => this.chalRow(crew, c, st))) : UI.empty('🏁', 'Keine Challenge aktiv.')),
      h('section.card', h('h2', '🎰 Trick-Roulette'), h('p.muted.small', 'Zieht einen Trick aus deiner „Übe ich“-Liste – oder etwas, das du als Nächstes lernen kannst.'),
        this.rouletteBox(), h('div.row.center', h('button.btn.big', { onclick: () => this.spin() }, '🎰 Drehen'))),
      h('section.card', h('h2', '🏆 Rangliste'), this.leaderboard(crew)),
    );
  },

  /* ---------- Rangliste ---------- */
  leaderboard(crew) {
    const rows = crew.members().map((m) => {
      const logs = crew.logsOf(m.id), s = statsOf(logs), xp = m.id === Me.id ? xpOfLogs(Me.logs) : (m.xp ?? xpOfLogs(logs));
      return { m, xp, s, lv: levelOf(xp) };
    }).sort((a, b) => b.xp - a.xp);
    if (!rows.length) return UI.empty('👥', 'Noch keine Mitglieder.');
    return h('div.board', rows.map((r, i) => h('div.board-row', { class: r.m.id === Me.id ? 'me' : '' },
      h('span.rank', ['🥇', '🥈', '🥉'][i] || i + 1), UI.avatar(r.m, 34),
      h('div.grow', h('b', r.m.name, crew.online(r.m.id) ? h('i.online', { title: 'online' }) : null), h('small.muted', `Lv ${r.lv.lvl} ${r.lv.title} · ${r.s.landed} Tricks`)),
      h('b.xp', fmtNum(r.xp), h('small', ' XP')))));
  },

  /* ---------- S.K.A.T.E. ---------- */
  letters(word, n) { return h('span.letters', [...word].map((ch, i) => h('i', { class: i < n ? 'hit' : '' }, ch))); },

  statusText(crew, g, st) {
    const nm = (u) => (u === Me.id ? 'Du' : crew.member(u).name);
    if (st.done) return st.winner ? `🏆 ${nm(st.winner)} gewinnt` : 'Beendet';
    if (st.phase === 'set') return st.setter === Me.id ? `👉 Du setzt vor · ${fmtLeft(st.deadline)}` : `${nm(st.setter)} setzt vor · ${fmtLeft(st.deadline)}`;
    const open = st.responders.filter((p) => !st.resp[p]);
    if (open.includes(Me.id)) return `👉 Du musst ${getTrick(st.set.trick).name} nachstehen · ${fmtLeft(st.deadline)}`;
    return `Warten auf ${open.map(nm).join(', ')} · ${fmtLeft(st.deadline)}`;
  },
  myTurn(st) { return !st.done && ((st.phase === 'set' && st.setter === Me.id) || (st.phase === 'resp' && st.responders.includes(Me.id) && !st.resp[Me.id])); },

  gameRow(crew, g, st) {
    return h('button.game-row', { class: this.myTurn(st) ? 'turn' : st.done ? 'done' : '', onclick: () => this.game(crew, g.id) },
      h('div.players', g.players.map((p) => h('span.pl', { class: st.out.has(p) ? 'out' : '' }, UI.avatar(crew.member(p), 26), this.letters(st.word, st.letters[p])))),
      h('small', this.statusText(crew, g, st)));
  },

  async newGame(crew) {
    const members = crew.members().filter((m) => m.id !== Me.id);
    if (!members.length) return UI.toast('Lade erst jemanden in die Crew ein', { icon: '👥' });
    const picked = new Set();
    UI.sheet('Neue Partie S.K.A.T.E.', (close) => {
      const word = h('select', ['SKATE', 'SK8', 'PIG', 'SKATEBOARD'].map((w) => h('option', { value: w }, w)));
      const days = h('select', [1, 2, 3, 5, 7, 10, 14].map((d) => h('option', { value: d, selected: d === 7 }, `${d} ${d === 1 ? 'Tag' : 'Tage'} pro Zug`)));
      return [
        h('div.field', h('span', 'Gegner (1 = Duell, mehrere = Gruppe)'), h('div.chips.wrap', members.map((m) => h('button.chip', {
          onclick: (e) => { picked.has(m.id) ? picked.delete(m.id) : picked.add(m.id); e.currentTarget.classList.toggle('on'); },
        }, m.avatar, ' ', m.name)))),
        h('label.field', h('span', 'Wort'), word),
        h('label.field', h('span', 'Zeit pro Zug'), days),
        h('div.field', h('span', 'Modus'), h('div.chips', h('button.chip.on', 'Jeder gegen jeden'), h('button.chip', { disabled: true, title: 'kommt bald' }, '⚔️ Crew gegen Crew (bald)'))),
        h('div.row.end', h('button.btn', {
          onclick: () => {
            if (!picked.size) return UI.toast('Wähle mindestens einen Gegner');
            const id = uid(10);
            const players = [Me.id, ...[...picked].sort(() => Math.random() - 0.5)];
            crew.docs.put('skate', id, { id, players, word: word.value, days: +days.value, start: Date.now(), by: Me.id, mode: players.length > 2 ? 'group' : '1v1', teams: null });
            crew.post({ type: 'skate', text: `hat ein Game of ${word.value} gestartet: ${players.map((p) => crew.member(p).name).join(' vs. ')} 🛹` });
            close(); this.render(); setTimeout(() => this.game(crew, id), 260);
          },
        }, 'Los geht’s')),
      ];
    });
  },

  game(crew, gid) {
    const nm = (u) => (u === Me.id ? 'Du' : crew.member(u).name);
    let off = null;
    UI.sheet('Game of S.K.A.T.E.', (close, body) => {
      const draw = () => {
        const g = crew.docs.data('skate', gid); if (!g) return close();
        const st = skateState(crew, g);
        const actions = [];
        if (!st.done && st.phase === 'set' && st.setter === Me.id) actions.push(h('button.btn.big', { onclick: () => this.setTrick(crew, g, st, draw) }, '🎬 Trick vorsetzen'));
        if (!st.done && st.phase === 'resp' && st.responders.includes(Me.id) && !st.resp[Me.id]) {
          actions.push(h('button.btn.big', { onclick: () => this.respond(crew, g, st, true, draw) }, '✅ Gestanden (Clip)'),
            h('button.btn.ghost.big', { onclick: () => this.respond(crew, g, st, false, draw) }, '❌ Nicht geschafft'));
        }
        const cur = st.phase === 'resp' && !st.done ? [{ ...st, live: true }] : [];
        const rounds = [...st.rounds, ...cur].reverse();
        fill(body,
          h('div.sk-players', g.players.map((p) => h('div.sk-p', { class: `${st.out.has(p) ? 'out' : ''} ${st.setter === p && !st.done ? 'setter' : ''}` },
            UI.avatar(crew.member(p), 44), h('b', nm(p)), this.letters(st.word, st.letters[p])))),
          h('p.lead.center', this.statusText(crew, g, st)),
          actions.length ? h('div.row.center.wrap', actions) : null,
          h('h3', 'Verlauf'),
          rounds.length ? h('div.rounds', rounds.map((r) => r.skipped
            ? h('div.round.skip', `Runde ${r.r + 1}: ${nm(r.setter)} hat die Frist verpasst – Zug geht weiter`)
            : h('div.round', { class: r.live ? 'live' : '' },
              h('div.row.between', h('b', `Runde ${r.r + 1}: `, nm(r.setter), ' setzt ', h('span.post-trick', cellName(getTrick(r.set.trick).name, r.set.cell))), r.live && h('small.muted', fmtLeft(r.deadline))),
              h('div.media-row', Media.thumb(r.set.media)),
              h('div.resps', r.responders.map((p) => {
                const m = r.resp[p];
                return h('div.resp', { class: m ? (m.ok ? 'ok' : 'miss') : r.live ? 'wait' : 'miss' },
                  UI.avatar(crew.member(p), 24), h('span', nm(p), ': ', m ? (m.ok ? '✅ gestanden' : '❌ verpasst') : r.live ? '⏳ offen' : '⌛ Frist verpasst'),
                  m?.media && Media.thumb(m.media));
              }))))) : h('p.muted', 'Noch kein Zug.'),
          !st.done && g.by === Me.id && h('div.row.end', h('button.btn.ghost.danger.sm', {
            onclick: async () => { if (await UI.confirm('Partie abbrechen?', { ok: 'Abbrechen', danger: true })) { crew.docs.put('skate', gid, { ...g, ended: Date.now() }); draw(); } },
          }, 'Partie abbrechen')),
        );
      };
      draw();
      off = crew.docs.on('change', (kind) => { if (kind === 'skmove' || kind === 'skate') draw(); });
    }, { wide: true, onClose: () => { off?.(); this.render(); } });
  },

  async setTrick(crew, g, st, after) {
    const pick = await pickTrick('Welchen Trick setzt du vor?', { onlyLanded: false });
    if (!pick) return;
    UI.toast('Jetzt den Clip wählen oder aufnehmen (max. 15 s)', { icon: '🎬' });
    const media = await Media.pick('video', { capture: false });
    if (!media) return UI.toast('Ohne Clip geht’s nicht – Ehrensache!', { icon: '🎬', kind: 'bad' });
    const id = uid(10);
    crew.docs.put('skmove', id, { id, g: g.id, u: Me.id, type: 'set', round: st.round, trick: pick.trick, cell: pick.cell, media, ts: Date.now() });
    UI.beep();
    after?.();
  },

  async respond(crew, g, st, ok, after) {
    let media = null;
    if (ok) {
      media = await Media.pick('video');
      if (!media) return UI.toast('Clip ist Pflicht – Ehrensache!', { icon: '🎬', kind: 'bad' });
    } else if (!(await UI.confirm(`Du bekommst einen Buchstaben. Sicher, dass du ${getTrick(st.set.trick).name} nicht schaffst?`, { ok: 'Ja, Buchstabe nehmen' }))) return;
    const id = uid(10);
    crew.docs.put('skmove', id, { id, g: g.id, u: Me.id, type: 'resp', round: st.round, ok, media, ts: Date.now() });
    if (ok) { UI.beep('land'); UI.confetti(); } else UI.beep('bad');
    const after2 = skateState(crew, crew.docs.data('skate', g.id));
    if (after2.done && after2.winner) {
      crew.post({ u: after2.winner, type: 'skate', text: `gewinnt das Game of ${after2.word} gegen ${g.players.filter((p) => p !== after2.winner).map((p) => crew.member(p).name).join(', ')} 🏆` });
      App.afterChange();
    }
    after?.();
  },

  /* ---------- Challenges ---------- */
  chalRow(crew, c, st) {
    const lead = st.rows[0];
    return h('button.game-row', { class: st.done ? 'done' : '', onclick: () => this.chal(crew, c.id) },
      h('div.row.between', h('b', c.title), h('small.muted', st.done ? (st.winner ? `🏆 ${crew.member(st.winner).name}` : 'vorbei') : fmtLeft(c.end))),
      h('small.muted', c.kind === 'first' ? `Wer steht zuerst: ${cellName(getTrick(c.trick).name, c.cell)}` : `Wer schafft am meisten${c.n ? ` (Ziel ${c.n})` : ''}${c.trick ? ': ' + getTrick(c.trick).name : ''}`,
        lead ? ` · vorne: ${crew.member(lead.u).name}${c.kind === 'count' ? ` (${lead.n})` : ''}` : ''));
  },

  async newChal(crew) {
    const kind = await new Promise((res) => {
      let done = false;
      UI.sheet('Neue Challenge', (close) => [
        h('button.option', { onclick: () => { done = true; res('first'); close(); } }, h('b', '🥇 Wer steht ihn zuerst?'), h('small.muted', 'Ein Trick – wer ihn als Erstes gestanden einträgt, gewinnt.')),
        h('button.option', { onclick: () => { done = true; res('count'); close(); } }, h('b', '🔢 Wer schafft am meisten?'), h('small.muted', 'z.B. „10× Ollie über die Bank“ – jeder zählt selbst mit.')),
      ], { onClose: () => { if (!done) res(null); } });
    });
    if (!kind) return;
    let pick = null;
    if (kind === 'first') { pick = await pickTrick('Welcher Trick?'); if (!pick) return; }
    const r = await UI.form('Details', [
      { key: 'title', label: 'Titel', value: kind === 'first' ? `Wer steht zuerst ${getTrick(pick.trick).name}?` : '', placeholder: 'z.B. 10× Ollie über die Bank' },
      kind === 'count' && { key: 'n', label: 'Ziel (0 = einfach am meisten)', type: 'number', value: 10, min: 0 },
      { key: 'days', label: 'Dauer in Tagen', type: 'number', value: 7, min: 1, max: 60 },
    ].filter(Boolean), { ok: 'Starten' });
    if (!r || !r.title) return;
    const id = uid(10), start = Date.now();
    crew.docs.put('chal', id, { id, kind, title: r.title, trick: pick?.trick || null, cell: pick?.cell || null, n: r.n || 0, start, end: start + clamp(r.days || 7, 1, 60) * DAY, by: Me.id });
    crew.post({ type: 'chal', text: `startet eine Challenge: „${r.title}“ ⚡` });
    this.render();
  },

  chal(crew, cid) {
    UI.sheet('Challenge', (close, body) => {
      const draw = () => {
        const c = crew.docs.data('chal', cid); if (!c) return close();
        const st = chalState(crew, c);
        const mine = crew.docs.data('chalent', `${cid}~${Me.id}`)?.n || 0;
        const setN = (n) => { crew.docs.put('chalent', `${cid}~${Me.id}`, { c: cid, u: Me.id, n: Math.max(0, n), ts: Date.now() }); UI.vibrate([15]); draw(); };
        fill(body,
          h('h2', c.title),
          h('p.muted', st.done ? (st.winner ? `🏆 Gewonnen von ${crew.member(st.winner).name}` : 'Vorbei') : `Läuft bis ${fmtDateTime(c.end)} (${fmtLeft(c.end)})`),
          c.kind === 'first' && h('button.post-trick', { onclick: () => TricksView.cellEditor(getTrick(c.trick), c.cell, draw) }, '✅ Ich hab ihn gestanden – eintragen'),
          c.kind === 'count' && !st.done && h('div.counter', h('button.icon-btn.big', { onclick: () => setN(mine - 1) }, '−'), h('b', mine), h('button.btn.big', { onclick: () => setN(mine + 1) }, '+1')),
          h('h3', 'Stand'),
          st.rows.length ? h('div.board', st.rows.map((r, i) => h('div.board-row', { class: r.u === Me.id ? 'me' : '' },
            h('span.rank', ['🥇', '🥈', '🥉'][i] || i + 1), UI.avatar(crew.member(r.u), 30), h('b.grow', crew.member(r.u).name),
            h('small.muted', c.kind === 'first' ? fmtDateTime(r.ts) : `${r.n}${c.n ? ' / ' + c.n : ''}`)))) : h('p.muted', 'Noch niemand.'),
          c.by === Me.id && h('div.row.end', h('button.btn.ghost.danger.sm', { onclick: async () => { if (await UI.confirm('Challenge löschen?', { ok: 'Löschen', danger: true })) { crew.docs.remove('chal', cid); close(); } } }, 'Löschen')),
        );
      };
      draw();
    }, { onClose: () => this.render() });
  },

  /* ---------- Roulette ---------- */
  pool() {
    const pool = [];
    for (const [tid, log] of Object.entries(Me.logs)) for (const [ck, c] of Object.entries(log.cells)) if (c.s === 1) pool.push({ tid, ck });
    if (pool.length) return { pool, src: 'Übe ich' };
    const done = (id) => TricksView.progress(getTrick(id)).best >= 2;
    const next = allTricks().filter((t) => !done(t.id) && t.pre.every(done)).slice(0, 40).map((t) => ({ tid: t.id, ck: TricksView.baseCell(t) }));
    return { pool: next, src: 'Als Nächstes' };
  },
  last: null,   // letzte Ziehung (überlebt Neuzeichnen)
  rouletteBox() {
    const el = h('div#roulette.roulette');
    if (this.last) this._showWin(el); else fill(el, h('span', '?'));
    return el;
  },
  _showWin(el) {
    const { cur, src } = this.last;
    fill(el, h('span.win', cellName(getTrick(cur.tid).name, cur.ck)), h('small.muted', `aus „${src}“`),
      h('div.row.center', h('button.btn.sm', { onclick: () => TricksView.cellEditor(getTrick(cur.tid), cur.ck) }, '✅ Eintragen'), h('button.btn.ghost.sm', { onclick: () => this.spin() }, '🔁 Nochmal')));
  },
  spin() {
    const { pool, src } = this.pool();
    if (!pool.length) return $('#roulette') && fill($('#roulette'), h('span', 'Nichts zu ziehen 🤷'));
    const pickOne = () => pool[Math.floor(Math.random() * pool.length)];
    let n = 0, cur = pickOne();
    this.last = null;
    const step = () => {
      const el = $('#roulette');   // immer frisch holen – die Ansicht kann sich neu zeichnen
      cur = pickOne();
      n++;
      if (n < 18) {
        if (el) { el.classList.add('spinning'); fill(el, h('span', cellName(getTrick(cur.tid).name, cur.ck))); }
        setTimeout(step, 40 + n * n * 1.6);
      } else {
        this.last = { cur, src };
        UI.beep(); UI.vibrate([30, 40, 30]);
        if (el) { el.classList.remove('spinning'); this._showWin(el); }
      }
    };
    step();
  },
};
Nav.register('games', GamesView);
