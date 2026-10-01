// 살아남기(공성전 전용 맵 장르, 스타크래프트 유즈맵 '산에서 살아남기' 류).
// - 정해진 길이 없다. 적은 산 아래 동굴(caves)에서 나와 '걸어서 가장 가까운' 건물(타워·광산·본진)을 찾아가 부순다.
// - 플레이어는 산 중턱 본진에서 시작해, 광맥(vein) 소켓에 광산을 지어 터를 넓힌다. 광산은 시간마다 골드를 캔다.
// - 본진(수정)이 무너지면 패배, 동이 틀 때(dawn초)까지 버티면 승리. 웨이브는 밤 시계(clock)에 맞춰 저절로 온다.
//
// 이동: 산 지형(mountain.js)을 격자로 나눠, 모든 건물을 출발점으로 하는 거리장(흐름장)을 한 번에 구한다.
// 땅 위의 적은 거리장이 줄어드는 쪽으로 걸으면 가장 가까운 건물에 닿는다. 건물이 생기거나 무너질 때만 다시 구한다.
// 하늘을 나는 적은 지형을 무시하고 가장 가까운 건물로 곧장 날아간다.
import { createLayout, createNavGrid } from './mountain.js';

export const SURVIVAL_DEFAULTS = {
    dawn: 600,
    // 광산이 골드를 캐는 간격(초)
    payEvery: 15,
    cell: 0.5,
    // 본진(수정) 크기 (체력은 맵의 lives)
    baseR: 1.5
};

/** 건물 크기(반지름): 적이 이만큼 떨어진 곳에서 멈춰 공격한다 */
export const TOWER_R = 0.6;
/** 적의 근접 공격 간격(초)과 공격력 배율 */
export const SURV_RATE = 1.5;
export const SURV_DMG = 0.6;
/** 본진 수리비: 잃은 체력 1당 골드 */
export const BASE_REPAIR = 0.4;
/** 고지대 사거리: 높이 1당 +5% */
export const HEIGHT_RANGE = 0.05;

function config(cfg) {
    return { ...SURVIVAL_DEFAULTS, ...cfg };
}

// ---------- 생성 ----------

/** 맵 정의에서 소켓 목록을 만든다: 일반 소켓(pads) + 광맥(veins) */
export function survivalSockets(cfg) {
    const pads = cfg.pads.map(([x, z]) => [x, z]);
    const veins = cfg.veins.map((v) => v.at);
    const sockets = [...pads, ...veins];
    // 같은 고원 위에서 가까운 소켓끼리 공명으로 잇는다
    const layout = createLayout(cfg);
    const site = sockets.map(([x, z]) => layout.ground(x, z).plateau?.id ?? null);
    const links = [];
    for (let a = 0; a < sockets.length; a++)
        for (let b = a + 1; b < sockets.length; b++) {
            const d = Math.hypot(sockets[a][0] - sockets[b][0], sockets[a][1] - sockets[b][1]);
            if (d <= (cfg.linkDist ?? 2.25) && site[a] === site[b]) links.push([a, b]);
        }
    return { sockets, links };
}

/** 동굴 → 본진을 잇는 직선 (렌더러·카메라 인트로가 쓰는 대표 경로. 적은 이 길을 따르지 않는다) */
export function survivalPaths(cfg) {
    const base = cfg.base.at;
    return cfg.caves.map((c) => {
        const p = cfg.plateaus.find((q) => q.id === c.id).at;
        return [p, [(p[0] + base[0]) / 2, (p[1] + base[1]) / 2], base];
    });
}

