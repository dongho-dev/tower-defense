// 밸런스 조사용 스크립트 (테스트 아님): node tests/balance-probe.mjs [맵1,맵2] [campaign|diff|endless|siege]
import { playWithPlan, autoPlan } from './helpers.js';
import { MAPS } from '../src/core/data/maps.js';

const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : Object.keys(MAPS);
const part = process.argv[3] || 'all';
const want = (p) => part === 'all' || part === p;

for (const map of want('campaign') ? only : []) {
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

// 난이도: 같은 10타워 계획으로 쉬움·영웅 비교
for (const map of want('diff') ? only : []) {
    for (const difficulty of ['easy', 'hero']) {
        const { state } = playWithPlan(map, autoPlan(map, 10), { game: { difficulty } });
        console.log(
            map.padEnd(10),
            difficulty.padEnd(6),
            state.status.padEnd(5),
            'wave',
            state.waveIndex,
            'lives',
            state.lives
        );
    }
}

// 끝없는 밤: 골드 무제한에 가까운 14타워 만렙 진영이 몇 웨이브까지 버티는지
for (const map of want('endless') ? only : []) {
    const { state } = playWithPlan(map, autoPlan(map, 14), { game: { endless: true, gold: 20000 }, maxTime: 8000 });
    console.log(
        map.padEnd(10),
        'endless',
        state.status.padEnd(5),
        'wave',
        state.waveIndex,
        'time',
        Math.round(state.time)
    );
}

// 공성전: 같은 계획 + 수리. 병영을 섞은 계획도 비교한다
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
for (const map of want('siege') ? only : []) {
    for (const [label, cyc] of [
        ['basic', null],
        ['barracks', WITH_BARRACKS]
    ]) {
        for (const n of [8, 10]) {
            const { state } = playWithPlan(map, autoPlan(map, n, cyc), { game: { siege: true } });
            console.log(
                map.padEnd(10),
                'siege',
                label.padEnd(8),
                String(n).padStart(2),
                state.status.padEnd(5),
                'wave',
                state.waveIndex,
                'lives',
                state.lives,
                'lost',
                state.stats.lost || 0,
                'hero lv',
                state.hero.level
            );
        }
    }
}
