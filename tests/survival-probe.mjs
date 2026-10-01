// 살아남기(눈마루 고개) 밸런스 조사 (테스트 아님): node tests/survival-probe.mjs
// 수치 실험: SPEED=0.8 HP=0.75 GOLD=360 BASE=1500 node tests/survival-probe.mjs
import { playWithPlan, MOUNTAIN_PLAN } from './helpers.js';
import { MAPS } from '../src/core/data/maps.js';

const MAP = 'mountain';
const env = process.env;
if (env.SPEED) MAPS[MAP].speedMul = Number(env.SPEED);
if (env.HP) MAPS[MAP].hpMul = Number(env.HP);
if (env.GOLD) MAPS[MAP].startGold = Number(env.GOLD);
if (env.BASE) MAPS[MAP].lives = Number(env.BASE);
if (env.BOUNTY) MAPS[MAP].bountyMul = Number(env.BOUNTY);
if (env.BASEY) MAPS[MAP].survival.veins[0].yield = Number(env.BASEY);
if (env.THP) MAPS[MAP].survival.towerHp = Number(env.THP);
if (env.PAY) MAPS[MAP].survival.payEvery = Number(env.PAY);

const noMines = MOUNTAIN_PLAN.filter(([, t]) => t !== 'mine');
const turtle = noMines.slice(0, 4);
// 본진 고원 소켓 0~6 + 본진 광맥만 쓰는 농성
const TURTLE = [
    [26, 'mine', 'a'],
    [4, 'ranger', 'b'],
    [5, 'ember', 'a'],
    [0, 'frost', 'a'],
    [1, 'storm', 'a'],
    [2, 'ranger', 'b'],
    [3, 'storm', 'b'],
    [6, 'ember', 'b']
];
const runs = [
    ['무대응', [], { noUpgrades: true, skills: false }],
    ['적당히(계획+업글)', MOUNTAIN_PLAN, { tierGate: 2 }],
    ['적당히(3레벨까지)', MOUNTAIN_PLAN, { tierGate: 3 }],
    ['넓게만 짓기', MOUNTAIN_PLAN],
    ['본진 광산+4타워 농성', [[26, 'mine', 'a'], ...turtle], { upgradeFirst: true, minTowers: 5 }],
    ['본진만 농성(7타워)', TURTLE, { tierGate: 2 }],
    ['광산 없이', noMines, { tierGate: 2 }],
    ['약하게 6타워', noMines.slice(0, 6), { noUpgrades: true }],
    ['업그레이드 없이', MOUNTAIN_PLAN, { noUpgrades: true }],
    ...['easy', 'hero'].map((d) => [`적당히(${d})`, MOUNTAIN_PLAN, { tierGate: 2, game: { difficulty: d } }])
];
for (const [name, plan, opts] of runs) {
    let lost = 0;
    let baseHits = 0;
    const { state } = playWithPlan(MAP, plan, {
        ...opts,
        onEvents: (evs) => {
            for (const e of evs) {
                if (e.type === 'towerDestroyed') lost++;
                if (e.type === 'enemyShot' && e.base) baseHits++;
            }
        }
    });
    console.log(
        name.padEnd(16),
        state.status.padEnd(7),
        `시계 ${Math.round(state.survival.clock)}s`,
        `웨이브 ${state.waveIndex}`,
        `본진 ${Math.round(state.lives)}/${state.maxLives}`,
        `타워 ${state.towers.length}(잃음 ${lost})`,
        `본진 피격 ${baseHits}`,
        `골드 ${state.gold}`,
        `캔 골드 ${state.stats.mined || 0}`
    );
}
