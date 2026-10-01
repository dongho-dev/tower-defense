// 살아남기 맵의 지형 격자 (스타1 '살아남기' 유즈맵처럼 넓은 땅 전체가 전장이다).
// 맵은 size×size 타일이고, 타일 한 칸 = tile 월드 단위. 원점(0, 0)이 맵 한가운데다.
// 높이는 이산적인 세 단(0 = 가운데 분지, 1 = 눈벌판, 2 = 고원)이다. 단과 단 사이는 절벽(못 지나감)이고,
// 단을 바꾸는 길은 '비탈' 하나뿐이다. 비탈은 축에 나란한 곧은 통로(폭 w칸, 길이 RAMP_LEN칸)이고 양옆이
// 절벽 벽(flank)으로 막혀 있어 위·아래 끝으로만 드나든다. 그래서 통로를 가로질러 벽 한 줄을 세우면 완전히 막힌다.
// 바위 능선과 맵 가장자리 산맥은 못 지나간다. 광맥은 2×2 타일이고 광산만 지을 수 있다.
// 게임 로직(길 찾기·건설 판정·안개)과 렌더러(지형 메시·미니맵)가 같은 격자를 함께 쓴다.

export const KIND = { ground: 0, ramp: 1, cliff: 2, rock: 3, border: 4, nest: 5 };

/** 비탈 통로 길이(칸): 위 단 가장자리 한 줄 + 아래 단으로 세 줄 */
export const RAMP_LEN = 4;

