// 랜덤 타워 디펜스 경기장(운명의 제단). 떠 있는 섬·구름바다·소켓 받침대 대신,
// 레퍼런스(운빨존많겜·스타 랜타디·원랜디)처럼 숲으로 둘러싼 직사각형 들판을 그린다.
// - 가운데: 4행×7열 잔디 칸(바둑판 무늬, 칸 사이 흙 줄). 타워는 칸 땅 위에 바로 선다.
// - 둘레: 칸에 바짝 붙은 흙길 사각 고리, 바깥 돌 담장, 모서리 등불.
// - 왼쪽 위 모서리: 적이 나오는 균열(땅에 깔린 소용돌이, 하늘로 솟는 빛 없음).
// World가 기대하는 부품(terrain·sockets·core·portal·ley…)을 같은 모양으로 돌려준다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { samplePath } from '../../core/path.js';
import { ARENA } from '../../core/data/randomtd.js';
import { createNoise, smoothstep, mulberry32 } from '../util/noise.js';
import { cobblestone, grassDetail, glowSprite } from '../util/textures.js';
import { createVegetation } from './vegetation.js';
import { createRangeIndicator } from './range.js';
import { stoneMaterial } from './structures.js';
import { THEMES } from '../themes.js';

/** 경기장 테마: 맑은 늦은 오후의 숲속 들판 (themeOf가 읽을 수 있게 THEMES에 등록) */
export const FATE_THEME = {
    sky: { zenith: '#2a3f7a', upper: '#5c7ec0', horizon: '#ffd2a0', below: '#a08a70', sunGlow: '#fff0c0' },
    cloud: { lit: '#fff6e6', mid: '#f0d0b0', shadow: '#a8a0b8', deep: '#6a6a90', horizon: '#f4c8a0' },
    fog: '#b8c4b0',
    sun: { color: '#ffe0b0', intensity: 3.1 },
    hemi: { sky: '#b4c8ff', ground: '#5a4a30', intensity: 0.95 },
    rim: { color: '#a8b8ff', intensity: 0.7 },
    env: 0.7,
    ground: { grassA: '#4f8a34', grassB: '#78a03c', dry: '#a89450', dirt: '#8a6a44', rim: '#8b7d68' },
    cliff: { soil: '#4a3526', bands: ['#9a8468', '#7c6a56', '#a8937a', '#6a5a4a', '#8f7c66'], deep: '#2e2824' },
    veg: {
        broad: ['#3f7a2f', '#4f8a35', '#5f9a3a', '#6f8a2a', '#a8a03a', '#2f6a3a'],
        pine: ['#2a5a36', '#346a3c', '#2c4f3a'],
        broadRatio: 0.62,
        trees: 340,
        grass: ['#4f8a2c', '#62982f', '#76a038', '#56882f'],
        grassDensity: 1.1,
        flowers: ['#fff3d6', '#ffd24a', '#ff8fb1', '#b58cff', '#ffffff'],
        snow: false,
        dead: false,
        crystals: null,
        rock: '#a09482'
    },
    wall: '#bfae90',
    roof: '#3d4e8a',
    banner: '#8a2230',
    road: '#ffffff'
};
THEMES.fate ??= FATE_THEME;

const _p = {};
const GROUND = 240;
const CELL_Y = 0.07;

/** 경기장 바깥 테두리(담장 안쪽 면) 반폭 */
function outer() {
    return { x: ARENA.hx + ARENA.road / 2 + 0.25, z: ARENA.hz + ARENA.road / 2 + 0.25 };
}

/** 직사각형까지 거리 (안쪽 음수) */
function rectDist(x, z, hx, hz) {
    const dx = Math.abs(x) - hx;
    const dz = Math.abs(z) - hz;
    return dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz);
}

// ---------- 땅 ----------

