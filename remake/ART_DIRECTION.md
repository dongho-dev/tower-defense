# Last Light visual remaster

The V4 art and motion pass treats the legacy Three.js battlefield in
`logs/showcase-current.png` as the minimum density benchmark, while removing its
overexposed bloom and simultaneous-renderer cost.

## V5 battlefield scale and route language

The V5 composition pass uses the screenshot review in `REFERENCE_STUDY.md` as a
screen-density benchmark. The board now spans 1,152 of the 1,200 internal canvas
pixels, while runtime tower art renders at 68% of its previous world scale. A
tower therefore reads as one tactical cell instead of becoming the dominant
object in the scene; generated silhouette detail and split-turret motion remain
legible at both desktop and mobile display sizes.

Each battlefield now owns a different combat rhythm rather than reusing one
compact zigzag:

- RIFTLINE uses a long approach, a central double-back, and a late recontact;
- SABLE SWITCH folds three firing windows through the center for area-control
  combinations;
- BREAKWATER sweeps the perimeter and separates firing zones, rewarding range
  handoff rather than one universal kill box.

All three maps expose 18 deliberately spaced sockets. Sockets stay outside the
armored-lane footprint, use substantially more of the board, and preserve large
quiet areas so the route remains readable under projectiles and full effects.

## Battlefield view and motion

The fortress deck is projected into a four-corner isometric command board rather
than stretched as a flat screen-space backdrop. Route points, sockets, objectives,
units, range indicators, pointer targets, and depth ordering all share this
projection. The cached layer carries the deck, grid, armored lane, socket hardware,
board depth, and perimeter glow; only lane traffic and combat objects animate.

Directional units (PULSE, SCATTER, RAIL, FLAK, BEAM, and CRYO) render their lower
base and upper weapon assembly separately from the same transparent source art.
The upper assembly performs idle scanning, shortest-path target tracking, and
weapon-specific recoil while the base stays locked to its socket. ARC and NOVA use
floating reactor motion, rotating energy rings, and orbiting emitters instead of a
false gun rotation. Every tower also has subtle suspension motion and an active
socket ring, including between waves.

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
- affine isometric projection instead of a live 3D camera;
- depth-sorted sprite draws for towers and enemies;
- split base/turret animation sourced from the existing tower bitmaps;
- capped shots and particles;
- optional glow shadows behind `FX FULL`;
- no Three.js, GLB loading, post-processing composer, dynamic scene shadows, or
  second animation loop in the remake entry point.
