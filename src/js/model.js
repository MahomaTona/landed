/* Persönliche Daten (gehören dir, gelten in allen Crews): Profil, Trick-Logs, eigene Tricks, Badges, Einstellungen.
   Trick-Log je Trick: { cells: { "stance.obstacle": { s: Stufe, h: {Stufe: Zeitpunkt}, spot, media: [...], tries } } } */

const Me = Object.assign(new Emitter(), {
  profile: null,
  logs: {},       // trickId -> { cells }
  custom: {},     // trickId -> eigener Trick
  badges: {},     // badgeId -> Zeitpunkt
  settings: { theme: 'street', bg: 'scene', notify: true, sound: true, vibrate: true },
  _key: LS_PREFIX + 'me',

  load() {
    const d = LS.get(this._key, null);
    if (!d) return false;
    Object.assign(this, { profile: d.profile, logs: d.logs || {}, custom: d.custom || {}, badges: d.badges || {} });
    Object.assign(this.settings, d.settings || {});
    return !!this.profile;
  },
  save() {
    LS.set(this._key, { profile: this.profile, logs: this.logs, custom: this.custom, badges: this.badges, settings: this.settings });
  },
  create(name, avatar, color) {
    this.profile = { id: uid(10), name, avatar, color, created: Date.now() };
    this.save();
  },

  /* ---------- Tricks ---------- */
  cell(tid, ck) { return this.logs[tid]?.cells?.[ck] || null; },
  stage(tid, ck) { return this.cell(tid, ck)?.s || 0; },

  /** Stufe setzen. Rückgabe: true, wenn ein neuer Meilenstein (≥ gestanden) erreicht wurde. */
  setStage(tid, ck, stage, extra = {}) {
    const log = this.logs[tid] || (this.logs[tid] = { cells: {} });
    const c = log.cells[ck] || (log.cells[ck] = { s: 0, h: {}, media: [], tries: 0 });
    const prev = c.s;
    c.s = stage;
    const now = extra.ts || Date.now();
    if (stage > 0 && !c.h[stage]) c.h[stage] = now;
    if (stage >= 2 && !c.h[1]) c.h[1] = c.h[2] || now;
    for (const k of Object.keys(c.h)) if (+k > stage) delete c.h[k];   // Korrektur nach unten
    if (extra.spot) c.spot = extra.spot;
    if (extra.media?.length) c.media = [...(c.media || []), ...extra.media].slice(-8);
    if (stage === 0 && !c.media?.length && !c.tries) delete log.cells[ck];
    log.upd = Date.now();
    this.save();
    this.emit('log', tid, ck);
    return stage >= 2 && stage > prev;
  },
  addTry(tid, ck, n = 1) {
    const log = this.logs[tid] || (this.logs[tid] = { cells: {} });
    const c = log.cells[ck] || (log.cells[ck] = { s: 1, h: { 1: Date.now() }, media: [], tries: 0 });
    c.tries = Math.max(0, (c.tries || 0) + n);
    if (!c.s) { c.s = 1; c.h[1] = Date.now(); }
    log.upd = Date.now();
    this.save();
    this.emit('log', tid, ck);
  },

  addCustom(t) {
    const id = 'c_' + uid(8);
    this.custom[id] = { ...t, id, by: this.id, pre: t.pre || [], tip: t.tip || '', builtin: false };
    this.save();
    this.emit('custom', id);
    return id;
  },
  removeCustom(id) { delete this.custom[id]; delete this.logs[id]; this.save(); this.emit('custom', id); },
});

Object.defineProperty(Me, 'id', { get() { return this.profile?.id; } });

/** Trick nachschlagen: Katalog, eigene oder von Crew-Mitgliedern angelegte */
function getTrick(id) {
  return TRICKS.get(id) || Me.custom[id] || Crews.customTrick(id) || { id, name: 'Unbekannter Trick', diff: 3, cat: 'own', pre: [], tip: '' };
}
function allTricks() {
  const extra = new Map();
  for (const t of Object.values(Me.custom)) extra.set(t.id, t);
  for (const c of Crews.list()) for (const t of c.docs.all('trick')) if (!extra.has(t.id)) extra.set(t.id, t);
  return [...TRICK_LIST, ...extra.values()];
}

