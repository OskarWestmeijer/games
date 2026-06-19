# Suvanto — project brief & working notes

> *Suvanto* (Finnish) = the calm, still stretch of a river between rapids. Working title.

This file is the source of truth for what we're building and how. Keep it updated as
the game evolves.

## Vision

A **cosy browser game** about **17th century rural Finland**. A small, quiet homestead by
the water. The feeling we're chasing is *slow life*: wandering, listening, watching the
light move on the lake. No pressure, no fail states.

### Setting — pieni hämäläinen maatila, n. 1650–1700

A **small, self-sufficient family farm (maatila) in Häme, around 1650–1700**, on or a
short walk from the shore of a **low lake**. You play **the farmer** — an ageing man in a
wool tunic and felt hat — living here with his **family**: his wife (milking the cow),
the grandmother (*mummo*, knitting), the son (fishing). The buildings sit on a **dry
hummock (kumpare)** so spring floods and damp don't reach them. The yard (*pihapiiri*) is
**modest, irregular and practical** — no later-century planning. Austere, close to nature,
self-reliant; **nothing here suggests the big farms or manors of later centuries.** Quiet
presence over busy-ness; still no quests / combat / inventory.

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

### Central themes
- **Water** — lakes, rivers, reflection, reeds, fishing.
- **Slow life** — unhurried, contemplative, no timers.
- **Nature & forest** — Finnish woods (pine, spruce, birch), meadows, wildflowers, fog.
- **Finnish nature & design** is the aesthetic focus.

### Tone / references
- **Songs of Glimmerwick** — cosy, warm, hand-painted village life.
- **Pentiment** — strong art direction, storybook feeling, medieval European setting.
- The reference screenshots the user shared: **hand-painted / watercolour look**,
  soft layered foliage, sunbeams, muted natural palette, **isometric** camera, a tiny
  character in a large gentle landscape.

### 📌 Reference imagery — ALWAYS consult `inspiration/`
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

### Hard constraints (what this game is NOT)
- ❌ No combat
- ❌ No inventory
- ❌ No quest log / objectives UI
- ✅ It's a **walking sim** first. Mood and presence over mechanics.

### Art direction
- **Isometric** (2:1 diamond tiles), **NOT realistic 3D**.
- 2D **sprites are fine** (currently hand-drawn with canvas vector shapes as placeholders).
- **Slightly more *real*, less cartoon** — grade toward **Pentiment** and
  `kallio-lake-dusk.jpg`: muted, desaturated, earthy, a touch dusky/melancholic. Pull
  saturation *down*. No candy greens, no Glimmerwick neon.
- **Camera sits CLOSE.** The character should be a clear presence, the landscape large
  around it. If in doubt, zoom in (`ZOOM` in `main.ts`).
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

### Audio — two layers (real recorded files, **not** synth), and **optional**
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

## Current scope

Single outdoor scene by the water:
- **Two rustic log houses** (weathered grey logs, sagging sod/thatch roof, exposed roof
  poles, glowing window, chimney smoke) — old and lived-in, à la `keskiaika-puutalo.jpg`.
- A **lake** with sandy shore, reeds, foam rim, lily pads, slow shimmer.
- A **suo** (bog) patch with moss tufts and still pools.
- A worn **dirt path** that winds past the homestead and leads off the map.
- **Dense forest** — **koivu / mänty / kuusi** (birch / pine / spruce), packed thick,
  thickest at the edges so the homestead sits in a small clearing.
- **kalliot ja kivet** — lichen-grey **bedrock outcrops** (mossy, heather-topped) and
  scattered stones; **sammal** moss on the floor.
- A **cowshed** (navetta) with a fenced **paddock**, and the **family** at their daily
  work: the **wife** milking the cow, the **mummo** (grandmother) knitting, the **son**
  fishing from a **jetty** (laituri).
- A tilled **vegetable patch** (kasvimaa) planted in rows of turnip/cabbage, with a
  **scarecrow** (variksenpelätin) standing watch — see `inspiration/medieval/maatila.jpg`.
- A wandering **cow** and a shyer **deer**.
- The **playable farmer** (walk with WASD / arrow keys, camera follows, close zoom).
- Wildflowers; ambient light, sparse particles, and the procedural **Nordic score**.

We iterate from here — keep consulting `inspiration/`.

## Tech stack

- **Vite** + **TypeScript**, plain **HTML5 Canvas 2D**. No game framework.
  - Chosen for: full control of the painterly look, light footprint, easy to iterate,
    no lock-in. If we later need tilemaps/physics/audio routing we can revisit
    (Phaser / PixiJS), but canvas is plenty for a walking sim.
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
index.html            canvas + hint, loads /src/main.ts
src/
  main.ts             bootstrap: canvas sizing (DPR) + ZOOM, game loop, audio start, wiring
  iso.ts              tile constants, world<->screen math, hash noise
  types.ts            Tile / Entity / World / GameState shapes
  input.ts            keyboard state + screen-space axis()
  world.ts            generateWorld(), isWalkable(), tileAt() — biomes, path, props
  update.ts           player movement + collision, cow & deer AI, camera follow
  render.ts           ALL drawing (tiles, entities, atmosphere)
  audio.ts            procedural flute ambience (Web Audio), start()/toggleMute()
  style.css
```

### Key conventions / facts
- **Coordinates:** world coords are in *tile units* and may be fractional. Tile `(i,j)`
  is centred at world `(i,j)`. `worldToScreen`: `x=(wx-wy)*TILE_W/2`, `y=(wx+wy)*TILE_H/2`.
- `TILE_W = 64`, `TILE_H = 32` (2:1 iso). A global **`ZOOM`** in `main.ts` scales the
  whole render so the camera sits close (see Glimmerwick).
- **Depth sort:** entities drawn back-to-front by `wx + wy` (painter's algorithm).
- **Movement** is normalised in *screen space* so speed feels even in all directions,
  then converted to world delta. Collision is axis-separated (slide along walls).
- **Walkable** = not water and not inside any house footprint (`world.houses`). bog,
  sand and path are all walkable. The map edge is a wall.
- **Tiles:** `grass | water | sand | bog | path | field`. `field` = tilled kasvimaa
  (furrowed soil + crop rows), walkable. **Tree variants:** `0` koivu (birch),
  `1` mänty (pine), `2` kuusi (spruce).
- **Homestead entities:** `house` (tupa), `barn` (navetta), `aitta` (raised storehouse),
  `well` (kaivo), `fence`, `scarecrow` (variksenpelätin), `jetty`, `villager`
  (`wife` | `granny` | `son`), plus `cow`/`deer`.
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

## Notes for whoever picks this up
- Keep it **cosy and calm**. When in doubt, remove UI, slow things down, add ambience.
- Prefer small, readable modules. The drawing code is intentionally explicit so the
  look is easy to tune.
