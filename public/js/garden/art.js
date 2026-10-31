// Garden artwork: loads the illustrated SVG characters (recoloured through
// their CSS custom properties) and draws the courtyard set pieces — carved
// sandstone wall with jaali arches, chhatri-inspired pavilion, block-print
// runner, brass lanterns, bougainvillea, champa trees, planters — as SVG,
// then rasterises them to Three.js textures.

import * as THREE from '/vendor/three/three.module.js';

function seeded(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function viewBoxAspect(svg) {
  const m = svg.match(/viewBox="([\d.\s-]+)"/);
  if (!m) return 1;
  const [, , w, h] = m[1].trim().split(/\s+/).map(Number);
  return w / h;
}

export async function svgTexture(svg, pxHeight) {
  const aspect = viewBoxAspect(svg);
  const img = new Image();
  img.decoding = 'async';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.height = Math.round(pxHeight);
  c.width = Math.min(4096, Math.round(pxHeight * aspect));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return { tex, aspect };
}

const cache = new Map();
export async function loadCharacter(src, palette = {}, pxHeight = 512) {
  if (!cache.has(src)) cache.set(src, fetch(src).then((r) => r.text()));
  let svg = await cache.get(src);
  for (const [k, v] of Object.entries(palette)) {
    svg = svg.replace(new RegExp(`(${k}:)[^;"]+`), `$1${v}`);
  }
  return svgTexture(svg, pxHeight);
}

// ---------- helpers ----------
const W = (n) => n.toFixed(1);
const GREENS = ['#2F5A3E', '#3B6B48', '#4A7D55', '#5E9065', '#264A33'];
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
const leaf = (x, y, len, rot, fill) =>
  `<ellipse cx="${W(x)}" cy="${W(y)}" rx="${W(len)}" ry="${W(len * 0.4)}" transform="rotate(${W(rot)} ${W(x)} ${W(y)})" fill="${fill}"/>`;

// marigold pom-pom, jasmine star, bougainvillea bract cluster, champa
function marigold(x, y, r) {
  return `<circle cx="${W(x)}" cy="${W(y)}" r="${W(r)}" fill="#E8902A"/><circle cx="${W(x)}" cy="${W(y)}" r="${W(r * 0.72)}" fill="#F4A93A"/><circle cx="${W(x - r * 0.2)}" cy="${W(y - r * 0.2)}" r="${W(r * 0.35)}" fill="#FFCB6B"/>`;
}
function jasmine(x, y, r) {
  let s = '';
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; s += `<ellipse cx="${W(x + Math.cos(a) * r * 0.55)}" cy="${W(y + Math.sin(a) * r * 0.55)}" rx="${W(r * 0.5)}" ry="${W(r * 0.28)}" transform="rotate(${W((a * 180) / Math.PI)} ${W(x + Math.cos(a) * r * 0.55)} ${W(y + Math.sin(a) * r * 0.55)})" fill="#FFF9EE"/>`; }
  return s + `<circle cx="${W(x)}" cy="${W(y)}" r="${W(r * 0.18)}" fill="#F3DCA2"/>`;
}
function bract(x, y, r, c = '#C23A78') {
  return `<path d="M${W(x)} ${W(y - r)} L${W(x + r * 0.9)} ${W(y + r * 0.6)} L${W(x - r * 0.9)} ${W(y + r * 0.6)} Z" fill="${c}" opacity=".95"/><circle cx="${W(x)}" cy="${W(y)}" r="${W(r * 0.25)}" fill="#F7E3EC"/>`;
}
function champa(x, y, r) {
  let s = '';
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; s += `<ellipse cx="${W(x + Math.cos(a) * r * 0.5)}" cy="${W(y + Math.sin(a) * r * 0.5)}" rx="${W(r * 0.55)}" ry="${W(r * 0.32)}" transform="rotate(${W((a * 180) / Math.PI + 20)} ${W(x + Math.cos(a) * r * 0.5)} ${W(y + Math.sin(a) * r * 0.5)})" fill="#FFF8EC"/>`; }
  return s + `<circle cx="${W(x)}" cy="${W(y)}" r="${W(r * 0.32)}" fill="#F6CF6A"/>`;
}

