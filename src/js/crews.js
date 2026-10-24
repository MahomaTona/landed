/* Crews: Du kannst in mehreren Crews sein. Jede Crew hat eigenen Schlüssel, Bus, Mesh und Dokumente.
   Deine persönlichen Trick-Logs werden in jede deiner Crews gespiegelt.

   Dokument-Arten pro Crew:
     member  <uid>            Profil, XP, Level
     log     <uid>~<trickId>  Trick-Log eines Mitglieds
     trick   <id>             eigene Tricks (für die Namen bei den anderen)
     post    <id>             Feed-Eintrag      react <post>~<uid>   Reaktion      cmt <id>   Kommentar
     skate   <id>             S.K.A.T.E.-Partie skmove <id>          Zug (Vorsetzen / Nachstehen)
     chal    <id>             Challenge         chalent <chal>~<uid> Stand eines Mitglieds
     spot    <id>             Spot              rate <spot>~<uid>    Bewertung
     sess    <uid>            laufende/letzte Session
     info    crew             Crew-Name, Beschreibung */

class Crew extends Emitter {
  constructor(info) {
    super();
    this.code = Cipher.norm(info.code);
    this.pin = info.pin || '';
    this.joined = info.joined || Date.now();
    this.cipher = new Cipher();
    this.docs = new DocStore();
    this.presence = new Map();   // uid -> zuletzt gesehen
    this.net = null; this.mesh = null; this.blobs = null;
  }

  get name() { return this.docs.data('info', 'crew')?.name || this.code; }
  get id() { return this.cipher.rid; }

  async start() {
    await this.cipher.init(this.code, this.pin);
    this.net = new Net(this.cipher, Me.id);
    this.docs.init(this.net, this.cipher.rid, Me.id);
    this.mesh = new Mesh(this.net);
    this.blobs = new CrewBlobs(this.net);
    this.net.on('ev', ([name], obj, own) => {
      if (own || name !== 'hi') return;
      const isNew = !this.online(obj.f);
      this.presence.set(obj.f, Date.now());
      this.mesh.seen(obj.f);
      if (isNew) { this.emit('presence'); this.hello(); }
    });
    this.net.on('link', () => { this.hello(); this.emit('presence'); });
    this.net.on('unlink', () => this.emit('presence'));
    this.net.on('status', (s) => this.emit('status', s));
    this.docs.on('change', (...a) => this.emit('change', ...a));
    this.net.start();
    this.publishMe();
    this.hello();
    this.helloT = setInterval(() => this.hello(), 25000);
  }

  stop() { clearInterval(this.helloT); this.blobs?.destroy(); this.mesh?.destroy(); this.net?.stop(); this.docs.destroy(); }

  hello() { this.net?.send('ev/hi', { n: Me.profile.name }, { broker: true }); }
  online(u) { return u === Me.id || Date.now() - (this.presence.get(u) || 0) < 70000 || this.net?.linked(u); }

  /* ---------- eigene Daten spiegeln ---------- */
  publishMe() {
    const xp = xpOfLogs(Me.logs);
    const m = { ...Me.profile, xp, badges: Object.keys(Me.badges).length };
    const cur = this.docs.data('member', Me.id);
    if (!cur || JSON.stringify(cur) !== JSON.stringify(m)) this.docs.put('member', Me.id, m);
    for (const tid of Object.keys(Me.logs)) this.publishLog(tid);
    for (const t of Object.values(Me.custom)) if (!this.docs.get('trick', t.id)) this.docs.put('trick', t.id, t);
  }
  publishLog(tid) {
    const id = `${Me.id}~${tid}`;
    const log = Me.logs[tid];
    if (!log || !Object.keys(log.cells).length) { if (this.docs.get('log', id)) this.docs.remove('log', id); return; }
    const d = { u: Me.id, t: tid, cells: log.cells };
    const cur = this.docs.data('log', id);
    if (!cur || JSON.stringify(cur) !== JSON.stringify(d)) this.docs.put('log', id, d);
  }

  /** Feed-Eintrag nur in dieser Crew (z.B. Spiele) */
  post(p) { const id = uid(10); this.docs.put('post', id, { id, u: Me.id, ts: Date.now(), ...p }); return id; }