export function createSurvival(map, state) {
    const c = config(map.survival);
    const layout = createLayout(c);
    const nav = createNavGrid(layout, map.island, c.cell);
    const caves = c.caves.map((cv) => {
        const p = layout.byId[cv.id];
        return { ...cv, x: p.x, z: p.z };
    });
    const base = { x: c.base.at[0], z: c.base.at[1], r: c.baseR };
    // 소켓마다 높이·광맥·터 이름
    const padCount = c.pads.length;
    for (const s of state.sockets) {
        const g = layout.ground(s.x, s.z);
        s.h = g.h;
        s.site = g.plateau?.id ?? null;
        if (s.id >= padCount) s.vein = { ...c.veins[s.id - padCount] };
    }
    const n = nav.w * nav.h;
    return {
        dawn: c.dawn,
        clock: 0,
        dawned: false,
        payEvery: c.payEvery,
        payT: c.payEvery,
        layout,
        nav,
        caves,
        base,
        // 거리장은 Float64: Float32로 반올림하면 힙에서 꺼낸 값과 어긋나 탐색이 끊긴다
        flow: new Float64Array(n),
        pot: new Float32Array(n),
        flowDirty: true,
        flowBuilds: 0
    };
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

/** 모든 건물(타워·본진)을 출발점으로 걸어서 잰 거리장. 막힌 칸(바위)은 둘레보다 높게 채워 벽에서 밀어낸다 */
export function computeFlow(state) {
    const sv = state.survival;
    const { nav } = sv;
    const { w, h, walk, cell } = nav;
    const dist = sv.flow.fill(Infinity);
    const heap = new MinHeap();
    const seed = (x, z, r) => {
        const R = Math.ceil(r / cell) + 1;
        const ci = Math.floor((x - nav.x0) / cell);
        const cj = Math.floor((z - nav.z0) / cell);
        let any = false;
        for (let j = cj - R; j <= cj + R; j++)
            for (let i = ci - R; i <= ci + R; i++) {
                if (i < 0 || j < 0 || i >= w || j >= h) continue;
                const k = j * w + i;
                const cx = nav.x0 + (i + 0.5) * cell;
                const cz = nav.z0 + (j + 0.5) * cell;
                if (Math.hypot(cx - x, cz - z) > r) continue;
                any = true;
                if (dist[k] > 0) {
                    dist[k] = 0;
                    heap.push(k, 0);
                }
            }
        // 건물이 칸보다 작아 한 칸도 안 걸리면 가장 가까운 칸 하나
        if (!any && ci >= 0 && cj >= 0 && ci < w && cj < h) {
            dist[cj * w + ci] = 0;
            heap.push(cj * w + ci, 0);
        }
    };
    seed(sv.base.x, sv.base.z, sv.base.r);
    for (const t of state.towers) seed(t.x, t.z, TOWER_R);
    while (heap.size) {
        const [k, d] = heap.pop();
        if (d > dist[k]) continue;
        const i = k % w;
        const j = (k - i) / w;
        for (const [di, dj, c] of NB) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
            const nk = nj * w + ni;
            if (!walk[nk]) continue;
            // 대각선은 양옆이 모두 열려 있어야 지나간다 (바위 모서리를 뚫지 않게)
            if (c > 1 && (!walk[j * w + ni] || !walk[nj * w + i])) continue;
            const nd = d + c * cell;
            if (nd < dist[nk]) {
                dist[nk] = nd;
                heap.push(nk, nd);
            }
        }
    }
    // 보간용 퍼텐셜: 막힌 칸은 이웃한 걸을 수 있는 칸보다 조금 높게
    const pot = sv.pot;
    for (let k = 0; k < w * h; k++) {
        if (walk[k] && dist[k] < Infinity) {
            pot[k] = dist[k];
            continue;
        }
        const i = k % w;
        const j = (k - i) / w;
        let m = Infinity;
        for (const [di, dj] of NB) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
            const nk = nj * w + ni;
            if (walk[nk] && dist[nk] < m) m = dist[nk];
        }
        pot[k] = m < Infinity ? m + cell * 2.5 : 999;
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
        const top = [k[0], v[0]];
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
        return top;
    }
}

/** 퍼텐셜을 쌍선형 보간 (격자 칸 중심 기준) */
function potAt(sv, x, z) {
    const { nav, pot } = sv;
    const { w, h, cell } = nav;
    const fi = (x - nav.x0) / cell - 0.5;
    const fj = (z - nav.z0) / cell - 0.5;
    const i = Math.max(0, Math.min(w - 2, Math.floor(fi)));
    const j = Math.max(0, Math.min(h - 2, Math.floor(fj)));
    const tx = Math.max(0, Math.min(1, fi - i));
    const tz = Math.max(0, Math.min(1, fj - j));
    const k = j * w + i;
    const a = pot[k] + (pot[k + 1] - pot[k]) * tx;
    const b = pot[k + w] + (pot[k + w + 1] - pot[k + w]) * tx;
    return a + (b - a) * tz;
}

