// 살아남기 지형 메시: 타일 격자(snowfield)를 높이장으로 바꿔 한 장의 메시로 만든다.
// 타일 하나에 꼭짓점 3×3. 단 사이는 smoothstep으로 가파르게 이어 절벽처럼 보이고, 비탈은 고르게 잇는다.
// 색: 고원·벌판은 눈, 분지는 얼어붙은 검보랏빛 땅, 비탈은 다져진 흙, 가파른 면은 바위띠.
// 적·건물·이펙트가 땅에 붙도록 heightAt은 이 메시의 꼭짓점 높이를 그대로 보간한다.
import * as THREE from 'three';
import { KIND, fbm, valueNoise } from '../../core/snowfield.js';

const SUB = 3;

const C = (h) => new THREE.Color(h);
const COL = {
    snowHi: C('#e9eef8'),
    snowMid: C('#d2dae8'),
    snowShade: C('#a9b6d0'),
    trample: C('#8f877e'),
    basin: C('#5d5a74'),
    corrupt: C('#5a2c74'),
    ramp: C('#a39486'),
    rockA: C('#4e4642'),
    rockB: C('#6e6258'),
    rockDeep: C('#2a2424'),
    vein: C('#c9a45a')
};

/** 눈결 무늬 (바둑판처럼 이어지는 잔 노이즈): 지형 색에 곱해 가까이서도 밋밋하지 않게 */
function snowDetail(seed) {
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
            // 주기 S로 이어지는 노이즈 (가장자리가 맞닿게 네 귀퉁이를 섞는다)
            const u = x / S;
            const v = y / S;
            const n = (a, b) => fbm(a, b, seed + 40, 4);
            const f = 8;
            const val =
                n(u * f, v * f) * (1 - u) * (1 - v) +
                n((u - 1) * f, v * f) * u * (1 - v) +
                n(u * f, (v - 1) * f) * (1 - u) * v +
                n((u - 1) * f, (v - 1) * f) * u * v;
            const c = 228 + val * 34 + (hashN(x, y) - 0.5) * 14;
            const k = (y * S + x) * 4;
            img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.max(0, Math.min(255, c));
            img.data[k + 3] = 255;
        }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}
function hashN(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
}

