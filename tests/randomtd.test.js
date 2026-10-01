// 랜덤 타워 디펜스(운명의 제단): 고리 길, 소환·확률·천장, 쌓기·합성·신화, 판매·행운 소환, 필드 한도, 보스 제한 시간
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createGame,
    step,
    callWave,
    canCallWave,
    castSkill,
    continueEndless,
    drainEvents,
    spawnEnemyAt,
    towerStats,
    TICK
} from '../src/core/game.js';
import { samplePath } from '../src/core/path.js';
import { MAPS } from '../src/core/data/maps.js';
import { RTD, GRADES, MYTHS, BOSS_HP, RTD_POOL } from '../src/core/data/randomtd.js';
import {
    summon,
    summonCost,
    rollGrade,
    upgradeOdds,
    currentOdds,
    mergeTower,
    canMerge,
    craftMythic,
    recipeStatus,
    rtdSell,
    luckySummon,
    moveTower,
    fieldCount,
    bossTimer,
    STACK
} from '../src/core/randomtd.js';
import { playRtd, smartMove, passiveMove } from './rtd-helpers.js';

const run = (st, sec, onEvents) => {
    for (let t = 0; t < sec && st.status === 'playing'; t += TICK) {
        step(st, TICK);
        const evs = drainEvents(st);
        if (onEvents) onEvents(evs);
    }
};

const game = (opts = {}) => createGame('randomtd', { seed: 11, ...opts });

/** 타워를 원하는 종류·등급으로 바꿔 놓는다 (테스트용) */
function setTower(t, type, grade, count = 1) {
    t.type = type;
    t.grade = grade;
    t.count = count;
    t.tier = GRADES[grade].tier;
    t.branch = GRADES[grade].branch ? 'a' : null;
    t.mastery = GRADES[grade].mastery || 0;
}

test('운명의 제단: 공성전 전용 디펜스 맵, 영웅 없음, 고리 길과 24~30칸', () => {
    const m = MAPS.randomtd;
    assert.equal(m.siegeOnly, true);
    assert.equal(m.genre, 'defense');
    assert.equal(m.noHero, true);
    const s = game();
    assert.ok(s.rtd && s.siege);
    assert.equal(s.hero, null);
    assert.ok(s.sockets.length >= 24 && s.sockets.length <= 30, `소켓 ${s.sockets.length}`);
    const p = s.paths[0];
    assert.equal(p.loop, true);
    // 첫 점과 끝 점이 같다 (닫힌 고리)
    assert.ok(Math.hypot(p.xs[0] - p.xs[p.count - 1], p.zs[0] - p.zs[p.count - 1]) < 0.01);
    // 한 바퀴 더 가면 같은 자리
    const a = samplePath(p, 3);
    const b = samplePath(p, 3 + p.length);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.01);
    assert.equal(s.waves.length, 40);
    assert.ok([10, 20, 30, 40].every((w) => s.waves[w - 1].boss));
    // 다른 맵은 그대로
    const d = createGame('dusk');
    assert.equal(d.rtd, undefined);
    assert.ok(!d.paths[0].loop);
});

test('고리 길: 적은 끝에 닿아도 새지 않고 계속 돈다', () => {
    const s = game();
    const e = spawnEnemyAt(s, 'grunt', s.paths[0].length - 0.2);
    run(s, 1);
    assert.ok(e.alive);
    assert.equal(s.lives, s.maxLives);
    assert.ok(e.d > s.paths[0].length);
    // 출발점 근처로 돌아왔다
    const start = samplePath(s.paths[0], 0);
    assert.ok(Math.hypot(e.x - start.x, e.z - start.z) < 2);
});

