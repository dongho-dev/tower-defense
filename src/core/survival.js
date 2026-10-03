// 살아남기(공성전 전용 맵 장르, 스타1 유즈맵 '살아남기' 류).
// - 맵은 넓은 눈벌판 전체(snowfield.js)다. 발판·소켓이 없고, 짓고 싶은 빈 땅 어디에나 타일 격자에 맞춰 짓는다.
//   타워·광산 2×2(광산은 광맥 위만), 본진 4×4. 방벽은 고원 비탈(입구) 하나를 통째로 막는 큰 벽 하나로,
//   비탈 위 끝 줄 전체(폭 3~5칸 × 1칸)를 덮는다. 방벽은 그 자리에서 3단계까지 올린다(나무 → 돌 → 강화).
// - 판은 맵 한가운데 둥지 곁에서 생존자(일꾼) 한 명으로 시작한다. 처음엔 생존자 둘레만 보이고 나머지는 검다.
//   생존자를 우클릭으로 움직여 땅을 밝히고, 고원을 찾아 본진을 짓는다. 건설·수리는 생존자가 그 자리에 가서 한다.
//   생존자는 싸우지 못하고 적이 노린다. 죽으면 본진에서 다시 살아나고, 본진이 없는데 모두 쓰러지면 패배다.
//   생존자는 여럿일 수 있다(sv.workers, sv.worker = 처음 생존자). 주문은 생존자마다 따로 받는다.
//   생존자는 자기 방벽을 문처럼 지나간다 (적은 막힌다).
// - 밤 시계는 판이 시작될 때부터 흐른다. 정해진 시각에 맵 한가운데 둥지가 깨어나 웨이브를 쏟아낸다.
//   동이 틀 때(dawn초)까지 본진을 지키면 승리.
// - 적은 흐름장으로 길을 찾는다. 목표는 가장 가까운 '지킬 건물'(본진·타워·광산)이고, 방벽은 지나갈 수 있되
//   부수는 비용이 큰 칸으로 친다. 그래서 길이 막혔거나 너무 돌아가야 하면 가장 싼 벽(바깥 줄)부터 부순다.
// - 이동 규칙(적·생존자 모두): 한 걸음에 이웃 칸으로만, 대각선은 양쪽 직교 칸이 모두 비어 있을 때만.
//   밀어내기·도약도 같은 규칙을 지나고, 매 틱 끝에 막힌 칸에 선 몸은 마지막 바른 자리로 되돌린다.
import { KIND, RAMP_LEN, createField } from './snowfield.js';
import { TOWERS } from './data/towers.js';

export const SURVIVAL_DEFAULTS = {
    dawn: 930,
    payEvery: 12,
    // 본진 크기(타일)
    baseSize: 4
};

/** 건물 크기(타일): 본진 4×4, 그 밖의 타워·광산 2×2. 방벽은 두께 1칸 (길이는 비탈 폭: wallSpan) */
export function sizeOf(type) {
    return type === 'wall' ? 1 : type === 'base' ? SURVIVAL_DEFAULTS.baseSize : 2;
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
/** 시야(타일) */
export const VISION = { base: 13, wall: 4, mine: 6, tower: 9, worker: 9 };
/** 짓는 데 걸리는 시간(초) */
export const BUILD_TIME = { base: 10, wall: 6, mine: 5, tower: 5 };
/** 생존자(일꾼) */
export const WORKER = {
    hp: 160,
    speed: 2.4,
    radius: 0.3,
    // 다시 살아나기까지(초)
    respawn: 15,
    // 적이 생존자를 알아채는 거리(월드)
    aggro: 3.6,
    // 수리 속도: 초당 최대 체력 비율 (타워·벽 / 본진)
    repair: 0.12,
    repairBase: 0.03,
    // 건물 곁으로 이 거리 안이면 손이 닿는다
    reach: 0.8
};
/** 본진의 채굴 기술: 단계마다 광산 수입 배율 */
export const MINE_TECH = [
    { cost: 150, mul: 1.25 },
    { cost: 300, mul: 1.5 },
    { cost: 500, mul: 1.8 }
];
const NO_DIST = 1e9;
/** 방벽은 고원 비탈에만 */
export const WALL_RAMP_ONLY = '방벽은 고원으로 오르는 비탈(입구)에만 지을 수 있습니다.';

/** 건물 칸의 가로·세로 (정사각형이면 s×s, 방벽은 cw×ch) */
export function cellDims(c) {
    return [c.cw ?? c.s, c.ch ?? c.s];
}

function config(cfg) {
    return { ...SURVIVAL_DEFAULTS, ...cfg };
}

/** 건물 종류의 건설 시간 */
export function buildTimeOf(type) {
    return BUILD_TIME[type] ?? BUILD_TIME.tower;
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
    const sv = {
        cfg: c,
        field,
        dawn: c.dawn,
        clock: 0,
        dawned: false,
        // 밤 시계는 판이 시작될 때부터 흐른다
        started: true,
        payEvery: c.payEvery,
        payT: c.payEvery,
        base: null,
        mineTech: 0,
        occ: new Int32Array(n),
        // 방벽 칸 (생존자는 문처럼 지나간다)
        door: new Uint8Array(n),
        // 생존자가 지으러 갈 자리 (건설 예정 주문 번호)
        reserved: new Int32Array(n),
        dist: new Float64Array(n),
        pot: new Float32Array(n),
        // 벽 칸에 들어갈 때 드는 부수는 비용 (밖에서 본 값)
        wallCost: new Float32Array(n),
        // 이웃 여덟 칸 중 막힌 칸(절벽·바위·건물)이 있는 칸: 여기서는 칸 중심을 따라 걷는다
        tight: new Uint8Array(n),
        flowDirty: true,
        flowBuilds: 0,
        flowT: 0,
        buildVer: 0,
        nest: { x: 0, z: 0, r: field.nestR * field.T, gates: nestGates, awake: false },
        fog,
        pings: [],
        worker: null,
        workers: [],
        workerId: 1,
        orderId: 1,
        // 길 찾기 버퍼 (생존자 A*)
        path: { g: new Float32Array(n), from: new Int32Array(n), seen: new Uint32Array(n), stamp: 0 },
        seal: { ver: -1, sealed: new Uint8Array(field.ramps.length) },
        // 예전 API 호환: 병영·분열 적이 '걸을 수 있는가'를 묻는다
        nav: {
            walkable: (x, z) => {
                const k = field.cellAt(x, z);
                return k >= 0 && field.walkableKind(k) && state.survival.occ[k] === 0;
            }
        },
        caves: [{ id: 'nest', name: '중앙 둥지', short: '중앙', x: 0, z: 0 }]
    };
    // 생존자: 둥지 남쪽 곁 빈 땅
    const start = nearestFree(sv, field.cellAt(0, (field.nestR + 2.2) * field.T), 6);
    sv.worker = makeWorker(sv, start);
    // 처음 보이는 곳은 생존자 둘레뿐 (나머지는 검다)
    revealCircle(field, fog.visible, (start % N) + 0.5, Math.floor(start / N) + 0.5, VISION.worker);
    fog.explored.set(fog.visible);
    return sv;
}

/** 칸 k에 생존자 하나를 세운다 (sv.workers에 넣는다) */
function makeWorker(sv, k) {
    const f = sv.field;
    const p = f.toWorld(k % f.N, Math.floor(k / f.N));
    const w = {
        id: sv.workerId++,
        x: p.x,
        z: p.z,
        sx: p.x,
        sz: p.z,
        dirX: 0,
        dirZ: 1,
        hp: WORKER.hp,
        maxHp: WORKER.hp,
        alive: true,
        respawnT: 0,
        order: null,
        queue: [],
        path: null,
        pathI: 0,
        task: 'idle',
        hitT: -9,
        debt: 0,
        lastK: k,
        // 자기 방벽은 문처럼 지나간다
        door: true
    };
    sv.workers.push(w);
    return w;
}

/** 생존자를 하나 더 세운다 ((x, z) 곁 빈 칸). 반환: 새 생존자 */
export function addWorker(state, x, z) {
    const sv = state.survival;
    const k = nearestFree(sv, sv.field.cellAt(x, z), 6);
    const w = makeWorker(sv, k);
    updateFog(state, true);
    return w;
}

/** 살아 있는 생존자들 */
export function aliveWorkers(sv) {
    return sv.workers.filter((w) => w.alive);
}

function revealCircle(field, arr, ci, cj, r) {
    const { N } = field;
    const r2 = r * r;
    for (let j = Math.max(0, Math.floor(cj - r)); j <= Math.min(N - 1, Math.ceil(cj + r)); j++)
        for (let i = Math.max(0, Math.floor(ci - r)); i <= Math.min(N - 1, Math.ceil(ci + r)); i++)
            if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 <= r2) arr[j * N + i] = 1;
}

