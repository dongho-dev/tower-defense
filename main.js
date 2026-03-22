// ── Shared pointer coordinate helpers ──────────────────────────────────────

/**
 * Convert a client-space point to canvas-space coordinates,
 * accounting for any CSS scaling applied to the canvas element.
 */
let _cachedCanvasRect = null;
function updateCanvasRect() {
    if (canvas) _cachedCanvasRect = canvas.getBoundingClientRect();
}
function getCanvasCoords(clientX, clientY) {
    const rect = _cachedCanvasRect || canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

/**
 * Shared handler for pointer/touch hover (mousemove / touchmove).
 * @param {number} canvasX - Canvas-space X coordinate
 * @param {number} canvasY - Canvas-space Y coordinate
 */
const _hoverTileObj = { x: 0, y: 0 };
function handlePointerMove(canvasX, canvasY) {
    kbCursorActive = false;
    const tileX = Math.floor(canvasX / TILE_SIZE);
    const tileY = Math.floor(canvasY / TILE_SIZE);
    if (tileX >= 0 && tileX < GRID_COLS && tileY >= 0 && tileY < GRID_ROWS) {
        _hoverTileObj.x = tileX;
        _hoverTileObj.y = tileY;
        gameState.hoverTile = _hoverTileObj;
    } else {
        gameState.hoverTile = null;
    }
    renderDirty = true;
}

/**
 * Shared handler for pointer/touch down (click / touchstart).
 * @param {number} canvasX    - Canvas-space X coordinate
 * @param {number} canvasY    - Canvas-space Y coordinate
 * @param {boolean} isRightClick - true for secondary action (upgrade), false for primary (build/select)
 */
function handlePointerDown(canvasX, canvasY, isRightClick) {
    if (gameState.gameOver) return;
    if (isRightClick) {
        const tower = getTowerAtPoint(canvasX, canvasY);
        if (!tower) {
            return;
        }
        upgradeTower(tower);
        return;
    }

    // Primary action: select tower / enemy, or build
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

    if (gameState.paused) {
        hideAllStats();
        return;
    }

    if (!canBuildAt(x, y)) {
        announce('해당 위치에 설치할 수 없습니다');
        gameState.buildFailFlash = { x, y, timer: 0.3 };
        hideAllStats();
        return;
    }

    const towerDef = getTowerDefinition(gameState.selectedTowerType);
    const cost = towerDef.cost || 25;
    if (gameState.gold < cost) {
        flashGoldInsufficient();
        return;
    }

    gameState.gold -= cost;
    updateGoldUI();
    const towerData = createTowerData(x, y, towerDef.id);
    towers.push(towerData);
    towerPositionSet.add(keyFromGrid(x, y));
    playSound('build');
    showTowerStats(towerData);
    announce(towerDef.label + ' 설치 완료');
}

// ── Mouse event handlers ────────────────────────────────────────────────────

canvas.addEventListener('mousemove', (event) => {
    const { x, y } = getCanvasCoords(event.clientX, event.clientY);
    handlePointerMove(x, y);
});

canvas.addEventListener('focus', () => {
    if (!kbCursor) initKbCursor();
    kbCursorActive = true;
    renderDirty = true;
});

canvas.addEventListener('blur', () => {
    kbCursorActive = false;
    renderDirty = true;
});

canvas.addEventListener('mouseleave', () => {
    gameState.hoverTile = null;
});

canvas.addEventListener('click', (event) => {
    const { x, y } = getCanvasCoords(event.clientX, event.clientY);
    handlePointerDown(x, y, false);
});

canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const { x, y } = getCanvasCoords(event.clientX, event.clientY);
    handlePointerDown(x, y, true);
});

// ── Touch event handlers ────────────────────────────────────────────────────

