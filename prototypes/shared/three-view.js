// Three.js 3D 렌더러. Q2-A(3D 렌더링)와 Q4(테마 비교)가 공유한다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TOWERS } from './sim.js';
import { FX } from './fx.js';

export const THEMES = {
  sf: {
    name: 'SF 네온', style: 'sf',
    bg: 0x070c16, fog: [0x070c16, 22, 48], exposure: 1.05,
    hemi: [0x9fc8ff, 0x0b1020, 0.55], sun: [0xe8f2ff, 2.0], rim: [0x3fb8ff, 0.8],
    ground: [0x334154, 0x2e3a4b], path: 0x131a26, floor: 0x05080f,
    base: 0xdfe6f0, metal: 0x3a4557, trim: 0x1b2230,
    towerColor: { gun: 0x5fd4ff, cannon: 0xffae4a, frost: 0xa6ecff, laser: 0xff5fd2 },
    enemy: { grunt: 0xff5a4a, runner: 0xffc94a, tank: 0x8f7bff, boss: 0xff3d8b },
    emissive: true, bloom: [0.6, 0.45, 0.8], additive: true, tilt: 0, props: 'sf'
  },
  fantasy: {
    name: '판타지', style: 'fantasy',
    bg: 0x9cc8ee, fog: [0xb4d6f0, 24, 52], exposure: 1.0,
    hemi: [0xfff1d6, 0x46663a, 0.95], sun: [0xfff0d2, 2.6], rim: [0xffc98a, 0.4],
    ground: [0x6ea35a, 0x659a52], path: 0xb28b5a, floor: 0x557f45,
    base: 0xb7b2a6, metal: 0x6b4f35, trim: 0x4a3a2a,
    towerColor: { gun: 0x3f7fd6, cannon: 0xc8463c, frost: 0x7fd8ff, laser: 0x9b5de5 },
    enemy: { grunt: 0x7a9e3a, runner: 0x9a6b3f, tank: 0x7d7f86, boss: 0x8e2c3c },
    emissive: false, bloom: [0.18, 0.4, 0.9], additive: false, tilt: 0, props: 'fantasy'
  },
  toy: {
    name: '미니어처 디오라마', style: 'toy',
    bg: 0xe9d6bc, fog: [0xe9d6bc, 34, 70], exposure: 0.9,
    hemi: [0xfff6ea, 0xb89a78, 0.75], sun: [0xfff1dc, 3.1], rim: [0xffd9b0, 0.4],
    ground: [0x86cc7e, 0x7dc476], path: 0xf0c987, floor: 0xb98e62,
    base: 0xfbf7ee, metal: 0x3d4257, trim: 0xe8e1d3,
    towerColor: { gun: 0x2f8cff, cannon: 0xff5a3c, frost: 0x3fc6e0, laser: 0xa259f5 },
    enemy: { grunt: 0xff4d5e, runner: 0xffb72e, tank: 0x6b7dff, boss: 0xe0348a },
    emissive: false, bloom: [0.08, 0.3, 0.95], additive: false, tilt: 1, props: 'toy'
  }
};

