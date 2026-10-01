// 살아남기(공성전 전용 맵 장르, 스타1 유즈맵 '살아남기' 류).
// - 맵은 넓은 눈벌판 전체(snowfield.js)다. 발판·소켓이 없고, 짓고 싶은 빈 땅 어디에나 타일 격자에 맞춰 짓는다.
//   방벽 1×1, 타워·광산 2×2(광산은 광맥 위만), 본진 4×4. 건물을 붙여 지어 길목을 막는 것이 핵심이다.
// - 판이 시작되면 본진을 세울 터(명당)를 고른다. 그때부터 밤 시계가 흐르고, 준비 시간이 지나면
//   맵 한가운데 둥지가 깨어나 웨이브를 쏟아낸다. 동이 틀 때(dawn초)까지 본진을 지키면 승리.
// - 적은 흐름장으로 길을 찾는다. 목표는 가장 가까운 '지킬 건물'(본진·타워·광산)이고, 방벽은 지나갈 수 있되
//   부수는 비용이 큰 칸으로 친다. 그래서 길이 막혔거나 너무 돌아가야 하면 가장 싼 벽(바깥 줄)부터 부순다.
// - 탐험 안개: 처음엔 둥지와 명당 후보만 어렴풋이 보이고, 나머지는 검다. 건물 둘레만 밝혀진다.
import { createField, KIND } from './snowfield.js';

export const SURVIVAL_DEFAULTS = {
    dawn: 900,
    payEvery: 12,
    // 본진 크기(타일)
    baseSize: 4
};

/** 건물 크기(타일): 방벽 1×1, 그 밖의 타워·광산 2×2 */
export function sizeOf(type) {
    return type === 'wall' ? 1 : 2;
}
/** 적의 근접 공격 간격(초)과 공격력 배율 */
export const SURV_RATE = 1.5;
export const SURV_DMG = 0.6;
/** 본진 수리비: 잃은 체력 1당 골드 */
export const BASE_REPAIR = 0.4;
/** 고지대 사거리: 단 하나당 +6% */
export const HEIGHT_RANGE = 0.06;
/** 벽 칸을 지나가는 비용(월드 단위): 기본 + 체력 비례. 이만큼 돌아가는 편이 싸면 돌아간다 */
export const BREAK_BASE = 10;
export const BREAK_PER_HP = 1 / 45;
/** 건물이 밝히는 시야(타일) */
export const VISION = { base: 13, wall: 3, mine: 6, tower: 9 };
const NO_DIST = 1e9;

function config(cfg) {
    return { ...SURVIVAL_DEFAULTS, ...cfg };
}

// ---------- 생성 ----------

/** 렌더러·카메라 인트로가 쓰는 대표 경로: 둥지 → 맵 오른쪽 아래 (적은 이 길을 따르지 않는다) */
export function survivalPaths(cfg) {
    const half = (cfg.size * cfg.tile) / 2;
    return [
        [
            [0, 0],
            [half * 0.3, half * 0.3],
            [half * 0.6, half * 0.6]
        ]
    ];
}

const _fieldCache = new WeakMap();
/** 맵 정의마다 지형 격자는 한 번만 만든다 (렌더러·로직이 같이 쓴다, 읽기 전용) */
export function fieldOf(cfg) {
    let f = _fieldCache.get(cfg);
    if (!f) _fieldCache.set(cfg, (f = createField(cfg)));
    return f;
}

export function createSurvival(map, state) {
    const c = config(map.survival);
    const field = fieldOf(map.survival);
    const { N } = field;
    const n = N * N;
    const nestGates = [0, 1, 2, 3].map((q) => {
        const a = (q * Math.PI) / 2 + Math.PI / 4;
        const r = (field.nestR + 1.6) * field.T;
        return { id: q, x: Math.cos(a) * r, z: Math.sin(a) * r };
    });
    const fog = { explored: new Uint8Array(n), visible: new Uint8Array(n), version: 0, t: 0 };
    // 처음 보이는 곳: 둥지가 있는 분지, 명당 후보
    revealCircle(field, fog.explored, field.center.i, field.center.j, c.basin.r + 2);
    for (const s of field.sites) revealCircle(field, fog.explored, s.ci, s.cj, s.r + 2);
    const sv = {
        cfg: c,
        field,
        dawn: c.dawn,
        clock: 0,
        dawned: false,
        started: false,
        payEvery: c.payEvery,
        payT: c.payEvery,
        base: null,
        occ: new Int32Array(n),
        dist: new Float64Array(n),
        pot: new Float32Array(n),
        // 벽 칸에 들어갈 때 드는 부수는 비용 (밖에서 본 값)
        wallCost: new Float32Array(n),
        // 이웃 여덟 칸 중 막힌 칸(절벽·바위·건물)이 있는 칸: 여기서는 칸 중심을 따라 걷는다
        tight: new Uint8Array(n),
        flowDirty: true,
        flowBuilds: 0,
        nest: { x: 0, z: 0, r: field.nestR * field.T, gates: nestGates, awake: false },
        fog,
        pings: [],
        // 예전 API 호환: 병영·분열 적이 '걸을 수 있는가'를 묻는다
        nav: {
            walkable: (x, z) => {
                const k = field.cellAt(x, z);
                return k >= 0 && field.walkableKind(k) && state.survival.occ[k] === 0;
            }
        },
        caves: [{ id: 'nest', name: '중앙 둥지', short: '중앙', x: 0, z: 0 }]
    };
    return sv;
}