canvas.addEventListener(
    'touchstart',
    function (e) {
        if (e.touches.length > 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (!touch) return;
        const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
        _touchStartX = touch.clientX;
        _touchStartY = touch.clientY;
        _longPressFired = false;
        if (_longPressTimer) clearTimeout(_longPressTimer);
        _longPressTimer = setTimeout(() => {
            _longPressFired = true;
            handlePointerDown(x, y, true);
        }, LONG_PRESS_DURATION);
    },
    { passive: false }
);

canvas.addEventListener(
    'touchmove',
    function (e) {
        if (e.touches.length > 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (!touch) return;
        const dx = touch.clientX - _touchStartX;
        const dy = touch.clientY - _touchStartY;
        if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) {
            if (_longPressTimer) {
                clearTimeout(_longPressTimer);
                _longPressTimer = null;
            }
        }
        const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
        handlePointerMove(x, y);
    },
    { passive: false }
);

canvas.addEventListener(
    'touchend',
    function (e) {
        if (e.touches.length > 0) return;
        e.preventDefault();
        if (_longPressTimer) {
            clearTimeout(_longPressTimer);
            _longPressTimer = null;
        }
        if (!_longPressFired) {
            const touch = e.changedTouches[0];
            if (touch) {
                const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
                handlePointerDown(x, y, false);
            }
        }
        _longPressFired = false;
        gameState.hoverTile = null;
    },
    { passive: false }
);

populateTowerList();

if (BUILD_TOGGLE) {
    BUILD_TOGGLE.addEventListener('click', () => {
        setBuildPanelCollapsed(!buildPanelCollapsed, { user: true });
        playSound('toggle');
    });
}

setBuildPanelCollapsed(false);

if (typeof window !== 'undefined') {
    const autoCollapse = () => {
        if (buildPanelUserOverride) {
            return;
        }
        setBuildPanelCollapsed(window.innerWidth < AUTOCOLLAPSE_WIDTH);
    };
    autoCollapse();
    let resizeRaf = 0;
    window.addEventListener('resize', () => {
        updateCanvasRect();
        if (buildPanelUserOverride) return;
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(autoCollapse);
    });
    updateCanvasRect();
} else {
    setBuildPanelCollapsed(false);
}

if (SOUND_TOGGLE) {
    SOUND_TOGGLE.addEventListener('click', () => {
        if (soundMuted) {
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

SPEED_BUTTONS.forEach((button) => {
    button.addEventListener('click', () => {
        const multiplier = Number(button.dataset.speed) || 1;
        setGameSpeed(multiplier);
        announce(`게임 속도 ${multiplier}배`);
    });
});

if (WAVE_APPLY_BUTTON && WAVE_INPUT) {
    const applyWaveFromInput = () => {
        const value = Number(WAVE_INPUT.value);
        if (!Number.isFinite(value)) {
            WAVE_INPUT.value = gameState.wave;
            return;
        }
        setWave(value);
    };
    WAVE_APPLY_BUTTON.addEventListener('click', applyWaveFromInput);
    WAVE_INPUT.addEventListener('change', applyWaveFromInput);
    WAVE_INPUT.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            applyWaveFromInput();
        }
    });
}

if (GOLD_APPLY_BUTTON && GOLD_INPUT) {
    const applyGold = () => {
        const value = Number(GOLD_INPUT.value);
        if (!Number.isFinite(value)) {
            GOLD_INPUT.value = gameState.gold;
            return;
        }
        gameState.gold = Math.max(0, Math.min(999999, Math.floor(value)));
        updateGoldUI();
    };
    GOLD_APPLY_BUTTON.addEventListener('click', applyGold);
    GOLD_INPUT.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            applyGold();
        }
    });
}

GOLD_ADJUST_BUTTONS.forEach((button) => {
    button.addEventListener('click', () => {
        const delta = Number(button.dataset.delta) || 0;
        gameState.gold = Math.min(999999, Math.max(0, gameState.gold + delta));
        updateGoldUI();
    });
});