const TiltShiftShader = {
  uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, amount: { value: 0.004 }, focus: { value: 0.52 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 dir; uniform float amount; uniform float focus; varying vec2 vUv;
    void main(){
      float r = clamp(abs(vUv.y - focus) * 2.6 - 0.35, 0.0, 1.0) * amount;
      vec4 c = texture2D(tDiffuse, vUv) * 0.2270270270;
      c += texture2D(tDiffuse, vUv + dir * r * 1.3846153846) * 0.3162162162;
      c += texture2D(tDiffuse, vUv - dir * r * 1.3846153846) * 0.3162162162;
      c += texture2D(tDiffuse, vUv + dir * r * 3.2307692308) * 0.0702702703;
      c += texture2D(tDiffuse, vUv - dir * r * 3.2307692308) * 0.0702702703;
      gl_FragColor = c;
    }`
};

export function createThreeView(container, sim, themeId = 'sf') {
  const th = THEMES[themeId];
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = th.exposure;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(th.bg);
  scene.fog = new THREE.Fog(...th.fog);
  const camera = new THREE.PerspectiveCamera(th.tilt ? 26 : 34, 16 / 10, 0.1, 200);
  const dist = th.tilt ? 27 : 21.5;
  camera.position.set(0.5, dist * 0.8, dist * 0.62);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0.4);
  controls.enableDamping = true;
  controls.maxPolarAngle = 1.2;
  controls.minDistance = 8;
  controls.maxDistance = 40;
  controls.update();

  // 조명
  scene.add(new THREE.HemisphereLight(...th.hemi));
  const sun = new THREE.DirectionalLight(...th.sun);
  sun.position.set(-7, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(...th.rim);
  rim.position.set(8, 6, -10);
  scene.add(rim);
  const flashLights = Array.from({ length: 4 }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 4, 2);
    scene.add(l);
    return { light: l, life: 0, max: 1, power: 0 };
  });

  const W = (x, y, z = 0) => new THREE.Vector3(x - sim.cols / 2, z, y - sim.rows / 2);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0.1, flatShading: !!o.flat, ...(o.emissive ? { emissive: o.emissive, emissiveIntensity: o.ei ?? 1 } : {}) });
  const glowMat = (color, k = 2.5) => th.emissive
    ? new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false })
    : std(color, { rough: 0.35, emissive: color, ei: 0.35 });
  const M = {
    base: std(th.base, { rough: th.style === 'toy' ? 0.45 : 0.5, metal: th.style === 'sf' ? 0.2 : 0 }),
    metal: std(th.metal, { rough: 0.45, metal: th.style === 'sf' ? 0.6 : 0.1 }),
    trim: std(th.trim, { rough: 0.7 }),
    dark: std(0x22262e, { rough: 0.4, metal: 0.5 })
  };
  const mesh = (geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; return m; };

  // ---------- 보드 ----------
  const board = new THREE.Group();
  scene.add(board);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), std(th.floor, { rough: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.62; floor.receiveShadow = true;
  scene.add(floor);
  if (th.style === 'sf') {
    const grid = new THREE.GridHelper(80, 80, 0x1b3350, 0x0f1c2d);
    grid.position.y = -0.6; scene.add(grid);
  }
  const slab = mesh(new RoundedBoxGeometry(sim.cols + 0.6, 0.5, sim.rows + 0.6, 2, 0.12), std(th.style === 'fantasy' ? 0x6b5540 : th.style === 'toy' ? 0xd9b98f : 0x1a2230, { rough: 0.8 }));
  slab.position.y = -0.4; board.add(slab);
  const tileGeo = new RoundedBoxGeometry(0.95, 0.3, 0.95, 2, th.style === 'toy' ? 0.09 : 0.04);
  const cells = [];
  for (let y = 0; y < sim.rows; y++) for (let x = 0; x < sim.cols; x++) cells.push([x, y, sim.pathCells.has(x + ',' + y)]);
  const ground = new THREE.InstancedMesh(tileGeo, std(0xffffff, { rough: th.style === 'sf' ? 0.55 : 0.9, metal: th.style === 'sf' ? 0.3 : 0 }), cells.length);
  ground.receiveShadow = true;
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  cells.forEach(([x, y, isPath], i) => {
    const h = isPath ? -0.3 : -0.15 + ((x * 7 + y * 3) % 4) * 0.008 * (th.style === 'fantasy' ? 3 : 1);
    mtx.makeTranslation(x - sim.cols / 2 + 0.5, h, y - sim.rows / 2 + 0.5);
    ground.setMatrixAt(i, mtx);
    col.set(isPath ? th.path : th.ground[(x + y) % 2]);
    if (th.style === 'fantasy' && !isPath) col.offsetHSL(((x * 13 + y * 7) % 5) * 0.006 - 0.012, 0, ((x * 5 + y * 11) % 7) * 0.008 - 0.02);
    ground.setColorAt(i, col);
  });
  board.add(ground);
  // 경로 가장자리 라인(SF) / 흙길 가장자리 돌(판타지)
  if (th.style === 'sf') {
    const edgeMat = glowMat(0x3fd0ff, 1.6);
    for (let i = 1; i < sim.path.length; i++) {
      const a = sim.path[i - 1], b = sim.path[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (const off of [-0.47, 0.47]) {
        const nx = -(b.y - a.y) / len * off, ny = (b.x - a.x) / len * off;
        const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.94, 0.02, 0.03), edgeMat);
        const mid = W((a.x + b.x) / 2 + nx, (a.y + b.y) / 2 + ny, -0.0);
        m.position.copy(mid);
        m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        board.add(m);
      }
    }
  }
  // 소켓
  const socketMat = th.style === 'sf' ? glowMat(0x2f8fc0, 0.9) : std(th.style === 'toy' ? 0xffffff : 0x8c8474, { rough: 0.8 });
  for (const [x, y] of sim.map.sockets || []) {
    if (sim.towers.some((t) => t.cx === x && t.cy === y)) continue;
    const r = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.32, th.style === 'sf' ? 6 : 24), socketMat);
    r.rotation.x = -Math.PI / 2; r.position.copy(W(x + 0.5, y + 0.5, 0.005));
    board.add(r);
  }
  // 입구/출구
  const start = sim.path[0], end = sim.path[sim.path.length - 1];
  const gate = new THREE.Group();
  if (th.style === 'fantasy') {
    const arch = mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 16, Math.PI), M.base);
    arch.rotation.y = Math.PI / 2; gate.add(arch);
  } else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 32), glowMat(0xff4a6a, 2));
    ring.rotation.y = Math.PI / 2; ring.position.y = 0.55; gate.add(ring);
  }
  gate.position.copy(W(start.x + 0.6, start.y, 0));
  scene.add(gate);
  const coreGroup = new THREE.Group();
  if (th.style === 'fantasy') {
    const keep = mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.1, 8), M.base); keep.position.y = 0.55; coreGroup.add(keep);
    const roof = mesh(new THREE.ConeGeometry(0.58, 0.7, 8), std(0x2f5fb0)); roof.position.y = 1.45; coreGroup.add(roof);
    const flag = mesh(new THREE.BoxGeometry(0.02, 0.18, 0.28), std(0xe0c040)); flag.position.set(0, 2.0, 0.14); coreGroup.add(flag);
  } else {
    const ped = mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, th.style === 'sf' ? 6 : 24), M.base); ped.position.y = 0.15; coreGroup.add(ped);
    const crystal = mesh(new THREE.OctahedronGeometry(0.34), th.style === 'sf' ? glowMat(0x5fe1ff, 2) : std(0x6fd6ff, { rough: 0.2 }));
    crystal.position.y = 0.85; crystal.name = 'spin'; coreGroup.add(crystal);
  }
  coreGroup.position.copy(W(end.x - 0.6, end.y, 0));
  scene.add(coreGroup);

  // 소품
  const rand = mulberry(11);
  const occupied = new Set([...sim.pathCells, ...(sim.map.sockets || []).map(([x, y]) => x + ',' + y), ...sim.towers.map((t) => t.cx + ',' + t.cy)]);
  const freeCells = cells.filter(([x, y, p]) => !p && !occupied.has(x + ',' + y));
  for (let i = 0; i < 22; i++) {
    const [x, y] = freeCells[Math.floor(rand() * freeCells.length)];
    const p = W(x + 0.25 + rand() * 0.5, y + 0.25 + rand() * 0.5, 0);
    board.add(makeProp(th, rand, M, mesh, glowMat, std, p));
  }
  // 보드 바깥 장식
  for (let i = 0; i < (th.style === 'sf' ? 0 : 40); i++) {
    const a = rand() * Math.PI * 2, r = 11 + rand() * 9;
    const p = new THREE.Vector3(Math.cos(a) * r * 1.2, -0.6, Math.sin(a) * r * 0.9);
    const prop = makeProp(th, rand, M, mesh, glowMat, std, p, 1.8);
    scene.add(prop);
  }

  // ---------- 동적 오브젝트 ----------
  const towerViews = new Map(), enemyViews = new Map();
  const projPool = [], beamPool = [], ringPool = [];
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  const hpBg = new THREE.SpriteMaterial({ color: 0x000000, opacity: 0.6, transparent: true, depthTest: false });

  // 파티클
  const fx = new FX(th.emissive ? 1.2 : 0.9);
  const MAXP = 1600;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 4), pSize = new Float32Array(MAXP);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color4', new THREE.BufferAttribute(pCol, 4));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 1 } },
    vertexShader: `attribute float size; attribute vec4 color4; varying vec4 vC; uniform float scale;
      void main(){ vC = color4; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
    transparent: true, depthWrite: false, blending: th.additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);

  // ---------- 후처리 ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), ...th.bloom);
  composer.addPass(bloom);
  let tiltH, tiltV;
  if (th.tilt) {
    tiltH = new ShaderPass(TiltShiftShader); tiltV = new ShaderPass(TiltShiftShader);
    tiltV.uniforms.dir.value.set(0, 1);
    composer.addPass(tiltH); composer.addPass(tiltV);
  }
  composer.addPass(new OutputPass());

  function resize() {
    const w = container.clientWidth, h = Math.round(w * 0.625);
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    pMat.uniforms.scale.value = h * renderer.getPixelRatio() * 1.2;
    if (tiltH) { tiltH.uniforms.amount.value = 2.2 / w; tiltV.uniforms.amount.value = 2.2 / h; }
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function syncTowers() {
    const alive = new Set();
    for (const t of sim.towers) {
      alive.add(t.id);
      let v = towerViews.get(t.id);
      const sig = t.level + (t.branch || '');
      if (v && v.sig !== sig) { board.remove(v.group); v = null; }
      if (!v) {
        v = buildTower(t, th, M, mesh, glowMat, std);
        v.sig = sig;
        v.group.position.copy(W(t.x, t.y));
        board.add(v.group);
        towerViews.set(t.id, v);
      }
      if (v.turret) v.turret.rotation.y = -t.angle;
      if (v.barrel) v.barrel.position.x = v.barrelX - t.recoil * 0.09;
      if (v.spin) { v.spin.rotation.y += 0.02; v.spin.position.y = v.spinY + Math.sin(performance.now() / 500 + t.id) * 0.05; }
      if (v.lens) v.lens.scale.setScalar(1 + (t.beams.length ? 0.25 + Math.sin(performance.now() / 50) * 0.1 : 0));
    }
    for (const [id, v] of towerViews) if (!alive.has(id)) { board.remove(v.group); towerViews.delete(id); }
  }

  function syncEnemies() {
    const alive = new Set();
    const now = performance.now() / 1000;
    for (const e of sim.enemies) {
      alive.add(e.id);
      let v = enemyViews.get(e.id);
      if (!v) { v = buildEnemy(e, th, mesh, glowMat, std); v.group.scale.setScalar(1.3); scene.add(v.group); enemyViews.set(e.id, v); }
      const bob = e.kind === 'tank' ? 0 : Math.abs(Math.sin(now * (e.kind === 'runner' ? 14 : 8) + e.id)) * (th.style === 'sf' ? 0.04 : 0.1);
      v.group.position.copy(W(e.x, e.y, bob + (th.style === 'sf' && e.kind !== 'tank' ? 0.15 : 0)));
      v.group.rotation.y = -e.heading;
      const flash = e.hitT > 0 ? 1 : 0;
      for (const m of v.mats) { m.emissive.setHex(e.slowT > 0 ? 0x3f8fbf : 0x000000); if (flash) m.emissive.setHex(0xffffff); m.emissiveIntensity = flash ? 0.9 : 0.6; }
      if (e.hp < e.maxHp) {
        if (!v.hp) {
          v.hpBg = new THREE.Sprite(hpBg); v.hpFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x6dff9a, depthTest: false }));
          v.hpBg.center.set(0, 0.5); v.hpFg.center.set(0, 0.5); v.hpBg.renderOrder = 10; v.hpFg.renderOrder = 11;
          scene.add(v.hpBg, v.hpFg); v.hp = true;
        }
        const top = W(e.x, e.y, e.radius * 2 + 0.55);
        const w = 0.5;
        v.hpBg.position.copy(top).add(new THREE.Vector3(-w / 2, 0, 0)); v.hpBg.scale.set(w, 0.06, 1);
        v.hpFg.position.copy(v.hpBg.position); v.hpFg.scale.set(w * Math.max(0, e.hp / e.maxHp), 0.06, 1);
        v.hpFg.material.color.setHex(e.hp / e.maxHp > 0.4 ? 0x6dff9a : 0xff6a5a);
      }
    }
    for (const [id, v] of enemyViews) if (!alive.has(id)) {
      scene.remove(v.group); if (v.hp) scene.remove(v.hpBg, v.hpFg);
      enemyViews.delete(id);
    }
  }

  function syncProjectiles() {
    let i = 0;
    for (const p of sim.projectiles) {
      let m = projPool[i];
      if (!m) {
        m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), glowMat(0xffffff));
        m.castShadow = true; scene.add(m); projPool.push(m);
      }
      m.visible = true;
      const cannon = p.type === 'cannon';
      if (m.userData.type !== p.type) {
        m.material = cannon ? M.dark : glowMat(p.color, th.emissive ? 3 : 1);
        m.userData.type = p.type;
      }
      m.scale.setScalar(cannon ? 0.1 : 0.055);
      m.position.copy(W(p.x, p.y, p.arc ? 0.55 + p.z : 0.6));
      i++;
    }
    for (; i < projPool.length; i++) projPool[i].visible = false;
  }

  function syncBeams() {
    const byId = new Map(sim.enemies.map((e) => [e.id, e]));
    let i = 0;
    for (const t of sim.towers) {
      if (!t.beams || !t.beams.length) continue;
      const v = towerViews.get(t.id);
      const from = W(t.x, t.y, v ? v.muzzleY : 0.9);
      for (const id of t.beams) {
        const e = byId.get(id); if (!e) continue;
        const to = W(e.x, e.y, e.radius + 0.2);
        for (const layer of [0, 1]) {
          let b = beamPool[i];
          if (!b) {
            b = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
            scene.add(b); beamPool.push(b);
          }
          b.visible = true;
          const len = from.distanceTo(to);
          b.position.copy(from).lerp(to, 0.5);
          b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
          const w = (0.025 + (t.beamPower || 1) * 0.012) * (layer ? 0.35 : 1);
          b.scale.set(w, len, w);
          b.material.color.set(layer ? 0xffffff : TOWERS[t.type].color).multiplyScalar(layer ? 2 : th.emissive ? 2.5 : 1.2);
          b.material.opacity = layer ? 1 : 0.7;
          i++;
        }
      }
    }
    for (; i < beamPool.length; i++) beamPool[i].visible = false;
  }

  function syncFx(events, dt) {
    fx.consume(events);
    fx.update(dt);
    for (const ev of events) {
      if (ev.type === 'explode' || ev.type === 'meteor' || (ev.type === 'death' && ev.kind === 'boss') || (ev.type === 'fire' && ev.tower === 'cannon')) {
        const slot = flashLights.reduce((a, b) => (a.life < b.life ? a : b));
        slot.light.position.copy(W(ev.x, ev.y, 0.6));
        slot.light.color.set(ev.type === 'fire' ? 0xffc070 : 0xff9a40);
        slot.power = ev.type === 'meteor' ? 30 : ev.type === 'fire' ? 4 : 10;
        slot.light.distance = ev.type === 'meteor' ? 7 : 3.5;
        slot.life = slot.max = ev.type === 'fire' ? 0.08 : 0.25;
      }
    }
    for (const s of flashLights) { s.life = Math.max(0, s.life - dt); s.light.intensity = s.life > 0 ? s.power * (s.life / s.max) : 0; }
    let n = 0;
    const c = new THREE.Color();
    for (const p of fx.particles) {
      if (n >= MAXP) break;
      const v = W(p.x, p.y, p.z + 0.1);
      pPos[n * 3] = v.x; pPos[n * 3 + 1] = v.y; pPos[n * 3 + 2] = v.z;
      c.set(p.color); if (th.emissive) c.multiplyScalar(2);
      pCol[n * 4] = c.r; pCol[n * 4 + 1] = c.g; pCol[n * 4 + 2] = c.b; pCol[n * 4 + 3] = Math.min(1, p.life / p.max * 1.5);
      pSize[n] = p.size * 2.2;
      n++;
    }
    for (const f of fx.flashes) {
      if (n >= MAXP) break;
      const v = W(f.x, f.y, f.z + 0.2);
      pPos[n * 3] = v.x; pPos[n * 3 + 1] = v.y; pPos[n * 3 + 2] = v.z;
      c.set(f.color).multiplyScalar(th.emissive ? 3 : 1.2);
      pCol[n * 4] = c.r; pCol[n * 4 + 1] = c.g; pCol[n * 4 + 2] = c.b; pCol[n * 4 + 3] = f.life / f.max;
      pSize[n] = f.size * 2.2;
      n++;
    }
    pGeo.setDrawRange(0, n);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color4.needsUpdate = true;
    pGeo.attributes.size.needsUpdate = true;
    let i = 0;
    for (const r of fx.rings) {
      let m = ringPool[i];
      if (!m) {
        m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: th.additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2; scene.add(m); ringPool.push(m);
      }
      const k = 1 - r.life / r.max;
      m.visible = true;
      m.position.copy(W(r.x, r.y, 0.04));
      m.scale.setScalar(r.r * (0.3 + 0.7 * (1 - (1 - k) ** 2)));
      m.material.color.set(r.color).multiplyScalar(th.emissive ? 2 : 1);
      m.material.opacity = 1 - k;
      i++;
    }
    for (; i < ringPool.length; i++) ringPool[i].visible = false;
    if (fx.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * fx.shake * 0.25, 0, (Math.random() - 0.5) * fx.shake * 0.25));
  }

  function draw(ui, dt, events) {
    syncTowers();
    syncEnemies();
    syncProjectiles();
    syncBeams();
    const camBefore = camera.position.clone();
    syncFx(events, dt);
    const spin = coreGroup.getObjectByName('spin');
    if (spin) spin.rotation.y += dt * 1.2;
    controls.update();
    composer.render();
    camera.position.copy(camBefore);
  }

  return { draw, renderer, fx };
}

