// "The Shared Garden" — the couple's story, told in a courtyard garden.
//
// The scene is a function of one number: planning progress (0…1) from
// core/progress.js. It starts at the current state on load (no replay) and
// only animates when progress changes via the `rk:progress` event.
//
//   0.00  dusk in a sandstone courtyard; bride and groom apart, a runner between them
//   0.05+ planning begins: the runner lights up, bougainvillea and planters bloom
//   0.35+ the plan takes shape: the pavilion forms, jaali screens and lanterns glow
//   0.70+ the wedding approaches: loved ones join, one by one
//   1.00  plan complete: the courtyard at its most luminous; together, hand in hand
//
// Layout adapts to the container: wide screens place the couple right of the
// content column; narrow screens in the upper half; `layout:'card'` centres
// them for the planner's small preview.

import * as THREE from 'three';
import { DEFAULT_CONFIG } from './config.js';
import {
  loadCharacter, svgTexture, courtyardSVG, pavilionSVG, rugSVG, lanternSVG, planterSVG, vineSVG,
  champaTreeSVG, foliageSVG, treelineSVG, glowTexture, sparkleTexture, petalTexture,
} from './art.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function seeded(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const VIEW_H = 10;
const ARCHES = 11;

// ---------- materials ----------
const VERT = 'varying vec2 vUv; varying float vY; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }';

function spriteMaterial(tex, additive = false, fromTop = false) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, opacity: { value: 1 }, reveal: { value: 1.2 }, fromTop: { value: fromTop ? 1 : 0 }, tint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D map; uniform float opacity; uniform float reveal; uniform float fromTop; uniform vec3 tint; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(map, vUv);
        float v = mix(vUv.y, 1.0 - vUv.y, fromTop);
        float r = 1.0 - smoothstep(reveal - 0.08, reveal, v);
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