// Cusped (multifoil) arch opening: pointed outline with inward lobes.
function cuspedArch(cx, hw, spring, apex, bottom, lobes = 7) {
  const pts = [];
  for (let i = 0; i <= lobes; i++) {
    const t = i / lobes;               // 0 left spring → 1 right spring
    const a = Math.PI * (1 - t);
    const x = cx + Math.cos(a) * hw;
    const lift = Math.sin(a);
    const y = spring - lift * (spring - apex) * (0.75 + 0.25 * lift);
    pts.push([x, y]);
  }
  let d = `M${W(cx - hw)} ${bottom} L${W(pts[0][0])} ${W(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const r = Math.hypot(x1 - x0, y1 - y0) * 0.62;
    d += ` A${W(r)} ${W(r)} 0 0 0 ${W(x1)} ${W(y1)}`;
  }
  return d + ` L${W(cx + hw)} ${bottom} Z`;
}

// ---------- courtyard wall ----------
// glow=false: the carved wall; glow=true: only the jaali holes, warm amber,
// drawn as an additive layer so the screens light up as planning advances.
export function courtyardSVG({ arches = 11, glow = false } = {}) {
  const Wd = arches * 200, H = 420;
  const hole = glow ? '#FFC77A' : '#262A4A';
  const jaali = `<pattern id="j" width="18" height="18" patternUnits="userSpaceOnUse">
      ${glow ? '' : `<rect width="18" height="18" fill="#EADBBE"/>`}
      <path d="M9 2.2 L10.8 6.6 L15.6 5.4 L12.6 9 L15.6 12.6 L10.8 11.4 L9 15.8 L7.2 11.4 L2.4 12.6 L5.4 9 L2.4 5.4 L7.2 6.6 Z" fill="${hole}"/>
      <rect x="-1.2" y="-1.2" width="2.4" height="2.4" transform="rotate(45 0 0)" fill="${hole}"/>
      <rect x="16.8" y="16.8" width="2.4" height="2.4" transform="rotate(45 18 18)" fill="${hole}"/>
    </pattern>`;
  let openings = '', frames = '', pilasters = '', clips = '';
  for (let i = 0; i < arches; i++) {
    const cx = 100 + i * 200;
    clips += `<clipPath id="o${i}"><path d="${cuspedArch(cx, 56, 214, 124, 384)}"/></clipPath>`;
    if (!glow) {
      frames += `<path d="${cuspedArch(cx, 66, 214, 112, 404)}" fill="#C9AF86"/><path d="${cuspedArch(cx, 62, 214, 118, 404)}" fill="#D8C29C"/>`;
      // spandrel rosettes
      frames += `<circle cx="${cx - 74}" cy="128" r="9" fill="none" stroke="#C2A578" stroke-width="2"/><circle cx="${cx + 74}" cy="128" r="9" fill="none" stroke="#C2A578" stroke-width="2"/><circle cx="${cx - 74}" cy="128" r="3" fill="#B7956A"/><circle cx="${cx + 74}" cy="128" r="3" fill="#B7956A"/>`;
      pilasters += `<rect x="${i * 200 - 9}" y="80" width="18" height="324" fill="#E2CFAA"/><rect x="${i * 200 - 9}" y="80" width="3" height="324" fill="#F1E4C8"/>`;
      for (let y = 120; y < 400; y += 46) pilasters += `<path d="M${i * 200} ${y - 7} L${i * 200 + 6} ${y} L${i * 200} ${y + 7} L${i * 200 - 6} ${y} Z" fill="#C9AF86"/>`;
      openings += `<g clip-path="url(#o${i})"><rect x="${cx - 60}" y="110" width="120" height="280" fill="url(#j)"/></g>`;
      openings += `<rect x="${cx - 60}" y="384" width="120" height="20" fill="#CDB48C"/><rect x="${cx - 60}" y="384" width="120" height="3" fill="#E9D9B8"/>`;
    } else {
      openings += `<g clip-path="url(#o${i})"><rect x="${cx - 60}" y="110" width="120" height="280" fill="url(#j)"/></g>`;
    }
  }
  if (glow) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${H}"><defs>${jaali}${clips}</defs>${openings}</svg>`;

  let merlons = '', dentils = '', inlay = '';
  for (let x = 6; x < Wd; x += 30) merlons += `<path d="M${x} 26 L${x} 16 Q${x + 9} 4 ${x + 18} 16 L${x + 18} 26 Z" fill="#E4D2AE"/>`;
  for (let x = 4; x < Wd; x += 14) dentils += `<rect x="${x}" y="58" width="8" height="7" fill="#C2A578"/>`;
  for (let x = 20; x < Wd; x += 40) inlay += `<path d="M${x} 72 L${x + 8} 66 L${x + 16} 72 L${x + 8} 78 Z" fill="#B48A55" opacity=".7"/><circle cx="${x + 28}" cy="72" r="2" fill="#2F6E5A" opacity=".6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${H}">
    <defs>${jaali}${clips}
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEDFC2"/><stop offset="1" stop-color="#D6C09A"/></linearGradient>
    </defs>
    <rect x="0" y="26" width="${Wd}" height="${H - 26}" fill="url(#wall)"/>
    ${merlons}
    <rect x="0" y="26" width="${Wd}" height="22" fill="#E8D7B4"/>
    <rect x="0" y="46" width="${Wd}" height="12" fill="#CDB48C"/>
    ${dentils}
    <rect x="0" y="65" width="${Wd}" height="15" fill="#E9DABB"/>
    ${inlay}
    ${pilasters}${frames}${openings}
    <rect x="0" y="404" width="${Wd}" height="16" fill="#BFA47C"/>
    <rect x="0" y="404" width="${Wd}" height="2" fill="#E6D3AE"/>
  </svg>`;
}