test('소환: 20골드에서 시작해 한 번마다 +2, 빈 칸에 등급 타워가 선다', () => {
    const s = game({ gold: 1000 });
    assert.equal(summonCost(s), 20);
    const r = summon(s);
    assert.ok(r.ok);
    assert.equal(s.gold, 980);
    assert.equal(summonCost(s), 22);
    assert.ok(r.grade >= 0 && r.grade <= 2, '소환은 흔함~영웅');
    const t = r.tower;
    assert.equal(t.tier, GRADES[r.grade].tier);
    // 등급이 높을수록 같은 종류의 피해가 크다
    const dmg = (g) => {
        setTower(t, 'ranger', g);
        s.statsVersion++;
        return towerStats(s, t).dmg;
    };
    assert.ok(dmg(1) > dmg(0) * 2 && dmg(2) > dmg(1) * 2 && dmg(3) > dmg(2) && dmg(4) > dmg(3));
    const poor = game({ gold: 10 });
    assert.equal(summon(poor).ok, false);
});

test('확률: 70/25/5에 맞게 나오고, 흔함 연속은 20번째에 희귀 이상 확정(천장)', () => {
    const s = game({ seed: 3 });
    const n = [0, 0, 0];
    let streak = 0;
    let maxStreak = 0;
    for (let i = 0; i < 6000; i++) {
        const { grade } = rollGrade(s);
        n[grade]++;
        streak = grade === 0 ? streak + 1 : 0;
        maxStreak = Math.max(maxStreak, streak);
    }
    const pct = n.map((k) => (k / 6000) * 100);
    assert.ok(Math.abs(pct[0] - 70) < 3, `흔함 ${pct[0]}`);
    assert.ok(Math.abs(pct[1] - 25) < 3, `희귀 ${pct[1]}`);
    assert.ok(Math.abs(pct[2] - 5) < 1.5, `영웅 ${pct[2]}`);
    assert.ok(maxStreak <= RTD.pity - 1, `흔함 최대 연속 ${maxStreak}`);
    // 천장 직전이면 이번은 반드시 희귀 이상
    s.rtd.pity = RTD.pity - 1;
    const forced = rollGrade(s);
    assert.ok(forced.forced && forced.grade >= 1);
});

test('확률 강화: 3단계, 흔함이 줄고 영웅이 는다', () => {
    const s = game({ gold: 5000 });
    const before = currentOdds(s);
    for (let i = 0; i < 3; i++) assert.ok(upgradeOdds(s).ok);
    assert.equal(upgradeOdds(s).ok, false, '최대 단계');
    const after = currentOdds(s);
    assert.ok(after[0] < before[0] && after[2] > before[2]);
    assert.equal(
        after.reduce((a, b) => a + b),
        100
    );
});

test('쌓기와 합성: 같은 타워는 한 칸에 셋까지, 셋을 합치면 한 등급 위 하나', () => {
    const s = game({ gold: 5000 });
    const t = summon(s).tower;
    // 같은 종류·등급을 새로 얻으면 그 칸에 쌓인다: 난수를 0.5로 고정하면 흔함, 종류는 풀의 가운데
    s.rtd.rand = () => 0.5;
    setTower(t, RTD_POOL[Math.floor(0.5 * RTD_POOL.length)], 0, 1);
    summon(s);
    assert.equal(t.count, 2);
    assert.equal(s.towers.length, 1);
    assert.equal(canMerge(s, t), false);
    summon(s);
    assert.equal(t.count, STACK);
    assert.ok(canMerge(s, t));
    s.rtd.rand = Math.random;
    const r = mergeTower(s, t.id);
    assert.ok(r.ok);
    assert.equal(r.tower.grade, 1);
    assert.equal(
        s.towers.reduce((n, x) => n + x.count, 0),
        1
    );
    // 전설은 합성하지 않는다
    setTower(r.tower, 'ranger', 3, 1);
    assert.equal(mergeTower(s, r.tower.id).ok, false);
});

test('합성 결과는 재료 종류를 절반쯤 잇는다 (공명 속성 계승)', () => {
    let same = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
        const s = game({ seed: 100 + i, gold: 5000 });
        const t = summon(s).tower;
        setTower(t, 'frost', 1, 3);
        const r = mergeTower(s, t.id);
        assert.equal(r.tower.grade, 2);
        if (r.tower.type === 'frost') same++;
    }
    assert.ok(Math.abs(same / N - RTD.inherit) < 0.1, `계승 ${same}/${N}`);
});