function createGround(theme) {
    const noise = createNoise(9071);
    const { fbm } = noise;
    const o = outer();
    const heightAt = (x, z) => {
        const d = rectDist(x, z, o.x + 0.6, o.z + 0.6);
        if (d <= 0) return 0;
        const k = smoothstep(0.5, 7, d);
        return k * (0.55 * Math.max(0, fbm(x * 0.07 + 2, z * 0.07 - 1, 4)) + 0.25 * fbm(x * 0.25, z * 0.25, 2) + 0.15);
    };
    const seg = 240;
    const geo = new THREE.PlaneGeometry(GROUND, GROUND, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const pal = theme.ground;
    const a = new THREE.Color(pal.grassA);
    const b = new THREE.Color(pal.grassB);
    const dry = new THREE.Color(pal.dry);
    const dirt = new THREE.Color(pal.dirt);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, heightAt(x, z) - 0.01);
        const n = fbm(x * 0.15 + 10, z * 0.15, 3) * 0.5 + 0.5;
        c.copy(a).lerp(b, smoothstep(0.25, 0.8, n));
        c.lerp(dry, 0.5 * smoothstep(0.35, 0.75, fbm(x * 0.05 - 4, z * 0.05 + 2, 3)));
        // 담장 발치는 밟혀서 흙빛
        const d = rectDist(x, z, o.x, o.z);
        c.lerp(dirt, 0.55 * (1 - smoothstep(0, 1.4, d)));
        c.multiplyScalar(0.86 + 0.14 * n);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const tex = grassDetail();
    const map = tex.clone();
    map.repeat.set(GROUND / 3, GROUND / 3);
    map.needsUpdate = true;
    const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.95, metalness: 0 })
    );
    mesh.receiveShadow = true;
    mesh.name = 'ground';
    return { mesh, heightAt, noise };
}

// ---------- 고리 길 ----------

function createTrack(state, theme) {
    const group = new THREE.Group();
    group.name = 'track';
    const path = state.paths[0];
    const W = ARENA.road;
    const tex = cobblestone();
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e2cfa6'),
        map: tex.map,
        normalMap: tex.normalMap,
        normalScale: new THREE.Vector2(0.7, 0.7),
        roughnessMap: tex.roughnessMap,
        roughness: 1,
        metalness: 0
    });
    const pos = [];
    const uv = [];
    const idx = [];
    const step = 0.15;
    const n = Math.ceil(path.length / step);
    for (let i = 0; i <= n; i++) {
        const d = (i / n) * path.length;
        samplePath(path, d, _p);
        const nx = -_p.dz;
        const nz = _p.dx;
        for (const side of [-1, 1]) {
            pos.push(_p.x + nx * side * W * 0.5, 0.012, _p.z + nz * side * W * 0.5);
            uv.push(side < 0 ? 0 : 1, d / W);
        }
        if (i < n) {
            const k = i * 2;
            idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, mat);
    road.receiveShadow = true;
    group.add(road);

    // 길 양옆 연석 (안쪽은 칸 격자 테두리, 바깥은 담장 발치)
    const rand = mulberry32(19);
    const curbs = [];
    for (let d = 0; d < path.length; d += 0.27) {
        samplePath(path, d, _p);
        for (const side of [-1, 1]) {
            if (rand() < 0.03) continue;
            curbs.push({
                x: _p.x - _p.dz * side * (W * 0.5 + 0.04),
                z: _p.z + _p.dx * side * (W * 0.5 + 0.04),
                rot: Math.atan2(_p.dz, _p.dx) + (rand() - 0.5) * 0.2,
                s: 0.85 + rand() * 0.4
            });
        }
    }
    const curbMesh = new THREE.InstancedMesh(
        new RoundedBoxGeometry(0.26, 0.09, 0.12, 1, 0.03),
        stoneMaterial(new THREE.Color('#8d7f6a'), 0.9),
        curbs.length
    );
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    curbs.forEach((c, i) => {
        dummy.position.set(c.x, 0.04, c.z);
        dummy.rotation.set(0, -c.rot, 0);
        dummy.scale.set(c.s, 0.8 + rand() * 0.5, 1);
        dummy.updateMatrix();
        curbMesh.setMatrixAt(i, dummy.matrix);
        curbMesh.setColorAt(i, col.set('#ffffff').offsetHSL(0, 0, (rand() - 0.5) * 0.16));
    });
    curbMesh.castShadow = true;
    curbMesh.receiveShadow = true;
    group.add(curbMesh);
    void theme;
    return group;
}