function revealCircle(field, arr, ci, cj, r) {
    const { N } = field;
    const r2 = r * r;
    for (let j = Math.max(0, Math.floor(cj - r)); j <= Math.min(N - 1, Math.ceil(cj + r)); j++)
        for (let i = Math.max(0, Math.floor(ci - r)); i <= Math.min(N - 1, Math.ceil(ci + r)); i++)
            if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 <= r2) arr[j * N + i] = 1;
}

// ---------- 건설 판정 ----------

/** 타일 (i, j)를 왼쪽 위로 하는 s×s 건물의 중심 월드 좌표 */
export function footprintCenter(field, i, j, s) {
    return { x: -field.half + (i + s / 2) * field.T, z: -field.half + (j + s / 2) * field.T };
}

/** 월드 좌표에 s×s 건물을 놓을 때 왼쪽 위 타일 (커서 아래에 건물 중심이 오게) */
export function snapFootprint(field, x, z, s) {
    const i = Math.round((x + field.half) / field.T - s / 2);
    const j = Math.round((z + field.half) / field.T - s / 2);
    return { i, j };
}

/**
 * 칸마다 지을 수 있는지: 반환 { ok, reason, cells: [{ i, j, ok }] }.
 * type: 타워 종류 | 'wall' | 'base'
 */
export function checkPlacement(state, type, i, j) {
    const sv = state.survival;
    const f = sv.field;
    const s = type === 'base' ? sv.cfg.baseSize : sizeOf(type);
    const cells = [];
    let reason = null;
    const fail = (r) => (reason ??= r);
    let veinId = null;
    let veinCells = 0;
    for (let dj = 0; dj < s; dj++)
        for (let di = 0; di < s; di++) {
            const ci = i + di;
            const cj = j + dj;
            let ok = true;
            if (!f.inside(ci, cj)) {
                ok = false;
                fail('맵 밖입니다.');
            } else {
                const k = cj * f.N + ci;
                if (!sv.fog.explored[k]) {
                    ok = false;
                    fail('아직 탐험하지 않은 땅입니다.');
                } else if (!f.walkableKind(k)) {
                    ok = false;
                    fail(f.kind[k] === KIND.cliff ? '절벽에는 지을 수 없습니다.' : '그곳에는 지을 수 없습니다.');
                } else if (f.nobuild[k]) {
                    ok = false;
                    fail('둥지 가까이에는 지을 수 없습니다.');
                } else if (sv.occ[k] !== 0) {
                    ok = false;
                    fail('이미 건물이 있습니다.');
                } else if (f.vein[k] >= 0) {
                    if (type !== 'mine') {
                        ok = false;
                        fail('광맥에는 광산만 지을 수 있습니다.');
                    } else {
                        if (veinId == null) veinId = f.vein[k];
                        if (f.vein[k] === veinId) veinCells++;
                    }
                } else if (type === 'mine') {
                    ok = false;
                    fail('광산은 광맥 위에만 지을 수 있습니다.');
                }
            }
            cells.push({ i: ci, j: cj, ok });
        }
    if (type === 'mine' && !reason && veinCells !== 4) fail('광산은 광맥 위에 꼭 맞게 지어야 합니다.');
    if (!reason && type === 'base') {
        const c = footprintCenter(f, i, j, s);
        if (Math.hypot(c.x, c.z) < (sv.cfg.basin.r + 8) * f.T) fail('둥지에서 더 떨어진 곳에 세우세요.');
    }
    // 적이 서 있는 자리에는 짓지 못한다
    if (!reason && type !== 'base') {
        const x0 = -f.half + i * f.T;
        const z0 = -f.half + j * f.T;
        const x1 = x0 + s * f.T;
        const z1 = z0 + s * f.T;
        for (const e of state.enemies) {
            if (!e.alive || e.def.flying) continue;
            if (e.x > x0 - e.radius && e.x < x1 + e.radius && e.z > z0 - e.radius && e.z < z1 + e.radius) {
                fail('적이 있는 자리에는 지을 수 없습니다.');
                break;
            }
        }
    }
    if (!reason && type !== 'base' && !sv.base) fail('먼저 본진을 세우세요.');
    return { ok: !reason, reason, cells, vein: veinId, size: s };
}