/** 걸을 수 있고 건물이 없는 칸. door: 방벽 칸도 빈 칸으로 친다 (생존자) */
export function freeCell(sv, k, door = false) {
    return k >= 0 && sv.field.walkableKind(k) && (sv.occ[k] === 0 || (door && sv.door[k] === 1));
}

/** 칸 k에서 가장 가까운 빈 칸 (반경 r칸 안, 없으면 k) */
function nearestFree(sv, k, r = 4) {
    const f = sv.field;
    if (freeCell(sv, k)) return k;
    const i0 = k % f.N;
    const j0 = Math.floor(k / f.N);
    let best = k;
    let bd = Infinity;
    for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
            const i = i0 + di;
            const j = j0 + dj;
            if (!f.inside(i, j)) continue;
            const q = j * f.N + i;
            const d = di * di + dj * dj;
            if (d < bd && freeCell(sv, q)) {
                bd = d;
                best = q;
            }
        }
    return best;
}

// ---------- 이동 규칙 ----------

/**
 * 칸 a에서 칸 b로 한 걸음에 옮겨 갈 수 있는가: b가 비어 있고 이웃 칸이며, 대각선이면 양쪽 직교 칸도 비어 있어야 한다.
 * (벽 두 개가 대각선으로 놓인 틈, 절벽 모서리로 빠져나가지 못하게)
 */
export function canStep(sv, a, b, door = false) {
    if (a === b) return true;
    if (!freeCell(sv, b, door)) return false;
    if (a < 0) return true;
    const N = sv.field.N;
    const ai = a % N;
    const aj = (a - ai) / N;
    const bi = b % N;
    const bj = (b - bi) / N;
    const di = bi - ai;
    const dj = bj - aj;
    if (di < -1 || di > 1 || dj < -1 || dj > 1) return false;
    if (di && dj && (!freeCell(sv, aj * N + bi, door) || !freeCell(sv, bj * N + ai, door))) return false;
    return true;
}

/** 몸(e: x, z)을 (nx, nz)로 옮긴다. 이동 규칙을 어기면 그대로 두고 false. 생존자(e.door)는 방벽을 지나간다 */
function stepTo(sv, e, nx, nz) {
    const f = sv.field;
    const a = f.cellAt(e.x, e.z);
    const b = f.cellAt(nx, nz);
    if (b < 0 || !canStep(sv, a, b, e.door === true)) return false;
    e.x = nx;
    e.z = nz;
    return true;
}

/** 축을 나눠서라도 옮긴다 (벽을 따라 미끄러지기) */
function slideTo(sv, e, mx, mz) {
    if (stepTo(sv, e, e.x + mx, e.z + mz)) return true;
    if (mx && stepTo(sv, e, e.x + mx, e.z)) return true;
    if (mz && stepTo(sv, e, e.x, e.z + mz)) return true;
    return false;
}

/**
 * 안전장치: 땅 위의 몸이 막힌 칸에 서 있거나 규칙을 어긴 걸음(칸 건너뛰기·모서리 끼어들기)을 했으면
 * 마지막 바른 자리로 되돌린다. 바르면 그 자리를 기억한다. (적·생존자 모두, 매 틱 끝)
 */
function pin(sv, e) {
    const f = sv.field;
    const k = f.cellAt(e.x, e.z);
    const last = e.lastK ?? -1;
    const door = e.door === true;
    if (k >= 0 && (last < 0 || canStep(sv, last, k, door))) {
        e.lastK = k;
        e.sx = e.x;
        e.sz = e.z;
        return;
    }
    if (last >= 0 && freeCell(sv, last, door)) {
        e.x = e.sx;
        e.z = e.sz;
        return;
    }
    // 서 있던 칸에 건물이 섰다: 가장 가까운 빈 칸으로
    const q = nearestFree(sv, last >= 0 ? last : k, 4);
    const p = f.toWorld(q % f.N, Math.floor(q / f.N));
    e.x = e.sx = p.x;
    e.z = e.sz = p.z;
    e.lastK = q;
}

