// 살아남기 지형 메시: 타일 격자(snowfield)를 높이장으로 바꿔 한 장의 메시로 만든다.
// 타일 하나에 꼭짓점 4×4. 단(고원·벌판·분지)은 평평하고, 단 사이는 타일 경계에서 거의 수직으로 떨어지는 바위 벽이다.
// 비탈은 통로 축을 따라 곧게 이어지는 다져진 길(가로 줄무늬)이고, 양옆 벽이 수직으로 막는다.
// 절벽 윗변(통행 불가 테두리)은 얼음 낀 회청색 띠로 칠해 걸을 수 있는 눈밭과 또렷이 갈린다.
// 적·건물·이펙트가 땅에 붙도록 heightAt은 이 메시의 꼭짓점 높이를 그대로 보간한다.
import * as THREE from 'three';
import { KIND, fbm, valueNoise } from '../../core/snowfield.js';

const SUB = 4;

const C = (h) => new THREE.Color(h);
const COL = {
    snowHi: C('#f0f4fb'),
    snowMid: C('#a4afc6'),
    snowShade: C('#a9b6d0'),
    trample: C('#8f877e'),
    basin: C('#5d5a74'),
    corrupt: C('#5a2c74'),
    ramp: C('#8e7a68'),
    rampDark: C('#544538'),
    rim: C('#8592ad'),
    rimEdge: C('#56607a'),
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

    // 2) 꼭짓점 높이: 타일 안쪽 꼭짓점은 그 타일 높이 그대로(평평한 단).
    //    타일 경계 꼭짓점은 닿은 타일들 높이가 비슷하면 평균, 크게 다르면 낮은 쪽(= 높은 타일 가장자리에서 수직으로 떨어짐).
    //    비탈 타일에 닿은 꼭짓점은 통로 축을 따라 곧게 (양옆 벽은 수직, 위·아래 끝은 단 높이와 이어진다).
    //    바위끼리 맞닿은 경계는 평균(바위 덩어리가 한 몸으로 솟게).
    const V = N * SUB + 1;
    const step = T / SUB;
    const H = new Float32Array(V * V);
    const rocky = (K) => K === KIND.rock || K === KIND.border;
    const touch = [];
    for (let vj = 0; vj < V; vj++)
        for (let vi = 0; vi < V; vi++) {
            const bi = vi % SUB === 0;
            const bj = vj % SUB === 0;
            const ti = Math.floor(vi / SUB);
            const tj = Math.floor(vj / SUB);
            touch.length = 0;
            for (const di of bi ? [-1, 0] : [0])
                for (const dj of bj ? [-1, 0] : [0]) {
                    const i = Math.max(0, Math.min(N - 1, ti + di));
                    const j = Math.max(0, Math.min(N - 1, tj + dj));
                    touch.push(j * N + i);
                }
            const x = -half + vi * step;
            const z = -half + vj * step;
            let rampN = -1;
            let lo = Infinity;
            let hi = -Infinity;
            let sum = 0;
            let allRock = true;
            for (const k of touch) {
                if (kind[k] === KIND.ramp) rampN = f.rampOf[k];
                lo = Math.min(lo, th[k]);
                hi = Math.max(hi, th[k]);
                sum += th[k];
                if (!rocky(kind[k])) allRock = false;
            }
            let h;
            if (rampN >= 0) h = f.rampHeightAt(rampN, x, z);
            else if (hi - lo < 0.25 || allRock) h = sum / touch.length;
            else h = lo;
            H[vj * V + vi] = h;
        }
    // 3) 바위·산맥은 울퉁불퉁하게, 평지는 눈 둔덕 정도 (비탈과 절벽 윗변은 건드리지 않는다)
    for (let vj = 0; vj < V; vj++)
        for (let vi = 0; vi < V; vi++) {
            const k = vj * V + vi;
            const ti = Math.min(N - 1, Math.floor(vi / SUB));
            const tj = Math.min(N - 1, Math.floor(vj / SUB));
            const K = kind[tj * N + ti];
            const x = vi * step;
            const z = vj * step;
            if (rocky(K))
                H[k] += fbm(x * 0.5, z * 0.5, seed + 11, 3) * 0.6 + fbm(x * 1.6, z * 1.6, seed + 12, 2) * 0.18;
            else if (K === KIND.ground && vi % SUB && vj % SUB) H[k] += fbm(x * 0.35, z * 0.35, seed + 13, 2) * 0.05;
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
    /** 절벽 발치 그늘 배율: 이 타일보다 0.5 넘게 높은 이웃 타일까지의 거리로 (1 = 그늘 없음) */
    const footShade = (ti, tj, x, z) => {
        const h0 = th[tj * N + ti];
        let d = Infinity;
        for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
                if (!di && !dj) continue;
                const i = ti + di;
                const j = tj + dj;
                if (i < 0 || j < 0 || i >= N || j >= N) continue;
                const nk = j * N + i;
                if (kind[nk] === KIND.ramp || th[nk] - h0 < 0.5) continue;
                const x0 = -half + i * T;
                const z0 = -half + j * T;
                const dx = Math.max(x0 - x, 0, x - (x0 + T));
                const dz = Math.max(z0 - z, 0, z - (z0 + T));
                d = Math.min(d, Math.hypot(dx, dz));
            }
        return d >= T ? 1 : 0.62 + 0.38 * (d / T);
    };
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
            if (K === KIND.ramp) {
                // 다져진 길: 통로를 가로지르는 바퀴 자국 줄무늬
                const r = f.ramps[f.rampOf[tk]];
                const along = r.d[0] !== 0 ? x : z;
                const band = 0.5 + 0.5 * Math.sin(along * 7.5);
                c.copy(COL.ramp).lerp(COL.rampDark, 0.35 * band + 0.15 * n2);
            }
            // 절벽 윗변(통행 불가 테두리): 얼음 낀 회청색 띠, 바깥 가장자리일수록 짙게
            if (K === KIND.cliff) c.copy(COL.rim).lerp(COL.rimEdge, 0.25 + 0.25 * n2);
            if (f.vein[tk] >= 0) c.lerp(COL.vein, 0.45);
            // 가파른 면 = 바위벽 (높이에 따라 줄무늬)
            const steep = THREE.MathUtils.smoothstep(1 - ny, 0.12, 0.32);
            if (steep > 0) {
                tmp.copy(COL.rockA).lerp(COL.rockB, (Math.sin(pos[k * 3 + 1] * 7 + n2 * 2) + 1) * 0.5);
                tmp.lerp(COL.rockDeep, 0.35 * n1);
                c.lerp(tmp, steep);
            }
            // 바위 능선·산맥 꼭대기에는 눈이 쌓인다
            if ((K === KIND.rock || K === KIND.border) && ny > 0.8) c.lerp(COL.snowMid, (ny - 0.8) * 4);
            // 절벽 발치 그늘: 더 높은 이웃 타일에 가까울수록 어둡게 (위에서 내려다봐도 단 차이가 읽히게)
            if (f.walkableKind(tk) && K !== KIND.ramp) c.multiplyScalar(footShade(ti, tj, x, z));
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
    // 넓은 맵을 한 장으로 그리면 화면 밖·그림자 카메라 밖 삼각형까지 매번 다 그린다:
    // 꼭짓점은 함께 쓰고 삼각형 목록만 CHUNK×CHUNK 타일 조각으로 나눠, 보이는 조각만 그리게 한다
    const CHUNK = 12;
    const CS = CHUNK * SUB;
    const chunks = [];
    for (let cj = 0; cj * CS < V - 1; cj++)
        for (let ci = 0; ci * CS < V - 1; ci++) {
            const i0 = ci * CS;
            const j0 = cj * CS;
            const i1 = Math.min(V - 1, i0 + CS);
            const j1 = Math.min(V - 1, j0 + CS);
            const sub = new Uint32Array((i1 - i0) * (j1 - j0) * 6);
            let m = 0;
            let lo = Infinity;
            let hi = -Infinity;
            for (let vj = j0; vj < j1; vj++)
                for (let vi = i0; vi < i1; vi++) {
                    const q = (vj * (V - 1) + vi) * 6;
                    for (let r = 0; r < 6; r++) sub[m++] = idx[q + r];
                    const h = H[vj * V + vi];
                    lo = Math.min(lo, h);
                    hi = Math.max(hi, h);
                }
            const cg = new THREE.BufferGeometry();
            for (const name of ['position', 'normal', 'color', 'uv']) cg.setAttribute(name, geo.getAttribute(name));
            cg.setIndex(new THREE.BufferAttribute(sub, 1));
            const cx0 = -half + i0 * step;
            const cz0 = -half + j0 * step;
            const cx1 = -half + i1 * step;
            const cz1 = -half + j1 * step;
            cg.boundingBox = new THREE.Box3(new THREE.Vector3(cx0, lo - 0.5, cz0), new THREE.Vector3(cx1, hi + 1, cz1));
            cg.boundingSphere = cg.boundingBox.getBoundingSphere(new THREE.Sphere());
            const cm = new THREE.Mesh(cg, mat);
            cm.receiveShadow = true;
            cm.castShadow = true;
            cm.name = 'survival-terrain';
            chunks.push(cm);
        }
    const mesh = chunks[0];

    // 맵 밖: 검은 바닥 (가장자리 산맥 너머)
    const outside = new THREE.Mesh(
        new THREE.PlaneGeometry(half * 8, half * 8),
        new THREE.MeshBasicMaterial({ color: 0x05060c })
    );
    outside.rotation.x = -Math.PI / 2;
    outside.position.y = -2;
    const group = new THREE.Group();
    group.add(...chunks, outside);

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
        chunks,
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