// The lit runner: softly present from the start; lights from both ends inward.
function pathMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { glow: { value: 0 }, time: { value: 0 }, warm: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: `uniform float glow; uniform float time; uniform float warm; varying vec2 vUv;
      void main(){
        float d = abs(vUv.x - 0.5) * 2.0;
        float lit = smoothstep(1.0 - glow - 0.08, 1.0 - glow + 0.02, d);
        float edge = pow(sin(vUv.y * 3.14159), 1.4);
        float shimmer = 0.78 + 0.22 * sin(vUv.x * 60.0 - time * 1.4);
        float fade = smoothstep(1.0, 0.92, d);
        vec3 col = mix(vec3(0.9, 0.74, 0.6), vec3(1.0, 0.8, 0.5), warm);
        float a = (0.1 + lit * 0.55 * shimmer) * edge * fade;
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
    { top: C('#1B2150'), mid: C('#43477C'), low: C('#C98E78') },   // indigo dusk, anticipation
    { top: C('#262A60'), mid: C('#7C5784'), low: C('#F4C489') },   // luminous celebration
  ],
  floor: [{ top: C('#8A7466'), low: C('#2A2640') }, { top: C('#C9A27A'), low: C('#4A3A3E') }],
  coolLight: C('#BDB8D8'), warmLight: C('#FFF1DC'),
  wallCool: C('#A6A2C8'), wallWarm: C('#F6DEBE'),
  greenCool: C('#8E95B8'), greenWarm: C('#E6D9B8'),
};

// ---------- scene ----------
export function mountGarden(canvas, { progress = 0, layout = 'auto', config = DEFAULT_CONFIG } = {}) {
  if (!canvas) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    canvas.parentElement?.classList.add('garden-fallback');
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

  const L = { viewW: 10, focusX: 0, groundY: -2.5, figH: 3.5, spread: 3, U: 1, wide: false, wallBase: 0, wallH: 4, module: 1 };
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

  // Sky and floor exist immediately so the page never flashes empty.
  const skyMat = gradientMaterial();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(400, 40), skyMat);
  sky.renderOrder = 0;
  scene.add(sky);
  const floorMat = gradientMaterial();
  const floor = new THREE.Mesh(PLANE_BOTTOM, floorMat);
  floor.renderOrder = 30;
  groups.far.add(floor);

  // ---------- layout ----------
  function computeLayout() {
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    const aspect = w / h;
    L.viewW = VIEW_H * aspect;
    L.wide = false;
    if (layout === 'card') {
      L.focusX = 0; L.groundY = -3.3; L.figH = 3.6; L.spread = Math.min(L.viewW * 0.25, 3.2);
    } else if (w >= 760 && aspect > 1.05) {
      L.wide = true;
      const chapter = mode === 'chapter';
      L.focusX = -L.viewW / 2 + L.viewW * (chapter ? 0.81 : 0.71); L.groundY = -2.9; L.figH = chapter ? 3.3 : 3.6;
      L.spread = Math.min(L.viewW * (chapter ? 0.095 : 0.14), chapter ? 2.4 : 3.2);
    } else {
      L.focusX = 0; L.groundY = 0.35; L.figH = Math.min(2.9, L.viewW * 0.62); L.spread = Math.min(L.viewW * 0.29, 2.3);
    }
    L.U = L.figH / 3.6;
    L.wallBase = L.groundY + 0.62 * L.U;
    L.wallH = L.figH * 1.3;
    L.module = (L.wallH * (ARCHES * 200 / 420)) / ARCHES;
    camera.left = -L.viewW / 2; camera.right = L.viewW / 2; camera.top = VIEW_H / 2; camera.bottom = -VIEW_H / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 2));
    renderer.setSize(w, h, false);

    skyMat.uniforms.y0.value = L.wallBase + L.wallH * 0.5; skyMat.uniforms.y1.value = VIEW_H / 2 + 0.5;
    floor.position.set(0, -VIEW_H / 2 - 1, 0); floor.scale.set(400, L.wallBase + VIEW_H / 2 + 1.05, 1);
    floorMat.uniforms.y0.value = -VIEW_H / 2; floorMat.uniforms.y1.value = L.wallBase;
    if (S.ready) placeStatic();
  }

  // Positions that only change with layout.
  function placeStatic() {
    const { focusX: f, groundY: g, figH, spread, U, wallBase, wallH, module } = L;
    const fit = (m, art, h) => m.scale.set(h * art.aspect, h, 1);
    const sq = (u) => (L.wide && u < 0 ? u * 0.62 : u); // compress the side nearest the text column
    const wallTop = wallBase + wallH;

    S.treeline.position.set(f, wallTop - 0.25 * U, 0);
    S.treeline.scale.set(L.viewW * 1.6 + 6, 1.1 * U, 1);
    S.horizonGlow.position.set(f, wallTop + 0.1 * U, 0);
    S.wall.position.set(f, wallBase, 0); fit(S.wall, S.wallArt, wallH);
    S.jaali.position.set(f, wallBase, 0); fit(S.jaali, S.jaaliArt, wallH);
    S.groundGlow.position.set(f, g - 0.1 * U, 0);
    S.groundGlow.scale.set(spread * 5.2, 2.2 * U, 1);

    // hanging lanterns at the arch apexes
    const apex = wallBase + wallH * (1 - 124 / 420);
    S.hanging.forEach((l) => {
      const x = f + l.k * module;
      const h = 1.05 * U;
      l.mesh.position.set(x, apex - 0.02 - h, 0);
      fit(l.mesh, S.chainArt, h);
      l.glow.position.set(x, apex - h * 0.55, 0);
      l.glow.scale.setScalar(1.5 * U);
      l.mesh.visible = l.glow.visible = !(L.wide && l.k < -1);
    });

    // bougainvillea over the parapet, at the pilasters
    S.vines.forEach((v) => {
      const h = 1.8 * U;
      v.mesh.position.set(f + v.k * module, wallTop - 0.22 * U - h, 0);
      fit(v.mesh, v.art, h);
      v.mesh.scale.x *= v.flip;
      v.mesh.visible = !(L.wide && v.k < -1);
    });

    const treeX = isSmall() ? L.viewW * 0.52 : spread * 2.2;
    S.trees.forEach((t, i) => {
      const side = i === 0 ? -1 : 1;
      // on wide layouts the left tree stands at the far edge, behind the text scrim
      const tx = L.wide && side < 0 ? -L.viewW / 2 + 0.6 * U : f + side * treeX;
      t.mesh.position.set(tx, wallBase - 0.2 * U, 0);
      fit(t.mesh, t.art, 5.4 * U);
      t.mesh.scale.x *= side;
    });

    // string of lights across the courtyard
    const x0 = L.wide ? f - spread * 1.2 : f - treeX + 0.9 * U, x1 = f + treeX - 0.9 * U, y = g + 4.35 * U, sag = 0.7 * U;
    const wire = [];
    S.bulbs.forEach((b, i) => {
      const u = (i + 0.5) / S.bulbs.length;
      b.base = [lerp(x0, x1, u), y - Math.sin(u * Math.PI) * sag];
    });
    for (let i = 0; i <= 30; i++) { const u = i / 30; wire.push(new THREE.Vector3(lerp(x0, x1, u), y - Math.sin(u * Math.PI) * sag + 0.04, 0)); }
    S.wire.geometry.setFromPoints(wire);

    S.pavilion.position.set(f, g + 0.14 * U, 0);
    fit(S.pavilion, S.pavilionArt, figH * 1.62);

    // runner rug between the couple, with the lit path over it
    const rw = spread * 3.5, rh = rw / S.rugArt.aspect;
    S.rug.position.set(f, g - 0.3 * U, 0);
    S.rug.scale.set(rw, rh, 1);
    S.path.position.set(f, g - 0.3 * U + rh * 0.5, 0);
    S.path.scale.set(rw * 0.94, rh * 0.7, 1);
    S.strewn.forEach((pt) => {
      pt.m.position.set(f + (pt.u - 0.5) * rw * 0.9, g - 0.3 * U + rh * (0.25 + pt.v * 0.5), 0);
      pt.m.scale.set(0.09 * U, 0.06 * U, 1);
    });

    S.planters.forEach((pl) => {
      const x = f + sq(pl.u) * spread * 1.8;
      const yy = pl.dy > 0 ? wallBase - 0.05 * U : g + pl.dy * U;
      pl.mesh.position.set(x, yy, 0);
      fit(pl.mesh, pl.art, pl.size * U);
      pl.mesh.scale.x *= pl.flip;
    });

    S.lanterns.forEach((l) => {
      const x = f + sq(l.u) * spread;
      const yy = g + l.dy * U;
      l.mesh.position.set(x, yy, 0);
      fit(l.mesh, S.lanternArt, 0.6 * U);
      l.glow.position.set(x, yy + 0.38 * U, 0);
      l.glow.scale.set(1.25 * U, 1.25 * U, 1);
    });

    S.flies.forEach((fl) => { fl.base = [f + sq(fl.r1 - 0.5) * spread * 5, g + fl.r2 * figH * 1.7]; });
    S.stars.forEach((s) => {
      s.mesh.position.set((s.r1 - 0.5) * L.viewW * 1.2, wallTop + 1.2 * U + s.r2 * Math.max(0.5, VIEW_H / 2 - wallTop - 1.2 * U), 0);
    });

    const small = isSmall();
    S.foliage.forEach((fo, i) => {
      const side = i === 0 ? -1 : 1;
      const h = (small ? 1.5 : 2.4) * U;
      fo.position.set(side * (L.viewW / 2 - h * 0.7), -VIEW_H / 2 - 0.2, 0);
      fit(fo, S.foliageArt, h);
      fo.scale.x *= -side;
      fo.visible = !(small && layout !== 'card') || i === 1;
    });
  }

  // ---------- assets ----------
  // Every mesh is created up front with a blank texture; artwork fills in as
  // it rasterises — the courtyard and the couple first, the rest just after.
  const BLANK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  BLANK.needsUpdate = true;
  const slot = (aspect = 0.5) => ({ tex: BLANK, aspect, meshes: [] });
  const fill = (art, loaded) => {
    art.tex = loaded.tex; art.aspect = loaded.aspect;
    art.meshes.forEach((m) => { m.material.uniforms.map.value = loaded.tex; });
    if (S.ready) placeStatic();
  };
  const artMesh = (art, order, centered, group, additive = false, fromTop = false) => {
    const m = mesh(spriteMaterial(art.tex, additive, fromTop), order, centered, group);
    art.meshes.push(m);
    return m;
  };

  async function build() {
    const small = isSmall();
    // rasterise at roughly on-screen size
    const ppu = (host.clientHeight / VIEW_H) * Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    const px = (units, max) => Math.max(120, Math.min(max, Math.round(units * ppu * 1.1)));
    const charPx = px(L.figH, 900);

    const glow = glowTexture(), sparkle = sparkleTexture(), petal = petalTexture();
    const wallAspect = ARCHES * 200 / 420;
    const A = {
      treeline: slot(6), wall: slot(wallAspect), jaali: slot(wallAspect), tree1: slot(0.8), tree2: slot(0.8),
      pavilion: slot(420 / 480), rug: slot(1000 / 70), lantern: slot(60 / 114), chain: slot(60 / 150), foliage: slot(4 / 3),
      brideA: slot(0.5), brideB: slot(0.5), groomA: slot(200 / 480), groomB: slot(200 / 480),
      planters: config.planters.map(() => slot(0.8)),
      vines: [0, 1, 2].map(() => slot(200 / 260)),
      guests: config.guests.map(() => slot(0.4)),
    };

    S.treeline = artMesh(A.treeline, 35, false, groups.far);
    S.horizonGlow = mesh(spriteMaterial(glow, true), 20, true, groups.far);
    S.wallArt = A.wall; S.jaaliArt = A.jaali;
    S.wall = artMesh(A.wall, 40, false, groups.far);
    S.jaali = artMesh(A.jaali, 41, false, groups.far, true);
    S.chainArt = A.chain;
    S.hanging = [-3, -2, -1, 1, 2, 3].map((k) => ({ k, t: 0.5 + Math.abs(k) * 0.1 + (k < 0 ? 0.04 : 0), phase: rand() * 6, mesh: artMesh(A.chain, 44, false, groups.far), glow: mesh(spriteMaterial(glow, true), 45, true, groups.far) }));
    S.vines = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].slice(small ? 1 : 0, small ? 5 : 6).map((k, i) => ({ k, flip: i % 2 ? -1 : 1, art: A.vines[i % 3], t: 0.08 + i * 0.07, mesh: artMesh(A.vines[i % 3], 46, false, groups.far, false, true) }));
    S.groundGlow = mesh(spriteMaterial(glow, true), 79, true, groups.mid);
    S.trees = [A.tree1, A.tree2].map((art) => ({ art, mesh: artMesh(art, 70, false, groups.mid) }));
    S.wire = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#2A2238', transparent: true, opacity: 0, depthTest: false }));
    S.wire.renderOrder = 75;
    groups.mid.add(S.wire);
    const nb = small ? 11 : 17;
    S.bulbs = Array.from({ length: nb }, (_, i) => ({ t: 0.5 + (i / nb) * 0.4, phase: rand() * 6, base: [0, 0], mesh: mesh(spriteMaterial(sparkle, true), 76, true) }));

    S.pavilionArt = A.pavilion;
    S.pavilion = artMesh(A.pavilion, 90);
    S.rugArt = A.rug;
    S.rug = artMesh(A.rug, 80);
    S.path = mesh(pathMaterial(), 82, true);
    const strewnColors = ['#F4A93A', '#E8902A', '#FFF6E8', '#C23A78'];
    S.strewn = Array.from({ length: small ? 14 : 24 }, (_, i) => {
      const m = mesh(spriteMaterial(petal), 83, true);
      m.material.uniforms.tint.value.set(strewnColors[i % strewnColors.length]);
      return { m, u: rand(), v: rand(), t: 0.1 + rand() * 0.6, spin: rand() * 6 };
    });

    // planters: along the wall (dy>0) and in the foreground (dy<0)
    const spots = [
      [-0.45, 1, 1.15], [0.45, 1, 1.15], [-1.25, 1, 1.25], [1.25, 1, 1.25],
      [-1.05, -0.42, 1.35], [1.1, -0.45, 1.4], [-1.85, -0.5, 1.45], [1.9, -0.48, 1.45],
      [-2.1, 1, 1.2], [2.15, 1, 1.2],
    ].slice(0, small ? 8 : 10);
    S.planters = spots.map(([u, dy, size], i) => {
      const art = A.planters[i % A.planters.length];
      return { u, dy, size, flip: rand() < 0.5 ? 1 : -1, art, t: 0.08 + (i / spots.length) * 0.55 + rand() * 0.04, mesh: artMesh(art, dy > 0 ? 92 : 150) };
    });

    S.lanternArt = A.lantern;
    S.lanterns = [-1.55, 1.55, -0.6, 0.6, -2.3, 2.3].map((u, i) => ({
      u, dy: -0.36, t: 0.4 + i * 0.065, phase: rand() * 6,
      mesh: artMesh(A.lantern, 145),
      glow: mesh(spriteMaterial(glow, true), 146, true),
    }));

    S.bride = [{ art: A.brideA, mesh: artMesh(A.brideA, 130) }, { art: A.brideB, mesh: artMesh(A.brideB, 131) }];
    S.groom = [{ art: A.groomA, mesh: artMesh(A.groomA, 132) }, { art: A.groomB, mesh: artMesh(A.groomB, 133) }];

    S.guests = config.guests.map((g, i) => {
      const order = g.row === 'back' ? 118 : g.row === 'front' ? 140 : 125;
      return { ...g, art: A.guests[i], mesh: artMesh(A.guests[i], order + i * 0.01) };
    });

    S.flies = Array.from({ length: small ? 18 : 40 }, () => ({ r1: rand(), r2: rand(), phase: rand() * 6, speed: 0.3 + rand() * 0.5, size: 0.06 + rand() * 0.09, base: [0, 0], mesh: mesh(spriteMaterial(sparkle, true), 170, true) }));
    S.stars = Array.from({ length: small ? 26 : 60 }, () => ({ r1: rand(), r2: rand(), phase: rand() * 6, size: 0.04 + rand() * 0.06, mesh: mesh(spriteMaterial(sparkle, true), 10, true, groups.far) }));
    const petalColors = ['#F4A93A', '#C23A78', '#FFF6E8', '#E8902A', '#D9578E'];
    S.petals = Array.from({ length: small ? 14 : 32 }, (_, i) => {
      const m = mesh(spriteMaterial(petal), 180, true, groups.fg);
      m.material.uniforms.tint.value.set(petalColors[i % petalColors.length]);
      return { m, x: rand(), y: rand(), speed: 0.12 + rand() * 0.18, drift: rand() * 6, size: 0.07 + rand() * 0.06, spin: rand() * 6 };
    });

    S.foliageArt = A.foliage;
    S.foliage = [0, 1].map(() => artMesh(A.foliage, 190, false, groups.fg));

    S.ready = true;
    placeStatic();
    draw();

    const pal = (who, pose) => ({ ...config.couple[who].palette, ...(pose === 'b' ? { '--pose-a': 'none', '--pose-b': 'inline' } : {}) });
    // phase 1: the courtyard and the couple
    await Promise.all([
      svgTexture(treelineSVG(4), 200).then((t) => fill(A.treeline, t)),
      svgTexture(courtyardSVG({ arches: ARCHES }), px(L.wallH, 900)).then((t) => fill(A.wall, t)),
      svgTexture(courtyardSVG({ arches: ARCHES, glow: true }), px(L.wallH, 600)).then((t) => fill(A.jaali, t)),
      svgTexture(rugSVG(), px(0.9 * L.U, 160)).then((t) => fill(A.rug, t)),
      loadCharacter(config.couple.bride.src, pal('bride', 'a'), charPx).then((t) => fill(A.brideA, t)),
      loadCharacter(config.couple.groom.src, pal('groom', 'a'), charPx).then((t) => fill(A.groomA, t)),
    ]);
    host.classList.add('is-ready');
    draw();

    // phase 2: everything the story grows into
    await Promise.all([
      svgTexture(champaTreeSVG(5), px(5.4 * L.U, 760)).then((t) => fill(A.tree1, t)),
      svgTexture(champaTreeSVG(9), px(5.4 * L.U, 760)).then((t) => fill(A.tree2, t)),
      svgTexture(pavilionSVG(), px(L.figH * 1.62, 1000)).then((t) => fill(A.pavilion, t)),
      svgTexture(lanternSVG(), px(0.6 * L.U, 200)).then((t) => fill(A.lantern, t)),
      svgTexture(lanternSVG({ chain: true }), px(1.05 * L.U, 260)).then((t) => fill(A.chain, t)),
      svgTexture(foliageSVG(3), px(2.4 * L.U, 460)).then((t) => fill(A.foliage, t)),
      ...A.planters.map((art, i) => svgTexture(planterSVG((i + 1) * 7, config.planters[i]), px(1.45 * L.U, 300)).then((t) => fill(art, t))),
      ...A.vines.map((art, i) => svgTexture(vineSVG((i + 3) * 5), px(1.8 * L.U, 360)).then((t) => fill(art, t))),
      loadCharacter(config.couple.bride.src, pal('bride', 'b'), charPx).then((t) => fill(A.brideB, t)),
      loadCharacter(config.couple.groom.src, pal('groom', 'b'), charPx).then((t) => fill(A.groomB, t)),
      ...config.guests.map((g, i) => loadCharacter(config.guestArt[g.type].src, g.palette, Math.round(charPx * config.guestArt[g.type].height)).then((t) => fill(A.guests[i], t))),
    ]);
    draw();
  }

  // ---------- per-frame story ----------
  function update(p, dt, moving) {
    const motion = !reduceMQ.matches;
    const { focusX: f, groundY: g, figH, spread, U } = L;
    const finale = smooth(0.97, 1, p);
    const warmth = Math.min(1, 0.2 + 0.58 * p + 0.22 * finale);
    const skyT = Math.min(1, 0.7 * p + 0.3 * finale);

    skyMat.uniforms.top.value.lerpColors(PALETTE.sky[0].top, PALETTE.sky[1].top, skyT);
    skyMat.uniforms.mid.value.lerpColors(PALETTE.sky[0].mid, PALETTE.sky[1].mid, skyT);
    skyMat.uniforms.low.value.lerpColors(PALETTE.sky[0].low, PALETTE.sky[1].low, skyT);
    floorMat.uniforms.top.value.lerpColors(PALETTE.floor[0].top, PALETTE.floor[1].top, warmth);
    floorMat.uniforms.mid.value.lerpColors(PALETTE.floor[0].top, PALETTE.floor[1].top, warmth).multiplyScalar(0.72);
    floorMat.uniforms.low.value.lerpColors(PALETTE.floor[0].low, PALETTE.floor[1].low, warmth);
    if (!S.ready) return;

    const light = new THREE.Color().lerpColors(PALETTE.coolLight, PALETTE.warmLight, warmth);
    const wallLight = new THREE.Color().lerpColors(PALETTE.wallCool, PALETTE.wallWarm, warmth);
    const greenLight = new THREE.Color().lerpColors(PALETTE.greenCool, PALETTE.greenWarm, warmth);
    const twinkle = (ph, sp = 2) => (motion ? 0.65 + 0.35 * Math.sin(time * sp + ph) : 1);

    S.horizonGlow.scale.set((9 + 4 * finale) * U, (5 + 2 * finale) * U, 1);
    S.horizonGlow.material.uniforms.opacity.value = 0.35 + 0.25 * p + 0.4 * finale;
    S.groundGlow.material.uniforms.opacity.value = 0.18 + 0.4 * p + 0.3 * finale;
    S.treeline.material.uniforms.tint.value.lerpColors(C('#28324E'), C('#40504A'), warmth);
    S.wall.material.uniforms.tint.value.copy(wallLight);
    S.jaali.material.uniforms.opacity.value = (0.06 + 0.46 * smooth(0.18, 0.85, p) + 0.1 * finale) * (motion ? 0.94 + 0.06 * Math.sin(time * 1.2) : 1);
    S.trees.forEach((t) => t.mesh.material.uniforms.tint.value.copy(greenLight));

    S.stars.forEach((s) => {
      s.mesh.scale.setScalar(s.size);
      s.mesh.material.uniforms.opacity.value = (0.5 - 0.25 * finale) * twinkle(s.phase, 1.3);
    });

    S.hanging.forEach((l) => {
      const lit = smooth(l.t, l.t + 0.06, p);
      l.mesh.material.uniforms.tint.value.copy(wallLight);
      l.glow.material.uniforms.opacity.value = lit * (0.75 + 0.25 * finale) * (motion ? 0.9 + 0.1 * Math.sin(time * 2.6 + l.phase) : 1);
    });

    S.vines.forEach((v) => {
      v.mesh.material.uniforms.reveal.value = smooth(v.t, v.t + 0.14, p) * 1.1;
      v.mesh.material.uniforms.tint.value.copy(greenLight);
    });

    // runner: softly present from the start, lights from both ends inward
    S.rug.material.uniforms.tint.value.copy(light);
    S.path.material.uniforms.glow.value = smooth(0.04, 0.45, p);
    S.path.material.uniforms.time.value = motion ? time : 0;
    S.path.material.uniforms.warm.value = warmth;
    S.strewn.forEach((pt) => {
      pt.m.material.uniforms.opacity.value = smooth(pt.t, pt.t + 0.05, p) * 0.95;
      pt.m.rotation.z = pt.spin;
    });

    // pavilion / gathering space forms
    S.pavilion.material.uniforms.reveal.value = smooth(0.34, 0.66, p) * 1.1;
    S.pavilion.material.uniforms.tint.value.copy(light);

    S.planters.forEach((pl) => {
      pl.mesh.material.uniforms.reveal.value = smooth(pl.t, pl.t + 0.09, p) * 1.1;
      pl.mesh.material.uniforms.tint.value.copy(light);
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
      b.mesh.scale.setScalar((0.3 + 0.1 * finale) * U);
      b.mesh.material.uniforms.opacity.value = k * twinkle(b.phase, 2.4);
    });
    S.wire.material.opacity = anyBulb * 0.6;

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

    // glistening motes: a few from the start, more by the end
    const visible = 0.15 + 0.85 * smooth(0.08, 1, p);
    S.flies.forEach((fl, i) => {
      const on = i / S.flies.length < visible ? 1 : 0;
      const dx = motion ? Math.sin(time * fl.speed + fl.phase) * 0.35 : 0;
      const dy = motion ? Math.cos(time * fl.speed * 0.8 + fl.phase) * 0.22 : 0;
      fl.mesh.position.set(fl.base[0] + dx, fl.base[1] + dy, 0);
      fl.mesh.scale.setScalar(fl.size * U * (1 + finale * 0.4));
      fl.mesh.material.uniforms.opacity.value = on * twinkle(fl.phase, 2.8) * (0.6 + 0.3 * warmth);
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

    S.foliage.forEach((fo) => fo.material.uniforms.tint.value.copy(greenLight).multiplyScalar(0.6));

    // gentle pointer parallax
    px += (pxTarget - px) * Math.min(1, dt * 3);
    groups.far.position.x = -px * 0.1;
    groups.mid.position.x = -px * 0.22;
    groups.fg.position.x = -px * 0.55;
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
  if (finePointer && layout !== 'card') window.addEventListener('pointermove', onPointer, { passive: true });
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