/** 이 자리에서 가장 가까운 건물 쪽으로 걸어갈 방향 (단위 벡터) */
export function flowDir(state, x, z, out = {}) {
    const sv = state.survival;
    if (sv.flowDirty) computeFlow(state);
    const e = 0.3;
    const gx = potAt(sv, x + e, z) - potAt(sv, x - e, z);
    const gz = potAt(sv, x, z + e) - potAt(sv, x, z - e);
    const len = Math.hypot(gx, gz);
    if (len > 1e-4) {
        out.x = -gx / len;
        out.z = -gz / len;
        return out;
    }
    // 평평하면 가장 낮은 이웃 칸으로
    const { nav, flow } = sv;
    const k = nav.index(x, z);
    out.x = 0;
    out.z = 0;
    if (k < 0) return out;
    let best = flow[k];
    const i = k % nav.w;
    const j = (k - i) / nav.w;
    for (const [di, dj] of NB) {
        const nk = (j + dj) * nav.w + i + di;
        if (nk < 0 || nk >= flow.length) continue;
        if (flow[nk] < best) {
            best = flow[nk];
            const l = Math.hypot(di, dj);
            out.x = di / l;
            out.z = dj / l;
        }
    }
    return out;
}

/** 가장 가까운 건물까지 걸어서 남은 거리 */
export function flowDistance(state, x, z) {
    const sv = state.survival;
    if (sv.flowDirty) computeFlow(state);
    return potAt(sv, x, z);
}

export function isWalkable(state, x, z) {
    return state.survival.nav.walkable(x, z);
}

// ---------- 건물 ----------

/** 적이 노릴 수 있는 건물: 타워(광산·병영 포함)와 본진 */
function nearestInReach(state, e) {
    const sv = state.survival;
    const pad = e.def.boss ? 0.55 : 0.3;
    const b = sv.base;
    let best = null;
    let bd = Infinity;
    const db = Math.hypot(b.x - e.x, b.z - e.z) - b.r;
    if (db <= e.radius + pad) {
        best = b;
        bd = db;
    }
    for (const t of state.towers) {
        const d = Math.hypot(t.x - e.x, t.z - e.z) - TOWER_R;
        if (d <= e.radius + pad && d < bd) {
            bd = d;
            best = t;
        }
    }
    return best;
}