// ---------- 타워 모델 ----------
function buildTower(t, th, M, mesh, glowMat, std) {
  const color = th.towerColor[t.type];
  const g = new THREE.Group();
  const v = { group: g, muzzleY: 0.75 };
  const lv = t.level + (t.branch ? 1 : 0);
  if (th.style === 'fantasy') {
    const h = 0.5 + lv * 0.08;
    const body = mesh(new THREE.CylinderGeometry(0.3, 0.36, h, 10), M.base);
    body.position.y = h / 2; g.add(body);
    const band = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 10), std(color, { rough: 0.7 }));
    band.position.y = h * 0.62; g.add(band);
    if (t.type === 'frost' || t.type === 'laser') {
      const roof = mesh(new THREE.ConeGeometry(0.4, 0.5, 10), std(color, { rough: 0.7 }));
      roof.position.y = h + 0.25; g.add(roof);
      const orb = mesh(t.type === 'frost' ? new THREE.OctahedronGeometry(0.14) : new THREE.SphereGeometry(0.11, 16, 12), glowMat(t.type === 'frost' ? 0xbff2ff : 0xe0b0ff, 1.5));
      orb.position.y = h + 0.8; g.add(orb);
      v.spin = orb; v.spinY = orb.position.y; v.lens = t.type === 'laser' ? orb : null; v.muzzleY = orb.position.y;
    } else {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const c = mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), M.base);
        c.position.set(Math.cos(a) * 0.27, h + 0.06, Math.sin(a) * 0.27); g.add(c);
      }
      const turret = new THREE.Group(); turret.position.y = h + 0.1; g.add(turret);
      if (t.type === 'gun') {
        const stock = mesh(new THREE.BoxGeometry(0.34, 0.07, 0.07), M.metal); stock.position.x = 0.08; turret.add(stock);
        const bow = mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16, Math.PI), M.metal); bow.rotation.set(Math.PI / 2, 0, Math.PI / 2); bow.position.x = 0.2; turret.add(bow);
        v.barrel = stock; v.barrelX = 0.08;
      } else {
        const carriage = mesh(new THREE.BoxGeometry(0.26, 0.1, 0.22), M.metal); turret.add(carriage);
        const barrel = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 12), M.dark); barrel.rotation.z = Math.PI / 2 - 0.2; barrel.position.set(0.12, 0.1, 0); turret.add(barrel);
        v.barrel = barrel; v.barrelX = 0.12;
      }
      v.turret = turret; v.muzzleY = h + 0.2;
    }
    return v;
  }
  // sf / toy: 같은 실루엣, 재질만 다름
  const toy = th.style === 'toy';
  const seg = toy ? 24 : 6;
  const base = mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.26, seg), M.base);
  base.position.y = 0.13; g.add(base);
  const band = mesh(new THREE.CylinderGeometry(0.35, 0.35, toy ? 0.09 : 0.035, seg), toy ? std(color, { rough: 0.45 }) : glowMat(color, 1.8));
  band.position.y = toy ? 0.2 : 0.24; g.add(band);
  for (let i = 1; i < lv; i++) {
    const pip = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), glowMat(color, 1.5));
    const a = -Math.PI / 2 + (i - 2) * 0.35;
    pip.position.set(Math.cos(a) * 0.36, 0.1, Math.sin(a) * -0.36); g.add(pip);
  }
  const turret = new THREE.Group(); turret.position.y = 0.28; g.add(turret);
  v.turret = turret;
  if (t.type === 'gun') {
    const body = mesh(toy ? new RoundedBoxGeometry(0.32, 0.2, 0.28, 2, 0.06) : new THREE.BoxGeometry(0.32, 0.18, 0.26), toy ? std(color, { rough: 0.45 }) : M.base);
    body.position.y = 0.1; turret.add(body);
    const barrels = new THREE.Group(); barrels.position.set(0.2, 0.12, 0); turret.add(barrels);
    const len = t.branch === 'b' ? 0.6 : 0.38;
    const offs = t.branch === 'a' ? [-0.07, 0.07] : [0];
    for (const z of offs) {
      const b = mesh(new THREE.CylinderGeometry(0.035, 0.045, len, 10), M.metal);
      b.rotation.z = Math.PI / 2; b.position.set(len / 2 - 0.05, 0, z); barrels.add(b);
    }
    v.barrel = barrels; v.barrelX = 0.2; v.muzzleY = 0.7;
  } else if (t.type === 'cannon') {
    const r = t.branch === 'b' ? 0.24 : 0.2;
    const body = mesh(new THREE.SphereGeometry(r, 20, 14), toy ? std(color, { rough: 0.45 }) : std(color, { rough: 0.4, metal: 0.4 }));
    body.position.y = 0.14; turret.add(body);
    const barrel = mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.4, 14), M.metal);
    barrel.rotation.z = Math.PI / 2 - 0.25; barrel.position.set(0.2, 0.2, 0); turret.add(barrel);
    v.barrel = barrel; v.barrelX = 0.2;
  } else if (t.type === 'frost') {
    v.turret = null;
    const ped = mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.18, seg), M.base); ped.position.y = 0.37; g.add(ped);
    const crystal = mesh(new THREE.OctahedronGeometry(0.17), toy ? std(color, { rough: 0.2 }) : glowMat(color, 1.6));
    crystal.scale.y = 1.5; crystal.position.y = 0.78; g.add(crystal);
    v.spin = crystal; v.spinY = 0.78; v.muzzleY = 0.78;
    if (t.branch === 'a') {
      const halo = mesh(new THREE.TorusGeometry(0.28, 0.018, 6, 32), glowMat(color, 1.4)); halo.rotation.x = Math.PI / 2; halo.position.y = 0.55; g.add(halo);
    }
  } else if (t.type === 'laser') {
    v.turret = null;
    const col = mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.55, seg), M.base); col.position.y = 0.55; g.add(col);
    const lens = mesh(new THREE.SphereGeometry(0.1, 16, 12), glowMat(color, 2.2)); lens.position.y = 0.92; g.add(lens);
    const ring = mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 32), toy ? std(color) : M.metal); ring.rotation.x = Math.PI / 2; ring.position.y = 0.92; g.add(ring);
    v.spin = ring; v.spinY = 0.92; v.lens = lens; v.muzzleY = 0.92;
    if (t.branch === 'a') for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const e = mesh(new THREE.SphereGeometry(0.04, 8, 6), glowMat(color, 2)); e.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17); ring.add(e);
    }
  }
  return v;
}