// ---------- pavilion (chhatri-inspired open canopy) ----------
export function pavilionSVG() {
  const rnd = seeded(31);
  const pillar = (x) => `
    <path d="M${x - 14} 462 L${x + 14} 462 L${x + 11} 446 C${x + 16} 438 ${x + 16} 428 ${x + 8} 422 L${x - 8} 422 C${x - 16} 428 ${x - 16} 438 ${x - 11} 446 Z" fill="#E6D2AA"/>
    <rect x="${x - 7}" y="150" width="14" height="272" fill="#EFE1C4"/>
    <rect x="${x - 7}" y="150" width="4" height="272" fill="#FBF3E2"/>
    ${[190, 250, 310, 370].map((y) => `<rect x="${x - 9}" y="${y}" width="18" height="6" rx="3" fill="#D1B88E"/><circle cx="${x}" cy="${y + 3}" r="1.6" fill="#B48A45"/>`).join('')}
    <path d="M${x - 9} 150 L${x + 9} 150 L${x + 20} 132 L${x - 20} 132 Z" fill="#D9C39B"/>
    <path d="M${x - 22} 132 L${x + 22} 132 L${x + 22} 126 L${x - 22} 126 Z" fill="#C9A86E"/>`;
  // flower strands of jasmine and marigold hanging from the beam
  let strands = '';
  for (let x = 92; x <= 328; x += 26) {
    const len = 54 + rnd() * 50;
    for (let y = 150; y < 150 + len; y += 7) strands += Math.floor((y - 150) / 7) % 3 === 2 ? marigold(x, y, 3.6) : `<circle cx="${x}" cy="${y}" r="3" fill="#FFF8EC"/>`;
    strands += `<path d="M${x} ${W(150 + len)} l0 9" stroke="#C23A78" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  // scalloped fabric valance
  let valance = '';
  for (let x = 40; x < 380; x += 20) valance += `<path d="M${x} 126 Q${x + 10} 146 ${x + 20} 126 Z" fill="#F7EEDC"/><path d="M${x} 126 Q${x + 10} 146 ${x + 20} 126" fill="none" stroke="#C9A15A" stroke-width="1.4"/><circle cx="${x + 10}" cy="140" r="1.8" fill="#C9A15A"/>`;
  let base = '';
  for (const bx of [62, 358]) {
    for (let i = 0; i < 12; i++) base += leaf(bx + (rnd() - 0.5) * 60, 448 + (rnd() - 0.5) * 22, 10 + rnd() * 6, rnd() * 360, pick(rnd, GREENS));
    for (let i = 0; i < 7; i++) base += marigold(bx + (rnd() - 0.5) * 54, 444 + (rnd() - 0.5) * 18, 5 + rnd() * 2);
    for (let i = 0; i < 5; i++) base += jasmine(bx + (rnd() - 0.5) * 54, 440 + (rnd() - 0.5) * 20, 6);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 480">
    <path d="M58 104 C40 200 34 300 30 460 L44 460 C52 320 60 220 74 130 Z" fill="#FFF7EA" opacity=".55"/>
    <path d="M362 104 C380 200 386 300 390 460 L376 460 C368 320 360 220 346 130 Z" fill="#FFF7EA" opacity=".5"/>
    ${pillar(62)}${pillar(358)}
    <path d="M28 108 C120 66 300 66 392 108 L392 118 L28 118 Z" fill="#F4E8D0"/>
    <path d="M28 108 C120 66 300 66 392 108" fill="none" stroke="#C9A15A" stroke-width="2.4"/>
    <path d="M60 104 C140 76 280 76 360 104" fill="none" stroke="#A9304C" stroke-width="3" opacity=".8"/>
    <circle cx="28" cy="106" r="6" fill="#C9A15A"/><circle cx="392" cy="106" r="6" fill="#C9A15A"/>
    <rect x="24" y="116" width="372" height="12" fill="#E2CCA0"/>
    <rect x="24" y="120" width="372" height="2.4" fill="#A9304C" opacity=".7"/>
    ${valance}
    <path d="M70 150 Q90 170 110 150 Q130 172 150 150 Q170 174 190 150 Q210 176 230 150 Q250 174 270 150 Q290 172 310 150 Q330 170 350 150" fill="none" stroke="#E9D7B0" stroke-width="3"/>
    ${strands}
    <path d="M30 120 C80 170 110 220 70 300 C66 306 60 306 58 300" fill="#FFF8EC" opacity=".6"/>
    <path d="M390 120 C340 170 310 220 350 300 C354 306 360 306 362 300" fill="#FFF8EC" opacity=".55"/>
    <circle cx="64" cy="300" r="5" fill="#C9A15A"/><circle cx="356" cy="300" r="5" fill="#C9A15A"/>
    ${base}
  </svg>`;
}

// ---------- block-print runner rug (the path between the couple) ----------
export function rugSVG() {
  let stamps = '', fringe = '';
  for (let x = 70; x < 940; x += 34) stamps += `<g transform="translate(${x} 35)"><circle r="5" fill="#F3E6CC"/><circle r="2.2" fill="#A9304C"/><circle cx="9" r="1.6" fill="#D9B26A"/><circle cx="-9" r="1.6" fill="#D9B26A"/></g>`;
  let bands = '';
  for (let x = 40; x < 960; x += 14) bands += `<rect x="${x}" y="14" width="7" height="3" fill="#D9B26A"/><rect x="${x + 4}" y="53" width="7" height="3" fill="#D9B26A"/>`;
  for (let y = 12; y < 60; y += 5) fringe += `<path d="M${36 - (y - 12) * 0.83} ${y} l-10 0 M${964 + (y - 12) * 0.83} ${y} l10 0" stroke="#EADBBE" stroke-width="1.6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 70">
    ${fringe}
    <path d="M40 10 L960 10 L1000 60 L0 60 Z" fill="#26335C"/>
    <path d="M40 10 L960 10 L966 18 L34 18 Z" fill="#A9304C"/>
    <path d="M6 52 L994 52 L1000 60 L0 60 Z" fill="#A9304C"/>
    ${bands}
    <path d="M60 24 L940 24 L952 46 L48 46 Z" fill="#2F3E6E"/>
    ${stamps}
  </svg>`;
}

// ---------- brass lantern (pierced body); chain=true for hanging ----------
export function lanternSVG({ chain = false } = {}) {
  let holes = '';
  const top = chain ? 40 : 4;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) holes += `<circle cx="${19 + c * 7.4 + (r % 2) * 3.7}" cy="${top + 32 + r * 9}" r="2" fill="#FFF3D2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 ${chain ? 150 : 114}">
    <defs><radialGradient id="g" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#FFF6DA"/><stop offset=".55" stop-color="#FFC66E"/><stop offset="1" stop-color="#D98A3A"/></radialGradient>
    <linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#8C6A33"/><stop offset=".45" stop-color="#E2BC72"/><stop offset="1" stop-color="#9E7838"/></linearGradient></defs>
    ${chain ? `<path d="M30 0 L30 ${top - 6}" stroke="#8C6A33" stroke-width="1.6" stroke-dasharray="3 2"/>` : ''}
    <circle cx="30" cy="${top}" r="4" fill="none" stroke="url(#b)" stroke-width="2"/>
    <path d="M18 ${top + 18} C18 ${top + 8} 42 ${top + 8} 42 ${top + 18} Z" fill="url(#b)"/>
    <path d="M14 ${top + 18} L46 ${top + 18} L46 ${top + 23} L14 ${top + 23} Z" fill="url(#b)"/>
    <rect x="16" y="${top + 23}" width="28" height="40" rx="7" fill="url(#g)"/>
    <rect x="16" y="${top + 23}" width="28" height="40" rx="7" fill="url(#b)" opacity=".55"/>
    ${holes}
    <path d="M14 ${top + 63} L46 ${top + 63} L42 ${top + 70} L18 ${top + 70} Z" fill="url(#b)"/>
    <path d="M26 ${top + 70} L34 ${top + 70} L32 ${top + (chain ? 84 : 100)} L28 ${top + (chain ? 84 : 100)} Z" fill="#9E7838"/>
    ${chain ? `<circle cx="30" cy="${top + 88}" r="3" fill="#C9A15A"/>` : `<path d="M18 ${top + 100} L42 ${top + 100} L44 ${top + 108} L16 ${top + 108} Z" fill="#8C6A33"/>`}
  </svg>`;
}

