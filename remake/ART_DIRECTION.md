# Last Light visual remaster

The V3 art pass treats the legacy Three.js battlefield in
`logs/showcase-current.png` as the minimum density benchmark, while removing its
overexposed bloom and simultaneous-renderer cost.

## Runtime art set

- Fortress deck: `assets/field/rift-deck-game.webp`
- Player towers: eight role-specific sprites in `assets/towers/*-game.webp`
- Rift fleet: four class-specific sprites in `assets/enemies/*-game.webp`
- Horizon shell: `assets/nexus-horizon-game.webp`

All runtime art is WebP. Towers are framed at 512 px, normal enemies at 256 px,
the Titan at 320 px, and the static field at 1600 px wide. The complete runtime
image set is roughly 1 MB and is decoded once before the game boots.

## ImageGen prompt system

Every asset was generated as a separate image with the built-in ImageGen path.
The shared unit prompt fixed these constraints:

- premium stylized-realistic AAA strategy-game hard-surface render;
- elevated orthographic three-quarter view with consistent lighting and scale;
- graphite gunmetal, cool white ceramic armor, brushed steel, controlled emissive
  accents, crisp highlights, and deep ambient occlusion;
- one complete centered object, full base or hull visible, generous padding;
- no floor, scenery, UI, readable text, logo, watermark, duplicate, or concept
  sheet.

The tower silhouettes were then authored by role:

- PULSE: one thick split-muzzle accelerator and exposed cyan chamber;
- SCATTER: low, wide multi-barrel shotgun battery with amber feed drums;
- RAIL: very long precision lance with twin magnetic guide rails;
- ARC: three-pronged open Tesla crown around a violet plasma orb;
- FLAK: twin heavy howitzers, recoil rails, ammunition elevator, and radar plate;
- BEAM: emerald crystal emitter inside three precision gimbal rings;
- CRYO: broad cooling dish, faceted ice core, and twin coolant tanks;
- NOVA: magenta singularity held by intersecting gyroscopic rings.

The enemy set shares obsidian alien-machine materials while using four distinct
profiles: arrowhead Drone, needle Skirmisher, plated Bulwark, and crescent Titan.

The field prompt requested a wide near-top-down fortress deck over an alien rift,
with an open low-contrast center and dense layered infrastructure only around the
perimeter. Dynamic lanes, sockets, towers, units, and UI were explicitly excluded.

## Transparency and optimization

Some tower generations encoded a pale checker pattern instead of an alpha
channel. `tools/remove-checkerboard.ps1` removes only large neutral backdrop
regions and preserves authored white armor. `tools/optimize-assets.py` then
reframes, removes detached specks, downsamples, and exports alpha-preserving WebP.

## Performance contract

- one Canvas2D animation loop;
- one cached static battlefield layer rebuilt only when the map changes;
- depth-sorted sprite draws for towers and enemies;
- capped shots and particles;
- optional glow shadows behind `FX FULL`;
- no Three.js, GLB loading, post-processing composer, dynamic scene shadows, or
  second animation loop in the remake entry point.
