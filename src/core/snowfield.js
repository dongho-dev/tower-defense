// 살아남기 맵의 지형 격자 (스타1 '살아남기' 유즈맵처럼 넓은 땅 전체가 전장이다).
// 맵은 size×size 타일이고, 타일 한 칸 = tile 월드 단위. 원점(0, 0)이 맵 한가운데다.
// 높이는 세 단(0 = 가운데 분지, 1 = 눈벌판, 2 = 고원)이고, 단 사이는 절벽(못 지나감)과 비탈(지나감)로 나뉜다.
// 바위 능선과 맵 가장자리 산맥은 못 지나간다. 광맥은 2×2 타일이고 광산만 지을 수 있다.
// 게임 로직(길 찾기·건설 판정·안개)과 렌더러(지형 메시·미니맵)가 같은 격자를 함께 쓴다.

export const KIND = { ground: 0, ramp: 1, cliff: 2, rock: 3, border: 4, nest: 5 };

/** 결정적 해시 노이즈 */
function hash2(x, y, seed) {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
}
/** 값 노이즈 (0~1), 격자 간격 1 */
export function valueNoise(x, y, seed = 0) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed);
    const b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed);
    const d = hash2(ix + 1, iy + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** 여러 옥타브 노이즈 (-1~1) */
export function fbm(x, y, seed = 0, oct = 3) {
    let s = 0;
    let amp = 0.5;
    let f = 1;
    let n = 0;
    for (let o = 0; o < oct; o++) {
        s += (valueNoise(x * f, y * f, seed + o * 13) * 2 - 1) * amp;
        n += amp;
        amp *= 0.5;
        f *= 2;
    }
    return s / n;
}

const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** 점에서 꺾은선까지 거리 */
function distToPolyline(pts, x, y) {
    let best = Infinity;
    for (let k = 1; k < pts.length; k++) {
        const [ax, ay] = pts[k - 1];
        const [bx, by] = pts[k];
        const vx = bx - ax;
        const vy = by - ay;
        const l2 = vx * vx + vy * vy || 1;
        const t = clamp01(((x - ax) * vx + (y - ay) * vy) / l2);
        best = Math.min(best, Math.hypot(x - ax - vx * t, y - ay - vy * t));
    }
    return best;
}

/**
 * 맵 정의(spec)로 타일 격자를 만든다. 좌표는 모두 타일 단위(0 ~ size).
 * spec: { size, tile, levels: [h0, h1, h2], seed, border,
 *   basin: { at, r, ramps: [{ to, w }] }, nestR,
 *   sites: [{ id, name, at, r: [rx, ry], ramps: [{ to, w }], veins: [[i, j]...], base: [i, j] }],
 *   ridges: [{ pts, w }], veins: [[i, j]...] (벌판 광맥) }
 */
export function createField(spec) {
    const N = spec.size;
    const T = spec.tile;
    const seed = spec.seed ?? 1;
    const half = (N * T) / 2;
    const level = new Uint8Array(N * N).fill(1);
    const kind = new Uint8Array(N * N);
    const height = new Float32Array(N * N);
    const vein = new Int16Array(N * N).fill(-1);
    const nobuild = new Uint8Array(N * N);
    const site = new Int8Array(N * N).fill(-1);
    const idx = (i, j) => j * N + i;
    const inside = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
    const cx = N / 2;
    const cy = N / 2;

    // 고원(타원 + 가장자리 노이즈)의 정규화 거리 (1 = 가장자리)
    const sites = spec.sites.map((s, n) => ({
        ...s,
        n,
        x: s.at[0],
        y: s.at[1],
        rx: s.r[0],
        ry: s.r[1] ?? s.r[0]
    }));
    const siteQ = (s, x, y) => {
        const dx = (x - s.x) / s.rx;
        const dy = (y - s.y) / s.ry;
        const a = Math.atan2(dy, dx);
        const edge = 1 + 0.2 * fbm(Math.cos(a) * 2.2 + s.n * 7, Math.sin(a) * 2.2, seed + 3, 2);
        return Math.hypot(dx, dy) / edge;
    };
    const basin = spec.basin;
    const basinQ = (x, y) => {
        const dx = x - basin.at[0];
        const dy = y - basin.at[1];
        const a = Math.atan2(dy, dx);
        const edge = basin.r * (1 + 0.1 * fbm(Math.cos(a) * 2 + 40, Math.sin(a) * 2, seed + 5, 2));
        return Math.hypot(dx, dy) / edge;
    };

    // 1) 단 높이: 기본 1, 분지 0, 고원 2
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const x = i + 0.5;
            const y = j + 0.5;
            const k = idx(i, j);
            if (basinQ(x, y) <= 1) level[k] = 0;
            for (const s of sites)
                if (siteQ(s, x, y) <= 1) {
                    level[k] = s.level ?? 2;
                    site[k] = s.n;
                }
        }

    // 2) 비탈길: 위 단 안쪽 점(from)에서 아래 단 바깥 점(to)으로 뻗는 폭 w의 띠.
    //    가장자리 앞뒤 ramp칸 범위에서만 비탈이 되고, 높이는 가장자리에서 잰 거리로 이어 준다.
    const RAMP_RUN = 2.6;
    const ramps = [];
    for (const s of sites)
        for (const r of s.ramps || [])
            ramps.push({
                from: [s.x, s.y],
                to: r.to,
                w: r.w,
                hi: s.level ?? 2,
                lo: 1,
                q: (x, y) => siteQ(s, x, y),
                r: Math.min(s.rx, s.ry),
                owner: s.id
            });
    for (const r of basin.ramps || [])
        ramps.push({
            from: r.to,
            to: basin.at,
            w: r.w,
            hi: 1,
            lo: 0,
            q: (x, y) => 2 - basinQ(x, y),
            r: basin.r,
            owner: 'basin',
            inv: true
        });
    const rampH = new Float32Array(N * N).fill(-1);
    const rampOf = new Int16Array(N * N).fill(-1);
    ramps.forEach((r, n) => {
        for (let j = 0; j < N; j++)
            for (let i = 0; i < N; i++) {
                const x = i + 0.5;
                const y = j + 0.5;
                const d = distToPolyline([r.from, r.to], x, y);
                if (d > r.w / 2) continue;
                // 가장자리에서 잰 부호 있는 거리 (위 단 안쪽이 +)
                const q = r.inv ? basinQ(x, y) : r.q(x, y);
                const sd = r.inv ? (q - 1) * r.r : (1 - q) * r.r;
                if (Math.abs(sd) > RAMP_RUN) continue;
                const k = idx(i, j);
                const t = clamp01((sd + RAMP_RUN) / (2 * RAMP_RUN));
                rampH[k] = r.lo + (r.hi - r.lo) * t;
                rampOf[k] = n;
            }
    });

    // 3) 바위 능선
    const rock = new Uint8Array(N * N);
    for (const rg of spec.ridges || [])
        for (let j = 0; j < N; j++)
            for (let i = 0; i < N; i++) {
                const x = i + 0.5;
                const y = j + 0.5;
                const w = rg.w * (0.75 + 0.5 * valueNoise(x * 0.35, y * 0.35, seed + 9));
                if (distToPolyline(rg.pts, x, y) <= w / 2) rock[idx(i, j)] = 1;
            }

    // 3-1) 흩어진 바위 무더기: 정해진 씨앗으로 벌판에 뿌린다 (비탈 입구·광맥·분지 가까이는 피한다)
    const sc = spec.scatter;
    if (sc) {
        const avoid = [
            ...ramps.map((r) => r.to),
            ...(spec.veins || []).map(([i, j]) => [i + 1, j + 1]),
            ...sites.flatMap((s) => (s.veins || []).map(([i, j]) => [i + 1, j + 1]))
        ];
        let placed = 0;
        for (let t = 0; t < sc.count * 20 && placed < sc.count; t++) {
            const x = 6 + hash2(t, 1, seed + 31) * (N - 12);
            const y = 6 + hash2(t, 2, seed + 31) * (N - 12);
            const r = sc.min + hash2(t, 3, seed + 31) * (sc.max - sc.min);
            if (avoid.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < r + 4.5)) continue;
            if (basinQ(x, y) < 1.45) continue;
            if (sites.some((s) => siteQ(s, x, y) < 1.35)) continue;
            placed++;
            for (let j = Math.floor(y - r - 1); j <= y + r + 1; j++)
                for (let i = Math.floor(x - r - 1); i <= x + r + 1; i++) {
                    if (!inside(i, j)) continue;
                    const n = 0.75 + 0.5 * valueNoise(i * 0.7, j * 0.7, seed + t);
                    if (Math.hypot(i + 0.5 - x, j + 0.5 - y) <= r * n) rock[idx(i, j)] = 1;
                }
        }
    }

    // 4) 칸 종류
    const bw = spec.border ?? 3;
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const k = idx(i, j);
            const x = i + 0.5;
            const y = j + 0.5;
            const edge = Math.min(x, y, N - x, N - y);
            const bn = bw + 1.6 * valueNoise(x * 0.18, y * 0.18, seed + 21) + (edge < bw + 3 ? 0 : 0);
            if (edge < bn) {
                kind[k] = KIND.border;
                continue;
            }
            if (rampOf[k] >= 0) {
                kind[k] = KIND.ramp;
                continue;
            }
            if (rock[k]) {
                kind[k] = KIND.rock;
                continue;
            }
            // 이웃에 더 낮은 단이 있으면 절벽 (비탈칸은 낮은 단으로 치지 않는다)
            let cliff = false;
            for (let dj = -1; dj <= 1 && !cliff; dj++)
                for (let di = -1; di <= 1; di++) {
                    const ni = i + di;
                    const nj = j + dj;
                    if (!inside(ni, nj)) continue;
                    const nk = idx(ni, nj);
                    if (rampOf[nk] >= 0) continue;
                    if (level[nk] < level[k]) {
                        cliff = true;
                        break;
                    }
                }
            kind[k] = cliff ? KIND.cliff : KIND.ground;
        }
    // 비탈이 위·아래 단 어느 쪽에도 닿지 못한 조각(절벽 안쪽에 갇힌 칸)은 절벽으로
    for (let k = 0; k < N * N; k++) if (kind[k] === KIND.ramp && rampH[k] < 0) kind[k] = KIND.cliff;

    // 5) 둥지 (가운데 구조물: 못 지나가고 못 짓는다)
    const nestR = spec.nestR ?? 3.2;
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
            if (d <= nestR) kind[idx(i, j)] = KIND.nest;
            // 분지와 그 둘레는 짓지 못한다 (둥지 입구를 틀어막지 못하게)
            if (d <= basin.r + 3) nobuild[idx(i, j)] = 1;
        }

    // 6) 광맥 (2×2, 왼쪽 위 칸 기준)
    const veins = [];
    const addVein = (i, j, siteN) => {
        const id = veins.length;
        veins.push({
            id,
            i,
            j,
            site: siteN,
            yield: siteN < 0 ? (spec.fieldYield ?? 1.5) : 1,
            x: -half + (i + 1) * T,
            z: -half + (j + 1) * T
        });
        for (let dj = 0; dj < 2; dj++)
            for (let di = 0; di < 2; di++) {
                const k = idx(i + di, j + dj);
                vein[k] = id;
                if (kind[k] !== KIND.ground && kind[k] !== KIND.ramp) kind[k] = KIND.ground;
            }
    };
    sites.forEach((s) => (s.veins || []).forEach(([i, j]) => addVein(i, j, s.n)));
    (spec.veins || []).forEach(([i, j]) => addVein(i, j, -1));

    // 6-1) 둥지 분지에서 걸어서 닿지 못하는 빈터(바위에 갇힌 조각)는 바위로 메운다
    {
        let start = -1;
        for (let k = 0; k < N * N && start < 0; k++) if (kind[k] === KIND.ground && level[k] === 0) start = k;
        const seen = reachable(
            { N, inside, walkableKind: (k) => kind[k] === KIND.ground || kind[k] === KIND.ramp },
            start
        );
        for (let k = 0; k < N * N; k++)
            if ((kind[k] === KIND.ground || kind[k] === KIND.ramp) && !seen[k] && vein[k] < 0) kind[k] = KIND.rock;
    }

    // 7) 표시 높이 (단 높이, 비탈은 이어진 높이)
    const L = spec.levels;
    const lv = (v) => {
        const a = Math.floor(v);
        const f = v - a;
        return a >= L.length - 1 ? L[L.length - 1] : L[a] + (L[a + 1] - L[a]) * f;
    };
    for (let k = 0; k < N * N; k++) height[k] = kind[k] === KIND.ramp ? lv(rampH[k]) : L[level[k]];

    const field = {
        N,
        T,
        half,
        level,
        kind,
        height,
        vein,
        veins,
        nobuild,
        site,
        rampOf,
        ramps,
        sites: sites.map((s) => ({
            id: s.id,
            n: s.n,
            name: s.name,
            risk: s.risk,
            x: -half + s.x * T,
            z: -half + s.y * T,
            ci: s.x,
            cj: s.y,
            r: Math.min(s.rx, s.ry),
            base: s.base,
            rampCount: (s.ramps || []).length,
            veinCount: (s.veins || []).length
        })),
        center: { x: 0, z: 0, i: cx, j: cy },
        nestR,
        idx,
        inside,
        /** 타일 → 월드 (칸 중심) */
        toWorld(i, j, out = {}) {
            out.x = -half + (i + 0.5) * T;
            out.z = -half + (j + 0.5) * T;
            return out;
        },
        /** 월드 → 타일 번호 (밖이면 -1) */
        cellAt(x, z) {
            const i = Math.floor((x + half) / T);
            const j = Math.floor((z + half) / T);
            return inside(i, j) ? j * N + i : -1;
        },
        walkableKind(k) {
            return kind[k] === KIND.ground || kind[k] === KIND.ramp;
        },
        /** 표시 높이를 쌍선형 보간 (적·건물·이펙트를 땅에 붙일 때) */
        heightAt(x, z) {
            const fi = (x + half) / T - 0.5;
            const fj = (z + half) / T - 0.5;
            const i = Math.max(0, Math.min(N - 2, Math.floor(fi)));
            const j = Math.max(0, Math.min(N - 2, Math.floor(fj)));
            const tx = clamp01(fi - i);
            const tz = clamp01(fj - j);
            const k = j * N + i;
            const a = height[k] + (height[k + 1] - height[k]) * tx;
            const b = height[k + N] + (height[k + N + 1] - height[k + N]) * tx;
            return a + (b - a) * tz;
        }
    };
    return field;
}

/** 걸을 수 있는 칸끼리 이어진 덩어리 (테스트·맵 검증용): 시작 칸에서 닿는 칸 표시 */
export function reachable(field, start) {
    const { N } = field;
    const seen = new Uint8Array(N * N);
    const q = [start];
    seen[start] = 1;
    while (q.length) {
        const k = q.pop();
        const i = k % N;
        const j = (k - i) / N;
        for (const [di, dj] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const ni = i + di;
            const nj = j + dj;
            if (!field.inside(ni, nj)) continue;
            const nk = nj * N + ni;
            if (seen[nk] || !field.walkableKind(nk)) continue;
            seen[nk] = 1;
            q.push(nk);
        }
    }
    return seen;
}