// ---------- 적 모델 ----------
function buildEnemy(e, th, mesh, glowMat, std) {
  const color = th.enemy[e.kind];
  const g = new THREE.Group();
  const mats = [];
  const body = (geo, c = color, o = {}) => { const m = std(c, { rough: o.rough ?? 0.5, metal: o.metal ?? 0.1, flat: o.flat }); mats.push(m); return mesh(geo, m); };
  const r = e.radius;
  if (th.style === 'sf') {
    if (e.kind === 'grunt') { const b = body(new THREE.OctahedronGeometry(r), color, { metal: 0.5, rough: 0.3, flat: true }); b.position.y = r; b.scale.set(1.3, 0.8, 1); g.add(b); }
    else if (e.kind === 'runner') { const b = body(new THREE.ConeGeometry(r * 0.9, r * 3, 4), color, { metal: 0.5, rough: 0.3, flat: true }); b.rotation.z = -Math.PI / 2; b.position.y = r; g.add(b); }
    else if (e.kind === 'tank') { const b = body(new THREE.BoxGeometry(r * 2.2, r * 1.1, r * 1.8), color, { metal: 0.6, rough: 0.35 }); b.position.y = r * 0.55; g.add(b); const top = body(new THREE.BoxGeometry(r * 1.1, r * 0.6, r * 1.1), color); top.position.set(-0.03, r * 1.3, 0); g.add(top); }
    else { const b = body(new THREE.IcosahedronGeometry(r, 0), color, { metal: 0.5, rough: 0.3, flat: true }); b.position.y = r; g.add(b); const ring = mesh(new THREE.TorusGeometry(r * 1.4, 0.03, 6, 40), glowMat(0xff8ad0, 2)); ring.rotation.x = Math.PI / 2; ring.position.y = r; g.add(ring); }
    const eye = mesh(new THREE.SphereGeometry(Math.max(0.04, r * 0.22), 8, 6), glowMat(0xfff2a0, 3), false);
    eye.position.set(r * (e.kind === 'runner' ? 0.6 : 0.95), e.kind === 'tank' ? r * 0.7 : r, 0); g.add(eye);
  } else if (th.style === 'fantasy') {
    if (e.kind === 'tank') {
      const b = body(new THREE.DodecahedronGeometry(r, 0), color, { rough: 0.9, flat: true }); b.position.y = r; b.scale.set(1.1, 0.9, 1); g.add(b);
    } else if (e.kind === 'runner') {
      const b = body(new THREE.CapsuleGeometry(r * 0.6, r * 1.6, 4, 8), color, { rough: 0.9 }); b.rotation.z = Math.PI / 2; b.position.y = r * 0.9; g.add(b);
      const head = body(new THREE.ConeGeometry(r * 0.55, r * 1.2, 6), color); head.rotation.z = -Math.PI / 2; head.position.set(r * 1.5, r * 1.1, 0); g.add(head);
    } else {
      const s = e.kind === 'boss' ? 1 : 1;
      const b = body(new THREE.CapsuleGeometry(r * 0.7 * s, r * 0.9, 4, 10), color, { rough: 0.85 }); b.position.y = r * 1.2; g.add(b);
      const head = body(new THREE.SphereGeometry(r * 0.55, 12, 10), color); head.position.set(r * 0.25, r * 2.3, 0); g.add(head);
      if (e.kind === 'boss') for (const z of [-1, 1]) { const horn = mesh(new THREE.ConeGeometry(r * 0.14, r * 0.7, 6), std(0xeee0c0)); horn.position.set(r * 0.2, r * 2.8, z * r * 0.35); horn.rotation.x = z * 0.4; g.add(horn); }
    }
  } else {
    const round = e.kind === 'tank' ? new RoundedBoxGeometry(r * 2, r * 1.6, r * 1.8, 3, r * 0.4) : new THREE.SphereGeometry(r, 20, 16);
    const b = body(round, color, { rough: 0.4 }); b.position.y = e.kind === 'tank' ? r * 0.8 : r; g.add(b);
    const eyeY = e.kind === 'tank' ? r * 1.0 : r * 1.15;
    for (const z of [-1, 1]) {
      const w = mesh(new THREE.SphereGeometry(r * 0.28, 10, 8), std(0xffffff, { rough: 0.3 }), false); w.position.set(r * 0.82, eyeY, z * r * 0.35); g.add(w);
      const p = mesh(new THREE.SphereGeometry(r * 0.14, 8, 6), std(0x222222), false); p.position.set(r * 1.02, eyeY, z * r * 0.35); g.add(p);
    }
    if (e.kind === 'boss') { const crown = mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.55, r * 0.35, 5, 1, true), std(0xffd24a, { rough: 0.3, metal: 0.4 })); crown.position.y = r * 2.05; g.add(crown); }
    if (e.kind === 'runner') for (const z of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(r * 0.3, r * 0.8, 8), std(color)); ear.position.set(-r * 0.1, r * 1.9, z * r * 0.5); g.add(ear); }
  }
  return { group: g, mats };
}

