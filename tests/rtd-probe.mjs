// 랜덤 타워 디펜스(운명의 제단) 밸런스 조사 (테스트 아님): node tests/rtd-probe.mjs [시드 수]
// 수치 실험: MOB=1.5(보통 적 체력) BOSS=0.8(보스 체력) SPEED=0.9 node tests/rtd-probe.mjs
import { playRtd, smartMove, passiveMove } from './rtd-helpers.js';
import { MAPS } from '../src/core/data/maps.js';
import { GRADES, RTD, BOSS_HP } from '../src/core/data/randomtd.js';

const env = process.env;
if (env.MOB) RTD.mobHp = Number(env.MOB);
if (env.GROW) RTD.hpGrowth = Number(env.GROW);
if (env.BOSS) for (const k in BOSS_HP) BOSS_HP[k] *= Number(env.BOSS);
if (env.SPEED) MAPS.randomtd.speedMul = Number(env.SPEED);
const seeds = Number(process.argv[2] || 4);

const runs = [
    ['무대응', null],
    ['소극(8개)', (s) => passiveMove(s, { max: 8 })],
    ['소환만(합성 없음)', (s) => passiveMove(s, { max: 78 })],
    ['합리적', (s) => smartMove(s)],
    ['합리적(강화·도박 없음)', (s) => smartMove(s, { odds: false, luck: false })]
];
for (const [name, brain] of runs) {
    let wins = 0;
    const rows = [];
    for (let seed = 1; seed <= seeds; seed++) {
        const bosses = [];
        const { state, log } = playRtd(brain, {
            seed,
            difficulty: env.DIFF,
            onEvents: (evs, st) => {
                for (const e of evs) if (e.type === 'rtdBossDown') bosses.push(`${e.wave}:${Math.round(30 - e.left)}s`);
                if (st.status === 'lost' && st.rtd.lostBy === 'boss') {
                    const b = st.enemies.find((x) => x.def.boss);
                    if (b) bosses.push(`${st.waveIndex}:남은${Math.round((b.hp / b.maxHp) * 100)}%`);
                }
            }
        });
        if (state.status === 'won') wins++;
        const grades = GRADES.map((g, i) =>
            state.towers.filter((t) => t.grade === i).reduce((n, t) => n + t.count, 0)
        ).join('/');
        rows.push(
            `${state.status === 'won' ? '승' : '패'} w${state.waveIndex} ${Math.round(state.time)}s 최대${log.peak} ` +
                `[${grades}] 소환${state.rtd.summons} 합성${state.rtd.merges} 신화${state.rtd.myths} ${state.rtd.lostBy || ''} 보스 ${bosses.join(' ')}`
        );
    }
    console.log(`${name.padEnd(16)} 승 ${wins}/${seeds}`);
    for (const r of rows) console.log('    ' + r);
}
