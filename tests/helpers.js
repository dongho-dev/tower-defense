// 헤드리스 시뮬레이션 도우미와 밸런스 검증용 AI 플레이어.
import {
    createGame,
    step,
    buildTower,
    upgradeTower,
    callWave,
    castSkill,
    drainEvents,
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
    const state = createGame(mapId);
    const branchOf = new Map(plan.map(([sid, , br]) => [sid, br || 'a']));
    let think = 0;
    const log = [];
    callWave(state);
    while (state.status === 'playing' && state.time < 3000) {
        step(state, TICK);
        drainEvents(state);
        think -= TICK;
        if (think > 0) continue;
        think = 0.5;
        // 1) 계획상 다음 소켓에 건설
        const next = plan.find(([sid]) => state.sockets[sid].towerId == null);
        const builtCount = state.towers.length;
        if (next && (builtCount < (opts.minTowers ?? 4) || !opts.upgradeFirst)) {
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
            if (state.skills.freeze.cd <= 0 && lead.d > state.paths[0].length * 0.8) castSkill(state, 'freeze');
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
