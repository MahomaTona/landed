/* Hintergrund-Szenen als handgezeichnete SVGs (hochkant, skalieren per "slice" auf jedes Display).
   Bewusst ohne Fremdbilder: winzig, gestochen scharf, keine Lizenzfragen. */

const SCENES = {};

/* kleine Helfer für wiederholte Elemente */
const _rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function _windows(x, y, w, hgt, rnd, lit) {
  let s = '';
  for (let yy = y + 8; yy < y + hgt - 10; yy += 16) {
    for (let xx = x + 6; xx < x + w - 8; xx += 12) {
      const on = rnd() < lit;
      s += `<rect x="${xx}" y="${yy}" width="6" height="9" fill="${on ? (rnd() < 0.2 ? '#ff9de2' : '#ffd98a') : '#1c2238'}" opacity="${on ? 0.55 + rnd() * 0.4 : 0.8}"/>`;
    }
  }
  return s;
}

function _palm(x, y, s, flip = 1) {
  const fr = (a) => `<path d="M0 0 q ${40 * Math.cos(a)} ${40 * Math.sin(a) - 30} ${95 * Math.cos(a)} ${95 * Math.sin(a) + 10} q ${-45 * Math.cos(a)} ${-20} ${-95 * Math.cos(a)} ${-95 * Math.sin(a) - 10}z"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s * flip} ${s})" fill="#2a0f2e">
    <path d="M-6 0 C -2 120 18 260 4 420 L 22 420 C 34 260 14 120 6 0 Z"/>
    ${[-2.9, -2.4, -1.9, -1.2, -0.6, -0.2, 0.3].map(fr).join('')}
    <circle cx="4" cy="6" r="9"/><circle cx="-6" cy="12" r="7"/>
  </g>`;
}

/** Street – Stadt bei Nacht, Neon, Laterne, Ledge */
SCENES.street = () => {
  const rnd = _rnd(7);
  let city = '';
  const blds = [[-10, 300, 70, 330], [55, 250, 60, 380], [110, 330, 55, 300], [160, 210, 75, 420], [230, 290, 50, 340], [275, 240, 70, 390], [340, 310, 70, 320]];
  for (const [x, y, w, hh] of blds) city += `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="#121729"/>${_windows(x, y, w, hh, rnd, 0.32)}`;
  let stars = '';
  for (let i = 0; i < 60; i++) stars += `<circle cx="${rnd() * 400}" cy="${rnd() * 260}" r="${rnd() * 1.3 + 0.3}" fill="#fff" opacity="${rnd() * 0.7 + 0.2}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05060f"/><stop offset=".55" stop-color="#151a3a"/><stop offset="1" stop-color="#2b1c47"/></linearGradient>
    <radialGradient id="lamp" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".55"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></radialGradient>
    <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23232c"/><stop offset="1" stop-color="#0b0b10"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="400" height="800" fill="url(#sk)"/>${stars}
  <circle cx="320" cy="90" r="26" fill="#f4f1e8" opacity=".9"/><circle cx="330" cy="84" r="24" fill="#0b0d1d" opacity=".9"/>
  ${city}
  <g filter="url(#glow)" font-family="Impact, 'Arial Black', sans-serif" font-size="30" fill="none" stroke-width="2.4">
    <rect x="168" y="250" width="62" height="98" rx="6" stroke="#ff3d7f"/>
    <text x="199" y="286" text-anchor="middle" stroke="#ff3d7f">SK8</text>
    <text x="199" y="330" text-anchor="middle" stroke="#3dffb4" font-size="26">24/7</text>
  </g>
  <rect y="600" width="400" height="200" fill="url(#gr)"/>
  <path d="M0 640 L400 640" stroke="#3a3a46" stroke-width="2"/>
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${200 + (i - 3) * 30} 640 L${200 + (i - 3) * 160} 800" stroke="#2e2e38" stroke-width="1.5"/>`).join('')}
  <g><rect x="62" y="380" width="6" height="262" fill="#2b2f3a"/><path d="M65 382 q 0 -20 26 -22 l 18 0" stroke="#2b2f3a" stroke-width="6" fill="none"/>
    <rect x="100" y="354" width="28" height="9" rx="3" fill="#3b3f4c"/><path d="M114 363 L40 660 L200 660 Z" fill="url(#lamp)"/>
    <ellipse cx="114" cy="366" rx="10" ry="3" fill="#fff4cf"/></g>
  <g><path d="M210 662 L388 662 L388 700 L210 700 Z" fill="#4a4a55"/><path d="M210 662 L388 662 L374 650 L224 650 Z" fill="#6d6d78"/>
    <path d="M224 650 L374 650" stroke="#c9c9d2" stroke-width="2.5"/>
    <path d="M230 700 L230 720 M370 700 L370 720" stroke="#2a2a33" stroke-width="6"/></g>
  <g transform="translate(290 560) rotate(-18)">
    <rect x="-46" y="-6" width="92" height="12" rx="6" fill="#e9e3d6"/><rect x="-42" y="-4" width="84" height="5" rx="2" fill="#1d1d22"/>
    <circle cx="-28" cy="10" r="5" fill="#ffd23f"/><circle cx="28" cy="10" r="5" fill="#ffd23f"/>
  </g>
  <path d="M260 600 q 30 -50 70 -40" stroke="#fff" stroke-width="1.6" fill="none" stroke-dasharray="3 5" opacity=".6"/>
  <g fill="#ff3d7f" opacity=".85"><circle cx="40" cy="720" r="3"/><circle cx="350" cy="760" r="2"/></g>
