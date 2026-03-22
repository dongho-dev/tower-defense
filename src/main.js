import { TILE_SIZE, AUTOCOLLAPSE_WIDTH, DEFAULT_TOWER_TYPE } from './constants.js';
import { canvas, GRID_COLS, GRID_ROWS, state } from './state.js';
import { getTowerDefinition } from './utils.js';
import { ensureAudioContext, setSoundMuted, isSoundMuted, playSound } from './audio.js';
import {
    updateGoldUI,
    hideAllStats,
    showTowerStats,
    showEnemyStats,
    populateTowerList,
    setBuildPanelCollapsed,
    updateSpeedControls,
    updateWavePreview,
    setGameSpeed,
    BUILD_TOGGLE,
    BUILD_CONTAINER,
    SPEED_BUTTONS,
    WAVE_INPUT,
    WAVE_APPLY_BUTTON,
    GOLD_INPUT,
    GOLD_APPLY_BUTTON,
    GOLD_ADJUST_BUTTONS,
    DEFEAT_OVERLAY,
    RETRY_BUTTON,
    CANCEL_RETRY_BUTTON,
    LIVES_LABEL,
    WAVE_LABEL,
    hideDefeatDialog
} from './ui.js';
import {
    update,
    setWave,
    resetGame,
    getTowerAtPoint,
    getEnemyAtPoint,
    upgradeTower,
    createTowerData
} from './game.js';
import { canBuildAt } from './map.js';
import { render } from './renderer.js';

canvas.addEventListener("mousemove", event => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((event.clientY - rect.top) / TILE_SIZE);
    if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS) {
        state.hoverTile = { x, y };
    } else {
        state.hoverTile = null;
    }
});

canvas.addEventListener("mouseleave", () => {
    state.hoverTile = null;
});

canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const tower = getTowerAtPoint(canvasX, canvasY);
    if (tower) {
        showTowerStats(tower);
        return;
    }

    const enemy = getEnemyAtPoint(canvasX, canvasY);
    if (enemy) {
        showEnemyStats(enemy);
        return;
    }

    const x = Math.floor(canvasX / TILE_SIZE);
    const y = Math.floor(canvasY / TILE_SIZE);

    if (state.paused) {
        hideAllStats();
        return;
    }

    if (!canBuildAt(x, y)) {
        hideAllStats();
        return;
    }

    const towerDef = getTowerDefinition(state.selectedTowerType);
    const cost = towerDef.cost || 25;
    if (state.gold < cost) {
        return;
    }

    state.gold -= cost;
    updateGoldUI();
    const towerData = createTowerData(x, y, towerDef.id);
    state.towers.push(towerData);
    playSound('build');
    showTowerStats(towerData);
});

canvas.addEventListener("contextmenu", event => {
    event.preventDefault();
    if (state.gameOver) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const tower = getTowerAtPoint(canvasX, canvasY);
    if (!tower) {
        return;
    }
    upgradeTower(tower);
});

populateTowerList();

if (BUILD_TOGGLE) {
    BUILD_TOGGLE.addEventListener('click', () => {
        setBuildPanelCollapsed(!state.buildPanelCollapsed, { user: true });
        playSound('toggle');
    });
}

setBuildPanelCollapsed(false);

if (typeof window !== 'undefined') {
    const autoCollapse = () => {
        if (state.buildPanelUserOverride) {
            return;
        }
        setBuildPanelCollapsed(window.innerWidth < AUTOCOLLAPSE_WIDTH);
    };
    autoCollapse();
    window.addEventListener('resize', () => {
        if (state.buildPanelUserOverride) {
            return;
        }
        autoCollapse();
    });
} else {
    setBuildPanelCollapsed(false);
}

const SOUND_TOGGLE = document.getElementById('sound-toggle');
if (SOUND_TOGGLE) {
    SOUND_TOGGLE.addEventListener('click', () => {
        if (isSoundMuted()) {
            if (!ensureAudioContext()) {
                return;
            }
            setSoundMuted(false);
            playSound('toggle');
        } else {
            playSound('toggle');
            setSoundMuted(true);
        }
    });
}

SPEED_BUTTONS.forEach(button => {
    button.addEventListener('click', () => {
        const multiplier = Number(button.dataset.speed) || 1;
        setGameSpeed(multiplier);
    });
});

if (WAVE_APPLY_BUTTON && WAVE_INPUT) {
    const applyWaveFromInput = () => {
        const value = Number(WAVE_INPUT.value);
        if (!Number.isFinite(value)) {
            WAVE_INPUT.value = state.wave;
            return;
        }
        setWave(value);
    };
    WAVE_APPLY_BUTTON.addEventListener('click', applyWaveFromInput);
    WAVE_INPUT.addEventListener('change', applyWaveFromInput);
    WAVE_INPUT.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            applyWaveFromInput();
        }
    });
}

if (GOLD_APPLY_BUTTON && GOLD_INPUT) {
    const applyGold = () => {
        const value = Number(GOLD_INPUT.value);
        if (!Number.isFinite(value)) {
            GOLD_INPUT.value = state.gold;
            return;
        }
        state.gold = Math.max(0, Math.floor(value));
        updateGoldUI();
    };
    GOLD_APPLY_BUTTON.addEventListener('click', applyGold);
    GOLD_INPUT.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            applyGold();
        }
    });
}

GOLD_ADJUST_BUTTONS.forEach(button => {
    button.addEventListener('click', () => {
        const delta = Number(button.dataset.delta) || 0;
        state.gold = Math.max(0, state.gold + delta);
        updateGoldUI();
    });
});

if (RETRY_BUTTON) {
    RETRY_BUTTON.addEventListener('click', () => {
        resetGame();
    });
}

if (CANCEL_RETRY_BUTTON) {
    CANCEL_RETRY_BUTTON.addEventListener('click', () => {
        hideDefeatDialog();
    });
}

if (DEFEAT_OVERLAY) {
    DEFEAT_OVERLAY.addEventListener('click', event => {
        if (event.target === DEFEAT_OVERLAY) {
            hideDefeatDialog();
        }
    });
}

document.addEventListener("keydown", event => {
    if (event.code === "Space") {
        if (state.lives === 0 || state.gameOver) {
            return;
        }
        state.paused = !state.paused;
        event.preventDefault();
    }
});

state.lastTime = performance.now();
function loop(timestamp) {
    const dt = (timestamp - state.lastTime) / 1000;
    state.lastTime = timestamp;
    if (!state.paused) {
        const scaledDt = dt * state.gameSpeed;
        state.elapsedTime += scaledDt;
        update(scaledDt);
    }
    render();
    requestAnimationFrame(loop);
}

updateSpeedControls();
updateWavePreview();
updateGoldUI();
if (WAVE_INPUT) {
    WAVE_INPUT.value = state.wave;
}

requestAnimationFrame(loop);
