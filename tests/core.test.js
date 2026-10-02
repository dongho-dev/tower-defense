import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPath, samplePath, distanceToPath } from '../src/core/path.js';
import {
    createGame,
    step,
    buildTower,
    upgradeTower,
    sellTower,
    callWave,
    canCallWave,
    castSkill,
    towerStats,
    dealDamage,
    drainEvents,
    setTargeting,
    upgradeOptions,
    continueEndless,
    resonanceInfo,
    resonancePreview,
    estimateDps,
    wavesSurvived,
    WAVE_GAP,
    TICK
} from '../src/core/game.js';
import { MAPS } from '../src/core/data/maps.js';
import { TOWERS, TOWER_ORDER } from '../src/core/data/towers.js';
import { ENEMIES } from '../src/core/data/enemies.js';
import { WAVES, endlessWave } from '../src/core/data/waves.js';
import { runUntil } from './helpers.js';

function addEnemy(state, type, d = 5, extra = {}) {
    const def = ENEMIES[type];
    const e = {
        id: state.nextId++,
        type,
        def,
        waveNo: 1,
        elite: false,
        scale: 1,
        hp: def.hp,
        maxHp: def.hp,
        speed: def.speed,
        bounty: def.bounty,
        lives: def.lives,
        radius: def.radius,
        pathIndex: 0,
        offset: 0,
        d,
        x: 0,
        z: 0,
        dirX: 1,
        dirZ: 0,
        slow: 0,
        slowT: 0,
        stunT: 0,
        frozenT: 0,
        healT: 99,
        alive: true,
        ...extra
    };
    const p = samplePath(state.paths[0], d);
    e.x = p.x;
    e.z = p.z;
    state.enemies.push(e);
    return e;
}

test('경로: 길이·균일 샘플·끝점', () => {
    const path = buildPath([
        [0, 0],
        [10, 0]
    ]);
    assert.ok(Math.abs(path.length - 10) < 0.01);
    const mid = samplePath(path, 5);
    assert.ok(Math.abs(mid.x - 5) < 0.01 && Math.abs(mid.z) < 0.01);
    assert.equal(mid.dx, 1);
    const end = samplePath(path, 999);
    assert.ok(Math.abs(end.x - 10) < 0.01);
    assert.ok(Math.abs(distanceToPath(path, 5, 3) - 3) < 0.06);
});

test('맵 데이터: 소켓은 경로·서로와 떨어져 있고, 링크는 가까운 소켓끼리', () => {
    for (const map of Object.values(MAPS)) {
        const paths = map.paths.map(buildPath);
        map.sockets.forEach(([x, z], i) => {
            const d = Math.min(...paths.map((p) => distanceToPath(p, x, z)));
            // 살아남기 맵의 paths는 동굴→본진 대표선일 뿐 적이 걷는 길이 아니다
            if (!map.survival) assert.ok(d >= 1.3, `${map.id} 소켓 ${i}가 경로와 ${d.toFixed(2)}`);
            map.sockets.forEach(([x2, z2], j) => {
                if (j > i) assert.ok(Math.hypot(x - x2, z - z2) >= 1.4, `${map.id} 소켓 ${i}-${j} 겹침`);
            });
        });
        for (const [a, b] of map.links) {
            const [ax, az] = map.sockets[a];
            const [bx, bz] = map.sockets[b];
            assert.ok(Math.hypot(ax - bx, az - bz) <= 2.9, `${map.id} 링크 ${a}-${b}가 너무 멂`);
        }
        // 랜덤 디펜스는 전용 40웨이브 (randomtd.test.js)
        if (!map.rtd) assert.ok(WAVES[map.waves].length === 20);
    }
});

test('타워 데이터: 모든 타워가 3티어와 두 분기를 가진다', () => {
    for (const id of TOWER_ORDER) {
        const def = TOWERS[id];
        assert.equal(def.tiers.length, 3);
        assert.ok(def.branches.a && def.branches.b);
        assert.ok(def.resonance.name);
        assert.ok(def.hotkey);
    }
});