// ---------- 칸 격자 ----------

function createCells(state) {
    const group = new THREE.Group();
    group.name = 'cells';
    const C = ARENA.cell;
    // 칸 아래 흙 바닥 (칸 사이 줄이 흙빛으로 보인다)
    const fw = ARENA.cols.length * C + 0.12;
    const fh = ARENA.rows.length * C + 0.12;
    const soil = new THREE.Mesh(
        new THREE.BoxGeometry(fw, 0.06, fh),
        new THREE.MeshStandardMaterial({ color: '#6b5236', roughness: 1 })
    );
    soil.position.y = 0.0;
    soil.receiveShadow = true;
    group.add(soil);
    const grass = grassDetail();
    const map = grass.clone();
    map.repeat.set(1.2, 1.2);
    map.needsUpdate = true;
    const mats = ['#5f9c3a', '#4f8c34'].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, map, roughness: 0.95, metalness: 0 })
    );
    const geo = new RoundedBoxGeometry(C - 0.08, 0.08, C - 0.08, 2, 0.03);
    const items = [];
    const cols = ARENA.cols.length;
    for (const s of state.sockets) {
        const i = s.id % cols;
        const j = Math.floor(s.id / cols);
        const tile = new THREE.Mesh(geo, mats[(i + j) % 2]);
        tile.position.set(s.x, CELL_Y - 0.04, s.z);
        tile.receiveShadow = true;
        tile.userData.socketId = s.id;
        group.add(tile);
        items.push(tile);
    }
    // 가리킨 칸: 금빛 테두리
    const frameMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffe39a').multiplyScalar(1.6),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
    });
    const frameShape = new THREE.Shape();
    const h = C / 2 - 0.05;
    frameShape.moveTo(-h, -h);
    frameShape.lineTo(h, -h);
    frameShape.lineTo(h, h);
    frameShape.lineTo(-h, h);
    frameShape.lineTo(-h, -h);
    const hole = new THREE.Path();
    const g = h - 0.07;
    hole.moveTo(-g, -g);
    hole.lineTo(-g, g);
    hole.lineTo(g, g);
    hole.lineTo(g, -g);
    hole.lineTo(-g, -g);
    frameShape.holes.push(hole);
    const frame = new THREE.Mesh(new THREE.ShapeGeometry(frameShape), frameMat);
    frame.rotation.x = -Math.PI / 2;
    frame.visible = false;
    frame.renderOrder = 5;
    group.add(frame);
    return {
        group,
        items,
        pickables: items,
        topY: () => CELL_Y,
        update(t, state2, hoverId) {
            frame.visible = hoverId != null;
            if (hoverId == null) return;
            const s = state2.sockets[hoverId];
            frame.position.set(s.x, CELL_Y + 0.012, s.z);
            frameMat.opacity = 0.6 + 0.3 * Math.sin(t * 6);
        }
    };
}

// ---------- 담장과 등불 ----------

