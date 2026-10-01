// 도로·연석·등불·성벽·포털·수정·소켓·레이 라인.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { samplePath } from '../../core/path.js';
import { cobblestone, glowSprite, runeCircle, beamGradient } from '../util/textures.js';
import { mulberry32 } from '../util/noise.js';
import { ROAD_Y } from './terrain.js';

const ROAD_W = 1.45;
const _p = {};

export const STONE = new THREE.Color('#b9a88c');
export const GOLD = new THREE.Color('#e6b85c');

export function stoneMaterial(color = STONE, rough = 0.85) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
}
export function goldMaterial() {
    return new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.28, metalness: 1 });
}

// ---------- 도로 ----------
export function createRoad(state, theme) {
    const group = new THREE.Group();
    group.name = 'road';
    const tex = cobblestone();
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(theme.road),
        map: tex.map,
        normalMap: tex.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughnessMap: tex.roughnessMap,
        roughness: 1,
        metalness: 0
    });
    const rand = mulberry32(31);
    const curbs = [];
    for (const path of state.paths) {
        const pos = [];
        const uv = [];
        const idx = [];
        const step = 0.2;
        const n = Math.ceil(path.length / step);
        for (let i = 0; i <= n; i++) {
            const d = Math.min(path.length, i * step);
            samplePath(path, d, _p);
            const nx = -_p.dz;
            const nz = _p.dx;
            for (const side of [-1, 1]) {
                const x = _p.x + nx * side * ROAD_W * 0.5;
                const z = _p.z + nz * side * ROAD_W * 0.5;
                pos.push(x, ROAD_Y + 0.02, z);
                uv.push(side < 0 ? 0 : 1, d / ROAD_W);
            }
            if (i < n) {
                const a = i * 2;
                idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
            }
            // 연석
            if (i % 1 === 0 && d > 0.6) {
                for (const side of [-1, 1]) {
                    if (rand() < 0.04) continue;
                    curbs.push({
                        x: _p.x + nx * side * (ROAD_W * 0.5 + 0.03),
                        z: _p.z + nz * side * (ROAD_W * 0.5 + 0.03),
                        rot: Math.atan2(_p.dz, _p.dx) + (rand() - 0.5) * 0.3,
                        s: 0.8 + rand() * 0.5
                    });
                }
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
    }
    const curbGeo = new RoundedBoxGeometry(0.26, 0.1, 0.13, 1, 0.03);
    const curbMesh = new THREE.InstancedMesh(curbGeo, stoneMaterial(new THREE.Color('#7d6f5c'), 0.9), curbs.length);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    curbs.forEach((c, i) => {
        dummy.position.set(c.x, ROAD_Y + 0.04, c.z);
        dummy.rotation.set(0, -c.rot, 0);
        dummy.scale.set(c.s, 0.8 + rand() * 0.6, 1);
        dummy.updateMatrix();
        curbMesh.setMatrixAt(i, dummy.matrix);
        curbMesh.setColorAt(i, col.set('#ffffff').offsetHSL(0, 0, (rand() - 0.5) * 0.18));
    });
    curbMesh.castShadow = true;
    curbMesh.receiveShadow = true;
    group.add(curbMesh);
    return { group };
}

// ---------- 등불 ----------
export function createLanterns(state, terrain) {
    const group = new THREE.Group();
    group.name = 'lanterns';
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.6, metalness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({
        color: 0x331a00,
        emissive: 0xffa640,
        emissiveIntensity: 6,
        roughness: 0.4
    });
    const pool = new THREE.MeshBasicMaterial({
        map: glowSprite(),
        color: 0xff9a40,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const lamps = [];
    let side = 1;
    const placed = [];
    for (const path of state.paths)
        for (let d = 3.5; d < path.length - 2; d += 4.6) {
            samplePath(path, d, _p);
            let ok = false;
            for (const s of [side, -side]) {
                const x = _p.x - _p.dz * s * 1.05;
                const z = _p.z + _p.dx * s * 1.05;
                if (
                    terrain.socketDist(x, z) > 0.95 &&
                    terrain.pathDist(x, z) > 0.95 &&
                    !placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < 2.5)
                ) {
                    placed.push([x, z]);
                    const lamp = new THREE.Group();
                    const h = terrain.heightAt(x, z);
                    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.95, 6), iron);
                    post.position.y = 0.475;
                    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.1, 4), iron);
                    cap.position.y = 1.08;
                    cap.rotation.y = Math.PI / 4;
                    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.1), glass);
                    bulb.position.y = 0.98;
                    post.castShadow = true;
                    const light = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), pool);
                    light.rotation.x = -Math.PI / 2;
                    light.position.y = 0.03;
                    lamp.add(post, cap, bulb, light);
                    lamp.position.set(x, h, z);
                    lamp.userData.bulb = bulb;
                    lamp.userData.phase = d;
                    group.add(lamp);
                    lamps.push(lamp);
                    ok = true;
                    break;
                }
            }
            if (ok) side = -side;
        }
    return {
        group,
        update(t) {
            const k = 6 + Math.sin(t * 7) * 0.3;
            glass.emissiveIntensity = k;
        }
    };
}

