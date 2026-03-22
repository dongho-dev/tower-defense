const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function noop() {}

class FakeGainNode {
    constructor() {
        this.gain = {
            value: 0,
            setValueAtTime: noop,
            setTargetAtTime: noop,
            exponentialRampToValueAtTime: noop,
            cancelScheduledValues: noop
        };
    }
    connect() {}
}

class FakeOscillator {
    constructor() {
        this.frequency = { setValueAtTime: noop };
        this.type = 'sine';
    }
    connect() {}
    start() {}
    stop() {}
}

class FakeBufferSource {
    connect() {}
    start() {}
    stop() {}
    set buffer(_) {}
}

class FakeAudioContext {
    constructor() {
        this.destination = {};
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.state = 'running';
    }
    close() {
        this.state = 'closed';
    }
    resume() {
        this.state = 'running';
        return Promise.resolve();
    }
    createGain() {
        return new FakeGainNode();
    }
    createOscillator() {
        return new FakeOscillator();
    }
    createBuffer(channels, length) {
        return { getChannelData: () => new Float32Array(length * channels) };
    }
    createBufferSource() {
        return new FakeBufferSource();
    }
}

function setupDom() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
    const dom = new JSDOM(html, { pretendToBeVisual: true });
    const { window } = dom;
    const { document } = window;

    const fakePerformance = { now: () => 0 };
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;
    global.performance = fakePerformance;
    window.performance = fakePerformance;

    global.requestAnimationFrame = noop;
    global.cancelAnimationFrame = noop;
    window.requestAnimationFrame = noop;
    window.cancelAnimationFrame = noop;

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
    global.AudioContext = FakeAudioContext;

    window.HTMLCanvasElement.prototype.getContext = () => ({
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        stroke: noop,
        arc: noop,
        fillRect: noop,
        clearRect: noop,
        fill: noop,
        save: noop,
        restore: noop,
        font: '',
        textAlign: '',
        textBaseline: '',
        fillText: noop,
        createRadialGradient: () => ({ addColorStop: noop }),
        createLinearGradient: () => ({ addColorStop: noop }),
        setLineDash: noop,
        ellipse: noop,
        resetTransform: noop,
        globalCompositeOperation: 'source-over',
        shadowColor: '',
        shadowBlur: 0,
        globalAlpha: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        rotate: noop,
        translate: noop,
        closePath: noop,
        setTransform: noop,
        measureText: () => ({ width: 0 }),
        drawImage: noop
    });

    // Make module available globally so main.js can set module.exports
    const gameModule = { exports: {} };
    global.module = gameModule;

    const scriptFiles = [
        'constants.js',
        'towers.js',
        'utils.js',
        'map.js',
        'ui.js',
        'audio.js',
        'game.js',
        'renderer.js',
        'main.js'
    ];
    for (const file of scriptFiles) {
        const filePath = path.join(__dirname, '..', file);
        const code = fs.readFileSync(filePath, 'utf-8');
        vm.runInThisContext(code, { filename: filePath });
    }

    // main.js sets module.exports via its `if (typeof module !== 'undefined')` block
    const game = gameModule.exports;

    // Remove the global module override
    delete global.module;

    return { window, document, game };
}

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
        game.setEnemiesToSpawn(5);
        const normalType = pickEnemyType(1);
        assert.strictEqual(normalType.id, 'normal', 'pickEnemyType: 웨이브 1은 일반 적');
        const normalType2 = pickEnemyType(2);
        assert.strictEqual(normalType2.id, 'normal', 'pickEnemyType: 웨이브 2는 일반 적');

        game.setEnemiesToSpawn(1);
        const bossResult = pickEnemyType(10);
        assert.strictEqual(bossResult.id, 'boss', 'pickEnemyType: 웨이브 10 + 마지막 적 = 보스');
        const bossResult2 = pickEnemyType(20);
        assert.strictEqual(bossResult2.id, 'boss', 'pickEnemyType: 웨이브 20 + 마지막 적 = 보스');

        game.setEnemiesToSpawn(5);
        const noBoss = pickEnemyType(10);
        assert.ok(noBoss.id !== 'boss', 'pickEnemyType: enemiesToSpawn !== 1이면 보스 아님');

        game.setEnemiesToSpawn(5);
        for (let i = 0; i < 20; i++) {
            const result = pickEnemyType(5);
            assert.ok(
                ENEMY_TYPE_DEFINITIONS.some((t) => t.id === result.id),
                'pickEnemyType: 웨이브 5 반환값은 유효한 적 타입'
            );
        }
        game.setEnemiesToSpawn(0);
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
        assert.strictEqual(goldChip.getAttribute('aria-live'), null, '#75: 골드 stat-chip에서 aria-live 제거됨');

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
});
