// 살아남기(얼어붙은 분지) 헤드리스 AI: 밸런스 검증과 스크린샷 준비에 함께 쓴다.
// 플레이어처럼 생존자 한 명을 움직인다: 가운데에서 출발 → 고원 하나로 걸어가 탐험 → 본진 → 광산 →
// 비탈마다 큰 방벽 하나(입구 전체) → 그 뒤 고원 위에 타워 → 방벽 2단계 → 남는 광맥·채굴 기술·업그레이드.
// 다친 벽·타워·본진은 생존자를 보내 고치고, 무너진 벽은 다시 짓게 한다. 업그레이드는 그 자리에서 (생존자 없이).
import {
    createGame,
    step,
    drainEvents,
    upgradeTower,
    upgradeMining,
    orderBuild,
    orderMove,
    orderRepair,
    workerOrders,
    TICK
} from '../src/core/game.js';
import { checkPlacement, nextMineTech } from '../src/core/survival.js';
import { TOWERS, MAX_TIER, MAX_MASTERY } from '../src/core/data/towers.js';

const N4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
];

/** 비탈 통로의 (t, l) 칸 */
const rampCell = (r, t, l) => [r.ri + r.d[0] * t + r.p[0] * l, r.rj + r.d[1] * t + r.p[1] * l];

/**
 * 고원의 방어 계획: wall1 = 비탈 통로 위 끝 줄(t=0, 방벽이 덮는 칸), wallAt = 비탈마다 방벽 주문 칸 하나,
 * wall2 = 그 바로 안쪽 고원 칸 한 줄(t=-1, 예전 두 줄 방벽 자리: 지금은 비워 둔다),
 * spots = 벽 앞(통로 바깥 줄)에 사거리가 닿는 고원 위 2×2 타워 자리 (가까운 순, 통로 앞 길목은 비운다),
 * allSpots = 고원 안 어디든 2×2, veins = 고원 안 광맥.
 */
export function sitePlan(state, siteId) {
    const f = state.survival.field;
    const { N } = f;
    const s = f.sites.find((x) => x.id === siteId);
    const ramps = f.ramps.filter((r) => r.owner === siteId);
    const wall1 = ramps.flatMap((r) => r.rows[0]);
    const wallAt = ramps.map((r) => r.rows[0][0]);
    // 안쪽 줄: 위 끝 바로 앞 고원 칸 (통로 폭 그대로. 양옆은 절벽이라 모서리로 새지 못한다)
    const wall2 = ramps.flatMap((r) => {
        const out = [];
        for (let l = r.a; l <= r.b; l++) {
            const [i, j] = rampCell(r, -1, l);
            out.push(j * N + i);
        }
        return out;
    });
    const inRegion = (k) => f.site[k] === s.n && f.walkableKind(k) && f.kind[k] !== 1;
    // 통로 앞 길목 (생존자가 드나들 길): 비워 둔다
    const lane = new Set();
    for (const r of ramps)
        for (let t = -3; t <= -2; t++)
            for (let l = r.a; l <= r.b; l++) {
                const [i, j] = rampCell(r, t, l);
                if (f.inside(i, j)) lane.add(j * N + i);
            }
    // 위 끝에서 잰 거리 (고원 안쪽으로)
    const dist = new Int16Array(N * N).fill(-1);
    const q = [];
    for (const k of wall1) {
        dist[k] = 0;
        q.push(k);
    }
    while (q.length) {
        const k = q.shift();
        const i = k % N;
        const j = (k - i) / N;
        for (const [di, dj] of N4) {
            const nk = (j + dj) * N + i + di;
            if (dist[nk] >= 0 || !(inRegion(nk) || f.rampOf[nk] >= 0)) continue;
            dist[nk] = dist[k] + 1;
            q.push(nk);
        }
    }
    // 적이 벽 앞에 몰려 설 곳: 통로 바깥 두 줄(t=2·3)의 가운데. 타워는 여기에 사거리가 닿는 고원 위에 둔다
    const stage = ramps.map((r) => rampCell(r, 1.5, (r.a + r.b) / 2));
    const spots = [];
    const allSpots = [];
    for (let j = 0; j < N - 1; j++)
        for (let i = 0; i < N - 1; i++) {
            const ks = [j * N + i, j * N + i + 1, (j + 1) * N + i, (j + 1) * N + i + 1];
            if (!ks.every((k) => inRegion(k) && f.vein[k] < 0 && !lane.has(k))) continue;
            allSpots.push({ i, j });
            // 2×2 가운데에서 비탈마다 몰림 자리까지 (타일)
            const ds = stage.map(([si, sj]) => Math.hypot(i + 1 - (si + 0.5), j + 1 - (sj + 0.5)));
            spots.push({ i, j, d: Math.min(...ds), ds });
        }
    spots.sort((a, b) => a.d - b.d);
    const veins = f.veins.filter((v) => v.site === s.n);
    return { site: s, ramps, wall1, wallAt, wall2, spots, allSpots, veins, dist, lane, stage };
}

