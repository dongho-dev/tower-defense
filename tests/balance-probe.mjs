// 밸런스 조사용 스크립트 (테스트 아님): node tests/balance-probe.mjs
import { playWithPlan, STANDARD_PLAN } from './helpers.js';

const scenarios = {
    standard: [STANDARD_PLAN, {}],
    standardEarly: [STANDARD_PLAN, { callEarly: true }],
    noSkills: [STANDARD_PLAN, { skills: false }],
    rangerOnly: [STANDARD_PLAN.map(([s]) => [s, 'ranger', 'b']), {}],
    lowTier: [STANDARD_PLAN, { maxTier: 2 }],
    nothing: [[], { noUpgrades: true, skills: false }]
};
for (const [name, [plan, opts]] of Object.entries(scenarios)) {
    const { state, log } = playWithPlan('dusk', plan, opts);
    console.log(
        name.padEnd(14),
        state.status.padEnd(7),
        'wave',
        String(state.waveIndex).padStart(2),
        'lives',
        String(state.lives).padStart(2),
        'towers',
        state.towers.length,
        'tiers',
        state.towers.map((t) => t.branch || t.tier).join(''),
        'gold',
        state.gold,
        'time',
        Math.round(state.time)
    );
    if (process.argv.includes('-v'))
        console.log(log.map((l) => `${l.wave}:${l.lives}/${l.gold}/${l.towers}`).join(' '));
}