if (UPGRADE_TOWER_BUTTON) {
    UPGRADE_TOWER_BUTTON.addEventListener('click', () => {
        if (gameState.selectedTower && !gameState.gameOver) {
            upgradeTower(gameState.selectedTower);
        }
    });
}

if (SELL_TOWER_BUTTON) {
    SELL_TOWER_BUTTON.addEventListener('click', () => {
        if (gameState.selectedTower) sellTower(gameState.selectedTower);
    });
}

if (RETRY_BUTTON) {
    RETRY_BUTTON.addEventListener('click', () => {
        hideDefeatDialog();
        resetGame();
        populateMapList();
        showMapSelectOverlay();
    });
}

if (CANCEL_RETRY_BUTTON) {
    CANCEL_RETRY_BUTTON.addEventListener('click', () => {
        hideDefeatDialog();
        showMapSelectOverlay();
    });
}

if (START_GAME_BUTTON) {
    START_GAME_BUTTON.addEventListener('click', () => {
        hideMapSelectOverlay();
        resetGame();
        buildStaticLayer();
        gameState.paused = false;
        startLoop();
    });
}

if (DEFEAT_OVERLAY) {
    DEFEAT_OVERLAY.addEventListener('click', (event) => {
        if (event.target === DEFEAT_OVERLAY) {
            hideDefeatDialog();
        }
    });

    DEFEAT_OVERLAY.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            hideDefeatDialog();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(
            DEFEAT_OVERLAY.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter((el) => !el.disabled);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
            if (document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
}

if (MAP_SELECT_OVERLAY) {
    MAP_SELECT_OVERLAY.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            // 맵 선택은 필수 단계이므로 Escape 무시
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(
            MAP_SELECT_OVERLAY.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
        ).filter((el) => !el.disabled);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
            if (document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
}

document.addEventListener('keydown', (event) => {
    const tag = event.target ? event.target.tagName : '';
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const overlayOpen =
        (DEFEAT_OVERLAY && !DEFEAT_OVERLAY.classList.contains('hidden')) ||
        (MAP_SELECT_OVERLAY && !MAP_SELECT_OVERLAY.classList.contains('hidden'));

    if (event.code === 'Space') {
        if (gameState.lives === 0 || gameState.gameOver || overlayOpen) {
            return;
        }
        gameState.paused = !gameState.paused;
        renderDirty = true;
        announce(gameState.paused ? '일시 정지' : '게임 재개');
        event.preventDefault();
        return;
    }

    if ((event.key === 'u' || event.key === 'U') && !isInput) {
        if (gameState.selectedTower && !gameState.gameOver) {
            const success = upgradeTower(gameState.selectedTower);
            if (!success && gameState.selectedTower) {
                const cost = gameState.selectedTower.upgradeCost;
                if (cost != null && gameState.gold < cost) {
                    flashGoldInsufficient();
                }
            }
        }
        return;
    }

    if (!isInput && !overlayOpen) {
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                moveKbCursor(0, -1);
                return;
            case 'ArrowDown':
                event.preventDefault();
                moveKbCursor(0, 1);
                return;
            case 'ArrowLeft':
                event.preventDefault();
                moveKbCursor(-1, 0);
                return;
            case 'ArrowRight':
                event.preventDefault();
                moveKbCursor(1, 0);
                return;
            case 'Enter':
                event.preventDefault();
                activateKbCursor(event.shiftKey);
                return;
            case 's':
            case 'S':
                if (gameState.selectedTower && !gameState.gameOver) sellTower(gameState.selectedTower);
                return;
            case 'Escape':
                kbCursorActive = false;
                kbCursor = null;
                gameState.hoverTile = null;
                hideAllStats();
                renderDirty = true;
                return;
        }
    }
});

let elapsedTime = 0;
let lastTime = performance.now();
let rafHandle = 0;
let loopErrorCount = 0;
let renderDirty = true;
function markRenderDirty() {
    renderDirty = true;
}
const MAX_LOOP_ERRORS = 10;
function loop(timestamp) {
    try {
        const rawDt = (timestamp - lastTime) / 1000;
        const dt = Math.min(rawDt, 0.1);
        lastTime = timestamp;
        if (!gameState.paused) {
            const scaledDt = dt * gameState.gameSpeed;
            elapsedTime += scaledDt;
            update(scaledDt);
            render();
        } else if (renderDirty) {
            render();
            renderDirty = false;
        }
        loopErrorCount = 0;
    } catch (e) {
        console.error('Game loop error:', e.message || e);
        loopErrorCount++;
        if (loopErrorCount >= MAX_LOOP_ERRORS) {
            console.error('Game loop halted after repeated errors.');
            gameState.gameLoopHalted = true;
            announce('게임에 오류가 발생했습니다. 페이지를 새로고침 해주세요.');
            try {
                render();
            } catch (renderErr) {
                console.error('Render error during halt:', renderErr);
            }
            return;
        }
    }
    if (gameState.gameLoopHalted) return;
    rafHandle = requestAnimationFrame(loop);
}

function stopLoop() {
    if (rafHandle) {
        cancelAnimationFrame(rafHandle);
        rafHandle = 0;
    }
}

function startLoop() {
    stopLoop();
    loopErrorCount = 0;
    lastTime = performance.now();
    rafHandle = requestAnimationFrame(loop);
}

updateSpeedControls();
updateWavePreview();
updateGoldUI();
if (WAVE_INPUT) {
    WAVE_INPUT.value = gameState.wave;
}

populateMapList();
showMapSelectOverlay();

if (typeof module !== 'undefined') {
    module.exports = {
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
        gold: () => gameState.gold,
        canBuildAt,
        findTarget,
        createTowerData,
        upgradeTower,
        damageEnemy,
        damageEnemyAtIndex,
        pickEnemyType,
        pathTiles,
        ENEMY_TYPE_DEFINITIONS,
        ENEMY_TYPE_MAP,
        GRID_COLS,
        GRID_ROWS,
        TOWER_MAX_LEVEL,
        projectiles,
        setGameSpeed,
        getGameSpeed: () => gameState.gameSpeed,
        setGold: (v) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) return;
            gameState.gold = Math.max(0, Math.min(999999, Math.floor(v)));
        },
        getGameOver: () => gameState.gameOver,
        setGameOver: (v) => {
            gameState.gameOver = v;
        },
        getEnemiesToSpawn: () => gameState.enemiesToSpawn,
        setEnemiesToSpawn: (v) => {
            gameState.enemiesToSpawn = v;
        },
        lerpAngle,
        resetGame,
        buildStaticLayer,
        buildMapData,
        startWave,
        handleLaserAttack,
        initKbCursor,
        moveKbCursor,
        activateKbCursor,
        getKbCursor: () => kbCursor,
        getKbCursorActive: () => kbCursorActive,
        getWaypoints: () => waypoints,
        getWave: () => gameState.wave,
        getLives: () => gameState.lives,
        getNextWaveTimer: () => gameState.nextWaveTimer,
        getWaveInProgress: () => gameState.waveInProgress,
        setWaveInProgress: (v) => {
            gameState.waveInProgress = v;
        },
        setNextWaveTimer: (v) => {
            gameState.nextWaveTimer = v;
        },
        setWave: (v) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) return;
            gameState.wave = Math.max(1, Math.min(WAVE_MAX, Math.floor(v)));
        },
        setLives: (v) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) return;
            gameState.lives = Math.max(0, Math.floor(v));
        },
        getPrefersReducedMotion: () => prefersReducedMotion,
        update,
        spawnEnemy,
        handlePointerDown,
        getPaused: () => gameState.paused,
        setPaused: (v) => {
            gameState.paused = !!v;
        },
        getAdjustedPickRadius,
        getGameLoopHalted: () => gameState.gameLoopHalted,
        gameState,
        towerPositionSet,
        markRenderDirty,
        getRenderDirty: () => renderDirty
    };
}
