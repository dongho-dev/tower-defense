function clearCurrentWave() {
    enemies.length = 0;
    projectiles.length = 0;
    impactEffects.length = 0;
    muzzleFlashes.length = 0;
    enemiesToSpawn = 0;
    spawnCooldown = 0;
    waveInProgress = false;
    nextWaveTimer = 0;
    hideEnemyStats();
}

function ensureTowerMetadata(tower) {
    if (!tower.type) {
        tower.type = DEFAULT_TOWER_TYPE;
    }
    if (typeof tower.level !== 'number' || tower.level < 1) {
        tower.level = 1;
    }
    recalcTowerStats(tower);
    if (typeof tower.cooldown !== 'number') {
        tower.cooldown = 0;
    }
    if (!tower.activeBeam) {
        tower.activeBeam = null;
    }
}

function setWave(targetWave) {
    if (gameOver) {
        if (WAVE_INPUT) {
            WAVE_INPUT.value = wave;
        }
        return;
    }
    const desiredWave = Math.max(1, Math.min(WAVE_MAX, Math.floor(targetWave)));
    clearCurrentWave();
    hideTowerStats();
    wave = desiredWave;
    if (WAVE_LABEL) WAVE_LABEL.textContent = wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = wave;
    }
    updateWavePreview();
}

function damageEnemyAtIndex(index, amount) {
    const enemy = enemies[index];
    if (!enemy) {
        return false;
    }
    enemy.hp -= amount;
    if (enemy.hp <= 0) {
        const style = enemy.enemyType || ENEMY_TYPE_DEFINITIONS[0];
        spawnImpactEffect(enemy.x, enemy.y, ENEMY_RADIUS * 1.9, style.core || 'rgba(255, 220, 190, 0.7)', {
            haloColor: style.halo || style.body,
            stroke: style.outline || 'rgba(20, 16, 26, 0.7)',
            lineWidth: ENEMY_RADIUS * 0.5,
            life: 0.5,
            pulse: true
        });
        if (selectedEnemy === enemy) {
            hideEnemyStats();
        }
        enemies.splice(index, 1);
        gold = Math.min(999999, gold + enemy.reward);
        updateGoldUI();
        playSound('kill');
        return true;
    }
    return false;
}

function damageEnemy(enemy, amount) {
    const idx = enemies.indexOf(enemy);
    if (idx === -1) {
        return false;
    }
    return damageEnemyAtIndex(idx, amount);
}

function spawnMuzzleFlash(x, y, radius, color, angle, options = {}) {
    const life = options.life ?? 0.18;
    muzzleFlashes.push({
        x,
        y,
        radius,
        startRadius: radius,
        color,
        angle,
        life,
        initialLife: life,
        growth: options.growth ?? radius * 8
    });
}

function spawnImpactEffect(x, y, radius, color, options = {}) {
    const life = options.life ?? 0.35;
    impactEffects.push({
        x,
        y,
        radius,
        color,
        halo: options.haloColor || color,
        stroke: options.stroke || null,
        lineWidth: options.lineWidth || null,
        pulse: Boolean(options.pulse),
        life,
        initialLife: life
    });
}

function applyExplosion(projectile, originX, originY) {
    const radius = projectile.explosionRadius || 0;
    if (radius <= 0) {
        return;
    }
    const radiusSq = radius * radius;
    for (let k = enemies.length - 1; k >= 0; k--) {
        const foe = enemies[k];
        const dx = foe.x - originX;
        const dy = foe.y - originY;
        if (dx * dx + dy * dy <= radiusSq) {
            damageEnemyAtIndex(k, projectile.damage);
        }
    }
    const effectColor = projectile.explosionColor || 'rgba(255, 210, 120, 0.4)';
    spawnImpactEffect(originX, originY, radius, effectColor, {
        haloColor: projectile.explosionHaloColor || '#ffeac8',
        stroke: projectile.explosionStrokeColor || null,
        lineWidth: projectile.explosionStrokeColor ? radius * 0.18 : undefined,
        life: projectile.explosionLife || 0.45,
        pulse: true
    });
    playSound('explosion');
}