// ---------- 성벽 ----------
export function createRamparts(state, terrain, theme) {
    const group = new THREE.Group();
    group.name = 'ramparts';
    const rim = terrain.rimPts;
    const starts = state.paths.map((p) => ({ x: p.xs[0], z: p.zs[0] }));
    const core = terrain.core;
    const blocks = [];
    const towers = [];
    let run = 0;
    for (let j = 0; j < rim.length; j++) {
        const a = rim[j];
        const b = rim[(j + 1) % rim.length];
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        // 포털·수정·도로 근처, 그리고 카메라 쪽 앞면(가림 방지)은 비운다
        const blocked =
            starts.some((st) => Math.hypot(mx - st.x, mz - st.z) < 3.5) ||
            Math.hypot(mx - core.x, mz - core.z) < 3.5 ||
            terrain.pathDist(mx * 0.95, mz * 0.95) < 1.6 ||
            (mz > 4.5 && Math.abs(mx) < 13.5);
        if (blocked) {
            run = 0;
            continue;
        }
        const ix = mx * 0.972;
        const iz = mz * 0.972;
        blocks.push({
            x: ix,
            z: iz,
            y: terrain.heightAt(ix, iz),
            rot: Math.atan2(b.z - a.z, b.x - a.x),
            len: Math.hypot(b.x - a.x, b.z - a.z),
            crenel: j % 2 === 0
        });
        run++;
        if (run % 14 === 7) towers.push({ x: ix, z: iz, y: terrain.heightAt(ix, iz) });
    }
    const wallMat = stoneMaterial(new THREE.Color(theme.wall), 0.88);
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.62, 0.34), wallMat, blocks.length);
    const merlonCount = blocks.filter((b) => b.crenel).length;
    const merlons = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.2, 0.36), wallMat, merlonCount);
    const dummy = new THREE.Object3D();
    let mi = 0;
    blocks.forEach((b, i) => {
        dummy.position.set(b.x, b.y + 0.28, b.z);
        dummy.rotation.set(0, -b.rot, 0);
        dummy.scale.set(b.len + 0.04, 1, 1);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
        if (b.crenel) {
            dummy.position.y = b.y + 0.68;
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            merlons.setMatrixAt(mi++, dummy.matrix);
        }
    });
    for (const m of [body, merlons]) {
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
    }
    // 망루
    const roofMat = new THREE.MeshStandardMaterial({ color: theme.roof, roughness: 0.7 });
    const bannerMat = new THREE.MeshStandardMaterial({ color: theme.banner, roughness: 0.8, side: THREE.DoubleSide });
    const gold = goldMaterial();
    for (const t of towers) {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.5, 10), wallMat);
        shaft.position.y = 0.75;
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.14, 10), wallMat);
        ring.position.y = 1.55;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.9, 10), roofMat);
        roof.position.y = 2.07;
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), gold);
        tip.position.y = 2.55;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7), gold);
        pole.position.y = 2.85;
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.22), bannerMat);
        banner.position.set(0.22, 3.05, 0);
        g.add(shaft, ring, roof, tip, pole, banner);
        g.traverse((o) => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
        g.position.set(t.x, t.y, t.z);
        g.userData.banner = banner;
        group.add(g);
    }
    return {
        group,
        update(t) {
            for (const g of group.children) {
                if (g.userData.banner) g.userData.banner.rotation.y = Math.sin(t * 2.2 + g.position.x) * 0.35;
            }
        }
    };
}

