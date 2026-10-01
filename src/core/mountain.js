// 산 지형 배치(살아남기 맵): 걸을 수 있는 땅은 고원(타원)과 그 사이를 잇는 비탈길(폭이 있는 꺾은선)뿐이고,
// 나머지는 모두 바위다. 고원마다 높이가 있고 비탈길은 두 고원 높이를 잇는다.
// 게임 로직(적의 길 찾기 격자·고지대 판정)과 렌더러(지형 높이·색)가 같은 배치를 함께 쓴다.

/** 결정적 1차원 값 노이즈 (-1~1): 고원 가장자리를 들쭉날쭉하게 */
function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
}
function noise1(t, seed) {
    const i = Math.floor(t);
    const f = t - i;
    const u = f * f * (3 - 2 * f);
    return hash(i + seed * 57) * (1 - u) + hash(i + 1 + seed * 57) * u;
}
/** 각도(라디안)를 따라 이어지는 노이즈: 한 바퀴 돌면 처음과 맞닿는다 */
function ringNoise(ang, seed, k = 7) {
    const t = ((ang / (Math.PI * 2) + 1) % 1) * k;
    const a = noise1(t, seed);
    const b = noise1(t - k, seed);
    const w = t / k;
    return a * (1 - w) + b * w;
}

const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

/**
 * spec: { plateaus: [{ id, at, r: [rx, rz], h, jag? }], ramps: [{ a, b, via?, w }] }
 * 반환: { plateaus, ramps, ground(x, z) → { walk, h, plateau, ramp } }
 */
export function createLayout(spec) {
    const plateaus = spec.plateaus.map((p, i) => ({
        ...p,
        x: p.at[0],
        z: p.at[1],
        rx: p.r[0],
        rz: p.r[1] ?? p.r[0],
        jag: p.jag ?? 0.09,
        seed: i + 1
    }));
    const byId = Object.fromEntries(plateaus.map((p) => [p.id, p]));

    /** 고원 중심에서 잰 정규화 거리 (1 = 가장자리) */
    function plateauQ(p, x, z) {
        const dx = (x - p.x) / p.rx;
        const dz = (z - p.z) / p.rz;
        const edge = 1 + p.jag * ringNoise(Math.atan2(dz, dx), p.seed);
        return Math.hypot(dx, dz) / edge;
    }

    const ramps = spec.ramps.map((r, i) => {
        const A = byId[r.a];
        const B = byId[r.b];
        const pts = [[A.x, A.z], ...(r.via || []), [B.x, B.z]];
        const cum = [0];
        for (let k = 1; k < pts.length; k++)
            cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
        const len = cum[cum.length - 1];
        const at = (s) => {
            let k = 1;
            while (k < pts.length - 1 && cum[k] < s) k++;
            const t = (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
            return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t];
        };
        // 길이 A를 벗어나는 지점과 B에 들어서는 지점 (그 사이에서만 높이가 바뀐다)
        let sA = 0;
        let sB = len;
        for (let s = 0; s <= len; s += 0.05) {
            const [x, z] = at(s);
            if (plateauQ(A, x, z) <= 0.92) sA = s;
        }
        for (let s = len; s >= 0; s -= 0.05) {
            const [x, z] = at(s);
            if (plateauQ(B, x, z) <= 0.92) sB = s;
        }
        if (sB <= sA) sB = sA + 0.01;
        return { ...r, A, B, pts, cum, len, sA, sB, w: r.w ?? 1, seed: 40 + i };
    });

    /** 꺾은선까지의 거리와 그 지점의 길 위 거리 */
    function project(r, x, z) {
        let best = Infinity;
        let bs = 0;
        for (let k = 1; k < r.pts.length; k++) {
            const [ax, az] = r.pts[k - 1];
            const [bx, bz] = r.pts[k];
            const vx = bx - ax;
            const vz = bz - az;
            const l2 = vx * vx + vz * vz || 1;
            const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
            const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
            if (d < best) {
                best = d;
                bs = r.cum[k - 1] + t * Math.sqrt(l2);
            }
        }
        return { d: best, s: bs };
    }

    function rampHeight(r, s) {
        const t = smooth(r.sA, r.sB, s) * 0.6 + Math.max(0, Math.min(1, (s - r.sA) / (r.sB - r.sA))) * 0.4;
        return r.A.h + (r.B.h - r.A.h) * t;
    }

    /** 땅 판정: 걸을 수 있는가, 높이, 어느 고원/비탈길인가 */
    function ground(x, z) {
        let bestP = null;
        let bq = 1;
        for (const p of plateaus) {
            const q = plateauQ(p, x, z);
            if (q <= bq) {
                bq = q;
                bestP = p;
            }
        }
        if (bestP) return { walk: true, h: bestP.h, plateau: bestP, ramp: null, q: bq };
        let bestR = null;
        let bk = 1;
        let bs = 0;
        for (const r of ramps) {
            const pr = project(r, x, z);
            const w = r.w * (1 + 0.14 * noise1(pr.s * 1.3, r.seed));
            const k = pr.d / w;
            if (k <= bk) {
                bk = k;
                bestR = r;
                bs = pr.s;
            }
        }
        if (bestR) return { walk: true, h: rampHeight(bestR, bs), plateau: null, ramp: bestR, q: bk };
        return { walk: false, h: 0, plateau: null, ramp: null, q: 2 };
    }

    return { plateaus, ramps, byId, ground, project, plateauQ };
}

/**
 * 길 찾기 격자: cell 간격으로 걸을 수 있는 칸과 높이를 미리 구해 둔다.
 * bounds: { rx, rz } (섬 크기)
 */
export function createNavGrid(layout, bounds, cell = 0.5) {
    const x0 = -bounds.rx;
    const z0 = -bounds.rz;
    const w = Math.ceil((2 * bounds.rx) / cell);
    const h = Math.ceil((2 * bounds.rz) / cell);
    const walk = new Uint8Array(w * h);
    const elev = new Float32Array(w * h);
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            const g = layout.ground(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell);
            walk[j * w + i] = g.walk ? 1 : 0;
            elev[j * w + i] = g.h;
        }
    }
    return {
        x0,
        z0,
        w,
        h,
        cell,
        walk,
        elev,
        /** 좌표가 든 칸 번호 (격자 밖이면 -1) */
        index(x, z) {
            const i = Math.floor((x - x0) / cell);
            const j = Math.floor((z - z0) / cell);
            if (i < 0 || j < 0 || i >= w || j >= h) return -1;
            return j * w + i;
        },
        center(idx, out = {}) {
            out.x = x0 + ((idx % w) + 0.5) * cell;
            out.z = z0 + (Math.floor(idx / w) + 0.5) * cell;
            return out;
        },
        walkable(x, z) {
            const k = this.index(x, z);
            return k >= 0 && walk[k] === 1;
        }
    };
}