/** 하늘의 적: 곧장 날아갈 가장 가까운 건물 */
function nearestStructure(state, x, z) {
    const b = state.survival.base;
    let best = b;
    let bd = Math.hypot(b.x - x, b.z - z) - b.r;
    for (const t of state.towers) {
        const d = Math.hypot(t.x - x, t.z - z) - TOWER_R;
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

/**
 * 살아남기에서 적 한 마리의 이동·공격 (붙잡히거나 기절한 경우는 game.js가 먼저 걸러낸다).
 * hooks: { damageTower(tower, amount), damageBase(amount) } — 순환 의존을 피하려고 game.js가 넘긴다.
 */
export function updateSurvivalEnemy(state, e, sp, dt, hooks) {
    const target = e.burrowT > 0 ? null : nearestInReach(state, e);
    if (target) {
        e.atkTargetId = isBase(state, target) ? 'base' : target.id;
        attack(state, e, target, dt, hooks);
        return;
    }
    e.atkTargetId = null;
    if (e.def.flying) {
        e.retargetT = (e.retargetT ?? 0) - dt;
        if (e.retargetT <= 0 || !e.flyTarget || (e.flyTarget.id != null && !state.towers.includes(e.flyTarget))) {
            e.retargetT = 0.5;
            e.flyTarget = nearestStructure(state, e.x, e.z).target;
        }
        const t = e.flyTarget;
        const dx = t.x - e.x;
        const dz = t.z - e.z;
        const len = Math.hypot(dx, dz) || 1;
        steer(e, dx / len, dz / len, dt);
        e.x += e.dirX * sp * dt;
        e.z += e.dirZ * sp * dt;
        e.d = 200 - len;
        return;
    }
    flowDir(state, e.x, e.z, _d);
    steer(e, _d.x, _d.z, dt);
    walk(state, e, e.dirX * sp * dt, e.dirZ * sp * dt);
    e.d = 200 - flowDistance(state, e.x, e.z);
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

/** 걸을 수 있는 칸 안에서만 움직인다. 막히면 벽을 따라 미끄러진다 */
function walk(state, e, mx, mz) {
    const nav = state.survival.nav;
    if (nav.walkable(e.x + mx, e.z + mz)) {
        e.x += mx;
        e.z += mz;
    } else if (nav.walkable(e.x + mx, e.z)) e.x += mx;
    else if (nav.walkable(e.x, e.z + mz)) e.z += mz;
}

function attack(state, e, target, dt, hooks) {
    // 공격하는 동안 목표를 바라본다
    const dx = target.x - e.x;
    const dz = target.z - e.z;
    const len = Math.hypot(dx, dz) || 1;
    steer(e, dx / len, dz / len, dt);
    e.atkCd -= dt;
    if (e.atkCd > 0) return;
    e.atkCd = e.def.boss ? 2.2 : SURV_RATE;
    const base = isBase(state, target);
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
    if (base) hooks.damageBase(amount);
    else hooks.damageTower(target, amount);
}

/** 적끼리 겹치지 않게 살짝 밀어낸다 (땅 위의 적만, 칸 묶음으로 가까운 것끼리만 비교) */
export function separateEnemies(state, dt) {
    const nav = state.survival.nav;
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
        if (nav.walkable(e.x + mx, e.z + mz)) {
            e.x += mx;
            e.z += mz;
        }
    }
}

/** 도약: 흐름장을 따라 dist만큼 앞으로 (건물에 닿으면 멈춘다) */
export function blinkAlong(state, e, dist) {
    if (e.def.flying) {
        const t = nearestStructure(state, e.x, e.z);
        const len = Math.max(0, Math.min(dist, t.dist - e.radius - 0.2));
        e.x += e.dirX * len;
        e.z += e.dirZ * len;
        return;
    }
    for (let s = 0; s < dist; s += 0.25) {
        if (nearestInReach(state, e)) break;
        flowDir(state, e.x, e.z, _d);
        const nx = e.x + _d.x * 0.25;
        const nz = e.z + _d.z * 0.25;
        if (!state.survival.nav.walkable(nx, nz)) break;
        e.x = nx;
        e.z = nz;
    }
}

/** 동굴에서 나올 자리 (그룹이 고른 동굴, 개체마다 결정적으로 흩뜨린다) */
export function spawnPoint(state, grp, id) {
    const caves = state.survival.caves;
    let cave;
    if (grp.cave != null) cave = caves.find((c) => c.id === grp.cave) || caves[0];
    else {
        const pool = grp.caves ? caves.filter((c) => grp.caves.includes(c.id)) : caves;
        cave = pool[id % pool.length];
    }
    const a = id * 2.399963;
    const r = 0.25 + ((id * 0.618034) % 1) * 0.45;
    return { x: cave.x + Math.cos(a) * r, z: cave.z + Math.sin(a) * r, cave: cave.id };
}

// ---------- 광산 ----------

/** 밤 시계가 흐르는 동안 payEvery초마다 광맥 위 광산이 골드를 캔다. hooks.income(tower) → 기본 수입 */
export function payMines(state, dt, incomeOf) {
    const sv = state.survival;
    sv.payT -= dt;
    if (sv.payT > 0) return;
    sv.payT += sv.payEvery;
    for (const t of state.towers) {
        const s = state.sockets[t.socketId];
        if (!s.vein) continue;
        const amount = Math.round(incomeOf(t) * (s.vein.yield ?? 1));
        if (!amount) continue;
        state.gold += amount;
        state.stats.mined = (state.stats.mined || 0) + amount;
        state.events.push({ type: 'income', towerId: t.id, x: t.x, z: t.z, amount });
    }
}

/** 소켓에 지을 수 있는 타워 종류: 광맥에는 광산만, 그 밖에는 광산을 뺀 나머지 */
export function allowedHere(state, socket, type) {
    if (!state.survival) return true;
    return socket.vein ? type === 'mine' : type !== 'mine';
}

// ---------- 웨이브 안내 ----------

/** 웨이브가 나올 동굴 id 목록 (중복 없음) */
export function waveCaves(state, wave) {
    const all = state.survival.caves.map((c) => c.id);
    const out = new Set();
    for (const g of wave.groups) {
        if (g.cave != null) out.add(g.cave);
        else for (const id of g.caves || all) out.add(id);
    }
    return all.filter((id) => out.has(id));
}

/** 웨이브가 나올 동굴을 한 줄로: '서쪽 동굴', '서·남 동굴', '모든 동굴' */
export function caveLabel(state, wave) {
    if (!wave) return '';
    const ids = waveCaves(state, wave);
    const caves = state.survival.caves;
    if (ids.length === caves.length && caves.length > 1) return '모든 동굴';
    const names = ids.map((id) => caves.find((c) => c.id === id).short);
    return names.length === 1 ? `${names[0]}쪽 동굴` : `${names.join('·')} 동굴`;
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
    return { f, night: s(0, 0.75, f), dawn: s(0.92, 1, f), remain: Math.max(0, sv.dawn - sv.clock) };
}

/** 남은 시간을 m:ss로 */
export function formatClock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