</svg>`;
};

/** Sunset Bowl – Kalifornien, 70er, Pool mit Coping, Palmen */
SCENES.sunset = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="ss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d1b4e"/><stop offset=".35" stop-color="#b8336a"/><stop offset=".6" stop-color="#ff7b3a"/><stop offset=".75" stop-color="#ffc35a"/></linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#ff8c42"/></linearGradient>
    <linearGradient id="bowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd6e6"/><stop offset="1" stop-color="#2e7d9a"/></linearGradient>
    <clipPath id="sc"><circle cx="200" cy="370" r="120"/></clipPath>
  </defs>
  <rect width="400" height="800" fill="url(#ss)"/>
  <g clip-path="url(#sc)"><rect x="60" y="240" width="280" height="260" fill="url(#sun)"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="60" y="${398 + i * 16}" width="280" height="${3 + i * 1.6}" fill="#b8336a"/>`).join('')}</g>
  <g opacity=".9">${[0, 1, 2, 3, 4].map((i) => `<path d="M0 ${150 + i * 10} Q 200 ${110 + i * 10} 400 ${150 + i * 10}" stroke="${['#ff7b3a', '#ffc35a', '#ff5d8f', '#c1447f', '#ffe08a'][i]}" stroke-width="5" fill="none" opacity=".35"/>`).join('')}</g>
  <path d="M0 520 Q 120 490 220 505 T 400 495 L400 800 L0 800Z" fill="#3b1736"/>
  ${_palm(56, 250, 0.9)}${_palm(352, 300, 0.75, -1)}${_palm(300, 360, 0.5)}
  <path d="M0 560 L400 560 L400 800 L0 800 Z" fill="#e8c9a0"/>
  ${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 36} 560 L${i * 36 - 20} 800" stroke="#d9b68a" stroke-width="1"/>`).join('')}
  <ellipse cx="200" cy="680" rx="190" ry="80" fill="#c99a6b"/>
  <ellipse cx="200" cy="682" rx="178" ry="72" fill="url(#bowl)"/>
  <ellipse cx="200" cy="682" rx="178" ry="72" fill="none" stroke="#f3efe6" stroke-width="7"/>
  ${Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2; return `<rect x="${200 + Math.cos(a) * 168 - 4}" y="${682 + Math.sin(a) * 64 - 3}" width="8" height="6" fill="#2b6f8a" opacity=".55" transform="rotate(${(a * 180) / Math.PI} ${200 + Math.cos(a) * 168} ${682 + Math.sin(a) * 64})"/>`; }).join('')}
  <path d="M60 700 Q 200 760 340 700" stroke="#a6eaf4" stroke-width="2" fill="none" opacity=".6"/>
  <path d="M110 720 Q 200 752 290 720" stroke="#a6eaf4" stroke-width="1.5" fill="none" opacity=".4"/>
  <g transform="translate(250 620) rotate(28)"><rect x="-34" y="-5" width="68" height="10" rx="5" fill="#ffe08a"/><rect x="-30" y="-3" width="60" height="4" rx="2" fill="#7a2d4a"/>
    <circle cx="-20" cy="8" r="4.5" fill="#ff5d8f"/><circle cx="20" cy="8" r="4.5" fill="#ff5d8f"/></g>