test('신화: 전설 + 정해진 영웅 둘 + 룬 파편으로만 만든다', () => {
    const s = game({ gold: 5000 });
    // 서로 다른 칸 셋 (같은 타워가 나와 쌓이면 바꿔 가며 더 소환)
    while (s.towers.length < 3) setTower(summon(s).tower, 'arcane', 4);
    const towers = s.towers;
    const recipe = MYTHS.ranger;
    setTower(towers[0], 'ranger', 3);
    setTower(towers[1], recipe.parts[0], 2);
    setTower(towers[2], recipe.parts[1], 2);
    s.statsVersion++;
    assert.equal(recipeStatus(s, 'ranger').ready, false, '룬 파편이 모자라다');
    assert.equal(craftMythic(s, 'ranger').ok, false);
    s.rtd.runes = recipe.runes;
    assert.ok(recipeStatus(s, 'ranger').ready);
    const r = craftMythic(s, 'ranger');
    assert.ok(r.ok);
    assert.equal(r.tower.grade, 4);
    assert.equal(r.tower.mastery, 2);
    assert.equal(s.rtd.runes, 0);
    assert.equal(s.towers.length, 1, '재료는 사라진다');
});

test('판매: 골드와 룬 파편, 행운 소환은 실패할수록 확률이 오른다', () => {
    const s = game({ gold: 1000 });
    const t = summon(s).tower;
    setTower(t, 'ember', 0, 2);
    const g = s.gold;
    const r = rtdSell(s, t.id);
    assert.ok(r.ok);
    assert.equal(s.gold, g + RTD.sellGold[0]);
    assert.equal(s.rtd.runes, RTD.sellRunes[0]);
    assert.equal(t.count, 1, '쌓인 것 하나만 팔린다');
    // 행운 소환: 실패하면 파편만 사라지고 다음 확률 +
    s.rtd.runes = RTD.luckCost * 2;
    s.rtd.rand = () => 0.99;
    const fail = luckySummon(s);
    assert.ok(fail.ok && !fail.success);
    assert.equal(s.rtd.luckFails, 1);
    s.rtd.rand = () => 0.1;
    const win = luckySummon(s);
    assert.ok(win.success);
    assert.equal(win.tower.grade, 2, '행운 소환은 영웅');
    assert.equal(s.rtd.luckFails, 0);
});

test('옮기기: 빈 칸으로 옮기거나 자리를 바꾼다', () => {
    const s = game({ gold: 1000 });
    const t = summon(s).tower;
    const from = t.socketId;
    const empty = s.sockets.find((x) => x.towerId == null);
    assert.ok(moveTower(s, t.id, empty.id).ok);
    assert.equal(t.socketId, empty.id);
    assert.equal(s.sockets[from].towerId, null);
    assert.equal(empty.towerId, t.id);
});

test('필드 한도: 80·90에서 경고, 100을 넘으면 패배', () => {
    const s = game();
    const warns = [];
    for (let i = 0; i < 101; i++) spawnEnemyAt(s, 'grunt', (i * 0.4) % 40);
    run(s, 0.2, (evs) => warns.push(...evs.filter((e) => e.type === 'rtdWarn').map((e) => e.level)));
    assert.equal(s.status, 'lost');
    assert.equal(s.rtd.lostBy, 'overflow');
    assert.deepEqual(warns, [2]);
    const s2 = game();
    for (let i = 0; i < 85; i++) spawnEnemyAt(s2, 'grunt', i * 0.4);
    const w2 = [];
    run(s2, 0.2, (evs) => w2.push(...evs.filter((e) => e.type === 'rtdWarn').map((e) => e.level)));
    assert.equal(s2.status, 'playing');
    assert.deepEqual(w2, [1]);
    assert.equal(fieldCount(s2), 85);
});