export function createSurvivalTerrain(state, fogLayer) {
    const sv = state.survival;
    const f = sv.field;
    const { N, T, half, kind, level } = f;
    const L = sv.cfg.levels;
    const seed = sv.cfg.seed ?? 1;

    // 1) 타일 표시 높이 (바위·가장자리 산맥은 솟게)
    const th = new Float32Array(N * N);
    // 가장자리에서 걸을 수 있는 땅까지의 거리 (산맥이 안쪽에서 바깥으로 솟도록)
    const borderDepth = new Float32Array(N * N);
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const k = j * N + i;
            const edge = Math.min(i + 0.5, j + 0.5, N - i - 0.5, N - j - 0.5);
            borderDepth[k] = edge;
        }
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const k = j * N + i;
            const K = kind[k];
            let h = f.height[k];
            if (K === KIND.rock) h = L[level[k]] + 1.1 + 1.3 * valueNoise(i * 0.45, j * 0.45, seed + 3);
            else if (K === KIND.border) {
                const inner = Math.max(0, 6 - borderDepth[k]);
                h = L[1] + 1.2 + inner * 1.2 + 2.2 * valueNoise(i * 0.3, j * 0.3, seed + 4);
            } else if (K === KIND.nest) h = L[0] - 0.1;
            th[k] = h;
        }
    const tileH = (i, j) => th[Math.max(0, Math.min(N - 1, j)) * N + Math.max(0, Math.min(N - 1, i))];
    const isRamp = (i, j) => kind[Math.max(0, Math.min(N - 1, j)) * N + Math.max(0, Math.min(N - 1, i))] === KIND.ramp;
    const sstep = (t) => t * t * (3 - 2 * t);

    // 2) 꼭짓점 높이: 이웃 네 타일 중심 사이를 smoothstep(절벽) 또는 선형(비탈)으로
    const V = N * SUB + 1;
    const step = T / SUB;
    const H = new Float32Array(V * V);
    for (let vj = 0; vj < V; vj++)
        for (let vi = 0; vi < V; vi++) {
            const x = vi * step;
            const z = vj * step;
            const fi = x / T - 0.5;
            const fj = z / T - 0.5;
            const i0 = Math.floor(fi);
            const j0 = Math.floor(fj);
            const tx = fi - i0;
            const tz = fj - j0;
            const ramp = isRamp(i0, j0) || isRamp(i0 + 1, j0) || isRamp(i0, j0 + 1) || isRamp(i0 + 1, j0 + 1);
            // 절벽은 smoothstep을 두 번 걸어 윗면은 평평하고 벽은 가파르게
            const sx = ramp ? tx : sstep(sstep(tx));
            const sz = ramp ? tz : sstep(sstep(tz));
            const a = tileH(i0, j0) + (tileH(i0 + 1, j0) - tileH(i0, j0)) * sx;
            const b = tileH(i0, j0 + 1) + (tileH(i0 + 1, j0 + 1) - tileH(i0, j0 + 1)) * sx;
            H[vj * V + vi] = a + (b - a) * sz;
        }
    // 3) 가파른 곳일수록 크게 울퉁불퉁 (절벽·바위), 평지는 눈 둔덕 정도
    const base = H.slice();
    for (let vj = 0; vj < V; vj++)
        for (let vi = 0; vi < V; vi++) {
            const k = vj * V + vi;
            const l = base[vj * V + Math.max(0, vi - 1)];
            const r = base[vj * V + Math.min(V - 1, vi + 1)];
            const u = base[Math.max(0, vj - 1) * V + vi];
            const d = base[Math.min(V - 1, vj + 1) * V + vi];
            const steep = Math.min(1, (Math.abs(r - l) + Math.abs(d - u)) / (step * 2.2));
            const x = vi * step;
            const z = vj * step;
            H[k] +=
                fbm(x * 0.35, z * 0.35, seed + 11, 2) * (0.06 + 0.55 * steep) +
                fbm(x * 1.4, z * 1.4, seed + 12, 2) * 0.12 * steep;
        }

    // 4) 메시
    const pos = new Float32Array(V * V * 3);
    const col = new Float32Array(V * V * 3);
    for (let vj = 0; vj < V; vj++)
        for (let vi = 0; vi < V; vi++) {
            const k = vj * V + vi;
            pos[k * 3] = -half + vi * step;
            pos[k * 3 + 1] = H[k];
            pos[k * 3 + 2] = -half + vj * step;
        }
    const idx = new Uint32Array((V - 1) * (V - 1) * 6);
    let n = 0;
    for (let vj = 0; vj < V - 1; vj++)
        for (let vi = 0; vi < V - 1; vi++) {
            const a = vj * V + vi;
            const b = a + 1;
            const c = a + V;
            const d = c + 1;
            // 대각선 방향을 번갈아 바꿔 결이 한쪽으로 쏠리지 않게
            if ((vi + vj) & 1) {
                idx[n++] = a;
                idx[n++] = c;
                idx[n++] = b;
                idx[n++] = b;
                idx[n++] = c;
                idx[n++] = d;
            } else {
                idx[n++] = a;
                idx[n++] = c;
                idx[n++] = d;
                idx[n++] = a;
                idx[n++] = d;
                idx[n++] = b;
            }
        }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const nrm = geo.getAttribute('normal').array;

    // 5) 색
    const c = new THREE.Color();
    const tmp = new THREE.Color();
    const cx = 0;
    const cz = 0;
    for (let vj = 0; vj < V; vj++)
        for (let vi = 0; vi < V; vi++) {
            const k = vj * V + vi;
            const x = pos[k * 3];
            const z = pos[k * 3 + 2];
            const ti = Math.min(N - 1, Math.floor((x + half) / T));
            const tj = Math.min(N - 1, Math.floor((z + half) / T));
            const tk = tj * N + ti;
            const K = kind[tk];
            const ny = nrm[k * 3 + 1];
            const n1 = valueNoise(x * 0.22, z * 0.22, seed + 20);
            const n2 = valueNoise(x * 0.9, z * 0.9, seed + 21);
            // 바닥 색
            if (level[tk] === 0 && K !== KIND.border) {
                const d = Math.hypot(x - cx, z - cz);
                c.copy(COL.basin).lerp(COL.corrupt, Math.max(0, 1 - d / 9) * 0.9);
                c.lerp(COL.snowShade, 0.12 * n2);
            } else {
                c.copy(level[tk] >= 2 ? COL.snowHi : COL.snowMid).lerp(COL.snowShade, 0.35 * n1 * n1);
                // 벌판에는 바람에 쓸린 흙 자국
                if (level[tk] === 1 && K === KIND.ground)
                    c.lerp(COL.trample, Math.max(0, n1 - 0.62) * 1.6 * (0.6 + 0.4 * n2));
            }
            if (K === KIND.ramp) c.lerp(COL.ramp, 0.55 + 0.2 * n2);
            if (f.vein[tk] >= 0) c.lerp(COL.vein, 0.45);
            // 가파른 면 = 바위띠 (높이에 따라 줄무늬)
            const steep = THREE.MathUtils.smoothstep(1 - ny, 0.14, 0.38);
            if (steep > 0) {
                tmp.copy(COL.rockA).lerp(COL.rockB, (Math.sin(pos[k * 3 + 1] * 5.5 + n2 * 2) + 1) * 0.5);
                tmp.lerp(COL.rockDeep, 0.3 * n1);
                c.lerp(tmp, steep);
            }
            // 바위 능선·산맥 꼭대기에는 눈이 쌓인다
            if ((K === KIND.rock || K === KIND.border) && ny > 0.8) c.lerp(COL.snowMid, (ny - 0.8) * 4);
            col[k * 3] = c.r;
            col[k * 3 + 1] = c.g;
            col[k * 3 + 2] = c.b;
        }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const uv = new Float32Array(V * V * 2);
    for (let k = 0; k < V * V; k++) {
        uv[k * 2] = pos[k * 3] / 5;
        uv[k * 2 + 1] = pos[k * 3 + 2] / 5;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.93,
        metalness: 0,
        map: snowDetail(seed)
    });
    fogLayer.patch(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'survival-terrain';

    // 맵 밖: 검은 바닥 (가장자리 산맥 너머)
    const outside = new THREE.Mesh(
        new THREE.PlaneGeometry(half * 8, half * 8),
        new THREE.MeshBasicMaterial({ color: 0x05060c })
    );
    outside.rotation.x = -Math.PI / 2;
    outside.position.y = -2;
    const group = new THREE.Group();
    group.add(mesh, outside);

    function heightAt(x, z) {
        const fx = Math.max(0, Math.min(V - 1.001, (x + half) / step));
        const fz = Math.max(0, Math.min(V - 1.001, (z + half) / step));
        const i = Math.floor(fx);
        const j = Math.floor(fz);
        const tx = fx - i;
        const tz = fz - j;
        const k = j * V + i;
        const a = H[k] + (H[k + 1] - H[k]) * tx;
        const b = H[k + V] + (H[k + V + 1] - H[k + V]) * tx;
        return a + (b - a) * tz;
    }

    return {
        group,
        mesh,
        heightAt,
        // 기존 지형 API 호환 (주변 반딧불이 연출 등): 살아남기는 쓰지 않는다
        ellipseR: () => 2,
        core: { x: 0, z: 0 },
        /** 미니맵용 지형 그림 (타일당 1픽셀, RGBA) */
        minimapPixels() {
            const out = new Uint8ClampedArray(N * N * 4);
            for (let j = 0; j < N; j++)
                for (let i = 0; i < N; i++) {
                    const k = j * N + i;
                    const K = kind[k];
                    let r;
                    let g;
                    let b;
                    if (K === KIND.border) [r, g, b] = [38, 38, 48];
                    else if (K === KIND.cliff) [r, g, b] = [70, 62, 64];
                    else if (K === KIND.rock) [r, g, b] = [96, 88, 82];
                    else if (K === KIND.nest) [r, g, b] = [120, 40, 150];
                    else if (K === KIND.ramp) [r, g, b] = [150, 132, 112];
                    else if (level[k] === 0) [r, g, b] = [70, 62, 92];
                    else if (level[k] === 1) [r, g, b] = [170, 180, 200];
                    else [r, g, b] = [222, 228, 240];
                    if (f.vein[k] >= 0) [r, g, b] = [240, 196, 80];
                    out[k * 4] = r;
                    out[k * 4 + 1] = g;
                    out[k * 4 + 2] = b;
                    out[k * 4 + 3] = 255;
                }
            return out;
        }
    };
}