function createWalls(theme) {
    const group = new THREE.Group();
    group.name = 'walls';
    const o = outer();
    const mat = stoneMaterial(new THREE.Color(theme.wall), 0.85);
    const cap = stoneMaterial(new THREE.Color('#d8c8a8'), 0.75);
    const rand = mulberry32(23);
    const blocks = [];
    const T = 0.34;
    const side = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.round(len / 0.62);
        for (let i = 0; i < n; i++) {
            const k = (i + 0.5) / n;
            blocks.push({
                x: x0 + (x1 - x0) * k,
                z: z0 + (z1 - z0) * k,
                rot: Math.atan2(z1 - z0, x1 - x0),
                w: len / n - 0.02,
                h: 0.36 + rand() * 0.05
            });
        }
    };
    const X = o.x + T / 2;
    const Z = o.z + T / 2;
    side(-X, -Z, X, -Z);
    side(X, -Z, X, Z);
    side(X, Z, -X, Z);
    side(-X, Z, -X, -Z);
    const body = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, T, 1, 0.04), mat, blocks.length);
    const top = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 0.07, T + 0.08, 1, 0.025), cap, blocks.length);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    blocks.forEach((b, i) => {
        dummy.position.set(b.x, b.h / 2, b.z);
        dummy.rotation.set(0, -b.rot, 0);
        dummy.scale.set(b.w, b.h, 1);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
        body.setColorAt(i, col.set('#ffffff').offsetHSL(0, 0, (rand() - 0.5) * 0.14));
        dummy.position.y = b.h + 0.03;
        dummy.scale.set(b.w + 0.02, 1, 1);
        dummy.updateMatrix();
        top.setMatrixAt(i, dummy.matrix);
    });
    for (const m of [body, top]) {
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
    }
    // 모서리 기둥과 등불 (작은 불꽃만, 위로 솟는 빛 없음)
    const pillarGeo = new RoundedBoxGeometry(0.62, 0.95, 0.62, 2, 0.06);
    const capGeo = new THREE.ConeGeometry(0.42, 0.34, 4);
    capGeo.rotateY(Math.PI / 4);
    const flameMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffc66a').multiplyScalar(3),
        toneMapped: false
    });
    const halo = new THREE.SpriteMaterial({
        map: glowSprite(),
        color: 0xffb860,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.75
    });
    const flames = [];
    const lights = [];
    const posts = [
        [-X, -Z],
        [X, -Z],
        [X, Z],
        [-X, Z],
        [0, -Z],
        [0, Z]
    ];
    posts.forEach(([x, z], i) => {
        const g = new THREE.Group();
        const p = new THREE.Mesh(pillarGeo, mat);
        p.position.y = 0.475;
        const c = new THREE.Mesh(capGeo, stoneMaterial(new THREE.Color(theme.roof), 0.6));
        c.position.y = 1.25;
        const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), flameMat);
        f.position.y = 1.02;
        const s = new THREE.Sprite(halo);
        s.scale.setScalar(0.9);
        s.position.y = 1.02;
        for (const m of [p, c]) {
            m.castShadow = true;
            m.receiveShadow = true;
        }
        g.add(p, c, f, s);
        g.position.set(x, 0, z);
        group.add(g);
        flames.push({ f, s, k: i * 1.7 });
        if (i < 4) {
            const l = new THREE.PointLight(0xffb05a, 3, 5, 1.6);
            l.position.set(x * 0.94, 1.1, z * 0.92);
            group.add(l);
            lights.push(l);
        }
    });
    return {
        group,
        update(t) {
            for (const fl of flames) {
                const k = 0.85 + 0.15 * Math.sin(t * 7 + fl.k) * Math.sin(t * 3.1 + fl.k);
                fl.f.scale.set(1, 1.2 * k, 1);
                fl.s.material.opacity = 0.6 + 0.2 * k;
            }
            lights.forEach((l, i) => (l.intensity = 2.6 + 0.6 * Math.sin(t * 5 + i)));
        }
    };
}

// ---------- 균열 (적이 나오는 곳) ----------