/** 건물이 차지한 칸에 id를 적는다 (본진은 -1) */
export function occupy(state, i, j, s, id) {
    const sv = state.survival;
    const N = sv.field.N;
    for (let dj = 0; dj < s; dj++) for (let di = 0; di < s; di++) sv.occ[(j + dj) * N + i + di] = id;
    sv.flowDirty = true;
    sv.buildVer = (sv.buildVer || 0) + 1;
}

/** 건물이 무너지거나 팔리면 칸을 비운다 */
export function release(state, tower) {
    const sv = state.survival;
    if (!sv || !tower.cell) return;
    const { i, j, s } = tower.cell;
    const N = sv.field.N;
    for (let dj = 0; dj < s; dj++)
        for (let di = 0; di < s; di++) {
            const k = (j + dj) * N + i + di;
            if (sv.occ[k] === tower.id) sv.occ[k] = 0;
        }
    sv.flowDirty = true;
    sv.buildVer = (sv.buildVer || 0) + 1;
}

/** 본진을 세운다: 그때부터 밤 시계가 흐른다 */
export function placeBase(state, i, j) {
    const sv = state.survival;
    if (sv.base) return { ok: false, reason: '본진은 이미 세웠습니다.' };
    const chk = checkPlacement(state, 'base', i, j);
    if (!chk.ok) return { ok: false, reason: chk.reason };
    const f = sv.field;
    const s = sv.cfg.baseSize;
    const c = footprintCenter(f, i, j, s);
    const k = (j + 1) * f.N + i + 1;
    sv.base = { i, j, s, x: c.x, z: c.z, r: (s * f.T) / 2, h: f.level[k], cell: { i, j, s } };
    occupy(state, i, j, s, -1);
    sv.started = true;
    updateFog(state, true);
    return { ok: true, base: sv.base };
}

/** 이 자리에 지을 수 있는 종류 (소켓 맵 호환용: 살아남기는 소켓이 없다) */
export function allowedHere(state, socket, type) {
    if (!state.survival) return true;
    return socket?.vein ? type === 'mine' : type !== 'mine';
}

// ---------- 흐름장 ----------

const SQ2 = Math.SQRT2;
const NB = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, SQ2],
    [1, -1, SQ2],
    [-1, 1, SQ2],
    [-1, -1, SQ2]
];

function buildingById(state, id) {
    if (id === -1) return state.survival.base;
    return state.towers.find((t) => t.id === id) || null;
}

/** 적이 노리는 건물(벽이 아닌 것): 본진·타워·광산 */
function isGoal(t) {
    return t.type !== 'wall';
}

/**
 * 거리장: 지킬 건물(본진·타워·광산) 칸에서 시작해, 걸을 수 있는 칸을 따라 잰 거리.
 * 벽 칸은 지나갈 수 있지만 들어갈 때 부수는 비용(BREAK_*)을 더한다.
 * 대각선은 양옆이 모두 비어 있어야 지나간다 (벽 모서리 틈으로 새지 않게).
 */
