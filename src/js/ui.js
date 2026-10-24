/* UI-Bausteine: Toasts, Sheets (Dialoge von unten), Bestätigung, Navigation, Benachrichtigungen. */

const UI = {
  toast(msg, { icon = '', ms = 2600, kind = '' } = {}) {
    const el = h('div.toast', { class: kind }, icon && h('span.ti', icon), h('span', msg));
    $('#toasts').append(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms);
  },

  /** Sheet öffnen. build(close) liefert den Inhalt. Rückgabe: { el, close } */
  sheet(title, build, { wide = false, onClose } = {}) {
    const back = h('div.sheet-back');
    const body = h('div.sheet-body');
    const box = h('div.sheet', { class: wide ? 'wide' : '' },
      h('div.sheet-grip'),
      h('div.sheet-head', h('h2', title), h('button.icon-btn', { onclick: () => close(), title: 'Schließen', 'aria-label': 'Schließen' }, '✕')),
      body);
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      box.classList.remove('in'); back.classList.remove('in');
      setTimeout(() => { back.remove(); box.remove(); }, 250);
      onClose?.();
    };
    back.onclick = close;
    // nach unten wischen schließt
    let y0 = null;
    const grip = box.querySelector('.sheet-grip');
    grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; grip.setPointerCapture(e.pointerId); });
    grip.addEventListener('pointerup', (e) => { if (y0 != null && e.clientY - y0 > 60) close(); y0 = null; });
    document.body.append(back, box);
    const res = build(close, body);
    if (res) fill(body, res);
    requestAnimationFrame(() => { back.classList.add('in'); box.classList.add('in'); });
    return { el: box, body, close };
  },

  confirm(text, { ok = 'OK', danger = false } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const s = this.sheet('Sicher?', (close) => [
        h('p.lead', text),
        h('div.row.end',
          h('button.btn.ghost', { onclick: () => { done = true; resolve(false); close(); } }, 'Abbrechen'),
          h('button.btn', { class: danger ? 'danger' : '', onclick: () => { done = true; resolve(true); close(); } }, ok)),
      ], { onClose: () => { if (!done) resolve(false); } });
      return s;
    });
  },

  /** Kleines Formular: fields = [{key, label, type, value, options, placeholder}] */
  form(title, fields, { ok = 'Speichern' } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const inputs = {};
      this.sheet(title, (close) => [
        ...fields.map((f) => {
          let inp;
          if (f.type === 'select') inp = h('select', f.options.map(([v, l]) => h('option', { value: v, selected: v === f.value }, l)));
          else if (f.type === 'textarea') inp = h('textarea', { rows: 3, placeholder: f.placeholder || '', value: f.value ?? '' });
          else inp = h('input', { type: f.type || 'text', placeholder: f.placeholder || '', value: f.value ?? '', min: f.min, max: f.max });
          inputs[f.key] = inp;
          return h('label.field', h('span', f.label), inp);
        }),
        h('div.row.end',
          h('button.btn.ghost', { onclick: () => close() }, 'Abbrechen'),
          h('button.btn', {
            onclick: () => {
              const out = {};
              for (const [k, el] of Object.entries(inputs)) out[k] = el.type === 'number' ? +el.value : el.value.trim();
              done = true; resolve(out); close();
            },
          }, ok)),
      ], { onClose: () => { if (!done) resolve(null); } });
      setTimeout(() => Object.values(inputs)[0]?.focus(), 260);
    });
  },

  avatar(m, size = 36) {
    return h('span.avatar', { style: { '--c': m?.color || '#888', width: size + 'px', height: size + 'px', fontSize: size * 0.55 + 'px' }, title: m?.name || '' }, m?.avatar || '❔');
  },

  stageChip(stage) {
    const s = STAGES[stage] || STAGES[0];
    return h('span.stage', { dataset: { s: stage } }, s.icon, ' ', s.name);
  },

  /** Fortschrittsring (SVG) */
  ring(frac, label, size = 44) {
    const r = 18, c = 2 * Math.PI * r;
    return h('span.ring', {
      style: { width: size + 'px', height: size + 'px' },
      html: `<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="${r}" class="ring-bg"/><circle cx="22" cy="22" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - clamp(frac, 0, 1))}"/></svg><b>${esc(label)}</b>`,
    });
  },

  empty(icon, text, action) { return h('div.empty', h('div.empty-icon', icon), h('p', text), action); },

  /* ---------- Benachrichtigungen ---------- */
  _audio: null,
  beep(kind = 'ok') {
    if (!Me.settings.sound) return;
    try {
      this._audio = this._audio || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this._audio, t = ctx.currentTime;
      const notes = kind === 'land' ? [523, 659, 784, 1046] : kind === 'bad' ? [330, 247] : [660, 880];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.22);
        o.connect(g).connect(ctx.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.25);
      });
    } catch { /* kein Audio */ }
  },
  vibrate(p = [60]) { if (Me.settings.vibrate) navigator.vibrate?.(p); },

  async notify(title, body, { tag } = {}) {
    this.toast(body ? `${title}: ${body}` : title, { icon: '🔔', ms: 3800 });
    this.beep(); this.vibrate([40, 60, 40]);
    if (!Me.settings.notify || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) reg.showNotification(title, { body, tag, icon: 'icon.svg', badge: 'icon.svg' });
      else new Notification(title, { body, tag, icon: 'icon.svg' });
    } catch { /* egal */ }
  },
  async askNotify() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'default') await Notification.requestPermission();
    return Notification.permission === 'granted';
  },

  /** Konfetti für gestandene Tricks */
  confetti() {
    const box = h('div.confetti');
    for (let i = 0; i < 40; i++) {
      box.append(h('i', { style: { left: Math.random() * 100 + '%', background: randomOf(COLORS), animationDelay: Math.random() * 0.3 + 's', '--dx': (Math.random() * 200 - 100) + 'px', '--r': Math.random() * 720 + 'deg' } }));
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 2200);
  },
};

/* ---------- Navigation (Tabs unten) ---------- */
const Nav = Object.assign(new Emitter(), {
  tab: 'tricks',
  views: {},
  register(id, view) { this.views[id] = view; },
  go(tab) {
    this.tab = tab;
    $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + tab; });
    this.views[tab]?.render();
    $('#main').scrollTop = 0;
    this.emit('go', tab);
  },
  refresh(tab) { if (!tab || tab === this.tab) this.views[this.tab]?.render(); },
});
