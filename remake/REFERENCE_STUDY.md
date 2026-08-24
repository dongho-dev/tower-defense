# Tower-defense battlefield reference study

Reviewed on 2026-08-24. This is a layout and scale study; no third-party image is
shipped with the game.

## Screenshot set

- [Element TD 2 on Steam](https://store.steampowered.com/app/1018830/Element_TD_2__Tower_Defense/)
- [Defense Grid 2 on Steam](https://store.steampowered.com/app/221540/DG2_Defense_Grid_2/)
- [Rogue Tower on Steam](https://store.steampowered.com/app/1843760/Rogue_Tower/?l=english)
- [Infinitode 2 on Steam](https://store.steampowered.com/app/937310/Infinitode_2__Infinite_Tower_Defense/?curator_clanid=36376191)
- [Bloons TD 6 on Steam](https://store.steampowered.com/app/960090/Bloons_TD_6/)
- [Kingdom Rush Vengeance official site](https://www.kingdomrushvengeance.com/)
- [StarCraft Personal Tower Defense L UMS reference](https://kkmg2012.tistory.com/1679)

## What the screenshots consistently show

These are visual estimates from the published screenshots, not measurements
claimed by the source pages.

- The battlefield and route dominate the frame; towers read as repeated tactical
  cells rather than hero-sized illustrations.
- The strongest views expose several future engagements at once. Long approaches,
  folds, and return passes let a player understand why a socket is valuable.
- Commercial maps keep meaningful empty ground between route, sockets, and UI.
  StarCraft UMS layouts push the same principle further through a strict grid and
  very small unit footprints.
- Dense kill boxes are most useful when contrasted with weaker outer zones. A map
  made only of equivalent turns has little positional identity.
- Tower silhouettes can still be distinct at a small world scale when their
  heading, muzzle, recoil, color, and base motion remain readable.

## Decisions applied to Last Light

| Dimension | Previous remake | V5 target |
| --- | ---: | ---: |
| Board horizontal span | 976 px | 1,152 px |
| Tower render scale | 1.00 | 0.68 |
| Build sockets per map | 13-14 | 18 |
| Route identity | compact zigzag variants | recontact, overlap, perimeter |

At the new scale, the eight tower source sprites occupy roughly 7-10% of the
internal board width after depth scaling, instead of roughly 12-18%. The goal is
not to imitate one reference title, but to recover their shared command-view
clarity while retaining Last Light's generated hard-surface art and animated
weapon assemblies.