export function computeFlow(state) {
    const sv = state.survival;
    const f = sv.field;
    const { N } = f;
    const dist = sv.dist.fill(NO_DIST);
    const occ = sv.occ;
    const kind = f.kind;
    const heap = new MinHeap();
    const cost = new Map();
    const wallCost = sv.wallCost.fill(0);
    for (const t of state.towers) {
        const c = isGoal(t) ? 0 : BREAK_BASE + (t.maxHp ?? 600) * BREAK_PER_HP;
        cost.set(t.id, c);
        if (c && t.cell) wallCost[t.cell.j * N + t.cell.i] = c;
    }
    const seedBuilding = (b) => {
        const { i, j, s } = b.cell;
        for (let dj = 0; dj < s; dj++)
            for (let di = 0; di < s; di++) {
                const k = (j + dj) * N + i + di;
                dist[k] = 0;
                heap.push(k, 0);
            }
    };
    if (sv.base) seedBuilding(sv.base);
    for (const t of state.towers) if (isGoal(t) && t.cell) seedBuilding(t);
    const passable = (k) => kind[k] === KIND.ground || kind[k] === KIND.ramp;
    const free = (k) => passable(k) && occ[k] === 0;
    while (heap.size) {
        const k = heap.top();
        const d = heap.topVal();
        heap.pop();
        if (d > dist[k]) continue;
        const i = k % N;
        const j = (k - i) / N;
        // k에 들어가는 비용 (벽이면 부수는 비용)
        const o = occ[k];
        const enter = o > 0 ? cost.get(o) || 0 : 0;
        for (const [di, dj, c] of NB) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
            const nk = nj * N + ni;
            if (!passable(nk)) continue;
            if (c > 1 && (!free(j * N + ni) || !free(nj * N + i))) continue;
            const nd = d + c * f.T + enter;
            if (nd < dist[nk]) {
                dist[nk] = nd;
                heap.push(nk, nd);
            }
        }
    }
    // 보간용 퍼텐셜: 막힌 칸(절벽·바위)은 이웃한 걸을 수 있는 칸보다 조금 높게
    const pot = sv.pot;
    for (let k = 0; k < N * N; k++) {
        if (passable(k) && dist[k] < NO_DIST) {
            // 벽 칸은 밖에서 들어갈 때의 값 (부수는 비용 포함): 틈이 있으면 그쪽이 더 낮다
            pot[k] = dist[k] + wallCost[k];
            continue;
        }
        const i = k % N;
        const j = (k - i) / N;
        let m = NO_DIST;
        for (const [di, dj] of NB) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
            const nk = nj * N + ni;
            if (passable(nk) && dist[nk] < m) m = dist[nk];
        }
        pot[k] = m < NO_DIST ? m + f.T * 2.5 : 5000;
    }
    const tight = sv.tight;
    for (let k = 0; k < N * N; k++) {
        const i = k % N;
        const j = (k - i) / N;
        let t = 0;
        for (const [di, dj] of NB) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= N || nj >= N || !free(nj * N + ni)) {
                t = 1;
                break;
            }
        }
        tight[k] = t;
    }
    sv.flowDirty = false;
    sv.flowBuilds++;
}

class MinHeap {
    constructor() {
        this.k = [];
        this.v = [];
    }
    get size() {
        return this.k.length;
    }
    top() {
        return this.k[0];
    }
    topVal() {
        return this.v[0];
    }
    push(key, val) {
        const { k, v } = this;
        let i = k.length;
        k.push(key);
        v.push(val);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (v[p] <= val) break;
            k[i] = k[p];
            v[i] = v[p];
            i = p;
        }
        k[i] = key;
        v[i] = val;
    }
    pop() {
        const { k, v } = this;
        const lk = k.pop();
        const lv = v.pop();
        if (k.length) {
            let i = 0;
            const n = k.length;
            for (;;) {
                const l = 2 * i + 1;
                if (l >= n) break;
                const r = l + 1;
                const m = r < n && v[r] < v[l] ? r : l;
                if (v[m] >= lv) break;
                k[i] = k[m];
                v[i] = v[m];
                i = m;
            }
            k[i] = lk;
            v[i] = lv;
        }
    }
}

function ensureFlow(state) {
    if (state.survival.flowDirty) computeFlow(state);
}

/** 퍼텐셜을 쌍선형 보간 (칸 중심 기준) */
function potAt(sv, x, z) {
    const f = sv.field;
    const { N, T } = f;
    const fi = (x + f.half) / T - 0.5;
    const fj = (z + f.half) / T - 0.5;
    const i = Math.max(0, Math.min(N - 2, Math.floor(fi)));
    const j = Math.max(0, Math.min(N - 2, Math.floor(fj)));
    const tx = Math.max(0, Math.min(1, fi - i));
    const tz = Math.max(0, Math.min(1, fj - j));
    const k = j * N + i;
    const p = sv.pot;
    const a = p[k] + (p[k + 1] - p[k]) * tx;
    const b = p[k + N] + (p[k + N + 1] - p[k + N]) * tx;
    return a + (b - a) * tz;
}

/** 이 칸에서 거리가 가장 많이 줄어드는 이웃 칸 (없으면 -1) */
export function bestNeighbor(state, k) {
    const sv = state.survival;
    const f = sv.field;
    const { N } = f;
    const i = k % N;
    const j = (k - i) / N;
    let best = -1;
    let bd = sv.dist[k] + 1e-6;
    const free = (q) => f.walkableKind(q) && sv.occ[q] === 0;
    for (const [di, dj, c] of NB) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = nj * N + ni;
        if (!f.walkableKind(nk)) continue;
        if (c > 1 && (!free(j * N + ni) || !free(nj * N + i))) continue;
        // 그 칸으로 가는 실제 비용: 걸음 + (벽이면) 부수는 비용
        const v = sv.dist[nk] + sv.wallCost[nk] + c * f.T;
        if (v < bd) {
            bd = v;
            best = nk;
        }
    }
    return best;
}

