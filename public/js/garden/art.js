// Garden artwork: loads the illustrated SVG characters (recoloured through
// their CSS custom properties) and draws the procedural set pieces — arch,
// lanterns, flower clusters, trees, foliage — as SVG, then rasterises them to
// Three.js textures.

import * as THREE from 'three';

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
  c.width = Math.round(pxHeight * aspect);
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

// ---------- procedural set pieces ----------
const W = (n) => n.toFixed(1);

function leaf(x, y, len, rot, fill) {
  return `<ellipse cx="${W(x)}" cy="${W(y)}" rx="${W(len)}" ry="${W(len * 0.42)}" transform="rotate(${W(rot)} ${W(x)} ${W(y)})" fill="${fill}"/>`;
}

function bloom(x, y, r, color, kind = 0) {
  if (kind === 0) {
    // rosette
    return `<circle cx="${W(x)}" cy="${W(y)}" r="${W(r)}" fill="${color}"/><circle cx="${W(x)}" cy="${W(y)}" r="${W(r * 0.62)}" fill="#000" opacity=".08"/><circle cx="${W(x - r * 0.15)}" cy="${W(y - r * 0.15)}" r="${W(r * 0.36)}" fill="#fff" opacity=".35"/>`;
  }
  // five petals
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    s += `<circle cx="${W(x + Math.cos(a) * r * 0.62)}" cy="${W(y + Math.sin(a) * r * 0.62)}" r="${W(r * 0.5)}" fill="${color}"/>`;
  }
  return s + `<circle cx="${W(x)}" cy="${W(y)}" r="${W(r * 0.32)}" fill="#F7DC8F"/>`;
}

const GREENS = ['#4F7354', '#5E8461', '#6E9670', '#87AC86', '#3F5F46'];

export function archSVG(flowers) {
  const rnd = seeded(11);
  const pts = [];
  // posts and semicircular crown: x 70…330, crown centre (200,200) r 130
  for (let y = 450; y > 200; y -= 9) { pts.push([70, y, -90]); pts.push([330, y, -90]); }
  for (let a = 180; a >= 0; a -= 4) {
    const r = (a * Math.PI) / 180;
    pts.push([200 + Math.cos(r) * 130, 200 - Math.sin(r) * 130, -a]);
  }
  let leaves = '';
  let blooms = '';
  for (const [x, y] of pts) {
    // density: lush on the upper-left crown and lower-right post
    const lush = (x < 200 && y < 230) || (x > 300 && y > 330) ? 1 : 0.45;
    if (rnd() > lush) continue;
    for (let k = 0; k < 2; k++) {
      leaves += leaf(x + (rnd() - 0.5) * 18, y + (rnd() - 0.5) * 18, 8 + rnd() * 7, rnd() * 360, GREENS[Math.floor(rnd() * GREENS.length)]);
    }
    if (rnd() < 0.32 * lush) blooms += bloom(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 14, 6 + rnd() * 6, flowers[Math.floor(rnd() * flowers.length)], rnd() < 0.6 ? 0 : 1);
  }
  // full clusters
  const cluster = (cx, cy, n, spread) => {
    let s = '';
    for (let i = 0; i < n; i++) s += leaf(cx + (rnd() - 0.5) * spread * 1.6, cy + (rnd() - 0.5) * spread, 10 + rnd() * 8, rnd() * 360, GREENS[Math.floor(rnd() * GREENS.length)]);
    for (let i = 0; i < n * 0.7; i++) s += bloom(cx + (rnd() - 0.5) * spread * 1.3, cy + (rnd() - 0.5) * spread * 0.8, 8 + rnd() * 8, flowers[Math.floor(rnd() * flowers.length)], rnd() < 0.65 ? 0 : 1);
    return s;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460">
    <path d="M90 140 C60 230 64 340 58 452 L74 452 C80 340 84 240 106 150 Z" fill="#fff" opacity=".28"/>
    <path d="M310 140 C344 230 338 340 344 452 L328 452 C322 340 316 240 296 150 Z" fill="#fff" opacity=".22"/>
    <path d="M70 452 L70 200 A130 130 0 0 1 330 200 L330 452" fill="none" stroke="#EADBC0" stroke-width="9" stroke-linecap="round"/>
    <path d="M70 452 L70 200 A130 130 0 0 1 330 200 L330 452" fill="none" stroke="#FFF7E8" stroke-width="2.5" stroke-linecap="round" opacity=".8" transform="translate(-2 -2)"/>
    ${leaves}${blooms}
    ${cluster(118, 104, 26, 54)}${cluster(326, 380, 22, 46)}${cluster(78, 446, 14, 34)}${cluster(250, 76, 10, 34)}
  </svg>`;
}

export function flowerClusterSVG(seed, flowers) {
  const rnd = seeded(seed);
  let s = '';
  const stems = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < stems; i++) {
    const x = 30 + rnd() * 100;
    const top = 30 + rnd() * 50;
    const bend = (rnd() - 0.5) * 30;
    s += `<path d="M${W(x)} 118 Q${W(x + bend)} ${W((118 + top) / 2)} ${W(x + bend * 0.6)} ${W(top)}" fill="none" stroke="#557A58" stroke-width="2.4" stroke-linecap="round"/>`;
    s += leaf(x + bend * 0.3 - 6, (118 + top) / 2 + 10, 9, -40, GREENS[i % GREENS.length]);
    s += leaf(x + bend * 0.4 + 6, (118 + top) / 2 - 4, 8, 40, GREENS[(i + 2) % GREENS.length]);
    s += bloom(x + bend * 0.6, top, 7 + rnd() * 6, flowers[Math.floor(rnd() * flowers.length)], rnd() < 0.5 ? 0 : 1);
  }
  // low foliage mound
  for (let i = 0; i < 14; i++) s += leaf(20 + rnd() * 120, 104 + rnd() * 12, 10 + rnd() * 6, rnd() * 180, GREENS[Math.floor(rnd() * GREENS.length)]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">${s}</svg>`;
}

export function lanternSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 120">
    <defs><radialGradient id="g" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#FFF8E2"/><stop offset=".55" stop-color="#FFD58A"/><stop offset="1" stop-color="#E9A04F"/></radialGradient></defs>
    <path d="M30 4 C22 4 22 14 30 14 C38 14 38 4 30 4" fill="none" stroke="#C9A160" stroke-width="2.4"/>
    <path d="M16 22 L44 22 L40 14 L20 14 Z" fill="#C9A160"/>
    <path d="M14 22 L46 22 L46 26 L14 26 Z" fill="#E2C07F"/>
    <rect x="16" y="26" width="28" height="44" rx="6" fill="url(#g)"/>
    <path d="M24 26 L24 70 M36 26 L36 70 M16 48 L44 48" stroke="#C9A160" stroke-width="1.6" opacity=".85"/>
    <path d="M14 70 L46 70 L42 78 L18 78 Z" fill="#C9A160"/>
    <path d="M26 78 L34 78 L33 112 L27 112 Z" fill="#B48C50"/>
    <path d="M18 112 L42 112 L44 118 L16 118 Z" fill="#9C7842"/>
  </svg>`;
}

export function treeSVG(seed, warm = false) {
  const rnd = seeded(seed);
  let canopy = '';
  const tones = ['#20352C', '#294234', '#31503D', '#3B5D46'];
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 150;
    const x = 200 + Math.cos(a) * r * 1.05;
    const y = 190 + Math.sin(a) * r * 0.8;
    canopy += `<circle cx="${W(x)}" cy="${W(y)}" r="${W(34 + rnd() * 30)}" fill="${tones[Math.floor(rnd() * tones.length)]}"/>`;
  }
  let glints = '';
  for (let i = 0; i < 26; i++) {
    const x = 70 + rnd() * 260, y = 120 + rnd() * 200;
    glints += leaf(x, y, 6 + rnd() * 5, rnd() * 360, warm ? '#6F8F5E' : '#4E6E58');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
    <path d="M188 500 C190 420 186 360 192 300 L208 300 C212 360 210 420 214 500 Z" fill="#2A211C"/>
    <path d="M196 340 C170 310 150 290 130 270 M204 330 C230 300 250 285 274 262" stroke="#2A211C" stroke-width="10" fill="none" stroke-linecap="round"/>
    ${canopy}${glints}
  </svg>`;
}

