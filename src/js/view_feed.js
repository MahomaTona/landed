/* Feed-Tab: automatische Posts (gestanden, Badges, Level, Spiele) mit Reaktionen und Kommentaren. */

const REACTIONS = ['🔥', '🤯', '👏', '🙌', '😂', '💀'];

const FeedView = {
  filter: 'all',
  limit: 30,

  render() {
    const root = $('#view-feed');
    const crew = Crews.active;
    if (!crew) return fill(root, App.noCrew());
    const live = crew.sessions();
    let posts = crew.posts();
    if (this.filter === 'me') posts = posts.filter((p) => p.u === Me.id);
    if (this.filter === 'land') posts = posts.filter((p) => p.type === 'land');
    fill(root,
      h('div.view-head',
        h('h1', 'Feed'),
        h('p.muted', crew.name, ' · ', `${crew.members().length} Mitglieder`),
        live.length ? h('div.live', h('b', '🟢 Gerade am Skaten'), ...live.map((s) => h('span.who', UI.avatar(crew.member(s.u), 24), `${crew.member(s.u).name}`, h('small.muted', ` @ ${s.spot || 'irgendwo'} · seit ${fmtTime(s.start)}`)))) : null,
        h('div.chips', ...[['all', 'Alles'], ['land', 'Nur Tricks'], ['me', 'Meine']].map(([f, l]) => h('button.chip', { class: this.filter === f ? 'on' : '', onclick: () => { this.filter = f; this.render(); } }, l)))),
      posts.length ? h('div.feed', posts.slice(0, this.limit).map((p) => this.card(crew, p)),
        posts.length > this.limit && h('button.btn.ghost.wide', { onclick: () => { this.limit += 30; this.render(); } }, 'Ältere laden'))
        : UI.empty('📣', 'Noch nichts los. Hake deinen ersten Trick ab – dann erscheint er hier für die ganze Crew.', h('button.btn', { onclick: () => Nav.go('tricks') }, 'Zu den Tricks')));
  },

  content(crew, p) {
    const m = crew.member(p.u);
    const who = h('b', m.name);
    switch (p.type) {
      case 'land': {
        const t = getTrick(p.trick);
        return [h('p.post-text', who, ` ${p.stage >= 4 ? 'hat gemeistert' : p.stage === 3 ? 'steht jetzt sicher' : 'hat gestanden'}: `),
          h('button.post-trick', { onclick: () => TricksView.detail(p.trick) }, STAGES[p.stage]?.icon, ' ', cellName(t.name, p.cell)),
          h('div.row.wrap.small.muted', p.xp ? h('span.tag.xp', `+${p.xp} XP`) : null, p.spot ? h('span', '📍 ', p.spot.name) : null, p.late ? h('span', '🗓 nachgetragen für ', fmtDate(p.date)) : null)];
      }
      case 'badge': { const b = BADGES.find((x) => x.id === p.badge); return [h('p.post-text', who, ' hat ein Abzeichen verdient:'), h('div.badge-big', h('span', b?.icon || '🏅'), h('div', h('b', b?.name), h('small.muted', b?.desc)))]; }
      case 'level': return [h('p.post-text', who, ' ist aufgestiegen: ', h('b', `Level ${p.lvl} · ${p.title}`), ' 🚀')];
      case 'skate': return [h('p.post-text', who, ' ', p.text)];
      case 'chal': return [h('p.post-text', who, ' ', p.text)];
      case 'spot': return [h('p.post-text', who, ' hat einen neuen Spot eingetragen: ', h('b', '📍 ', p.name))];
      default: return [h('p.post-text', who, ' ', p.text || '')];
    }
  },

  card(crew, p) {
    const m = crew.member(p.u);
    const reacts = crew.reactions(p.id);
    const mine = reacts.find((r) => r.u === Me.id)?.e;
    const cmts = crew.comments(p.id);
    const counts = {};
    for (const r of reacts) counts[r.e] = (counts[r.e] || 0) + 1;
    const cIn = h('input', { placeholder: 'Kommentar …', maxLength: 300, onkeydown: (e) => { if (e.key === 'Enter') send(); } });
    const send = () => {
      const text = cIn.value.trim(); if (!text) return;
      const id = uid(10);
      crew.docs.put('cmt', id, { id, p: p.id, u: Me.id, text, ts: Date.now() });
      cIn.value = '';
      this.render();
    };
    return h('article.post', { dataset: { type: p.type } },
      h('header.row', UI.avatar(m, 38), h('div.grow', h('b', m.name), h('small.muted', ' · ', fmtAgo(p.ts))),
        p.u === Me.id && h('button.icon-btn.sm', { title: 'Post löschen', onclick: async () => { if (await UI.confirm('Post löschen?', { ok: 'Löschen', danger: true })) { for (const c of Crews.list()) c.docs.remove('post', p.id); this.render(); } } }, '⋯')),
      ...this.content(crew, p),
      p.media?.length ? h('div.media-row', p.media.map((x) => Media.thumb(x, { big: p.media.length === 1 }))) : null,
      h('div.reacts',
        ...REACTIONS.map((e) => h('button.react', {
          class: mine === e ? 'on' : '',
          onclick: () => { crew.docs.put('react', `${p.id}~${Me.id}`, { p: p.id, u: Me.id, e: mine === e ? '' : e }); UI.vibrate([12]); this.render(); },
        }, e, counts[e] ? h('small', counts[e]) : null))),
      cmts.length ? h('div.comments', cmts.map((c) => h('div.cmt', h('b', crew.member(c.u).name), ' ', c.text, h('small.muted', ' · ', fmtAgo(c.ts)),
        c.u === Me.id && h('button.x', { onclick: () => { crew.docs.remove('cmt', c.id); this.render(); } }, '✕')))) : null,
      h('div.cmt-in', cIn, h('button.icon-btn', { onclick: send, title: 'Senden' }, '➤')));
  },
};
Nav.register('feed', FeedView);
