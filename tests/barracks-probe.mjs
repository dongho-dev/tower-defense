// 병영 섞은 계획 비교 (테스트 아님)
import { playWithPlan, autoPlan } from './helpers.js';
const WITH_BARRACKS = [
    ['ranger', 'b'],
    ['barracks', 'a'],
    ['frost', 'a'],
    ['ember', 'a'],
    ['storm', 'a'],
    ['barracks', 'b'],
    ['ranger', 'a'],
    ['storm', 'b']
];
for (const map of (process.argv[2] || 'dusk,frostvale,cinder').split(',')) {
    for (const n of [8, 10]) {
        let leaks = 0;
        const { state } = playWithPlan(map, autoPlan(map, n, WITH_BARRACKS), {
            onEvents: (evs) => evs.forEach((e) => e.type === 'leak' && (leaks += e.lives))
        });
        console.log(
            map.padEnd(10),
            'barracks',
            n,
            state.status,
            'wave',
            state.waveIndex,
            'lives',
            state.lives,
            'leaked',
            leaks
        );
    }
}