/* ---------- XP & Level ---------- */
const STAGE_MULT = { 2: 1, 3: 1.5, 4: 2 };
function cellXp(trick, ck, stage) {
  if (stage < 2) return 0;
  const { st, ob } = splitCell(ck);
  return Math.round(trick.diff * 10 * stanceOf(st).m * obstOf(ob).m * STAGE_MULT[stage]);
}
function xpOfLogs(logs) {
  let xp = 0;
  for (const [tid, log] of Object.entries(logs || {})) {
    const t = getTrick(tid);
    for (const [ck, c] of Object.entries(log.cells || {})) xp += cellXp(t, ck, c.s);
  }
  return xp;
}
const LEVEL_NAMES = [[1, 'Grom'], [3, 'Rookie'], [6, 'Local'], [10, 'Ripper'], [15, 'Shredder'], [21, 'Am'], [28, 'Pro'], [36, 'Legende']];
function levelOf(xp) {
  let lvl = 1, need = 100, rest = xp;
  while (rest >= need) { rest -= need; lvl++; need = Math.round(need * 1.22); }
  const title = [...LEVEL_NAMES].reverse().find(([l]) => lvl >= l)[1];
  return { lvl, title, into: rest, need, pct: rest / need };
}

/* ---------- Statistik über Logs (auch für andere Crew-Mitglieder) ---------- */
function statsOf(logs) {
  const s = { landed: 0, mastered: 0, practicing: 0, tricks: new Set(), cats: {}, stances: {}, obst: {}, events: [], maxDiff: 0, firstToLand: [] };
  for (const [tid, log] of Object.entries(logs || {})) {
    const t = getTrick(tid);
    for (const [ck, c] of Object.entries(log.cells || {})) {
      const { st, ob } = splitCell(ck);
      if (c.s === 1) s.practicing++;
      if (c.s >= 2) {
        s.landed++; s.tricks.add(tid);
        s.cats[t.cat] = (s.cats[t.cat] || 0) + 1;
        s.stances[st] = (s.stances[st] || 0) + 1;
        s.obst[ob] = (s.obst[ob] || 0) + 1;
        s.maxDiff = Math.max(s.maxDiff, t.diff);
        if (c.h?.[1] && c.h?.[2] && c.h[2] > c.h[1]) s.firstToLand.push(c.h[2] - c.h[1]);
      }
      if (c.s >= 4) s.mastered++;
      for (const [stg, ts] of Object.entries(c.h || {})) if (+stg >= 2) s.events.push({ ts, tid, ck, stage: +stg });
    }
  }
  s.events.sort((a, b) => a.ts - b.ts);
  return s;
}