/** 비탈 방향: e·w·s·n (j가 늘면 남쪽) */
const DIRS = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };

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
 *   basin: { at, r, ramps: [{ dir, at, w }] }, nestR,
 *   sites: [{ id, name, at, r: [rx, ry], ramps: [{ dir, at, w }], veins: [[i, j]...], base: [i, j] }],
 *   ridges: [{ pts, w }], veins: [[i, j]...] (벌판 광맥) }
 * 비탈 { dir, at, w }: dir 쪽으로 내려가는 폭 w의 통로. at = 통로 가운데 줄(dir이 e·w면 j, n·s면 i).
 * 분지 비탈의 dir은 분지 한가운데에서 바깥(벌판) 쪽이다.
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
        const edge = 1 + 0.16 * fbm(Math.cos(a) * 2.2 + s.n * 7, Math.sin(a) * 2.2, seed + 3, 2);
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

    // 2) 비탈 통로: 위 단 가장자리(rim) 칸에서 아래 단 쪽으로 RAMP_LEN줄. 양옆 한 칸은 절벽 벽(flank),
    //    위 끝 앞 세 줄은 위 단 평지, 아래 끝 뒤 세 줄은 아래 단 평지로 다져 둔다 (드나드는 곳이 또렷하게).
    const ramps = [];
    const rampOf = new Int16Array(N * N).fill(-1);
    const rampT = new Int8Array(N * N).fill(-1);
    const flank = new Uint8Array(N * N);
    const clear = new Uint8Array(N * N);
    const lat = (w) => {
        const a = Math.floor((w - 1) / 2);
        return [-a, w - 1 - a];
    };
    const planRamp = (r, owner, siteN) => {
        const dir = DIRS[r.dir];
        const along = dir[0] !== 0;
        // 시작점: 위 단(고원) 안쪽 또는 분지 한가운데에서 dir 쪽으로 걸어 나가며 경계를 찾는다
        let si;
        let sj;
        if (owner === 'basin') {
            si = along ? Math.floor(basin.at[0]) : r.at;
            sj = along ? r.at : Math.floor(basin.at[1]);
        } else {
            const s = sites[siteN];
            si = along ? Math.floor(s.x) : r.at;
            sj = along ? r.at : Math.floor(s.y);
        }
        let ri = si;
        let rj = sj;
        let d;
        if (owner === 'basin') {
            // 분지 안에서 바깥으로: 처음 만나는 벌판 칸이 위 끝, 통로는 분지 쪽(-dir)으로 내려간다
            while (inside(ri, rj) && level[idx(ri, rj)] === 0) {
                ri += dir[0];
                rj += dir[1];
            }
            d = [-dir[0], -dir[1]];
        } else {
            const hi = level[idx(si, sj)];
            while (inside(ri + dir[0], rj + dir[1]) && level[idx(ri + dir[0], rj + dir[1])] === hi) {
                ri += dir[0];
                rj += dir[1];
            }
            d = dir;
        }
        const hi = owner === 'basin' ? 1 : (sites[siteN].level ?? 2);
        const lo = owner === 'basin' ? 0 : 1;
        const [a, b] = lat(r.w);
        const p = [-d[1], d[0]];
        const at = (t, l) => [ri + d[0] * t + p[0] * l, rj + d[1] * t + p[1] * l];
        return { dir: r.dir, d, p, w: r.w, a, b, hi, lo, owner, site: siteN, ri, rj, at };
    };
    const rampSpecs = [];
    sites.forEach((s) => (s.ramps || []).forEach((r) => rampSpecs.push(planRamp(r, s.id, s.n))));
    (basin.ramps || []).forEach((r) => rampSpecs.push(planRamp(r, 'basin', -1)));
    // 다지기: 위 끝 앞은 위 단, 아래 끝 뒤는 아래 단 평지
    for (const R of rampSpecs) {
        for (let t = -3; t <= -1; t++)
            for (let l = R.a - 2; l <= R.b + 2; l++) {
                const [i, j] = R.at(t, l);
                if (!inside(i, j)) continue;
                const k = idx(i, j);
                level[k] = R.hi;
                if (R.site >= 0) site[k] = R.site;
                clear[k] = 1;
            }
        for (let t = RAMP_LEN; t <= RAMP_LEN + 2; t++)
            for (let l = R.a - 2; l <= R.b + 2; l++) {
                const [i, j] = R.at(t, l);
                if (!inside(i, j)) continue;
                const k = idx(i, j);
                level[k] = R.lo;
                site[k] = -1;
                clear[k] = 1;
            }
    }
    // 통로와 양옆 벽
    rampSpecs.forEach((R, n) => {
        const cells = [];
        const rows = [];
        for (let t = 0; t < RAMP_LEN; t++) {
            const row = [];
            for (let l = R.a - 1; l <= R.b + 1; l++) {
                const [i, j] = R.at(t, l);
                if (!inside(i, j)) continue;
                const k = idx(i, j);
                clear[k] = 1;
                if (l < R.a || l > R.b) {
                    flank[k] = 1;
                    level[k] = R.hi;
                    site[k] = -1;
                    continue;
                }
                rampOf[k] = n;
                rampT[k] = t;
                level[k] = t < RAMP_LEN / 2 ? R.hi : R.lo;
                site[k] = -1;
                row.push(k);
                cells.push(k);
            }
            rows.push(row);
        }
        const top = R.at(-0.5, (R.a + R.b) / 2);
        const bottom = R.at(RAMP_LEN + 1.5, (R.a + R.b) / 2);
        ramps.push({
            n,
            owner: R.owner,
            site: R.site,
            dir: R.dir,
            d: R.d,
            p: R.p,
            w: R.w,
            hi: R.hi,
            lo: R.lo,
            a: R.a,
            b: R.b,
            ri: R.ri,
            rj: R.rj,
            cells,
            rows,
            // 위 끝 바로 앞(위 단)·아래 끝 바로 뒤(아래 단) 점 (타일 좌표)
            top: [top[0] + 0.5, top[1] + 0.5],
            to: [bottom[0] + 0.5, bottom[1] + 0.5]
        });
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
    for (let k = 0; k < N * N; k++) if (clear[k]) rock[k] = 0;

    // 4) 칸 종류
    const bw = spec.border ?? 3;
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const k = idx(i, j);
            const x = i + 0.5;
            const y = j + 0.5;
            const edge = Math.min(x, y, N - x, N - y);
            const bn = bw + 1.6 * valueNoise(x * 0.18, y * 0.18, seed + 21);
            if (edge < bn) {
                kind[k] = KIND.border;
                continue;
            }
            if (rampOf[k] >= 0) {
                kind[k] = KIND.ramp;
                continue;
            }
            if (flank[k]) {
                kind[k] = KIND.cliff;
                continue;
            }
            if (rock[k]) {
                kind[k] = KIND.rock;
                continue;
            }
            // 이웃 여덟 칸에 더 낮은 단(비탈 칸 말고)이 있으면 절벽 가장자리
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

    // 5) 둥지 (가운데 구조물: 못 지나가고 못 짓는다)
    const nestR = spec.nestR ?? 3.2;
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
            if (d <= nestR) kind[idx(i, j)] = KIND.nest;
            // 분지와 그 둘레는 짓지 못한다 (둥지 입구를 틀어막지 못하게)
            if (d <= basin.r + 3) nobuild[idx(i, j)] = 1;
        }

    // 6) 광맥 (2×2, 왼쪽 위 칸 기준). 바위만 걷어 낸다 (절벽·비탈 위 광맥은 맵 정의 오류)
    const veins = [];
    let badVeins = 0;
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
                if (kind[k] === KIND.rock) kind[k] = KIND.ground;
                else if (kind[k] !== KIND.ground) badVeins++;
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

    // 7) 표시 높이: 단 높이 그대로, 비탈은 통로를 따라 고르게
    const L = spec.levels;
    for (let k = 0; k < N * N; k++) {
        if (kind[k] === KIND.ramp) {
            const r = ramps[rampOf[k]];
            height[k] = L[r.hi] + (L[r.lo] - L[r.hi]) * ((rampT[k] + 0.5) / RAMP_LEN);
        } else height[k] = L[level[k]];
    }

    const field = {
        N,
        T,
        half,
        level,
        kind,
        height,
        vein,
        veins,
        badVeins,
        nobuild,
        site,
        rampOf,
        rampT,
        flank,
        ramps,
        levels: L,
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
        /**
         * 비탈 칸의 연속 높이: 통로 축을 따라 위 끝(s=0)에서 아래 끝(s=RAMP_LEN)까지 곧게 (렌더러·heightAt)
         * 비탈이 아니면 null
         */
        rampHeightAt(n, x, z) {
            const r = ramps[n];
            const ti = (x + half) / T;
            const tj = (z + half) / T;
            // 위 끝 경계에서 축 방향으로 잰 거리
            const s0 =
                r.d[0] !== 0
                    ? (ti - (r.d[0] > 0 ? r.ri : r.ri + 1)) * r.d[0]
                    : (tj - (r.d[1] > 0 ? r.rj : r.rj + 1)) * r.d[1];
            const s = Math.max(0, Math.min(RAMP_LEN, s0));
            return L[r.hi] + (L[r.lo] - L[r.hi]) * (s / RAMP_LEN);
        },
        /** 칸 단위 바닥 높이 (적·건물·이펙트를 땅에 붙일 때). 비탈은 통로를 따라 매끈하게 */
        heightAt(x, z) {
            const k = this.cellAt(x, z);
            if (k < 0) return L[1];
            if (rampOf[k] >= 0) return this.rampHeightAt(rampOf[k], x, z);
            return height[k];
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
