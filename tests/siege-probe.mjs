// 공성전 조사 (테스트 아님): 누수·타워 손실 원인
import { playWithPlan, autoPlan } from './helpers.js';
for (const map of (process.argv[2] || 'dusk').split(',')) {
    for (const n of [8, 10, 12]) {
        const leaks = {};
        const lost = {};
        const { state } = playWithPlan(map, autoPlan(map, n), {
            game: { siege: true },
            onEvents: (evs, st) => {
                for (const e of evs) {
                    if (e.type === 'leak') leaks[`w${st.waveIndex}`] = (leaks[`w${st.waveIndex}`] || 0) + e.lives;
                    if (e.type === 'towerDestroyed') lost[`w${st.waveIndex}`] = (lost[`w${st.waveIndex}`] || 0) + 1;
                }
            }
        });
        console.log(
            map,
            n,
            state.status,
            state.waveIndex,
            'lives',
            state.lives,
            'leaks',
            JSON.stringify(leaks),
            'lost',
            JSON.stringify(lost)
        );
    }
}
