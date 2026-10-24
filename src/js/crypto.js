/* Ende-zu-Ende-Verschlüsselung pro Crew: AES-GCM, Schlüssel aus Crew-Code (+ PIN) via PBKDF2.
   Broker und Mitleser sehen nur anonyme Topics und Chiffretext. */

class Cipher {
  constructor() {
    this.key = null;
    this.rid = '';        // anonyme Crew-ID für Topics
    this.secure = false;  // false, wenn SubtleCrypto fehlt (z.B. http:// im LAN) -> nur Obfuskation
  }

  static norm(code) { return String(code || '').trim().toLowerCase().replace(/\s+/g, '-'); }

  async init(code, pin) {
    const norm = Cipher.norm(code);
    const seed = new TextEncoder().encode(`ld1|${norm}|${pin || ''}`);
    this.secure = !!(window.crypto && crypto.subtle);
    if (!this.secure) { this.rid = Cipher.fnv(seed); this.key = null; return this; }
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', seed));
    this.rid = Array.from(hash.slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('');
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${pin || ''}|${norm}`), 'PBKDF2', false, ['deriveKey']);
    this.key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode(`landed|${norm}`), iterations: 120000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    );
    return this;
  }

  static fnv(bytes) {
    let x = 0x811c9dc5;
    for (const b of bytes) { x ^= b; x = Math.imul(x, 0x01000193) >>> 0; }
    return x.toString(16).padStart(8, '0') + bytes.length.toString(16);
  }

  /** Objekt -> kompakter Base64-Text */
  async seal(obj) {
    const data = new TextEncoder().encode(JSON.stringify(obj));
    if (!this.key) return 'p.' + b64.enc(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, data));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv); out.set(ct, 12);
    return 'e.' + b64.enc(out);
  }

  /** Text -> Objekt, oder null bei falschem Schlüssel / defekten Daten */
  async open(text) {
    try {
      const mode = text.slice(0, 2), raw = b64.dec(text.slice(2));
      if (mode === 'p.') return JSON.parse(new TextDecoder().decode(raw));
      if (!this.key) return null;
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, this.key, raw.slice(12));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch { return null; }
  }
}