/* ---------- Badges ---------- */
const BADGES = [
  { id: 'first', icon: '🐣', name: 'Erster Trick', desc: 'Den ersten Trick gestanden', test: (s) => s.landed >= 1 },
  { id: 'ollie', icon: '🦘', name: 'Abheben', desc: 'Ollie gestanden', test: (s, l) => has(l, 'ollie') },
  { id: 'kickflip', icon: '🌀', name: 'Erster Flip', desc: 'Kickflip gestanden', test: (s, l) => has(l, 'kickflip') },
  { id: 'heel', icon: '👠', name: 'Ferse frei', desc: 'Heelflip gestanden', test: (s, l) => has(l, 'heelflip') },
  { id: 'tre', icon: '🌳', name: 'Tre Bomb', desc: '360 Flip gestanden', test: (s, l) => has(l, 'treflip') },
  { id: 't10', icon: '🔟', name: 'Zehner', desc: '10 Tricks gestanden', test: (s) => s.landed >= 10 },
  { id: 't25', icon: '🎯', name: 'Viertelhundert', desc: '25 Tricks gestanden', test: (s) => s.landed >= 25 },
  { id: 't50', icon: '🏅', name: 'Fünfzig', desc: '50 Tricks gestanden', test: (s) => s.landed >= 50 },
  { id: 't100', icon: '💯', name: 'Hundert', desc: '100 Tricks gestanden', test: (s) => s.landed >= 100 },
  { id: 'grind5', icon: '⚙️', name: 'Metallfresser', desc: '5 Grinds gestanden', test: (s) => (s.cats.grind || 0) >= 5 },
  { id: 'slide5', icon: '🧈', name: 'Butterweich', desc: '5 Slides gestanden', test: (s) => (s.cats.slide || 0) >= 5 },
  { id: 'trans5', icon: '🌊', name: 'Bowl-Ratte', desc: '5 Rampen-Tricks gestanden', test: (s) => (s.cats.trans || 0) + (s.cats.grab || 0) >= 5 },
  { id: 'manual5', icon: '⚖️', name: 'Balance-Akt', desc: '5 Manual-Tricks gestanden', test: (s) => (s.cats.manual || 0) >= 5 },
  { id: 'switch5', icon: '🔀', name: 'Switch-Meister', desc: '5 Tricks Switch gestanden', test: (s) => (s.stances.switch || 0) >= 5 },
  { id: 'nollie5', icon: '👃', name: 'Nose first', desc: '5 Tricks Nollie gestanden', test: (s) => (s.stances.nollie || 0) >= 5 },
  { id: 'fakie5', icon: '↩️', name: 'Rückwärtsgang', desc: '5 Tricks Fakie gestanden', test: (s) => (s.stances.fakie || 0) >= 5 },
  { id: 'allst', icon: '🧭', name: 'Vier Himmelsrichtungen', desc: 'Einen Trick in allen 4 Stances', test: (s, l) => Object.values(l).some((g) => new Set(Object.entries(g.cells || {}).filter(([, c]) => c.s >= 2).map(([k]) => splitCell(k).st)).size === 4) },
  { id: 'rail', icon: '═', name: 'Rail-Bezwinger', desc: 'Ersten Trick auf einem Rail', test: (s) => (s.obst.rail || 0) >= 1 },
  { id: 'stairs', icon: '🪜', name: 'Treppenhaus', desc: '3 Tricks die Treppe runter', test: (s) => (s.obst.stairs || 0) >= 3 },
  { id: 'gap', icon: '🕳️', name: 'Gap-Jäger', desc: '3 Tricks über ein Gap', test: (s) => (s.obst.gap || 0) >= 3 },
  { id: 'master', icon: '👑', name: 'Meister', desc: 'Ersten Trick gemeistert', test: (s) => s.mastered >= 1 },
  { id: 'master10', icon: '🏆', name: 'Großmeister', desc: '10 Tricks gemeistert', test: (s) => s.mastered >= 10 },
  { id: 'hard', icon: '🧨', name: 'Hammer', desc: 'Trick mit Schwierigkeit 8+ gestanden', test: (s) => s.maxDiff >= 8 },
  { id: 'allcat', icon: '🌈', name: 'Allrounder', desc: 'In 6 Kategorien je ein Trick', test: (s) => Object.keys(s.cats).length >= 6 },
  { id: 'old', icon: '📼', name: 'Old School', desc: '3 Old-School-Tricks gestanden', test: (s) => (s.cats.old || 0) >= 3 },
  { id: 'own', icon: '🧪', name: 'Erfinder', desc: 'Eigenen Trick angelegt', test: () => Object.keys(Me.custom).length >= 1 },
  { id: 'skate1', icon: '🛹', name: 'S.K.A.T.E.-Sieger', desc: 'Ein Game of S.K.A.T.E. gewonnen', test: (s, l, x) => x.skateWins >= 1 },
  { id: 'skate5', icon: '🦁', name: 'Unbesiegbar', desc: '5 Games of S.K.A.T.E. gewonnen', test: (s, l, x) => x.skateWins >= 5 },
  { id: 'chal1', icon: '⚡', name: 'Challenger', desc: 'Eine Crew-Challenge gewonnen', test: (s, l, x) => x.chalWins >= 1 },
  { id: 'sess10', icon: '📅', name: 'Stammgast', desc: '10 Sessions getrackt', test: (s, l, x) => x.sessions >= 10 },
  { id: 'spot', icon: '📍', name: 'Spot-Scout', desc: 'Ersten Spot eingetragen', test: (s, l, x) => x.spots >= 1 },
];
function has(logs, tid) { return Object.values(logs[tid]?.cells || {}).some((c) => c.s >= 2); }

/** Neue Badges prüfen; Rückgabe: Liste neu verdienter Badges */
function checkBadges() {
  if (!Me.profile) return [];
  const s = statsOf(Me.logs), x = Crews.extraStats(Me.id), fresh = [];
  for (const b of BADGES) {
    if (Me.badges[b.id]) continue;
    let ok = false;
    try { ok = b.test(s, Me.logs, x); } catch { ok = false; }
    if (ok) { Me.badges[b.id] = Date.now(); fresh.push(b); }
  }
  if (fresh.length) Me.save();
  return fresh;
}