test('건설·업그레이드·분기·판매 흐름과 골드', () => {
    const s = createGame('dusk', { gold: 2000 });
    const r = buildTower(s, 0, 'ranger');
    assert.ok(r.ok);
    assert.equal(s.gold, 2000 - 70);
    assert.equal(buildTower(s, 0, 'frost').ok, false, '같은 소켓 중복 건설 불가');
    const t = r.tower;
    assert.ok(upgradeTower(s, t.id).ok);
    assert.ok(upgradeTower(s, t.id).ok);
    assert.equal(t.tier, 3);
    assert.equal(upgradeTower(s, t.id).ok, false, '레벨 3 이후엔 분기가 필요');
    assert.equal(upgradeOptions(t).length, 2);
    assert.ok(upgradeTower(s, t.id, 'a').ok);
    assert.equal(t.branch, 'a');
    assert.equal(towerStats(s, t).range, TOWERS.ranger.branches.a.range);
    const spent = t.spent;
    const before = s.gold;
    assert.ok(sellTower(s, t.id).ok);
    assert.equal(s.gold, before + Math.floor(spent * 0.7));
    assert.equal(s.sockets[0].towerId, null);
});

test('골드가 부족하면 건설 실패', () => {
    const s = createGame('dusk', { gold: 10 });
    assert.equal(buildTower(s, 0, 'ranger').ok, false);
    assert.equal(s.towers.length, 0);
});

test('공명: 연결된 다른 종류만 버프, 같은 종류는 무시', () => {
    const s = createGame('dusk', { gold: 5000 });
    // 소켓 4-5, 4-6 연결
    const a = buildTower(s, 4, 'ember').tower;
    const base = towerStats(s, a);
    assert.equal(base.dmgMult, 1);
    buildTower(s, 5, 'ranger');
    assert.ok(Math.abs(towerStats(s, a).range - TOWERS.ember.tiers[0].range * 1.12) < 1e-9);
    buildTower(s, 6, 'storm');
    assert.ok(Math.abs(towerStats(s, a).rate - TOWERS.ember.tiers[0].rate / 1.15) < 1e-9);
    const ranger = s.towers.find((t) => t.socketId === 5);
    assert.equal(towerStats(s, ranger).dmgMult, 1.15, '박격포가 궁수탑에 열기 버프');
    // 같은 종류는 버프 없음
    const s2 = createGame('dusk', { gold: 5000 });
    const x = buildTower(s2, 4, 'ranger').tower;
    buildTower(s2, 5, 'ranger');
    assert.equal(towerStats(s2, x).range, TOWERS.ranger.tiers[0].range);
});

test('피해 유형: 방어력은 물리만, 저항은 마법만 경감', () => {
    const s = createGame('dusk');
    const knight = addEnemy(s, 'ironclad');
    const hp = knight.hp;
    dealDamage(s, knight, 100, 'physical');
    assert.ok(Math.abs(hp - knight.hp - 55) < 1e-9);
    dealDamage(s, knight, 100, 'magic');
    assert.ok(Math.abs(hp - knight.hp - 155) < 1e-9);
    const wraith = addEnemy(s, 'wraith');
    dealDamage(s, wraith, 50, 'magic');
    assert.ok(Math.abs(wraith.maxHp - wraith.hp - 22.5) < 1e-9);
    const k2 = addEnemy(s, 'ironclad');
    dealDamage(s, k2, 100, 'physical', { pierce: 1 });
    assert.ok(Math.abs(k2.maxHp - k2.hp - 100) < 1e-9, '완전 관통');
});

test('처치 시 골드 보상과 death 이벤트', () => {
    const s = createGame('dusk');
    const e = addEnemy(s, 'grunt');
    const g0 = s.gold;
    dealDamage(s, e, 9999, 'true');
    assert.equal(s.gold, g0 + ENEMIES.grunt.bounty);
    assert.ok(drainEvents(s).some((ev) => ev.type === 'death'));
});

test('웨이브 흐름: 첫 호출 → 스폰 완료 → 카운트다운 → 자동 호출, 조기 호출 보너스', () => {
    const s = createGame('dusk');
    assert.ok(canCallWave(s));
    assert.ok(callWave(s).ok);
    assert.equal(canCallWave(s), false, '스폰 중에는 호출 불가');
    runUntil(s, (st) => st.nextWaveIn != null, 60);
    assert.ok(Math.abs(s.nextWaveIn - WAVE_GAP) < 0.1);
    const g0 = s.gold;
    const r = callWave(s);
    assert.ok(r.bonus > 0);
    assert.equal(s.gold, g0 + r.bonus);
    assert.equal(s.waveIndex, 2);
    // 방치하면 자동으로 다음 웨이브
    runUntil(s, (st) => st.waveIndex === 3, 200);
    assert.equal(s.waveIndex, 3);
});

test('적이 끝까지 가면 생명 감소, 0이면 패배', () => {
    const s = createGame('dusk');
    s.lives = 1;
    addEnemy(s, 'grunt', s.paths[0].length - 0.05);
    step(s, TICK * 5);
    assert.equal(s.lives, 0);
    assert.equal(s.status, 'lost');
});