test('웨이브는 시간마다 저절로 온다. 준비 시간만 건너뛸 수 있고, 스킬은 없다', () => {
    const s = game();
    assert.ok(canCallWave(s));
    run(s, RTD.prep + 0.2);
    assert.equal(s.waveIndex, 1, '준비 시간이 지나면 첫 웨이브');
    assert.equal(canCallWave(s), false);
    assert.equal(callWave(s).ok, false);
    run(s, RTD.waveTime);
    assert.equal(s.waveIndex, 2);
    assert.equal(castSkill(s, 'freeze').ok, false);
    assert.equal(continueEndless(s).ok, false);
    const t = game();
    assert.ok(callWave(t).ok);
    run(t, 0.1);
    assert.equal(t.waveIndex, 1, '준비 시간 건너뛰기');
});

test('웨이브 보상과 이자: 보유 골드의 5%, 상한 50', () => {
    const s = game({ gold: 400 });
    s.waveIndex = 4;
    s.nextWaveIn = 0.01;
    const evs = [];
    run(s, 0.05, (e) => evs.push(...e));
    const inc = evs.find((e) => e.type === 'rtdIncome');
    assert.equal(inc.interest, 20);
    assert.equal(inc.reward, RTD.waveGold + RTD.waveGoldStep * 5);
    const rich = game({ gold: 5000 });
    rich.waveIndex = 4;
    rich.nextWaveIn = 0.01;
    const ev2 = [];
    run(rich, 0.05, (e) => ev2.push(...e));
    assert.equal(ev2.find((e) => e.type === 'rtdIncome').interest, RTD.interestCap);
});

test('보스: 30초 안에 못 잡으면 패배, 잡으면 룬 파편과 다음 웨이브', () => {
    const s = game();
    s.waveIndex = 9;
    s.nextWaveIn = 0.01;
    run(s, 2);
    assert.ok(bossTimer(s), '보스 시계가 돈다');
    assert.ok(s.enemies.some((e) => e.def.boss));
    assert.equal(s.nextWaveIn, null, '보스가 사는 동안 다음 웨이브는 멈춘다');
    run(s, RTD.bossTime);
    assert.equal(s.status, 'lost');
    assert.equal(s.rtd.lostBy, 'boss');

    const k = game();
    k.waveIndex = 9;
    k.nextWaveIn = 0.01;
    run(k, 2);
    const boss = k.enemies.find((e) => e.def.boss);
    boss.hp = 1;
    const evs = [];
    k.enemies.forEach((e) => (e.hp = Math.min(e.hp, 1)));
    // 아무 피해나 주어 쓰러뜨린다
    boss.alive = false;
    run(k, 0.1, (e) => evs.push(...e));
    assert.ok(evs.some((e) => e.type === 'rtdBossDown'));
    assert.equal(k.rtd.runes, RTD.bossRunes);
    assert.equal(k.status, 'playing');
    run(k, RTD.afterBoss + 0.5);
    assert.equal(k.waveIndex, 11);
    assert.ok(BOSS_HP[40] > BOSS_HP[10]);
});

test('마지막 보스를 잡으면 남은 적이 사라지고 승리', () => {
    const s = game();
    s.waveIndex = 39;
    s.nextWaveIn = 0.01;
    run(s, 2);
    spawnEnemyAt(s, 'grunt', 3);
    const boss = s.enemies.find((e) => e.def.boss);
    boss.alive = false;
    const evs = [];
    run(s, 0.1, (e) => evs.push(...e));
    assert.equal(s.status, 'won');
    assert.equal(s.enemies.length, 0);
    assert.ok(evs.some((e) => e.type === 'victory'));
});

test('밸런스(보통): 무대응은 1분 남짓에 패배', () => {
    const { state } = playRtd(null, { seed: 1 });
    assert.equal(state.status, 'lost');
    assert.ok(state.time < 90, `${state.time}s`);
});

test('밸런스(보통): 타워 8개만 두고 합성하지 않으면 패배', () => {
    const { state } = playRtd((s) => passiveMove(s, { max: 8 }), { seed: 2 });
    assert.equal(state.status, 'lost');
    assert.ok(state.waveIndex <= 20);
});

test('밸런스(보통): 소환·합성·신화를 꾸준히 하면 40웨이브를 넘긴다', () => {
    const { state } = playRtd((s) => smartMove(s), { seed: 2 });
    assert.equal(state.status, 'won');
    assert.ok(state.rtd.merges > 15);
});
