// 살아남기 밸런스 프로브: node tests/survival-probe.mjs [고원들 쉼표로] [실험들 쉼표로]
// 실험: 좋은운영 · 무대응 · 벌판(벽 없이 벌판에 본진·타워) · 타워만(고원 위, 벽 없이) · 광산없이
import { playSurvival } from './survivalAi.js';
import { MAPS } from '../src/core/data/maps.js';
// 조정 실험: HP=2 MINE=0.7 node tests/survival-probe.mjs nw
if (process.env.HP) MAPS.mountain.hpMul = Number(process.env.HP);
if (process.env.MINE) MAPS.mountain.survival.mineMul = Number(process.env.MINE);
if (process.env.PAY) MAPS.mountain.survival.payEvery = Number(process.env.PAY);
if (process.env.WALL) MAPS.mountain.survival.wallHp = Number(process.env.WALL);
if (process.env.THP) MAPS.mountain.survival.towerHp = Number(process.env.THP);
if (process.env.GOLD) MAPS.mountain.startGold = Number(process.env.GOLD);
if (process.env.BOUNTY) MAPS.mountain.bountyMul = Number(process.env.BOUNTY);
const sites = (process.argv[2] || 'nw,n,ne,e,se,s,w').split(',');
const RUNS = {
    좋은운영: {},
    무대응: { idle: true },
    벌판: { field: true },
    타워만: { walls: false },
    광산없이: { mines: false }
};
const names = (process.argv[3] || Object.keys(RUNS).join(',')).split(',');
for (const site of sites)
    for (const name of names) {
        const t0 = performance.now();
        const { state, log } = playSurvival({ site, ...RUNS[name] });
        const sv = state.survival;
        console.log(
            `${site.padEnd(3)} ${name.padEnd(5)} ${state.status.padEnd(5)} 시계 ${String(Math.round(sv.clock)).padStart(3)}s 웨이브 ${String(state.waveIndex).padStart(2)} 본진 ${String(Math.round(state.lives)).padStart(4)} 캔골드 ${String(state.stats.mined || 0).padStart(5)} 처치 ${String(state.stats.kills).padStart(3)} 벽 ${String(log.walls).padStart(3)} 타워 ${log.towers} 광산 ${log.mines} 수리 ${log.repairs} 무너짐 ${state.stats.lost || 0} 남은골드 ${state.gold} (${Math.round(performance.now() - t0)}ms)`
        );
    }