test('모든 웨이브를 막으면 승리', () => {
    const s = createGame('dusk');
    s.waveIndex = s.waves.length;
    step(s, TICK);
    assert.equal(s.status, 'won');
});

test('궁수탑이 사거리 안 적을 쏘고 투사체가 명중', () => {
    const s = createGame('dusk', { gold: 1000 });
    const t = buildTower(s, 4, 'ranger').tower;
    const e = addEnemy(s, 'grunt', 0, { speed: 0 });
    // 소켓 4 바로 옆으로 적을 옮긴다
    e.x = t.x + 1;
    e.z = t.z;
    e.speed = 0;
    e.stunT = 99;
    runUntil(s, () => e.hp < e.maxHp, 3);
    assert.ok(e.hp < e.maxHp);
});

test('폭풍 오벨리스크 연쇄 번개는 여러 적을 맞춘다', () => {
    const s = createGame('dusk', { gold: 1000 });
    const t = buildTower(s, 4, 'storm').tower;
    const es = [0, 1, 2].map((i) => {
        const e = addEnemy(s, 'grunt', 0);
        e.x = t.x + 1 + i * 0.8;
        e.z = t.z;
        e.stunT = 99;
        return e;
    });
    runUntil(s, () => es.every((e) => e.hp < e.maxHp), 3);
    assert.ok(es.every((e) => e.hp < e.maxHp));
});

test('서리 첨탑은 둔화를 건다', () => {
    const s = createGame('dusk', { gold: 1000 });
    const t = buildTower(s, 4, 'frost').tower;
    const e = addEnemy(s, 'grunt', 0);
    e.x = t.x + 1;
    e.z = t.z;
    e.stunT = 99;
    runUntil(s, () => e.slow > 0, 3);
    assert.ok(e.slow >= 0.3);
});

test('스킬: 첫 웨이브 전에는 불가, 이후 쿨다운', () => {
    const s = createGame('dusk');
    assert.equal(castSkill(s, 'freeze').ok, false);
    callWave(s);
    runUntil(s, (st) => st.enemies.length > 0, 5);
    assert.ok(castSkill(s, 'freeze').ok);
    assert.ok(s.enemies.every((e) => e.stunT > 2));
    assert.equal(castSkill(s, 'freeze').ok, false);
    const e = s.enemies[0];
    assert.ok(castSkill(s, 'meteor', e.x, e.z).ok);
    const hp = e.hp;
    runUntil(s, (st) => st.meteors.length === 0, 2);
    assert.ok(!e.alive || e.hp < hp);
});

test('보스는 빙결 지속시간을 30%만 받는다', () => {
    const s = createGame('dusk');
    s.waveIndex = 1;
    const boss = addEnemy(s, 'colossus');
    castSkill(s, 'freeze');
    assert.ok(Math.abs(boss.stunT - 2.5 * 0.3) < 1e-9);
});

test('타겟팅 모드 변경', () => {
    const s = createGame('dusk', { gold: 500 });
    const t = buildTower(s, 4, 'ranger').tower;
    assert.ok(setTargeting(s, t.id, 'strong').ok);
    assert.equal(t.targeting, 'strong');
    assert.equal(setTargeting(s, t.id, 'nope').ok, false);
});

test('난이도: 쉬움은 골드·생명 여유, 영웅은 생명 1', () => {
    const easy = createGame('dusk', { difficulty: 'easy' });
    const normal = createGame('dusk');
    const hero = createGame('dusk', { difficulty: 'hero' });
    assert.equal(normal.difficulty, 'normal');
    assert.ok(easy.gold > normal.gold && easy.lives > normal.lives && easy.hpMul < normal.hpMul);
    assert.equal(hero.lives, 1);
    addEnemy(hero, 'grunt', hero.paths[0].length - 0.05);
    step(hero, TICK * 5);
    assert.equal(hero.status, 'lost', '영웅은 한 마리만 새도 패배');
});

test('끝없는 밤: 승리 후 이어 가면 21웨이브 이후가 생성된다', () => {
    const s = createGame('frostvale');
    s.waveIndex = s.waves.length;
    step(s, TICK);
    assert.equal(s.status, 'won');
    assert.ok(continueEndless(s).ok);
    assert.equal(s.status, 'playing');
    assert.equal(s.waves.length, 22, '다음 웨이브까지 미리 만들어 둔다');
    assert.equal(WAVES.frostvale.length, 20, '원본 캠페인 웨이브는 그대로');
    runUntil(s, (st) => st.waveIndex === 21, 30);
    assert.equal(s.waveIndex, 21);
    assert.ok(s.waves.length >= 22);
    s.lives = 0;
    s.status = 'lost';
    assert.equal(wavesSurvived(s), 20);
});

