// "The Shared Garden" — the couple's story, told in a Three.js garden.
//
// The whole scene is a function of one number: planning progress (0…1) from
// core/progress.js. It starts at the current state on load (no replay) and
// only animates when progress changes via the `rk:progress` event.
//
//   0.00  dusk; the bride and groom stand apart, a softly lit path between them
//   0.05+ planning begins: the path lights up, flowers and leaves appear
//   0.35+ the plan takes shape: the arch grows, lanterns glow, they draw closer
//   0.70+ the wedding approaches: loved ones join, one by one
//   1.00  plan complete: the garden at its most luminous; together, hand in hand
//
// Layout adapts to the container: wide screens place the couple right of the
// content column; narrow screens place them in the upper half; `layout:'card'`
// centres them for the agent's preview card.

import * as THREE from 'three';
import { DEFAULT_CONFIG } from './config.js';
import { loadCharacter, svgTexture, archSVG, flowerClusterSVG, lanternSVG, treeSVG, foliageSVG, treelineSVG, glowTexture, sparkleTexture, petalTexture } from './art.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function seeded(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const VIEW_H = 10;

// ---------- materials ----------
const VERT = 'varying vec2 vUv; varying float vY; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }';

function spriteMaterial(tex, additive = false) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, opacity: { value: 1 }, reveal: { value: 1.2 }, tint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D map; uniform float opacity; uniform float reveal; uniform vec3 tint; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(map, vUv);
        float r = 1.0 - smoothstep(reveal - 0.08, reveal, vUv.y);
        gl_FragColor = vec4(c.rgb * tint, c.a * opacity * r);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function gradientMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() }, y0: { value: 0 }, y1: { value: 5 } },
    vertexShader: VERT,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform float y0; uniform float y1; varying float vY;
      void main(){
        float t = clamp((vY - y0) / (y1 - y0), 0.0, 1.0);
        vec3 c = t < 0.45 ? mix(low, mid, t / 0.45) : mix(mid, top, (t - 0.45) / 0.55);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
}

function pathMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { glow: { value: 0 }, time: { value: 0 }, warm: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: `uniform float glow; uniform float time; uniform float warm; varying vec2 vUv;
      void main(){
        float d = abs(vUv.x - 0.5) * 2.0;                 // 1 at the ends, 0 at the centre
        float lit = smoothstep(1.0 - glow - 0.08, 1.0 - glow + 0.02, d);
        float edge = pow(sin(vUv.y * 3.14159), 1.6);
        float shimmer = 0.75 + 0.25 * sin(vUv.x * 70.0 - time * 1.6);
        float fade = smoothstep(1.0, 0.9, d);
        vec3 col = mix(vec3(0.85, 0.72, 0.62), vec3(1.0, 0.82, 0.55), warm);
        float a = (0.16 + lit * 0.7 * shimmer) * edge * fade;
        gl_FragColor = vec4(col * a, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

const PLANE_BOTTOM = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
const PLANE_CENTER = new THREE.PlaneGeometry(1, 1);

const C = (hex) => new THREE.Color(hex);
const PALETTE = {
  sky: [
    { top: C('#100E1D'), mid: C('#2B2140'), low: C('#6A4761') },   // quiet anticipation
    { top: C('#1D1530'), mid: C('#56325A'), low: C('#E89A6C') },   // luminous celebration
  ],
  lawn: [{ top: C('#2C3B36'), low: C('#101614') }, { top: C('#45503B'), low: C('#1A1C15') }],
  coolLight: C('#AFAACB'), warmLight: C('#FFF1DE'),
  sceneryCool: C('#7D80A6'), sceneryWarm: C('#D9C3A0'),
};

// ---------- scene ----------
export function mountGarden(canvas, { progress = 0, layout = 'auto', config = DEFAULT_CONFIG } = {}) {
  if (!canvas) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    canvas.closest('.garden')?.classList.add('garden-fallback');
    return null;
  }
  const host = canvas.parentElement;
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const isSmall = () => host.clientWidth < 720;
  const rand = seeded(23);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, -10, 10);
  const groups = { far: new THREE.Group(), mid: new THREE.Group(), fg: new THREE.Group() };
  Object.values(groups).forEach((g) => scene.add(g));

  const L = { viewW: 10, focusX: 0, groundY: -2.5, horizonY: -0.8, figH: 3.5, spread: 3, U: 1, wide: false };
  const S = { ready: false };
  let target = progress, shown = progress, lastShown = progress, time = 0, raf = 0, last = performance.now();
  let px = 0, pxTarget = 0;
  let mode = 'home'; // 'chapter' moves the couple further right, clear of the content panel

  const mesh = (mat, order, centered = false, group = groups.mid) => {
    const m = new THREE.Mesh(centered ? PLANE_CENTER : PLANE_BOTTOM, mat);
    m.renderOrder = order;
    group.add(m);
    return m;
  };

  // Sky and lawn exist immediately so the page never flashes empty.
  const skyMat = gradientMaterial();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(400, 40), skyMat);
  sky.renderOrder = 0;
  scene.add(sky);
  const lawnMat = gradientMaterial();
  const lawn = new THREE.Mesh(PLANE_BOTTOM, lawnMat);
  lawn.renderOrder = 60;
  groups.far.add(lawn);
  const hillMats = [new THREE.MeshBasicMaterial({ color: '#1F1A31', transparent: true, depthTest: false, depthWrite: false }), new THREE.MeshBasicMaterial({ color: '#1A2424', transparent: true, depthTest: false, depthWrite: false })];
  const hills = hillMats.map((m, i) => { const h = new THREE.Mesh(new THREE.BufferGeometry(), m); h.renderOrder = 30 + i * 10; groups.far.add(h); return h; });

  function hillGeometry(base, amp, freq, phase) {
    const s = new THREE.Shape();
    s.moveTo(-60, base - 20);
    for (let x = -60; x <= 60; x += 0.4) s.lineTo(x, base + amp * Math.sin(x * freq + phase) + amp * 0.45 * Math.sin(x * freq * 2.7 + phase * 1.3));
    s.lineTo(60, base - 20);
    return new THREE.ShapeGeometry(s);
  }

  // ---------- layout ----------
  function computeLayout() {
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    const aspect = w / h;
    L.viewW = VIEW_H * aspect;
    L.wide = false;
    if (layout === 'card') {
      L.focusX = 0; L.groundY = -3.1; L.figH = 3.9; L.spread = Math.min(L.viewW * 0.25, 3.3);
    } else if (w >= 760 && aspect > 1.05) {
      L.wide = true;
      const chapter = mode === 'chapter';
      L.focusX = -L.viewW / 2 + L.viewW * (chapter ? 0.81 : 0.71); L.groundY = -2.7; L.figH = chapter ? 3.3 : 3.6;
      L.spread = Math.min(L.viewW * (chapter ? 0.095 : 0.14), chapter ? 2.4 : 3.2);
    } else {
      L.focusX = 0; L.groundY = 0.55; L.figH = Math.min(2.9, L.viewW * 0.62); L.spread = Math.min(L.viewW * 0.29, 2.3);
    }
    L.U = L.figH / 3.6;
    L.horizonY = L.groundY + L.figH * 0.42;
    camera.left = -L.viewW / 2; camera.right = L.viewW / 2; camera.top = VIEW_H / 2; camera.bottom = -VIEW_H / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 2));
    renderer.setSize(w, h, false);

    skyMat.uniforms.y0.value = L.horizonY - 0.6; skyMat.uniforms.y1.value = VIEW_H / 2;
    lawn.position.set(0, -VIEW_H / 2 - 1, 0); lawn.scale.set(400, L.horizonY + VIEW_H / 2 + 1.2, 1);
    lawnMat.uniforms.y0.value = -VIEW_H / 2; lawnMat.uniforms.y1.value = L.horizonY + 0.2;
    hills[0].geometry.dispose(); hills[0].geometry = hillGeometry(L.horizonY + 0.35 * L.U, 0.35 * L.U, 0.32 / L.U, 1.2);
    hills[1].geometry.dispose(); hills[1].geometry = hillGeometry(L.horizonY - 0.05, 0.16 * L.U, 0.5 / L.U, 2.6);
    if (S.ready) placeStatic();
  }

  // Positions that only change with layout.
  function placeStatic() {
    const { focusX: f, groundY: g, figH, spread, U, horizonY } = L;
    const fit = (m, tex, h) => m.scale.set(h * tex.aspect, h, 1);
    const sq = (u) => (L.wide && u < 0 ? u * 0.62 : u); // compress the side nearest the text column

    S.treeline.position.set(f, horizonY + 0.1 * U, 0);
    S.treeline.scale.set(L.viewW * 1.6 + 6, 1.7 * U, 1);
    S.horizonGlow.position.set(f, horizonY + 0.5 * U, 0);
    S.groundGlow.position.set(f, g - 0.1 * U, 0);
    S.groundGlow.scale.set(spread * 5.2, 2.2 * U, 1);

    const treeX = isSmall() ? L.viewW * 0.5 : spread * 2.15;
    S.trees.forEach((t, i) => {
      const side = i === 0 ? -1 : 1;
      t.mesh.position.set(f + side * treeX, g + 0.4 * U, 0);
      fit(t.mesh, t.art, 5.4 * U);
      t.mesh.scale.x *= side;
    });

    // string lights hang between the trees, above the arch
    // on wide layouts the left anchor stays clear of the text column
    const x0 = L.wide ? f - spread * 1.2 : f - treeX + 0.9 * U, x1 = f + treeX - 0.9 * U, y = g + 4.25 * U, sag = 0.75 * U;
    const wire = [];
    S.bulbs.forEach((b, i) => {
      const u = (i + 0.5) / S.bulbs.length;
      const bx = lerp(x0, x1, u), by = y - Math.sin(u * Math.PI) * sag;
      b.mesh.position.set(bx, by, 0);
      b.base = [bx, by];
    });
    for (let i = 0; i <= 30; i++) { const u = i / 30; wire.push(new THREE.Vector3(lerp(x0, x1, u), y - Math.sin(u * Math.PI) * sag + 0.04, 0)); }
    S.wire.geometry.setFromPoints(wire);

    S.arch.position.set(f, g + 0.12 * U, 0);
    fit(S.arch, S.archArt, figH * 1.52);

    // lit path between the couple
    const pw = spread * 3.4, ph = 0.24 * U;
    S.path.position.set(f, g - 0.16 * U, 0);
    S.path.scale.set(pw, ph, 1);
    S.stones.forEach((s, i) => {
      const u = (i + 0.5) / S.stones.length;
      s.position.set(f - pw / 2 + u * pw, g - 0.05 * U, 0);
      s.scale.set(0.3 * U, 0.08 * U, 1);
    });

    S.flowers.forEach((fl) => {
      const x = f + sq(fl.u) * spread * 1.8;
      const y = g + fl.dy * U;
      fl.mesh.position.set(x, y, 0);
      fit(fl.mesh, fl.art, fl.size * U);
      fl.mesh.scale.x *= fl.flip;
    });

    S.lanterns.forEach((l) => {
      const x = f + sq(l.u) * spread;
      const y = g + l.dy * U;
      l.mesh.position.set(x, y, 0);
      fit(l.mesh, S.lanternArt, 0.62 * U);
      l.glow.position.set(x, y + 0.42 * U, 0);
      l.glow.scale.set(1.3 * U, 1.3 * U, 1);
    });

    S.flies.forEach((fl) => {
      fl.base = [f + sq(fl.r1 - 0.5) * spread * 5, g + fl.r2 * figH * 1.7];
    });
    S.stars.forEach((s) => {
      s.mesh.position.set((s.r1 - 0.5) * L.viewW * 1.2, horizonY + 1 + s.r2 * (VIEW_H / 2 - horizonY), 0);
    });

    const small = isSmall();
    S.foliage.forEach((fo, i) => {
      const side = i === 0 ? -1 : 1;
      const h = (small ? 1.6 : 2.6) * U;
      fo.position.set(side * (L.viewW / 2 - h * 0.7), -VIEW_H / 2 - 0.2, 0);
      fit(fo, S.foliageArt, h);
      fo.scale.x *= -side;
      fo.visible = !(small && layout !== 'card') || i === 1;
    });
  }

  // ---------- assets ----------
  // Every mesh is created up front with a blank texture; artwork fills in as
  // it rasterises — sky, trees and the couple first, the rest just after.
  const BLANK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  BLANK.needsUpdate = true;
  const slot = (aspect = 0.5) => ({ tex: BLANK, aspect, meshes: [] });
  const fill = (art, loaded) => {
    art.tex = loaded.tex; art.aspect = loaded.aspect;
    art.meshes.forEach((m) => { m.material.uniforms.map.value = loaded.tex; });
    if (S.ready) placeStatic();
  };
  const artMesh = (art, order, centered, group) => { const m = mesh(spriteMaterial(art.tex), order, centered, group); art.meshes.push(m); return m; };

  async function build() {
    const small = isSmall();
    const flowers = config.flowers;
    // rasterise at roughly on-screen size
    const ppu = (host.clientHeight / VIEW_H) * Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    const px = (units, max) => Math.max(120, Math.min(max, Math.round(units * ppu * 1.1)));
    const charPx = px(L.figH, 900);

    const glow = glowTexture(), sparkle = sparkleTexture(), petal = petalTexture();
    const A = {
      treeline: slot(6), tree1: slot(0.8), tree2: slot(0.8), arch: slot(400 / 460), lantern: slot(0.5), foliage: slot(4 / 3),
      brideA: slot(0.5), brideB: slot(0.5), groomA: slot(200 / 480), groomB: slot(200 / 480),
      flowers: [1, 2, 3, 4, 5].map(() => slot(4 / 3)),
      guests: config.guests.map(() => slot(0.4)),
    };

    S.treeline = artMesh(A.treeline, 35, false, groups.far);
    S.horizonGlow = mesh(spriteMaterial(glow, true), 20, true, groups.far);
    S.groundGlow = mesh(spriteMaterial(glow, true), 80, true, groups.mid);
    S.trees = [A.tree1, A.tree2].map((art) => ({ art, mesh: artMesh(art, 70, false, groups.mid) }));
    S.wire = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#0E0B14', transparent: true, opacity: 0, depthTest: false }));
    S.wire.renderOrder = 75;
    groups.mid.add(S.wire);
    const nb = small ? 11 : 17;
    S.bulbs = Array.from({ length: nb }, (_, i) => ({ t: 0.48 + (i / nb) * 0.42, phase: rand() * 6, mesh: mesh(spriteMaterial(sparkle, true), 76, true) }));

    S.archArt = A.arch;
    S.arch = artMesh(A.arch, 90);
    S.path = mesh(pathMaterial(), 82, true);
    S.stones = Array.from({ length: 16 }, () => { const m = mesh(spriteMaterial(petal), 81, true); m.material.uniforms.tint.value.set('#D8CCB8'); return m; });

    // flower clusters: behind the couple (dy>0) and in front (dy<0)
    const spots = [
      [-0.38, 0.32, 1.0], [0.38, 0.3, 1.0], [-0.62, 0.22, 0.9], [0.66, 0.24, 0.95],
      [-1.05, -0.35, 1.25], [1.05, -0.4, 1.3], [-0.2, -0.55, 1.15], [0.24, -0.6, 1.2],
      [-1.45, 0.18, 1.0], [1.5, 0.2, 1.05], [-1.8, -0.5, 1.35], [1.85, -0.45, 1.3],
      [0, 0.38, 0.85], [-0.85, 0.36, 0.9],
    ].slice(0, small ? 10 : 14);
    S.flowers = spots.map(([u, dy, size], i) => {
      const art = A.flowers[i % A.flowers.length];
      return { u, dy, size, flip: rand() < 0.5 ? 1 : -1, art, t: 0.06 + (i / spots.length) * 0.62 + rand() * 0.04, mesh: artMesh(art, dy > 0 ? 95 : 150) };
    });

    S.lanternArt = A.lantern;
    S.lanterns = [-1.55, 1.55, -0.6, 0.6, -2.3, 2.3].map((u, i) => ({
      u, dy: -0.32, t: 0.4 + i * 0.065, phase: rand() * 6,
      mesh: artMesh(A.lantern, 145),
      glow: mesh(spriteMaterial(glow, true), 146, true),
    }));

    S.bride = [{ art: A.brideA, mesh: artMesh(A.brideA, 130) }, { art: A.brideB, mesh: artMesh(A.brideB, 131) }];
    S.groom = [{ art: A.groomA, mesh: artMesh(A.groomA, 132) }, { art: A.groomB, mesh: artMesh(A.groomB, 133) }];

    S.guests = config.guests.map((g, i) => {
      const order = g.row === 'back' ? 118 : g.row === 'front' ? 140 : 125;
      return { ...g, art: A.guests[i], mesh: artMesh(A.guests[i], order + i * 0.01) };
    });

    S.flies = Array.from({ length: small ? 18 : 42 }, () => ({ r1: rand(), r2: rand(), phase: rand() * 6, speed: 0.3 + rand() * 0.5, size: 0.06 + rand() * 0.1, mesh: mesh(spriteMaterial(sparkle, true), 170, true) }));
    S.stars = Array.from({ length: small ? 30 : 70 }, () => ({ r1: rand(), r2: rand(), phase: rand() * 6, size: 0.04 + rand() * 0.07, mesh: mesh(spriteMaterial(sparkle, true), 10, true, groups.far) }));
    S.petals = Array.from({ length: small ? 14 : 34 }, () => {
      const m = mesh(spriteMaterial(petal), 180, true, groups.fg);
      m.material.uniforms.tint.value.copy(new THREE.Color(flowers[Math.floor(rand() * flowers.length)]));
      return { m, x: rand(), y: rand(), speed: 0.12 + rand() * 0.18, drift: rand() * 6, size: 0.07 + rand() * 0.07, spin: rand() * 6 };
    });

    S.foliageArt = A.foliage;
    S.foliage = [0, 1].map(() => artMesh(A.foliage, 190, false, groups.fg));

    S.ready = true;
    placeStatic();
    draw();

    const pal = (who, pose) => ({ ...config.couple[who].palette, ...(pose === 'b' ? { '--pose-a': 'none', '--pose-b': 'inline' } : {}) });
    // phase 1: the setting and the couple
    await Promise.all([
      svgTexture(treelineSVG(4), 220).then((t) => fill(A.treeline, t)),
      svgTexture(treeSVG(5), px(5.4 * L.U, 800)).then((t) => fill(A.tree1, t)),
      svgTexture(treeSVG(9, true), px(5.4 * L.U, 800)).then((t) => fill(A.tree2, t)),
      loadCharacter(config.couple.bride.src, pal('bride', 'a'), charPx).then((t) => fill(A.brideA, t)),
      loadCharacter(config.couple.groom.src, pal('groom', 'a'), charPx).then((t) => fill(A.groomA, t)),
    ]);
    host.classList.add('is-ready');
    draw();

    // phase 2: everything the story grows into
    await Promise.all([
      svgTexture(archSVG(flowers), px(L.figH * 1.52, 1000)).then((t) => fill(A.arch, t)),
      svgTexture(lanternSVG(), px(0.62 * L.U, 200)).then((t) => fill(A.lantern, t)),
      svgTexture(foliageSVG(3), px(2.6 * L.U, 480)).then((t) => fill(A.foliage, t)),
      ...A.flowers.map((art, i) => svgTexture(flowerClusterSVG((i + 1) * 7, flowers), px(1.35 * L.U, 300)).then((t) => fill(art, t))),
      loadCharacter(config.couple.bride.src, pal('bride', 'b'), charPx).then((t) => fill(A.brideB, t)),
      loadCharacter(config.couple.groom.src, pal('groom', 'b'), charPx).then((t) => fill(A.groomB, t)),
      ...config.guests.map((g, i) => loadCharacter(config.guestArt[g.type].src, g.palette, Math.round(charPx * config.guestArt[g.type].height)).then((t) => fill(A.guests[i], t))),
    ]);
    draw();
  }

  // ---------- per-frame story ----------
  const tmp = new THREE.Color();
  function update(p, dt, moving) {
    const motion = !reduceMQ.matches;
    const { focusX: f, groundY: g, figH, spread, U } = L;
    const finale = smooth(0.97, 1, p);
    const warmth = Math.min(1, 0.18 + 0.6 * p + 0.22 * finale);
    const skyT = Math.min(1, 0.7 * p + 0.3 * finale);

    skyMat.uniforms.top.value.lerpColors(PALETTE.sky[0].top, PALETTE.sky[1].top, skyT);
    skyMat.uniforms.mid.value.lerpColors(PALETTE.sky[0].mid, PALETTE.sky[1].mid, skyT);
    skyMat.uniforms.low.value.lerpColors(PALETTE.sky[0].low, PALETTE.sky[1].low, skyT);
    lawnMat.uniforms.top.value.lerpColors(PALETTE.lawn[0].top, PALETTE.lawn[1].top, warmth);
    lawnMat.uniforms.mid.value.lerpColors(PALETTE.lawn[0].top, PALETTE.lawn[1].top, warmth * 0.8).multiplyScalar(0.7);
    lawnMat.uniforms.low.value.lerpColors(PALETTE.lawn[0].low, PALETTE.lawn[1].low, warmth);
    if (!S.ready) return;

    const light = tmp.lerpColors(PALETTE.coolLight, PALETTE.warmLight, warmth).clone();
    const scenery = new THREE.Color().lerpColors(PALETTE.sceneryCool, PALETTE.sceneryWarm, warmth);
    const twinkle = (ph, sp = 2) => (motion ? 0.65 + 0.35 * Math.sin(time * sp + ph) : 1);

    S.horizonGlow.scale.setScalar((7 + 4 * finale) * U);
    S.horizonGlow.material.uniforms.opacity.value = 0.28 + 0.3 * p + 0.45 * finale;
    S.groundGlow.material.uniforms.opacity.value = 0.22 + 0.45 * p + 0.3 * finale;
    S.treeline.material.uniforms.tint.value.lerpColors(C('#241F38'), C('#4A3550'), warmth);
    S.trees.forEach((t) => t.mesh.material.uniforms.tint.value.copy(scenery));

    S.stars.forEach((s) => {
      s.mesh.scale.setScalar(s.size);
      s.mesh.material.uniforms.opacity.value = (0.55 - 0.25 * finale) * twinkle(s.phase, 1.3);
    });

    // path: softly present from the start, lights up from both ends inward
    S.path.material.uniforms.glow.value = smooth(0.04, 0.45, p);
    S.path.material.uniforms.time.value = motion ? time : 0;
    S.path.material.uniforms.warm.value = warmth;
    S.stones.forEach((s) => { s.material.uniforms.opacity.value = 0.35 + 0.35 * smooth(0.04, 0.45, p); });

    // arch / gathering space forms
    const archK = smooth(0.34, 0.66, p);
    S.arch.material.uniforms.reveal.value = archK * 1.1;
    S.arch.material.uniforms.tint.value.copy(light);

    S.flowers.forEach((fl) => {
      const k = smooth(fl.t, fl.t + 0.09, p);
      fl.mesh.material.uniforms.reveal.value = k * 1.1;
      fl.mesh.material.uniforms.tint.value.copy(light);
    });

    S.lanterns.forEach((l) => {
      const appear = smooth(l.t - 0.06, l.t, p);
      const lit = smooth(l.t, l.t + 0.05, p);
      l.mesh.material.uniforms.opacity.value = appear;
      l.mesh.material.uniforms.tint.value.copy(light);
      l.glow.material.uniforms.opacity.value = lit * (0.75 + 0.25 * finale) * (motion ? 0.88 + 0.12 * Math.sin(time * 3.1 + l.phase) : 1);
    });

    let anyBulb = 0;
    S.bulbs.forEach((b) => {
      const k = smooth(b.t, b.t + 0.04, p);
      anyBulb = Math.max(anyBulb, smooth(b.t - 0.04, b.t, p));
      const sway = motion ? Math.sin(time * 0.8 + b.phase) * 0.02 : 0;
      b.mesh.position.set(b.base[0], b.base[1] + sway, 0);
      b.mesh.scale.setScalar((0.32 + 0.12 * finale) * U);
      b.mesh.material.uniforms.opacity.value = k * twinkle(b.phase, 2.4);
    });
    S.wire.material.opacity = anyBulb * 0.7;

    // the couple: apart, then closer, then together hand in hand at the end
    const gap = spread * lerp(1, 0.34, smooth(0.04, 0.95, p));
    const bx = lerp(f - gap, f - 0.152 * figH, finale);
    const gx = lerp(f + gap, f + 0.158 * figH, finale);
    const breathe = motion ? 1 + Math.sin(time * 1.3) * 0.004 : 1;
    [[S.bride, bx, 0], [S.groom, gx, 1.1]].forEach(([poses, x, ph]) => {
      poses.forEach((c, i) => {
        c.mesh.position.set(x, g + (motion && moving ? Math.abs(Math.sin(time * 7 + ph)) * 0.035 * U : 0), 0);
        c.mesh.scale.set(figH * c.art.aspect, figH * breathe, 1);
        c.mesh.material.uniforms.opacity.value = i === 0 ? 1 - finale : finale;
        c.mesh.material.uniforms.tint.value.copy(light);
      });
    });

    // loved ones arrive as the wedding approaches
    S.guests.forEach((gu) => {
      const k = smooth(gu.at, gu.at + 0.035, p);
      const rowY = gu.row === 'back' ? 0.36 * U : gu.row === 'front' ? -0.3 * U : 0.08 * U;
      const rowS = gu.row === 'back' ? 0.86 : gu.row === 'front' ? 1.04 : 0.97;
      const gx0 = gu.x < 0 && L.wide ? gu.x * 0.74 : gu.x; // keep the bride's side clear of the text
      const home = f + gx0 * spread * (1 - 0.12 * finale);
      const x = lerp(f + gx0 * spread * 1.25, home, k);
      const h = figH * config.guestArt[gu.type].height * rowS;
      const sway = motion ? Math.sin(time * 1.1 + gu.x * 3) * 0.006 : 0;
      gu.mesh.position.set(x, g + rowY - (1 - k) * 0.12 * U, 0);
      gu.mesh.scale.set(h * gu.art.aspect * (x > f ? -1 : 1), h * (1 + sway), 1);
      gu.mesh.material.uniforms.opacity.value = k;
      gu.mesh.material.uniforms.tint.value.copy(light).multiplyScalar(gu.row === 'back' ? 0.9 : 1);
    });

    // glistening motes: a few from the start, many by the end
    const visible = 0.18 + 0.82 * smooth(0.08, 1, p);
    S.flies.forEach((fl, i) => {
      const on = i / S.flies.length < visible ? 1 : 0;
      const dx = motion ? Math.sin(time * fl.speed + fl.phase) * 0.35 : 0;
      const dy = motion ? Math.cos(time * fl.speed * 0.8 + fl.phase) * 0.22 : 0;
      fl.mesh.position.set(fl.base[0] + dx, fl.base[1] + dy, 0);
      fl.mesh.scale.setScalar(fl.size * U * (1 + finale * 0.4));
      fl.mesh.material.uniforms.opacity.value = on * twinkle(fl.phase, 2.8) * (0.7 + 0.3 * warmth);
    });

    // celebration petals, only when the plan is complete
    S.petals.forEach((pt) => {
      if (motion) { pt.y -= pt.speed * dt * 0.12; if (pt.y < 0) pt.y += 1; pt.spin += dt; }
      const x = f + (pt.x - 0.5) * spread * 4.5 + (motion ? Math.sin(time * 0.7 + pt.drift) * 0.3 : 0);
      pt.m.position.set(x, g + pt.y * figH * 1.9, 0);
      pt.m.scale.set(pt.size * U, pt.size * 0.6 * U, 1);
      pt.m.rotation.z = pt.spin;
      pt.m.material.uniforms.opacity.value = finale * 0.9;
    });

    S.foliage.forEach((fo) => fo.material.uniforms.tint.value.copy(scenery).multiplyScalar(0.55));

    // gentle pointer parallax
    px += (pxTarget - px) * Math.min(1, dt * 3);
    groups.far.position.x = -px * 0.12;
    groups.mid.position.x = -px * 0.25;
    groups.fg.position.x = -px * 0.6;
  }

  function draw() {
    update(shown, 0, false);
    renderer.render(scene, camera);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; time += dt;
    lastShown = shown;
    const rate = 0.14;
    shown += Math.max(-rate * dt, Math.min(rate * dt, target - shown));
    update(shown, dt, Math.abs(shown - lastShown) > 1e-5);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    if (reduceMQ.matches) { shown = target; draw(); return; }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const onProgress = (e) => {
    target = Math.max(0, Math.min(1, e.detail.progress));
    if (reduceMQ.matches) { shown = target; draw(); }
  };
  const onMode = (e) => { if (e.detail.mode !== mode) { mode = e.detail.mode; computeLayout(); if (reduceMQ.matches) draw(); } };
  const onPointer = (e) => { pxTarget = (e.clientX / window.innerWidth - 0.5); };
  const onVisibility = () => { if (document.hidden) cancelAnimationFrame(raf); else start(); };
  window.addEventListener('rk:progress', onProgress);
  window.addEventListener('rk:garden-mode', onMode);
  if (finePointer) window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  reduceMQ.addEventListener?.('change', start);
  const ro = new ResizeObserver(() => { computeLayout(); if (reduceMQ.matches) draw(); });
  ro.observe(host);

  computeLayout();
  start();
  build().catch((err) => { console.error('Garden artwork failed to load', err); host.classList.add('is-ready'); });

  return {
    setProgress: (p) => onProgress({ detail: { progress: p } }),
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('rk:progress', onProgress);
      window.removeEventListener('rk:garden-mode', onMode);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
    },
  };
}
