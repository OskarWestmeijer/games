# Suvanto — project brief & working notes

> *Suvanto* (Finnish) = the calm, still stretch of a river between rapids. Working title.

This file is the source of truth for what we're building and how. Keep it updated as
the game evolves.

## Vision

A **narrative historical game** about **17th-century rural Finland** — closer in spirit
to **Pentiment** than to a sandbox farming sim. The player experiences **one year** in
the life of a small farming household in Häme through a small number of carefully
crafted chapters and scenes that teach and document everyday rural life, seasonal work,
traditions, and material culture.

The feeling we're chasing is *slow life*: wandering, listening, watching the light move
on the lake. No pressure, no fail states, no busywork. The focus is **experiencing** how
people lived, worked, and understood the world around them — not managing or optimizing
a farm.

## Setting — pieni hämäläinen maatila, n. 1650–1700

A **small, self-sufficient family farm (maatila) in Häme, around 1650–1700**, on or a
short walk from the shore of a **low lake**. You play **the farmer** — an ageing man in a
wool tunic and felt hat — living here with his **family**: his wife (milking the cow),
the grandmother (*mummo*, knitting), the son (fishing). The buildings sit on a **dry
hummock (kumpare)** so spring floods and damp don't reach them. The yard (*pihapiiri*) is
**modest, irregular and practical** — no later-century planning. Austere, close to nature,
self-reliant; **nothing here suggests the big farms or manors of later centuries.** Quiet
presence over busy-ness.

**Build it from these (use the Finnish words in code/comments):**

- **Buildings** — unpainted log (*hirsi*) buildings, **greyed with age**; roofs of birch-
  bark (*tuoho*), shingle (*päre*) or straw (*olki*). Muddy yard, worn paths, simple wooden
  fences (*puuaita*).
  - **tupa** — the main dwelling where the whole family lives; heart of the *pihapiiri*.
  - **aitta** — one or two storehouses (grain, clothes, valuables), near the tupa.
  - **navetta** — small cowshed for a few cows, sheep, maybe one horse.
  - **savusauna** — smoke sauna, set a little **apart** from the others.
  - **riihi** — threshing barn for drying grain; built **farther off (fire risk)**.
  - **lato** — the hay barn, usually out **at the edge of a field**, not in the yard proper.
  - **kaivo** — a well near the tupa for daily water.
- **Cultivation:**
  - **kasvimaa** — small fenced vegetable patch by the tupa: **nauris (turnip), kaali
    (cabbage), sipuli (onion), herneet (peas), yrtit (herbs)**. ❌ **No potato yet.**
  - **humalatarha** — a little hop garden beside it, for brewing beer (*olut*).
  - **pellot** — small, **irregular, stony fields** partly cleared from forest, woven in
    among woods and meadows (no big open expanses): mainly **ruis (rye), ohra (barley),
    kaura (oats)**; **nauris** an important food crop too.
  - **niityt** — meadows between/around the fields for winter hay; some on **wet
    shores and riverbanks**.
- **The land around:**
  - **metsä** — forest starts fairly close: **kuusi / mänty / koivu** (spruce/pine/birch).
    Source of timber, firewood, game, berries, mushrooms. Narrow paths, **few real roads**.
  - **suo / kosteikot** — wetlands and small bogs in the low ground, part open, part
    stunted pine. **No large-scale ditching yet**; natural streams and hollows drain to the
    lake.
  - **järvi** — the lake dominates the view and is a key resource: fish, water, travel. A
    small **boat-landing (veneenvetopaikka)** or simple **jetty (laituri)** at the shore;
    travel by boat in summer, over the ice in winter.

**Reference imagery:** `inspiration/medieval/maatila.jpg` (the farmstead, scarecrow, crop
rows) and `inspiration/medieval/kaskenpoltto.jpg` (Järnefelt's *Raataja* — the smoky,
dusky, melancholic palette to grade toward).

