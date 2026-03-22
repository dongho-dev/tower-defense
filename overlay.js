let _defeatPreviousFocus = null;

function showDefeatDialog() {
    if (gameState.gameOver) {
        return;
    }
    gameState.gameOver = true;
    gameState.paused = true;
    render();
    stopLoop();
    clearCurrentWave();
    gameState.selectedTowerType = DEFAULT_TOWER_TYPE;
    setSelectedTowerButton(gameState.selectedTowerType);
    setGameSpeed(1);
    if (DEFEAT_OVERLAY) {
        _defeatPreviousFocus = document.activeElement;
        var statWave = document.getElementById('stat-wave');
        var statKills = document.getElementById('stat-kills');
        var statTowers = document.getElementById('stat-towers');
        var statGoldSpent = document.getElementById('stat-gold-spent');
        if (statWave) statWave.textContent = gameState.wave;
        if (statKills) statKills.textContent = gameState.totalKills;
        if (statTowers) statTowers.textContent = gameState.towersBuilt;
        if (statGoldSpent) statGoldSpent.textContent = formatNumber(gameState.totalGoldSpent);
        DEFEAT_OVERLAY.classList.remove('hidden');
        if (RETRY_BUTTON) {
            RETRY_BUTTON.focus();
        }
    }
    EventBus.emit('wave:changed', { remaining: 0 });
    announce('패배했습니다');
}

function hideDefeatDialog() {
    if (!DEFEAT_OVERLAY) {
        return;
    }
    DEFEAT_OVERLAY.classList.add('hidden');
    if (_defeatPreviousFocus && typeof _defeatPreviousFocus.focus === 'function') {
        _defeatPreviousFocus.focus();
        _defeatPreviousFocus = null;
    }
}

let _mapSelectPreviousFocus = null;

function showMapSelectOverlay() {
    if (!MAP_SELECT_OVERLAY) {
        return;
    }
    _mapSelectPreviousFocus = document.activeElement;
    gameState.paused = true;
    MAP_SELECT_OVERLAY.classList.remove('hidden');
    const firstFocusable = MAP_SELECT_OVERLAY.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) {
        firstFocusable.focus();
    }
}

function hideMapSelectOverlay() {
    if (!MAP_SELECT_OVERLAY) {
        return;
    }
    MAP_SELECT_OVERLAY.classList.add('hidden');
    if (_mapSelectPreviousFocus && typeof _mapSelectPreviousFocus.focus === 'function') {
        _mapSelectPreviousFocus.focus();
        _mapSelectPreviousFocus = null;
    }
}

function drawMapPreview(previewCtx, rawWaypoints, width, height) {
    if (!previewCtx || !rawWaypoints || rawWaypoints.length < 2) return;
    var xs = rawWaypoints.map(function (p) {
        return p.x;
    });
    var ys = rawWaypoints.map(function (p) {
        return p.y;
    });
    var minX = Math.min.apply(null, xs),
        maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys),
        maxY = Math.max.apply(null, ys);
    var rangeX = maxX - minX || 1;
    var rangeY = maxY - minY || 1;
    var padding = 10;
    var scaleX = (width - padding * 2) / rangeX;
    var scaleY = (height - padding * 2) / rangeY;
    var scale = Math.min(scaleX, scaleY);
    var offsetX = (width - rangeX * scale) / 2;
    var offsetY = (height - rangeY * scale) / 2;
    previewCtx.strokeStyle = '#6296ff';
    previewCtx.lineWidth = 3;
    previewCtx.lineCap = 'round';
    previewCtx.lineJoin = 'round';
    previewCtx.beginPath();
    for (var i = 0; i < rawWaypoints.length; i++) {
        var px = (rawWaypoints[i].x - minX) * scale + offsetX;
        var py = (rawWaypoints[i].y - minY) * scale + offsetY;
        if (i === 0) previewCtx.moveTo(px, py);
        else previewCtx.lineTo(px, py);
    }
    previewCtx.stroke();
    var start = rawWaypoints[0];
    var end = rawWaypoints[rawWaypoints.length - 1];
    previewCtx.fillStyle = '#4caf50';
    previewCtx.beginPath();
    previewCtx.arc((start.x - minX) * scale + offsetX, (start.y - minY) * scale + offsetY, 4, 0, Math.PI * 2);
    previewCtx.fill();
    previewCtx.fillStyle = '#f44336';
    previewCtx.beginPath();
    previewCtx.arc((end.x - minX) * scale + offsetX, (end.y - minY) * scale + offsetY, 4, 0, Math.PI * 2);
    previewCtx.fill();
}