// ---------- planters: bougainvillea, jasmine, marigold ----------
export function planterSVG(seed, kind) {
  const rnd = seeded(seed);
  let bush = '';
  for (let i = 0; i < 26; i++) bush += leaf(80 + (rnd() - 0.5) * 110, 70 + (rnd() - 0.5) * 70, 10 + rnd() * 7, rnd() * 360, pick(rnd, GREENS));
  for (let i = 0; i < 18; i++) {
    const x = 80 + (rnd() - 0.5) * 100, y = 66 + (rnd() - 0.5) * 64;
    bush += kind === 'bougainvillea' ? bract(x, y, 7 + rnd() * 3, rnd() < 0.3 ? '#D9578E' : '#B8326E')
      : kind === 'jasmine' ? jasmine(x, y, 7 + rnd() * 2) : marigold(x, y, 6 + rnd() * 2.5);
  }
  const brass = kind === 'jasmine';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200">
    ${bush}
    ${brass
      ? `<path d="M44 112 L116 112 L108 126 C118 140 116 168 100 184 L60 184 C44 168 42 140 52 126 Z" fill="#C9A15A"/><path d="M50 128 L110 128" stroke="#8C6A33" stroke-width="2"/><path d="M48 150 L112 150" stroke="#F3DCA2" stroke-width="1.6"/>`
      : `<path d="M46 112 L114 112 L110 122 C122 138 118 170 102 186 L58 186 C42 170 38 138 50 122 Z" fill="#B5603A"/><path d="M50 122 L110 122" stroke="#8E4528" stroke-width="2"/><path d="M47 146 Q80 156 113 146" stroke="#F3E1C2" stroke-width="2.4" fill="none"/><g fill="#F3E1C2">${[56, 68, 80, 92, 104].map((x) => `<circle cx="${x}" cy="${x === 80 ? 152 : 150}" r="2"/>`).join('')}</g>`}
    <rect x="58" y="186" width="44" height="8" rx="2" fill="#7A4E2E"/>
  </svg>`;
}

// ---------- bougainvillea cascade over the parapet ----------
export function vineSVG(seed) {
  const rnd = seeded(seed);
  let s = '';
  for (let k = 0; k < 5; k++) {
    const x0 = 40 + rnd() * 120, len = 120 + rnd() * 120, bend = (rnd() - 0.5) * 60;
    s += `<path d="M${W(x0)} 0 Q${W(x0 + bend)} ${W(len * 0.5)} ${W(x0 + bend * 0.4)} ${W(len)}" fill="none" stroke="#4A5A3A" stroke-width="2"/>`;
    for (let y = 10; y < len; y += 12) {
      const t = y / len, x = x0 + bend * (2 * t * (1 - t)) + bend * 0.4 * t * t;
      s += leaf(x + (rnd() - 0.5) * 16, y, 7 + rnd() * 4, rnd() * 360, pick(rnd, GREENS));
      if (rnd() < 0.55) s += bract(x + (rnd() - 0.5) * 18, y + 3, 6 + rnd() * 3, rnd() < 0.3 ? '#D9578E' : '#B8326E');
    }
  }
  for (let i = 0; i < 18; i++) s += leaf(20 + rnd() * 160, rnd() * 18, 10, rnd() * 180, pick(rnd, GREENS));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260">${s}</svg>`;
}

