const _wavePayload = { remaining: 0 };
let _prevWaveRemaining = -1;

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
    if (gameState.waveInProgress) {
        const remaining = gameState.enemiesToSpawn + enemies.length;
        if (remaining !== _prevWaveRemaining) {
            _prevWaveRemaining = remaining;
            _wavePayload.remaining = remaining;
            EventBus.emit('wave:changed', _wavePayload);
        }
    } else {
        if (_prevWaveRemaining !== -1) {
            _prevWaveRemaining = -1;
            EventBus.emit('wave:changed');
        }
    }
}
