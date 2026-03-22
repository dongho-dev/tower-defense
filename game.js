function clearCurrentWave() {
    enemies.length = 0;
    projectiles.length = 0;
    impactEffects.length = 0;
    muzzleFlashes.length = 0;
    gameState.enemiesToSpawn = 0;
    gameState.spawnCooldown = 0;
    gameState.waveInProgress = false;
    gameState.nextWaveTimer = 0;
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
    if (gameState.gameOver) {
        if (WAVE_INPUT) {
            WAVE_INPUT.value = gameState.wave;
        }
        return;
    }
    const desiredWave = Math.max(1, Math.min(WAVE_MAX, Math.floor(targetWave)));
    clearCurrentWave();
    hideTowerStats();
    gameState.wave = desiredWave;
    if (WAVE_LABEL) WAVE_LABEL.textContent = gameState.wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = gameState.wave;
    }
    EventBus.emit('wave:changed');
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
        if (gameState.selectedEnemy === enemy) {
            hideEnemyStats();
        }
        enemies.splice(index, 1);
        gameState.totalKills++;
        gameState.gold = Math.min(999999, gameState.gold + enemy.reward);
        EventBus.emit('gold:changed');
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
    gameState.selectedTower = tower;
    TOWER_STATS_PANEL.classList.remove('hidden');
    EventBus.emit('tower:selected');
    const def = getTowerDefinition(tower.type);
    announce(def.label + ' 포탑 정보');
}

function showEnemyStats(enemy) {
    if (!enemy || !ENEMY_STATS_PANEL) {
        return;
    }
    gameState.selectedEnemy = enemy;
    ENEMY_STATS_PANEL.classList.remove('hidden');
    EventBus.emit('enemy:selected');
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
    if (gameState.gameOver) return false;
    ensureTowerMetadata(tower);
    if (tower.level >= TOWER_MAX_LEVEL) {
        return false;
    }
    const cost = tower.upgradeCost;
    if (cost === null || cost === undefined || gameState.gold < cost) {
        return false;
    }
    gameState.gold -= cost;
    gameState.totalGoldSpent += cost;
    tower.spentGold = (tower.spentGold ?? 0) + cost;
    EventBus.emit('gold:changed');
    tower.level += 1;
    recalcTowerStats(tower);
    playSound('upgrade');
    if (gameState.selectedTower === tower) {
        EventBus.emit('tower:selected');
    }
    const upgDef = getTowerDefinition(tower.type);
    announce(upgDef.label + ' 레벨 ' + tower.level + '로 업그레이드');
    return true;
}

function sellTower(tower) {
    if (gameState.gameOver) return false;
    const idx = towers.indexOf(tower);
    if (idx === -1) return false;
    const refund = Math.floor((tower.spentGold ?? 0) * TOWER_SELL_REFUND_RATE);
    towers.splice(idx, 1);
    towerPositionSet.delete(keyFromGrid(tower.x, tower.y));
    gameState.gold = Math.min(999999, gameState.gold + refund);
    EventBus.emit('gold:changed');
    if (gameState.selectedTower === tower) hideTowerStats();
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

function startWave() {
    gameState.waveInProgress = true;
    gameState.enemiesToSpawn = getWaveEnemyCount(gameState.wave);
    gameState.spawnCooldown = 0;
    gameState.nextWaveTimer = 0;
    gameState.bossSpawned = false;
    if (WAVE_LABEL) WAVE_LABEL.textContent = gameState.wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = gameState.wave;
    }
    EventBus.emit('wave:changed', { remaining: gameState.enemiesToSpawn + enemies.length });
    announce(`웨이브 ${gameState.wave} 시작`);
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
        spentGold: def.cost ?? 0,
        targetPriority: 'first'
    };
}

function pickEnemyType(waveNumber) {
    if (waveNumber % 10 === 0 && !gameState.bossSpawned) {
        return ENEMY_TYPE_MAP['boss'] || ENEMY_TYPE_DEFINITIONS[0];
    }
    const eligible = ENEMY_TYPE_DEFINITIONS.filter((t) => !t.bossOnly && waveNumber >= t.minWave);
    const totalWeight = eligible.reduce((sum, t) => sum + t.spawnWeight, 0);
    if (totalWeight <= 0) return ENEMY_TYPE_DEFINITIONS[0];
    let roll = Math.random() * totalWeight;
    for (const t of eligible) {
        roll -= t.spawnWeight;
        if (roll <= 0) return t;
    }
    return eligible[eligible.length - 1];
}

function getWaveEnemyComposition(waveNumber) {
    const eligible = ENEMY_TYPE_DEFINITIONS.filter((t) => !t.bossOnly && waveNumber >= t.minWave);
    const totalWeight = eligible.reduce((sum, t) => sum + t.spawnWeight, 0);
    if (totalWeight <= 0) return [{ type: ENEMY_TYPE_DEFINITIONS[0], percent: 100 }];
    return eligible.map((t) => ({
        type: t,
        percent: Math.round((t.spawnWeight / totalWeight) * 100)
    }));
}

function spawnEnemy() {
    if (!waypoints.length) return;
    const start = waypoints[0];
    const enemyType = pickEnemyType(gameState.wave);
    if (enemyType.bossOnly) {
        gameState.bossSpawned = true;
    }
    const stats = getWaveEnemyStats(gameState.wave, enemyType);
    enemies.push({
        x: start.x,
        y: start.y,
        speed: stats.speed,
        hp: stats.hp,
        maxHp: stats.hp,
        waypoint: 0,
        reward: stats.reward,
        waveIndex: gameState.wave,
        heading: 0,
        enemyType,
        pulseSeed: Math.random() * Math.PI * 2
    });
}