// ---------- champa (frangipani) tree ----------
export function champaTreeSVG(seed) {
  const rnd = seeded(seed);
  const branches = [
    'M200 500 C196 430 204 380 196 330 C188 290 160 260 126 236',
    'M198 360 C214 320 250 292 282 268',
    'M196 330 C200 290 214 250 206 196',
    'M160 270 C140 240 132 214 104 190',
    'M240 300 C268 270 300 252 320 214',
  ];
  let s = branches.map((d, i) => `<path d="${d}" fill="none" stroke="#6E625A" stroke-width="${i === 0 ? 18 : 9}" stroke-linecap="round"/>`).join('');
  s += `<path d="M200 500 C196 430 204 380 196 330" fill="none" stroke="#8C8076" stroke-width="5" stroke-linecap="round" opacity=".6"/>`;
  const tips = [[126, 236], [282, 268], [206, 196], [104, 190], [320, 214], [160, 170], [250, 160], [300, 190], [80, 230], [340, 260], [200, 150], [140, 210]];
  for (const [tx, ty] of tips) {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; s += leaf(tx + Math.cos(a) * 22, ty + Math.sin(a) * 14, 24, (a * 180) / Math.PI, pick(rnd, GREENS)); }
    for (let i = 0; i < 4; i++) s += champa(tx + (rnd() - 0.5) * 26, ty - 6 + (rnd() - 0.5) * 18, 8);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">${s}</svg>`;
}