/** 매 틱 끝: 땅 위의 적과 생존자를 바른 칸에 붙든다 */
export function pinBodies(state) {
    const sv = state.survival;
    for (const e of state.enemies) if (e.alive && !e.def.flying) pin(sv, e);
    for (const w of sv.workers) if (w.alive) pin(sv, w);
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

/** 본진이 될 주문이 줄에 있는가 */
function basePending(sv) {
    return workerOrders(sv).some((o) => o.type === 'build' && o.btype === 'base' && !o.started);
}

/**
 * 방벽 자리: 칸 (i, j)가 고원 비탈 통로 안이거나 그 어귀(위 끝 앞 두 줄·아래 끝 뒤 두 줄)면
 * 그 비탈의 위 끝 줄 전체를 덮는 자리 { n, i, j, cw, ch }. 아니면 null.
 */
export function wallSpan(sv, i, j) {
    const f = sv.field;
    if (!f.inside(i, j)) return null;
    let ramp = null;
    const own = f.rampOf[j * f.N + i];
    if (own >= 0 && f.ramps[own].owner !== 'basin') ramp = f.ramps[own];
    else
        for (const r of f.ramps) {
            if (r.owner === 'basin') continue;
            // 통로 좌표: t = 위 끝에서 아래로, l = 옆으로
            const t = (i - r.ri) * r.d[0] + (j - r.rj) * r.d[1];
            const l = (i - r.ri) * r.p[0] + (j - r.rj) * r.p[1];
            if (t >= -2 && t <= RAMP_LEN + 1 && l >= r.a - 1 && l <= r.b + 1) {
                ramp = r;
                break;
            }
        }
    if (!ramp) return null;
    let i0 = Infinity;
    let j0 = Infinity;
    let i1 = -Infinity;
    let j1 = -Infinity;
    for (const k of ramp.rows[0]) {
        const ci = k % f.N;
        const cj = (k - ci) / f.N;
        i0 = Math.min(i0, ci);
        j0 = Math.min(j0, cj);
        i1 = Math.max(i1, ci);
        j1 = Math.max(j1, cj);
    }
    return { n: ramp.n, i: i0, j: j0, cw: i1 - i0 + 1, ch: j1 - j0 + 1 };
}

/**
 * 칸마다 지을 수 있는지: 반환 { ok, reason, cells: [{ i, j, ok }] }.
 * type: 타워 종류 | 'wall' | 'base'. opts.order: 이 주문의 예약은 비어 있는 것으로 본다.
 * opts.plan: 주문을 넣는 중 (적·생존자가 서 있는지는 지을 때 다시 본다)
 */
export function checkPlacement(state, type, i, j, opts = {}) {
    const sv = state.survival;
    const f = sv.field;
    const s = type === 'base' ? sv.cfg.baseSize : sizeOf(type);
    let cw = s;
    let ch = s;
    let ramp = null;
    // 방벽: 누른 칸이 속한 비탈의 위 끝 줄 전체로 맞춘다
    if (type === 'wall') {
        const sp = wallSpan(sv, i, j);
        if (!sp)
            return { ok: false, reason: WALL_RAMP_ONLY, cells: [{ i, j, ok: false }], size: 1, i, j, cw: 1, ch: 1 };
        ({ i, j, cw, ch } = sp);
        ramp = sp.n;
    }
    const cells = [];
    let reason = null;
    const fail = (r) => (reason ??= r);
    let veinId = null;
    let veinCells = 0;
    for (let dj = 0; dj < ch; dj++)
        for (let di = 0; di < cw; di++) {
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
                } else if (sv.reserved[k] && sv.reserved[k] !== opts.order) {
                    ok = false;
                    fail('이미 건설 예정인 자리입니다.');
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
    if (type === 'base' && !reason) {
        if (sv.base || (basePending(sv) && !opts.order)) fail('본진은 하나만 세울 수 있습니다.');
        const c = footprintCenter(f, i, j, s);
        if (Math.hypot(c.x, c.z) < (sv.cfg.basin.r + 8) * f.T) fail('둥지에서 더 떨어진 곳에 세우세요.');
    }
    if (!reason && type !== 'base' && !sv.base && !basePending(sv)) fail('먼저 본진을 세우세요.');
    // 적·생존자가 서 있는 자리에는 짓지 못한다 (주문을 넣을 때는 묻지 않는다: 지을 때 비켜 있으면 된다)
    if (!reason && !opts.plan) {
        const x0 = -f.half + i * f.T;
        const z0 = -f.half + j * f.T;
        const x1 = x0 + cw * f.T;
        const z1 = z0 + ch * f.T;
        const inside = (b, r) => b.x > x0 - r && b.x < x1 + r && b.z > z0 - r && b.z < z1 + r;
        for (const e of state.enemies) {
            if (!e.alive || e.def.flying) continue;
            if (inside(e, e.radius * 0.5)) {
                fail('적이 있는 자리에는 지을 수 없습니다.');
                break;
            }
        }
        // 방벽은 생존자가 지나가는 문이라 서 있어도 된다
        if (!reason && type !== 'wall' && sv.workers.some((w) => w.alive && inside(w, 0)))
            fail('생존자가 서 있는 자리입니다.');
    }
    return { ok: !reason, reason, cells, vein: veinId, size: s, i, j, cw, ch, ramp };
}

/** 건물이 차지한 칸(cell: { i, j, s, cw?, ch? })에 id를 적는다 (본진은 -1). door: 생존자가 지나가는 방벽 */
export function occupy(state, cell, id, door = false) {
    const sv = state.survival;
    const N = sv.field.N;
    const [cw, ch] = cellDims(cell);
    for (let dj = 0; dj < ch; dj++)
        for (let di = 0; di < cw; di++) {
            const k = (cell.j + dj) * N + cell.i + di;
            sv.occ[k] = id;
            sv.door[k] = door ? 1 : 0;
        }
    sv.flowDirty = true;
    sv.buildVer++;
}

/** 건물이 무너지거나 팔리면 칸을 비운다 */
export function release(state, tower) {
    const sv = state.survival;
    if (!sv || !tower.cell) return;
    const { i, j } = tower.cell;
    const [cw, ch] = cellDims(tower.cell);
    const N = sv.field.N;
    for (let dj = 0; dj < ch; dj++)
        for (let di = 0; di < cw; di++) {
            const k = (j + dj) * N + i + di;
            if (sv.occ[k] === tower.id) {
                sv.occ[k] = 0;
                sv.door[k] = 0;
            }
        }
    sv.flowDirty = true;
    sv.buildVer++;
}

/** 본진을 세운다. construct면 생존자가 짓기 시작한 상태(다 지을 때까지 build가 붙는다) */
export function placeBase(state, i, j, construct = false, order = 0) {
    const sv = state.survival;
    if (sv.base) return { ok: false, reason: '본진은 이미 세웠습니다.' };
    const chk = checkPlacement(state, 'base', i, j, { order });
    if (!chk.ok) return { ok: false, reason: chk.reason };
    const f = sv.field;
    const s = sv.cfg.baseSize;
    const c = footprintCenter(f, i, j, s);
    const k = (j + 1) * f.N + i + 1;
    sv.base = { i, j, s, x: c.x, z: c.z, r: (s * f.T) / 2, h: f.level[k], cell: { i, j, s } };
    // 생존자가 짓는 본진은 체력 20%에서 시작해 다 지으면 가득 찬다
    if (construct) {
        sv.base.build = { t: 0, T: BUILD_TIME.base };
        state.lives = Math.max(1, Math.round(state.maxLives * 0.2));
    }
    occupy(state, sv.base.cell, -1);
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
 * 지킬 건물이 하나도 없으면 생존자를 쫓는다.
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
        if (!c || !t.cell) continue;
        const [cw, ch] = cellDims(t.cell);
        for (let dj = 0; dj < ch; dj++)
            for (let di = 0; di < cw; di++) wallCost[(t.cell.j + dj) * N + t.cell.i + di] = c;
    }
    let seeds = 0;
    const seedBuilding = (b) => {
        const { i, j } = b.cell;
        const [cw, ch] = cellDims(b.cell);
        for (let dj = 0; dj < ch; dj++)
            for (let di = 0; di < cw; di++) {
                const k = (j + dj) * N + i + di;
                dist[k] = 0;
                heap.push(k, 0);
                seeds++;
            }
    };
    if (sv.base) seedBuilding(sv.base);
    for (const t of state.towers) if (isGoal(t) && t.cell) seedBuilding(t);
    sv.chaseWorker = false;
    if (!seeds)
        for (const w of sv.workers) {
            if (!w.alive) continue;
            const k = f.cellAt(w.x, w.z);
            if (k >= 0) {
                dist[k] = 0;
                heap.push(k, 0);
                sv.chaseWorker = true;
            }
        }
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
    const { i, j } = b.cell;
    const [cw, ch] = cellDims(b.cell);
    const x0 = -f.half + i * f.T;
    const z0 = -f.half + j * f.T;
    const dx = Math.max(x0 - x, 0, x - (x0 + cw * f.T));
    const dz = Math.max(z0 - z, 0, z - (z0 + ch * f.T));
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
    // 곁에 생존자가 있으면 쫓아가 친다 (생존자는 싸우지 못한다). 하늘의 적은 건물만 노린다
    if (e.burrowT <= 0 && !e.def.flying && chaseWorker(state, e, sp, dt)) return;
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

/** 생존자가 가까우면 쫓아가 친다 (가장 가까운 생존자). 처리했으면 true */
function chaseWorker(state, e, sp, dt) {
    const sv = state.survival;
    let w = null;
    let d = Infinity;
    for (const c of sv.workers) {
        if (!c.alive) continue;
        const dc = Math.hypot(c.x - e.x, c.z - e.z);
        if (dc > WORKER.aggro + e.radius || dc >= d) continue;
        // 벽·절벽 너머의 생존자는 쫓지 않는다 (곧은 걸음으로 닿을 때만)
        if (!e.def.flying && !straightWalk(sv, e.x, e.z, c.x, c.z)) continue;
        w = c;
        d = dc;
    }
    if (!w) return false;
    const dx = w.x - e.x;
    const dz = w.z - e.z;
    e.atkTarget = null;
    if (d <= e.radius + WORKER.radius + REACH) {
        steer(e, dx / (d || 1), dz / (d || 1), dt);
        e.atkTargetId = 'worker';
        e.atkCd -= dt;
        if (e.atkCd > 0) return true;
        e.atkCd = e.def.boss ? 2.2 : SURV_RATE;
        state.events.push({
            type: 'enemyShot',
            id: e.id,
            enemy: e.type,
            boss: !!e.def.boss,
            melee: true,
            x: e.x,
            z: e.z,
            tx: w.x,
            tz: w.z,
            towerId: null,
            worker: true
        });
        hurtWorker(state, Math.max(2, e.atk) * SURV_DMG * (e.def.boss ? 1.4 : 1), w);
        return true;
    }
    steer(e, dx / d, dz / d, dt);
    e.atkTargetId = null;
    const mx = e.dirX * sp * dt;
    const mz = e.dirZ * sp * dt;
    if (e.def.flying) {
        e.x += mx;
        e.z += mz;
        return true;
    }
    // 곧장 다가가지 못하면(벽·절벽 너머) 쫓지 않고 길을 따른다
    return slideTo(sv, e, mx, mz);
}

/** (x0, z0)에서 (x1, z1)까지 곧게 걸어갈 수 있는가 (이동 규칙대로 칸을 이어 간다) */
function straightWalk(sv, x0, z0, x1, z1) {
    const f = sv.field;
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(d / 0.4));
    let prev = f.cellAt(x0, z0);
    for (let s = 1; s <= n; s++) {
        const k = f.cellAt(x0 + ((x1 - x0) * s) / n, z0 + ((z1 - z0) * s) / n);
        if (k !== prev && !canStep(sv, prev, k)) return false;
        prev = k;
    }
    return true;
}

function flyer(state, e, sp, dt, hooks) {
    const sv = state.survival;
    e.retargetT = (e.retargetT ?? 0) - dt;
    if (e.retargetT <= 0 || !e.flyTarget || (e.flyTarget !== sv.base && !state.towers.includes(e.flyTarget))) {
        e.retargetT = 0.5;
        e.flyTarget = nearestGoal(state, e.x, e.z).target;
    }
    const t = e.flyTarget;
    if (!t) {
        // 지킬 건물이 없으면 가장 가까운 생존자 쪽으로
        let w = null;
        for (const c of sv.workers)
            if (c.alive && (!w || Math.hypot(c.x - e.x, c.z - e.z) < Math.hypot(w.x - e.x, w.z - e.z))) w = c;
        if (!w) return;
        const dx = w.x - e.x;
        const dz = w.z - e.z;
        const len = Math.hypot(dx, dz) || 1;
        steer(e, dx / len, dz / len, dt);
        e.x += e.dirX * sp * dt;
        e.z += e.dirZ * sp * dt;
        return;
    }
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

/**
 * 걸을 수 있는 빈 칸 안에서만 움직인다 (이동 규칙: 이웃 칸으로만, 모서리 끼어들기 없음).
 * 앞이 건물이면 그 건물을 돌려준다(부딪힘). 지형에 막히면 벽을 따라 미끄러진다.
 */
function walk(state, e, mx, mz) {
    const sv = state.survival;
    const f = sv.field;
    const r = e.radius * 0.8;
    // 몸 앞쪽 끝이 닿는 칸
    const l = Math.hypot(mx, mz) || 1;
    const pk = f.cellAt(e.x + mx + (mx / l) * r, e.z + mz + (mz / l) * r);
    if (pk >= 0 && sv.occ[pk] !== 0 && f.walkableKind(pk)) {
        const b = buildingById(state, sv.occ[pk]);
        // 지킬 건물이면 친다. 방벽은 흐름장이 '부수고 지나가라'고 할 때만 (틈으로 빠지는 중이면 비켜 간다)
        if (b && (b.type !== 'wall' || wantsBreak(state, e))) return b;
    }
    slideTo(sv, e, mx, mz);
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

/** 한 틱에 밀어내는 최대 거리 (칸을 건너뛰지 못하게 칸 크기보다 훨씬 작게) */
const MAX_PUSH = 0.18;

/** 적끼리 겹치지 않게 살짝 밀어낸다 (땅 위의 적만, 1단위 격자 묶음으로 가까운 것끼리만 비교, 이동 규칙을 지킨다) */
export function separateEnemies(state, dt) {
    const sv = state.survival;
    const f = sv.field;
    const G = Math.ceil(f.half * 2) + 2;
    const sep = sv.sep ?? (sv.sep = { head: new Int32Array(G * G), next: new Int32Array(64), list: [] });
    if (sep.next.length < state.enemies.length) sep.next = new Int32Array(state.enemies.length * 2);
    const { head, next } = sep;
    head.fill(-1);
    const list = sep.list;
    list.length = 0;
    const cellOf = (x, z) => {
        const gx = Math.max(0, Math.min(G - 1, Math.floor(x + f.half) + 1));
        const gz = Math.max(0, Math.min(G - 1, Math.floor(z + f.half) + 1));
        return gz * G + gx;
    };
    for (const e of state.enemies) {
        if (!e.alive || e.def.flying) continue;
        const n = list.length;
        list.push(e);
        const c = cellOf(e.x, e.z);
        next[n] = head[c];
        head[c] = n;
    }
    const k = Math.min(1, dt * 8);
    for (const e of list) {
        const gx = Math.max(0, Math.min(G - 1, Math.floor(e.x + f.half) + 1));
        const gz = Math.max(0, Math.min(G - 1, Math.floor(e.z + f.half) + 1));
        let px = 0;
        let pz = 0;
        for (let j = Math.max(0, gz - 1); j <= Math.min(G - 1, gz + 1); j++)
            for (let i = Math.max(0, gx - 1); i <= Math.min(G - 1, gx + 1); i++) {
                for (let n = head[j * G + i]; n >= 0; n = next[n]) {
                    const o = list[n];
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
        let mx = px * k;
        let mz = pz * k;
        const m = Math.hypot(mx, mz);
        if (m > MAX_PUSH) {
            mx *= MAX_PUSH / m;
            mz *= MAX_PUSH / m;
        }
        slideTo(sv, e, mx, mz);
    }
}

/** 도약: 흐름장을 따라 dist만큼 앞으로 (건물·막힌 칸에 닿으면 멈춘다) */
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
        if (!stepTo(sv, e, e.x + _d.x * 0.25, e.z + _d.z * 0.25)) break;
        const ahead = sv.field.cellAt(e.x + _d.x * e.radius, e.z + _d.z * e.radius);
        if (!freeCell(sv, ahead)) break;
    }
}

/** 둥지 네 입구 중 한 곳에서 나올 자리 (개체마다 결정적으로 흩뜨린다) */
export function spawnPoint(state, grp, id) {
    const sv = state.survival;
    const gates = sv.nest.gates;
    // 본진 쪽 입구 둘에서 번갈아 나온다 (가까운 입구가 붐비지 않게)
    const b = sv.base ?? sv.worker;
    const sorted = gates.slice().sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z));
    const g = sorted[id % (grp.spread ?? 4)] || sorted[0];
    const a = id * 2.399963;
    const r = 0.2 + ((id * 0.618034) % 1) * 0.9;
    let x = g.x + Math.cos(a) * r;
    let z = g.z + Math.sin(a) * r;
    if (!freeCell(sv, sv.field.cellAt(x, z))) {
        x = g.x;
        z = g.z;
    }
    return { x, z, cave: 'nest' };
}

// ---------- 광산 ----------

/** 채굴 기술 단계에 따른 광산 수입 배율 */
export function mineTechMul(sv) {
    return sv.mineTech > 0 ? MINE_TECH[sv.mineTech - 1].mul : 1;
}

/** 다음 채굴 기술 (없으면 null) */
export function nextMineTech(sv) {
    return MINE_TECH[sv.mineTech] ?? null;
}

/** 본진에서 채굴 기술을 올린다 */
export function upgradeMining(state) {
    const sv = state.survival;
    if (!sv || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    if (!sv.base || sv.base.build) return { ok: false, reason: '본진을 다 지은 뒤에 올릴 수 있습니다.' };
    const next = nextMineTech(sv);
    if (!next) return { ok: false, reason: '채굴 기술을 모두 익혔습니다.' };
    if (state.gold < next.cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= next.cost;
    sv.mineTech++;
    state.events.push({ type: 'mineTech', level: sv.mineTech, x: sv.base.x, z: sv.base.z });
    return { ok: true, level: sv.mineTech };
}

/** 밤 시계가 흐르는 동안 payEvery초마다 광맥 위 광산이 골드를 캔다 (짓는 중인 광산은 아직) */
export function payMines(state, dt, incomeOf) {
    const sv = state.survival;
    sv.payT -= dt;
    if (sv.payT > 0) return;
    sv.payT += sv.payEvery;
    const tech = mineTechMul(sv);
    for (const t of state.towers) {
        if (t.type !== 'mine' || t.veinId == null || t.build) continue;
        const v = sv.field.veins[t.veinId];
        const amount = Math.round(incomeOf(t) * (v.yield ?? 1) * (sv.cfg.mineMul ?? 1) * tech);
        if (!amount) continue;
        state.gold += amount;
        state.stats.mined = (state.stats.mined || 0) + amount;
        state.events.push({ type: 'income', towerId: t.id, x: t.x, z: t.z, amount });
    }
}

// ---------- 탐험 안개 ----------

/** 생존자·건물 둘레를 밝힌다. 0.2초마다 (force면 바로). 안개 속 적은 e.fogged */
export function updateFog(state, force = false, dt = 0) {
    const sv = state.survival;
    const fog = sv.fog;
    fog.t -= dt;
    if (!force && fog.t > 0) return;
    fog.t = 0.2;
    const f = sv.field;
    const vis = fog.visible.fill(0);
    const T = f.T;
    const src = (x, z, r) => revealCircle(f, vis, (x + f.half) / T, (z + f.half) / T, r);
    if (sv.base) src(sv.base.x, sv.base.z, VISION.base);
    for (const t of state.towers) {
        if (!t.cell) continue;
        src(t.x, t.z, t.type === 'wall' ? VISION.wall : t.type === 'mine' ? VISION.mine : VISION.tower);
    }
    for (const w of sv.workers) if (w.alive) src(w.x, w.z, VISION.worker);
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

/** 이 자리를 탐험했는가 */
export function isExplored(state, x, z) {
    const sv = state.survival;
    const k = sv.field.cellAt(x, z);
    return k >= 0 && sv.fog.explored[k] === 1;
}

// ---------- 비탈 봉쇄 ----------

/**
 * 비탈 n이 건물로 막혔는가: 통로 아래 끝 빈 칸에서 통로 칸만 따라(이동 규칙대로) 위 끝에 닿지 못하면 막힌 것.
 * (통로 양옆은 절벽이라 통로를 가로지르는 한 줄이면 막힌다)
 */
export function rampSealed(sv, n) {
    const r = sv.field.ramps[n];
    const seen = new Set();
    const q = [];
    for (const k of r.rows[RAMP_LEN - 1])
        if (sv.occ[k] === 0) {
            seen.add(k);
            q.push(k);
        }
    const top = new Set(r.rows[0]);
    const N = sv.field.N;
    while (q.length) {
        const k = q.pop();
        if (top.has(k)) return false;
        const i = k % N;
        const j = (k - i) / N;
        for (const [di, dj] of NB) {
            const nk = (j + dj) * N + i + di;
            if (seen.has(nk) || sv.field.rampOf[nk] !== n || !canStep(sv, k, nk)) continue;
            seen.add(nk);
            q.push(nk);
        }
    }
    return true;
}

/** 모든 비탈의 봉쇄 상태 (건물이 바뀔 때만 다시 잰다) */
export function rampStates(sv) {
    if (sv.seal.ver !== sv.buildVer) {
        sv.seal.ver = sv.buildVer;
        for (let n = 0; n < sv.field.ramps.length; n++) sv.seal.sealed[n] = rampSealed(sv, n) ? 1 : 0;
    }
    return sv.seal.sealed;
}

// ---------- 생존자 ----------

/**
 * A* 길 찾기 (생존자): start 칸에서 goals(Set) 중 하나까지, 이동 규칙을 지키는 칸 목록 (start 제외).
 * 닿을 수 없으면 null. (ti, tj)는 거리 어림의 기준점. door: 방벽을 문처럼 지나간다 (생존자)
 */
export function findPath(sv, start, goals, ti, tj, door = true) {
    const f = sv.field;
    const { N } = f;
    if (goals.has(start)) return [];
    const P = sv.path;
    P.stamp++;
    if (P.stamp > 4e9) {
        P.seen.fill(0);
        P.stamp = 1;
    }
    const stamp = P.stamp;
    const g = P.g;
    const from = P.from;
    const seen = P.seen;
    const h = (k) => {
        const i = k % N;
        const j = (k - i) / N;
        const dx = Math.abs(i - ti);
        const dy = Math.abs(j - tj);
        return (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) * 0.98;
    };
    const heap = new MinHeap();
    seen[start] = stamp;
    g[start] = 0;
    from[start] = -1;
    heap.push(start, h(start));
    let found = -1;
    let n = 0;
    while (heap.size && n++ < N * N * 2) {
        const k = heap.top();
        heap.pop();
        if (goals.has(k)) {
            found = k;
            break;
        }
        const i = k % N;
        const j = (k - i) / N;
        for (const [di, dj, c] of NB) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
            const nk = nj * N + ni;
            if (!canStep(sv, k, nk, door)) continue;
            const ng = g[k] + c;
            if (seen[nk] === stamp && ng >= g[nk]) continue;
            seen[nk] = stamp;
            g[nk] = ng;
            from[nk] = k;
            heap.push(nk, ng + h(nk));
        }
    }
    if (found < 0) return null;
    const out = [];
    for (let k = found; k !== start; k = from[k]) out.push(k);
    return out.reverse();
}

/** 건물 둘레(손이 닿는 칸들): 발자국(cw×ch) 바깥 r번째 겹의 빈 칸 (방벽 칸은 서는 자리로 치지 않는다) */
function ringCells(sv, i, j, cw, ch, r = 1) {
    const f = sv.field;
    const out = new Set();
    for (let dj = -r; dj < ch + r; dj++)
        for (let di = -r; di < cw + r; di++) {
            if (di > -r && di < cw + r - 1 && dj > -r && dj < ch + r - 1) continue;
            const ci = i + di;
            const cj = j + dj;
            if (!f.inside(ci, cj)) continue;
            const k = cj * f.N + ci;
            if (freeCell(sv, k)) out.add(k);
        }
    return out;
}

function footRect(o) {
    return { cell: { i: o.i, j: o.j, s: o.s, cw: o.cw ?? o.s, ch: o.ch ?? o.s } };
}

/** 주문의 생존자 (지정하지 않으면 처음 생존자) */
function workerOf(sv, w) {
    return w ?? sv.worker;
}

/**
 * 주문을 하나 넣는다. queue: false = 지금 하던 일과 줄을 버리고, true = 줄 끝에,
 * 'front' = 지금 하던 일 바로 다음에 (급한 수리)
 */
function pushOrder(state, order, queue, w) {
    const sv = state.survival;
    order.id = sv.orderId++;
    order.wid = w.id;
    if (!queue) cancelOrders(state, w);
    if (!w.order) {
        w.order = order;
        w.path = null;
    } else if (queue === 'front') w.queue.unshift(order);
    else w.queue.push(order);
    return order;
}

/** 생존자에게 이동 명령 (w: 생존자, 없으면 처음 생존자) */
export function orderMove(state, x, z, queue = false, w = null) {
    const sv = state.survival;
    w = workerOf(sv, w);
    if (!w.alive) return { ok: false, reason: '생존자가 쓰러져 있습니다.' };
    const k = sv.field.cellAt(x, z);
    if (k < 0) return { ok: false, reason: '갈 수 없는 곳입니다.' };
    const o = pushOrder(state, { type: 'move', x, z }, queue, w);
    return { ok: true, order: o };
}

/**
 * 생존자에게 건설 명령: 자리를 확인하고 값을 미리 치른 뒤(예약), 생존자가 그 자리에 가서 짓는다.
 * 주문이 취소되거나 지을 수 없게 되면 돌려받는다. 방벽은 (i, j)가 속한 비탈 입구 전체로 맞춘다.
 */
export function orderBuild(state, type, i, j, queue = false, w = null) {
    const sv = state.survival;
    w = workerOf(sv, w);
    if (state.status !== 'playing') return { ok: false, reason: '게임이 끝났습니다.' };
    if (!w.alive) return { ok: false, reason: '생존자가 쓰러져 있습니다.' };
    if (type !== 'base' && !TOWERS[type]) return { ok: false, reason: '잘못된 명령입니다.' };
    const chk = checkPlacement(state, type, i, j, { plan: true });
    if (!chk.ok) return { ok: false, reason: chk.reason };
    const cost = type === 'base' ? 0 : TOWERS[type].tiers[0].cost;
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    const { size: s, cw, ch } = chk;
    const o = {
        type: 'build',
        btype: type,
        i: chk.i,
        j: chk.j,
        s,
        cw,
        ch,
        cost,
        vein: chk.vein,
        started: false,
        wait: 0
    };
    // 예약은 주문 번호가 정해진 뒤에 (지금 하던 일을 버리면 그 값은 돌려받는다)
    const placed = pushOrder(state, o, queue, w);
    state.gold -= cost;
    for (let dj = 0; dj < ch; dj++)
        for (let di = 0; di < cw; di++) sv.reserved[(o.j + dj) * sv.field.N + o.i + di] = o.id;
    sv.planVer = (sv.planVer || 0) + 1;
    return { ok: true, order: placed };
}

/** 생존자에게 수리·건설 재개 명령 (target: 타워 객체 또는 본진) */
export function orderRepair(state, target, queue = false, w = null) {
    const sv = state.survival;
    w = workerOf(sv, w);
    if (!w.alive) return { ok: false, reason: '생존자가 쓰러져 있습니다.' };
    if (!target) return { ok: false, reason: '잘못된 명령입니다.' };
    const base = target === sv.base;
    if (!target.build) {
        const full = base ? state.lives >= state.maxLives : target.hp >= target.maxHp;
        if (full) return { ok: false, reason: '수리할 곳이 없습니다.' };
    }
    const o = pushOrder(state, { type: 'repair', target, base }, queue, w);
    return { ok: true, order: o };
}

function unreserve(sv, o) {
    const N = sv.field.N;
    const cw = o.cw ?? o.s;
    const ch = o.ch ?? o.s;
    for (let dj = 0; dj < ch; dj++)
        for (let di = 0; di < cw; di++) {
            const k = (o.j + dj) * N + o.i + di;
            if (sv.reserved[k] === o.id) sv.reserved[k] = 0;
        }
    sv.planVer = (sv.planVer || 0) + 1;
}

/** 생존자의 주문을 모두 거둔다 (w 없으면 모든 생존자): 아직 짓기 시작하지 않은 건설은 값을 돌려준다 */
export function cancelOrders(state, w = null) {
    const sv = state.survival;
    let refund = 0;
    for (const c of w ? [w] : sv.workers) {
        for (const o of [c.order, ...c.queue]) {
            if (!o || o.type !== 'build' || o.started) continue;
            unreserve(sv, o);
            refund += o.cost;
        }
        c.order = null;
        c.queue.length = 0;
        c.path = null;
        c.task = 'idle';
    }
    state.gold += refund;
    return refund;
}

/** 다음 주문으로 */
function nextOrder(w) {
    w.order = w.queue.shift() ?? null;
    w.path = null;
    w.wait = 0;
}

/** 주문을 못 하게 됐다: 값을 돌려주고 알린다 */
function failOrder(state, w, o, reason) {
    const sv = state.survival;
    if (o.type === 'build' && !o.started) {
        unreserve(sv, o);
        state.gold += o.cost;
    }
    state.events.push({ type: 'workerFail', reason, wid: w.id });
    nextOrder(w);
}

/** 생존자가 맞는다 (w 없으면 처음 생존자). 쓰러지면 본진에서 다시 살아나고, 본진도 산 생존자도 없으면 패배 */
export function hurtWorker(state, amount, w = null) {
    const sv = state.survival;
    w = workerOf(sv, w);
    if (!w.alive || state.status !== 'playing') return;
    w.hp -= amount;
    w.hitT = state.time;
    if (w.hp > 0) return;
    w.hp = 0;
    w.alive = false;
    w.respawnT = WORKER.respawn;
    // 짓기 시작하지 않은 주문은 돌려받는다
    cancelOrders(state, w);
    state.events.push({ type: 'workerDied', x: w.x, z: w.z, respawn: !!sv.base, wid: w.id });
    if (!sv.base && !sv.workers.some((c) => c.alive)) {
        state.status = 'lost';
        state.events.push({ type: 'defeat', reason: 'worker' });
    }
}

/**
 * 손이 닿는가: 건물 사각형까지 거리가 가깝거나, 건물 둘레 두 겹 안 칸에 서 있다
 * (두 줄로 쌓은 건물의 바깥도 안쪽에서 고칠 수 있게)
 */
function within(sv, w, b) {
    if (rectDist(sv, b, w.x, w.z) <= WORKER.reach) return true;
    const f = sv.field;
    const k = f.cellAt(w.x, w.z);
    const ci = k % f.N;
    const cj = Math.floor(k / f.N);
    const { i, j } = b.cell;
    const [cw, ch] = cellDims(b.cell);
    return ci >= i - 2 && ci <= i + cw + 1 && cj >= j - 2 && cj <= j + ch + 1;
}

/**
 * 목표 칸 집합으로 걷는다. 반환: 'arrived' | 'moving' | 'fail'
 * key: 같은 목표를 계속 쫓는지 (바뀌면 길을 다시 찾는다)
 */
function walkTo(state, w, dt, goalsFn, ti, tj, key) {
    const sv = state.survival;
    const f = sv.field;
    const here = f.cellAt(w.x, w.z);
    if (!w.path || w.pathKey !== key || w.pathVer !== sv.buildVer) {
        // 목표 칸 집합을 차례로 (가까운 겹부터): 닿는 첫 집합으로 간다
        const sets = [].concat(goalsFn());
        w.path = null;
        for (const goals of sets) {
            if (!goals.size) continue;
            w.path = goals.has(here) ? [] : findPath(sv, here, goals, ti, tj);
            if (w.path) break;
        }
        if (!w.path) return 'fail';
        w.pathI = 0;
        w.pathKey = key;
        w.pathVer = sv.buildVer;
    }
    let step = WORKER.speed * dt;
    while (step > 1e-6) {
        if (w.pathI >= w.path.length) return 'arrived';
        const next = w.path[w.pathI];
        const c = f.toWorld(next % f.N, Math.floor(next / f.N), _c);
        const dx = c.x - w.x;
        const dz = c.z - w.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-4) {
            w.dirX = dx / d;
            w.dirZ = dz / d;
        }
        const m = Math.min(step, d);
        if (!stepTo(sv, w, w.x + (dx / (d || 1)) * m, w.z + (dz / (d || 1)) * m)) {
            // 길이 막혔다 (방금 지은 건물): 다시 찾는다
            w.path = null;
            return 'moving';
        }
        step -= m;
        if (m >= d - 1e-6) w.pathI++;
    }
    return w.pathI >= w.path.length ? 'arrived' : 'moving';
}

/**
 * 생존자들 한 틱: 저마다 주문을 차례로 한다. hooks: { place(type, i, j, order) → { ok, reason, building },
 * repairCostPerHp(tower), finish(building) }
 */
export function updateWorker(state, dt, hooks) {
    const sv = state.survival;
    for (const w of sv.workers) {
        if (state.status !== 'playing') return;
        tickWorker(state, w, dt, hooks);
    }
}

function tickWorker(state, w, dt, hooks) {
    const sv = state.survival;
    const f = sv.field;
    if (!w.alive) {
        if (!sv.base) return;
        w.respawnT -= dt;
        if (w.respawnT > 0) return;
        // 본진 곁 빈 칸에서 다시 살아난다
        const b = sv.base;
        const ring = [...ringCells(sv, b.i, b.j, b.s, b.s)];
        const k = ring[(w.id - 1) % Math.max(1, ring.length)] ?? nearestFree(sv, f.cellAt(b.x, b.z), 6);
        const p = f.toWorld(k % f.N, Math.floor(k / f.N));
        Object.assign(w, { x: p.x, z: p.z, sx: p.x, sz: p.z, lastK: k, hp: w.maxHp, alive: true, path: null });
        state.events.push({ type: 'workerRespawn', x: p.x, z: p.z, wid: w.id });
        return;
    }
    if (!w.order && w.queue.length) nextOrder(w);
    const o = w.order;
    if (!o) {
        w.task = 'idle';
        return;
    }
    if (o.type === 'move') {
        w.task = 'move';
        const tk = f.cellAt(o.x, o.z);
        const r = walkTo(state, w, dt, () => new Set([nearestFree(sv, tk, 5)]), tk % f.N, Math.floor(tk / f.N), o);
        if (r === 'arrived') nextOrder(w);
        else if (r === 'fail') failOrder(state, w, o, '그곳으로 갈 길이 없습니다.');
        return;
    }
    if (o.type === 'build') {
        // 짓기 시작한 건물이 무너졌으면 끝
        if (o.started && !buildingAlive(state, o.target)) return nextOrder(w);
        const rect = o.started ? o.target : footRect(o);
        const cw = o.cw ?? o.s;
        const ch = o.ch ?? o.s;
        const inFoot = !o.started && inRect(f, w, o.i, o.j, cw, ch);
        if (!within(sv, w, rect) || inFoot) {
            w.task = 'move';
            const r = walkTo(
                state,
                w,
                dt,
                () => [ringCells(sv, o.i, o.j, cw, ch), ringCells(sv, o.i, o.j, cw, ch, 2)],
                o.i + cw / 2,
                o.j + ch / 2,
                o
            );
            if (r === 'fail') failOrder(state, w, o, '지을 자리로 갈 길이 없습니다.');
            return;
        }
        w.path = null;
        if (!o.started) {
            const chk = checkPlacement(state, o.btype, o.i, o.j, { order: o.id });
            if (!chk.ok) {
                // 적이 서 있으면 비킬 때까지 기다린다. 다른 까닭이면 포기
                if (/적이 있는/.test(chk.reason) && (o.wait += dt) < 12) {
                    w.task = 'wait';
                    return;
                }
                return failOrder(state, w, o, chk.reason);
            }
            unreserve(sv, o);
            const r = hooks.place(o.btype, o.i, o.j, o);
            if (!r.ok) {
                state.gold += o.cost;
                state.events.push({ type: 'workerFail', reason: r.reason, wid: w.id });
                return nextOrder(w);
            }
            o.started = true;
            o.target = r.building;
        }
        // 짓는다 (여럿이 함께 지으면 그만큼 빨리 오른다)
        w.task = 'build';
        const b = o.target;
        faceTo(w, b);
        const bt = b.build;
        if (!bt) return nextOrder(w);
        const before = bt.t;
        bt.t = Math.min(bt.T, bt.t + dt);
        const frac = (bt.t - before) / bt.T;
        if (b === sv.base) state.lives = Math.min(state.maxLives, state.lives + state.maxLives * 0.8 * frac);
        else b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.85 * frac);
        if (bt.t >= bt.T) {
            delete b.build;
            hooks.finish(b);
            nextOrder(w);
        }
        return;
    }
    if (o.type === 'repair') {
        const b = o.target;
        if (!buildingAlive(state, b)) return nextOrder(w);
        // 짓다 만 건물이면 마저 짓는다
        if (b.build) {
            const [cw, ch] = cellDims(b.cell);
            o.type = 'build';
            o.started = true;
            o.btype = b === sv.base ? 'base' : b.type;
            o.i = b.cell.i;
            o.j = b.cell.j;
            o.s = b.cell.s;
            o.cw = cw;
            o.ch = ch;
            o.cost = 0;
            return;
        }
        if (!within(sv, w, b)) {
            w.task = 'move';
            const { i, j } = b.cell;
            const [cw, ch] = cellDims(b.cell);
            const r = walkTo(
                state,
                w,
                dt,
                () => [ringCells(sv, i, j, cw, ch), ringCells(sv, i, j, cw, ch, 2)],
                i + cw / 2,
                j + ch / 2,
                o
            );
            if (r === 'fail') failOrder(state, w, o, '수리할 건물로 갈 길이 없습니다.');
            return;
        }
        w.path = null;
        w.task = 'repair';
        faceTo(w, b);
        const base = b === sv.base;
        const max = base ? state.maxLives : b.maxHp;
        const cur = base ? state.lives : b.hp;
        if (cur >= max) return nextOrder(w);
        const gain = Math.min(max - cur, max * (base ? WORKER.repairBase : WORKER.repair) * dt);
        const perHp = base ? BASE_REPAIR : hooks.repairCostPerHp(b);
        w.debt += gain * perHp;
        const pay = Math.floor(w.debt);
        if (pay > 0) {
            if (state.gold < pay) {
                state.events.push({ type: 'workerFail', reason: '골드가 부족해 수리를 멈췄습니다.', wid: w.id });
                return nextOrder(w);
            }
            state.gold -= pay;
            w.debt -= pay;
            state.stats.repaired = (state.stats.repaired || 0) + pay;
        }
        if (base) state.lives = Math.min(max, cur + gain);
        else b.hp = Math.min(max, cur + gain);
        b.repairT = state.time;
        if (cur + gain >= max - 1e-6) {
            state.events.push({ type: 'repair', towerId: base ? null : b.id, base, x: b.x, z: b.z, cost: 0 });
            nextOrder(w);
        }
    }
}

function buildingAlive(state, b) {
    if (!b) return false;
    return b === state.survival.base || state.towers.includes(b);
}

function inRect(f, w, i, j, cw, ch) {
    const k = f.cellAt(w.x, w.z);
    const ci = k % f.N;
    const cj = Math.floor(k / f.N);
    return ci >= i && ci < i + cw && cj >= j && cj < j + ch;
}

function faceTo(w, b) {
    const dx = b.x - w.x;
    const dz = b.z - w.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-3) {
        w.dirX = dx / d;
        w.dirZ = dz / d;
    }
}

/** 생존자 주문 목록 (지금 + 줄). w 없으면 모든 생존자의 주문: UI가 예정 건물을 그릴 때 */
export function workerOrders(sv, w = null) {
    const out = [];
    for (const c of w ? [w] : sv.workers) {
        if (c.order) out.push(c.order);
        for (const o of c.queue) out.push(o);
    }
    return out;
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
