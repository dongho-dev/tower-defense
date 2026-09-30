// 밸런스 조사용 스크립트 (테스트 아님): node tests/balance-probe.mjs
import { playWithPlan, autoPlan } from './helpers.js';
import { MAPS } from '../src/core/data/maps.js';

for (const map of Object.keys(MAPS)) {
    for (const n of [6, 8, 10, 12]) {
        const { state, log } = playWithPlan(map, autoPlan(map, n));
        const leaks = log.filter((l, i) => i && l.lives < log[i - 1].lives).map((l) => l.wave - 1);
        console.log(
            map.padEnd(10),
            String(n).padStart(2),
            state.status.padEnd(5),
            'wave',
            state.waveIndex,
            'lives',
            state.lives,
            'leaks@',
            leaks.join(',')
        );
    }
}
