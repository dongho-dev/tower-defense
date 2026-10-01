// 살아남기(기나긴 밤) 밸런스 조사 (테스트 아님): node tests/survival-probe.mjs
import { playWithPlan, autoPlan, SURVIVAL_PLAN } from './helpers.js';
import { MAPS } from '../src/core/data/maps.js';

// 수치 실험: SPEED=0.7 HP=0.7 GOLD=450 LIVES=20 node tests/survival-probe.mjs
const env = process.env;
if (env.SPEED) MAPS.longnight.speedMul = Number(env.SPEED);
if (env.HP) MAPS.longnight.hpMul = Number(env.HP);
if (env.GOLD) MAPS.longnight.startGold = Number(env.GOLD);
if (env.LIVES) MAPS.longnight.lives = Number(env.LIVES);

const MAP = 'longnight';
const runs = [
    ['무대응', [], { noUpgrades: true, skills: false }],
    ['보루 계획 6', SURVIVAL_PLAN.slice(0, 6)],
    ['보루 계획 9', SURVIVAL_PLAN.slice(0, 9)],
    ['보루 계획 12', SURVIVAL_PLAN],
    ...[6, 8, 10, 12, 14].map((n) => [`자동 ${n}`, autoPlan(MAP, n)]),
    ['한 종류 12', SURVIVAL_PLAN.map(([s]) => [s, 'ranger', 'b'])],
    ['업그레이드 없이 12', SURVIVAL_PLAN, { noUpgrades: true }]
];
for (const [name, plan, opts] of runs) {
    const leaks = {};
    let lost = 0;
    const { state } = playWithPlan(MAP, plan, {
        ...opts,
        onEvents: (evs, st) => {
            for (const e of evs) {
                if (e.type === 'leak') leaks[`w${st.waveIndex}`] = (leaks[`w${st.waveIndex}`] || 0) + e.lives;
                if (e.type === 'towerDestroyed') lost++;
            }
        }
    });
    console.log(
        name.padEnd(14),
        state.status.padEnd(7),
        `시계 ${Math.round(state.survival.clock)}s`,
        `웨이브 ${state.waveIndex}`,
        `생명 ${state.lives}`,
        `타워 ${state.towers.length}(잃음 ${lost})`,
        `골드 ${state.gold}`,
        JSON.stringify(leaks)
    );
}