> **Canonical lore (author's text, Finnish — source of truth, do not paraphrase away):**
>
> Pieni maatila sijaitsee Hämeessä matalan järven rannalla tai lyhyen kävelymatkan päässä
> siitä. Tilan rakennukset on sijoitettu kuivalle kumpareelle, jotta kevättulvat ja
> kosteus eivät vahingoita niitä. Pihapiiri on vaatimaton, epäsäännöllinen ja
> käytännöllinen, ilman myöhempien aikojen tarkkaa suunnittelua.
>
> Rakennukset ovat maalaamattomia hirsirakennuksia. Hirret ovat vuosien aikana
> harmaantuneet. Katot ovat tuohesta, päreestä tai oljista tehtyjä. Rakennusten ympärillä
> on mutaista pihamaata, kuluneita polkuja sekä yksinkertaisia puuaitoja.
>
> Pihapiirin tärkein rakennus on tupa, jossa koko perhe asuu. Tuvan lähellä sijaitsee yksi
> tai kaksi aittaa viljan, vaatteiden ja arvotavaroiden säilyttämiseen. Pihassa on pieni
> navetta muutamalle lehmälle, lampaalle ja mahdollisesti yhdelle hevoselle. Savusauna
> sijaitsee hieman erillään muista rakennuksista. Riihi on rakennettu kauemmas
> palovaaran vuoksi ja sitä käytetään viljan kuivaamiseen ennen puintia.
>
> Varsinainen lato sijaitsee yleensä pellon laidassa eikä välttämättä aivan pihapiirissä.
>
> Tuvan lähellä on pieni aidattu kasvimaa. Siellä kasvatetaan naurista, kaalia, sipulia,
> herneitä sekä erilaisia yrttejä. Perunaa ei vielä kasvateta. Kasvimaan vieressä voi olla
> pieni humalatarha oluen valmistusta varten. Kaivo sijaitsee lähellä tupaa päivittäistä
> vedenhakua varten.
>
> Pihapiiriä ympäröivät pienet pellot. Ne ovat epäsäännöllisen muotoisia, kivisiä ja
> osittain metsästä raivattuja. Pelloilla viljellään pääasiassa ruista, ohraa ja kauraa.
> Nauris on tärkeä ravintokasvi. Pellot eivät muodosta suuria avoimia alueita, vaan ne
> sulautuvat metsän ja niittyjen lomaan.
>
> Peltojen välissä ja ympärillä on niittyjä, joilta kerätään heinää karjan talvirehuksi.
> Osa niityistä sijaitsee kosteilla ranta-alueilla ja jokivarsilla.
>
> Metsä alkaa melko lähellä tilaa. Se koostuu kuusista, männyistä ja koivuista. Metsä
> tarjoaa rakennuspuuta, polttopuuta, riistaa, marjoja ja sieniä. Metsässä kulkee kapeita
> polkuja, mutta varsinaisia teitä on vähän.
>
> Alavilla alueilla on kosteikkoja ja pieniä suoalueita. Suot ovat osittain avoimia ja
> osittain kitukasvuisten mäntyjen peittämiä. Laajamittaista ojitusta ei ole vielä tehty.
> Luonnolliset purot, painanteet ja kosteikot keräävät vettä ja johtavat sitä järveen.
>
> Järvi on yksi tilan tärkeimmistä resursseista. Sieltä saadaan kalaa, vettä ja
> kulkuyhteys lähialueille. Rannassa on pieni veneenvetopaikka tai yksinkertainen laituri.
> Kesällä liikutaan veneellä ja talvella jäätä pitkin.
>
> Kokonaisuus on vaatimaton mutta omavarainen: muutama hirsirakennus kuivalla kumpareella,
> niiden ympärillä kasvimaa, pellot ja niityt, niiden takana laajat metsät, siellä täällä
> suoalueita sekä lähellä oleva järvi, joka hallitsee maisemaa. Tunnelma on karu,
> luonnonläheinen ja käytännöllinen, eikä mikään viittaa myöhempien vuosisatojen suuriin
> maatiloihin tai kartanoihin.

### Finnish landscape vocabulary (build the world from these)
The real Finnish wilderness we're evoking — use the Finnish words in code/comments:
- **suo** — bog / mire: open, soft, golden-green wetland, tufts of grass, still pools,
  crossed by **pitkospuut** (wooden plank boardwalks). A signature Finnish landscape.
- **metsä** — dense forest, the dominant biome. Tall trunks, little gaps.
- Trees: **koivu** (birch — white papery trunk, light airy crown), **mänty** (Scots
  pine — tall bare reddish trunk, foliage only near the top), **kuusi** (Norway spruce
  — dark, narrow, drooping conical silhouette). All three should be visually distinct.
- **kalliot ja kivet** — bedrock outcrops / boulders and smaller stones, often
  glacier-rounded and grey.
- **sammal** — moss: soft green carpets on the forest floor, on rocks, on old roofs.
- Wildlife: **lehmä** (cow), **peura/hirvi** (deer), and ambient creatures later.

## Game idea & design principles

This is **narrative and educational, not simulation-focused** — not a sandbox farming
game about resource management or optimization, but a way of *spending a year* inside a
historical world that feels authentic, human, and deeply connected to the land.

- Historically grounded and culturally authentic.
- A **small number of highly detailed locations** rather than a sprawling map (see
  Levels below).
- **Seasonal visual change** — the same locations look different chapter to chapter.
- Strong emphasis on **atmosphere and everyday life** over mechanics.
- The player experiences **representative days**, not every day of the year. Chapter
  tasks are linear and chapter-specific (see Hard constraints for what this does and
  doesn't mean for UI).

### Themes
- **Water** — lakes, rivers, reflection, reeds, fishing.
- **Slow life** — unhurried, contemplative, no timers.
- **Nature & forest** — Finnish woods (pine, spruce, birch), meadows, wildflowers, fog.
- **Finnish nature & design** is the aesthetic focus.

## Characters

- **The farmer, Jussi** (playable character) — an ageing man in a wool tunic and felt
  hat, head of the household. The player's viewpoint on the year.
- **The wife** — runs the household and dairy; milks the cow.
- **The grandmother (*mummo*)** — the household's elder, knitting; a source of folk
  knowledge and tradition.
- **The son** — does the heavier outdoor labour (woodcutting, and fishing once the lake
  area exists).

The household is small and self-sufficient — no servants, no extended cast. The wider
community (neighbours, other villagers) appears only where a chapter calls for it, most
notably **Juhannus** (Chapter 2), which is explicitly about community life.

## Chapters

The long-term narrative shape for the whole game: it follows **one agricultural year**
through a small number of carefully selected days. Each chapter represents a key moment
in the yearly cycle and introduces important aspects of rural life, work, and culture.

**1. Spring Sowing — Spring.** A new year begins. The farm awakens after winter: fields
are prepared and seed grain is sown. Introduces the household, the buildings, the
landscape, and the central importance of agriculture.

**2. Juhannus — Midsummer.** Community and nature. The growing season is underway; focus
shifts to midsummer traditions, folk beliefs, fishing, gathering, and life beyond the
fields.

**3. Harvest — Late summer / early autumn.** The year's outcome. Crops are harvested and
brought in from the fields — the single most important period of the farming year.

**4. Riihi and Kekri — Autumn.** Preservation and celebration. Grain is dried in the
riihi and stored for winter. Ends with Kekri: traditions, feasting, and reflection on the
completed harvest.

**5. Winter — Winter.** Survival and preparation. Forestry work, livestock care,
household crafts, and storytelling fill the cold season. Ends as preparations for the
next spring begin again.

Chapters are the long-term structuring device for the narrative. A first, partial wiring
exists in code now — see "Chapter & character selection" under Active build below — but
it only swaps seasonal scene art and shows each chapter's description; chapters aren't
wired to actual days, tasks, or story content yet. We're still heads-down on building the
farm/Pihapiiri location itself (see Levels below), not chapter gameplay.

## Levels

We build the game as a small number of **separate, hand-laid-out locations** — closer to
levels than to one continuous open world — rather than one big procedurally generated
map. Each area is built to match a design mockup in `design/<area>/`. Areas can later be
linked (a path leading off one map into the next), but each is designed and built on its
own.

The long-term set of locations, matching the chapters above:

1. **Pihapiiri (main farmyard)** — the primary hub, revisited throughout the year and
   changed visually by season. Tupa, aitta, navetta, kaivo, sauna, kasvimaa. **Built**;
   see Active build below.
2. **Fields (pelto)** — a tilled field, forest all round. Used during sowing,
   haymaking, and harvest. **Built**, combined with Riihi below into one scene ("Pelto ja
   riihi") and linked onto Pihapiiri's east edge; see Active build below.
3. **Riihi** — the grain-drying building, away from the farmyard: isolated, functional,
   near fields and forest edge. Used for grain processing and harvest-related events.
   Its building is **built** and visible in the Pelto ja riihi scene (see above), but it's
   just backdrop for now — no grain-processing gameplay of its own yet.
4. **Forest (metsä)** — the wilderness surrounding the farm: firewood, forestry,
   hunting, gathering, folklore and cultural encounters; includes suo (bog/mire) pockets
   in the low ground. First piece **built**: a **metsälaidun** (forest pasture) clearing,
   linked onto Pihapiiri through a doorway between aitta and tupa; see Active build below.
5. **Lake shore (järvi)** — the household's water access: fishing, travel, seasonal
   scenes, reflection and cultural moments.
6. *(Optional)* **Tupa interior** — inside the main house: meals, family conversation,
   winter evenings, storytelling, holiday celebrations.

### Active build: side-on scenes (Pihapiiri, Pelto ja riihi, Metsälaidun)

The current, actually-running implementation is `src/scenes.ts`, not the isometric
engine described below. Three static scenes exist so far, each a single hand-illustrated
1920×1080 SVG drawn scale-to-fit (letterboxed if the viewport isn't 16:9):
- **Pihapiiri** (`assets/farm-scene.svg`) — tupa, aitta and navetta with the forest
  backdrop and yard.
- **Pelto ja riihi** (`assets/field-scene.svg`) — a tilled field with the riihi in the
  background, forest all round. (Not a lato — riihi is the grain-drying building; see
  the Levels list above.)
- **Metsälaidun** (`assets/metsalaidun-scene-{spring,summer,winter}.svg`) — a forest
  pasture clearing: birch, pine and shrubs around a grassy glade with a worn path,
  reached through a doorway in Pihapiiri rather than off a scene edge (see Portals
  below). The only scene with **seasonal art** so far — which of the three files is drawn
  depends on the selected chapter's season (see "Chapter & character selection" below).

**Jussi** (`assets/jussi-sprite-sheet.png`, a 4×4 sprite sheet; vector source
`assets/jussi-sprite-sheet.svg`) walks left/right via A/D or the arrow keys, across a
fixed ground line per scene (`groundY`/`walkMinX`/`walkMaxX` in each scene's entry in
`SCENES`). He faces the camera (front row of the sheet) whenever he's standing still,
and the side-on walk rows otherwise. `main.ts` boots `createSceneManager()` directly.

**Scene transitions (edges):** walking past a scene's walkable edge steps to the next
scene if that edge has an `exit` defined (`SCENES.pihapiiri.exitRight`/
`SCENES.pelto.exitLeft` — the scene's object key is still `pelto` even though its
display `label` is now "Pelto ja riihi"), arriving just inside the matching edge of the
destination; an edge with no `exit` is still a hard wall (clamp), same as before. Right
now Pihapiiri ↔ Pelto ja riihi is wired up this way (exiting Pihapiiri east leads there;
exiting west leads back) — Pelto ja riihi's far (east) edge and Pihapiiri's west edge are
still dead ends. Each scene edge that has an exit shows a small glowing marker (a soft
glow + chevron) positioned a bit further out than the walk boundary itself, toward the
scene's edge — `MARKER_OUTSET` in `scenes.ts`. It brightens on mouse hover with a
tooltip naming the destination. The glow itself is a radial gradient (`drawGlow` in
`scenes.ts`), not canvas's `filter: blur()` — that filter isn't GPU-accelerated the way
CSS filters on DOM elements are and measured at ~50ms/frame for the marker blurs alone
(60fps → ~14fps); a gradient reads as the same soft halo for near-zero cost. Don't
reintroduce `ctx.filter` for glow/blur effects without re-profiling.

**Portals (doorways):** some connections aren't at a scene's edge at all — e.g. the gap
between aitta and tupa leading out to Metsälaidun. These are `portals` in `SCENES`: a
scene-space `x` inside the walkable range, a destination, and an exact arrival `x` there.
Unlike edge exits, a portal **only** triggers by clicking its marker (same chevron-marker
look, but pointing up/down instead of left/right) — walking through its `x` with the keys
does nothing, so crossing it on the way to somewhere else in the scene can't trigger it
by accident. Pihapiiri's doorway points up ("Metsälaidun ↑"); Metsälaidun's path back
down points down ("Pihapiiri ↓") — they land each other exactly back at the doorway/path
position they left from.

**The whole ground is clickable**: clicking anywhere sets `autoWalkTargetX` (clamped to
the scene's walk bounds) and Jussi walks there, same per-frame movement logic as holding
a key, stopping on arrival; clicking an exit marker is the same mechanism with its target
placed past the walk boundary, so he keeps going through the edge and triggers the scene
transition instead of stopping; clicking a portal marker sets a `pendingPortal` alongside
the target, consumed on arrival to step into the destination instead of stopping. Any
manual key press cancels the auto-walk (and any pending portal) and hands control back.
There's no fade-in/out "you've arrived" subtitle on entering a scene (there used to be
one, drawn on the canvas, but it was redundant once the location HUD below shipped, so it
was removed rather than kept as an unused option) — the player's location is always
visible via the location HUD instead.

**Buildings are hoverable too**, just informational (not clickable): each scene lists
`buildings` in `SCENES` as an eyeballed hit-region ellipse (`cx`/`cy`/`rx`/`ry`) over its
silhouette, with a small ring-and-dot badge drawn right on the building at that hotspot's
centre (`BUILDING_MARKER_RADIUS`) that brightens on hover; its name label floats clear
above the roofline (`BUILDING_LABEL_GAP`) — Tupa/Aitta/Navetta in Pihapiiri, Riihi in
Pelto ja riihi. Same `hovering` flag drives the pointer cursor as the exit/portal markers.

This is the first concrete instance of the "Perspective — resolved" direction in Visual
style above; Lake shore and Tupa interior from the Levels list don't have scenes built
yet, and Riihi/Forest only have the one building/clearing each shown above, no scene or
gameplay of their own yet.

**Location HUD (real game UI):** a small carved-wood plaque, top-left, fixed (`#location-
panel`/`#location-text` in `index.html`, styled in `style.css`), always on screen,
showing the current scene's `label` — kept in sync every frame in `main.ts` by polling
`scene.getLocationLabel()` and only touching the DOM when it changes. This is the first
piece of real, in-world UI chrome (as opposed to the admin panel below) — its wood-plaque
look is the intended visual language for further HUD elements (e.g. a future task list —
see Iteration roadmap).

**Admin/dev panel (not in-world UI):** a small HTML panel (`#ui-panel` in `index.html`,
not part of the canvas) holds two `<select>` dropdowns, wired up in `main.ts`, for
**testing only** — not designed to be part of the shipped game's UI, and visually
plain/dark on purpose so it doesn't read as in-world chrome. It's collapsed by default
(the `hidden` attribute) behind `#admin-toggle`, a small gear button fixed
bottom-right; clicking it toggles `uiPanel.hidden`. (`#ui-panel[hidden] { display:
none }` has to be declared explicitly in `style.css` — the panel's own `display: flex`
rule otherwise outranks the UA stylesheet's default `[hidden]` styling, since author CSS
always wins over UA styles regardless of selector specificity.) The dropdowns can be
changed at any time, independent of which scene Jussi is standing in:
- **Scene** — jumps straight to any scene via `scene.teleportTo()`, landing Jussi at the
  middle of its walk bounds (bypassing edges/portals entirely). Built from
  `listSceneIds()` in `scenes.ts`, so it can't drift out of sync with `SCENES`.
- **Chapter** — one of the five chapters in `src/chapters.ts` (`CHAPTERS`), matching the
  Chapters section above. Picking one calls `scene.setSeason()` and updates the panel's
  title/months/description text from that chapter's data. A chapter only controls which
  **season** is requested; if the current scene has no art for that season it falls back
  to its `bgUrl` default (currently only Metsälaidun has `seasonal` overrides — see
  above; Harvest and Riihi/Kekri both fall back to the summer art since there's no
  autumn Metsälaidun art yet). Pihapiiri and Pelto ja riihi have one asset each and so
  look the same in every chapter for now.
- **Character** — one of `src/characters.ts` (`CHARACTERS`), each entry holding a sprite
  sheet URL plus its cell size/row layout. Picking one calls `scene.setCharacter()`.
  Jussi is the only entry today; the shape exists so a second playable character is just
  another array entry, not a rework of `scenes.ts`'s drawing code.
- The scene's click-to-walk handler ignores clicks that don't land on the `<canvas>`
  itself, so interacting with either dropdown (or the location HUD) can't also send
  Jussi walking.
- Where this panel should ultimately live (collapsed behind a toggle? a corner that
  reads more clearly as "dev-only"?) is still an open question — raise it with the user
  before settling on a final spot.

### Earlier build (dormant): the isometric farm (umpipiha)

This is the older, **currently unused** isometric implementation — kept in the repo (not
deleted) because it's a lot of working code and the decision to remove vs. keep it for
parts hasn't been made (see Visual style). `main.ts` no longer calls into it.

**The farm — Pihapiiri plus its fields and riihi — was built as one isometric POC.** The
current map already spans what the list above treats as three separate locations
(Pihapiiri + Fields + Riihi) within one continuous, walkable area; that's fine for now
since it's one POC map — revisit only if/when they need to become separate scenes.

It is a faithful, literal build of the finalized mockup
`design/farm-layout/v4-umpipiha-topdown.png` (source: `design/farm-layout/generate.mjs`,
kept as the spec — "v4" is final and built, do not regenerate a v5 without being asked).
It is a **POC**: structure and layout fidelity (building placement/sizes, fields, fences,
the forest backdrop) matter much more than visual polish right now — reuse existing
simple vector-placeholder draw functions wherever possible rather than investing in new
art.

**Deferred to later, separate areas:** the **lake** (järvi), and **forest** as an
explorable destination beyond its current role as backdrop, are not currently in the
game. They'll come back as their own area(s) once the farm is solid. The `jetty`/`Reed`
types are kept in the code for that future lake area even though unused right now —
intentional, not dead code to clean up.

The farm area (`src/world.ts`'s `generateWorld()`) currently has:
- **Tupa** (main house), a combined **aitta** (storehouse), **navetta** (cowshed),
  **savusauna** (set a little apart), **riihi** (at the rye field's edge, north side of
  the path that forks to it, reachable on foot — no longer lost in the forest),
  **lato** (out at the edge of a field), **käymälä** (tucked to the west side, outside
  the fence and off the main gate's sightline, reached by its own short side-path), and
  **kaivo** (well) — all placed per the v4 mockup's metres-as-tiles layout.
- A muddy **pihapiiri** (yard) enclosed by a **puuaita** (fence) with a **portti** (gate)
  gap plus a narrower side-gate (for the käymälä spur), matching the mockup's fence
  segments.
- A tilled **kasvimaa** (nauris/kaali/sipuli/herneet/yrtit) with a **scarecrow**
  (variksenpelätin) standing watch.
- **Pellot** (ruis/ohra/kaura/nauris fields) and a **niitty** (summer pasture, with a
  deliberate forest gap from the navetta rather than abutting it) as clearings cut into
  the forest, per the mockup's field polygons. Paths are routed through the open
  corridor between fields, not through their crop rows.
- No **puro**/**lähde** on this map — they were cutting through the rye field, so v4
  drops them; `World.streams`/`springs` are returned empty here (the `Stream`/`Spring`
  types stay in code, like `jetty`/`Reed`, for wherever they're needed next).
- **Dense forest** — **koivu / mänty / kuusi** — as the default backdrop, with the
  above as clearings cut into it; **kalliot ja kivet** scattered through it.
- The **family**: the **wife** milking the cow (pastured in the niitty), the **mummo**
  (grandmother) knitting, the **son** chopping wood (no lake here for him to fish from —
  that returns with the lake area).
- The **playable farmer** (WASD / arrow keys, camera follows, close zoom).

We iterate from here — keep consulting `inspiration/`, and keep `design/farm-layout/`'s
mockup and `src/world.ts` in sync as the farm area evolves.

## Reference imagery — ALWAYS consult `inspiration/`
There is an **`inspiration/` folder** in the repo root, grouped into subfolders.
**Look at these images before doing any visual work** and keep matching their mood.

`inspiration/finnish-nature/` — the *real* landscape we're evoking:
- `forest-pine-sunbeams.jpg`, `forest-aerial-conifers.webp` — **wall-to-wall conifers**
  (kuusi/mänty), tall bare trunks with light between them, a lake in the distance.
  Our forest should feel **this dense and this calm**.
- `suo-boardwalk-patvinsuo.jpg` — a **suo** (mire): open golden-green wetland with a
  **pitkospuut** (plank boardwalk) toward a low conifer treeline.
- `kallio-autumn-cliff.webp`, `kallio-lake-dusk.jpg` — **kallio**: lichen-grey bedrock
  outcrops with moss, heather and grass on top, pines clinging on, often at the water's
  edge. `kallio-lake-dusk.jpg` is the **target mood**: muted, dusky, still, slightly
  melancholic — *real*, not cartoon. This is the palette to grade toward.

`inspiration/medieval/` — buildings & settlement:
- `log-house-thatch-roof.jpg` — rustic log house: grey weathered logs, sagging thatch /
  birch-bark + sod roof, exposed roof poles, low and lived-in.
- `village-diorama.*` — several log buildings, fences, worn dirt paths, animals.

`inspiration/art-style/` — *how to draw it*:
- `pentiment-1.jpg`, `pentiment-2.jpg` — **lead reference for style now**: flat
  **illuminated-manuscript / inked** look, fine pen linework, calm muted earthy palette,
  smooth flowing ground (no visible tile grid), character fairly **close** in frame.
- `glimmerwick-*.jpg` — layered foliage & cosy density, but **less saturated / less
  blobby than this** is what we want. Use for composition, not for the candy colours.

## Visual style

Style references: **Songs of Glimmerwick** (cosy, warm, hand-painted village life),
**Pentiment** (strong art direction, storybook feeling, medieval European setting), and
the reference screenshots the user originally shared (hand-painted/watercolour look,
soft layered foliage, sunbeams, muted natural palette, isometric camera, a tiny
character in a large gentle landscape).

- **Side-on static scenes, NOT isometric, NOT realistic 3D** — see "Perspective —
  resolved" below. (The dormant isometric engine used 2:1 diamond tiles; that's no
  longer the active approach.)
- 2D **sprites are fine** (currently hand-drawn with canvas vector shapes as placeholders).
- **Slightly more *real*, less cartoon** — grade toward **Pentiment** and
  `kallio-lake-dusk.jpg`: muted, desaturated, earthy, a touch dusky/melancholic. Pull
  saturation *down*. No candy greens, no Glimmerwick neon.
- **Camera sits CLOSE.** The character should be a clear presence, the landscape large
  around it. If in doubt, make the figure bigger relative to the frame (`FIGURE_H` in
  `scenes.ts`).
- **Calm, not busy.** *Suvanto = still water.* Motion must be **subtle**: barely-there
  sway, slow water, sparse slow dust. If anything reads as "jittery" or "everything is
  moving", **reduce the amplitude**. Stillness is the feeling.
- **Flowing, not "Minecraft".** The iso tiles must **not** read as a grid of diamonds.
  Colour the ground from **smooth low-frequency noise** sampled in world space (adjacent
  tiles nearly identical), avoid per-tile random checkerboard, soft-blend biome edges,
  decouple light/shadow blobs from the tile grid. The ground should look continuous.
- **Hand-drawn / inked:** soft dark outlines, fine strokes (grass tufts, bark, thatch)
  à la Pentiment; irregular silhouettes over clean polygons. Restrained highlights.
- Atmosphere: gentle god-ray shafts, *sparse* drifting pollen, vignette, chimney smoke,
  *slow* water shimmer.

### Perspective — resolved: side-on static scenes
The earlier isometric vs. side-on tension noted above is **resolved in favour of
side-on, static illustrated scenes** — confirmed by building the first one. The active
implementation (`src/scenes.ts`) draws a fixed hand-illustrated background per scene
(currently `assets/farm-scene.svg`, `assets/field-scene.svg` and the three seasonal
`assets/metsalaidun-scene-{spring,summer,winter}.svg` — tupa/aitta/navetta, field/riihi,
and a forest-pasture clearing, forest backdrop, all in one frame each) with Jussi
(`assets/jussi-sprite-sheet.png`) walking left/right across a fixed ground line in front
of it, stepping between scenes at their edges or through portal doorways — a
Pentiment-style "stage" rather than a freely-walkable world. The old **isometric**
(2:1 diamond tile) engine (`iso.ts`/`world.ts`/`update.ts`/`render.ts`, the v4 umpipiha
mockup) is still in the repo and still correct as a description of *that* code, but it
is currently **dormant/unused** — `main.ts` boots the new scene instead. Don't delete
those files without being asked; whether to remove them or keep them for parts (tree
draw fns, ink helpers, etc.) is an open decision, not yet made.

## Hard constraints (what this game is not)
- Not a sandbox farming simulator — no resource management, crafting, or optimization
  loops.
- No combat.
- No traditional inventory.
- No quest-log / objectives-checklist UI. Chapter tasks are linear and narrative-led —
  guidance comes through environment, dialogue, and scene design (à la Pentiment), not a
  HUD.
- No fail states, no time pressure. It's about presence over mechanics.

## Educational goals
The game should help players understand:
- How a small Finnish farm functioned in the 17th century.
- The seasonal rhythm of agricultural life.
- Traditional Finnish buildings and landscapes.
- The importance of forests, fields, livestock, and water.
- Cultural traditions such as Juhannus and Kekri.
- The lived experience of ordinary people, rather than kings, wars, or major historical
  events.

The intended feeling is not "running a farm," but spending a year living within a
historical world that feels authentic, human, and deeply connected to the land.

## Audio — two layers (real recorded files, **not** synth), and **optional**
Served from `public/audio/`; the audio files are **git-ignored** (only the README is
tracked). `src/audio.ts` is the player; starts on first user gesture.
- **Track lists are discovered automatically from the folder contents** — no
  `tracks.json` to maintain. The `audioManifest()` plugin in `vite.config.ts` scans
  `public/audio/{nature,music}/` at dev/build time and exposes `virtual:audio-manifest`
  (`nature`/`music` filename arrays, alphabetical). Restart `npm run dev` after adding files.
- **Audio is optional.** Because the files are git-ignored, a deployed build (GitHub
  Pages) ships with **empty lists and runs silently** — handle missing audio gracefully,
  never assume a track exists.
- **`nature/`** — field recordings forming an **ever-present ambient bed**: every file
  **loops simultaneously** (birds + river + wind). **Never muted.**
- **`music/`** — the **Nordic-cinematic score** (Skyrim / GW2 mood: choir + strings +
  flute, slow, modal/minor, spacious), played **over** the bed as a crossfaded, looping
  **playlist**. **M toggles the music layer only** — the nature bed keeps playing.
- Paths are **base-URL aware** (`import.meta.env.BASE_URL`) so they work under the Pages
  sub-path. Tunables in `src/audio.ts`: `NATURE_VOL`, `MUSIC_VOL`, `FADE`.
- ⚠️ **Do not replace this with a procedural synth** — that was rejected (too synthetic).
  Consult the user before changing the audio approach.
- Later: footstep sfx, a kantele line, weather-reactive ambience.

## Tech stack

- **Vite** + **TypeScript**, plain **HTML5 Canvas 2D**. No game framework.
  - Chosen for: full control of the painterly look, light footprint, easy to iterate,
    no lock-in. If we later need tilemaps/physics/audio routing we can revisit
    (Phaser / PixiJS), but canvas is plenty for this.
- Runs in Chrome via `npm run dev`.

### Run it
```bash
npm install
npm run dev      # open the printed localhost URL in Chrome
npm run build    # type-check (tsc) + production build to dist/
```

### Self-review screenshots (so the user doesn't have to send any)
Claude can **see** PNGs via the Read tool, so it reviews its own visual work headlessly:
```bash
node tools/shot.mjs <name> [--keys wasd] [--wait ms] [--w 1280] [--h 800]
```
`tools/shot.mjs` boots Vite on a fixed port, loads the game in **headless Chromium**
(Playwright), waits, optionally **drives the player** with `--keys` (e.g. `--keys aaw`
walks left/up to reframe), then writes `tools/shots/<name>.png` and prints page errors.
Then `Read` that PNG. To inspect detail, crop+upscale with ImageMagick:
`magick tools/shots/x.png -crop 360x300+380+180 +repage -resize 300% out.png`.
Requires `npm i -D playwright` + `npx playwright install chromium` (already done).
`tools/shot.mjs` is tracked; the PNG output dir `tools/shots/` is git-ignored.

### Deploy — GitHub Pages
`.github/workflows/deploy.yml` builds with Vite and publishes `dist/` to GitHub Pages on
every push to `main` (official `actions/upload-pages-artifact` + `deploy-pages`).
- One-time: in the repo, **Settings → Pages → Source: GitHub Actions**. Site serves at
  `https://oskarwestmeijer.github.io/games/`.
- `base: './'` in `vite.config.ts` keeps asset paths relative, so it works under the
  `/games/` sub-path. Commit `package-lock.json` (the workflow uses `npm ci`).
- **Licensed assets never ship**: `inspiration/` and the audio files are git-ignored, so
  the deployed build has no music/inspiration and the game runs silently (see Audio).

## Architecture

```
index.html            canvas + hint + #location-panel (location HUD) +
                      #ui-panel (admin chapter/character dropdowns), loads /src/main.ts
src/
  main.ts             bootstrap: canvas sizing (DPR), game loop, audio start, wiring,
                      populates and wires the chapter/character dropdowns
  scenes.ts            ACTIVE: side-on scenes (Pihapiiri, Pelto ja riihi, Metsälaidun) +
                      the player character (see Levels above)
  chapters.ts          CHAPTERS — the 5 chapters (id/title/season/months/description)
  characters.ts        CHARACTERS — playable characters (Jussi only so far)
  input.ts            keyboard state + screen-space axis()
  audio.ts            two-layer soundscape player, start()/toggleMute() (see Audio above)
  style.css

  — dormant, not called from main.ts right now (see Levels: "Earlier build") —
  iso.ts              tile constants, world<->screen math, hash noise
  types.ts            Tile / Entity / World / GameState shapes
  world.ts            generateWorld() — the isometric farm area's fixed layout,
                      isWalkable(), tileAt()
  update.ts           player movement + collision, cow & deer AI, camera follow
  render.ts           ALL drawing for the isometric scene (tiles, entities, atmosphere)
```

### Key conventions / facts — isometric engine (dormant, see Levels)
The conventions below describe `iso.ts`/`world.ts`/`update.ts`/`render.ts`. None of this
applies to the active `scenes.ts`, which has its own constants
(`groundY`/`walkMinX`/`walkMaxX`/`FIGURE_H` etc.) documented inline in that file.
- **Coordinates:** world coords are in *tile units* and may be fractional. Tile `(i,j)`
  is centred at world `(i,j)`. `worldToScreen`: `x=(wx-wy)*TILE_W/2`, `y=(wx+wy)*TILE_H/2`.
- `TILE_W = 64`, `TILE_H = 32` (2:1 iso). This engine's render pipeline scaled by a
  global `ZOOM` constant so the camera sat close (see Glimmerwick) — that constant lived
  in `main.ts` and was removed when `main.ts` stopped calling into this engine.
- **Depth sort:** entities drawn back-to-front by `wx + wy` (painter's algorithm).
- **Movement** is normalised in *screen space* so speed feels even in all directions,
  then converted to world delta. Collision is axis-separated (slide along walls).
- **Walkable** = not water and not inside any solid footprint (`world.solids`, e.g.
  buildings). bog, sand and path are all walkable. The map edge is a wall.
- **Tiles:** `grass | water | sand | bog | path | field`. `field` = any tilled/cultivated
  ground — the kasvimaa **and** the pellot (grain fields) reuse this one type (furrowed
  soil + crop-row look), walkable. `water`/`bog`/`sand` aren't used by the current
  farm-only area (no lake/suo yet) but stay in the type for when that area returns.
  **Tree variants:** `0` koivu (birch), `1` mänty (pine), `2` kuusi (spruce).
- **Homestead entities:** `house` (tupa), `barn` (navetta), `aitta` (raised storehouse),
  `outbuilding` (savusauna/riihi/lato/käymälä, via a `btype` discriminator — one shared
  simple draw fn, see `drawOutbuilding`), `well` (kaivo), `fence`, `scarecrow`
  (variksenpelätin), `jetty` (currently unused, kept for the future lake area),
  `villager` (`wife` | `granny` | `son`), plus `cow`/`deer`. `World.streams`/`springs`
  (puro/lähde polylines, drawn as a decorative overlay, not tiles) are currently empty —
  unused in this area's v4 layout, kept for whichever area needs them next.
- **Inked figures:** the sprite figures (player, villagers, cow, deer, scarecrow) carry a
  soft hand-drawn pen outline (`polyInk`/`ellInk`/`inkPath`, colour `INK_FIG`) for a
  Pentiment/Glimmerwick look. Buildings & trees are intentionally NOT outlined (yet).
- Tiles & entities are **viewport-culled** before drawing.
- Rendering is **vector placeholder art** — every entity has a `draw*` fn in `render.ts`.
  Swapping in real sprite sheets later = replace those fns.
- Determinism: `hashf(x,y)` drives world gen & per-object variation (seeds stored on
  entities), so the world is stable across reloads.

## Iteration roadmap (ideas, unordered — confirm before building)

- **Art:** replace vector placeholders with real hand-painted sprites / sprite sheets;
  proper tree & terrain variety; reflections in the water.
- **World:** bigger/streamed map; paths, fences, a jetty, rowboat, fishing spot,
  vegetable patch, sauna by the lake, drying racks.
- **Life:** more animals (chickens, a cat, ducks on the lake, birds), villagers who
  wander and greet (no quests — just presence & ambient dialogue à la Pentiment).
- **Atmosphere:** day/night & seasons, weather (rain, mist, snow), ambient audio
  (water, wind, birdsong, a kantele melody), footstep sfx on grass/sand/wood.
- **Gentle interaction:** sit on a bench, ring a bell, pet the cow, light a lamp —
  small reactive moments, still no inventory/quests.
- **Polish:** smoother sprite-based character with 8-direction walk, soft shadows,
  better water, screen-space ambient occlusion-ish darkening under canopies.
- **Task list HUD (wanted, conflicts with a Hard constraint below):** a simple wood/
  parchment-styled tasks list, fitting the location HUD's material language above. This
  is currently in tension with "No quest-log / objectives-checklist UI" in Hard
  constraints — resolve that conflict (either relax the constraint, or find a more
  diegetic form, e.g. a journal page you open rather than an always-on list) with the
  user before building it.

## Notes for whoever picks this up
- Keep it **cosy and calm**. When in doubt, remove UI, slow things down, add ambience.
- Prefer small, readable modules. The drawing code is intentionally explicit so the
  look is easy to tune.
