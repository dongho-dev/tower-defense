// 헤드리스 시뮬레이션 도우미와 밸런스 검증용 AI 플레이어.
import {
    createGame,
    step,
    buildTower,
    upgradeTower,
    callWave,
    castSkill,
    drainEvents,
    repairTower,
    repairCost,
    repairGate,
    gateRepairCost,
    repairBase,
    baseRepairCost,
    TICK
} from '../src/core/game.js';
import { TOWERS, MAX_TIER } from '../src/core/data/towers.js';

export function runUntil(state, predicate, maxSeconds = 1200) {
    for (let t = 0; t < maxSeconds && !predicate(state); t += TICK) {
        step(state, TICK);
        drainEvents(state);
    }
}

/**
 * 계획대로 짓고 업그레이드하는 AI.
 * plan: [[socketId, type, branch], ...] 앞에서부터 우선순위.
 */
export function playWithPlan(mapId, plan, opts = {}) {
    const state = createGame(mapId, opts.game);
    const branchOf = new Map(plan.map(([sid, , br]) => [sid, br || 'a']));
    let think = 0;
    const log = [];
    // 살아남기는 밤 시계가 저절로 흐른다 (첫 습격 전 짓는 시간을 그대로 쓴다)
    if (!state.survival) callWave(state);
    while (state.status === 'playing' && state.time < (opts.maxTime ?? 3000)) {
        step(state, TICK);
        const evs = drainEvents(state);
        if (opts.onEvents) opts.onEvents(evs, state);
        think -= TICK;
        if (think > 0) continue;
        think = 0.5;
        // 0) 공성전: 절반 아래로 떨어진 타워 수리
        if (state.siege) {
            const hurt = state.towers.find((t) => t.hp < t.maxHp * 0.5 && repairCost(t) <= state.gold);
            if (hurt) repairTower(state, hurt.id);
            // 성문: 절반 아래면 수리, 무너졌으면 재건
            const gate = state.gates.find((g) => (g.broken || g.hp < g.maxHp * 0.5) && gateRepairCost(g) <= state.gold);
            if (gate && !opts.noGateRepair) repairGate(state, gate.id);
            // 살아남기: 본진이 절반 아래면 수리
            if (state.survival && !opts.noBaseRepair && state.lives < state.maxLives * 0.5) {
                if (baseRepairCost(state) <= state.gold) repairBase(state);
            }
        }
        // 1) 계획상 다음 소켓에 건설
        const next = plan.find(([sid]) => state.sockets[sid].towerId == null);
        const builtCount = state.towers.length;
        // tierGate: 지은 타워(광산 제외)가 모두 이 레벨에 닿아야 다음 것을 짓는다 (넓게만 짓지 않는 플레이)
        const gated =
            opts.tierGate && state.towers.some((t) => t.type !== 'mine' && !t.branch && t.tier < opts.tierGate);
        if (
            next &&
            !(gated && TOWERS[next[1]].attack !== 'none') &&
            (builtCount < (opts.minTowers ?? 4) || !opts.upgradeFirst)
        ) {
            const cost = TOWERS[next[1]].tiers[0].cost;
            if (state.gold >= cost) {
                buildTower(state, next[0], next[1]);
                continue;
            }
        }
        // 2) 가장 싼 업그레이드
        if (!opts.noUpgrades) {
            let best = null;
            for (const t of state.towers) {
                if (t.branch) continue;
                if (opts.maxTier && t.tier >= opts.maxTier) continue;
                const def = TOWERS[t.type];
                const cost = t.tier < MAX_TIER ? def.tiers[t.tier].cost : def.branches[branchOf.get(t.socketId)].cost;
                if (!best || cost < best.cost) best = { t, cost };
            }
            if (best && state.gold >= best.cost && (!next || opts.upgradeFirst || state.gold >= best.cost + 60)) {
                upgradeTower(state, best.t.id, branchOf.get(best.t.socketId));
            }
        }
        // 3) 스킬
        if (opts.skills !== false && state.enemies.length) {
            const lead = state.enemies.reduce((a, b) => (b.d > a.d ? b : a));
            if (state.skills.meteor.cd <= 0) {
                // 가장 붐비는 적 주변
                let bestE = null;
                let bestN = 0;
                for (const e of state.enemies) {
                    const n = state.enemies.filter((o) => (o.x - e.x) ** 2 + (o.z - e.z) ** 2 < 3).length;
                    if (n > bestN) {
                        bestN = n;
                        bestE = e;
                    }
                }
                if (bestN >= 5 || lead.def.boss) castSkill(state, 'meteor', (bestE || lead).x, (bestE || lead).z);
            }
            const deep = state.survival
                ? state.enemies.some((e) => e.atkTargetId != null)
                : lead.d > state.paths[0].length * 0.8;
            if (state.skills.freeze.cd <= 0 && deep) castSkill(state, 'freeze');
        }
        if (opts.callEarly && state.nextWaveIn != null && state.nextWaveIn < WAVE_EARLY) callWave(state);
        if (state.waveIndex !== log.length)
            log.push({ wave: state.waveIndex, lives: state.lives, gold: state.gold, towers: state.towers.length });
    }
    return { state, log };
}

const WAVE_EARLY = 10;

export const STANDARD_PLAN = [
    [4, 'ranger', 'b'],
    [6, 'frost', 'a'],
    [5, 'ember', 'a'],
    [7, 'storm', 'a'],
    [8, 'ranger', 'a'],
    [11, 'storm', 'b'],
    [9, 'frost', 'b'],
    [10, 'ember', 'b'],
    [2, 'ember', 'a'],
    [12, 'ranger', 'a'],
    [13, 'storm', 'a'],
    [0, 'ranger', 'b'],
    [1, 'frost', 'a'],
    [17, 'ranger', 'a']
];

/** 맵에 상관없이: 경로 커버리지가 높은 소켓부터 종류를 섞어 배치하는 계획 */
export function autoPlan(mapId, n = 10, cycleOverride = null) {
    const state = createGame(mapId);
    const cover = (s) => {
        let c = 0;
        for (const p of state.paths) {
            for (let i = 0; i < p.count; i += 3) if ((p.xs[i] - s.x) ** 2 + (p.zs[i] - s.z) ** 2 <= 3.4 * 3.4) c++;
        }
        return c;
    };
    const order = [...state.sockets].sort((a, b) => cover(b) - cover(a)).slice(0, n);
    const cycle = [
        ['ranger', 'b'],
        ['frost', 'a'],
        ['ember', 'a'],
        ['storm', 'a'],
        ['ranger', 'a'],
        ['storm', 'b'],
        ['frost', 'b'],
        ['ember', 'b']
    ];
    const cy = cycleOverride || cycle;
    return order.map((s, i) => [s.id, cy[i % cy.length][0], cy[i % cy.length][1]]);
}