</svg>`;

/** DIY – Unter der Brücke: Beton, Pfeiler, Quarter, Graffiti, Sticker */
SCENES.diy = () => {
  const rnd = _rnd(42);
  let cracks = '';
  for (let i = 0; i < 18; i++) { const x = rnd() * 400, y = 560 + rnd() * 240; cracks += `<path d="M${x} ${y} l${rnd() * 30 - 15} ${rnd() * 20} l${rnd() * 20 - 10} ${rnd() * 16}" stroke="#2c2c2c" stroke-width="1" fill="none" opacity=".6"/>`; }
  let stickers = '';
  const sc = ['#ff3d7f', '#ffd23f', '#3dffb4', '#27b6ff', '#f4f1e8', '#ff8c42'];
  for (let i = 0; i < 14; i++) {
    const x = 30 + rnd() * 340, y = 240 + rnd() * 260, r = rnd() * 40 - 20;
    stickers += rnd() < 0.5
      ? `<rect x="${x}" y="${y}" width="${14 + rnd() * 16}" height="${10 + rnd() * 12}" rx="2" fill="${sc[Math.floor(rnd() * sc.length)]}" transform="rotate(${r} ${x} ${y})" opacity=".85"/>`
      : `<circle cx="${x}" cy="${y}" r="${5 + rnd() * 7}" fill="${sc[Math.floor(rnd() * sc.length)]}" opacity=".85"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="dk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0d0f"/><stop offset=".4" stop-color="#26272b"/><stop offset="1" stop-color="#3a3b40"/></linearGradient>
    <linearGradient id="day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb3c0"/><stop offset="1" stop-color="#d9d2c0"/></linearGradient>
    <linearGradient id="pil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a4b50"/><stop offset=".5" stop-color="#6b6c72"/><stop offset="1" stop-color="#3a3b40"/></linearGradient>
    <radialGradient id="bulb" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#ffd98a" stop-opacity=".4"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
    <pattern id="noise" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="none"/><circle cx="1" cy="2" r=".5" fill="#000" opacity=".25"/><circle cx="4" cy="5" r=".4" fill="#fff" opacity=".08"/></pattern>
  </defs>
  <rect width="400" height="800" fill="url(#day)"/>
  <path d="M0 470 L120 455 L260 470 L400 450 L400 560 L0 560Z" fill="#7c8b80" opacity=".6"/>
  <rect width="400" height="210" fill="url(#dk)"/>
  <path d="M0 210 L400 210 L400 240 L0 240Z" fill="#1a1a1d"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${i * 52}" y="0" width="16" height="212" fill="#1f2024"/>`).join('')}
  <rect x="40" y="240" width="70" height="330" fill="url(#pil)"/><rect x="290" y="240" width="70" height="330" fill="url(#pil)"/>
  <rect x="40" y="240" width="70" height="330" fill="url(#noise)"/><rect x="290" y="240" width="70" height="330" fill="url(#noise)"/>
  <g font-family="'Permanent Marker', 'Comic Sans MS', cursive" font-weight="700">
    <text x="48" y="330" font-size="30" fill="#ff3d7f" transform="rotate(-8 48 330)" stroke="#111" stroke-width="1.5">DIY</text>
    <text x="292" y="390" font-size="22" fill="#3dffb4" transform="rotate(6 292 390)" stroke="#111" stroke-width="1.2">SKATE</text>
    <text x="296" y="420" font-size="22" fill="#ffd23f" transform="rotate(6 296 420)" stroke="#111" stroke-width="1.2">OR DIE</text>
    <text x="52" y="470" font-size="18" fill="#27b6ff" transform="rotate(-4 52 470)">crew ✶</text>
  </g>
  ${stickers}
  <path d="M200 240 L200 300" stroke="#111" stroke-width="1.5"/><circle cx="200" cy="306" r="7" fill="#ffe6a3"/><circle cx="200" cy="330" r="110" fill="url(#bulb)"/>
  <rect y="560" width="400" height="240" fill="#55565b"/><rect y="560" width="400" height="240" fill="url(#noise)"/>${cracks}
  <path d="M120 560 L300 560 L300 600 Q 260 600 230 640 Q 205 680 200 720 L120 720 Z" fill="#6f7076"/>
  <path d="M300 560 L300 600 Q 260 600 230 640 Q 205 680 200 720 L190 720 Q 196 676 222 634 Q 252 592 300 590Z" fill="#8a8b91"/>
  <path d="M120 560 L300 560" stroke="#c9c9d2" stroke-width="4"/>
  <path d="M130 600 L290 600" stroke="#ffd23f" stroke-width="3" stroke-dasharray="12 8" opacity=".7"/>
  <rect x="310" y="690" width="80" height="18" fill="#7a7b81"/><rect x="310" y="686" width="80" height="5" fill="#b5b5bd"/>
  <g transform="translate(70 740) rotate(-6)"><rect x="-30" y="-4" width="60" height="9" rx="4" fill="#222"/><circle cx="-18" cy="8" r="4" fill="#f4f1e8"/><circle cx="18" cy="8" r="4" fill="#f4f1e8"/></g>
  <path d="M20 650 l40 -6 M30 660 l30 -2" stroke="#e8e4da" stroke-width="3" opacity=".5"/>
