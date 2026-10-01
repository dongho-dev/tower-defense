// 살아남기(얼어붙은 분지) 헤드리스 AI: 밸런스 검증과 스크린샷 준비에 함께 쓴다.
// 명당 하나를 골라 본진을 세우고, 비탈 꼭대기(고원 가장자리)를 방벽으로 막고, 그 뒤에 타워를,
// 광맥에 광산을 짓는다. 다친 벽·타워·본진을 고치고 무너진 벽은 다시 쌓는다.
import {
    createGame,
    step,
    drainEvents,
    placeBase,
    placeBuilding,
    upgradeTower,
    repairTower,
    repairCost,
    repairBase,
    baseRepairCost,
    callWave,
    TICK
} from '../src/core/game.js';
import { checkPlacement } from '../src/core/survival.js';
import { TOWERS, MAX_TIER } from '../src/core/data/towers.js';

const N8 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
];

/**
 * 명당의 방어 계획: wall1 = 고원 경계(비탈 꼭대기) 칸, wall2 = 그 안쪽 한 겹,
 * towers = 벽 바로 뒤 2×2 자리 후보 (입구에 가까운 순), veins = 고원 안 광맥.
 */
export function sitePlan(state, siteId) {
    const f = state.survival.field;
    const { N } = f;
    const s = f.sites.find((x) => x.id === siteId);
    const inRegion = (k) => f.site[k] === s.n && f.walkableKind(k);
    const wall1 = [];
    for (let k = 0; k < N * N; k++) {
        if (!inRegion(k) || f.vein[k] >= 0) continue;
        const i = k % N;
        const j = (k - i) / N;
        if (
            N8.some(
                ([di, dj]) =>
                    f.inside(i + di, j + dj) &&
                    f.walkableKind((j + dj) * N + i + di) &&
                    !inRegion((j + dj) * N + i + di)
            )
        )
            wall1.push(k);
    }
    const w1 = new Set(wall1);
    const wall2 = [];
    for (const k of wall1) {
        const i = k % N;
        const j = (k - i) / N;
        for (const [di, dj] of N8) {
            const nk = (j + dj) * N + i + di;
            if (inRegion(nk) && !w1.has(nk) && f.vein[nk] < 0 && !wall2.includes(nk)) wall2.push(nk);
        }
    }
    // 벽에서 잰 거리 (고원 안쪽으로)
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
        for (const [di, dj] of N8.slice(0, 4)) {
            const nk = (j + dj) * N + i + di;
            if (!inRegion(nk) || dist[nk] >= 0) continue;
            dist[nk] = dist[k] + 1;
            q.push(nk);
        }
    }
    // 타워 자리: 2×2가 모두 벽에서 2~4칸 떨어진 곳 (입구마다 묶어서 번갈아 고른다)
    const spots = [];
    for (let j = 0; j < N - 1; j++)
        for (let i = 0; i < N - 1; i++) {
            const ks = [j * N + i, j * N + i + 1, (j + 1) * N + i, (j + 1) * N + i + 1];
            if (!ks.every((k) => inRegion(k) && f.vein[k] < 0)) continue;
            const d = Math.min(...ks.map((k) => dist[k]));
            if (d < 2 || d > 4) continue;
            spots.push({ i, j, d });
        }
    spots.sort((a, b) => a.d - b.d);
    // 고원 안 어디든 (본진 곁 타워용)
    const allSpots = [];
    for (let j = 0; j < N - 1; j++)
        for (let i = 0; i < N - 1; i++) {
            const ks = [j * N + i, j * N + i + 1, (j + 1) * N + i, (j + 1) * N + i + 1];
            if (ks.every((k) => inRegion(k) && f.vein[k] < 0 && dist[k] >= 2)) allSpots.push({ i, j });
        }
    const veins = f.veins.filter((v) => v.site === s.n);
    return { site: s, wall1, wall2, spots, allSpots, veins, dist };
}

/** 겹치지 않게 타워 자리를 고른다 (서로 떨어지게, 입구 쪽 먼저). nearBase면 본진 곁 (하늘의 적 대비) */
function pickSpot(state, plan, used, nearBase = false) {
    let list = plan.spots;
    if (nearBase) {
        const b = state.survival.base;
        const c = (sp) => Math.hypot(sp.i + 1 - (b.i + 2), sp.j + 1 - (b.j + 2));
        list = plan.allSpots.slice().sort((a, b2) => c(a) - c(b2));
    }
    for (const sp of list) {
        if (used.some((u) => Math.abs(u.i - sp.i) < 2 && Math.abs(u.j - sp.j) < 2)) continue;
        if (!checkPlacement(state, 'ranger', sp.i, sp.j).ok) continue;
        return sp;
    }
    return null;
}

/**
 * opts: { site, walls: true, wall2: true, towers: [...종류], mines: true, upgrades: true, repair: true,
 *         maxTowers, tierGate, maxTime }
 */