function showTowerStats(tower) {
    if (!tower || !TOWER_STATS_PANEL) {
        return;
    }
    ensureTowerMetadata(tower);
    selectedTower = tower;
    TOWER_STATS_PANEL.classList.remove('hidden');
    updateTowerStatsFields();
    const def = getTowerDefinition(tower.type);
    announce(def.label + ' 포탑 정보');
}

function showEnemyStats(enemy) {
    if (!enemy || !ENEMY_STATS_PANEL) {
        return;
    }
    selectedEnemy = enemy;
    ENEMY_STATS_PANEL.classList.remove('hidden');
    updateEnemyStatsFields();
    const typeName = (enemy.enemyType || ENEMY_TYPE_DEFINITIONS[0]).label;
    announce(typeName + ' 적 정보');
}

function getAdjustedPickRadius(baseRadius) {
    if (!canvas) return baseRadius;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return baseRadius;
    const scale = rect.width / canvas.width;
    if (scale >= 1) return baseRadius;
    const minRadiusInCanvas = 22 / scale;
    return Math.max(baseRadius, minRadiusInCanvas);
}

function getTowerAtPoint(px, py) {
    const radius = getAdjustedPickRadius(TOWER_PICK_RADIUS);
    for (let i = towers.length - 1; i >= 0; i--) {
        const tower = towers[i];
        if (Math.hypot(px - tower.worldX, py - tower.worldY) <= radius) {
            return tower;
        }
    }
    return null;
}

function getEnemyAtPoint(px, py) {
    const radius = getAdjustedPickRadius(ENEMY_RADIUS * 1.5);
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (Math.hypot(px - enemy.x, py - enemy.y) <= radius) {
            return enemy;
        }
    }
    return null;
}

function upgradeTower(tower) {
    if (gameOver) return false;
    ensureTowerMetadata(tower);
    if (tower.level >= TOWER_MAX_LEVEL) {
        return false;
    }
    const cost = tower.upgradeCost;
    if (cost == null || gold < cost) {
        return false;
    }
    gold -= cost;
    tower.spentGold = (tower.spentGold || 0) + cost;
    updateGoldUI();
    tower.level += 1;
    recalcTowerStats(tower);
    playSound('upgrade');
    if (selectedTower === tower) {
        updateTowerStatsFields();
    }
    const upgDef = getTowerDefinition(tower.type);
    announce(upgDef.label + ' 레벨 ' + tower.level + '로 업그레이드');
    return true;
}

function sellTower(tower) {
    if (gameOver) return false;
    const idx = towers.indexOf(tower);
    if (idx === -1) return false;
    const refund = Math.floor((tower.spentGold || 0) * 0.5);
    towers.splice(idx, 1);
    towerPositionSet.delete(keyFromGrid(tower.x, tower.y));
    gold = Math.min(999999, gold + refund);
    updateGoldUI();
    if (selectedTower === tower) hideTowerStats();
    playSound('build');
    const sellDef = getTowerDefinition(tower.type);
    announce(sellDef.label + ' 판매 — ' + refund + 'G 환급');
    return true;
}

function flashGoldInsufficient() {
    if (!GOLD_LABEL) return;
    const chip = GOLD_LABEL.closest('.stat-chip');
    if (!chip) return;
    chip.classList.remove('flash-insufficient');
    void chip.offsetWidth;
    chip.classList.add('flash-insufficient');
    announce('골드가 부족합니다');
}

let _defeatPreviousFocus = null;