const riftFrag = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float swirl = sin(a * 3.0 + r * 9.0 - uTime * 2.6) * 0.5 + 0.5;
    float core = 1.0 - smoothstep(0.0, 0.95, r);
    float rim = smoothstep(0.7, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r));
    vec3 dark = vec3(0.05, 0.0, 0.1);
    vec3 glow = vec3(0.75, 0.25, 1.0);
    vec3 col = mix(dark, glow * 1.6, swirl * 0.55 * core + rim * 1.4);
    float alpha = (core * 0.92 + rim) * (1.0 - smoothstep(0.96, 1.0, r));
    gl_FragColor = vec4(col, alpha);
}`;

function createRift(state) {
    const path = state.paths[0];
    samplePath(path, 0, _p);
    const g = new THREE.Group();
    g.name = 'rift';
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader:
            'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: riftFrag,
        transparent: true,
        depthWrite: false,
        toneMapped: false
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 40), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03;
    disc.renderOrder = 4;
    g.add(disc);
    const obsidian = new THREE.MeshStandardMaterial({
        color: 0x1a1024,
        roughness: 0.25,
        metalness: 0.3,
        emissive: 0x6a18a0,
        emissiveIntensity: 0.9
    });
    // 길 바깥쪽(담장 방향)에만 흑요석 결정이 돋는다
    const rand = mulberry32(5);
    for (let i = 0; i < 7; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 + rand() * 0.14), obsidian);
        const a = -Math.PI * (0.55 + rand() * 0.9);
        const r = 0.95 + rand() * 0.4;
        c.position.set(Math.cos(a) * r - 0.3, 0.12, Math.sin(a) * r - 0.2);
        c.scale.y = 1.5 + rand() * 1.4;
        c.rotation.set(rand() - 0.5, rand() * 3, rand() - 0.5);
        c.castShadow = true;
        g.add(c);
    }
    const light = new THREE.PointLight(0xb040ff, 6, 5, 1.6);
    light.position.y = 0.8;
    g.add(light);
    g.position.set(_p.x, 0, _p.z);
    return {
        group: g,
        update(t) {
            mat.uniforms.uTime.value = t;
            light.intensity = 5 + Math.sin(t * 2.3) * 1.5;
        }
    };
}

// ---------- 조립 ----------

/** World 생성자가 부른다: 섬 대신 경기장을 world에 채운다 */
export function buildArena(world, scene, state, th, quality) {
    // 숲 끝이 안개에 녹아들도록
    scene.fog.near = 34;
    scene.fog.far = 90;
    const ground = createGround(th);
    const o = outer();
    const heightAt = ground.heightAt;
    const terrainGroup = new THREE.Group();
    terrainGroup.name = 'terrain';
    terrainGroup.add(ground.mesh);
    // 나무·풀은 경기장 담장 바깥에만 (기존 식생 코드를 그대로 쓰려고 지형 모양의 질의 함수를 준다)
    const arenaDist = (x, z) => rectDist(x, z, o.x + 0.4, o.z + 0.4);
    const REGION = { rx: 26, rz: 19 };
    const fake = {
        heightAt,
        pathDist: (x, z) => Math.max(0, arenaDist(x, z)) + 1.1,
        socketDist: () => 99,
        fortDist: (x, z) => arenaDist(x, z),
        ellipseR: (x, z) => Math.min(0.97, 0.5 + 0.5 * smoothstep(0, 3, arenaDist(x, z))),
        isFree: (x, z, margin = 0) => arenaDist(x, z) > 0.6 + margin,
        core: { x: 0, z: 0 }
    };
    world.terrain = { group: terrainGroup, heightAt, ...fake };
    scene.add(terrainGroup);
    world.vegetation = createVegetation(fake, { island: REGION, quality: quality.grass, theme: th });
    scene.add(world.vegetation.group);

    const track = createTrack(state, th);
    const cells = createCells(state);
    const walls = createWalls(th);
    const rift = createRift(state);
    scene.add(track, cells.group, walls.group, rift.group);

    const none = { group: new THREE.Group(), update() {} };
    world.cloud = { update() {} };
    world.islets = { update() {} };
    world.lanterns = walls;
    world.ramparts = none;
    world.fortress = { ...none, pickables: [], views: [], gateTop: () => null };
    world.rifts = null;
    world.portals = [rift];
    world.portal = rift;
    // 수정은 없다. 수정 주변 반짝이(Effects)는 땅 아래로 보내 보이지 않게 한다
    world.core = {
        group: new THREE.Group(),
        top: new THREE.Vector3(0, -40, 0),
        setHealth() {},
        update() {}
    };
    world.sockets = cells;
    world.ley = { group: new THREE.Group(), update() {} };
    world.hoverSocket = null;
    world.range = createRangeIndicator((x, z) => heightAt(x, z) + CELL_Y);
    scene.add(world.range.mesh);
    world.night = { update() {} };
}
