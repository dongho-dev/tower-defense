const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

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
    }
    createGain() { return new FakeGainNode(); }
    createOscillator() { return new FakeOscillator(); }
    createBuffer(channels, length) {
        return { getChannelData: () => new Float32Array(length * channels) };
    }
    createBufferSource() { return new FakeBufferSource(); }
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
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
        beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
        arc: noop, fillRect: noop, clearRect: noop, fill: noop,
        save: noop, restore: noop, font: '', textAlign: '', textBaseline: '',
        fillText: noop,
        createRadialGradient: () => ({ addColorStop: noop }),
        createLinearGradient: () => ({ addColorStop: noop })
    });

    delete require.cache[require.resolve('../main.js')];
    const game = require('../main.js');

    return { window, document, game };
}

function assert(condition, message) {
    if (!condition) throw new Error(`FAIL: ${message}`);
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`FAIL: ${message}\n  expected: ${expected}\n  got:      ${actual}`);
    }
}

function run() {
    const { game } = setupDom();
    const {
        calculateTowerDamage,
        calculateUpgradeCost,
        getWaveEnemyCount,
        getWaveEnemyStats,
        applyExplosion,
        enemies
    } = game;

    // --- calculateTowerDamage ---
    const basicDef = { baseDamage: 20 };
    assertEqual(
        calculateTowerDamage(basicDef, 1),
        20,
        'calculateTowerDamage: 레벨 1 피해는 baseDamage와 동일'
    );
    assertEqual(
        calculateTowerDamage(basicDef, 2),
        parseFloat((20 * 1.5).toFixed(4)),
        'calculateTowerDamage: 레벨 2 피해는 baseDamage * TOWER_DAMAGE_GROWTH(1.5)'
    );

    // --- calculateUpgradeCost ---
    const def40 = { baseUpgradeCost: 40 };
    assertEqual(
        calculateUpgradeCost(def40, 1),
        40,
        'calculateUpgradeCost: 레벨 1 비용 = baseUpgradeCost'
    );
    assertEqual(
        calculateUpgradeCost(def40, 2),
        Math.round(40 * 1.6),
        'calculateUpgradeCost: 레벨 2 비용 = base * TOWER_UPGRADE_COST_MULTIPLIER(1.6)'
    );

    // --- getWaveEnemyCount ---
    assertEqual(getWaveEnemyCount(1), 9, 'getWaveEnemyCount: 웨이브 1 = 8 + floor(1.5) = 9');
    assertEqual(getWaveEnemyCount(10), 23, 'getWaveEnemyCount: 웨이브 10 = 8 + floor(15) = 23');

    // --- getWaveEnemyStats HP 스케일링 ---
    const stats1 = getWaveEnemyStats(1);
    assertEqual(stats1.hp, 78, 'getWaveEnemyStats: 웨이브 1 체력 = ENEMY_BASE_HP(78)');

    const stats2 = getWaveEnemyStats(2);
    assertEqual(stats2.hp, Math.round(78 * 1.18), 'getWaveEnemyStats: 웨이브 2 체력 = 78 * 1.18');

    // --- getWaveEnemyStats 고웨이브 Infinity 방어 ---
    const statsHigh = getWaveEnemyStats(9999);
    assert(Number.isFinite(statsHigh.hp), 'getWaveEnemyStats: 웨이브 9999 체력은 유한수');
    assert(statsHigh.hp <= Number.MAX_SAFE_INTEGER, 'getWaveEnemyStats: 웨이브 9999 체력은 MAX_SAFE_INTEGER 이하');

    // --- getWaveEnemyStats 보상 스케일링 ---
    const reward1 = getWaveEnemyStats(1).reward;
    assertEqual(reward1, Math.round(14 + 1 * 1.5), 'getWaveEnemyStats: 웨이브 1 보상 = 14 + 1*1.5');
    const reward10 = getWaveEnemyStats(10).reward;
    assertEqual(reward10, Math.round(14 + 10 * 1.5), 'getWaveEnemyStats: 웨이브 10 보상 = 14 + 10*1.5');

    // --- applyExplosion 범위 피해 ---
    enemies.length = 0;
    const mockStyle = { body: '#fff', core: '#fff', outline: '#000', halo: 'rgba(255,255,255,0.5)' };
    enemies.push({ x: 100, y: 100, hp: 100, maxHp: 100, reward: 14, waveIndex: 1, style: mockStyle, waypoint: 0 });
    enemies.push({ x: 500, y: 500, hp: 100, maxHp: 100, reward: 14, waveIndex: 1, style: mockStyle, waypoint: 0 });
    const mockProjectile = {
        damage: 200,
        explosionRadius: 200,
        explosionColor: 'rgba(0,0,0,0)',
        explosionHaloColor: '#fff',
        explosionStrokeColor: null,
        explosionLife: 0.1
    };
    applyExplosion(mockProjectile, 100, 100);
    assertEqual(enemies.length, 1, 'applyExplosion: 범위(200px) 내 적 1마리 제거');
    assert(enemies[0].x === 500, 'applyExplosion: 범위 밖 적(500,500)은 생존');

    console.log('Unit tests passed ✓');
}

if (require.main === module) {
    run();
}

module.exports = { run };