function showDefeatDialog() {
    if (gameOver) {
        return;
    }
    gameOver = true;
    paused = true;
    render();
    stopLoop();
    clearCurrentWave();
    selectedTowerType = DEFAULT_TOWER_TYPE;
    setSelectedTowerButton(selectedTowerType);
    setGameSpeed(1);
    if (DEFEAT_OVERLAY) {
        _defeatPreviousFocus = document.activeElement;
        DEFEAT_OVERLAY.classList.remove('hidden');
        if (RETRY_BUTTON) {
            RETRY_BUTTON.focus();
        }
    }
    updateWavePreview(0);
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
    paused = true;
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
        paramsEl.textContent = '골드: ' + (mapDef.initialGold || 100) + ' / 생명력: ' + (mapDef.initialLives || 20);

        card.setAttribute('aria-pressed', String(mapDef.id === activeMapId));
        card.append(nameEl, previewCanvas, diffEl, paramsEl);
        card.addEventListener('click', () => {
            activeMapId = mapDef.id;
            cards.forEach((c) => {
                const isSelected = c.dataset.mapId === activeMapId;
                c.classList.toggle('selected', isSelected);
                c.setAttribute('aria-pressed', String(isSelected));
            });
        });
        MAP_LIST_CONTAINER.appendChild(card);
        cards.push(card);
    }
}

function resetGame() {
    buildMapData(activeMapId);
    staticLayer = null;
    var currentMapDef = MAP_DEFINITIONS[activeMapId] || MAP_DEFINITIONS['map1'];
    gold = currentMapDef.initialGold || 100;
    lives = currentMapDef.initialLives || 20;
    wave = 1;
    gameOver = false;
    paused = false;
    hoverTile = null;
    hideAllStats();
    towers.length = 0;
    towerPositionSet.clear();
    clearCurrentWave();
    selectedTowerType = DEFAULT_TOWER_TYPE;
    setSelectedTowerButton(selectedTowerType);
    updateGoldUI();
    if (LIVES_LABEL) LIVES_LABEL.textContent = lives;
    if (WAVE_LABEL) WAVE_LABEL.textContent = wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = wave;
    }
    hideDefeatDialog();
    setGameSpeed(1);
    buildPanelUserOverride = false;
    if (typeof window !== 'undefined' && window.innerWidth < AUTOCOLLAPSE_WIDTH) {
        setBuildPanelCollapsed(true);
    } else {
        setBuildPanelCollapsed(false);
    }
    updateWavePreview();
    elapsedTime = 0;
    lastTime = performance.now();
    cachedNoiseBuffer = null;
    gameLoopHalted = false;
    loopErrorCount = 0;
    cachedNoiseDuration = 0;
}

function startWave() {
    waveInProgress = true;
    enemiesToSpawn = getWaveEnemyCount(wave);
    spawnCooldown = 0;
    nextWaveTimer = 0;
    if (WAVE_LABEL) WAVE_LABEL.textContent = wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = wave;
    }
    updateWavePreview(enemiesToSpawn + enemies.length);
    announce(`웨이브 ${wave} 시작`);
}

function canBuildAt(x, y) {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
        return false;
    }
    if (pathTiles.has(keyFromGrid(x, y))) {
        return false;
    }
    return !towerPositionSet.has(keyFromGrid(x, y));
}

function createTowerData(x, y, typeId) {
    const def = getTowerDefinition(typeId);
    return {
        def,
        type: def.id,
        x,
        y,
        worldX: x * TILE_SIZE + TILE_CENTER_OFFSET,
        worldY: y * TILE_SIZE + TILE_CENTER_OFFSET,
        cooldown: 0,
        level: 1,
        range: def.range,
        fireDelay: def.fireDelay,
        damage: calculateTowerDamage(def, 1),
        upgradeCost: calculateUpgradeCost(def, 1),
        activeBeam: null,
        heading: 0,
        aimAngle: null,
        flashTimer: 0,
        recoil: 0,
        auraOffset: Math.random() * Math.PI * 2,
        spentGold: def.cost || 0
    };
}