/**
 * 2×2를 (i, j)에 세워도 본진 곁에서 비탈 위 끝 길목까지 걸어갈 수 있는가 (생존자가 갇히지 않게).
 * 지금 이미 닿지 못하는 비탈은 따지지 않는다 (새 타워가 길을 끊을 때만 막는다)
 */
function keepsPath(state, plan, i, j) {
    const now = rampsReached(state, plan, null);
    const after = rampsReached(state, plan, [i, j]);
    return now.every((r, n) => !r || after[n]);
}

/**
 * 생존자가 서 있는 칸(쓰러졌으면 본진 곁)에서 걸어서 닿는 곳: [비탈마다 위 끝 길목에 닿는가..., 본진 곁에 닿는가].
 * at = 2×2를 세웠다고 칠 자리. 한 덩어리에서 재야 고원이 건물로 둘로 갈라지는 것도 잡는다
 */
function rampsReached(state, plan, at) {
    const sv = state.survival;
    const f = sv.field;
    const N = f.N;
    const b = sv.base;
    if (!b || !plan.ramps.length) return [];
    const blocked = new Set();
    if (at) {
        const [i, j] = at;
        for (const k of [j * N + i, j * N + i + 1, (j + 1) * N + i, (j + 1) * N + i + 1]) blocked.add(k);
    }
    const free = (k) => f.walkableKind(k) && sv.occ[k] === 0 && !sv.reserved[k] && !blocked.has(k);
    const ring = [];
    for (let y = b.j - 1; y <= b.j + b.s; y++)
        for (let x = b.i - 1; x <= b.i + b.s; x++) if (free(y * N + x)) ring.push(y * N + x);
    const w = sv.worker;
    const wk = f.cellAt(w.x, w.z);
    const start = w.alive && free(wk) ? wk : ring[0];
    if (start == null) return plan.ramps.map(() => false).concat(false);
    const seen = new Uint8Array(N * N);
    const q = [start];
    seen[start] = 1;
    while (q.length) {
        const k = q.pop();
        const x = k % N;
        const y = (k - x) / N;
        for (const [di, dj] of N4) {
            const nk = (y + dj) * N + x + di;
            if (!seen[nk] && free(nk)) {
                seen[nk] = 1;
                q.push(nk);
            }
        }
    }
    const out = plan.ramps.map((r) => {
        for (let t = -3; t <= -1; t++)
            for (let l = r.a; l <= r.b; l++) {
                const [x, y] = rampCell(r, t, l);
                if (seen[y * N + x]) return true;
            }
        return false;
    });
    out.push(ring.some((k) => seen[k]));
    return out;
}

/** 겹치지 않게 타워 자리를 고른다. nearBase면 본진 곁 (하늘의 적 대비) */
function pickSpot(state, plan, used, nearBase = false) {
    let list = plan.spots;
    const b = state.survival.base;
    if (nearBase && b) {
        const c = (sp) => Math.hypot(sp.i + 1 - (b.i + 2), sp.j + 1 - (b.j + 2));
        list = plan.allSpots.slice().sort((p, q) => c(p) - c(q));
    }
    for (const sp of list) {
        if (used.some((u) => Math.abs(u.i - sp.i) < 2 && Math.abs(u.j - sp.j) < 2)) continue;
        if (!checkPlacement(state, 'ranger', sp.i, sp.j, { plan: true }).ok) continue;
        if (!keepsPath(state, plan, sp.i, sp.j)) continue;
        return sp;
    }
    return null;
}

