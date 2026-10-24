/* Tricks-Tab: Liste mit Fortschrittsring, Raster Stance × Obstacle, Zellen-Editor, Lernpfad, eigene Tricks + Baukasten. */

const TricksView = {
  q: '', cat: 'all', status: 'all', sort: 'cat', mode: 'list',

  render() {
    const root = $('#view-tricks');
    const stats = statsOf(Me.logs);
    const head = h('div.view-head',
      h('div.row.between',
        h('div', h('h1', 'Tricks'), h('p.muted', `${stats.landed} gestanden · ${stats.practicing} in Arbeit · ${stats.mastered} gemeistert`)),
        h('div.row',
          h('button.icon-btn.big', { title: 'Trick-Baukasten', onclick: () => this.builder() }, '🧩'),
          h('button.icon-btn.big', { title: 'Eigenen Trick anlegen', onclick: () => this.customDialog() }, '＋'))),
      h('div.seg',
        ...[['list', '📋 Liste'], ['tree', '🌳 Lernpfad'], ['next', '🎯 Als Nächstes']].map(([m, l]) => h('button', { class: this.mode === m ? 'on' : '', onclick: () => { this.mode = m; this.render(); } }, l))),
      this.mode === 'list' && h('input.search', { type: 'search', placeholder: '🔎 Trick suchen …', value: this.q, oninput: (e) => { this.q = e.target.value; this._list(); } }),
      h('div.chips.scroll',
        h('button.chip', { class: this.cat === 'all' ? 'on' : '', onclick: () => { this.cat = 'all'; this.render(); } }, 'Alle'),
        ...CATS.map((c) => h('button.chip', { class: this.cat === c.id ? 'on' : '', onclick: () => { this.cat = c.id; this.render(); } }, c.icon, ' ', c.name))),
      this.mode === 'list' && h('div.row.between.wrap.small',
        h('div.chips.wrap',
          ...[['all', 'Alle'], ['open', 'Offen'], ['practice', 'Übe ich'], ['landed', 'Gestanden']].map(([s, l]) => h('button.chip.sm', { class: this.status === s ? 'on' : '', onclick: () => { this.status = s; this._list(); this._chipsOn(); } , dataset: { st: s } }, l))),
        h('select.mini', { onchange: (e) => { this.sort = e.target.value; this._list(); } },
          ...[['cat', 'nach Kategorie'], ['diff', 'nach Schwierigkeit'], ['recent', 'zuletzt geändert'], ['name', 'A–Z']].map(([v, l]) => h('option', { value: v, selected: this.sort === v }, l)))),
    );
    const body = h('div#trick-body');
    fill(root, head, body);
    if (this.mode === 'list') this._list();
    else if (this.mode === 'tree') this._tree(body);
    else this._next(body);
  },
  _chipsOn() { $$('[data-st]').forEach((b) => b.classList.toggle('on', b.dataset.st === this.status)); },

  /** Fortschritt eines Tricks */
  progress(t, logs = Me.logs) {
    const cells = logs[t.id]?.cells || {};
    const total = STANCES.length * catOf(t.cat).obst.length;
    const vals = Object.entries(cells);
    const landed = vals.filter(([, c]) => c.s >= 2).length;
    const best = Math.max(0, ...vals.map(([, c]) => c.s));
    const first = Math.min(...vals.filter(([, c]) => c.h?.[2]).map(([, c]) => c.h[2]));
    const upd = logs[t.id]?.upd || 0;
    return { landed, total, best, first: isFinite(first) ? first : null, upd, frac: landed / total };
  },
  baseCell(t) { return cellKey('reg', catOf(t.cat).obst[0]); },

  _list() {
    const body = $('#trick-body'); if (!body) return;
    const q = this.q.trim().toLowerCase();
    let list = allTricks().filter((t) => (this.cat === 'all' || t.cat === this.cat) && (!q || t.name.toLowerCase().includes(q)));
    const P = new Map(list.map((t) => [t.id, this.progress(t)]));
    list = list.filter((t) => {
      const p = P.get(t.id);
      return this.status === 'all' || (this.status === 'open' && p.best === 0) || (this.status === 'practice' && p.best === 1) || (this.status === 'landed' && p.best >= 2);
    });
    const cmp = {
      cat: (a, b) => CATS.indexOf(catOf(a.cat)) - CATS.indexOf(catOf(b.cat)) || a.diff - b.diff,
      diff: (a, b) => a.diff - b.diff || a.name.localeCompare(b.name),
      recent: (a, b) => P.get(b.id).upd - P.get(a.id).upd,
      name: (a, b) => a.name.localeCompare(b.name),
    }[this.sort];
    list.sort(cmp);
    if (!list.length) return fill(body, UI.empty('🛹', 'Keine Tricks gefunden.'));
    const out = [];
    let lastCat = null;
    for (const t of list) {
      if (this.sort === 'cat' && t.cat !== lastCat) { lastCat = t.cat; const c = catOf(t.cat); out.push(h('h3.group', c.icon, ' ', c.name)); }
      out.push(this.row(t, P.get(t.id)));
    }
    fill(body, h('div.list', out));
  },

  row(t, p) {
    const base = this.baseCell(t);
    const bs = Me.stage(t.id, base);
    return h('div.trick-row', { onclick: () => this.detail(t.id), dataset: { s: p.best } },
      UI.ring(p.frac, p.landed ? String(p.landed) : STAGES[p.best].icon),
      h('div.tr-main',
        h('div.tr-name', t.name, !t.builtin && h('span.tag', 'eigen')),
        h('div.tr-sub', h('span.diff', { title: `Schwierigkeit ${t.diff}/10` }, '●'.repeat(Math.ceil(t.diff / 2)), h('i', '●'.repeat(5 - Math.ceil(t.diff / 2)))),
          p.first ? h('span', ' · ✅ ', fmtDate(p.first)) : p.best === 1 ? h('span', ' · 🔁 übe ich') : null)),
      h('button.quick', {
        class: 's' + bs, title: 'Schnell abhaken (Regular)',
        onclick: (e) => { e.stopPropagation(); this.quick(t, base); },
      }, bs >= 2 ? '✓' : bs === 1 ? '🔁' : '○'));
  },

  /** Schnell-Haken: ○ -> 🔁 -> ✓ */
  quick(t, ck) {
    const s = Me.stage(t.id, ck);
    const next = s === 0 ? 1 : s === 1 ? 2 : s;
    if (next === s) return this.cellEditor(t, ck);
    App.setStage(t.id, ck, next);
    this._list();
  },

  /* ---------- Detail mit Raster ---------- */
  detail(tid) {
    const t = getTrick(tid);
    const cat = catOf(t.cat);
    const crew = Crews.active;
    const sheet = UI.sheet(t.name, (close, body) => {
      const draw = () => {
        const grid = h('div.grid', { style: { '--cols': cat.obst.length } },
          h('div.gh'), ...cat.obst.map((o) => h('div.gh', { title: obstOf(o).name }, h('span.oi', obstOf(o).icon), obstOf(o).name)),
          ...STANCES.flatMap((st) => [
            h('div.gr', st.name),
            ...cat.obst.map((o) => {
              const ck = cellKey(st.id, o), c = Me.cell(tid, ck), s = c?.s || 0;
              return h('button.cell', { dataset: { s }, onclick: () => this.cellEditor(t, ck, draw) },
                h('b', STAGES[s].icon), c?.h?.[2] ? h('small', fmtDateShort(c.h[2])) : c?.tries ? h('small', `${c.tries}×`) : null,
                c?.media?.length ? h('i.has-media', '🎬') : null);
            }),
          ]));
        const who = crew ? crew.members().filter((m) => m.id !== Me.id && Object.values(crew.logsOf(m.id)[tid]?.cells || {}).some((c) => c.s >= 2)) : [];
        const media = Object.values(Me.logs[tid]?.cells || {}).flatMap((c) => c.media || []);
        fill(body,
          h('div.row.wrap.small',
            h('span.tag', cat.icon, ' ', cat.name), h('span.tag', `Schwierigkeit ${t.diff}/10`),
            h('span.tag', `${cellXp(t, 'reg.flat', 2)} XP Basis`)),
          t.tip && h('p.tip', '💡 ', t.tip),
          t.pre?.length && h('div.prereq', h('span.muted', 'Voraussetzungen: '),
            ...t.pre.map((pid) => { const pt = getTrick(pid), ok = this.progress(pt).best >= 2; return h('button.chip.sm', { class: ok ? 'ok' : '', onclick: () => { close(); setTimeout(() => this.detail(pid), 260); } }, ok ? '✓ ' : '🔒 ', pt.name); })),
          h('h3', 'Stance × Obstacle'),
          h('p.muted.small', 'Tippe ein Feld an, um Stufe, Datum, Spot und Beweis-Clip einzutragen.'),
          grid,
          media.length ? [h('h3', 'Clips & Fotos'), h('div.media-row', media.slice().reverse().map((m) => Media.thumb(m)))] : null,
          who.length ? [h('h3', 'In der Crew gestanden von'), h('div.row.wrap', who.map((m) => h('span.who', UI.avatar(m, 26), m.name)))] : null,
          !t.builtin && t.by === Me.id && h('div.row.end', h('button.btn.ghost.danger', {
            onclick: async () => { if (await UI.confirm(`„${t.name}“ samt Einträgen löschen?`, { ok: 'Löschen', danger: true })) { Me.removeCustom(tid); Crews.publishLog(tid); close(); this.render(); } },
          }, '🗑 Eigenen Trick löschen')),
        );
      };
      draw();
    }, { wide: true, onClose: () => Nav.refresh('tricks') });
    return sheet;
  },

  /* ---------- Zellen-Editor ---------- */
  cellEditor(t, ck, after) {
    const c = Me.cell(t.id, ck) || { s: 0, h: {}, media: [], tries: 0 };
    let stage = c.s;
    const media = [];
    const crew = Crews.active;
    const spots = crew ? crew.docs.all('spot').sort((a, b) => a.name.localeCompare(b.name)) : [];
    const sess = App.mySession();
    const dateIn = h('input', { type: 'date', value: new Date(c.h?.[2] || Date.now()).toISOString().slice(0, 10), max: new Date().toISOString().slice(0, 10) });
    const spotSel = h('select',
      h('option', { value: '' }, '– kein Spot –'),
      ...spots.map((s) => h('option', { value: 'id:' + s.id, selected: c.spot?.id === s.id || (!c.spot && sess?.spotId === s.id) }, '📍 ', s.name)),
      h('option', { value: 'free', selected: c.spot && !c.spot.id }, '✏️ Freier Name …'));
    const spotFree = h('input', { placeholder: 'Spot-Name', value: c.spot && !c.spot.id ? c.spot.name : '', hidden: !(c.spot && !c.spot.id) });
    spotSel.onchange = () => { spotFree.hidden = spotSel.value !== 'free'; };
    const mediaBox = h('div.media-row');
    const triesEl = h('b', String(c.tries || 0));
    const drawMedia = () => fill(mediaBox, ...(c.media || []).map((m) => Media.thumb(m)), ...media.map((m) => Media.thumb(m)),
      h('button.media.add', { onclick: async () => { const m = await Media.pick('any'); if (m) { media.push(m); drawMedia(); } } }, '＋', h('small', 'Foto/Clip')));
    drawMedia();

    UI.sheet(cellName(t.name, ck), (close) => {
      const stageBtns = h('div.stages', ...STAGES.map((s) => h('button.stage-btn', {
        dataset: { s: s.n }, class: s.n === stage ? 'on' : '',
        onclick: (e) => { stage = s.n; $$('.stage-btn', e.currentTarget.parentNode).forEach((b) => b.classList.toggle('on', +b.dataset.s === stage)); dateRow.hidden = stage < 2; },
      }, h('span', s.icon), s.name)));
      const dateRow = h('label.field', { hidden: stage < 2 }, h('span', 'Gestanden am'), dateIn);
      return [
        stageBtns,
        dateRow,
        h('label.field', h('span', 'Spot'), spotSel), spotFree,
        h('div.field', h('span', 'Beweis (Foto oder Clip ≤ 15 s)'), mediaBox),
        h('div.row.between.tries', h('span', 'Versuche: ', triesEl, sess ? h('small.muted', ' (Session läuft)') : null),
          h('div.row', h('button.icon-btn', { onclick: () => { Me.addTry(t.id, ck, -1); triesEl.textContent = Me.cell(t.id, ck)?.tries || 0; } }, '−'),
            h('button.btn.sm', { onclick: () => { Me.addTry(t.id, ck, 1); App.sessionTry(t.id, ck); triesEl.textContent = Me.cell(t.id, ck).tries; UI.vibrate([15]); } }, '+1 Versuch'))),
        Object.keys(c.h || {}).length ? h('div.history', h('span.muted', 'Verlauf: '),
          ...Object.entries(c.h).sort((a, b) => a[0] - b[0]).map(([s, ts]) => h('span.chip.sm', STAGES[s].icon, ' ', fmtDate(ts)))) : null,
        h('div.row.end',
          h('button.btn.ghost', { onclick: () => close() }, 'Abbrechen'),
          h('button.btn', {
            onclick: () => {
              let spot = null;
              if (spotSel.value.startsWith('id:')) { const s = spots.find((x) => x.id === spotSel.value.slice(3)); spot = { id: s.id, name: s.name }; }
              else if (spotSel.value === 'free' && spotFree.value.trim()) spot = { name: spotFree.value.trim() };
              // Datum: heute -> jetzt, sonst Mittag des gewählten Tages (für Nachträge)
              let date = null;
              if (stage >= 2 && dateIn.value) {
                const picked = new Date(dateIn.value + 'T12:00:00');
                date = picked.toDateString() === new Date().toDateString() ? Date.now() : picked.getTime();
                if (c.h?.[2] && new Date(c.h[2]).toDateString() === picked.toDateString()) date = c.h[2];
              }
              App.setStage(t.id, ck, stage, { spot, media, date });
              close(); after?.();
            },
          }, 'Speichern')),
      ];
    });
  },

  /* ---------- Lernpfad (Skill-Tree) ---------- */
  _tree(body) {
    const list = allTricks().filter((t) => this.cat === 'all' ? t.cat !== 'own' : t.cat === this.cat);
    const done = (id) => this.progress(getTrick(id)).best >= 2;
    const cats = this.cat === 'all' ? CATS.filter((c) => c.id !== 'own') : [catOf(this.cat)];
    const out = [];
    for (const c of cats) {
      const items = list.filter((t) => t.cat === c.id);
      if (!items.length) continue;
      const layers = [];
      for (const t of items) { const d = trickDepth(t.id); (layers[d] = layers[d] || []).push(t); }
      out.push(h('h3.group', c.icon, ' ', c.name, h('small.muted', ` ${items.filter((t) => done(t.id)).length}/${items.length}`)));
      out.push(h('div.tree', layers.filter(Boolean).map((L, i) => h('div.tree-layer',
        h('span.tree-lvl', `Stufe ${i + 1}`),
        L.sort((a, b) => a.diff - b.diff).map((t) => {
          const ok = done(t.id), open = t.pre.every(done);
          return h('button.node', { class: ok ? 'done' : open ? 'open' : 'locked', onclick: () => this.detail(t.id), title: t.pre.length ? 'Braucht: ' + t.pre.map((p) => getTrick(p).name).join(', ') : '' },
            h('span', ok ? '✅' : open ? '🔓' : '🔒'), t.name);
        })))));
    }
    fill(body, h('p.muted.small', '🔓 = alle Voraussetzungen gestanden – bereit zum Lernen. 🔒 = erst die Basics.'), out);
  },

  _next(body) {
    const done = (id) => this.progress(getTrick(id)).best >= 2;
    const list = allTricks().filter((t) => (this.cat === 'all' || t.cat === this.cat) && !done(t.id) && t.pre.every(done))
      .sort((a, b) => this.progress(b).best - this.progress(a).best || a.diff - b.diff).slice(0, 30);
    fill(body,
      h('p.muted.small', 'Tricks, für die du alle Voraussetzungen schon kannst – leichteste zuerst, angefangene oben.'),
      list.length ? h('div.list', list.map((t) => this.row(t, this.progress(t)))) : UI.empty('🏆', 'Nichts offen – du hast alles, wofür die Basics sitzen!'));
  },

  /* ---------- eigene Tricks ---------- */
  async customDialog(pre = {}) {
    const r = await UI.form('Eigener Trick', [
      { key: 'name', label: 'Name', value: pre.name || '', placeholder: 'z.B. Kickflip Late Shove' },
      { key: 'cat', label: 'Kategorie', type: 'select', value: pre.cat || 'own', options: CATS.map((c) => [c.id, `${c.icon} ${c.name}`]) },
      { key: 'diff', label: 'Schwierigkeit (1–10)', type: 'number', value: pre.diff || 5, min: 1, max: 10 },
      { key: 'tip', label: 'Beschreibung / Tipp', type: 'textarea', value: pre.tip || '' },
    ], { ok: 'Anlegen' });
    if (!r || !r.name) return;
    const existing = allTricks().find((t) => t.name.toLowerCase() === r.name.toLowerCase());
    if (existing) { UI.toast('Den gibt es schon – geöffnet', { icon: '👀' }); return this.detail(existing.id); }
    const id = Me.addCustom({ name: r.name, cat: r.cat, diff: clamp(Math.round(r.diff) || 5, 1, 10), tip: r.tip });
    Crews.publishMe();
    App.afterChange();
    this.render();
    this.detail(id);
  },

  builder() {
    const sel = { rot: '', board: 'kick', into: '', out: '' };
    const prev = h('div.kit-preview');
    const upd = () => { const b = KIT.build(sel); fill(prev, h('b', b.name || '…'), h('span.muted', ` · Schwierigkeit ${b.diff} · ${catOf(b.cat).name}`)); };
    UI.sheet('🧩 Trick-Baukasten', (close) => {
      const group = (key, label) => h('div.field', h('span', label), h('div.chips.wrap', KIT[key].map((x) => h('button.chip.sm', {
        class: sel[key] === x.id ? 'on' : '',
        onclick: (e) => { sel[key] = x.id; $$('.chip', e.currentTarget.parentNode).forEach((c) => c.classList.toggle('on', c === e.currentTarget)); upd(); },
      }, x.name))));
      upd();
      return [
        h('p.muted.small', 'Kombiniere Drehung, Board-Trick, Grind/Slide und Ausstieg. Stance (Switch, Nollie …) und Obstacle wählst du später im Raster.'),
        group('rot', '1 · Körperdrehung'), group('board', '2 · Board-Trick'), group('into', '3 · Rein in (Grind/Slide/Manual)'), group('out', '4 · Raus mit'),
        prev,
        h('div.row.end', h('button.btn', {
          onclick: () => {
            const b = KIT.build(sel);
            if (!b.name) return;
            const existing = allTricks().find((t) => t.name.toLowerCase() === b.name.toLowerCase());
            close();
            if (existing) { setTimeout(() => this.detail(existing.id), 260); return; }
            setTimeout(() => this.customDialog({ name: b.name, diff: b.diff, cat: b.cat }), 260);
          },
        }, 'Weiter')),
      ];
    });
  },
};
Nav.register('tricks', TricksView);