function pickEnemyType(waveNumber) {
    if (waveNumber % 10 === 0 && enemiesToSpawn === 1) {
        return ENEMY_TYPE_MAP['boss'] || ENEMY_TYPE_DEFINITIONS[0];
    }
    if (waveNumber >= 3) {
        const roll = Math.random();
        if (roll < 0.2) return ENEMY_TYPE_MAP['armored'] || ENEMY_TYPE_DEFINITIONS[0];
        if (roll < 0.5) return ENEMY_TYPE_MAP['fast'] || ENEMY_TYPE_DEFINITIONS[0];
    }
    return ENEMY_TYPE_DEFINITIONS[0];
}

function spawnEnemy() {
    const start = waypoints[0];
    const enemyType = pickEnemyType(wave);
    const stats = getWaveEnemyStats(wave, enemyType);
    enemies.push({
        x: start.x,
        y: start.y,
        speed: stats.speed,
        hp: stats.hp,
        maxHp: stats.hp,
        waypoint: 0,
        reward: stats.reward,
        waveIndex: wave,
        heading: 0,
        enemyType,
        pulseSeed: Math.random() * Math.PI * 2
    });
}

function findTarget(tower) {
    let chosen = null;
    let chosenIndex = -1;
    let bestScore = -Infinity;
    const rangeSq = tower.range * tower.range;
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const dx = enemy.x - tower.worldX;
        const dy = enemy.y - tower.worldY;
        const distSq = dx * dx + dy * dy;
        if (distSq > rangeSq) continue;
        const score = enemy.waypoint * 1000 - distSq;
        if (score > bestScore) {
            bestScore = score;
            chosen = enemy;
            chosenIndex = i;
        }
    }
    if (!chosen) return null;
    _findTargetResult.enemy = chosen;
    _findTargetResult.index = chosenIndex;
    return _findTargetResult;
}
const _findTargetResult = { enemy: null, index: -1 };

function spawnProjectile(options) {
    const speed = Math.hypot(options.vx, options.vy) || 1;
    projectiles.push({
        x: options.x,
        y: options.y,
        vx: options.vx,
        vy: options.vy,
        damage: options.damage,
        life: options.life,
        initialLife: options.life,
        radius: options.radius,
        color: options.color,
        outline: options.outline || null,
        shape: options.shape || 'circle',
        trailColor: options.trailColor || null,
        trailLength: options.trailLength || 0,
        glowColor: options.glowColor || options.color,
        hitRadius: options.hitRadius || Math.max(16, (options.radius || 6) * 1.6),
        rotation: options.rotation != null ? options.rotation : Math.atan2(options.vy, options.vx),
        spin: options.spin || 0,
        delay: options.delay || 0,
        gravity: options.gravity || 0,
        explosionRadius: options.explosionRadius || 0,
        explosionColor: options.explosionColor || null,
        explosionHaloColor: options.explosionHaloColor || null,
        explosionStrokeColor: options.explosionStrokeColor || null,
        explosionLife: options.explosionLife || null,
        detonateOnExpire: Boolean(options.detonateOnExpire),
        speed
    });
}

function handleTowerFireVisuals(tower, def, angle) {
    const baseSize = TOWER_DRAW_BASE + (tower.level - 1) * 1.2;
    tower.aimAngle = angle;
    tower.heading = angle;
    const flashDuration = def.flashDuration || 0.12;
    tower.flashTimer = Math.max(tower.flashTimer || 0, flashDuration);
    const recoilKick = def.recoilKick ?? 0.45;
    tower.recoil = Math.min(1.4, (tower.recoil || 0) + recoilKick);
    const muzzleDistance = baseSize * (def.muzzleLengthMultiplier || 1.65);
    const muzzleX = tower.worldX + Math.cos(angle) * muzzleDistance;
    const muzzleY = tower.worldY + Math.sin(angle) * muzzleDistance;
    const flashColor = def.muzzleFlashColor || getTowerColor(def, tower.level);
    const flashRadius = baseSize * (def.flashSizeMultiplier || 0.9);
    spawnMuzzleFlash(muzzleX, muzzleY, flashRadius, flashColor, angle, {
        growth: flashRadius * 9,
        life: def.flashDuration || 0.16
    });
}

