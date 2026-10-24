/* Kleine Helfer: DOM, Storage, Zeit, Dateien. Keine Abhängigkeiten. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Element-Builder: h('div.card#id', {onclick, dataset:{a:1}}, 'text', child) */
function h(spec, attrs, ...kids) {
  const m = /^([a-z0-9-]*)((?:[.#][\w-]+)*)$/i.exec(spec) || [];
  const el = document.createElement(m[1] || 'div');
  (m[2] || '').replace(/([.#])([\w-]+)/g, (_, k, v) => {
    if (k === '.') el.classList.add(v); else el.id = v;
  });
  if (attrs && (attrs.nodeType || typeof attrs !== 'object' || Array.isArray(attrs))) {
    kids.unshift(attrs); attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.classList.add(...String(v).split(' ').filter(Boolean));
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false || kid === 0) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** root leeren und Kinder einsetzen (null/false/0 werden übersprungen) */
const fill = (root, ...kids) => root.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false && k !== 0));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const uid = (n = 9) => Array.from(crypto.getRandomValues(new Uint8Array(n)),
  (b) => (b % 36).toString(36)).join('');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sum = (arr) => arr.reduce((s, x) => s + x, 0);
const DAY = 864e5;

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------- Persistenz (try/catch, falls Storage gesperrt ist) ---------- */
const LS = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
  },
  del(key) { try { localStorage.removeItem(key); } catch { /* ignorieren */ } },
};

/* ---------- Kleiner Event-Emitter ---------- */
class Emitter {
  #h = new Map();
  on(ev, fn) { (this.#h.get(ev) || this.#h.set(ev, new Set()).get(ev)).add(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this.#h.get(ev)?.delete(fn); }
  emit(ev, ...a) { this.#h.get(ev)?.forEach((fn) => { try { fn(...a); } catch (e) { console.error(ev, e); } }); }
}

/* ---------- Geo ---------- */
function geoDist(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const dp = r(b.lat - a.lat), dl = r(b.lng - a.lng);
  const x = Math.sin(dp / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dl / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(x)));
}
function fmtDist(m) {
  if (m == null || !isFinite(m)) return '–';
  return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',') + ' km';
}

/* ---------- Zeit ---------- */
const fmtDate = (ts) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateShort = (ts) => new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (ts) => `${fmtDate(ts)}, ${fmtTime(ts)}`;
function fmtAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return 'gerade eben';
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  if (s < 86400 * 7) { const d = Math.round(s / 86400); return d === 1 ? 'gestern' : `vor ${d} Tagen`; }
  return fmtDate(ts);
}
/** "noch 3 Tage" / "noch 5 Std." / "abgelaufen" */
function fmtLeft(ts) {
  const s = (ts - Date.now()) / 1000;
  if (s <= 0) return 'abgelaufen';
  if (s < 3600) return `noch ${Math.ceil(s / 60)} Min.`;
  if (s < 86400) return `noch ${Math.ceil(s / 3600)} Std.`;
  const d = Math.ceil(s / 86400);
  return d === 1 ? 'noch 1 Tag' : `noch ${d} Tage`;
}
function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} Min.`;
  if (m < 60 * 48) return `${Math.floor(m / 60)} Std. ${m % 60 ? (m % 60) + ' Min.' : ''}`.trim();
  return `${Math.round(m / 1440)} Tage`;
}
const fmtNum = (n) => Math.round(n).toLocaleString('de-DE');

/* ---------- Dateien / Bilder ---------- */
const blobToDataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
});
const dataUrlToBlob = async (url) => (await fetch(url)).blob();
const b64 = {
  enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); },
  dec(str) { const s = atob(str); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; },
  /** URL-sicher (für Links und QR-Codes) */
  encUrl(bytes) { return b64.enc(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decUrl(str) { const s = str.replace(/-/g, '+').replace(/_/g, '/'); return b64.dec(s + '==='.slice((s.length + 3) % 4)); },
};

/** Text komprimieren (deflate) -> URL-sicheres Base64. Ohne CompressionStream unkomprimiert. */
async function packText(text) {
  const raw = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'undefined') return 'u' + b64.encUrl(raw);
  const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  return 'z' + b64.encUrl(new Uint8Array(buf));
}
async function unpackText(str) {
  const bytes = b64.decUrl(str.slice(1));
  if (str[0] === 'u') return new TextDecoder().decode(bytes);
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  return new TextDecoder().decode(buf);
}

/** Bild verkleinern -> JPEG-Blob. Beachtet EXIF-Rotation. */
async function resizeImage(file, maxSide, quality = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), hh = Math.max(1, Math.round(bmp.height * k));
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: hh });
  cv.getContext('2d').drawImage(bmp, 0, 0, w, hh);
  bmp.close?.();
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', quality));
  return { blob, w, h: hh };
}

function download(filename, text, mime = 'application/json') {
  const blob = text instanceof Blob ? text : new Blob([text], { type: mime });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** Datei-Auswahl als Promise */
function pickFile(accept, { capture } = {}) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
    if (capture) inp.setAttribute('capture', capture);
    inp.onchange = () => { resolve(inp.files[0] || null); inp.remove(); };
    document.body.append(inp); inp.click();
  });
}

const COLORS = ['#ff3d7f', '#ff8c42', '#ffd23f', '#7bd957', '#3dffb4', '#27b6ff', '#5b7cff', '#a66bff', '#ff6bd6', '#e8e4da'];
const AVATARS = ['🛹', '🔥', '😎', '🤘', '🦊', '🐒', '🦈', '👽', '🐸', '🦉', '🐙', '💀', '🌵', '⚡', '🍕', '🎧'];

/* Mehrere Profile im selben Browser (zum Testen): ?profile=b */
const PROFILE = (new URLSearchParams(location.search).get('profile') || '').replace(/[^\w-]/g, '');
const LS_PREFIX = 'ld:' + (PROFILE ? PROFILE + ':' : '');
