import { TILE_SIZE, DEFAULT_TOWER_TYPE } from './constants.js';

export const canvas = document.getElementById("game");
export const ctx = canvas.getContext("2d");

export const GRID_COLS = Math.floor(canvas.width / TILE_SIZE);
export const GRID_ROWS = Math.floor(canvas.height / TILE_SIZE);
export const TILE_CENTER_OFFSET = TILE_SIZE / 2;

export const state = {
    towers: [],
    enemies: [],
    projectiles: [],
    impactEffects: [],
    muzzleFlashes: [],
    gold: 100,
    lives: 20,
    wave: 1,
    waveInProgress: false,
    enemiesToSpawn: 0,
    spawnCooldown: 0,
    nextWaveTimer: 0,
    paused: false,
    hoverTile: null,
    selectedTower: null,
    selectedEnemy: null,
    gameSpeed: 1,
    gameOver: false,
    selectedTowerType: DEFAULT_TOWER_TYPE,
    buildPanelCollapsed: false,
    buildPanelUserOverride: false,
    TOWER_SELECTOR_BUTTONS: [],
    elapsedTime: 0,
    lastTime: 0,
};