  /* ---------- Abfragen ---------- */
  members() { return this.docs.all('member').sort((a, b) => (b.xp || 0) - (a.xp || 0)); }
  member(u) { return this.docs.data('member', u) || (u === Me.id ? Me.profile : { id: u, name: 'Unbekannt', avatar: '❔', color: '#888' }); }
  logsOf(u) {
    if (u === Me.id) return Me.logs;
    const out = {};
    for (const l of this.docs.all('log')) if (l.u === u) out[l.t] = { cells: l.cells };
    return out;
  }
  posts() { return this.docs.all('post').sort((a, b) => b.ts - a.ts); }
  reactions(pid) { return this.docs.list('react').filter((d) => d.d.p === pid && d.d.e).map((d) => d.d); }
  comments(pid) { return this.docs.all('cmt').filter((c) => c.p === pid).sort((a, b) => a.ts - b.ts); }
  sessions() { return this.docs.all('sess').filter((s) => !s.end && Date.now() - s.start < 10 * 3600e3); }
}

const Crews = Object.assign(new Emitter(), {
  map: new Map(),       // code -> Crew
  activeCode: '',
  _key: LS_PREFIX + 'crews',

  list() { return [...this.map.values()]; },

  async boot() {
    const saved = LS.get(this._key, { crews: [], active: '' });
    for (const info of saved.crews) await this._start(info);
    this.activeCode = saved.active;
  },
  _persist() { LS.set(this._key, { crews: this.list().map((c) => ({ code: c.code, pin: c.pin, joined: c.joined })), active: this.activeCode }); },

  async _start(info) {
    const c = new Crew(info);
    this.map.set(c.code, c);
    await c.start();
    c.on('change', (kind, id, doc, src) => this.emit('change', c, kind, id, doc, src));
    c.on('presence', () => this.emit('presence', c));
    c.on('status', () => this.emit('status', c));
    return c;
  },

  async join(code, pin, name) {
    code = Cipher.norm(code);
    if (!code) throw new Error('Crew-Code fehlt');
    let c = this.map.get(code);
    if (!c) {
      c = await this._start({ code, pin });
      if (name && !c.docs.get('info', 'crew')) setTimeout(() => { if (!c.docs.get('info', 'crew')) c.docs.put('info', 'crew', { name }); }, 2500);
    }
    this.activeCode = code;
    this._persist();
    this.emit('list');
    return c;
  },
  leave(code) {
    const c = this.map.get(code); if (!c) return;
    c.docs.remove('member', Me.id);
    setTimeout(() => { c.stop(); LS.del(c.docs.key); }, 800);
    this.map.delete(code);
    if (this.activeCode === code) this.activeCode = this.list()[0]?.code || '';
    this._persist();
    this.emit('list');
  },
  select(code) { this.activeCode = code; this._persist(); this.emit('list'); },

  /* ---------- an alle Crews ---------- */
  publishLog(tid) { for (const c of this.list()) c.publishLog(tid); },
  publishMe() { for (const c of this.list()) c.publishMe(); },
  /** Feed-Eintrag in allen Crews (gleiche id) */
  post(p) {
    const id = uid(10);
    const d = { id, u: Me.id, ts: Date.now(), ...p };
    for (const c of this.list()) c.docs.put('post', id, d);
    return id;
  },
  customTrick(id) { for (const c of this.list()) { const t = c.docs.data('trick', id); if (t) return t; } return null; },

  /** Zusatzwerte für Badges (Spiele, Sessions, Spots) über alle Crews */
  extraStats(u) {
    const x = { skateWins: 0, chalWins: 0, sessions: 0, spots: 0 };
    for (const c of this.list()) {
      for (const g of c.docs.all('skate')) { const st = skateState(c, g); if (st.done && st.winner === u) x.skateWins++; }
      for (const ch of c.docs.all('chal')) { const r = chalState(c, ch); if (r.done && r.winner === u) x.chalWins++; }
      x.spots += c.docs.all('spot').filter((s) => s.by === u).length;
    }
    x.sessions = (LS.get(LS_PREFIX + 'sesscount', 0) || 0);
    return x;
  },
});

Object.defineProperty(Crews, 'active', { get() { return this.map.get(this.activeCode) || this.list()[0] || null; } });