/** 이 자리에서 목표 쪽으로 걸어갈 방향 (단위 벡터) */
export function flowDir(state, x, z, out = {}) {
    const sv = state.survival;
    ensureFlow(state);
    const e = 0.35;
    const gx = potAt(sv, x + e, z) - potAt(sv, x - e, z);
    const gz = potAt(sv, x, z + e) - potAt(sv, x, z - e);
    const len = Math.hypot(gx, gz);
    if (len > 1e-4) {
        out.x = -gx / len;
        out.z = -gz / len;
        return out;
    }
    out.x = 0;
    out.z = 0;
    const k = sv.field.cellAt(x, z);
    if (k < 0) return out;
    const n = bestNeighbor(state, k);
    if (n < 0) return out;
    const p = sv.field.toWorld(n % sv.field.N, Math.floor(n / sv.field.N));
    const dx = p.x - x;
    const dz = p.z - z;
    const l = Math.hypot(dx, dz) || 1;
    out.x = dx / l;
    out.z = dz / l;
    return out;
}

/** 가장 가까운 목표까지 걸어서 남은 거리 */
export function flowDistance(state, x, z) {
    ensureFlow(state);
    return potAt(state.survival, x, z);
}

export function isWalkable(state, x, z) {
    return state.survival.nav.walkable(x, z);
}

// ---------- 건물 ----------

/** 건물 사각형까지의 거리 (안이면 0) */
function rectDist(sv, b, x, z) {
    const f = sv.field;
    const { i, j, s } = b.cell;
    const x0 = -f.half + i * f.T;
    const z0 = -f.half + j * f.T;
    const dx = Math.max(x0 - x, 0, x - (x0 + s * f.T));
    const dz = Math.max(z0 - z, 0, z - (z0 + s * f.T));
    return Math.hypot(dx, dz);
}

/** 하늘의 적: 곧장 날아갈 가장 가까운 목표 건물 (본진·타워·광산) */
function nearestGoal(state, x, z) {
    const sv = state.survival;
    let best = sv.base;
    let bd = sv.base ? rectDist(sv, sv.base, x, z) : Infinity;
    for (const t of state.towers) {
        if (!isGoal(t) || !t.cell) continue;
        const d = rectDist(sv, t, x, z);
        if (d < bd) {
            bd = d;
            best = t;
        }
    }
    return { target: best, dist: bd };
}

export function isBase(state, s) {
    return !!state.survival && s === state.survival.base;
}

export function baseRepairCost(state) {
    if (!state.survival) return 0;
    return Math.ceil(Math.max(0, state.maxLives - state.lives) * BASE_REPAIR);
}

// ---------- 적 ----------

const _d = {};
const _c = {};
const REACH = 0.28;

/**
 * 살아남기에서 적 한 마리의 이동·공격 (붙잡히거나 기절한 경우는 game.js가 먼저 걸러낸다).
 * hooks: { damageTower(tower, amount), damageBase(amount) } — 순환 의존을 피하려고 game.js가 넘긴다.
 */
export function updateSurvivalEnemy(state, e, sp, dt, hooks) {
    const sv = state.survival;
    if (!sv.base) return;
    if (e.def.flying) return flyer(state, e, sp, dt, hooks);
    ensureFlow(state);
    const f = sv.field;
    const k = f.cellAt(e.x, e.z);
    // 지금 노리는 건물이 아직 닿는 거리에 있으면 계속 친다
    if (e.atkTarget && e.burrowT <= 0) {
        const b = e.atkTarget;
        const alive = b === sv.base || state.towers.includes(b);
        if (alive && rectDist(sv, b, e.x, e.z) <= e.radius + REACH + 0.1) {
            attack(state, e, b, dt, hooks);
            return;
        }
        e.atkTarget = null;
    }
    e.atkTargetId = null;
    // 다음 칸이 건물이면(목표에 닿았거나 벽이 길을 막고 있으면) 그것을 친다. 아직 멀면 그 칸으로 다가간다
    let toward = null;
    if (k >= 0 && e.burrowT <= 0) {
        const n = bestNeighbor(state, k);
        if (n >= 0 && sv.occ[n] !== 0) {
            const b = buildingById(state, sv.occ[n]);
            if (b && rectDist(sv, b, e.x, e.z) <= e.radius + REACH) {
                e.atkTarget = b;
                attack(state, e, b, dt, hooks);
                return;
            }
            toward = f.toWorld(n % f.N, Math.floor(n / f.N), _c);
        }
    }
    // 막힌 칸 곁(좁은 길·틈·벽 앞)에서는 다음 칸 중심을 따라 걷는다
    if (!toward && k >= 0 && sv.tight[k]) {
        const n = bestNeighbor(state, k);
        if (n >= 0) toward = f.toWorld(n % f.N, Math.floor(n / f.N), _c);
    }
    if (toward) {
        const dx = toward.x - e.x;
        const dz = toward.z - e.z;
        const l = Math.hypot(dx, dz) || 1;
        _d.x = dx / l;
        _d.z = dz / l;
    } else flowDir(state, e.x, e.z, _d);
    steer(e, _d.x, _d.z, dt);
    const x0 = e.x;
    const z0 = e.z;
    let hit = walk(state, e, e.dirX * sp * dt, e.dirZ * sp * dt);
    // 좁은 틈에서 매끈한 방향이 벽에 막히면 다음 칸 중심으로 곧장 (끼어서 멈추지 않게)
    if (!hit && k >= 0 && Math.abs(e.x - x0) + Math.abs(e.z - z0) < sp * dt * 0.3) {
        const n = bestNeighbor(state, k);
        if (n >= 0) {
            const c = f.toWorld(n % f.N, Math.floor(n / f.N), _c);
            const dx = c.x - e.x;
            const dz = c.z - e.z;
            const l = Math.hypot(dx, dz) || 1;
            hit = walk(state, e, (dx / l) * sp * dt, (dz / l) * sp * dt);
        }
    }
    if (hit && e.burrowT <= 0) {
        e.atkTarget = hit;
        attack(state, e, hit, dt, hooks);
    }
    e.d = 500 - flowDistance(state, e.x, e.z);
}

