# Design — level/map mockups

Drop your own sketches here when planning world layout (farm, fields, paths, new areas).
Any format works: a photo of a paper sketch, an Excalidraw/Figma export, MS Paint, etc.

Unlike `inspiration/` (licensed reference, git-ignored), this folder holds **your
original design docs**, so it's tracked in git.

## Convention
One subfolder per area being designed, e.g. `farm-layout/`. Name files descriptively
(`v1-overview.png`, `v2-fields-revised.png`, ...) so iterations stay readable in history.

Tell Claude when you've added or updated a sketch — it reads the image directly and uses
it as the spec when generating/adjusting the corresponding code in `src/world.ts`
(building placement, field shapes, paths, etc.), keeping proportions relative to the
iso tile grid (`TILE_W`/`TILE_H` in `src/iso.ts`).

## Current mockups
- `farm-layout/` — homestead layout: tupa, aitta, navetta, savusauna, riihi, lato,
  kaivo, kasvimaa, humalatarha, pellot, niityt, paths.