function attackShotgun(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const pellets = def.pellets || 4;
    const spread = def.spread || Math.PI / 4;
    for (let i = 0; i < pellets; i++) {
        const ratio = pellets === 1 ? 0 : i / (pellets - 1) - 0.5;
        const jitter = (Math.random() - 0.5) * 0.35;
        const angle = baseAngle + (ratio + jitter) * spread;
        const speed = def.projectileSpeed * (0.9 + Math.random() * 0.3);
        const color = getProjectileColor(def, tower.level);
        spawnProjectile({
            x: tower.worldX,
            y: tower.worldY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: tower.damage,
            life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.05),
            radius: def.projectileRadius + (tower.level - 1) * (ls.radiusPerLevel ?? 0.7),
            color,
            glowColor: def.glowColor || color,
            outline: '#2e2e2e',
            trailColor: getProjectileColor(def, Math.max(1, tower.level - 1)),
            trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 10),
            hitRadius: (ls.hitRadiusBase ?? 14) + tower.level * (ls.hitRadiusPerLevel ?? 1),
            spin: (Math.random() - 0.5) * 6,
            shape: 'circle'
        });
    }
}

function attackBeam(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = def.projectileSpeed + (tower.level - 1) * (ls.speedPerLevel ?? 25);
    const color = getProjectileColor(def, tower.level);
    spawnProjectile({
        x: tower.worldX,
        y: tower.worldY,
        vx: dirX * speed,
        vy: dirY * speed,
        damage: tower.damage,
        life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.2),
        radius: def.beamWidth + (tower.level - 1) * (ls.radiusPerLevel ?? 1.2),
        color,
        glowColor: def.glowColor || color,
        outline: '#ffffff33',
        shape: 'beam',
        trailColor: color,
        trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 30),
        hitRadius: (ls.hitRadiusBase ?? 24) + tower.level * (ls.hitRadiusPerLevel ?? 1.5)
    });
}

function attackBurst(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = def.projectileSpeed + (tower.level - 1) * (ls.speedPerLevel ?? 25);
    const burstCount = def.burstCount || 3;
    const delayStep = def.burstDelay ?? 0.07;
    const color = getProjectileColor(def, tower.level);
    for (let i = 0; i < burstCount; i++) {
        const delay = i * delayStep;
        spawnProjectile({
            x: tower.worldX,
            y: tower.worldY,
            vx: dirX * speed,
            vy: dirY * speed,
            damage: tower.damage,
            life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.08) + delay,
            radius: def.projectileRadius + (tower.level - 1) * (ls.radiusPerLevel ?? 0.5),
            color,
            glowColor: def.glowColor || color,
            outline: '#351a05',
            shape: 'triangle',
            trailColor: '#fffbf2',
            trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 12),
            delay,
            spin: 6,
            hitRadius: (ls.hitRadiusBase ?? 18) + tower.level * (ls.hitRadiusPerLevel ?? 1.4)
        });
    }
}

function attackExplosive(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = def.projectileSpeed + (tower.level - 1) * (ls.speedPerLevel ?? 20);
    const color = getProjectileColor(def, tower.level);
    spawnProjectile({
        x: tower.worldX,
        y: tower.worldY,
        vx: dirX * speed,
        vy: dirY * speed,
        damage: tower.damage,
        life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.12),
        radius: def.projectileRadius + (tower.level - 1) * (ls.radiusPerLevel ?? 0.6),
        color,
        glowColor: def.glowColor || color,
        outline: def.outline,
        shape: 'hex',
        trailColor: getProjectileColor(def, Math.max(1, tower.level - 1)),
        trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 15),
        explosionRadius: def.explosionRadius + tower.level * (ls.explosionRadiusPerLevel ?? 4),
        explosionColor: def.explosionColor,
        explosionHaloColor: def.explosionHaloColor,
        explosionStrokeColor: def.explosionStrokeColor,
        explosionLife: def.explosionLife,
        hitRadius: (ls.hitRadiusBase ?? 22) + tower.level * (ls.hitRadiusPerLevel ?? 1.5),
        detonateOnExpire: true
    });
}

