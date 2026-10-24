/* Themes: Farben/Schriften in themes.css, hier Name, Szene und Hintergrund-Modus.
   Hintergrund: 'scene' (Illustration), 'none' (nur Farben) oder 'photo' (eigenes Bild aus IndexedDB). */

const THEMES = [
  { id: 'street', name: 'Street', icon: '🌃', desc: 'Beton, Nacht, Neon', color: '#111320' },
  { id: 'sunset', name: 'Sunset Bowl', icon: '🌴', desc: 'Kalifornien, 70er', color: '#3b1736' },
  { id: 'diy', name: 'DIY', icon: '🧱', desc: 'Unter der Brücke', color: '#26272b' },
  { id: 'retro', name: 'Retro 80s', icon: '📼', desc: 'VHS & Neon-Grid', color: '#0d0221' },
];

const Theme = {
  _photoUrl: null,
  async apply(id, bg) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    document.body.dataset.theme = t.id;
    document.body.dataset.bg = bg;
    $('meta[name="theme-color"]')?.setAttribute('content', t.color);
    const el = $('#bg');
    if (bg === 'scene') {
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SCENES[t.id]());
      el.style.backgroundImage = `url("${url}")`;
    } else if (bg === 'photo') {
      const rec = await IDB.get('misc', 'bgphoto');
      if (this._photoUrl) URL.revokeObjectURL(this._photoUrl);
      this._photoUrl = rec ? URL.createObjectURL(rec) : null;
      el.style.backgroundImage = this._photoUrl ? `url("${this._photoUrl}")` : '';
    } else el.style.backgroundImage = '';
  },
  async setPhoto(file) {
    const { blob } = await resizeImage(file, 1600, 0.8);
    await IDB.put('misc', 'bgphoto', blob);
  },
  preview(id) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SCENES[id]()); },
};