function flyer(state, e, sp, dt, hooks) {
    const sv = state.survival;
    e.retargetT = (e.retargetT ?? 0) - dt;
    if (e.retargetT <= 0 || !e.flyTarget || (e.flyTarget !== sv.base && !state.towers.includes(e.flyTarget))) {
        e.retargetT = 0.5;
        e.flyTarget = nearestGoal(state, e.x, e.z).target;
    }
    const t = e.flyTarget;
    if (!t) return;
    const dist = rectDist(sv, t, e.x, e.z);
    if (dist <= e.radius + REACH + 0.2) {
        attack(state, e, t, dt, hooks);
        return;
    }
    e.atkTargetId = null;
    const dx = t.x - e.x;
    const dz = t.z - e.z;
    const len = Math.hypot(dx, dz) || 1;
    steer(e, dx / len, dz / len, dt);
    e.x += e.dirX * sp * dt;
    e.z += e.dirZ * sp * dt;
    e.d = 500 - dist;
}

/** 방향을 부드럽게 튼다 (격자 모서리에서 지그재그하지 않게) */
function steer(e, dx, dz, dt) {
    if (!dx && !dz) return;
    const k = Math.min(1, dt * 9);
    let x = e.dirX + (dx - e.dirX) * k;
    let z = e.dirZ + (dz - e.dirZ) * k;
    const l = Math.hypot(x, z);
    if (l < 1e-4) {
        x = dx;
        z = dz;
    } else {
        x /= l;
        z /= l;
    }
    e.dirX = x;
    e.dirZ = z;
}

/** 칸이 비어 있고 걸을 수 있는가 */
function open(sv, x, z) {
    const k = sv.field.cellAt(x, z);
    return k >= 0 && sv.field.walkableKind(k) && sv.occ[k] === 0;
}

/**
 * 걸을 수 있는 빈 칸 안에서만 움직인다. 앞이 건물이면 그 건물을 돌려준다(부딪힘).
 * 지형에 막히면 벽을 따라 미끄러진다.
 */
function walk(state, e, mx, mz) {
    const sv = state.survival;
    const f = sv.field;
    const r = e.radius * 0.8;
    // 몸 앞쪽 끝이 닿는 칸
    const probe = (x, z, dx, dz) => {
        const l = Math.hypot(dx, dz) || 1;
        return f.cellAt(x + (dx / l) * r, z + (dz / l) * r);
    };
    const pk = probe(e.x + mx, e.z + mz, mx, mz);
    if (pk >= 0 && sv.occ[pk] !== 0 && f.walkableKind(pk)) {
        const b = buildingById(state, sv.occ[pk]);
        // 지킬 건물이면 친다. 방벽은 흐름장이 '부수고 지나가라'고 할 때만 (틈으로 빠지는 중이면 비켜 간다)
        if (b && (b.type !== 'wall' || wantsBreak(state, e))) return b;
    }
    const free = (x, z, dx, dz) => {
        if (!open(sv, x, z)) return false;
        const q = probe(x, z, dx, dz);
        return q < 0 || (f.walkableKind(q) && sv.occ[q] === 0);
    };
    if (free(e.x + mx, e.z + mz, mx, mz)) {
        e.x += mx;
        e.z += mz;
    } else if (mx && free(e.x + mx, e.z, mx, 0)) e.x += mx;
    else if (mz && free(e.x, e.z + mz, 0, mz)) e.z += mz;
    return null;
}

