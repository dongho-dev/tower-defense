const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { setupDom } = require('./helpers');

describe('Unit tests', () => {
    let game, window;
    let calculateTowerDamage, calculateUpgradeCost, getWaveEnemyCount, getWaveEnemyStats;
    let applyExplosion, sellTower, hexToRgba, applyAlpha;
    let enemies, towers, canBuildAt, findTarget, createTowerData, upgradeTower;
    let damageEnemy, damageEnemyAtIndex, pickEnemyType, pathTiles;
    let ENEMY_TYPE_DEFINITIONS, GRID_COLS, GRID_ROWS, TOWER_MAX_LEVEL;
    let projectiles, lerpAngle, resetGame, buildMapData, handleLaserAttack;
    let getWaypoints, getWave, getLives, update, spawnEnemy;
    let getAdjustedPickRadius, getGameLoopHalted, towerPositionSet;
    let getRenderDirty, initKbCursor, moveKbCursor, activateKbCursor;
    let getKbCursor, getKbCursorActive, ENEMY_TYPE_MAP;
    const mockStyle = { body: '#fff', core: '#fff', outline: '#000', halo: 'rgba(255,255,255,0.5)' };

    before(() => {
        ({ game, window } = setupDom());
        ({
            calculateTowerDamage,
            calculateUpgradeCost,
            getWaveEnemyCount,
            getWaveEnemyStats,
            applyExplosion,
            sellTower,
            hexToRgba,
            applyAlpha,
            enemies,
            towers,
            canBuildAt,
            findTarget,
            createTowerData,
            upgradeTower,
            damageEnemy,
            damageEnemyAtIndex,
            pickEnemyType,
            pathTiles,
            ENEMY_TYPE_DEFINITIONS,
            GRID_COLS,
            GRID_ROWS,
            TOWER_MAX_LEVEL,
            projectiles,
            lerpAngle,
            resetGame,
            buildMapData,
            handleLaserAttack,
            getWaypoints,
            getWave,
            getLives,
            update,
            spawnEnemy,
            getAdjustedPickRadius,
            getGameLoopHalted,
            towerPositionSet,
            getRenderDirty,
            initKbCursor,
            moveKbCursor,
            activateKbCursor,
            getKbCursor,
            getKbCursorActive,
            ENEMY_TYPE_MAP
        } = game);
    });

    it('calculateTowerDamage: level scaling', () => {
        const basicDef = { baseDamage: 20 };
        assert.strictEqual(
            calculateTowerDamage(basicDef, 1),
            20,
            'calculateTowerDamage: 레벨 1 피해는 baseDamage와 동일'
        );
        assert.strictEqual(
            calculateTowerDamage(basicDef, 2),
            parseFloat((20 * 1.5).toFixed(4)),
            'calculateTowerDamage: 레벨 2 피해는 baseDamage * TOWER_DAMAGE_GROWTH(1.5)'
        );
        assert.strictEqual(
            calculateTowerDamage(basicDef, 5),
            parseFloat((20 * Math.pow(1.5, 4)).toFixed(4)),
            'calculateTowerDamage: 레벨 5 피해는 baseDamage * 1.5^4'
        );
    });

    it('calculateUpgradeCost: level scaling', () => {
        const def40 = { baseUpgradeCost: 40 };
        assert.strictEqual(calculateUpgradeCost(def40, 1), 40, 'calculateUpgradeCost: 레벨 1 비용 = baseUpgradeCost');
        assert.strictEqual(
            calculateUpgradeCost(def40, 2),
            Math.round(40 * 1.6),
            'calculateUpgradeCost: 레벨 2 비용 = base * TOWER_UPGRADE_COST_MULTIPLIER(1.6)'
        );
        const costAtMax = calculateUpgradeCost(def40, 15);
        assert.ok(costAtMax > 0, 'calculateUpgradeCost: 레벨 15에서도 비용 계산은 양수');
    });

    it('getWaveEnemyCount: wave enemy count formula', () => {
        assert.strictEqual(getWaveEnemyCount(1), 9, 'getWaveEnemyCount: 웨이브 1 = 8 + floor(1.5) = 9');
        assert.strictEqual(getWaveEnemyCount(10), 23, 'getWaveEnemyCount: 웨이브 10 = 8 + floor(15) = 23');
    });

    it('getWaveEnemyStats: HP and speed scaling', () => {
        const stats1 = getWaveEnemyStats(1);
        assert.strictEqual(stats1.hp, 78, 'getWaveEnemyStats: 웨이브 1 체력 = ENEMY_BASE_HP(78)');
        assert.strictEqual(stats1.speed, 49, 'getWaveEnemyStats: 웨이브 1 속도 = ENEMY_SPEED(49)');

        const stats2 = getWaveEnemyStats(2);
        assert.strictEqual(stats2.hp, Math.round(78 * 1.18), 'getWaveEnemyStats: 웨이브 2 체력 = 78 * 1.18');
    });

    it('getWaveEnemyStats: high wave Infinity defense', () => {
        const statsHigh = getWaveEnemyStats(9999);
        assert.ok(Number.isFinite(statsHigh.hp), 'getWaveEnemyStats: 웨이브 9999 체력은 유한수');
        assert.ok(
            statsHigh.hp <= Number.MAX_SAFE_INTEGER,
            'getWaveEnemyStats: 웨이브 9999 체력은 MAX_SAFE_INTEGER 이하'
        );
    });

    it('getWaveEnemyStats: reward scaling', () => {
        const reward1 = getWaveEnemyStats(1).reward;
        assert.strictEqual(reward1, Math.round(14 + 1 * 1.5), 'getWaveEnemyStats: 웨이브 1 보상 = 14 + 1*1.5');
        const reward10 = getWaveEnemyStats(10).reward;
        assert.strictEqual(reward10, Math.round(14 + 10 * 1.5), 'getWaveEnemyStats: 웨이브 10 보상 = 14 + 10*1.5');
    });

    it('getWaveEnemyStats: armored type', () => {
        const armoredType = ENEMY_TYPE_DEFINITIONS.find((t) => t.id === 'armored');
        const armoredStats = getWaveEnemyStats(1, armoredType);
        assert.strictEqual(armoredStats.hp, Math.round(78 * 3.0), 'getWaveEnemyStats: 장갑 웨이브 1 체력 = 78 * 3.0');
        assert.strictEqual(
            armoredStats.speed,
            Math.round(49 * 0.6 * (1 + 1 * 0.005)),
            'getWaveEnemyStats: 장갑 웨이브 1 속도 = 49 * 0.6 * speedBonus'
        );
        assert.strictEqual(
            armoredStats.reward,
            Math.round((14 + 1 * 1.5) * 2.0),
            'getWaveEnemyStats: 장갑 보상 = base * 2.0'
        );
    });

    it('getWaveEnemyStats: fast type', () => {
        const fastType = ENEMY_TYPE_DEFINITIONS.find((t) => t.id === 'fast');
        const fastStats = getWaveEnemyStats(1, fastType);
        assert.strictEqual(fastStats.hp, Math.round(78 * 0.4), 'getWaveEnemyStats: 고속 웨이브 1 체력 = 78 * 0.4');
        assert.strictEqual(
            fastStats.speed,
            Math.round(49 * 2.5 * (1 + 1 * 0.005)),
            'getWaveEnemyStats: 고속 웨이브 1 속도 = 49 * 2.5 * speedBonus'
        );
    });

    it('getWaveEnemyStats: boss type', () => {
        const bossType = ENEMY_TYPE_DEFINITIONS.find((t) => t.id === 'boss');
        const bossStats = getWaveEnemyStats(1, bossType);
        assert.strictEqual(bossStats.hp, Math.round(78 * 12.0), 'getWaveEnemyStats: 보스 웨이브 1 체력 = 78 * 12.0');
        assert.strictEqual(
            bossStats.reward,
            Math.round((14 + 1 * 1.5) * 8.0),
            'getWaveEnemyStats: 보스 보상 = base * 8.0'
        );
    });

    it('hexToRgba: color conversion', () => {
        assert.strictEqual(hexToRgba('#ff0000', 0.5), 'rgba(255, 0, 0, 0.5)', 'hexToRgba: 6자리 빨간색');
        assert.strictEqual(hexToRgba('#f00', 0.5), 'rgba(255, 0, 0, 0.5)', 'hexToRgba: 3자리 빨간색');
        assert.strictEqual(hexToRgba(null, 0.5), 'rgba(255, 255, 255, 0.5)', 'hexToRgba: null 입력');
    });

    it('applyAlpha: alpha application', () => {
        assert.strictEqual(applyAlpha('#00ff00', 0.3), hexToRgba('#00ff00', 0.3), 'applyAlpha: hex 색상 변환');
        assert.ok(applyAlpha(null, 0.5).includes('255, 255, 255'), 'applyAlpha: null 색상은 흰색 기본값');
        assert.strictEqual(applyAlpha('blue', 0.5), 'blue', 'applyAlpha: 지원하지 않는 형식은 그대로 반환');
        const rgbaResult = applyAlpha('rgba(100, 200, 50, 0.8)', 0.3);
        assert.ok(rgbaResult.includes('100'), 'applyAlpha: rgba 입력 시 R 값 유지');
        assert.ok(rgbaResult.includes('200'), 'applyAlpha: rgba 입력 시 G 값 유지');
        assert.ok(rgbaResult.includes('0.3'), 'applyAlpha: rgba 입력 시 알파 값 교체');
    });

    it('sellTower: normal sale', () => {
        enemies.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        const mockTower = {
            x: 0,
            y: 0,
            worldX: 15,
            worldY: 15,
            type: 'basic',
            level: 1,
            spentGold: 100,
            cooldown: 0,
            activeBeam: null,
            heading: 0,
            aimAngle: null,
            flashTimer: 0,
            recoil: 0,
            auraOffset: 0,
            range: 165,
            fireDelay: 0.6,
            damage: 20,
            upgradeCost: 40
        };
        towers.push(mockTower);
        towerPositionSet.add('0,0');
        game.setGold(500);
        const goldBefore = game.gold();
        const soldResult = sellTower(mockTower);
        assert.strictEqual(soldResult, true, 'sellTower: 정상 판매 시 true 반환');
        assert.strictEqual(towers.length, 0, 'sellTower: 판매 후 towers 배열에서 제거');
        const expectedRefund = Math.floor(100 * 0.5);
        assert.strictEqual(game.gold(), goldBefore + expectedRefund, 'sellTower: 판매 시 50% 골드 환급');
    });

    it('sellTower: gameOver prevents sale', () => {
        enemies.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        const mockTower2 = {
            x: 1,
            y: 1,
            worldX: 45,
            worldY: 45,
            type: 'basic',
            level: 1,
            spentGold: 100,
            cooldown: 0,
            activeBeam: null,
            heading: 0,
            aimAngle: null,
            flashTimer: 0,
            recoil: 0,
            auraOffset: 0,
            range: 165,
            fireDelay: 0.6,
            damage: 20,
            upgradeCost: 40
        };
        towers.push(mockTower2);
        towerPositionSet.add('1,1');
        game.setGameOver(true);
        const sellWhenOver = sellTower(mockTower2);
        assert.strictEqual(sellWhenOver, false, 'sellTower: gameOver 상태에서 판매 불가');
        assert.strictEqual(towers.length, 1, 'sellTower: gameOver 시 towers 배열 유지');
        game.setGameOver(false);
    });

    it('canBuildAt: boundary checks', () => {
        enemies.length = 0;
        towers.length = 0;
        assert.strictEqual(canBuildAt(-1, 0), false, 'canBuildAt: x < 0 은 건설 불가');
        assert.strictEqual(canBuildAt(0, -1), false, 'canBuildAt: y < 0 은 건설 불가');
        assert.strictEqual(canBuildAt(GRID_COLS, 0), false, 'canBuildAt: x >= GRID_COLS 은 건설 불가');
        assert.strictEqual(canBuildAt(0, GRID_ROWS), false, 'canBuildAt: y >= GRID_ROWS 은 건설 불가');
    });

    it('canBuildAt: path and tower blocking', () => {
        enemies.length = 0;
        towers.length = 0;
        towerPositionSet.clear();

        const testPathKey = '5,5';
        pathTiles.add(testPathKey);
        assert.strictEqual(canBuildAt(5, 5), false, 'canBuildAt: 경로 타일 위에 건설 불가');
        pathTiles.delete(testPathKey);

        towers.push({ x: 3, y: 3 });
        towerPositionSet.add('3,3');
        assert.strictEqual(canBuildAt(3, 3), false, 'canBuildAt: 기존 타워 위에 건설 불가');
        towers.length = 0;
        towerPositionSet.clear();

        pathTiles.delete('1,1');
        assert.strictEqual(canBuildAt(1, 1), true, 'canBuildAt: 빈 타일에 건설 가능');
        towers.length = 0;
    });

    it('createTowerData: basic tower creation', () => {
        enemies.length = 0;
        towers.length = 0;
        const towerData = createTowerData(2, 3, 'basic');
        assert.strictEqual(towerData.type, 'basic', 'createTowerData: 타입 필드 확인');
        assert.strictEqual(towerData.x, 2, 'createTowerData: x 좌표');
        assert.strictEqual(towerData.y, 3, 'createTowerData: y 좌표');
        assert.strictEqual(towerData.level, 1, 'createTowerData: 초기 레벨 = 1');
        assert.strictEqual(towerData.cooldown, 0, 'createTowerData: 초기 쿨다운 = 0');
        assert.ok(towerData.range > 0, 'createTowerData: 사거리 > 0');
        assert.ok(towerData.damage > 0, 'createTowerData: 피해량 > 0');
        assert.ok(towerData.worldX > 0, 'createTowerData: worldX 계산됨');
        assert.ok(towerData.worldY > 0, 'createTowerData: worldY 계산됨');
        assert.ok(towerData.spentGold > 0, 'createTowerData: spentGold = cost');
    });

    it('upgradeTower: success, gold shortage, max level', () => {
        enemies.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        game.setGold(10000);
        const upgTower = createTowerData(4, 4, 'basic');
        towers.push(upgTower);
        towerPositionSet.add('4,4');
        const upgResult = upgradeTower(upgTower);
        assert.strictEqual(upgResult, true, 'upgradeTower: 골드 충분 시 업그레이드 성공');
        assert.strictEqual(upgTower.level, 2, 'upgradeTower: 업그레이드 후 레벨 2');

        game.setGold(0);
        const upgFail = upgradeTower(upgTower);
        assert.strictEqual(upgFail, false, 'upgradeTower: 골드 부족 시 실패');
        assert.strictEqual(upgTower.level, 2, 'upgradeTower: 골드 부족 시 레벨 유지');

        game.setGold(999999);
        upgTower.level = TOWER_MAX_LEVEL;
        const upgMax = upgradeTower(upgTower);
        assert.strictEqual(upgMax, false, 'upgradeTower: 최대 레벨에서 업그레이드 불가');
        assert.strictEqual(upgTower.level, TOWER_MAX_LEVEL, 'upgradeTower: 최대 레벨 유지');
        towers.length = 0;
        towerPositionSet.clear();
    });

    it('upgradeTower: gameOver prevents upgrade', () => {
        enemies.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        game.setGold(10000);
        const upgTowerGO = createTowerData(5, 5, 'basic');
        towers.push(upgTowerGO);
        towerPositionSet.add('5,5');
        game.setGameOver(true);
        const upgGameOver = upgradeTower(upgTowerGO);
        assert.strictEqual(upgGameOver, false, 'upgradeTower: gameOver 상태에서 업그레이드 불가');
        assert.strictEqual(upgTowerGO.level, 1, 'upgradeTower: gameOver 시 레벨 유지');
        game.setGameOver(false);
        towers.length = 0;
        towerPositionSet.clear();
    });

    it('findTarget: range detection', () => {
        enemies.length = 0;
        towers.length = 0;
        const testTower = { worldX: 100, worldY: 100, range: 150 };

        enemies.push({
            x: 120,
            y: 120,
            hp: 50,
            maxHp: 50,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 2
        });
        const result = findTarget(testTower);
        assert.ok(result !== null, 'findTarget: 사거리 내 적 발견');
        assert.strictEqual(result.enemy.x, 120, 'findTarget: 올바른 적 반환');
        assert.strictEqual(result.index, 0, 'findTarget: 올바른 인덱스 반환');

        enemies.length = 0;
        enemies.push({
            x: 900,
            y: 900,
            hp: 50,
            maxHp: 50,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 0
        });
        const noResult = findTarget(testTower);
        assert.strictEqual(noResult, null, 'findTarget: 사거리 밖 적은 타겟 안됨');
        enemies.length = 0;
    });

    it('damageEnemy: kill', () => {
        enemies.length = 0;
        towers.length = 0;
        game.setGold(0);
        const killEnemy = {
            x: 50,
            y: 50,
            hp: 10,
            maxHp: 10,
            reward: 20,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 0
        };
        enemies.push(killEnemy);
        const killed = damageEnemy(killEnemy, 100);
        assert.strictEqual(killed, true, 'damageEnemy: 치명적 피해 시 true 반환');
        assert.strictEqual(enemies.length, 0, 'damageEnemy: 적 제거됨');
        assert.strictEqual(game.gold(), 20, 'damageEnemy: 적 처치 시 골드 획득');
    });

    it('damageEnemy: no-kill', () => {
        enemies.length = 0;
        game.setGold(0);
        const tankEnemy = {
            x: 60,
            y: 60,
            hp: 200,
            maxHp: 200,
            reward: 15,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 0
        };
        enemies.push(tankEnemy);
        const notKilled = damageEnemy(tankEnemy, 50);
        assert.strictEqual(notKilled, false, 'damageEnemy: 비치명적 피해 시 false 반환');
        assert.strictEqual(enemies.length, 1, 'damageEnemy: 적 생존');
        assert.strictEqual(tankEnemy.hp, 150, 'damageEnemy: HP 감소 확인');
        assert.strictEqual(game.gold(), 0, 'damageEnemy: 미처치 시 골드 미획득');
        enemies.length = 0;
    });

    it('applyExplosion: area damage + gold reward', () => {
        enemies.length = 0;
        towers.length = 0;
        game.setGold(0);
        enemies.push({
            x: 100,
            y: 100,
            hp: 100,
            maxHp: 100,
            reward: 14,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 0
        });
        enemies.push({
            x: 500,
            y: 500,
            hp: 100,
            maxHp: 100,
            reward: 14,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 0
        });
        const mockProjectile = {
            damage: 200,
            explosionRadius: 200,
            explosionColor: 'rgba(0,0,0,0)',
            explosionHaloColor: '#fff',
            explosionStrokeColor: null,
            explosionLife: 0.1
        };
        applyExplosion(mockProjectile, 100, 100);
        assert.strictEqual(enemies.length, 1, 'applyExplosion: 범위(200px) 내 적 1마리 제거');
        assert.ok(enemies[0].x === 500, 'applyExplosion: 범위 밖 적(500,500)은 생존');
        assert.strictEqual(game.gold(), 14, 'applyExplosion: 처치된 적의 골드 보상 획득');
        enemies.length = 0;
    });

    it('pickEnemyType: wave-based type selection', () => {
        gameState.bossSpawned = false;
        const normalType = pickEnemyType(1);
        assert.strictEqual(normalType.id, 'normal', 'pickEnemyType: 웨이브 1은 일반 적');
        const normalType2 = pickEnemyType(2);
        assert.strictEqual(normalType2.id, 'normal', 'pickEnemyType: 웨이브 2는 일반 적');

        gameState.bossSpawned = false;
        const bossResult = pickEnemyType(10);
        assert.strictEqual(bossResult.id, 'boss', 'pickEnemyType: 웨이브 10 + bossSpawned=false = 보스');
        gameState.bossSpawned = false;
        const bossResult2 = pickEnemyType(20);
        assert.strictEqual(bossResult2.id, 'boss', 'pickEnemyType: 웨이브 20 + bossSpawned=false = 보스');

        gameState.bossSpawned = true;
        const noBoss = pickEnemyType(10);
        assert.ok(noBoss.id !== 'boss', 'pickEnemyType: bossSpawned=true이면 보스 아님');

        gameState.bossSpawned = false;
        for (let i = 0; i < 20; i++) {
            const result = pickEnemyType(5);
            assert.ok(
                ENEMY_TYPE_DEFINITIONS.some((t) => t.id === result.id),
                'pickEnemyType: 웨이브 5 반환값은 유효한 적 타입'
            );
        }
        gameState.bossSpawned = false;
    });

    it('lerpAngle: angle interpolation', () => {
        assert.strictEqual(lerpAngle(0, Math.PI, 0), 0, 'lerpAngle: t=0이면 현재 각도 유지');
        const fullLerp = lerpAngle(0, 1.0, 1);
        assert.ok(Math.abs(fullLerp - 1.0) < 0.0001, 'lerpAngle: t=1이면 목표 각도 도달');
        const wrapResult = lerpAngle(0, -0.1, 1);
        assert.ok(Math.abs(wrapResult - -0.1) < 0.0001, 'lerpAngle: 음의 방향 짧은 경로');
        const wrapResult2 = lerpAngle(0.1, Math.PI * 2 - 0.1, 1);
        assert.ok(Math.abs(wrapResult2 - -0.1) < 0.0001, 'lerpAngle: 2pi 경계 wrap-around');
        assert.strictEqual(lerpAngle(1.5, 1.5, 0.5), 1.5, 'lerpAngle: 동일 각도면 변화 없음');
    });

    it('resetGame: state reset', () => {
        towerPositionSet.clear();
        game.setGold(9999);
        game.setGameOver(true);
        enemies.push({ x: 0, y: 0, hp: 1, maxHp: 1, reward: 1, waveIndex: 1, enemyType: mockStyle, waypoint: 0 });
        towers.push({
            x: 0,
            y: 0,
            worldX: 15,
            worldY: 15,
            type: 'basic',
            level: 1,
            spentGold: 35,
            cooldown: 0,
            activeBeam: null,
            heading: 0,
            aimAngle: null,
            flashTimer: 0,
            recoil: 0,
            auraOffset: 0,
            range: 165,
            fireDelay: 0.6,
            damage: 20,
            upgradeCost: 40
        });
        resetGame();
        assert.strictEqual(game.gold(), 100, 'resetGame: 골드 100으로 초기화');
        assert.strictEqual(getLives(), 20, 'resetGame: 생명력 20으로 초기화');
        assert.strictEqual(getWave(), 1, 'resetGame: 웨이브 1로 초기화');
        assert.strictEqual(game.getGameOver(), false, 'resetGame: gameOver false로 초기화');
        assert.strictEqual(towers.length, 0, 'resetGame: 타워 배열 비움');
        assert.strictEqual(enemies.length, 0, 'resetGame: 적 배열 비움');
    });

    it('buildMapData: map switching', () => {
        buildMapData('map1');
        const wp1 = getWaypoints();
        assert.ok(wp1.length > 0, 'buildMapData: map1 waypoints 생성');
        const pathSize1 = pathTiles.size;
        assert.ok(pathSize1 > 0, 'buildMapData: map1 pathTiles 생성');

        buildMapData('map2');
        const wp2 = getWaypoints();
        assert.ok(wp2.length > 0, 'buildMapData: map2 waypoints 생성');
        assert.ok(wp2[0].x !== wp1[0].x || wp2[0].y !== wp1[0].y, 'buildMapData: map2 시작점이 map1과 다름');
        const pathSize2 = pathTiles.size;
        assert.ok(pathSize2 > 0, 'buildMapData: map2 pathTiles 생성');

        buildMapData('map1');
    });

    it('handleLaserAttack: continuous damage', () => {
        enemies.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        game.setGold(0);
        const laserTower = createTowerData(5, 5, 'laser');
        towers.push(laserTower);
        towerPositionSet.add('5,5');
        const laserEnemy = {
            x: laserTower.worldX + 30,
            y: laserTower.worldY,
            hp: 1000,
            maxHp: 1000,
            reward: 10,
            waveIndex: 1,
            speed: 49,
            waypoint: 0,
            enemyType: mockStyle,
            heading: 0,
            pulseSeed: 0
        };
        enemies.push(laserEnemy);
        handleLaserAttack(laserTower, 0.1, laserTower.def);
        assert.ok(laserEnemy.hp < 1000, 'handleLaserAttack: dt 기반 지속 피해 적용');
        assert.ok(laserTower.activeBeam !== null, 'handleLaserAttack: 빔 상태 활성화');
        assert.ok(laserTower.activeBeam.alpha > 0, 'handleLaserAttack: 빔 알파 > 0');
        enemies.length = 0;
        handleLaserAttack(laserTower, 0.1, laserTower.def);
        assert.strictEqual(laserTower.aimAngle, null, 'handleLaserAttack: 타겟 없으면 aimAngle null');
        towers.length = 0;
        towerPositionSet.clear();
        enemies.length = 0;
    });

    it('#73: late wave balance - speed scaling', () => {
        const stats50 = getWaveEnemyStats(50);
        assert.strictEqual(
            stats50.speed,
            Math.round(49 * (1 + Math.min(50 * 0.005, 0.5))),
            'getWaveEnemyStats: 웨이브 50 속도 보정 (1.25배)'
        );
        assert.ok(stats50.speed > 49, 'getWaveEnemyStats: 웨이브 50 속도 > 기본 속도');
        const stats200 = getWaveEnemyStats(200);
        assert.strictEqual(stats200.speed, Math.round(49 * 1.5), 'getWaveEnemyStats: 웨이브 200 속도 캡 (1.5배)');
        const stats9999speed = getWaveEnemyStats(9999);
        assert.strictEqual(stats9999speed.speed, Math.round(49 * 1.5), 'getWaveEnemyStats: 웨이브 9999 속도 캡 유지');
    });

    it('#69: buildStaticLayer offCtx null safety', () => {
        const origGetContext = window.HTMLCanvasElement.prototype.getContext;
        window.HTMLCanvasElement.prototype.getContext = () => null;
        let buildStaticLayerError = false;
        try {
            game.buildStaticLayer();
        } catch (e) {
            buildStaticLayerError = true;
        }
        assert.strictEqual(buildStaticLayerError, false, 'buildStaticLayer: offCtx null 시 크래시 없음');
        window.HTMLCanvasElement.prototype.getContext = origGetContext;
    });

    it('#68: input validation - setGameSpeed', () => {
        game.setGameSpeed(100);
        assert.strictEqual(game.getGameSpeed(), 5, 'setGameSpeed: 상한 100 → 5로 클램핑');
        game.setGameSpeed(NaN);
        assert.strictEqual(game.getGameSpeed(), 1, 'setGameSpeed: NaN → 기본값 1');
        game.setGameSpeed(3);
        assert.strictEqual(game.getGameSpeed(), 3, 'setGameSpeed: 정상값 3 유지');
        game.setGameSpeed(1);
    });

    it('#68: input validation - setGold', () => {
        game.setGold(9999999);
        assert.strictEqual(game.gold(), 999999, 'setGold: 상한 9999999 → 999999로 클램핑');
        game.setGold(100);
        game.setGold(NaN);
        assert.strictEqual(game.gold(), 100, 'setGold: NaN 시 값 변경 없음');
        game.setGold(-100);
        assert.strictEqual(game.gold(), 0, 'setGold: 음수 → 0으로 클램핑');
    });

    it('#68: input validation - setWave, setLives', () => {
        game.setWave(99999);
        assert.strictEqual(game.getWave(), 9999, 'setWave: 99999 → WAVE_MAX(9999)로 클램핑');
        game.setWave(1);

        game.setLives(-5);
        assert.strictEqual(game.getLives(), 0, 'setLives: -5 → 0으로 클램핑');
        game.setLives(20);
    });

    it('#75: ARIA/screen reader accessibility', () => {
        const document = global.document;
        const wavePreview = document.getElementById('wave-preview');
        assert.strictEqual(
            wavePreview.getAttribute('aria-live'),
            'polite',
            '#75: wave-preview에 aria-live="polite" 추가됨'
        );

        const towerList = document.getElementById('tower-list');
        assert.strictEqual(
            towerList.getAttribute('role'),
            'radiogroup',
            '#75: tower-list의 role이 radiogroup으로 변경됨'
        );

        const goldEl = document.getElementById('gold');
        const goldChip = goldEl.closest('.stat-chip');
        assert.strictEqual(
            goldChip.getAttribute('aria-live'),
            'polite',
            '#166: 골드 stat-chip에 aria-live="polite" 적용'
        );

        const speedBtn = document.querySelector('.speed-button[data-speed="2"]');
        const announcer = document.getElementById('a11y-announcer');
        speedBtn.click();
        assert.strictEqual(
            announcer.textContent,
            '',
            '#75: 속도 버튼 클릭 시 announce가 rAF로 텍스트 설정 (동기 시점 빈 문자열)'
        );
    });

    it('#80: upgrade-tower-button CSS', () => {
        const cssContent = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf-8');
        assert.ok(cssContent.includes('#upgrade-tower-button'), '#80: style.css에 #upgrade-tower-button 규칙 존재');
        assert.ok(
            cssContent.includes('#upgrade-tower-button:focus-visible'),
            '#80: style.css에 #upgrade-tower-button:focus-visible 존재'
        );
        const mainJsContent = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf-8');
        assert.ok(
            !mainJsContent.includes("'tower-button'") && !mainJsContent.includes('"tower-button"'),
            '#80: main.js에서 tower-button 클래스 미사용'
        );
    });

    it('#81: Google Fonts local conversion + CSP', () => {
        const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
        assert.ok(!htmlContent.includes('googleapis.com'), '#81: index.html에 googleapis.com 참조 없음');
        assert.ok(!htmlContent.includes('gstatic.com'), '#81: index.html에 gstatic.com 참조 없음');

        const cspMatch = htmlContent.match(/style-src\s+([^;]+)/);
        assert.ok(cspMatch, '#81: CSP에 style-src 지시어 존재');
        assert.ok(!cspMatch[1].includes('https://'), '#81: CSP style-src에 외부 도메인 없음');

        const fontSrcMatch = htmlContent.match(/font-src\s+([^;]+)/);
        assert.ok(fontSrcMatch, '#81: CSP에 font-src 지시어 존재');
        assert.ok(!fontSrcMatch[1].includes('https://'), '#81: CSP font-src에 외부 도메인 없음');

        assert.ok(
            fs.existsSync(path.join(__dirname, '..', 'fonts', 'NotoSansKR-Regular.woff2')),
            '#81: NotoSansKR-Regular.woff2 존재'
        );
        assert.ok(
            fs.existsSync(path.join(__dirname, '..', 'fonts', 'NotoSansKR-Bold.woff2')),
            '#81: NotoSansKR-Bold.woff2 존재'
        );

        const cssContent = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf-8');
        assert.ok(cssContent.includes('@font-face'), '#81: style.css에 @font-face 선언 존재');
        assert.ok(cssContent.includes('NotoSansKR-Regular.woff2'), '#81: style.css에 Regular 폰트 참조');
        assert.ok(cssContent.includes('NotoSansKR-Bold.woff2'), '#81: style.css에 Bold 폰트 참조');
    });

    it('#77: prefersReducedMotion default', () => {
        assert.strictEqual(
            game.getPrefersReducedMotion(),
            false,
            '#77: prefersReducedMotion 기본값은 false (jsdom 환경)'
        );
    });

    it('update: startWave on idle', () => {
        enemies.length = 0;
        towers.length = 0;
        projectiles.length = 0;
        game.setWaveInProgress(false);
        game.setNextWaveTimer(0);
        game.setLives(20);
        game.setGameOver(false);
        update(0.1);
        assert.ok(game.getWaveInProgress(), 'update: 대기 상태에서 startWave 호출');
    });

    it('update: enemy escape reduces lives', () => {
        enemies.length = 0;
        towers.length = 0;
        projectiles.length = 0;
        const waypoints = getWaypoints();
        const lastWp = waypoints[waypoints.length - 1];
        enemies.push({
            x: lastWp.x,
            y: lastWp.y,
            hp: 100,
            maxHp: 100,
            speed: 49,
            waypoint: waypoints.length - 1,
            reward: 10,
            waveIndex: 1,
            heading: 0,
            enemyType: mockStyle,
            pulseSeed: 0
        });
        game.setLives(5);
        game.setGameOver(false);
        update(0.5);
        assert.ok(getLives() < 5, 'update: 적 탈출 시 lives 감소');
        enemies.length = 0;
    });

    it('damageEnemyAtIndex: valid index kill', () => {
        enemies.length = 0;
        game.setGold(0);
        enemies.push({
            x: 100,
            y: 100,
            hp: 10,
            maxHp: 10,
            reward: 15,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 0,
            heading: 0
        });
        const daiKilled = damageEnemyAtIndex(0, 100);
        assert.ok(daiKilled === true, 'damageEnemyAtIndex: 처치 시 true 반환');
        assert.strictEqual(enemies.length, 0, 'damageEnemyAtIndex: 처치 시 배열에서 제거');
        assert.strictEqual(game.gold(), 15, 'damageEnemyAtIndex: 처치 시 reward 지급');
    });

    it('damageEnemyAtIndex: invalid index', () => {
        const invalidResult = damageEnemyAtIndex(99, 10);
        assert.ok(invalidResult === false, 'damageEnemyAtIndex: 무효 인덱스는 false 반환');
    });

    it('damageEnemyAtIndex: damage without kill', () => {
        enemies.length = 0;
        enemies.push({
            x: 100,
            y: 100,
            hp: 100,
            maxHp: 100,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 0,
            heading: 0
        });
        const notKilledDai = damageEnemyAtIndex(0, 30);
        assert.ok(notKilledDai === false, 'damageEnemyAtIndex: 미처치 시 false 반환');
        assert.strictEqual(enemies[0].hp, 70, 'damageEnemyAtIndex: hp 감소');
        assert.strictEqual(enemies.length, 1, 'damageEnemyAtIndex: 미처치 시 배열 유지');
        enemies.length = 0;
    });

    it('getAdjustedPickRadius: returns >= baseRadius', () => {
        const adjRadius = getAdjustedPickRadius(18);
        assert.ok(adjRadius >= 18, 'getAdjustedPickRadius: baseRadius 이상 반환');
    });

    it('gameLoopHalted: initial value', () => {
        assert.strictEqual(getGameLoopHalted(), false, 'gameLoopHalted: 초기값 false');
    });

    it('canBuildAt: towerPositionSet check', () => {
        enemies.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        towerPositionSet.add('3,3');
        assert.strictEqual(canBuildAt(3, 3), false, 'canBuildAt towerPositionSet: Set에 있으면 건설 불가');
        towerPositionSet.delete('3,3');
        pathTiles.delete('3,3');
        assert.strictEqual(canBuildAt(3, 3), true, 'canBuildAt towerPositionSet: Set에 없으면 건설 가능');
        towerPositionSet.clear();
    });

    it('renderDirty: initial value', () => {
        assert.ok(getRenderDirty() !== undefined, 'renderDirty: 값이 정의되어 있음');
    });

    it('#94: keyboard cursor', () => {
        initKbCursor();
        const cursor = getKbCursor();
        assert.ok(cursor !== null, 'initKbCursor: 커서 생성');
        assert.strictEqual(cursor.x, Math.floor(GRID_COLS / 2), 'initKbCursor: x 중앙');
        assert.strictEqual(cursor.y, Math.floor(GRID_ROWS / 2), 'initKbCursor: y 중앙');
        assert.ok(getKbCursorActive() === true, 'initKbCursor: active = true');

        moveKbCursor(-cursor.x, 0);
        assert.strictEqual(getKbCursor().x, 0, 'moveKbCursor: 좌측 경계 클램핑');
        moveKbCursor(-1, 0);
        assert.strictEqual(getKbCursor().x, 0, 'moveKbCursor: 좌측 경계 초과 방지');
        moveKbCursor(1, 0);
        assert.strictEqual(getKbCursor().x, 1, 'moveKbCursor: 우측 이동');
    });

    it('ENEMY_TYPE_MAP consistency', () => {
        ENEMY_TYPE_DEFINITIONS.forEach((t) => {
            assert.ok(ENEMY_TYPE_MAP[t.id] === t, `ENEMY_TYPE_MAP: ${t.id} 매핑 정확`);
        });
    });

    it('#152: EventBus.emit 리스너 예외 격리', () => {
        const results = [];
        const listener1 = () => {
            results.push('a');
        };
        const badListener = () => {
            throw new Error('boom');
        };
        const listener3 = () => {
            results.push('b');
        };
        EventBus.on('test:isolation', listener1);
        EventBus.on('test:isolation', badListener);
        EventBus.on('test:isolation', listener3);
        EventBus.emit('test:isolation');
        assert.deepStrictEqual(results, ['a', 'b'], '#152: 예외 발생해도 나머지 리스너 실행');
        EventBus.off('test:isolation', listener1);
        EventBus.off('test:isolation', badListener);
        EventBus.off('test:isolation', listener3);
    });

    it('#152: EventBus.emit 빈 이벤트', () => {
        let threw = false;
        try {
            EventBus.emit('no:listeners:here', { foo: 1 });
        } catch (e) {
            threw = true;
        }
        assert.strictEqual(threw, false, '#152: 리스너 없는 이벤트 emit 시 에러 없음');
    });

    it('#152: EventBus.off 후 호출 안됨', () => {
        let called = false;
        const fn = () => {
            called = true;
        };
        EventBus.on('test:off', fn);
        EventBus.off('test:off', fn);
        EventBus.emit('test:off');
        assert.strictEqual(called, false, '#152: off 후 리스너 호출 안됨');
    });

    it('#153: resetGame() buildFailFlash 초기화', () => {
        gameState.buildFailFlash = { x: 1, y: 2, timer: 0.5 };
        resetGame();
        assert.strictEqual(gameState.buildFailFlash, null, '#153: resetGame 후 buildFailFlash가 null');
    });

    it('#155: darkenHex 정상 입력', () => {
        const result = darkenHex('#ff8800', 0.5);
        assert.strictEqual(result, '#804400', '#155: #ff8800 * 0.5 = #804400');
    });

    it('#155: darkenHex factor 0', () => {
        const result = darkenHex('#ff8800', 0);
        assert.strictEqual(result, '#000000', '#155: factor 0이면 #000000');
    });

    it('#155: darkenHex factor > 1', () => {
        const result = darkenHex('#808080', 2);
        assert.strictEqual(typeof result, 'string', '#155: factor > 1도 문자열 반환');
        assert.ok(result.match(/^#[0-9a-f]{6}$/), '#155: factor > 1 결과도 유효한 hex');
        // 0x80 * 2 = 256 -> clamped to 255
        assert.strictEqual(result, '#ffffff', '#155: 클램프로 255 초과 방지');
    });

    it('#155: darkenHex non-hex 입력', () => {
        assert.strictEqual(darkenHex('not-a-color', 0.5), '#000000', '#155: 비정상 문자열은 #000000');
    });

    it('#155: darkenHex null 입력', () => {
        assert.strictEqual(darkenHex(null, 0.5), '#000000', '#155: null은 #000000');
    });

    it('#155: darkenHex 빈 문자열', () => {
        assert.strictEqual(darkenHex('', 0.5), '#000000', '#155: 빈 문자열은 #000000');
    });

    it('#155: darkenHex 3자리 hex', () => {
        const result = darkenHex('#f80', 0.5);
        assert.ok(result.match(/^#[0-9a-f]{6}$/), '#155: 3자리 hex도 6자리 결과');
        // #f80 -> #ff8800 * 0.5 = #804400
        assert.strictEqual(result, '#804400', '#155: 3자리 hex 확장 후 계산');
    });

    it('#155: darkenHex 결과 형식 검증', () => {
        const result = darkenHex('#abcdef', 0.8);
        assert.ok(result.match(/^#[0-9a-f]{6}$/), '#155: 결과는 항상 #xxxxxx 형식');
    });

    it('#156: selectedTower stale 참조 가드', () => {
        enemies.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        const staleTower = {
            x: 1,
            y: 1,
            worldX: 45,
            worldY: 45,
            type: 'basic',
            level: 1,
            spentGold: 100,
            cooldown: 0,
            activeBeam: null,
            heading: 0,
            aimAngle: null,
            flashTimer: 0,
            recoil: 0,
            auraOffset: 0,
            range: 165,
            fireDelay: 0.6,
            damage: 20,
            upgradeCost: 40
        };
        // selectedTower를 설정하지만 towers 배열에는 넣지 않음 (stale 참조)
        gameState.selectedTower = staleTower;
        updateTowerStatsFields();
        assert.strictEqual(gameState.selectedTower, null, '#156: stale tower 참조 시 selectedTower가 null로 초기화');
    });

    it('#164: playToneSequence osc.onended disconnect', () => {
        soundMuted = false;
        audioContext = null;
        masterGain = null;
        ensureAudioContext();
        const ctx = audioContext;
        const origCreateOsc = ctx.createOscillator.bind(ctx);
        let oscDisconnected = false;
        let gainDisconnected = false;
        let onendedFn = null;
        ctx.createOscillator = function () {
            const osc = origCreateOsc();
            osc.disconnect = function () {
                oscDisconnected = true;
            };
            Object.defineProperty(osc, 'onended', {
                set: function (fn) {
                    onendedFn = fn;
                },
                get: function () {
                    return onendedFn;
                }
            });
            return osc;
        };
        const origCreateGain = ctx.createGain.bind(ctx);
        ctx.createGain = function () {
            const g = origCreateGain();
            g.disconnect = function () {
                gainDisconnected = true;
            };
            return g;
        };
        playToneSequence([{ freq: 440, duration: 0.1 }]);
        assert.ok(typeof onendedFn === 'function', '#164: osc.onended에 함수가 설정됨');
        onendedFn();
        assert.strictEqual(oscDisconnected, true, '#164: onended 호출 시 osc.disconnect 실행');
        assert.strictEqual(gainDisconnected, true, '#164: onended 호출 시 gain.disconnect 실행');
    });

    it('#164: playNoise source.onended disconnect', () => {
        soundMuted = false;
        audioContext = null;
        masterGain = null;
        ensureAudioContext();
        const ctx = audioContext;
        let sourceDisconnected = false;
        let gainDisconnected = false;
        let onendedFn = null;
        const origCreateBufferSource = ctx.createBufferSource.bind(ctx);
        ctx.createBufferSource = function () {
            const src = origCreateBufferSource();
            src.disconnect = function () {
                sourceDisconnected = true;
            };
            Object.defineProperty(src, 'onended', {
                set: function (fn) {
                    onendedFn = fn;
                },
                get: function () {
                    return onendedFn;
                }
            });
            return src;
        };
        const origCreateGain = ctx.createGain.bind(ctx);
        ctx.createGain = function () {
            const g = origCreateGain();
            g.disconnect = function () {
                gainDisconnected = true;
            };
            return g;
        };
        cachedNoiseBuffer = null;
        playNoise(0.1, 0.2);
        assert.ok(typeof onendedFn === 'function', '#164: source.onended에 함수가 설정됨');
        onendedFn();
        assert.strictEqual(sourceDisconnected, true, '#164: onended 호출 시 source.disconnect 실행');
        assert.strictEqual(gainDisconnected, true, '#164: onended 호출 시 gain.disconnect 실행');
    });

    it('#164: ensureAudioContext catch에서 close 호출', () => {
        audioContext = null;
        masterGain = null;
        let closeCalled = false;
        const OrigCtx = window.AudioContext;
        window.AudioContext = function () {
            this.state = 'running';
            this.destination = {};
            this.currentTime = 0;
            this.sampleRate = 44100;
            this.createGain = function () {
                throw new Error('gain creation failed');
            };
            this.close = function () {
                closeCalled = true;
            };
        };
        const result = ensureAudioContext();
        assert.strictEqual(result, null, '#164: 생성 실패 시 null 반환');
        assert.strictEqual(closeCalled, true, '#164: catch에서 audioContext.close() 호출');
        assert.strictEqual(audioContext, null, '#164: 실패 후 audioContext가 null');
        window.AudioContext = OrigCtx;
        // 복원
        audioContext = null;
        masterGain = null;
    });

    // ── #160: 고웨이브 수치 오버플로우 클램프 ──

    it('#160: calculateTowerDamage 극한 레벨에서 유한수 반환', () => {
        const extremeDef = { baseDamage: 100 };
        const result = calculateTowerDamage(extremeDef, 9999);
        assert.ok(Number.isFinite(result), '#160: 극한 레벨 피해량은 유한수');
        assert.ok(result <= Number.MAX_SAFE_INTEGER, '#160: 극한 레벨 피해량은 MAX_SAFE_INTEGER 이하');
    });

    it('#160: calculateUpgradeCost 극한 레벨에서 유한수 반환', () => {
        const extremeDef = { baseUpgradeCost: 100 };
        const result = calculateUpgradeCost(extremeDef, 9999);
        assert.ok(Number.isFinite(result), '#160: 극한 레벨 업그레이드 비용은 유한수');
        assert.ok(result <= Number.MAX_SAFE_INTEGER, '#160: 극한 레벨 업그레이드 비용은 MAX_SAFE_INTEGER 이하');
    });

    // ── #157: spawnEnemy() waypoints 방어 ──

    it('#157: spawnEnemy waypoints 빈 상태에서 TypeError 없음', () => {
        const savedWaypoints = game.getWaypoints();
        // waypoints를 비우기 위해 length를 0으로 설정
        savedWaypoints.length = 0;
        let threw = false;
        try {
            spawnEnemy();
        } catch (e) {
            threw = true;
        }
        assert.strictEqual(threw, false, '#157: waypoints 빈 상태에서 spawnEnemy 호출 시 에러 없음');
        // 복원
        buildMapData('map1');
    });

    // ── #168: 핵심 게임 함수 테스트 ──

    it('#168: findTarget targetPriority=last', () => {
        enemies.length = 0;
        const testTower = { worldX: 100, worldY: 100, range: 300, targetPriority: 'last' };
        enemies.push({
            x: 110,
            y: 100,
            hp: 50,
            maxHp: 50,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 5
        });
        enemies.push({
            x: 120,
            y: 100,
            hp: 80,
            maxHp: 80,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 1
        });
        const result = findTarget(testTower);
        assert.ok(result !== null, '#168: last 우선순위로 타겟 발견');
        assert.strictEqual(result.enemy.waypoint, 1, '#168: last 우선순위는 가장 뒤처진 적 선택');
        enemies.length = 0;
    });

    it('#168: findTarget targetPriority=strongest', () => {
        enemies.length = 0;
        const testTower = { worldX: 100, worldY: 100, range: 300, targetPriority: 'strongest' };
        enemies.push({
            x: 110,
            y: 100,
            hp: 50,
            maxHp: 100,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 2
        });
        enemies.push({
            x: 120,
            y: 100,
            hp: 200,
            maxHp: 200,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 1
        });
        const result = findTarget(testTower);
        assert.ok(result !== null, '#168: strongest 우선순위로 타겟 발견');
        assert.strictEqual(result.enemy.hp, 200, '#168: strongest 우선순위는 HP가 가장 높은 적 선택');
        enemies.length = 0;
    });

    it('#168: findTarget targetPriority=weakest', () => {
        enemies.length = 0;
        const testTower = { worldX: 100, worldY: 100, range: 300, targetPriority: 'weakest' };
        enemies.push({
            x: 110,
            y: 100,
            hp: 200,
            maxHp: 200,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 2
        });
        enemies.push({
            x: 120,
            y: 100,
            hp: 30,
            maxHp: 100,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 1
        });
        const result = findTarget(testTower);
        assert.ok(result !== null, '#168: weakest 우선순위로 타겟 발견');
        assert.strictEqual(result.enemy.hp, 30, '#168: weakest 우선순위는 HP가 가장 낮은 적 선택');
        enemies.length = 0;
    });

    it('#168: findTarget targetPriority=closest', () => {
        enemies.length = 0;
        const testTower = { worldX: 100, worldY: 100, range: 300, targetPriority: 'closest' };
        enemies.push({
            x: 200,
            y: 100,
            hp: 50,
            maxHp: 50,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 5
        });
        enemies.push({
            x: 105,
            y: 100,
            hp: 50,
            maxHp: 50,
            reward: 10,
            waveIndex: 1,
            enemyType: mockStyle,
            waypoint: 1
        });
        const result = findTarget(testTower);
        assert.ok(result !== null, '#168: closest 우선순위로 타겟 발견');
        assert.strictEqual(result.enemy.x, 105, '#168: closest 우선순위는 가장 가까운 적 선택');
        enemies.length = 0;
    });

    it('#168: spawnEnemy 반환 객체 필드 검증', () => {
        enemies.length = 0;
        game.setWave(1);
        game.setEnemiesToSpawn(5);
        spawnEnemy();
        assert.strictEqual(enemies.length, 1, '#168: spawnEnemy 호출 후 enemies에 1개 추가');
        const enemy = enemies[0];
        assert.ok('x' in enemy, '#168: enemy에 x 필드 존재');
        assert.ok('y' in enemy, '#168: enemy에 y 필드 존재');
        assert.ok('hp' in enemy, '#168: enemy에 hp 필드 존재');
        assert.ok('maxHp' in enemy, '#168: enemy에 maxHp 필드 존재');
        assert.ok('speed' in enemy, '#168: enemy에 speed 필드 존재');
        assert.ok('waypoint' in enemy, '#168: enemy에 waypoint 필드 존재');
        assert.ok('reward' in enemy, '#168: enemy에 reward 필드 존재');
        assert.ok('enemyType' in enemy, '#168: enemy에 enemyType 필드 존재');
        assert.strictEqual(enemy.waypoint, 0, '#168: 초기 waypoint는 0');
        enemies.length = 0;
    });

    it('#168: getWaveEnemyComposition 결과 검증', () => {
        const composition = game.getWaveEnemyComposition(1);
        assert.ok(Array.isArray(composition), '#168: getWaveEnemyComposition은 배열 반환');
        assert.ok(composition.length > 0, '#168: 웨이브 1 구성은 최소 1개 타입');
        composition.forEach((entry) => {
            assert.ok('type' in entry, '#168: 구성 항목에 type 필드 존재');
            assert.ok('percent' in entry, '#168: 구성 항목에 percent 필드 존재');
            assert.ok(typeof entry.percent === 'number', '#168: percent는 숫자');
        });
    });

    it('#168: getWaveEnemyComposition 퍼센트 합계 체크', () => {
        const composition = game.getWaveEnemyComposition(10);
        const totalPercent = composition.reduce((sum, c) => sum + c.percent, 0);
        assert.ok(totalPercent >= 95 && totalPercent <= 105, '#168: 퍼센트 합계는 약 100% (반올림 오차 허용)');
    });

    // ── #133: 다음 웨이브 즉시 시작 버튼 ──

    it('#133: send-next-wave 버튼 존재', () => {
        const btn = global.document.getElementById('send-next-wave');
        assert.ok(btn !== null, '#133: send-next-wave 버튼이 DOM에 존재');
        assert.ok(btn.classList.contains('send-wave-button'), '#133: send-wave-button 클래스 보유');
    });

    it('#133: send-next-wave 클릭 시 타이머 0', () => {
        game.setWaveInProgress(false);
        game.setNextWaveTimer(5);
        game.setGameOver(false);
        const btn = global.document.getElementById('send-next-wave');
        btn.click();
        assert.strictEqual(game.getNextWaveTimer(), 0, '#133: 클릭 후 nextWaveTimer가 0');
    });

    it('#133: waveInProgress 시 버튼 클릭 무반응', () => {
        game.setWaveInProgress(true);
        game.setNextWaveTimer(5);
        game.setGameOver(false);
        const btn = global.document.getElementById('send-next-wave');
        btn.click();
        assert.strictEqual(game.getNextWaveTimer(), 5, '#133: waveInProgress 중에는 nextWaveTimer 변경 없음');
        game.setWaveInProgress(false);
        game.setNextWaveTimer(0);
    });

    // ── #146: SHAPE_RENDERERS 테이블 ──

    it('#146: SHAPE_RENDERERS에 8개 shape 키 존재', () => {
        const expectedShapes = ['turret', 'vulcan', 'rail', 'prism', 'gyro', 'howitzer', 'sentinel', 'artillery'];
        expectedShapes.forEach((shape) => {
            assert.ok(typeof SHAPE_RENDERERS[shape] === 'function', `#146: SHAPE_RENDERERS에 ${shape} 렌더러 존재`);
        });
        assert.strictEqual(Object.keys(SHAPE_RENDERERS).length, 8, '#146: SHAPE_RENDERERS에 정확히 8개 키');
    });

    it('#146: 알 수 없는 shape에 renderDefault 동작', () => {
        let threw = false;
        try {
            const mockTower = { worldX: 100, worldY: 100, level: 1, heading: 0, recoil: 0, flashTimer: 0 };
            drawTowerShape(mockTower, '#fff', '#000', 0, { shape: 'unknown_shape_xyz' });
        } catch (e) {
            threw = true;
        }
        assert.strictEqual(threw, false, '#146: 알 수 없는 shape에서도 에러 없이 renderDefault 실행');
    });

    // ── #158: bossSpawned 플래그로 보스 중복 방지 ──

    it('#158: startWave에서 bossSpawned 초기화', () => {
        gameState.bossSpawned = true;
        game.startWave();
        assert.strictEqual(gameState.bossSpawned, false, '#158: startWave 시 bossSpawned가 false로 초기화');
        // 정리
        enemies.length = 0;
        game.setWaveInProgress(false);
        game.setNextWaveTimer(0);
    });

    it('#158: 보스 스폰 후 중복 방지', () => {
        enemies.length = 0;
        game.setWave(10);
        gameState.bossSpawned = false;
        // 첫 스폰은 보스
        const firstType = pickEnemyType(10);
        assert.strictEqual(firstType.id, 'boss', '#158: bossSpawned=false면 보스 선택');
        // 보스 스폰 시뮬레이션
        gameState.bossSpawned = true;
        // 두 번째 스폰은 보스가 아님
        const secondType = pickEnemyType(10);
        assert.ok(secondType.id !== 'boss', '#158: bossSpawned=true면 보스 중복 방지');
        gameState.bossSpawned = false;
        enemies.length = 0;
    });

    it('#158: spawnEnemy에서 보스 스폰 시 bossSpawned 설정', () => {
        enemies.length = 0;
        game.setWave(10);
        gameState.bossSpawned = false;
        game.setEnemiesToSpawn(5);
        spawnEnemy();
        // 웨이브 10 + bossSpawned=false이면 보스가 스폰되고 bossSpawned=true
        assert.strictEqual(gameState.bossSpawned, true, '#158: 보스 스폰 후 bossSpawned=true');
        assert.strictEqual(enemies.length, 1, '#158: 적이 1개 스폰됨');
        assert.strictEqual(enemies[0].enemyType.id, 'boss', '#158: 스폰된 적이 보스');
        enemies.length = 0;
        gameState.bossSpawned = false;
    });

    // ── #147: drawTowers aura 캐싱 ──

    it('#147: _towerAuraCache가 존재하고 동작', () => {
        assert.ok(_towerAuraCache instanceof Map, '#147: _towerAuraCache는 Map 인스턴스');
        _towerAuraCache.clear();
        const result1 = _getCachedAuraColor('#6296ff');
        assert.ok(typeof result1 === 'string', '#147: _getCachedAuraColor 반환값은 문자열');
        assert.ok(result1.includes('rgba'), '#147: _getCachedAuraColor 반환값에 rgba 포함');
        const result2 = _getCachedAuraColor('#6296ff');
        assert.strictEqual(result1, result2, '#147: 동일 입력에 캐시 히트');
        assert.strictEqual(_towerAuraCache.size, 1, '#147: 캐시에 1개 항목');
        _towerAuraCache.clear();
    });

    it('#147: drawTowers 에러 없이 실행', () => {
        enemies.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        const t = createTowerData(2, 2, 'basic');
        towers.push(t);
        towerPositionSet.add('2,2');
        let threw = false;
        try {
            drawTowers();
        } catch (e) {
            threw = true;
        }
        assert.strictEqual(threw, false, '#147: drawTowers 에러 없이 실행');
        towers.length = 0;
        towerPositionSet.clear();
    });

    // ── #136: 볼륨 슬라이더 ──

    it('#136: volume-slider DOM 존재', () => {
        const slider = global.document.getElementById('volume-slider');
        assert.ok(slider !== null, '#136: volume-slider가 DOM에 존재');
        assert.strictEqual(slider.type, 'range', '#136: volume-slider type은 range');
        assert.strictEqual(slider.getAttribute('min'), '0', '#136: min=0');
        assert.strictEqual(slider.getAttribute('max'), '100', '#136: max=100');
    });

    it('#136: setVolume 범위 클램핑 및 getVolume', () => {
        setVolume(0.5);
        assert.strictEqual(getVolume(), 0.5, '#136: setVolume(0.5) 후 getVolume() = 0.5');
        setVolume(-1);
        assert.strictEqual(getVolume(), 0, '#136: setVolume(-1) 클램핑 → 0');
        setVolume(2);
        assert.strictEqual(getVolume(), 1, '#136: setVolume(2) 클램핑 → 1');
        setVolume(NaN);
        assert.strictEqual(getVolume(), 1, '#136: setVolume(NaN) 무시');
        // 복원
        setVolume(0.8);
    });

    it('#136: setSoundMuted 해제 시 masterVolume 사용', () => {
        setVolume(0.5);
        soundMuted = false;
        audioContext = null;
        masterGain = null;
        ensureAudioContext();
        assert.ok(masterGain !== null, '#136: ensureAudioContext 후 masterGain 존재');
        assert.strictEqual(masterGain.gain.value, 0.5, '#136: masterGain 초기값이 masterVolume 사용');
        // 복원
        setVolume(0.8);
    });

    // ── #182: 렌더러 함수 크래시 방지 테스트 ──

    it('#182: drawEnemies 빈 배열로 에러 없이 실행', () => {
        enemies.length = 0;
        assert.doesNotThrow(() => drawEnemies(), '#182: drawEnemies 빈 배열');
    });

    it('#182: drawEnemies 최소 적 객체로 에러 없이 실행', () => {
        enemies.length = 0;
        enemies.push({
            x: 100,
            y: 100,
            hp: 50,
            maxHp: 100,
            heading: 0,
            enemyType: ENEMY_TYPE_DEFINITIONS[0]
        });
        assert.doesNotThrow(() => drawEnemies(), '#182: drawEnemies 최소 객체');
        enemies.length = 0;
    });

    it('#182: drawEnemies 보스 타입 적으로 에러 없이 실행', () => {
        enemies.length = 0;
        const bossType =
            ENEMY_TYPE_DEFINITIONS.find((t) => t.id === 'boss') || ENEMY_TYPE_DEFINITIONS[0];
        enemies.push({
            x: 200,
            y: 200,
            hp: 500,
            maxHp: 1000,
            heading: Math.PI,
            enemyType: bossType
        });
        assert.doesNotThrow(() => drawEnemies(), '#182: drawEnemies 보스');
        enemies.length = 0;
    });

    it('#182: drawProjectiles 빈 배열로 에러 없이 실행', () => {
        projectiles.length = 0;
        assert.doesNotThrow(() => drawProjectiles(), '#182: drawProjectiles 빈 배열');
    });

    it('#182: drawProjectiles 기본 투사체로 에러 없이 실행', () => {
        projectiles.length = 0;
        projectiles.push({
            x: 100,
            y: 100,
            vx: 1,
            vy: 0,
            speed: 1,
            radius: 4,
            color: '#ff0000',
            life: 1,
            initialLife: 1,
            delay: 0,
            trailLength: 0,
            shape: 'circle'
        });
        assert.doesNotThrow(() => drawProjectiles(), '#182: drawProjectiles 기본');
        projectiles.length = 0;
    });

    it('#182: drawProjectiles beam 형태로 에러 없이 실행', () => {
        projectiles.length = 0;
        projectiles.push({
            x: 100,
            y: 100,
            vx: 1,
            vy: 0,
            speed: 1,
            radius: 6,
            color: '#00ff00',
            life: 1,
            initialLife: 1,
            delay: 0,
            trailLength: 40,
            shape: 'beam'
        });
        assert.doesNotThrow(() => drawProjectiles(), '#182: drawProjectiles beam');
        projectiles.length = 0;
    });

    it('#182: drawProjectiles delayed 투사체 스킵 확인', () => {
        projectiles.length = 0;
        projectiles.push({
            x: 50,
            y: 50,
            vx: 1,
            vy: 0,
            speed: 1,
            radius: 4,
            color: '#0000ff',
            life: 1,
            initialLife: 1,
            delay: 0.5,
            trailLength: 0,
            shape: 'circle'
        });
        assert.doesNotThrow(() => drawProjectiles(), '#182: drawProjectiles delayed');
        projectiles.length = 0;
    });

    it('#182: drawImpactEffects 빈 배열로 에러 없이 실행', () => {
        impactEffects.length = 0;
        assert.doesNotThrow(() => drawImpactEffects(), '#182: drawImpactEffects 빈 배열');
    });

    it('#182: drawImpactEffects 최소 이펙트로 에러 없이 실행', () => {
        impactEffects.length = 0;
        impactEffects.push({
            x: 100,
            y: 100,
            radius: 10,
            color: '#ff0000',
            life: 0.5,
            initialLife: 1,
            pulse: false
        });
        assert.doesNotThrow(() => drawImpactEffects(), '#182: drawImpactEffects 기본');
        impactEffects.length = 0;
    });

    it('#182: drawImpactEffects stroke 포함 이펙트로 에러 없이 실행', () => {
        impactEffects.length = 0;
        impactEffects.push({
            x: 150,
            y: 150,
            radius: 15,
            color: '#00ff00',
            halo: 'rgba(0,255,0,0.5)',
            stroke: '#00cc00',
            lineWidth: 2,
            life: 0.8,
            initialLife: 1,
            pulse: true
        });
        assert.doesNotThrow(() => drawImpactEffects(), '#182: drawImpactEffects stroke');
        impactEffects.length = 0;
    });

    it('#182: drawMuzzleFlashes 빈 배열로 에러 없이 실행', () => {
        muzzleFlashes.length = 0;
        assert.doesNotThrow(() => drawMuzzleFlashes(), '#182: drawMuzzleFlashes 빈 배열');
    });

    it('#182: drawMuzzleFlashes 최소 플래시로 에러 없이 실행', () => {
        muzzleFlashes.length = 0;
        muzzleFlashes.push({
            x: 100,
            y: 100,
            radius: 8,
            color: '#ffff00',
            life: 0.3,
            initialLife: 0.5,
            angle: null
        });
        assert.doesNotThrow(() => drawMuzzleFlashes(), '#182: drawMuzzleFlashes 기본');
        muzzleFlashes.length = 0;
    });

    it('#182: drawMuzzleFlashes angle 포함 플래시로 에러 없이 실행', () => {
        muzzleFlashes.length = 0;
        muzzleFlashes.push({
            x: 200,
            y: 200,
            radius: 10,
            color: '#ffa500',
            life: 0.2,
            initialLife: 0.4,
            angle: Math.PI / 4
        });
        assert.doesNotThrow(() => drawMuzzleFlashes(), '#182: drawMuzzleFlashes angle');
        muzzleFlashes.length = 0;
    });

    it('#182: drawLaserBeams 빈 타워 배열로 에러 없이 실행', () => {
        towers.length = 0;
        towerPositionSet.clear();
        assert.doesNotThrow(() => drawLaserBeams(), '#182: drawLaserBeams 빈 배열');
    });

    it('#182: drawLaserBeams activeBeam 없는 타워로 에러 없이 실행', () => {
        towers.length = 0;
        towerPositionSet.clear();
        const t = createTowerData(3, 3, 'basic');
        towers.push(t);
        towerPositionSet.add('3,3');
        assert.doesNotThrow(() => drawLaserBeams(), '#182: drawLaserBeams no beam');
        towers.length = 0;
        towerPositionSet.clear();
    });

    it('#182: drawLaserBeams activeBeam 포함 타워로 에러 없이 실행', () => {
        towers.length = 0;
        towerPositionSet.clear();
        const t = createTowerData(4, 4, 'basic');
        t.activeBeam = {
            x1: 100,
            y1: 100,
            x2: 200,
            y2: 200,
            color: '#ff00ff',
            glow: '#ff88ff',
            width: 6,
            alpha: 0.8
        };
        towers.push(t);
        towerPositionSet.add('4,4');
        assert.doesNotThrow(() => drawLaserBeams(), '#182: drawLaserBeams with beam');
        towers.length = 0;
        towerPositionSet.clear();
    });

    it('#182: drawLaserBeams alpha 0인 빔 스킵 확인', () => {
        towers.length = 0;
        towerPositionSet.clear();
        const t = createTowerData(5, 5, 'basic');
        t.activeBeam = {
            x1: 0,
            y1: 0,
            x2: 100,
            y2: 100,
            color: '#ff00ff',
            width: 4,
            alpha: 0
        };
        towers.push(t);
        towerPositionSet.add('5,5');
        assert.doesNotThrow(() => drawLaserBeams(), '#182: drawLaserBeams alpha=0');
        towers.length = 0;
        towerPositionSet.clear();
    });

    it('#182: drawProjectileTrail trailLength 없으면 즉시 반환', () => {
        const proj = { x: 50, y: 50, vx: 1, vy: 0, speed: 1, trailLength: 0 };
        assert.doesNotThrow(
            () => drawProjectileTrail(proj),
            '#182: drawProjectileTrail no trail'
        );
    });

    it('#182: drawProjectileTrail trailLength 있는 투사체로 에러 없이 실행', () => {
        const proj = {
            x: 100,
            y: 100,
            vx: 1,
            vy: 0,
            speed: 1,
            trailLength: 30,
            color: '#ff0000',
            trailColor: '#ff8888',
            radius: 4
        };
        assert.doesNotThrow(
            () => drawProjectileTrail(proj),
            '#182: drawProjectileTrail with trail'
        );
    });

    it('#182: render 에러 없이 실행 (빈 상태)', () => {
        enemies.length = 0;
        projectiles.length = 0;
        impactEffects.length = 0;
        muzzleFlashes.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        // strokeRect가 fake canvas에 없을 수 있으므로 패치
        if (!ctx.strokeRect) ctx.strokeRect = function () {};
        assert.doesNotThrow(() => render(), '#182: render 빈 상태');
    });

    it('#182: render 적·타워·투사체 포함 상태로 에러 없이 실행', () => {
        enemies.length = 0;
        projectiles.length = 0;
        impactEffects.length = 0;
        muzzleFlashes.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
        if (!ctx.strokeRect) ctx.strokeRect = function () {};
        enemies.push({
            x: 100,
            y: 100,
            hp: 50,
            maxHp: 100,
            heading: 0,
            enemyType: ENEMY_TYPE_DEFINITIONS[0]
        });
        const t = createTowerData(2, 2, 'basic');
        towers.push(t);
        towerPositionSet.add('2,2');
        projectiles.push({
            x: 80,
            y: 80,
            vx: 1,
            vy: 0,
            speed: 1,
            radius: 4,
            color: '#ff0000',
            life: 1,
            initialLife: 1,
            delay: 0,
            trailLength: 0,
            shape: 'circle'
        });
        assert.doesNotThrow(() => render(), '#182: render 복합 상태');
        enemies.length = 0;
        projectiles.length = 0;
        towers.length = 0;
        towerPositionSet.clear();
    });

    // ── #191: utils.js 순수 함수 테스트 ──

    it('#191: formatNumber 정수 입력', () => {
        assert.strictEqual(formatNumber(0), '0', '#191: formatNumber(0)');
        assert.strictEqual(formatNumber(42), '42', '#191: formatNumber(42)');
        assert.strictEqual(formatNumber(-5), '-5', '#191: formatNumber(-5)');
        assert.strictEqual(formatNumber(999), '999', '#191: formatNumber(999)');
    });

    it('#191: formatNumber 소수 입력', () => {
        assert.strictEqual(formatNumber(3.14), '3.14', '#191: formatNumber(3.14)');
        assert.strictEqual(formatNumber(0.5), '0.50', '#191: formatNumber(0.5)');
        assert.strictEqual(formatNumber(99.999), '100.00', '#191: formatNumber(99.999)');
    });

    it('#191: formatNumber 큰 수 (1000 이상)', () => {
        const result = formatNumber(1234);
        assert.ok(typeof result === 'string', '#191: formatNumber(1234) 문자열');
        assert.ok(result.length > 0, '#191: formatNumber(1234) 비어있지 않음');
    });

    it('#191: formatNumber NaN/Infinity는 "-" 반환', () => {
        assert.strictEqual(formatNumber(NaN), '-', '#191: formatNumber(NaN)');
        assert.strictEqual(formatNumber(Infinity), '-', '#191: formatNumber(Infinity)');
        assert.strictEqual(formatNumber(-Infinity), '-', '#191: formatNumber(-Infinity)');
    });

    it('#191: getColorFromArray 정상 인덱스', () => {
        const colors = ['#ff0000', '#00ff00', '#0000ff'];
        assert.strictEqual(
            getColorFromArray(colors, 1, '#000'),
            '#ff0000',
            '#191: level 1 → 첫 번째 색상'
        );
        assert.strictEqual(
            getColorFromArray(colors, 2, '#000'),
            '#00ff00',
            '#191: level 2 → 두 번째 색상'
        );
        assert.strictEqual(
            getColorFromArray(colors, 3, '#000'),
            '#0000ff',
            '#191: level 3 → 세 번째 색상'
        );
    });

    it('#191: getColorFromArray 범위 초과 시 darken 폴백', () => {
        const colors = ['#ffffff'];
        const result = getColorFromArray(colors, 3, '#000');
        assert.ok(typeof result === 'string', '#191: 범위 초과 시 문자열 반환');
        assert.ok(result.startsWith('#'), '#191: 범위 초과 시 hex 색상');
        assert.notStrictEqual(result, '#ffffff', '#191: 범위 초과 시 원본과 다름');
    });

    it('#191: getColorFromArray 빈 배열 시 fallback 반환', () => {
        assert.strictEqual(
            getColorFromArray([], 1, '#abcdef'),
            '#abcdef',
            '#191: 빈 배열 → fallback'
        );
        assert.strictEqual(
            getColorFromArray(null, 1, '#123456'),
            '#123456',
            '#191: null → fallback'
        );
        assert.strictEqual(
            getColorFromArray(undefined, 1, '#999'),
            '#999',
            '#191: undefined → fallback'
        );
    });

    it('#191: getTowerColor 정의된 타워에 대한 색상 반환', () => {
        const basicDef = TOWER_TYPES.basic;
        const color1 = getTowerColor(basicDef, 1);
        assert.ok(typeof color1 === 'string', '#191: getTowerColor 문자열 반환');
        assert.ok(color1.startsWith('#'), '#191: getTowerColor hex 색상');
        assert.strictEqual(
            color1,
            basicDef.levelColors[0],
            '#191: level 1 → 첫 번째 levelColors'
        );
    });

    it('#191: getTowerColor 다양한 레벨', () => {
        const basicDef = TOWER_TYPES.basic;
        for (let lvl = 1; lvl <= basicDef.levelColors.length; lvl++) {
            const c = getTowerColor(basicDef, lvl);
            assert.strictEqual(
                c,
                basicDef.levelColors[lvl - 1],
                `#191: getTowerColor level ${lvl}`
            );
        }
    });

    it('#191: getTowerColor 범위 초과 레벨', () => {
        const basicDef = TOWER_TYPES.basic;
        const overLevel = basicDef.levelColors.length + 5;
        const c = getTowerColor(basicDef, overLevel);
        assert.ok(typeof c === 'string', '#191: getTowerColor 범위 초과 시 문자열');
        assert.ok(c.startsWith('#'), '#191: getTowerColor 범위 초과 시 hex');
    });

    it('#191: getProjectileColor 정의된 타워에 대한 색상 반환', () => {
        const basicDef = TOWER_TYPES.basic;
        const color1 = getProjectileColor(basicDef, 1);
        assert.ok(typeof color1 === 'string', '#191: getProjectileColor 문자열');
        assert.strictEqual(
            color1,
            basicDef.projectileColors[0],
            '#191: level 1 → 첫 번째 projectileColors'
        );
    });

    it('#191: getProjectileColor 다양한 레벨', () => {
        const basicDef = TOWER_TYPES.basic;
        for (let lvl = 1; lvl <= basicDef.projectileColors.length; lvl++) {
            const c = getProjectileColor(basicDef, lvl);
            assert.strictEqual(
                c,
                basicDef.projectileColors[lvl - 1],
                `#191: getProjectileColor level ${lvl}`
            );
        }
    });

    it('#191: recalcTowerStats range 재계산', () => {
        const tower = createTowerData(0, 0, 'basic');
        tower.level = 1;
        recalcTowerStats(tower);
        const def = TOWER_TYPES.basic;
        assert.strictEqual(
            tower.range,
            def.range + (def.rangeGrowth || 0) * 0,
            '#191: level 1 range'
        );
        tower.level = 3;
        recalcTowerStats(tower);
        assert.strictEqual(
            tower.range,
            def.range + (def.rangeGrowth || 0) * 2,
            '#191: level 3 range'
        );
    });

    it('#191: recalcTowerStats fireDelay 재계산', () => {
        const tower = createTowerData(0, 0, 'basic');
        const def = TOWER_TYPES.basic;
        tower.level = 1;
        recalcTowerStats(tower);
        const expected1 = Math.max(
            def.fireDelay + (def.fireDelayGrowth || 0) * 0,
            0.05
        );
        assert.strictEqual(tower.fireDelay, expected1, '#191: level 1 fireDelay');
        tower.level = 5;
        recalcTowerStats(tower);
        const expected5 = Math.max(
            def.fireDelay + (def.fireDelayGrowth || 0) * 4,
            0.05
        );
        assert.strictEqual(tower.fireDelay, expected5, '#191: level 5 fireDelay');
    });

    it('#191: recalcTowerStats damage 재계산', () => {
        const tower = createTowerData(0, 0, 'basic');
        const def = TOWER_TYPES.basic;
        tower.level = 1;
        recalcTowerStats(tower);
        assert.strictEqual(
            tower.damage,
            calculateTowerDamage(def, 1),
            '#191: level 1 damage'
        );
        tower.level = 4;
        recalcTowerStats(tower);
        assert.strictEqual(
            tower.damage,
            calculateTowerDamage(def, 4),
            '#191: level 4 damage'
        );
    });

    it('#191: recalcTowerStats upgradeCost 재계산', () => {
        const tower = createTowerData(0, 0, 'basic');
        const def = TOWER_TYPES.basic;
        tower.level = 1;
        recalcTowerStats(tower);
        assert.strictEqual(
            tower.upgradeCost,
            calculateUpgradeCost(def, 1),
            '#191: level 1 upgradeCost'
        );
        tower.level = TOWER_MAX_LEVEL;
        recalcTowerStats(tower);
        assert.strictEqual(
            tower.upgradeCost,
            null,
            '#191: max level → upgradeCost null'
        );
    });
});