export function playSurvival(opts = {}) {
    const state = createGame('mountain', opts.game);
    const sv = state.survival;
    const f = sv.field;
    const siteId = opts.site ?? 'nw';
    const s = f.sites.find((x) => x.id === siteId);
    placeBase(state, s.base[0], s.base[1]);
    const plan = sitePlan(state, siteId);
    const N = f.N;
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
        'arcane'
    ];
    const used = [];
    let ti = 0;
    let think = 0;
    const log = { built: 0, walls: 0, rebuilt: 0 };
    if (opts.callFirst) callWave(state);
    const tryWall = (k) => {
        const r = placeBuilding(state, 'wall', k % N, Math.floor(k / N));
        if (r.ok) log.walls++;
        return r.ok;
    };
    const wallAt = (k) => sv.occ[k] > 0;
    while (state.status === 'playing' && state.time < (opts.maxTime ?? 1200)) {
        step(state, TICK);
        drainEvents(state);
        think -= TICK;
        if (think > 0) continue;
        think = 0.5;
        if (opts.idle) continue;
        // 1) 본진 수리
        if (state.lives < state.maxLives * 0.6 && baseRepairCost(state) <= state.gold && opts.repair !== false)
            repairBase(state);
        // 2) 다친 건물 수리
        if (opts.repair !== false) {
            const hurt = state.towers.find((t) => t.hp < t.maxHp * 0.45 && repairCost(t) <= state.gold);
            if (hurt) repairTower(state, hurt.id);
        }
        // 3) 첫 겹 벽 (무너지면 다시)
        if (opts.walls !== false) {
            let any = false;
            for (const k of plan.wall1) if (!wallAt(k) && state.gold >= 12) any = tryWall(k) || any;
            if (any) continue;
        }
        // 4) 타워 하나 짓기 (돈이 모자라면 기다린다)
        const towerCount = state.towers.filter((t) => t.type !== 'wall' && t.type !== 'mine').length;
        const wantTower = () => {
            if (towerCount >= (opts.maxTowers ?? 10) || ti >= types.length) return false;
            const type = types[ti];
            if (state.gold < TOWERS[type].tiers[0].cost) return true;
            // 세 번째 타워는 본진 곁에 (벽을 넘는 하늘의 적)
            const sp = pickSpot(state, plan, used, ti === 2 && opts.walls !== false);
            if (!sp) {
                ti = types.length;
                return false;
            }
            const r = placeBuilding(state, type, sp.i, sp.j);
            if (r.ok) {
                used.push(sp);
                ti++;
                log.built++;
            }
            return true;
        };
        // 5) 초반: 타워 → 광산 → 타워 → 광산 → (본진 곁) 타워 → 나머지 광산
        const mines = state.towers.filter((t) => t.type === 'mine').length;
        const freeVein = plan.veins.find((v) => !state.towers.some((t) => t.veinId === v.id));
        const buildMine = () => {
            if (state.gold >= TOWERS.mine.tiers[0].cost) placeBuilding(state, 'mine', freeVein.i, freeVein.j);
            return true;
        };
        const useMines = opts.mines !== false && freeVein;
        const early = opts.walls === false ? 2 : 3;
        if (towerCount < 1 && wantTower()) continue;
        if (useMines && mines < 1 && buildMine()) continue;
        if (towerCount < 2 && wantTower()) continue;
        if (useMines && mines < 2 && buildMine()) continue;
        if (towerCount < early && wantTower()) continue;
        if (useMines && buildMine()) continue;
        // 6) 두 번째 겹 벽
        if (opts.walls !== false && opts.wall2 !== false && towerCount >= 3) {
            let any = false;
            for (const k of plan.wall2) if (!wallAt(k) && state.gold >= 40) any = tryWall(k) || any;
            if (any) continue;
        }
        // 7) 업그레이드: 광산 먼저, 그다음 tierGate 레벨까지 타워, 벽
        if (opts.upgrades !== false) {
            const gate = opts.tierGate ?? 2;
            const cand = state.towers
                .filter(
                    (t) =>
                        t.type !== 'wall' &&
                        (t.tier < (t.type === 'mine' ? MAX_TIER : Math.min(gate, MAX_TIER)) ||
                            (t.type !== 'mine' && gate > MAX_TIER && !t.branch))
                )
                .sort((a, b) => (b.type === 'mine') - (a.type === 'mine') || a.tier - b.tier);
            const t = cand[0];
            if (t && towerCount >= 2) {
                const r = upgradeTower(state, t.id, t.tier >= MAX_TIER ? 'a' : null);
                if (r.ok) continue;
            }
        }
        // 8) 타워 더
        if (wantTower()) continue;
        // 9) 벽 강화 (첫 겹)
        if (opts.upgrades !== false && opts.walls !== false) {
            const w = state.towers.find(
                (t) => t.type === 'wall' && t.tier < MAX_TIER && plan.wall1.includes(t.cell.j * N + t.cell.i)
            );
            if (w && state.gold > 200) upgradeTower(state, w.id);
        }
    }
    return { state, log, plan };
}
