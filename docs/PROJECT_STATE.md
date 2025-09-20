# Project Snapshot: Tower Defense

## Overview
- Single-page HTML5 canvas tower defense (index.html, style.css, main.js)
- Updated glassmorphism UI with a collapsible left build panel, central battlefield, and right-hand intel column
- Integrated Web Audio soundscape (placement/upgrade/kill/explosion/laser/toggle cues) with a mute toggle on the HUD

## File Map
- index.html – header HUD, sound toggle, collapsible build panel (#build-panel), canvas stage, info column (wave preview, tower/enemy stats), defeat overlay
- style.css – gradient background, glass panels, tower card grid, responsive collapse logic for the build panel, refreshed typography and buttons
- main.js – tower definitions, dynamic build panel population, game state, audio engine, combat logic (shotgun/laser/aoe/mortar), rendering pipeline, and event wiring

## Controls & UI
- Build panel (left): toggle with the side handle, choose a tower card (shows cost/range/DPS), then left-click the map to place
- Right-click a tower to upgrade (level cap 15, +2.5× damage per level)
- Stats column auto-updates when selecting towers/enemies; wave preview shows status/HP/reward/speed
- Top HUD: gold input + quick +100/+500, wave jump, speed buttons (1x/2x/3x), and sound toggle (🔊/🔇)
- Spacebar pauses/resumes; defeat overlay offers restart or close

## Enemy Waves
- Count per wave: 8 + floor(wave * 1.5)
- Health scaling ENEMY_HP_GROWTH_RATE = 1.25; speed (49) and reward (14) remain constant
- Wave preview exposes state (대기/휴식/전투 중/패배), enemies remaining, HP, tile-per-second speed, and reward

## Towers & Upgrades
- Eight archetypes defined in TOWER_TYPES:
  - **Basic** – balanced single-shot
  - **Shotgun** – short-range multi-pellet spread
  - **Sniper** – long-range beam projectile
  - **Burst** – burst volley with micro delays
  - **Rapid** – high fire-rate stream
  - **Explosive** – splash shells detonating on hit/expiry
  - **Laser** – sustained beam damage (continuous tick, beam visual)
  - **Mortar** – arcing projectile with high-damage, wide explosion
- Upgrades cost gold, add +1 level, multiply damage by **2.5**, cap at level 15; upgrade costs double each level from a tower-specific base value

## Audio
- Web Audio engine lazily initialises on first user interaction, mixing through a master gain node
- Sound cues: select, 	oggle, uild, upgrade, kill, explosion, laser
- HUD sound toggle updates icon/aria state and fully mutes/unmutes the master gain

## Combat Logic Highlights
- performTowerAttack() fans out per pattern (shotgun spread, burst queue, explosive splash, laser sustain, mortar arc)
- handleLaserAttack() emits continuous damage, draws beams, and plays a beam cue on first contact
- pplyExplosion() handles AoE damage, impact visuals, and explosion SFX
- update() drives spawning, targeting, projectile movement, AoE resolution, gold/life updates, and UI refresh

## Rendering
- Canvas draw stack: grid, path, hover highlight, towers (shape per type), enemies with HP bars, projectiles (beams/triangles/hex/orbs/trails), impact flashes, active laser beams, pause/defeat overlay
- Build panel + cards use CSS utility classes; range rings display when a tower is selected

## Notes
- All copy remains in Korean; keep files UTF-8 encoded to avoid mojibake
- No automated tests – manually verify tower placement/upgrade (to level 15), AoE interactions, laser effects, audio toggle, and responsive layout
- Update both docs/PROJECT_STATE.md and docs/PROJECT_STATE_ko.md when UI or mechanics evolve