function attackMortar(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = def.projectileSpeed + (tower.level - 1) * (ls.speedPerLevel ?? 12);
    const lift = def.mortarLift + (tower.level - 1) * (ls.liftPerLevel ?? 12);
    const color = getProjectileColor(def, tower.level);
    spawnProjectile({
        x: tower.worldX,
        y: tower.worldY,
        vx: dirX * speed,
        vy: dirY * speed - lift,
        damage: tower.damage,
        life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.18),
        radius: def.projectileRadius + (tower.level - 1) * (ls.radiusPerLevel ?? 1.2),
        color,
        glowColor: def.glowColor || color,
        outline: def.outline,
        shape: 'orb',
        trailColor: getProjectileColor(def, Math.max(1, tower.level - 1)),
        trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 14),
        gravity: def.gravity,
        explosionRadius: def.explosionRadius + tower.level * (ls.explosionRadiusPerLevel ?? 5),
        explosionColor: def.explosionColor,
        explosionHaloColor: def.explosionHaloColor,
        explosionStrokeColor: def.explosionStrokeColor,
        explosionLife: def.explosionLife,
        hitRadius: (ls.hitRadiusBase ?? 26) + tower.level * (ls.hitRadiusPerLevel ?? 2),
        detonateOnExpire: true
    });
}

function attackDefault(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = (def.projectileSpeed || 580) + (tower.level - 1) * (ls.speedPerLevel ?? 20);
    const color = getProjectileColor(def, tower.level);
    spawnProjectile({
        x: tower.worldX,
        y: tower.worldY,
        vx: dirX * speed,
        vy: dirY * speed,
        damage: tower.damage,
        life: (def.projectileLife || 0.8) + (tower.level - 1) * (ls.lifePerLevel ?? 0.06),
        radius: (def.projectileRadius || 6) + (tower.level - 1) * (ls.radiusPerLevel ?? 0.4),
        color,
        glowColor: def.glowColor || color,
        outline: def.outline,
        shape: def.shape === 'triangle' ? 'triangle' : 'circle',
        trailColor: getProjectileColor(def, Math.max(1, tower.level - 1)),
        trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 12),
        hitRadius: (ls.hitRadiusBase ?? 16) + tower.level * (ls.hitRadiusPerLevel ?? 1.2)
    });
}

const ATTACK_PATTERNS = {
    shotgun: attackShotgun,
    beam: attackBeam,
    burst: attackBurst,
    explosive: attackExplosive,
    mortar: attackMortar
};

function performTowerAttack(tower, target, def) {
    const baseDx = target.x - tower.worldX;
    const baseDy = target.y - tower.worldY;
    const baseDist = Math.hypot(baseDx, baseDy) || 1;
    const baseAngle = Math.atan2(baseDy, baseDx);
    const dirX = baseDx / baseDist;
    const dirY = baseDy / baseDist;

    handleTowerFireVisuals(tower, def, baseAngle);

    const attackFn = ATTACK_PATTERNS[def.attackPattern] || attackDefault;
    attackFn(tower, def, dirX, dirY, baseAngle);
}