</svg>`;
};

/** Retro 80s – Neon-Grid, gestreifte Sonne, Miniramp */
SCENES.retro = () => {
  const rnd = _rnd(80);
  let stars = '';
  for (let i = 0; i < 70; i++) stars += `<circle cx="${rnd() * 400}" cy="${rnd() * 420}" r="${rnd() * 1.2 + 0.2}" fill="#fff" opacity="${rnd() * 0.8}"/>`;
  let grid = '';
  for (let i = -12; i <= 12; i++) grid += `<path d="M${200 + i * 14} 520 L${200 + i * 120} 800" stroke="#ff2bd6" stroke-width="1.4" opacity=".75"/>`;
  for (let i = 0; i < 12; i++) { const y = 520 + Math.pow(i / 11, 2) * 280; grid += `<path d="M0 ${y} L400 ${y}" stroke="#ff2bd6" stroke-width="${1 + i * 0.12}" opacity="${0.35 + i * 0.05}"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="rs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07021a"/><stop offset=".55" stop-color="#2a0845"/><stop offset=".66" stop-color="#5b0f63"/></linearGradient>
    <linearGradient id="rsun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe45c"/><stop offset=".5" stop-color="#ff7b3a"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>
    <clipPath id="rc"><circle cx="200" cy="430" r="130"/></clipPath>
    <filter id="ng"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="400" height="800" fill="url(#rs)"/>${stars}
  <g clip-path="url(#rc)"><rect x="60" y="290" width="280" height="240" fill="url(#rsun)"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="60" y="${430 + i * 13}" width="280" height="${2 + i * 1.4}" fill="#2a0845"/>`).join('')}</g>
  <path d="M0 520 L60 470 L110 500 L170 455 L230 505 L300 460 L350 495 L400 470 L400 520Z" fill="#1a0533"/>
  <path d="M0 520 L60 470 L110 500 L170 455 L230 505 L300 460 L350 495 L400 470" stroke="#00f0ff" stroke-width="1.5" fill="none" filter="url(#ng)" opacity=".8"/>
  <rect y="520" width="400" height="280" fill="#0d0221"/>${grid}
  <g filter="url(#ng)" fill="none" stroke="#00f0ff" stroke-width="3">
    <path d="M70 690 L70 640 Q 70 610 100 610 L120 610 Q 150 610 170 650 L190 690"/>
    <path d="M330 690 L330 640 Q 330 610 300 610 L280 610 Q 250 610 230 650 L210 690"/>
    <path d="M60 690 L340 690"/><path d="M64 640 L76 640 M324 640 L336 640"/>
  </g>
  <g filter="url(#ng)" font-family="'Press Start 2P', 'Courier New', monospace" font-size="16" fill="#ffe45c" text-anchor="middle">
    <text x="200" y="250">RAD ★ 1987</text>
  </g>
  <g transform="translate(200 590) rotate(-10)" filter="url(#ng)"><rect x="-40" y="-5" width="80" height="10" rx="5" fill="none" stroke="#ffe45c" stroke-width="2.2"/>
    <circle cx="-24" cy="9" r="4.5" fill="none" stroke="#ff2bd6" stroke-width="2"/><circle cx="24" cy="9" r="4.5" fill="none" stroke="#ff2bd6" stroke-width="2"/></g>
</svg>`;
};
