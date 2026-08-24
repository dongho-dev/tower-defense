# Last Light art direction

The remake uses one generated environment image as a low-frequency backdrop and
keeps every gameplay-critical element deterministic and code-rendered.

- Background: assets/nexus-horizon-v2.png
- Runtime: a single Canvas2D pass over one cached battlefield layer
- Palette: midnight graphite, navigation cyan, sunrise amber, impact coral
- Readability rule: enemies, towers, sockets, and the route never depend on the
  generated image for collision, meaning, or contrast
- Performance rule: no Three.js, GLB loading, post-processing, dynamic shadows,
  or second animation loop in the remake entry point

ImageGen prompt summary: a wide 16:9 planetary defense outpost at night with a
quiet central command deck, distant fractured moon, controlled cyan lights, warm
amber horizon, and no UI, text, units, path, logo, or watermark.