/** 흐름장의 다음 칸이 건물인가 (길이 막혀 부수고 지나가야 하는가) */
function wantsBreak(state, e) {
    const sv = state.survival;
    const k = sv.field.cellAt(e.x, e.z);
    if (k < 0) return false;
    const n = bestNeighbor(state, k);
    return n >= 0 && sv.occ[n] !== 0;
}

function attack(state, e, target, dt, hooks) {
    const sv = state.survival;
    const base = target === sv.base;
    e.atkTargetId = base ? 'base' : target.id;
    // 공격하는 동안 목표를 바라본다
    const dx = target.x - e.x;
    const dz = target.z - e.z;
    const len = Math.hypot(dx, dz) || 1;
    steer(e, dx / len, dz / len, dt);
    e.atkCd -= dt;
    if (e.atkCd > 0) return;
    e.atkCd = e.def.boss ? 2.2 : SURV_RATE;
    const amount = Math.max(2, e.atk) * SURV_DMG * (e.def.boss ? 1.4 : 1);
    state.events.push({
        type: 'enemyShot',
        id: e.id,
        enemy: e.type,
        boss: !!e.def.boss,
        melee: true,
        x: e.x,
        z: e.z,
        tx: target.x,
        tz: target.z,
        towerId: base ? null : target.id,
        base
    });
    ping(state, target.x, target.z);
    if (base) hooks.damageBase(amount);
    else hooks.damageTower(target, amount);
}

/** 미니맵 경고 핑: 같은 곳은 3초에 한 번만 */
function ping(state, x, z) {
    const sv = state.survival;
    for (const p of sv.pings) if (Math.abs(p.x - x) < 8 && Math.abs(p.z - z) < 8 && state.time - p.t < 3) return;
    sv.pings.push({ x, z, t: state.time });
    if (sv.pings.length > 12) sv.pings.shift();
    state.events.push({ type: 'underAttack', x, z });
}

/** 적끼리 겹치지 않게 살짝 밀어낸다 (땅 위의 적만, 칸 묶음으로 가까운 것끼리만 비교) */
export function separateEnemies(state, dt) {
    const sv = state.survival;
    const buckets = new Map();
    const key = (x, z) => Math.floor(x) * 1000 + Math.floor(z);
    for (const e of state.enemies) {
        if (!e.alive || e.def.flying) continue;
        const k = key(e.x, e.z);
        let b = buckets.get(k);
        if (!b) buckets.set(k, (b = []));
        b.push(e);
    }
    const k = Math.min(1, dt * 8);
    for (const e of state.enemies) {
        if (!e.alive || e.def.flying) continue;
        const cx = Math.floor(e.x);
        const cz = Math.floor(e.z);
        let px = 0;
        let pz = 0;
        for (let i = -1; i <= 1; i++)
            for (let j = -1; j <= 1; j++) {
                const b = buckets.get((cx + i) * 1000 + cz + j);
                if (!b) continue;
                for (const o of b) {
                    if (o === e) continue;
                    const dx = e.x - o.x;
                    const dz = e.z - o.z;
                    const min = (e.radius + o.radius) * 0.85;
                    const d2 = dx * dx + dz * dz;
                    if (d2 >= min * min) continue;
                    const d = Math.sqrt(d2) || 0.01;
                    const push = (min - d) * (o.def.boss && !e.def.boss ? 1 : 0.5);
                    px += (dx / d) * push;
                    pz += (dz / d) * push;
                }
            }
        if (!px && !pz) continue;
        const mx = px * k;
        const mz = pz * k;
        if (open(sv, e.x + mx, e.z + mz)) {
            e.x += mx;
            e.z += mz;
        }
    }
}

/** 도약: 흐름장을 따라 dist만큼 앞으로 (건물에 닿으면 멈춘다) */
export function blinkAlong(state, e, dist) {
    const sv = state.survival;
    if (e.def.flying) {
        const t = nearestGoal(state, e.x, e.z);
        const len = Math.max(0, Math.min(dist, t.dist - e.radius - 0.2));
        e.x += e.dirX * len;
        e.z += e.dirZ * len;
        return;
    }
    for (let s = 0; s < dist; s += 0.25) {
        flowDir(state, e.x, e.z, _d);
        const nx = e.x + _d.x * 0.25;
        const nz = e.z + _d.z * 0.25;
        if (!open(sv, nx + _d.x * e.radius, nz + _d.z * e.radius)) break;
        e.x = nx;
        e.z = nz;
    }
}

/** 둥지 네 입구 중 한 곳에서 나올 자리 (개체마다 결정적으로 흩뜨린다) */
export function spawnPoint(state, grp, id) {
    const gates = state.survival.nest.gates;
    // 본진 쪽 입구 둘에서 번갈아 나온다 (가까운 입구가 붐비지 않게)
    const b = state.survival.base;
    const sorted = b
        ? gates.slice().sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z))
        : gates;
    const g = sorted[id % (grp.spread ?? 4)] || sorted[0];
    const a = id * 2.399963;
    const r = 0.2 + ((id * 0.618034) % 1) * 0.9;
    let x = g.x + Math.cos(a) * r;
    let z = g.z + Math.sin(a) * r;
    if (!open(state.survival, x, z)) {
        x = g.x;
        z = g.z;
    }
    return { x, z, cave: 'nest' };
}

