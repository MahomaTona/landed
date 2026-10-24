/* Spots-Tab: Session-Tracker ("Tony ist im Park XY seit 17:20", nur Spot-Name, kein Live-GPS)
   und gemeinsame Spot-Karte (OpenStreetMap/Leaflet, kein API-Key) mit Fotos, Bewertung und Tricks pro Spot. */

const SPOT_TYPES = [
  ['park', '🏟️', 'Skatepark'], ['street', '🏙️', 'Street-Spot'], ['diy', '🧱', 'DIY'], ['bowl', '🥣', 'Bowl/Pool'],
  ['ledge', '▭', 'Ledges'], ['stairs', '🪜', 'Treppe/Gap'], ['rail', '═', 'Rail'], ['indoor', '🏠', 'Halle'], ['shop', '🛒', 'Shop'],
];
const spotType = (id) => SPOT_TYPES.find((t) => t[0] === id) || SPOT_TYPES[1];

const Session = {
  _key: LS_PREFIX + 'session',
  get() { return LS.get(this._key, null); },
  start(spot) {
    const s = { id: uid(8), u: Me.id, spot: spot?.name || '', spotId: spot?.id || null, start: Date.now(), end: null, tries: {}, landed: [] };
    LS.set(this._key, s);
    LS.set(LS_PREFIX + 'sesscount', (LS.get(LS_PREFIX + 'sesscount', 0) || 0) + 1);
    this.publish(s);
    return s;
  },
  update(fn) { const s = this.get(); if (!s) return; fn(s); LS.set(this._key, s); this.publish(s); },
  stop() {
    const s = this.get(); if (!s) return null;
    s.end = Date.now();
    this.publish(s);
    LS.del(this._key);
    const hist = LS.get(LS_PREFIX + 'sesshist', []);
    hist.push(s); LS.set(LS_PREFIX + 'sesshist', hist.slice(-200));
    return s;
  },
  publish(s) { for (const c of Crews.list()) c.docs.put('sess', Me.id, { u: Me.id, spot: s.spot, spotId: s.spotId, start: s.start, end: s.end }); },
  history() { return LS.get(LS_PREFIX + 'sesshist', []); },
};

