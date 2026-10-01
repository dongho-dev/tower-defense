// 살아남기: 섬 가장자리를 두른 보랏빛 어둠의 장막. 이번(또는 다음) 웨이브가 몰려오는 방향이 밝게 일렁인다.
// 포털 대신 쓰이며, HUD의 웨이브 호출 마커는 portal.group(다음 웨이브 주 방향의 가장자리)에 붙는다.
import * as THREE from 'three';
import { waveDirections } from '../../core/survival.js';

const MAX_DIRS = 4;
const SEG = 180;
const HEIGHT = 1.9;

const vert = /* glsl */ `
attribute float aAng;
attribute float aV;
varying float vAng;
varying float vV;
void main() {
    vAng = aAng;
    vV = aV;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const frag = /* glsl */ `
uniform float uTime;
uniform float uAll;
uniform float uStrength;
uniform vec4 uDirs[${MAX_DIRS}];
varying float vAng;
varying float vV;
float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise(float x) { float i = floor(x); float f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void main() {
    float w = uAll * 0.75;
    for (int i = 0; i < ${MAX_DIRS}; i++) {
        vec4 d = uDirs[i];
        if (d.z > 0.0) {
            float da = abs(atan(sin(vAng - d.x), cos(vAng - d.x)));
            w = max(w, 1.0 - smoothstep(d.y * 0.7, d.y + 0.4, da));
        }
    }
    // 일렁이는 연기 결: 각도와 높이를 따라 흐른다
    float n = noise(vAng * 9.0 + uTime * 0.7) * 0.6 + noise(vAng * 23.0 - uTime * 1.3 + vV * 3.0) * 0.4;
    float v = clamp(vV, 0.0, 1.0);
    float fade = pow(1.0 - v, 1.6) * smoothstep(0.0, 0.08, v);
    float a = (0.1 + w * uStrength * (0.65 + 0.5 * n)) * fade * (0.55 + 0.45 * n);
    vec3 col = mix(vec3(0.35, 0.18, 0.75), vec3(0.95, 0.3, 1.0), w * uStrength);
    gl_FragColor = vec4(col * a, a);
}`;

export function createRifts(state, terrain) {
    const group = new THREE.Group();
    group.name = 'rifts';
    const anchor = new THREE.Group();
    group.add(anchor);
    const empty = { group, portal: { group: anchor }, update() {} };
    const cfg = state.map.survival;
    if (!cfg) return empty;
    // 레인 출발점 바로 바깥을 따라 장막을 세운다
    const pos = [];
    const ang = [];
    const vs = [];
    const idx = [];
    const first = state.paths[0];
    const r0 = Math.hypot(first.xs[0] / (state.map.island.rx || 1), first.zs[0] / (state.map.island.rz || 1));
    const rr = r0 + 0.035;
    for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const x = Math.cos(a) * state.map.island.rx * rr;
        const z = Math.sin(a) * state.map.island.rz * rr;
        const y = terrain.heightAt(x, z) - 0.15;
        for (const v of [0, 1]) {
            pos.push(x, y + v * HEIGHT, z);
            ang.push(a);
            vs.push(v);
        }
        if (i < SEG) {
            const k = i * 2;
            idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aAng', new THREE.Float32BufferAttribute(ang, 1));
    geo.setAttribute('aV', new THREE.Float32BufferAttribute(vs, 1));
    geo.setIndex(idx);
    const uniforms = {
        uTime: { value: 0 },
        uAll: { value: 0 },
        uStrength: { value: 0 },
        uDirs: { value: Array.from({ length: MAX_DIRS }, () => new THREE.Vector4()) }
    };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false
    });
    const curtain = new THREE.Mesh(geo, mat);
    curtain.renderOrder = 2;
    curtain.frustumCulled = false;
    group.add(curtain);

    // 레인 각도(도) → 장막 위 지점
    const rimPoint = (deg, out) => {
        const a = (deg * Math.PI) / 180;
        const x = Math.cos(a) * state.map.island.rx * rr;
        const z = Math.sin(a) * state.map.island.rz * rr;
        return out.set(x, terrain.heightAt(x, z), z);
    };
    rimPoint(90, anchor.position);
    let strength = 0;
    let shownWave = null;

    return {
        group,
        portal: { group: anchor },
        update(t, dt) {
            uniforms.uTime.value = t;
            // 카운트다운 중이면 다음 웨이브 방향이 맥박치고, 몰려오는 중이면 이번 웨이브 방향이 타오른다
            const incoming = state.status === 'playing' && (state.nextWaveIn != null || state.waveIndex === 0);
            const wave = incoming ? state.waves[state.waveIndex] : state.waves[state.waveIndex - 1];
            const busy = state.spawners.length > 0;
            let want = 0;
            if (state.status === 'playing' && wave) want = busy ? 1 : incoming ? 0.45 + 0.25 * Math.sin(t * 3) : 0.3;
            strength += (want - strength) * Math.min(1, dt * 3);
            uniforms.uStrength.value = strength;
            if (wave === shownWave) return;
            shownWave = wave;
            const dirs = wave ? waveDirections(wave) : [];
            uniforms.uAll.value = dirs.some((d) => d.from == null) ? 1 : 0;
            const list = dirs.filter((d) => d.from != null).slice(0, MAX_DIRS);
            uniforms.uDirs.value.forEach((v, i) => {
                const d = list[i];
                if (d) v.set((d.from * Math.PI) / 180, (d.spread * Math.PI) / 180, 1, 0);
                else v.set(0, 0, 0, 0);
            });
            // 호출 마커: 주 방향(첫 방향 무리)의 가장자리, 사방이면 카메라 앞쪽
            rimPoint(list.length ? list[0].from : 90, anchor.position);
        }
    };
}