function populateMapList() {
    if (!MAP_LIST_CONTAINER) {
        return;
    }
    MAP_LIST_CONTAINER.innerHTML = '';
    const cards = [];
    for (const mapDef of Object.values(MAP_DEFINITIONS)) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'map-card' + (mapDef.id === activeMapId ? ' selected' : '');
        card.dataset.mapId = mapDef.id;

        const nameEl = document.createElement('span');
        nameEl.className = 'map-card-name';
        nameEl.textContent = mapDef.name;

        const diffEl = document.createElement('span');
        diffEl.className = 'map-card-difficulty';
        diffEl.textContent = '난이도: ' + mapDef.difficulty;

        var previewCanvas = document.createElement('canvas');
        previewCanvas.width = 150;
        previewCanvas.height = 100;
        previewCanvas.className = 'map-preview-canvas';
        previewCanvas.setAttribute('aria-hidden', 'true');
        var previewCtx = previewCanvas.getContext('2d');
        drawMapPreview(previewCtx, mapDef.rawWaypoints, 150, 100);

        var paramsEl = document.createElement('span');
        paramsEl.className = 'map-card-params';
        paramsEl.textContent = '골드: ' + (mapDef.initialGold ?? 100) + ' / 생명력: ' + (mapDef.initialLives ?? 20);

        card.setAttribute('role', 'radio');
        card.setAttribute('aria-checked', String(mapDef.id === activeMapId));
        card.setAttribute('tabindex', mapDef.id === activeMapId ? '0' : '-1');
        card.append(nameEl, previewCanvas, diffEl, paramsEl);
        card.addEventListener('click', () => {
            activeMapId = mapDef.id;
            cards.forEach((c) => {
                const isSelected = c.dataset.mapId === activeMapId;
                c.classList.toggle('selected', isSelected);
                c.setAttribute('aria-checked', String(isSelected));
                c.setAttribute('tabindex', isSelected ? '0' : '-1');
            });
        });
        MAP_LIST_CONTAINER.appendChild(card);
        cards.push(card);
    }

    MAP_LIST_CONTAINER.addEventListener('keydown', (event) => {
        if (cards.length === 0) return;
        const currentIndex = cards.indexOf(document.activeElement);
        if (currentIndex === -1) return;

        let nextIndex = -1;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            nextIndex = (currentIndex + 1) % cards.length;
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault();
            nextIndex = (currentIndex - 1 + cards.length) % cards.length;
        } else if (event.key === 'Home') {
            event.preventDefault();
            nextIndex = 0;
        } else if (event.key === 'End') {
            event.preventDefault();
            nextIndex = cards.length - 1;
        }

        if (nextIndex !== -1) {
            cards[currentIndex].setAttribute('tabindex', '-1');
            cards[nextIndex].setAttribute('tabindex', '0');
            cards[nextIndex].focus();
        }
    });
}

function resetGame() {
    buildMapData(activeMapId);
    staticLayer = null;
    var currentMapDef = MAP_DEFINITIONS[activeMapId] || MAP_DEFINITIONS['map1'];
    gameState.gold = currentMapDef.initialGold ?? 100;
    gameState.lives = currentMapDef.initialLives ?? 20;
    gameState.wave = 1;
    gameState.gameOver = false;
    gameState.paused = false;
    gameState.hoverTile = null;
    gameState.buildFailFlash = null;
    gameState.totalKills = 0;
    gameState.totalGoldSpent = 0;
    gameState.towersBuilt = 0;
    hideAllStats();
    towers.length = 0;
    towerPositionSet.clear();
    clearCurrentWave();
    gameState.selectedTowerType = DEFAULT_TOWER_TYPE;
    setSelectedTowerButton(gameState.selectedTowerType);
    EventBus.emit('gold:changed');
    if (LIVES_LABEL) LIVES_LABEL.textContent = gameState.lives;
    if (WAVE_LABEL) WAVE_LABEL.textContent = gameState.wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = gameState.wave;
    }
    hideDefeatDialog();
    setGameSpeed(1);
    resetBuildPanelOverride();
    if (typeof window !== 'undefined' && window.innerWidth < AUTOCOLLAPSE_WIDTH) {
        setBuildPanelCollapsed(true);
    } else {
        setBuildPanelCollapsed(false);
    }
    EventBus.emit('wave:changed');
    elapsedTime = 0;
    lastTime = performance.now();
    resetAudioCache();
    gameState.gameLoopHalted = false;
    loopErrorCount = 0;
}