/** 벌판 본진 자리 (벽 없이 벌판에 짓는 실험용): 고원 비탈 아래에서 조금 떨어진 빈 땅 */
function fieldBaseSpot(state, plan) {
    const f = state.survival.field;
    const r = plan.ramps[0];
    const [bi, bj] = rampCell(r, 8, 0);
    for (let rad = 0; rad < 12; rad++)
        for (let dj = -rad; dj <= rad; dj++)
            for (let di = -rad; di <= rad; di++) {
                const i = bi + di - 2;
                const j = bj + dj - 2;
                let ok = true;
                for (let y = 0; y < 4 && ok; y++)
                    for (let x = 0; x < 4 && ok; x++) {
                        const k = (j + y) * f.N + i + x;
                        if (!f.inside(i + x, j + y) || f.kind[k] !== 0 || f.level[k] !== 1 || f.vein[k] >= 0)
                            ok = false;
                    }
                if (ok) return { i, j };
            }
    return null;
}

/**
 * 생존자를 움직이는 AI. think()를 0.5초마다 부른다.
 * opts: { site, idle, walls: true, wall2: true(방벽 2단계를 일찍), field: false, towers: [...종류], mines: true, upgrades: true,
 *         repair: true, maxTowers, tierGate }
 */
export function createSurvivalAi(state, opts = {}) {
    const sv = state.survival;
    const f = sv.field;
    const N = f.N;
    const siteId = opts.site ?? 'nw';
    const plan = sitePlan(state, siteId);
    const types = opts.towers ?? [
        'ranger',
        'frost',
        'ember',
        'storm',
        'ranger',
        'arcane',
        'ember',
        'storm',
        'frost',
        'arcane',
        'ember',
        'storm',
        'ranger',
        'arcane',
        'ember',
        'storm'
    ];
    const used = [];
    let ti = 0;
    const log = { walls: 0, towers: 0, mines: 0, repairs: 0, baseAt: null, phase: 'explore' };
    const fieldBase = opts.field ? fieldBaseSpot(state, plan) : null;
    const baseAt = fieldBase ?? { i: plan.site.base[0], j: plan.site.base[1] };
    const toWorld = (i, j) => f.toWorld(i, j);
    const explored = (i, j, s) => {
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if (!sv.fog.explored[(j + y) * N + i + x]) return false;
        return true;
    };
    const pending = () => workerOrders(sv).filter((o) => o.type === 'build' && !o.started).length;
    const order = (type, i, j) => {
        const r = orderBuild(state, type, i, j, true);
        if (r.ok) {
            if (type === 'wall') log.walls++;
            else if (type === 'mine') log.mines++;
            else if (type !== 'base') log.towers++;
        }
        return r.ok;
    };
    let walked = false;
    // 비탈마다 적이 몰린 정도 (타워는 적이 실제로 오는 비탈 쪽에 모은다)
    const heat = plan.ramps.map(() => 0);
    let hotSpots = plan.spots;
    let hotKey = -1;

    function think() {
        if (opts.idle || state.status !== 'playing') return;
        const w = sv.worker;
        // 1) 탐험: 비탈 아래로 걸어가 고원 위로 오른다 (본진 자리가 밝혀질 때까지)
        if (!sv.base && !workerOrders(sv).some((o) => o.type === 'build')) {
            if (explored(baseAt.i, baseAt.j, 4)) {
                order('base', baseAt.i, baseAt.j);
                log.phase = 'base';
            } else if (w.alive && !w.order && !walked) {
                walked = true;
                if (!fieldBase) {
                    const r = plan.ramps[0];
                    const [bi, bj] = rampCell(r, 5, 0);
                    const p = toWorld(bi, bj);
                    orderMove(state, p.x, p.z, true);
                }
                const c = toWorld(baseAt.i + 2, baseAt.j + 2);
                orderMove(state, c.x, c.z, true);
            }
            return;
        }
        if (!sv.base) return;
        // 적이 몰린 비탈을 잰다
        plan.stage.forEach(([si, sj], n) => {
            const p = toWorld(si, sj);
            for (const e of state.enemies)
                if (e.alive && !e.def.flying && Math.hypot(e.x - p.x, e.z - p.z) < 6) heat[n] += 1;
            heat[n] *= 0.999;
        });
        const total = heat.reduce((a, b) => a + b, 0);
        const hot = total > 20 ? heat.indexOf(Math.max(...heat)) : -1;
        if (hot !== hotKey) {
            hotKey = hot;
            // 몰리는 비탈이 있으면 그 비탈까지 거리에 무게를 둔다 (다른 비탈에도 조금은 둔다)
            hotSpots = plan.spots
                .map((sp) => ({ ...sp, w: hot < 0 ? sp.d : sp.ds[hot] * 0.75 + sp.d * 0.25 }))
                .sort((a, b) => a.w - b.w);
        }
        // 2) 수리: 많이 다친 건물 (벽은 바깥 줄 먼저). 급하면 하던 일을 버리고 간다
        if (opts.repair !== false && w.alive) {
            const queued = new Set(
                workerOrders(sv)
                    .filter((o) => o.type === 'repair')
                    .map((o) => o.target)
            );
            if (queued.size < 2) {
                const baseHurt = state.lives < state.maxLives * 0.55 && !sv.base.build;
                const hurt = baseHurt
                    ? sv.base
                    : state.towers.find(
                          (t) => !t.build && !queued.has(t) && t.hp < t.maxHp * 0.5 && state.time - (t.hitT ?? -9) < 6
                      );
                // 하던 일 바로 다음에 고치러 간다 (예약한 건설은 버리지 않는다)
                if (hurt && !queued.has(hurt) && state.gold > 15) {
                    const r = orderRepair(state, hurt, 'front');
                    if (r.ok) log.repairs++;
                }
            }
        }
        // 이미 줄이 길면 더 넣지 않는다
        if (pending() >= 6) return;
        // 지은 것 + 생존자가 지으러 갈 예정인 것
        const plannedOf = (pred) =>
            workerOrders(sv).filter((o) => o.type === 'build' && !o.started && pred(o.btype)).length;
        const isTower = (type) => type !== 'wall' && type !== 'mine' && type !== 'base';
        const towerCount = state.towers.filter((t) => isTower(t.type)).length + plannedOf(isTower);
        const mines = state.towers.filter((t) => t.type === 'mine').length + plannedOf((x) => x === 'mine');
        const freeVein = plan.veins.find(
            (v) => !state.towers.some((t) => t.veinId === v.id) && explored(v.i, v.j, 2) && !sv.reserved[v.j * N + v.i]
        );
        const useMines = opts.mines !== false && freeVein;
        const wantTower = () => {
            if (towerCount >= (opts.maxTowers ?? 22)) return false;
            const type = types[ti % types.length];
            if (state.gold < TOWERS[type].tiers[0].cost) return true;
            const sp = fieldBase
                ? pickSpot(state, { ...plan, spots: nearSpots(state, fieldBase) }, used)
                : pickSpot(state, { ...plan, spots: hotSpots }, used, ti === 2 && opts.walls !== false);
            // 자리가 아직 안 보이거나 막혀 있으면 이번엔 넘어간다
            if (!sp) return false;
            if (order(type, sp.i, sp.j)) {
                used.push(sp);
                ti++;
            }
            return true;
        };
        const buildMine = () => {
            if (state.gold >= TOWERS.mine.tiers[0].cost) order('mine', freeVein.i, freeVein.j);
            return true;
        };
        const wallsOn = opts.walls !== false && !fieldBase;
        // 3) 광산 하나 → 비탈 바깥 줄 방벽(무너지면 다시) → 타워 → 광산 → 타워 …
        if (useMines && mines < 1 && buildMine()) return;
        const wallCost = TOWERS.wall.tiers[0].cost;
        if (wallsOn) {
            let any = false;
            for (const k of plan.wallAt)
                if (sv.occ[k] === 0 && !sv.reserved[k] && state.gold >= wallCost)
                    any = order('wall', k % N, Math.floor(k / N)) || any;
            if (any) return;
        }
        if (towerCount < 1 && wantTower()) return;
        if (useMines && mines < 2 && buildMine()) return;
        if (towerCount < 2 && wantTower()) return;
        if (towerCount < 3 && wantTower()) return;
        if (useMines && buildMine()) return;
        // 4) 방벽 2단계 (예전 안쪽 줄 방벽 자리)
        const walls = state.towers.filter((t) => t.type === 'wall' && !t.build);
        if (wallsOn && opts.wall2 !== false && towerCount >= 3) {
            const wl = walls.find((t) => t.tier < 2);
            if (wl && state.gold >= TOWERS.wall.tiers[1].cost + 10 && upgradeTower(state, wl.id).ok) return;
        }
        // 5) 채굴 기술, 업그레이드 (광산 먼저, 그다음 tierGate 레벨까지 타워), 타워 더, 벽 강화
        if (opts.upgrades !== false) {
            const tech = nextMineTech(sv);
            if (tech && mines >= 2 && state.gold >= tech.cost + 60 && !sv.base.build) {
                upgradeMining(state);
                return;
            }
            const gate = opts.tierGate ?? 4;
            const cand = state.towers
                .filter(
                    (t) =>
                        !t.build &&
                        t.type !== 'wall' &&
                        (t.tier < (t.type === 'mine' ? MAX_TIER : Math.min(gate, MAX_TIER)) ||
                            (t.type !== 'mine' && gate > MAX_TIER && (!t.branch || t.mastery < MAX_MASTERY)))
                )
                .sort((a, b) => (b.type === 'mine') - (a.type === 'mine') || a.tier + a.mastery - (b.tier + b.mastery));
            const t = cand[0];
            if (t && towerCount >= 2 && upgradeTower(state, t.id, t.tier >= MAX_TIER ? 'a' : null).ok) return;
        }
        if (wantTower()) return;
        if (opts.upgrades !== false && wallsOn) {
            const wl = walls.find((t) => t.tier < MAX_TIER);
            if (wl && state.gold > 200) upgradeTower(state, wl.id);
        }
    }

    return { think, plan, log, baseAt };
}