// ---------- 소품 ----------
function makeProp(th, rand, M, mesh, glowMat, std, pos, scale = 1) {
  const g = new THREE.Group();
  g.position.copy(pos);
  g.scale.setScalar(scale * (0.8 + rand() * 0.5));
  const k = rand();
  if (th.props === 'sf') {
    if (k < 0.5) {
      const c = mesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), M.metal); c.position.y = 0.1; g.add(c);
      const s = mesh(new THREE.BoxGeometry(0.29, 0.03, 0.29), glowMat(0x3fd0ff, 1.2)); s.position.y = 0.16; g.add(s);
    } else {
      const p = mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 6), M.base); p.position.y = 0.25; g.add(p);
      const tip = mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat(0xff5a6a, 2.5)); tip.position.y = 0.52; g.add(tip);
    }
  } else if (th.props === 'fantasy') {
    if (k < 0.65) {
      const trunk = mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.25, 6), std(0x6b4a2e)); trunk.position.y = 0.12; g.add(trunk);
      const shade = 0x2f6b34 + Math.floor(rand() * 3) * 0x051005;
      for (let i = 0; i < 2; i++) { const c = mesh(new THREE.ConeGeometry(0.22 - i * 0.05, 0.36, 7), std(shade, { rough: 0.9, flat: true })); c.position.y = 0.34 + i * 0.2; g.add(c); }
    } else {
      const r = mesh(new THREE.DodecahedronGeometry(0.14, 0), std(0x8a8a86, { rough: 0.95, flat: true })); r.position.y = 0.08; r.scale.y = 0.7; g.add(r);
    }
  } else {
    if (k < 0.6) {
      const trunk = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 10), std(0xb07a4f)); trunk.position.y = 0.11; g.add(trunk);
      const top = mesh(new THREE.SphereGeometry(0.2, 16, 12), std([0x7ccf7a, 0x9fdc6e, 0xf5a3b5][Math.floor(rand() * 3)], { rough: 0.6 })); top.position.y = 0.36; g.add(top);
    } else {
      const house = mesh(new RoundedBoxGeometry(0.3, 0.24, 0.26, 2, 0.03), std(0xfff4e0)); house.position.y = 0.12; g.add(house);
      const roof = mesh(new THREE.ConeGeometry(0.25, 0.2, 4), std([0xff7a59, 0x4aa8ff, 0xffc94d][Math.floor(rand() * 3)])); roof.rotation.y = Math.PI / 4; roof.position.y = 0.34; g.add(roof);
    }
  }
  return g;
}

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
