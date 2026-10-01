// 살아남기 산 지형의 높이장: 걸을 수 있는 고원·비탈길(core/mountain.js 배치)은 정해진 높이로 평평하게,
// 나머지 바위는 가장 가까운 땅보다 절벽만큼 솟고, 멀어질수록 산등성이·봉우리로 높아진다.
// 격자(RES)에 한 번 구워 두고 쌍선형으로 읽는다. 색(바위 지층·눈·흙길)도 여기서 정한다.
import * as THREE from 'three';
import { smoothstep, lerp } from '../util/noise.js';

const RES = 0.2;
const SQ2 = Math.SQRT2;

// 봉우리: [x, z, 높이, 반지름]. 본진 뒤(북쪽) 큰 봉우리와 좌우 어깨
const PEAKS = [
    [1.5, -10.6, 6.2, 8.5],
    [-11, -9.2, 3.0, 5],
    [11.4, -8.6, 3.4, 5.5],
    [-15.5, -1, 1.4, 3.5],
    [15.6, -0.6, 1.6, 3.5]
];

export function createMountainField(state, noise) {
    const { layout } = state.survival;
    const { rx, rz } = state.map.island;
    const { fbm, n2 } = noise;
    const x0 = -rx - 1.2;
    const z0 = -rz - 1.2;
    const gw = Math.ceil((2 * rx + 2.4) / RES) + 1;
    const gh = Math.ceil((2 * rz + 2.4) / RES) + 1;
    const N = gw * gh;
    const walk = new Uint8Array(N);
    const elev = new Float32Array(N);
    const out = new Float32Array(N).fill(1e9); // 바위: 땅까지 거리
    const inn = new Float32Array(N).fill(1e9); // 땅: 가장자리까지 거리
    const srcH = new Float32Array(N);
    for (let j = 0; j < gh; j++)
        for (let i = 0; i < gw; i++) {
            const k = j * gw + i;
            const g = layout.ground(x0 + i * RES, z0 + j * RES);
            walk[k] = g.walk ? 1 : 0;
            elev[k] = g.h;
            if (g.walk) {
                out[k] = 0;
                srcH[k] = g.h;
            } else inn[k] = 0;
        }
    // 모따기 거리 변환 (두 번 훑기). 바위 쪽은 가장 가까운 땅의 높이도 함께 옮긴다
    const pass = (dist, carry, order) => {
        const nb =
            order > 0
                ? [
                      [-1, 0, 1],
                      [0, -1, 1],
                      [-1, -1, SQ2],
                      [1, -1, SQ2]
                  ]
                : [
                      [1, 0, 1],
                      [0, 1, 1],
                      [1, 1, SQ2],
                      [-1, 1, SQ2]
                  ];
        const js = order > 0 ? [0, gh, 1] : [gh - 1, -1, -1];
        const is = order > 0 ? [0, gw, 1] : [gw - 1, -1, -1];
        for (let j = js[0]; j !== js[1]; j += js[2])
            for (let i = is[0]; i !== is[1]; i += is[2]) {
                const k = j * gw + i;
                for (const [di, dj, c] of nb) {
                    const ni = i + di;
                    const nj = j + dj;
                    if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
                    const nk = nj * gw + ni;
                    const d = dist[nk] + c * RES;
                    if (d < dist[k]) {
                        dist[k] = d;
                        if (carry) carry[k] = carry[nk];
                    }
                }
            }
    };
    pass(out, srcH, 1);
    pass(out, srcH, -1);
    pass(inn, null, 1);
    pass(inn, null, -1);

    // 비탈길 한가운데까지 거리 (흙길 색·풀 피하기)
    const trail = new Float32Array(N).fill(99);
    for (const r of layout.ramps) {
        for (let s = 0; s <= r.len; s += 0.1) {
            let k = 1;
            while (k < r.pts.length - 1 && r.cum[k] < s) k++;
            const t = (s - r.cum[k - 1]) / (r.cum[k] - r.cum[k - 1] || 1);
            const px = r.pts[k - 1][0] + (r.pts[k][0] - r.pts[k - 1][0]) * t;
            const pz = r.pts[k - 1][1] + (r.pts[k][1] - r.pts[k - 1][1]) * t;
            const ci = Math.round((px - x0) / RES);
            const cj = Math.round((pz - z0) / RES);
            for (let j = cj - 8; j <= cj + 8; j++)
                for (let i = ci - 8; i <= ci + 8; i++) {
                    if (i < 0 || j < 0 || i >= gw || j >= gh) continue;
                    const d = Math.hypot(x0 + i * RES - px, z0 + j * RES - pz);
                    const kk = j * gw + i;
                    if (d < trail[kk]) trail[kk] = d;
                }
        }
    }

    const peakAt = (x, z) => {
        let h = 0;
        for (const [px, pz, a, r] of PEAKS) {
            const d = Math.hypot(x - px, z - pz) / r;
            if (d < 1) h += a * Math.pow(1 - d, 1.5);
        }
        return h;
    };

    const H = new Float32Array(N);
    for (let j = 0; j < gh; j++)
        for (let i = 0; i < gw; i++) {
            const k = j * gw + i;
            const x = x0 + i * RES;
            const z = z0 + j * RES;
            if (walk[k]) {
                // 가장자리는 살짝 들려 절벽 밑동이 둥글게 이어진다
                const lip = 0.14 * (1 - smoothstep(0, 0.45, inn[k]));
                H[k] = elev[k] + 0.035 * fbm(x * 0.9, z * 0.9, 2) + lip;
                continue;
            }
            const d = out[k];
            // 앞쪽(카메라 쪽 산기슭)은 절벽이 낮고, 뒤로 갈수록 높다
            const cliff = lerp(1.25, 0.75, smoothstep(1, 10, z));
            const rough = fbm(x * 0.42 + 7, z * 0.42 - 3, 4);
            let h = srcH[k] + cliff * smoothstep(0, 0.65, d) + 0.3 * Math.min(4, Math.max(0, d - 0.6));
            h += peakAt(x, z) * smoothstep(0.3, 2.6, d);
            h += (0.55 * rough + 0.12 * n2(x * 1.7, z * 1.7)) * smoothstep(0.2, 1.4, d);
            H[k] = h;
        }

    const sample = (field, x, z) => {
        const fi = Math.max(0, Math.min(gw - 1.001, (x - x0) / RES));
        const fj = Math.max(0, Math.min(gh - 1.001, (z - z0) / RES));
        const i = Math.floor(fi);
        const j = Math.floor(fj);
        const tx = fi - i;
        const tz = fj - j;
        const k = j * gw + i;
        const a = field[k] + (field[k + 1] - field[k]) * tx;
        const b = field[k + gw] + (field[k + gw + 1] - field[k + gw]) * tx;
        return a + (b - a) * tz;
    };
    const heightAt = (x, z) => sample(H, x, z);
    const rockDist = (x, z) => sample(out, x, z);
    const trailDist = (x, z) => sample(trail, x, z);
    const walkable = (x, z) => rockDist(x, z) < 0.05;

    /** 지면 색: 땅은 풀·흙길, 바위는 높이에 따른 지층, 높은 곳은 눈 */
    function paint(c, x, z, y, pal, theme) {
        const d = rockDist(x, z);
        const grassA = (paint.ga ||= new THREE.Color(pal.grassA));
        const grassB = (paint.gb ||= new THREE.Color(pal.grassB));
        const dry = (paint.dr ||= new THREE.Color(pal.dry));
        const dirt = (paint.di ||= new THREE.Color(pal.dirt));
        const bands = (paint.bands ||= theme.cliff.bands.map((h) => new THREE.Color(h)));
        const snow = (paint.sn ||= new THREE.Color(theme.snow || '#eef3fb'));
        const deep = (paint.dp ||= new THREE.Color(theme.cliff.deep));
        const tmp = (paint.tmp ||= new THREE.Color());
        const n = fbm(x * 0.18 + 10, z * 0.18, 3) * 0.5 + 0.5;
        // 땅
        c.copy(grassA).lerp(grassB, smoothstep(0.25, 0.8, n));
        c.lerp(dry, 0.45 * smoothstep(0.35, 0.7, fbm(x * 0.07 - 4, z * 0.07 + 2, 3)));
        c.lerp(dirt, 0.85 * (1 - smoothstep(0.25, 0.75, trailDist(x, z))));
        // 바위: 높이를 따라 지층 띠, 골짜기는 어둡게
        const band = Math.floor((y + 40 + 0.45 * n2(x * 0.6, z * 0.6)) / 0.45) % bands.length;
        tmp.copy(bands[band]).multiplyScalar(0.82 + 0.25 * n2(x * 2.3, z * 2.3));
        tmp.lerp(deep, 0.25 * smoothstep(0.3, -0.4, fbm(x * 0.6, z * 0.6, 3)));
        // 높은 바위는 눈
        const snowK = smoothstep(4.0, 5.2, y + 0.9 * fbm(x * 0.5 + 3, z * 0.5, 3));
        tmp.lerp(snow, snowK);
        c.lerp(tmp, smoothstep(0.02, 0.32, d));
        return c;
    }

    return { heightAt, rockDist, trailDist, walkable, paint, gw, gh };
}