/** 벌판 본진 곁 타워 자리 (벽 없이 벌판에 짓는 실험용) */
function nearSpots(state, b) {
    const f = state.survival.field;
    const out = [];
    for (let dj = -6; dj <= 7; dj++)
        for (let di = -6; di <= 7; di++) {
            const i = b.i + di;
            const j = b.j + dj;
            if (i >= b.i - 2 && i <= b.i + 4 && j >= b.j - 2 && j <= b.j + 4) continue;
            const ks = [j * f.N + i, j * f.N + i + 1, (j + 1) * f.N + i, (j + 1) * f.N + i + 1];
            if (ks.every((k) => f.kind[k] === 0 && f.vein[k] < 0)) out.push({ i, j, d: Math.abs(di) + Math.abs(dj) });
        }
    return out.sort((p, q) => p.d - q.d);
}

/** 한 판을 끝까지 돌린다. opts는 createSurvivalAi와 같고, game·maxTime·onTick(state)을 더 받는다 */
export function playSurvival(opts = {}) {
    const state = createGame('mountain', opts.game);
    const ai = createSurvivalAi(state, opts);
    let think = 0;
    while (state.status === 'playing' && state.time < (opts.maxTime ?? 1200)) {
        step(state, TICK);
        drainEvents(state);
        opts.onTick?.(state);
        think -= TICK;
        if (think > 0) continue;
        think = 0.5;
        ai.think();
    }
    return { state, log: ai.log, plan: ai.plan };
}
