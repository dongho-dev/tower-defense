// 누수 원인 조사 (테스트 아님): node tests/leak-probe.mjs 맵 [타워 수]
import { playWithPlan, autoPlan } from './helpers.js';

const map = process.argv[2] || 'dusk';
const n = Number(process.argv[3] || 10);
const leaks = {};
const { state } = playWithPlan(map, autoPlan(map, n), {
    onEvents: (evs, st) => {
        for (const e of evs)
            if (e.type === 'leak') {
                const k = `w${st.waveIndex} ${e.enemy}`;
                leaks[k] = (leaks[k] || 0) + e.lives;
            }
    }
});
console.log(map, n, state.status, 'wave', state.waveIndex, 'lives', state.lives, leaks);
