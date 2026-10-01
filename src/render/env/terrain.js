// 떠 있는 섬: 잔디 윗면(도로·소켓 자리는 평탄화) + 지층이 드러난 절벽/아랫면.
import * as THREE from 'three';
import { createNoise, smoothstep, lerp } from '../util/noise.js';
import { grassDetail } from '../util/textures.js';

export const ROAD_Y = -0.04;
const RES = 0.2;

export function createTerrain(state, theme) {
    const pal = theme.ground;
    const { rx, rz } = state.map.island;
    const noise = createNoise(hashString(state.map.id));
    const { fbm, n2 } = noise;

    // 경로 거리장 (격자 룩업)
    const gx0 = -rx - 1.5;
    const gz0 = -rz - 1.5;
    const gw = Math.ceil((2 * rx + 3) / RES);
    const gh = Math.ceil((2 * rz + 3) / RES);
    const pathField = new Float32Array(gw * gh).fill(99);
    for (const path of state.paths) {
        for (let k = 0; k < path.count; k += 2) {
            const px = path.xs[k];
            const pz = path.zs[k];
            const ci = Math.round((px - gx0) / RES);
            const cj = Math.round((pz - gz0) / RES);
            const R = Math.ceil(4 / RES);
            for (let j = Math.max(0, cj - R); j < Math.min(gh, cj + R); j++) {
                for (let i = Math.max(0, ci - R); i < Math.min(gw, ci + R); i++) {
                    const d = Math.hypot(gx0 + i * RES - px, gz0 + j * RES - pz);
                    const idx = j * gw + i;
                    if (d < pathField[idx]) pathField[idx] = d;
                }
            }
        }
    }
    function pathDist(x, z) {
        const fi = (x - gx0) / RES;
        const fj = (z - gz0) / RES;
        const i = Math.max(0, Math.min(gw - 2, Math.floor(fi)));
        const j = Math.max(0, Math.min(gh - 2, Math.floor(fj)));
        const tx = Math.min(1, Math.max(0, fi - i));
        const tz = Math.min(1, Math.max(0, fj - j));
        const a = pathField[j * gw + i];
        const b = pathField[j * gw + i + 1];
        const c = pathField[(j + 1) * gw + i];
        const d = pathField[(j + 1) * gw + i + 1];
        return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
    }
    const socketDist = (x, z) => {
        let best = 99;
        for (const s of state.sockets) best = Math.min(best, Math.hypot(s.x - x, s.z - z));
        return best;
    };
    const coreEnd = state.paths[0];
    const core = { x: coreEnd.xs[coreEnd.count - 1], z: coreEnd.zs[coreEnd.count - 1] };

    const rimFactor = (theta) =>
        1 +
        0.07 * fbm(Math.cos(theta) * 1.3 + 5, Math.sin(theta) * 1.3, 3) +
        0.025 * n2(Math.cos(theta) * 5, Math.sin(theta) * 5);
    // 성채(공성전 맵): 성벽 사각형까지의 거리. 안쪽은 음수
    const fort = state.map.fortress;
    const fortDist = fort ? (x, z) => Math.max(Math.abs(x) - fort.hx, Math.abs(z) - fort.hz) : () => 99;
    const ellipseR = (x, z) => Math.sqrt((x / rx) ** 2 + (z / rz) ** 2) / rimFactor(Math.atan2(z / rz, x / rx));

    function heightAt(x, z) {
        const dp = pathDist(x, z);
        const hills = 0.75 * Math.max(0, fbm(x * 0.085 + 3.1, z * 0.085 - 1.7, 4)) + 0.1 * fbm(x * 0.35, z * 0.35, 2);
        const away = smoothstep(1.2, 3.6, dp);
        let h = hills * away + 0.05 * fbm(x * 0.6, z * 0.6, 2);
        h = lerp(ROAD_Y, h, smoothstep(0.8, 1.35, dp));
        h = lerp(0.06, h, smoothstep(0.8, 1.25, socketDist(x, z)));
        const dc = Math.hypot(x - core.x, z - core.z);
        h = lerp(0.12, h, smoothstep(1.6, 2.6, dc));
        // 성 안마당과 성벽 자리는 평평하게
        if (fort) h = lerp(0.04, h, smoothstep(0.7, 2.4, fortDist(x, z)));
        const e = ellipseR(x, z);
        h += 0.22 * smoothstep(0.84, 0.99, e) * away;
        return h;
    }

    const group = new THREE.Group();
    group.name = 'terrain';

    // ---------- 윗면 (극좌표 격자) ----------
    const NA = 240;
    const NR = 96;
    const topPos = [];
    const topCol = [];
    const topUv = [];
    const c = new THREE.Color();
    const grassA = new THREE.Color(pal.grassA);
    const grassB = new THREE.Color(pal.grassB);
    const dry = new THREE.Color(pal.dry);
    const dirt = new THREE.Color(pal.dirt);
    const rimRock = new THREE.Color(pal.rim);
    const rimPts = [];
    for (let j = 0; j < NA; j++) {
        const theta = (j / NA) * Math.PI * 2;
        const rf = rimFactor(theta);
        for (let i = 0; i <= NR; i++) {
            const r = Math.pow(i / NR, 0.85);
            const x = Math.cos(theta) * rx * rf * r;
            const z = Math.sin(theta) * rz * rf * r;
            const y = heightAt(x, z);
            topPos.push(x, y, z);
            topUv.push(x * 0.35, z * 0.35);
            const dp = pathDist(x, z);
            const n = fbm(x * 0.18 + 10, z * 0.18, 3) * 0.5 + 0.5;
            c.copy(grassA).lerp(grassB, smoothstep(0.25, 0.8, n));
            const dryK = smoothstep(0.35, 0.7, fbm(x * 0.07 - 4, z * 0.07 + 2, 3));
            c.lerp(dry, dryK * 0.55);
            c.lerp(dirt, 1 - smoothstep(0.9, 1.7, dp));
            // 다져진 흙 안마당
            if (fort) c.lerp(dirt, 0.45 * (1 - smoothstep(-0.8, 0.1, fortDist(x, z))));
            c.lerp(rimRock, smoothstep(0.93, 1.0, r) * 0.7);
            const shade = 0.82 + 0.18 * smoothstep(-0.05, 0.5, y);
            c.multiplyScalar(shade);
            topCol.push(c.r, c.g, c.b);
            if (i === NR) rimPts.push({ x, y, z, theta, rf });
        }
    }
    const topIdx = [];
    for (let j = 0; j < NA; j++) {
        const j2 = (j + 1) % NA;
        for (let i = 0; i < NR; i++) {
            const a = j * (NR + 1) + i;
            const b = j2 * (NR + 1) + i;
            topIdx.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
    topGeo.setAttribute('color', new THREE.Float32BufferAttribute(topCol, 3));
    topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2));
    topGeo.setIndex(topIdx);
    topGeo.computeVertexNormals();
    const topMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: grassDetail(),
        roughness: 0.96,
        metalness: 0
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.receiveShadow = true;
    top.name = 'ground';
    group.add(top);

    // ---------- 절벽 · 아랫면 ----------
    const NK = 30;
    const cliffPos = [];
    const cliffCol = [];
    const soil = new THREE.Color(theme.cliff.soil);
    const bands = theme.cliff.bands.map((h) => new THREE.Color(h));
    const deep = new THREE.Color(theme.cliff.deep);
    for (let j = 0; j < NA; j++) {
        const { theta, rf, y: y0 } = rimPts[j];
        const depth = 7.5 + 3.5 * fbm(Math.cos(theta) * 1.7, Math.sin(theta) * 1.7 + 9, 3);
        for (let k = 0; k <= NK; k++) {
            const t = k / NK;
            // 입술처럼 살짝 튀어나왔다가 뾰족하게 좁아지는 옆모습
            const lip = t < 0.06 ? 1 + t * 0.35 : 1.021 * Math.pow(Math.cos(((t - 0.06) / 0.94) * Math.PI * 0.5), 0.75);
            const jag =
                1 + 0.09 * n2(Math.cos(theta) * 3 + t * 4, Math.sin(theta) * 3 - t * 5) * smoothstep(0.02, 0.2, t);
            const s = Math.max(0.02, lip * jag);
            const x = Math.cos(theta) * rx * rf * s;
            const z = Math.sin(theta) * rz * rf * s;
            const y = y0 - (k === 0 ? 0 : 0.05 + Math.pow(t, 1.15) * depth);
            cliffPos.push(x, y, z);
            if (t < 0.05) c.copy(soil);
            else {
                const band = Math.floor((y + 40 + 0.35 * n2(theta * 3, y * 0.5)) / 0.55) % bands.length;
                c.copy(bands[band]).lerp(deep, smoothstep(0.35, 1.0, t));
                c.multiplyScalar(0.9 + 0.2 * n2(theta * 12, y * 2));
            }
            cliffCol.push(c.r, c.g, c.b);
        }
    }
    const cliffIdx = [];
    for (let j = 0; j < NA; j++) {
        const j2 = (j + 1) % NA;
        for (let k = 0; k < NK; k++) {
            const a = j * (NK + 1) + k;
            const b = j2 * (NK + 1) + k;
            cliffIdx.push(a, a + 1, b, b, a + 1, b + 1);
        }
    }
    const cliffGeo = new THREE.BufferGeometry();
    cliffGeo.setAttribute('position', new THREE.Float32BufferAttribute(cliffPos, 3));
    cliffGeo.setAttribute('color', new THREE.Float32BufferAttribute(cliffCol, 3));
    cliffGeo.setIndex(cliffIdx);
    cliffGeo.computeVertexNormals();
    const cliff = new THREE.Mesh(
        cliffGeo,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true })
    );
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    cliff.name = 'cliff';
    group.add(cliff);

    function isFree(x, z, margin = 0) {
        if (ellipseR(x, z) > 0.94 - margin * 0.02) return false;
        if (pathDist(x, z) < 1.3 + margin) return false;
        if (socketDist(x, z) < 1.1 + margin) return false;
        if (Math.hypot(x - core.x, z - core.z) < 2.4 + margin) return false;
        if (fortDist(x, z) < 0.9 + margin) return false;
        return true;
    }

    return { group, heightAt, pathDist, socketDist, ellipseR, isFree, fortDist, rimPts, core, noise };
}

export function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}