/* =====================================================================
   Game of S.K.A.T.E. (Langzeit, remote per Video)
   - Partie: Spieler-Reihenfolge, Wort, Tage pro Runde
   - Zug "set": Vorsetzer stellt Trick + Clip ein (Ehrensache: nur was man gestanden hat)
   - Zug "resp": jeder andere aktive Spieler steht nach (Clip Pflicht) oder gibt auf
   - Frist abgelaufen ohne Antwort = Buchstabe; Vorsetzer verpasst seine Frist = Zug geht weiter
   - Bekommt jemand einen Buchstaben, setzt derselbe Vorsetzer nochmal vor, sonst ist der Nächste dran
   - Datenmodell hat "teams" schon vorgesehen (Crew gegen Crew)
   ===================================================================== */
function skateState(crew, g, now = Date.now()) {
  const word = g.word || 'SKATE';
  const span = (g.days || 7) * DAY;
  const moves = crew.docs.all('skmove').filter((m) => m.g === g.id);
  const letters = Object.fromEntries(g.players.map((p) => [p, 0]));
  const out = new Set();
  const rounds = [];
  let setterIdx = 0, start = g.start, r = 0;
  const active = () => g.players.filter((p) => !out.has(p));
  const nextIdx = (i) => { for (let k = 1; k <= g.players.length; k++) { const j = (i + k) % g.players.length; if (!out.has(g.players[j])) return j; } return i; };

  for (let guard = 0; guard < 500; guard++, r++) {
    if (active().length <= 1) break;
    if (out.has(g.players[setterIdx])) setterIdx = nextIdx(setterIdx);
    const setter = g.players[setterIdx];
    const set = moves.find((m) => m.type === 'set' && m.round === r && m.u === setter && m.ts <= start + span);
    if (!set) {
      if (now > start + span) { rounds.push({ r, setter, skipped: true, start, end: start + span }); start += span; setterIdx = nextIdx(setterIdx); continue; }
      return finish({ phase: 'set', round: r, setter, deadline: start + span });
    }
    const deadline = set.ts + span;
    const responders = active().filter((p) => p !== setter);
    const resp = {};
    for (const p of responders) {
      const m = moves.filter((x) => x.type === 'resp' && x.round === r && x.u === p && x.ts <= deadline).sort((a, b) => a.ts - b.ts)[0];
      if (m) resp[p] = m;
    }
    const allIn = responders.every((p) => resp[p]);
    if (!allIn && now <= deadline) return finish({ phase: 'resp', round: r, setter, set, resp, responders, deadline });
    let missed = false;
    for (const p of responders) {
      if (!resp[p] || !resp[p].ok) { letters[p]++; missed = true; if (letters[p] >= word.length) out.add(p); }
    }
    const end = allIn ? Math.max(...responders.map((p) => resp[p].ts)) : deadline;
    rounds.push({ r, setter, set, resp, responders, start, end, missed });
    start = end;
    if (!missed) setterIdx = nextIdx(setterIdx);
  }
  return finish({ phase: 'done' });

  function finish(cur) {
    const alive = active();
    const done = cur.phase === 'done' || alive.length <= 1 || g.ended;
    return { ...cur, word, letters, out, rounds, done, winner: done && alive.length === 1 ? alive[0] : null, alive };
  }
}
const skateLetters = (word, n) => word.slice(0, n);

/* ---------- Challenges ----------
   kind 'first': Wer steht den Trick (Zelle) zuerst nach Start? (automatisch aus den Logs)
   kind 'count': Wer schafft bis zum Ende am meisten / zuerst n Wiederholungen (Mitglieder zählen selbst) */
function chalState(crew, ch, now = Date.now()) {
  const members = crew.members().map((m) => m.id);
  const rows = [];
  if (ch.kind === 'first') {
    for (const u of members) {
      const c = crew.logsOf(u)[ch.trick]?.cells?.[ch.cell];
      const ts = c?.h?.[2];
      if (c && c.s >= 2 && ts && ts >= ch.start && ts <= ch.end) rows.push({ u, ts, n: 1 });
    }
    rows.sort((a, b) => a.ts - b.ts);
  } else {
    for (const e of crew.docs.all('chalent')) if (e.c === ch.id && e.n > 0) rows.push({ u: e.u, n: e.n, ts: e.ts });
    rows.sort((a, b) => b.n - a.n || a.ts - b.ts);
  }
  const reached = ch.kind === 'count' && ch.n ? rows.find((x) => x.n >= ch.n) : null;
  const done = now > ch.end || (ch.kind === 'first' && rows.length > 0) || !!reached;
  return { rows, done, winner: done ? (reached?.u || rows[0]?.u || null) : null };
}
