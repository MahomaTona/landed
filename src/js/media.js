/* Media: Foto/Video-Beweise aufnehmen, verkleinern, Vorschau erzeugen und anzeigen.
   Im Dokument steht nur { id, type, thumb (kleines JPEG), w, h, dur } – das Original holt sich jeder bei Bedarf. */

const MAX_VIDEO_S = 15.5, MAX_VIDEO_BYTES = 6 * 1024 * 1024;

const Media = {
  /** Datei wählen/aufnehmen. kind: 'video' | 'image' | 'any'. Rückgabe: Media-Referenz oder null */
  async pick(kind = 'any', { capture = false } = {}) {
    const accept = kind === 'video' ? 'video/*' : kind === 'image' ? 'image/*' : 'image/*,video/*';
    const file = await pickFile(accept, { capture: capture ? 'environment' : null });
    if (!file) return null;
    try { return await this.ingest(file); }
    catch (e) { UI.toast(e.message || 'Datei konnte nicht gelesen werden', { icon: '⚠️', kind: 'bad', ms: 4200 }); return null; }
  },

  async ingest(file) {
    if (file.type.startsWith('video/')) return this._video(file);
    if (file.type.startsWith('image/')) return this._image(file);
    throw new Error('Nur Fotos und Videos');
  },

  async _image(file) {
    const { blob, w, h: hh } = await resizeImage(file, 1600, 0.82);
    const { blob: tb } = await resizeImage(blob, 360, 0.6);
    const id = 'm' + uid(12);
    await BlobStore.save(id, blob);
    return { id, type: 'img', thumb: await blobToDataUrl(tb), w, h: hh, ts: Date.now() };
  },

  _loadVideo(src) {
    return new Promise((res, rej) => {
      const v = h('video', { muted: true, playsInline: true, preload: 'auto', src });
      v.onloadedmetadata = () => res(v);
      v.onerror = () => rej(new Error('Video kann nicht abgespielt werden'));
    });
  },

  async _video(file) {
    const src = URL.createObjectURL(file);
    try {
      const v = await this._loadVideo(src);
      const dur = v.duration;
      if (!isFinite(dur) || dur > MAX_VIDEO_S) throw new Error(`Clip ist ${Math.round(dur)} s lang – maximal 15 s. Bitte vorher kürzen.`);
      // Vorschaubild aus der Mitte
      await new Promise((r) => { v.onseeked = r; v.currentTime = Math.min(dur / 2, 1.2); });
      const k = Math.min(1, 360 / Math.max(v.videoWidth, v.videoHeight));
      const cv = h('canvas', { width: Math.round(v.videoWidth * k), height: Math.round(v.videoHeight * k) });
      cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
      const thumb = cv.toDataURL('image/jpeg', 0.6);
      let blob = file;
      if (file.size > MAX_VIDEO_BYTES || Math.max(v.videoWidth, v.videoHeight) > 1280) blob = await this._shrink(v, dur);
      const id = 'm' + uid(12);
      await BlobStore.save(id, blob);
      return { id, type: 'vid', thumb, w: v.videoWidth, h: v.videoHeight, dur: Math.round(dur * 10) / 10, ts: Date.now() };
    } finally { URL.revokeObjectURL(src); }
  },

  /** Video in Echtzeit auf max. 640 px neu kodieren (Canvas + MediaRecorder) */
  async _shrink(v, dur) {
    if (typeof MediaRecorder === 'undefined') throw new Error('Video ist zu groß und dieser Browser kann es nicht verkleinern.');
    const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
    const cv = h('canvas', { width: Math.round(v.videoWidth * k / 2) * 2, height: Math.round(v.videoHeight * k / 2) * 2 });
    const ctx = cv.getContext('2d');
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 1_400_000 });
    const parts = [];
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const prog = UI.sheet('Video wird verkleinert …', () => [h('p.lead', 'Einen Moment – der Clip wird für die Crew komprimiert.'), h('div.bar', h('i#shrink-bar'))]);
    v.currentTime = 0;
    await new Promise((r) => { v.onseeked = r; });
    rec.start(250);
    await v.play();
    await new Promise((res) => {
      const draw = () => {
        ctx.drawImage(v, 0, 0, cv.width, cv.height);
        const bar = $('#shrink-bar'); if (bar) bar.style.width = (v.currentTime / dur) * 100 + '%';
        if (v.ended || v.currentTime >= dur) return res();
        requestAnimationFrame(draw);
      };
      draw();
      v.onended = res;
    });
    rec.stop();
    await new Promise((r) => { rec.onstop = r; });
    prog.close();
    return new Blob(parts, { type: mime.split(';')[0] || 'video/webm' });
  },

  /** Vorschau-Kachel; Tippen öffnet den Viewer */
  thumb(ref, { big = false } = {}) {
    if (!ref) return null;
    return h('button.media', { class: big ? 'big' : '', onclick: (e) => { e.stopPropagation(); this.view(ref); }, title: ref.type === 'vid' ? 'Video ansehen' : 'Foto ansehen' },
      h('img', { src: ref.thumb, alt: '', loading: 'lazy' }),
      ref.type === 'vid' && h('span.play', '▶'),
      ref.type === 'vid' && ref.dur && h('span.dur', ref.dur.toFixed(0) + ' s'));
  },

  async view(ref) {
    const stage = h('div.viewer-stage', h('img', { src: ref.thumb, class: 'blur' }), h('div.viewer-wait', 'Original wird geladen …'));
    const speed = h('div.row.center.speed');
    UI.sheet(ref.type === 'vid' ? 'Clip' : 'Foto', () => [stage, speed], { wide: true, onClose: () => { off(); offP(); } });
    const show = (url) => {
      if (ref.type === 'vid') {
        const v = h('video', { src: url, controls: true, playsInline: true, autoplay: true, loop: true });
        fill(stage, v);
        fill(speed, ...[0.25, 0.5, 1].map((r) => h('button.chip', { class: r === 1 ? 'on' : '', onclick: (e) => { v.playbackRate = r; $$('.chip', speed).forEach((c) => c.classList.toggle('on', c === e.currentTarget)); } }, r === 1 ? 'Normal' : `${r}× Zeitlupe`)),
          h('button.chip', { onclick: async () => download(`landed-${ref.id}.${(await BlobStore.get(ref.id)).type.includes('mp4') ? 'mp4' : 'webm'}`, await BlobStore.get(ref.id)) }, '⬇ Speichern'));
      } else {
        fill(stage, h('img', { src: url, alt: '' }));
        fill(speed, h('button.chip', { onclick: async () => download(`landed-${ref.id}.jpg`, await BlobStore.get(ref.id)) }, '⬇ Speichern'));
      }
    };
    const off = BlobStore.on('ready', async (id) => { if (id === ref.id) show(await BlobStore.url(id)); });
    const offP = BlobStore.on('progress', (id, p) => { if (id === ref.id) { const w = $('.viewer-wait', stage); if (w) w.textContent = `Lädt … ${Math.round(p * 100)} %`; } });
    const url = await BlobStore.need(ref.id);
    if (url) show(url);
    else setTimeout(() => { const w = $('.viewer-wait', stage); if (w && w.textContent.startsWith('Original')) w.textContent = 'Wartet auf jemanden aus der Crew, der die Datei hat …'; }, 6000);
  },
};
