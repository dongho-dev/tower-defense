# Project State: LAST LIGHT v2

As of 2026-10-01. Design rationale lives in [REMAKE_DESIGN.md](REMAKE_DESIGN.md) (Korean); the Korean version of this file is [PROJECT_STATE_ko.md](PROJECT_STATE_ko.md).

## Overview

- 3D tower defense built with Vite + Three.js 0.184. Browser only, no server.
- Every model, texture, and sound is procedural. Fonts: `public/fonts` (Noto Sans KR) and `@fontsource/cinzel`.
- Flow: title → battlefield select → intro fly-in → battle → results. Progress (stars per map) and settings persist in localStorage key `lastlight.v2`.

## File Map

| Path | Role |
| --- | --- |
| `src/main.js` | Loads fonts/styles and creates `App` |
| `src/app.js` | Screen flow, fixed-step loop (1/60 s), input and picking, hotkeys, save/settings, dev hook `window.__game` |
| `src/core/game.js` | State, `step`, commands (build/upgrade/sell/callWave/castSkill/setTargeting), resonance, damage, event queue |
| `src/core/path.js` | Catmull-Rom path sampling and distance queries |
| `src/core/data/*.js` | Towers, enemies, maps, waves |
| `src/render/World.js` | Lights, sky, clouds, island, road, props, portals, core, sockets, ley lines, range indicator |
| `src/render/themes.js` | Per-map visual themes (dusk / frost / void) |
| `src/render/env/*` | Terrain, sky, vegetation, structures, range indicator |
| `src/render/models/*` | Procedural tower/enemy models, animation, shared materials |
| `src/render/fx/*` | Particle engine, lightning ribbons, event effects |
| `src/render/EntityView.js` | Syncs game state to 3D objects |
| `src/render/Renderer.js` | Renderer, MSAA + bloom + grading, quality presets |
| `src/render/CameraRig.js` | Pitch/distance/pan/shake/intro/title orbit |
| `src/ui/*` | HUD, radial menus and cards, screens, overlay (HP bars, floating text), icons, styles |
| `src/audio/audio.js` | WebAudio synthesized SFX: buses (sfx/ui/music/ambience), ducking, voice limits, screen panning, UI click/deny sounds |
| `src/audio/music.js` | Layered state music (prep pad and bells, combat drums and ostinato, boss brass, low-lives pulse) scheduled per bar |
| `tests/` | `core.test.js` (rules), `balance.test.js` (headless AI regression), `balance-probe.mjs` (exploration) |
| `tools/` | Map preview, socket placement helper |
| `prototypes/` | Direction comparison demos (archived) |

## Rules Summary

- **Towers**: Ranger 70, Ember 110, Frost 90, Storm 130. Three tiers, then an A/B branch. Selling refunds 70% of the investment.
- **Resonance**: Linked sockets holding different tower types exchange buffs. Same-type links give nothing, and each type counts once.
- **Damage**: Physical is reduced by armor (Marksman pierces 70%). Magic is reduced by resist. Burn and meteor deal true damage.
- **Waves**: A 16 s countdown starts when a wave finishes spawning. Calling early pays 1.5 gold per remaining second.
- **HP scaling**: 1.115× per wave. Map multipliers are Frostvale 0.95 and Voidspire 1.0, plus an optional per-group `hpMul`.
- **Results**: 3 stars at ≥90% lives remaining, 2 stars at ≥50%, otherwise 1.

## Verification

- `npm test`: 22 tests covering map constraints, commands, resonance, damage types, wave flow, skills, and AI balance on all three maps.
- Headless balance (automatic AI):
  - Dusk Rampart: a focused 8-tower plan wins while losing some lives.
  - Frostvale: a 10-tower plan wins.
  - Voidspire: a 10-tower plan barely wins, and a 6-tower plan loses.
- Performance reference (1600×900, wave 16, 37 enemies, 1.4k particles): sim 0.2 ms, view update 1.6 ms, render about 11.5 ms.

## Known Limitations

- No mobile pinch zoom (drag pan and tap work).
- Changing graphics quality fully applies shadow resolution and particle caps from the next battle.
- The bundle is about 720 kB (about 200 kB gzip). Consider code-splitting Three.js if needed.