const BUCKET_SIZE = TILE_SIZE * 3;
let spatialGrid = {};

function buildSpatialGrid() {
    spatialGrid = {};
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const bx = Math.floor(enemy.x / BUCKET_SIZE);
        const by = Math.floor(enemy.y / BUCKET_SIZE);
        const key = bx + ',' + by;
        if (!spatialGrid[key]) spatialGrid[key] = [];
        spatialGrid[key].push(enemy);
    }
}

function getEnemiesInRange(cx, cy, range) {
    const result = [];
    const bucketRange = Math.ceil(range / BUCKET_SIZE);
    const bx = Math.floor(cx / BUCKET_SIZE);
    const by = Math.floor(cy / BUCKET_SIZE);
    for (let dx = -bucketRange; dx <= bucketRange; dx++) {
        for (let dy = -bucketRange; dy <= bucketRange; dy++) {
            const key = bx + dx + ',' + (by + dy);
            const bucket = spatialGrid[key];
            if (bucket) {
                for (let i = 0; i < bucket.length; i++) {
                    result.push(bucket[i]);
                }
            }
        }
    }
    return result;
}

function findTarget(tower) {
    let chosen = null;
    let chosenIndex = -1;
    let bestScore = -Infinity;
    const rangeSq = tower.range * tower.range;
    const priority = tower.targetPriority || 'first';
    const hasSpatialData = Object.keys(spatialGrid).length > 0;
    const candidates = hasSpatialData ? getEnemiesInRange(tower.worldX, tower.worldY, tower.range) : enemies;
    for (let i = 0; i < candidates.length; i++) {
        const enemy = candidates[i];
        const dx = enemy.x - tower.worldX;
        const dy = enemy.y - tower.worldY;
        const distSq = dx * dx + dy * dy;
        if (distSq > rangeSq) continue;
        let score;
        switch (priority) {
            case 'last':
                score = -(enemy.waypoint * 1000 - distSq);
                break;
            case 'strongest':
                score = enemy.hp;
                break;
            case 'weakest':
                score = -enemy.hp;
                break;
            case 'closest':
                score = -distSq;
                break;
            default:
                score = enemy.waypoint * 1000 - distSq;
                break;
        }
        if (score > bestScore) {
            bestScore = score;
            chosen = enemy;
            chosenIndex = i;
        }
    }
    if (!chosen) return null;
    _findTargetResult.enemy = chosen;
    _findTargetResult.index = enemies.indexOf(chosen);
    return _findTargetResult;
}
const _findTargetResult = { enemy: null, index: -1 };

function update(dt) {
    if (gameState.buildFailFlash) {
        gameState.buildFailFlash.timer -= dt;
        if (gameState.buildFailFlash.timer <= 0) gameState.buildFailFlash = null;
    }
    if (gameState.gameOver) {
        return;
    }
    if (!gameState.waveInProgress && gameState.nextWaveTimer <= 0) {
        startWave();
    }
    if (gameState.waveInProgress) {
        if (gameState.enemiesToSpawn > 0) {
            gameState.spawnCooldown -= dt;
            if (gameState.spawnCooldown <= 0) {
                spawnEnemy();
                gameState.enemiesToSpawn--;
                const minCooldown = gameState.wave < 30 ? 0.25 : gameState.wave < 60 ? 0.18 : 0.12;
                gameState.spawnCooldown = Math.max(0.6 - gameState.wave * 0.02, minCooldown);
            }
        } else if (enemies.length === 0) {
            gameState.waveInProgress = false;
            gameState.nextWaveTimer = 4;
            var waveBonus = WAVE_CLEAR_BONUS_BASE + gameState.wave * WAVE_CLEAR_BONUS_PER_WAVE;
            gameState.gold = Math.min(gameState.gold + waveBonus, 999999);
            EventBus.emit('gold:changed');
            announce('웨이브 ' + gameState.wave + ' 클리어! 보너스 ' + waveBonus + ' 골드');
            gameState.wave = Math.min(gameState.wave + 1, WAVE_MAX);
            if (WAVE_LABEL) WAVE_LABEL.textContent = gameState.wave;
            if (WAVE_INPUT) {
                WAVE_INPUT.value = gameState.wave;
            }
            EventBus.emit('wave:changed');
        }
    } else if (gameState.nextWaveTimer > 0) {
        gameState.nextWaveTimer -= dt;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const target = waypoints[enemy.waypoint + 1];
        if (!target) {
            if (gameState.selectedEnemy === enemy) {
                hideEnemyStats();
            }
            enemies.splice(i, 1);
            gameState.lives = Math.max(0, gameState.lives - 1);
            if (LIVES_LABEL) LIVES_LABEL.textContent = gameState.lives;
            if (gameState.lives === 0) {
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

    buildSpatialGrid();

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
        let target = null;
        if (tower._cachedTarget && tower._cachedTarget.hp > 0 && enemies.includes(tower._cachedTarget)) {
            const ct = tower._cachedTarget;
            const cdx = ct.x - tower.worldX;
            const cdy = ct.y - tower.worldY;
            if (cdx * cdx + cdy * cdy <= tower.range * tower.range) {
                target = ct;
            }
        }
        if (!target) {
            const result = findTarget(tower);
            target = result ? result.enemy : null;
        }
        tower._cachedTarget = target;
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

    if (gameState.selectedEnemy) {
        EventBus.emit('enemy:selected');
    }
    if (gameState.selectedTower) {
        EventBus.emit('tower:selected');
    }
    EventBus.emit(
        'wave:changed',
        gameState.waveInProgress ? { remaining: gameState.enemiesToSpawn + enemies.length } : null
    );
}
