# Project Snapshot: Tower Defense

## Overview
- Single-page HTML5 canvas tower defense game (`index.html`, `style.css`, `main.js`)
- Starting resources: gold 100, lives 20 (`main.js:46-52`)
- Automated wave loop driven by `update()`; when a wave finishes the game waits ~4s before spawning the next (`main.js:539-588`)

## File Map
- `index.html:10-60` - HUD (wave/lives/gold), speed controls, wave selector, wave preview, tower/enemy stat panels, defeat overlay
- `style.css:1-189` - page layout, panel/overlay/button styling, reusable `.hidden` helper
- `main.js:1-808` - constants, state containers, input handlers, rendering and game loop

## Controls & UI
- Left-click empty tile: place tower (cost 25) (`main.js:420-445`)
- Left-click tower/enemy: open relevant stat panel (`main.js:403-418`)
- Right-click tower: attempt upgrade (`main.js:452-471`, `main.js:309-328`)
- Speed buttons (1x/2x/3x) toggle `setGameSpeed` (`index.html:16-18`, `main.js:178-190`)
- Wave input + Apply moves to a chosen wave when combat is idle (`index.html:21-24`, `main.js:218-236`, `main.js:473-491`)
- Spacebar toggles pause (`main.js:504-510`)
- On defeat, overlay offers retry (full reset) or close (`index.html:57-65`, `main.js:331-367`)

## Enemy Waves
- Spawn count per wave: `8 + floor(wave * 1.5)` (`main.js:198-199`, `main.js:541-557`)
- Health scales by `ENEMY_HP_GROWTH_RATE = 1.25`; speed (`ENEMY_SPEED = 49`) and reward (`ENEMY_BASE_REWARD = 14`) stay constant (`main.js:10-13`, `main.js:148-166`, `main.js:524-533`)
- Wave preview panel displays status (Idle/Break/Running/Defeat), remaining enemies, HP, tile-per-second speed, reward (`main.js:154-176`)

## Towers & Upgrades
- Base range 140, fire delay 0.55s, base damage 35 (`main.js:437-445`)
- Upgrades: cost gold, +1 level, damage x1.5 (rounded to 2 decimals), next cost doubles; max level 7 (`main.js:309-328`, `main.js:17`)
- Tower panel lists position/range/fire delay/damage/level/next cost (`index.html:39-46`, `main.js:238-256`)

## Game State Flow
- `clearCurrentWave()` clears enemies/projectiles and resets counters (`main.js:196-205`)
- `setWave()` (disabled during game over) rewinds to a chosen wave and refreshes preview (`main.js:218-236`)
- `showDefeatDialog()` + `resetGame()` manage defeat handling and a full restart (`main.js:331-368`)
- `drawState()` renders pause/defeat overlay text when needed (`main.js:771-781`)

## Notes
- Source includes Korean UI strings; keep files saved as UTF-8 to avoid mojibake in other editors
- No automated tests; manual playtesting recommended after code changes
- `docs/PROJECT_STATE.md` should be updated whenever mechanics or UI change materially