// ---------- 포털 ----------
const portalFrag = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.y, p.x);
    float swirl = a + r * 5.0 - uTime * 1.6;
    float n = noise(vec2(swirl * 1.3, r * 4.0 - uTime * 0.8)) * 0.6 + noise(vec2(swirl * 3.0, r * 9.0)) * 0.4;
    vec3 deep = vec3(0.04, 0.0, 0.08);
    vec3 violet = vec3(0.55, 0.12, 0.95);
    vec3 hot = vec3(1.2, 0.35, 1.4);
    vec3 col = mix(deep, violet, smoothstep(0.35, 0.8, n) * (0.4 + r));
    col += hot * smoothstep(0.75, 1.0, r) * (0.6 + 0.4 * sin(uTime * 3.0 + a * 4.0));
    col *= 1.0 - smoothstep(0.0, 0.35, 0.35 - r) * 0.8;
    gl_FragColor = vec4(col, 1.0);
}`;

export function createPortal(state, terrain, pathIndex = 0) {
    const path = state.paths[pathIndex];
    samplePath(path, 0.6, _p);
    const g = new THREE.Group();
    g.name = 'portal';
    const stone = stoneMaterial(new THREE.Color('#5a5262'), 0.8);
    const obsidian = new THREE.MeshStandardMaterial({
        color: 0x1a1024,
        roughness: 0.25,
        metalness: 0.3,
        emissive: 0x6a18a0,
        emissiveIntensity: 0.9
    });
    for (const s of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.3, 0.34), stone);
        pillar.position.set(0, 1.15, s * 1.05);
        pillar.rotation.y = 0.1 * s;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), obsidian);
        crystal.scale.y = 2;
        crystal.position.set(0, 2.6, s * 1.05);
        g.add(pillar, crystal);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.17, 8, 24, Math.PI), stone);
    arch.rotation.y = Math.PI / 2;
    arch.position.y = 2.3;
    g.add(arch);
    const discMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader:
            'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: portalFrag,
        side: THREE.DoubleSide,
        toneMapped: false
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), discMat);
    disc.scale.set(1, 1.45, 1);
    disc.rotation.y = Math.PI / 2;
    disc.position.y = 1.55;
    g.add(disc);
    // 주변의 흑요석 결정
    const rand = mulberry32(5);
    for (let i = 0; i < 9; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 + rand() * 0.18), obsidian);
        const a = rand() * Math.PI * 2;
        c.position.set(Math.cos(a) * (1.4 + rand()), 0.1, Math.sin(a) * (1.4 + rand()));
        c.scale.y = 1.5 + rand() * 1.5;
        c.rotation.set(rand() - 0.5, rand() * 3, rand() - 0.5);
        g.add(c);
    }
    g.traverse((o) => {
        if (o.isMesh && o !== disc) o.castShadow = true;
    });
    const light = new THREE.PointLight(0xb040ff, 12, 7, 1.6);
    light.position.set(0.6, 1.5, 0);
    g.add(light);
    g.position.set(_p.x, terrain.heightAt(_p.x, _p.z), _p.z);
    g.rotation.y = -Math.atan2(_p.dz, _p.dx);
    return {
        group: g,
        update(t) {
            discMat.uniforms.uTime.value = t;
            light.intensity = 10 + Math.sin(t * 2.3) * 3;
        }
    };
}

// ---------- 마지막 빛 (수정) ----------
export function createCore(state, terrain) {
    const { x, z } = terrain.core;
    const g = new THREE.Group();
    g.name = 'core';
    const stone = stoneMaterial(new THREE.Color('#c9b894'), 0.75);
    const gold = goldMaterial();
    const tiers = [
        [1.5, 1.65, 0.22],
        [1.2, 1.35, 0.2],
        [0.9, 1.02, 0.18]
    ];
    let y = 0;
    for (const [rt, rb, h] of tiers) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 8), stone);
        m.position.y = y + h / 2;
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        const trim = new THREE.Mesh(new THREE.CylinderGeometry(rt + 0.01, rt + 0.01, 0.035, 8), gold);
        trim.position.y = y + h - 0.01;
        g.add(trim);
        y += h;
    }
    const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xfff1d0,
        emissive: 0xffc870,
        emissiveIntensity: 4.5,
        roughness: 0.15,
        metalness: 0.1,
        flatShading: true
    });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), crystalMat);
    crystal.scale.set(0.75, 2.1, 0.75);
    crystal.position.y = y + 1.35;
    g.add(crystal);
    const shards = new THREE.Group();
    for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), crystalMat);
        const a = (i / 6) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
        s.scale.set(0.7, 1.9, 0.7);
        shards.add(s);
    }
    shards.position.y = y + 1.3;
    g.add(shards);
    const runeMat = new THREE.MeshBasicMaterial({
        map: runeCircle(),
        color: new THREE.Color('#ffcf7a').multiplyScalar(3),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
    });
    const ringA = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), runeMat);
    ringA.rotation.x = -Math.PI / 2;
    ringA.position.y = y + 0.02;
    const ringB = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), runeMat);
    ringB.position.y = y + 1.35;
    ringB.rotation.x = -Math.PI / 2 + 0.35;
    g.add(ringA, ringB);
    // 하늘로 솟는 빛기둥
    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.5, 26, 24, 1, true),
        new THREE.MeshBasicMaterial({
            map: beamGradient(),
            color: new THREE.Color('#ffd89a').multiplyScalar(2.2),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
            opacity: 0.4
        })
    );
    beam.position.y = y + 13;
    g.add(beam);
    const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: glowSprite(),
            color: 0xffc070,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.8
        })
    );
    halo.scale.setScalar(2.4);
    halo.position.y = y + 1.35;
    g.add(halo);
    const light = new THREE.PointLight(0xffb45a, 14, 9, 1.6);
    light.position.y = y + 1.6;
    g.add(light);
    g.position.set(x, terrain.heightAt(x, z), z);
    const baseY = crystal.position.y;
    return {
        group: g,
        crystal,
        top: new THREE.Vector3(x, g.position.y + baseY, z),
        setHealth(ratio) {
            crystalMat.emissiveIntensity = 1.5 + 3 * ratio;
            light.intensity = 5 + 9 * ratio;
            beam.material.opacity = 0.12 + 0.28 * ratio;
        },
        update(t) {
            crystal.rotation.y = t * 0.35;
            crystal.position.y = baseY + Math.sin(t * 1.2) * 0.08;
            shards.rotation.y = -t * 0.5;
            ringA.rotation.z = t * 0.12;
            ringB.rotation.z = -t * 0.3;
            halo.material.opacity = 0.45 + Math.sin(t * 2) * 0.08;
        }
    };
}

// ---------- 소켓 ----------
export function createSockets(state, terrain) {
    const group = new THREE.Group();
    group.name = 'sockets';
    const stone = stoneMaterial(new THREE.Color('#9c8e78'), 0.8);
    const dark = stoneMaterial(new THREE.Color('#5e5446'), 0.9);
    const baseGeo = mergeGeometries([
        new THREE.CylinderGeometry(0.66, 0.74, 0.12, 12).translate(0, 0.06, 0),
        new THREE.CylinderGeometry(0.56, 0.62, 0.1, 12).translate(0, 0.16, 0)
    ]);
    const runeTex = runeCircle();
    const items = [];
    for (const s of state.sockets) {
        const g = new THREE.Group();
        const base = new THREE.Mesh(baseGeo, stone);
        base.castShadow = true;
        base.receiveShadow = true;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 6, 24), dark);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.21;
        const runeMat = new THREE.MeshBasicMaterial({
            map: runeTex,
            color: new THREE.Color('#9fd8ff'),
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });
        const rune = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), runeMat);
        rune.rotation.x = -Math.PI / 2;
        rune.position.y = 0.215;
        g.add(base, rim, rune);
        g.position.set(s.x, terrain.heightAt(s.x, s.z) - 0.02, s.z);
        g.userData.socketId = s.id;
        base.userData.socketId = s.id;
        group.add(g);
        items.push({ group: g, rune, runeMat, pick: base });
    }
    return {
        group,
        items,
        pickables: items.map((i) => i.pick),
        topY: (id) => items[id].group.position.y + 0.21,
        update(t, state2, hoverId) {
            items.forEach((it, i) => {
                const occupied = state2.sockets[i].towerId != null;
                const hover = hoverId === i;
                it.rune.visible = !occupied || hover;
                it.runeMat.opacity = hover ? 1 : 0.35 + 0.15 * Math.sin(t * 2 + i);
                it.runeMat.color.set(hover ? '#ffe39a' : '#9fd8ff').multiplyScalar(hover ? 2 : 1);
                it.rune.rotation.z = t * (hover ? 0.8 : 0.15);
            });
        }
    };
}

// ---------- 레이 라인 (공명 연결) ----------
const leyFrag = /* glsl */ `
uniform float uTime;
uniform float uActive;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
    float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float core = pow(edge, 3.0);
    float flow = 0.5 + 0.5 * sin((vUv.x * 10.0 - uTime * 2.5));
    float a = core * mix(0.28, 0.9 + 0.35 * flow, uActive);
    gl_FragColor = vec4(uColor * (1.0 + uActive * 3.0), a);
}`;

export function createLeyLines(state, terrain) {
    const group = new THREE.Group();
    group.name = 'leylines';
    const lines = [];
    for (const [a, b] of state.map.links) {
        const A = state.sockets[a];
        const B = state.sockets[b];
        const len = Math.hypot(B.x - A.x, B.z - A.z) - 1.1;
        const mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uActive: { value: 0 }, uColor: { value: new THREE.Color('#b99cff') } },
            vertexShader:
                'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: leyFrag,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.22), mat);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = -Math.atan2(B.z - A.z, B.x - A.x);
        const mx = (A.x + B.x) / 2;
        const mz = (A.z + B.z) / 2;
        m.position.set(mx, Math.max(terrain.heightAt(mx, mz), terrain.heightAt(A.x, A.z)) + 0.06, mz);
        group.add(m);
        lines.push({ a, b, mat });
    }
    return {
        group,
        update(t, state2) {
            for (const l of lines) {
                l.mat.uniforms.uTime.value = t;
                const ta = state2.sockets[l.a].towerId;
                const tb = state2.sockets[l.b].towerId;
                let active = 0;
                if (ta != null && tb != null) {
                    const A = state2.towers.find((x) => x.id === ta);
                    const B = state2.towers.find((x) => x.id === tb);
                    active = A && B && A.type !== B.type ? 1 : 0.35;
                }
                const u = l.mat.uniforms.uActive;
                u.value += (active - u.value) * 0.08;
            }
        }
    };
}