const SpotsView = {
  map: null, layer: null, myPos: null,

  render() {
    const root = $('#view-spots');
    const crew = Crews.active;
    if (!crew) return fill(root, App.noCrew());
    const sess = Session.get();
    const live = crew.sessions().filter((s) => s.u !== Me.id);
    const spots = crew.docs.all('spot');
    const mapEl = h('div#spotmap.spotmap');
    fill(root,
      h('div.view-head', h('h1', 'Spots & Sessions')),
      h('section.card.session', sess ? this.sessionCard(sess) : [
        h('h2', '⏱ Session'), h('p.muted.small', 'Starte eine Session – die Crew sieht, wo du skatest. Versuche zählst du direkt in den Tricks mit.'),
        h('button.btn.big.wide', { onclick: () => this.startSession(crew) }, '▶ Session starten')]),
      live.length ? h('section.card', h('h2', '🟢 Gerade unterwegs'), live.map((s) => h('div.who-row', UI.avatar(crew.member(s.u), 30), h('b', crew.member(s.u).name), h('span.muted', ` @ ${s.spot || 'irgendwo'} · seit ${fmtTime(s.start)}`)))) : null,
      h('section.card',
        h('div.row.between', h('h2', '📍 Spot-Karte'), h('div.row', h('button.icon-btn', { title: 'Mein Standort', onclick: () => this.locate(true) }, '🎯'), h('button.btn.sm', { onclick: () => this.addSpot(crew) }, '＋ Spot'))),
        mapEl,
        h('p.muted.small', 'Tippe lange auf die Karte, um dort einen Spot einzutragen.'),
        spots.length ? h('div.list', this.sorted(spots).map((s) => this.spotRow(crew, s))) : UI.empty('🗺️', 'Noch keine Spots. Trag euren Lieblingspark ein!')),
    );
    this.mountMap(mapEl, crew, spots);
    clearInterval(this._tick);
    if (sess) this._tick = setInterval(() => { const el = $('#sess-dur'); if (el) el.textContent = fmtDuration(Date.now() - sess.start); else clearInterval(this._tick); }, 30000);
  },

  sorted(spots) {
    if (!this.myPos) return spots.sort((a, b) => a.name.localeCompare(b.name));
    return spots.sort((a, b) => geoDist(this.myPos, a) - geoDist(this.myPos, b));
  },

  sessionCard(s) {
    const tries = sum(Object.values(s.tries || {}));
    return [
      h('div.row.between', h('h2', '🟢 Session läuft'), h('span.tag', fmtTime(s.start))),
      h('p.lead', '📍 ', s.spot || 'ohne Spot', ' · ', h('span#sess-dur', fmtDuration(Date.now() - s.start))),
      h('div.row.wrap.small', h('span.tag', `${tries} Versuche`), h('span.tag', `${(s.landed || []).length} gestanden`)),
      h('div.row', h('button.btn.ghost', { onclick: () => Nav.go('tricks') }, '🛹 Zu den Tricks'), h('button.btn.danger', { onclick: () => this.endSession() }, '⏹ Beenden')),
    ];
  },

  async startSession(crew) {
    const spots = this.sorted(crew.docs.all('spot'));
    UI.sheet('Wo skatest du?', (close) => {
      const free = h('input', { placeholder: 'Oder freier Name, z.B. „Schulhof“' });
      const go = (spot) => { Session.start(spot); close(); UI.toast('Session gestartet – viel Spaß!', { icon: '🛹' }); this.render(); };
      return [
        spots.length ? h('div.list', spots.slice(0, 12).map((s) => h('button.option', { onclick: () => go(s) }, h('b', spotType(s.type)[1], ' ', s.name), this.myPos ? h('small.muted', fmtDist(geoDist(this.myPos, s))) : null))) : h('p.muted', 'Noch keine Spots eingetragen.'),
        h('div.row', free, h('button.btn', { onclick: () => go(free.value.trim() ? { name: free.value.trim() } : null) }, 'Start')),
      ];
    });
  },

  endSession() {
    const s = Session.stop();
    if (!s) return;
    const tries = Object.entries(s.tries || {}).sort((a, b) => b[1] - a[1]);
    UI.sheet('Session vorbei 🙌', () => [
      h('p.lead', `${fmtDuration(s.end - s.start)} @ ${s.spot || 'ohne Spot'}`),
      h('div.stats-grid', h('div.stat', h('b', sum(tries.map((x) => x[1]))), h('small', 'Versuche')), h('div.stat', h('b', (s.landed || []).length), h('small', 'gestanden'))),
      (s.landed || []).length ? [h('h3', 'Gestanden'), h('div.chips.wrap', s.landed.map((l) => h('span.chip', '✅ ', cellName(getTrick(l.tid).name, l.ck))))] : null,
      tries.length ? [h('h3', 'Versuche'), h('div.list', tries.map(([k, n]) => { const [tid, ck] = k.split('|'); return h('div.row.between', h('span', cellName(getTrick(tid).name, ck)), h('b', `${n}×`)); }))] : null,
    ]);
    App.afterChange();
    this.render();
  },

  /* ---------- Karte ---------- */
  mountMap(el, crew, spots) {
    if (typeof L === 'undefined') return;
    if (this.map) { this.map.remove(); this.map = null; }
    const map = L.map(el, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    this.map = map;
    const pts = spots.map((s) => [s.lat, s.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 15 });
    else if (this.myPos) map.setView([this.myPos.lat, this.myPos.lng], 14);
    else map.setView([51.16, 10.45], 5);
    for (const s of spots) {
      const icon = L.divIcon({ className: 'spot-pin', html: `<span><b>${spotType(s.type)[1]}</b></span>`, iconSize: [34, 34], iconAnchor: [17, 32] });
      L.marker([s.lat, s.lng], { icon }).addTo(map).on('click', () => this.spot(crew, s.id));
    }
    if (this.myPos) L.circleMarker([this.myPos.lat, this.myPos.lng], { radius: 7, color: '#fff', fillColor: '#27b6ff', fillOpacity: 1, weight: 2 }).addTo(map);
    map.on('contextmenu', (e) => this.addSpot(crew, { lat: e.latlng.lat, lng: e.latlng.lng }));
    setTimeout(() => map.invalidateSize(), 120);
  },

  locate(center = false) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { UI.toast('Kein GPS verfügbar', { kind: 'bad' }); return resolve(null); }
      navigator.geolocation.getCurrentPosition((p) => {
        this.myPos = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (center && this.map) this.map.setView([this.myPos.lat, this.myPos.lng], 15);
        resolve(this.myPos);
      }, () => { UI.toast('Standort nicht verfügbar', { icon: '📍', kind: 'bad' }); resolve(null); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
  },

  async addSpot(crew, pos) {
    if (!pos) {
      pos = await this.locate();
      if (!pos && this.map) { const c = this.map.getCenter(); pos = { lat: c.lat, lng: c.lng }; UI.toast('Kein GPS – Spot wird in der Kartenmitte gesetzt', { icon: '📍' }); }
      if (!pos) return;
    }
    let photo = null;
    UI.sheet('Neuer Spot', (close) => {
      const name = h('input', { placeholder: 'Name, z.B. „Bowl am Hafen“' });
      const type = h('select', SPOT_TYPES.map(([id, ic, l]) => h('option', { value: id }, ic, ' ', l)));
      const desc = h('textarea', { rows: 2, placeholder: 'Was gibt’s da? Ledges, Rail, Boden …' });
      const pBox = h('div.media-row');
      const drawP = () => fill(pBox, photo ? Media.thumb(photo) : null, h('button.media.add', { onclick: async () => { photo = await Media.pick('image'); drawP(); } }, '📷', h('small', 'Foto')));
      drawP();
      return [
        h('label.field', h('span', 'Name'), name), h('label.field', h('span', 'Art'), type), h('label.field', h('span', 'Beschreibung'), desc),
        h('div.field', h('span', 'Foto'), pBox),
        h('p.muted.small', `📍 ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`),
        h('div.row.end', h('button.btn', {
          onclick: () => {
            if (!name.value.trim()) return UI.toast('Name fehlt');
            const id = uid(10);
            crew.docs.put('spot', id, { id, name: name.value.trim(), type: type.value, desc: desc.value.trim(), lat: pos.lat, lng: pos.lng, photo, by: Me.id, ts: Date.now() });
            crew.post({ type: 'spot', name: name.value.trim(), media: photo ? [photo] : [] });
            close(); App.afterChange(); this.render();
          },
        }, 'Speichern')),
      ];
    });
  },

  spotRow(crew, s) {
    const r = this.rating(crew, s.id);
    return h('button.spot-row', { onclick: () => this.spot(crew, s.id) },
      h('span.spot-ic', spotType(s.type)[1]),
      h('div.grow', h('b', s.name), h('small.muted', spotType(s.type)[2], r.n ? ` · ${'★'.repeat(Math.round(r.avg))} (${r.n})` : '', this.myPos ? ` · ${fmtDist(geoDist(this.myPos, s))}` : '')),
      s.photo && h('img.spot-thumb', { src: s.photo.thumb, alt: '' }));
  },

  rating(crew, sid) {
    const rs = crew.docs.all('rate').filter((r) => r.s === sid && r.r);
    return { n: rs.length, avg: rs.length ? sum(rs.map((r) => r.r)) / rs.length : 0, mine: rs.find((r) => r.u === Me.id)?.r || 0 };
  },

  /** Tricks, die an diesem Spot gestanden wurden (alle Mitglieder) */
  tricksAt(crew, sid) {
    const out = [];
    for (const m of crew.members()) {
      for (const [tid, log] of Object.entries(crew.logsOf(m.id))) {
        for (const [ck, c] of Object.entries(log.cells || {})) if (c.s >= 2 && c.spot?.id === sid) out.push({ m, tid, ck, ts: c.h?.[2] || 0 });
      }
    }
    return out.sort((a, b) => b.ts - a.ts);
  },

  spot(crew, sid) {
    UI.sheet('Spot', (close, body) => {
      const draw = () => {
        const s = crew.docs.data('spot', sid); if (!s) return close();
        const r = this.rating(crew, sid);
        const tricks = this.tricksAt(crew, sid);
        fill(body,
          h('h2', spotType(s.type)[1], ' ', s.name), h('p.muted', spotType(s.type)[2], ' · eingetragen von ', crew.member(s.by).name),
          s.photo && h('div.media-row', Media.thumb(s.photo, { big: true })),
          s.desc && h('p', s.desc),
          h('div.stars', [1, 2, 3, 4, 5].map((n) => h('button', { class: n <= (r.mine || 0) ? 'on' : '', onclick: () => { crew.docs.put('rate', `${sid}~${Me.id}`, { s: sid, u: Me.id, r: n }); draw(); } }, '★')),
            h('small.muted', r.n ? ` Ø ${r.avg.toFixed(1)} (${r.n})` : ' noch keine Bewertung')),
          h('div.row.wrap',
            h('button.btn', { onclick: () => { Session.start(s); close(); this.render(); UI.toast('Session gestartet', { icon: '🛹' }); } }, '▶ Session hier'),
            h('a.btn.ghost', { href: `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=18/${s.lat}/${s.lng}`, target: '_blank', rel: 'noopener' }, '🧭 Route'),
            s.by === Me.id && h('button.btn.ghost.danger', { onclick: async () => { if (await UI.confirm(`Spot „${s.name}“ löschen?`, { ok: 'Löschen', danger: true })) { crew.docs.remove('spot', sid); close(); this.render(); } } }, '🗑')),
          h('h3', `Hier gestanden (${tricks.length})`),
          tricks.length ? h('div.list', tricks.slice(0, 40).map((x) => h('div.who-row', UI.avatar(x.m, 26), h('span', h('b', x.m.name), ' – ', cellName(getTrick(x.tid).name, x.ck)), h('small.muted', ' ', x.ts ? fmtDate(x.ts) : '')))) : h('p.muted', 'Noch nichts – sei der Erste!'),
        );
      };
      draw();
    }, { onClose: () => this.render() });
  },
};
Nav.register('spots', SpotsView);