function handleLaserAttack(tower, dt, def) {
    const hadBeam = Boolean(tower.activeBeam && tower.activeBeam.alpha > 0.2);
    if (tower.activeBeam) {
        tower.activeBeam.alpha = Math.max(0, tower.activeBeam.alpha - dt * 8);
        if (tower.activeBeam.alpha <= 0.01) {
            tower.activeBeam = null;
        }
    }
    const result = findTarget(tower);
    if (!result) {
        tower.aimAngle = null;
        return;
    }
    const target = result.enemy;
    let targetIndex = result.index;
    if (enemies[targetIndex] !== target) {
        targetIndex = enemies.indexOf(target);
        if (targetIndex === -1) {
            tower.activeBeam = null;
            return;
        }
    }
    const angle = Math.atan2(target.y - tower.worldY, target.x - tower.worldX);
    tower.aimAngle = angle;
    if (typeof tower.heading !== 'number') {
        tower.heading = angle;
    } else {
        const turnSpeed = Math.max(4, (def.turnSpeed || 8) * 1.25);
        tower.heading = lerpAngle(tower.heading, angle, Math.min(1, dt * turnSpeed));
    }
    tower.flashTimer = Math.max(tower.flashTimer || 0, def.flashDuration || 0.08);
    const damagePerSecond = tower.damage * (def.sustainMultiplier || 1);
    const appliedDamage = damagePerSecond * dt;
    const targetX = target.x;
    const targetY = target.y;
    const killed = damageEnemyAtIndex(targetIndex, appliedDamage);
    const beamColor = def.beamColor || getProjectileColor(def, tower.level);
    if (tower.activeBeam) {
        tower.activeBeam.x1 = tower.worldX;
        tower.activeBeam.y1 = tower.worldY;
        tower.activeBeam.x2 = targetX;
        tower.activeBeam.y2 = targetY;
        tower.activeBeam.alpha = 0.95;
    } else {
        tower.activeBeam = {
            x1: tower.worldX,
            y1: tower.worldY,
            x2: targetX,
            y2: targetY,
            width: (def.beamWidth || 6) + (tower.level - 1) * 0.35,
            color: beamColor,
            glow: def.beamGlowColor || beamColor,
            alpha: 0.95
        };
    }
    if (!hadBeam) {
        playSound('laser');
    }
    if (killed) {
        spawnImpactEffect(targetX, targetY, 36 + tower.level * 2, def.beamGlowColor || 'rgba(150, 255, 255, 0.4)', {
            haloColor: '#d4fbff',
            life: 0.4,
            pulse: true
        });
    }
}