export function foliageSVG(seed) {
  const rnd = seeded(seed);
  let s = '';
  for (let i = 0; i < 26; i++) s += leaf(rnd() * 400, 120 + rnd() * 180, 30 + rnd() * 34, -120 + rnd() * 80, pick(rnd, ['#14261C', '#1A2F22', '#203828']));
  for (let i = 0; i < 6; i++) s += marigold(40 + rnd() * 320, 170 + rnd() * 100, 9);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><filter id="b"><feGaussianBlur stdDeviation="2.4"/></filter></defs><g filter="url(#b)">${s}</g></svg>`;
}

export function treelineSVG(seed) {
  const rnd = seeded(seed);
  let s = '';
  for (let x = -20; x < 1220; x += 22 + rnd() * 26) {
    const h = 50 + rnd() * 90, r = 26 + rnd() * 34;
    s += `<ellipse cx="${W(x)}" cy="${W(200 - h)}" rx="${W(r)}" ry="${W(r * 1.2)}"/><rect x="${W(x - r)}" y="${W(200 - h)}" width="${W(r * 2)}" height="${W(h)}"/>`;
  }
  // a few slender palms on the skyline
  for (const px of [180, 640, 1010]) s += `<path d="M${px} 200 C${px + 4} 140 ${px - 2} 100 ${px + 6} 40" stroke="#fff" stroke-width="5" fill="none"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${px + 6} 40 q${(i - 2.5) * 16} ${-8 + Math.abs(i - 2.5) * 8} ${(i - 2.5) * 30} ${14 + Math.abs(i - 2.5) * 6}" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 200"><g fill="#fff">${s}</g></svg>`;
}

// ---------- canvas textures for light ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const glowTexture = () => canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,244,214,1)'); r.addColorStop(0.25, 'rgba(255,208,140,.55)'); r.addColorStop(0.6, 'rgba(255,180,110,.14)'); r.addColorStop(1, 'rgba(255,170,100,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});

export const sparkleTexture = () => canvasTex(64, (g, s) => {
  const c = s / 2;
  const r = g.createRadialGradient(c, c, 0, c, c, c);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,236,200,.6)'); r.addColorStop(1, 'rgba(255,226,180,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(255,248,230,.9)';
  g.beginPath(); g.moveTo(c, 2); g.quadraticCurveTo(c + 2, c - 2, s - 2, c); g.quadraticCurveTo(c + 2, c + 2, c, s - 2); g.quadraticCurveTo(c - 2, c + 2, 2, c); g.quadraticCurveTo(c - 2, c - 2, c, 2); g.fill();
});

export const petalTexture = () => canvasTex(32, (g) => {
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(16, 16, 12, 7, 0.6, 0, Math.PI * 2); g.fill();
});
