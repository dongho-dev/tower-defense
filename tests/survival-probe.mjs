// 살아남기 밸런스 프로브: node tests/survival-probe.mjs [site]
import { playSurvival } from './survivalAi.js';
import { MAPS } from '../src/core/data/maps.js';
// 조정 실험: HP=2 MINE=0.7 node tests/survival-probe.mjs nw
if (process.env.HP) MAPS.mountain.hpMul = Number(process.env.HP);
if (process.env.MINE) MAPS.mountain.survival.mineMul = Number(process.env.MINE);
if (process.env.PAY) MAPS.mountain.survival.payEvery = Number(process.env.PAY);
const site = process.argv[2] || 'nw';
const runs = {
    무대응: { idle: true },
    좋은운영: { tierGate: 4 },
    타워만: { walls: false, tierGate: 4 },
    광산없이: { mines: false, tierGate: 4 },
    벽만: { towers: [], maxTowers: 0 }
};
for (const [name, o] of Object.entries(runs)) {
    const t0 = performance.now();
    const { state, log } = playSurvival({ site, ...o });
    const sv = state.survival;
    console.log(
        `${name.padEnd(6)} ${state.status.padEnd(5)} 시계 ${Math.round(sv.clock)}s 웨이브 ${state.waveIndex} 본진 ${Math.round(state.lives)} 캔골드 ${state.stats.mined || 0} 처치 ${state.stats.kills} 벽 ${log.walls} 무너짐 ${state.stats.lost || 0} 남은골드 ${state.gold} (${Math.round(performance.now() - t0)}ms)`
    );
}