function update(dt) {
    if (buildFailFlash) {
        buildFailFlash.timer -= dt;
        if (buildFailFlash.timer <= 0) buildFailFlash = null;
    }
    if (gameOver) {
        return;
    }
    if (!waveInProgress && nextWaveTimer <= 0) {
        startWave();
    }
    if (waveInProgress) {
        if (enemiesToSpawn > 0) {
            spawnCooldown -= dt;
            if (spawnCooldown <= 0) {
                spawnEnemy();
                enemiesToSpawn--;
                const minCooldown = wave < 30 ? 0.25 : wave < 60 ? 0.18 : 0.12;
                spawnCooldown = Math.max(0.6 - wave * 0.02, minCooldown);
            }
        } else if (enemies.length === 0) {
            waveInProgress = false;
            nextWaveTimer = 4;
            announce(`웨이브 ${wave} 완료`);
            wave = Math.min(wave + 1, WAVE_MAX);
            if (WAVE_LABEL) WAVE_LABEL.textContent = wave;
            if (WAVE_INPUT) {
                WAVE_INPUT.value = wave;
            }
            updateWavePreview();
        }
    } else if (nextWaveTimer > 0) {
        nextWaveTimer -= dt;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const target = waypoints[enemy.waypoint + 1];
        if (!target) {
            if (selectedEnemy === enemy) {
                hideEnemyStats();
            }
            enemies.splice(i, 1);
            lives = Math.max(0, lives - 1);
            if (LIVES_LABEL) LIVES_LABEL.textContent = lives;
            if (lives === 0) {
                showDefeatDialog();
                return;
            }
            continue;
        }
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const dirX = dx / dist;
        const dirY = dy / dist;
        enemy.heading = Math.atan2(dirY, dirX);
        if (dist < enemy.speed * dt) {
            enemy.x = target.x;
            enemy.y = target.y;
            enemy.waypoint += 1;
        } else {
            enemy.x += dirX * enemy.speed * dt;
            enemy.y += dirY * enemy.speed * dt;
        }
    }

    for (const tower of towers) {
        const def = tower.def || getTowerDefinition(tower.type);
        tower.flashTimer = Math.max(0, (tower.flashTimer || 0) - dt * 4.6);
        tower.recoil = Math.max(0, (tower.recoil || 0) - dt * (def.recoilRecovery || 3));
        if (def.attackPattern === 'laser') {
            handleLaserAttack(tower, dt, def);
            continue;
        }
        if (tower.activeBeam) {
            tower.activeBeam.alpha = Math.max(0, tower.activeBeam.alpha - dt * 6);
            if (tower.activeBeam.alpha <= 0.05) {
                tower.activeBeam = null;
            }
        }
        const result = findTarget(tower);
        let target = result ? result.enemy : null;
        if (target) {
            const angle = Math.atan2(target.y - tower.worldY, target.x - tower.worldX);
            tower.aimAngle = angle;
        }
        if (tower.aimAngle != null) {
            if (typeof tower.heading !== 'number') {
                tower.heading = tower.aimAngle;
            } else {
                const turnSpeed = Math.max(3, def.turnSpeed || 7.5);
                tower.heading = lerpAngle(tower.heading, tower.aimAngle, Math.min(1, dt * turnSpeed));
            }
        }
        if (tower.cooldown > 0) {
            tower.cooldown -= dt;
            if (tower.cooldown > 0) {
                continue;
            }
        }
        if (!target) {
            tower.cooldown = 0;
            continue;
        }
        performTowerAttack(tower, target, def);
        tower.cooldown = tower.fireDelay;
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        if (projectile.delay > 0) {
            projectile.delay -= dt;
            if (projectile.delay > 0) {
                continue;
            }
        }
        if (projectile.gravity) {
            projectile.vy += projectile.gravity * dt;
        }
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        if (projectile.spin && !prefersReducedMotion) {
            projectile.rotation += projectile.spin * dt;
        } else {
            projectile.rotation = Math.atan2(projectile.vy, projectile.vx);
        }
        if (projectile.gravity) {
            projectile.speed = Math.hypot(projectile.vx, projectile.vy) || 1;
        }

        let remove = false;
        let impacted = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = enemy.x - projectile.x;
            const dy = enemy.y - projectile.y;
            if (dx * dx + dy * dy <= projectile.hitRadius * projectile.hitRadius) {
                if (projectile.explosionRadius) {
                    applyExplosion(projectile, projectile.x, projectile.y);
                } else {
                    damageEnemyAtIndex(j, projectile.damage);
                    spawnImpactEffect(
                        projectile.x,
                        projectile.y,
                        (projectile.radius || 6) * 1.4,
                        projectile.glowColor || projectile.color,
                        {
                            haloColor: projectile.color,
                            life: 0.28,
                            pulse: false
                        }
                    );
                }
                impacted = true;
                remove = true;
                break;
            }
        }

        if (!impacted && projectile.life <= 0 && projectile.detonateOnExpire && projectile.explosionRadius) {
            applyExplosion(projectile, projectile.x, projectile.y);
            remove = true;
        }

        if (projectile.life <= 0) {
            remove = true;
        }

        if (remove) {
            projectiles.splice(i, 1);
        }
    }

    for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
        const flash = muzzleFlashes[i];
        flash.life -= dt;
        flash.radius += flash.growth * dt;
        if (flash.life <= 0) {
            muzzleFlashes.splice(i, 1);
        }
    }

    for (let i = impactEffects.length - 1; i >= 0; i--) {
        const effect = impactEffects[i];
        effect.life -= dt;
        if (effect.life <= 0) {
            impactEffects.splice(i, 1);
        }
    }

    if (selectedEnemy) {
        updateEnemyStatsFields();
    }
    if (selectedTower) {
        updateTowerStatsFields();
    }
    updateWavePreview(waveInProgress ? enemiesToSpawn + enemies.length : null);
}
