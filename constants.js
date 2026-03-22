const canvas = document.getElementById('game');
if (!canvas) {
    throw new Error('Canvas element #game not found');
}
let ctx = canvas.getContext('2d');
if (!ctx) {
    throw new Error('Failed to get 2D rendering context');
}

let staticLayer = null;

const TILE_SIZE = 30;
const GRID_COLS = Math.floor(canvas.width / TILE_SIZE);
const GRID_ROWS = Math.floor(canvas.height / TILE_SIZE);
const TILE_CENTER_OFFSET = TILE_SIZE / 2;
const TOWER_DRAW_BASE = 14;
const TOWER_PICK_RADIUS = 18;
const ENEMY_RADIUS = 14;
const ENEMY_BASE_HP = 78;
const ENEMY_HP_GROWTH_RATE = 1.18;
const ENEMY_SPEED = 49;
const ENEMY_BASE_REWARD = 14;
const TOWER_UPGRADE_BASE_COST = 40;
const TOWER_DAMAGE_GROWTH = 1.5;
const TOWER_UPGRADE_COST_MULTIPLIER = 1.6;
const TOWER_MAX_LEVEL = 15;
const WAVE_CLEAR_BONUS_BASE = 20;
const WAVE_CLEAR_BONUS_PER_WAVE = 5;
const TOWER_SELL_REFUND_RATE = 0.5;
const WAVE_MAX = 9999;
const DEFAULT_TOWER_TYPE = 'basic';
const AUTOCOLLAPSE_WIDTH = 1180;

let prefersReducedMotion = false;
if (typeof window !== 'undefined' && window.matchMedia) {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = motionQuery.matches;
    motionQuery.addEventListener('change', (e) => {
        prefersReducedMotion = e.matches;
    });
}

const ENEMY_TYPE_DEFINITIONS = [
    {
        id: 'normal',
        label: '일반',
        hpMult: 1.0,
        speedMult: 1.0,
        rewardMult: 1.0,
        spawnWeight: 50,
        minWave: 1,
        bossOnly: false,
        body: '#d65a57',
        core: '#ffe6c2',
        outline: '#321816',
        thruster: '#ff9a6d',
        halo: 'rgba(214, 90, 87, 0.55)'
    },
    {
        id: 'armored',
        label: '장갑',
        hpMult: 3.0,
        speedMult: 0.6,
        rewardMult: 2.0,
        spawnWeight: 20,
        minWave: 3,
        bossOnly: false,
        body: '#5d7dff',
        core: '#d8e1ff',
        outline: '#19224f',
        thruster: '#8aa8ff',
        halo: 'rgba(93, 125, 255, 0.55)'
    },
    {
        id: 'fast',
        label: '고속',
        hpMult: 0.4,
        speedMult: 2.5,
        rewardMult: 1.5,
        spawnWeight: 30,
        minWave: 3,
        bossOnly: false,
        body: '#58d6a4',
        core: '#d4ffe7',
        outline: '#12392a',
        thruster: '#7ef2c9',
        halo: 'rgba(88, 214, 164, 0.55)'
    },
    {
        id: 'boss',
        label: '보스',
        hpMult: 12.0,
        speedMult: 0.7,
        rewardMult: 8.0,
        spawnWeight: 0,
        minWave: 1,
        bossOnly: true,
        body: '#c95de9',
        core: '#f5d1ff',
        outline: '#3d1649',
        thruster: '#ff96f3',
        halo: 'rgba(201, 93, 233, 0.55)'
    }
];

const ENEMY_TYPE_MAP = {};
ENEMY_TYPE_DEFINITIONS.forEach((t) => {
    ENEMY_TYPE_MAP[t.id] = t;
});

const TARGET_PRIORITIES = [
    { key: 'first', label: '선두' },
    { key: 'last', label: '후미' },
    { key: 'strongest', label: '강한 적' },
    { key: 'weakest', label: '약한 적' },
    { key: 'closest', label: '가까운 적' }
];

const EventBus = {
    _listeners: {},
    on: function (event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
    },
    off: function (event, fn) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(function (f) {
            return f !== fn;
        });
    },
    emit: function (event, data) {
        if (!this._listeners[event]) return;
        var snapshot = this._listeners[event].slice();
        for (var i = 0; i < snapshot.length; i++) {
            try {
                snapshot[i](data);
            } catch (e) {
                console.warn('EventBus listener error on "' + event + '":', e);
            }
        }
    }
};

const gameState = {
    gold: 100,
    lives: 20,
    wave: 1,
    waveInProgress: false,
    enemiesToSpawn: 0,
    spawnCooldown: 0,
    nextWaveTimer: 0,
    paused: false,
    gameOver: false,
    gameLoopHalted: false,
    gameSpeed: 1,
    selectedTower: null,
    selectedEnemy: null,
    selectedTowerType: DEFAULT_TOWER_TYPE,
    hoverTile: null,
    buildFailFlash: null
};