// ---------- 광산 ----------

/** 밤 시계가 흐르는 동안 payEvery초마다 광맥 위 광산이 골드를 캔다 */
export function payMines(state, dt, incomeOf) {
    const sv = state.survival;
    sv.payT -= dt;
    if (sv.payT > 0) return;
    sv.payT += sv.payEvery;
    for (const t of state.towers) {
        if (t.type !== 'mine' || t.veinId == null) continue;
        const v = sv.field.veins[t.veinId];
        const amount = Math.round(incomeOf(t) * (v.yield ?? 1) * (sv.cfg.mineMul ?? 1));
        if (!amount) continue;
        state.gold += amount;
        state.stats.mined = (state.stats.mined || 0) + amount;
        state.events.push({ type: 'income', towerId: t.id, x: t.x, z: t.z, amount });
    }
}

// ---------- 탐험 안개 ----------

/** 건물 둘레를 밝힌다. 0.25초마다 (force면 바로). 안개 속 적은 e.fogged */
export function updateFog(state, force = false, dt = 0) {
    const sv = state.survival;
    const fog = sv.fog;
    fog.t -= dt;
    if (!force && fog.t > 0) return;
    fog.t = 0.25;
    const f = sv.field;
    const vis = fog.visible.fill(0);
    const T = f.T;
    const src = (x, z, r) => revealCircle(f, vis, (x + f.half) / T, (z + f.half) / T, r);
    if (sv.base) src(sv.base.x, sv.base.z, VISION.base);
    for (const t of state.towers) {
        if (!t.cell) continue;
        src(t.x, t.z, t.type === 'wall' ? VISION.wall : t.type === 'mine' ? VISION.mine : VISION.tower);
    }
    // 둥지가 있는 분지는 언제나 보인다 (깨어나 쏟아지는 모습을 지켜본다)
    revealCircle(f, vis, f.center.i, f.center.j, sv.cfg.basin.r + 1.5);
    let changed = false;
    const ex = fog.explored;
    for (let k = 0; k < vis.length; k++)
        if (vis[k] && !ex[k]) {
            ex[k] = 1;
            changed = true;
        }
    fog.version++;
    fog.exploredChanged = changed || fog.exploredChanged;
    for (const e of state.enemies) {
        const k = f.cellAt(e.x, e.z);
        e.fogged = k < 0 || !vis[k];
    }
}

/** 이 자리가 지금 보이는가 */
export function isVisible(state, x, z) {
    const sv = state.survival;
    const k = sv.field.cellAt(x, z);
    return k >= 0 && sv.fog.visible[k] === 1;
}

// ---------- 웨이브 안내 ----------

/** 웨이브가 나오는 곳 (살아남기는 언제나 가운데 둥지) */
export function caveLabel(state, wave) {
    return wave ? '중앙 둥지' : '';
}

// ---------- 밤 시계 ----------

/**
 * 밤의 진행: f(0~1) 시계 비율, night(0~1) 어둠의 깊이, dawn(0~1) 동트는 정도, remain 남은 초.
 * 밤은 75%까지 깊어지고(막판 대공세는 가장 깊은 어둠 속), 마지막 8%에 동이 튼다.
 */
export function nightPhase(state) {
    const sv = state.survival;
    if (!sv) return { f: 0, night: 0, dawn: 0, remain: 0 };
    const f = sv.dawned ? 1 : Math.min(1, sv.clock / sv.dawn);
    const s = (a, b, x) => {
        const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };
    // 넓은 맵에서 너무 어두우면 아무것도 안 보인다: 밤은 0.7까지만 깊어진다
    return { f, night: s(0, 0.75, f) * 0.7, dawn: s(0.92, 1, f), remain: Math.max(0, sv.dawn - sv.clock) };
}

/** 남은 시간을 m:ss로 */
export function formatClock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 명당(고원 터)의 길목: 비탈길이 고원 가장자리를 지나는 칸들 (AI·안내용) */
export function siteChokes(field, siteN) {
    const out = [];
    field.ramps.forEach((r, n) => {
        if (r.owner !== field.sites[siteN].id) return;
        const cells = [];
        for (let k = 0; k < field.N * field.N; k++) if (field.rampOf[k] === n) cells.push(k);
        out.push({ ramp: n, to: r.to, from: r.from, w: r.w, cells });
    });
    return out;
}
