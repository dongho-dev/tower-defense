// 랜덤 타워 디펜스 헤드리스 AI (밸런스 검증용). 0.25초마다 한 가지씩 결정한다.
import { createGame, step, drainEvents, callWave, TICK } from '../src/core/game.js';
import {
    summon,
    summonCost,
    freeSocket,
    canSummon,
    mergeGroups,
    mergeTower,
    craftMythic,
    recipeStatus,
    luckySummon,
    upgradeOdds,
    oddsUpgradeCost,
    rtdSell,
    moveTower,
    fieldCount,
    RTD,
    MYTH_ORDER
} from '../src/core/randomtd.js';

/** 합리적 전략의 한 번 결정. 했으면 true */
export function smartMove(state, opts = {}) {
    const R = state.rtd;
    // 1) 신화 레시피
    for (const id of MYTH_ORDER) if (recipeStatus(state, id).ready) return craftMythic(state, id).ok;
    // 2) 합성 (낮은 등급부터, 길에 가까운 칸에 남긴다). 신화 재료가 될 영웅은 아껴 둔다
    const rank = new Map(R.order.map((id, i) => [id, i]));
    for (const grp of mergeGroups(state)) return mergeTower(state, grp.tower.id).ok;
    // 3) 행운 소환
    if (opts.luck !== false && R.runes >= RTD.luckCost + (opts.runeReserve ?? 0) && freeSocket(state))
        return luckySummon(state).ok;
    // 4) 확률 강화: 웨이브가 어느 정도 지나고 여유가 있을 때
    const oc = oddsUpgradeCost(state);
    if (opts.odds !== false && oc != null && state.waveIndex >= 6 + 6 * R.oddsLevel && state.gold >= oc + 20)
        return upgradeOdds(state).ok;
    // 5) 소환
    if (canSummon(state) && state.gold >= summonCost(state)) return summon(state).ok;
    // 6) 칸이 없으면 가장 적게 쌓인 흔함(없으면 희귀)을 판다 (판매 골드·룬 파편)
    if (!freeSocket(state) && state.gold >= summonCost(state)) {
        for (const grade of [0, 1]) {
            const low = state.towers.filter((t) => t.grade === grade);
            if (!low.length) continue;
            low.sort((a, b) => a.count - b.count || rank.get(b.socketId) - rank.get(a.socketId));
            return rtdSell(state, low[0].id).ok;
        }
    }
    // 7) 자리 정리: 높은 등급이 길에서 먼 칸에 있으면 낮은 등급과 바꾼다
    if (opts.arrange !== false) {
        const byRank = state.towers.slice().sort((a, b) => rank.get(a.socketId) - rank.get(b.socketId));
        for (let i = 0; i < byRank.length; i++) {
            for (let j = byRank.length - 1; j > i; j--) {
                if (byRank[j].grade > byRank[i].grade + 0 && byRank[j].type !== 'mine' && byRank[i].type !== 'barracks')
                    return moveTower(state, byRank[j].id, byRank[i].socketId).ok;
            }
        }
    }
    return false;
}

/** 소극적 전략: 타워 몇 개만 소환하고 합성·강화는 하지 않는다 */
export function passiveMove(state, opts = {}) {
    const n = state.towers.reduce((k, t) => k + t.count, 0);
    if (n < (opts.max ?? 8) && canSummon(state) && state.gold >= summonCost(state)) return summon(state).ok;
    return false;
}

/** 한 판을 끝까지 돌린다. brain: (state) => void */
export function playRtd(brain, opts = {}) {
    const state = createGame('randomtd', { seed: opts.seed ?? 1, difficulty: opts.difficulty });
    callWave(state);
    let think = 0;
    const log = { peak: 0, lostAt: null };
    while (state.status === 'playing' && state.time < (opts.maxTime ?? 2400)) {
        step(state, TICK);
        const evs = drainEvents(state);
        if (opts.onEvents) opts.onEvents(evs, state);
        think -= TICK;
        if (think > 0) continue;
        think = 0.25;
        if (brain) for (let k = 0; k < 4 && brain(state); k++);
        log.peak = Math.max(log.peak, fieldCount(state));
    }
    return { state, log };
}