test('끝없는 밤 웨이브: 결정적이고, 경로 범위 안이며, 5웨이브마다 거상', () => {
    for (let n = 21; n <= 60; n++) {
        const a = endlessWave(n, 3, 7);
        assert.deepEqual(a, endlessWave(n, 3, 7));
        assert.ok(a.groups.every((g) => g.path >= 0 && g.path < 3 && g.count > 0));
        assert.equal(
            a.groups.some((g) => g.enemy === 'colossus'),
            (n - 20) % 5 === 0
        );
    }
});

test('끝없는 밤으로 시작하면 20웨이브를 넘겨도 승리하지 않는다', () => {
    const s = createGame('dusk', { endless: true });
    s.waveIndex = 20;
    step(s, TICK);
    assert.equal(s.status, 'playing');
});

test('각성: 분기 이후 두 단계 더 강화된다', () => {
    const s = createGame('dusk', { gold: 9999 });
    const t = buildTower(s, 4, 'ranger').tower;
    upgradeTower(s, t.id);
    upgradeTower(s, t.id);
    upgradeTower(s, t.id, 'b');
    const before = towerStats(s, t).dmg;
    assert.ok(upgradeTower(s, t.id).ok);
    assert.ok(upgradeTower(s, t.id).ok);
    assert.equal(t.mastery, 2);
    assert.equal(upgradeTower(s, t.id).ok, false);
    assert.ok(Math.abs(towerStats(s, t).dmg - before * 1.5) < 1e-9);
    assert.equal(upgradeOptions(t).length, 0);
});

test('에테르 광산: 공격하지 않고 다음 웨이브부터 수입', () => {
    const s = createGame('dusk', { gold: 1000 });
    buildTower(s, 4, 'mine');
    callWave(s);
    const g0 = s.gold;
    runUntil(s, (st) => st.nextWaveIn != null, 60);
    const g1 = s.gold;
    callWave(s);
    assert.ok(drainEvents(s).some((e) => e.type === 'income'));
    assert.ok(s.gold - g1 >= 20, '웨이브를 부르면 광산 수입');
    void g0;
});

test('풍요: 광산과 연결된 타워의 처치 골드 +25%', () => {
    const s = createGame('dusk', { gold: 1000 });
    const t = buildTower(s, 4, 'ranger').tower;
    buildTower(s, 5, 'mine');
    const e = addEnemy(s, 'grunt');
    const g0 = s.gold;
    dealDamage(s, e, 9999, 'true', { tower: t });
    assert.equal(s.gold - g0, Math.round(ENEMIES.grunt.bounty * 1.25));
});

test('마력 침투: 광선탑과 연결된 타워는 방어를 25% 무시', () => {
    const s = createGame('dusk', { gold: 1000 });
    const t = buildTower(s, 4, 'ranger').tower;
    buildTower(s, 5, 'arcane');
    const k = addEnemy(s, 'ironclad');
    dealDamage(s, k, 100, 'physical', { tower: t });
    assert.ok(Math.abs(k.maxHp - k.hp - 100 * (1 - 0.45 * 0.75)) < 1e-9);
});

test('비전 광선: 같은 적을 오래 비출수록 강해진다', () => {
    const s = createGame('dusk', { gold: 1000 });
    const t = buildTower(s, 4, 'arcane').tower;
    const e = addEnemy(s, 'ironclad', 0, { hp: 1e6, maxHp: 1e6 });
    e.x = t.x + 1;
    e.z = t.z;
    e.stunT = 999;
    runUntil(s, () => false, 1);
    const early = 1e6 - e.hp;
    runUntil(s, () => false, 3);
    const hp = e.hp;
    runUntil(s, () => false, 1);
    assert.ok(hp - e.hp > early * 2, '3초 후엔 첫 1초보다 훨씬 세다');
    assert.ok(estimateDps(s, t) > 0);
});

test('공명 정보: 받는 것·주는 것·빈 연결', () => {
    const s = createGame('dusk', { gold: 1000 });
    const a = buildTower(s, 4, 'ember').tower;
    const pv = resonancePreview(s, 5, 'ranger');
    assert.equal(pv.received.length, 1);
    assert.equal(pv.received[0].type, 'ember');
    assert.equal(pv.given.length, 1);
    buildTower(s, 5, 'ranger');
    const info = resonanceInfo(s, a);
    assert.equal(info.received[0].type, 'ranger');
    assert.equal(info.given[0].type, 'ranger');
    assert.ok(info.openLinks >= 1);
});