export function foliageSVG(seed) {
  const rnd = seeded(seed);
  let s = '';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 400, y = 120 + rnd() * 180, len = 30 + rnd() * 34;
    s += leaf(x, y, len, -120 + rnd() * 80, ['#0E1712', '#132019', '#18281F'][Math.floor(rnd() * 3)]);
  }
  for (let i = 0; i < 6; i++) s += `<path d="M${W(rnd() * 400)} 300 Q${W(rnd() * 400)} ${W(160 + rnd() * 60)} ${W(rnd() * 400)} ${W(60 + rnd() * 80)}" stroke="#101A14" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><filter id="b"><feGaussianBlur stdDeviation="2.2"/></filter></defs><g filter="url(#b)">${s}</g></svg>`;
}

export function treelineSVG(seed) {
  const rnd = seeded(seed);
  let s = '';
  for (let x = -20; x < 1220; x += 26 + rnd() * 30) {
    const h = 60 + rnd() * 90, r = 28 + rnd() * 34;
    s += `<ellipse cx="${W(x)}" cy="${W(200 - h)}" rx="${W(r)}" ry="${W(r * 1.25)}"/><rect x="${W(x - r)}" y="${W(200 - h)}" width="${W(r * 2)}" height="${W(h)}"/>`;
  }
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
  r.addColorStop(0, 'rgba(255,246,220,1)'); r.addColorStop(0.25, 'rgba(255,218,150,.55)'); r.addColorStop(0.6, 'rgba(255,190,120,.14)'); r.addColorStop(1, 'rgba(255,180,110,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});

export const sparkleTexture = () => canvasTex(64, (g, s) => {
  const c = s / 2;
  const r = g.createRadialGradient(c, c, 0, c, c, c);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,240,210,.6)'); r.addColorStop(1, 'rgba(255,230,190,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(255,250,235,.9)';
  g.beginPath(); g.moveTo(c, 2); g.quadraticCurveTo(c + 2, c - 2, s - 2, c); g.quadraticCurveTo(c + 2, c + 2, c, s - 2); g.quadraticCurveTo(c - 2, c + 2, 2, c); g.quadraticCurveTo(c - 2, c - 2, c, 2); g.fill();
});

export const petalTexture = () => canvasTex(32, (g) => {
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(16, 16, 12, 7, 0.6, 0, Math.PI * 2); g.fill();
});
