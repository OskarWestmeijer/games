# games

A set of small, independent browser projects. Each lives in its own directory with its own
dependencies and build — there is nothing to install or run at the repo root.

| folder | what it is | live |
| --- | --- | --- |
| [`parking-game/`](parking-game) | **Precision Parking** — a one-tap parking game on a 2D canvas. Five fixed bays, scored on how close you stopped. | [play it](https://oskarwestmeijer.github.io/games/parking-game/) |
| [`earth-defender/`](earth-defender) | An aeroplane defending Earth from alien bombers, flown round a Three.js globe. Keyboard only. | [play it](https://oskarwestmeijer.github.io/games/earth-defender/) |
| [`space-station/`](space-station) | A space station in orbit above that same Earth, walked in first person. | not deployed |
| [`planet-inspector/`](planet-inspector) | The planet on its own, on orbit controls, with a sun slider. | not deployed |
| [`asset-viewer/`](asset-viewer) | A gallery for the AI-generated `.glb` models in `asset-viewer/ai-assets/`. | not deployed |

▶ **[All of them, in one place](https://oskarwestmeijer.github.io/games/)**

The middle three were one Vite project with a mode dropdown until they were split apart; they still
render the same planet, from three **copied** `space.ts` files. Nothing imports across folders.

## Run one

```bash
cd parking-game        # or any other folder in the table
npm install
npm run dev            # then open the printed http://localhost URL
npm run build          # type-check (tsc) + production build to dist/
```

## Preview the whole site

`npm run dev` above shows one game. To see the **assembled site** — the menu plus every game, each
in its folder, served under a `/games/` prefix exactly as GitHub Pages serves it:

```bash
./site/preview.sh              # build everything, then serve on :8099
./site/preview.sh --no-build   # reuse the last build; fast, for editing the menu
./site/preview.sh --port 9000
```

It reads the game list out of the deploy workflow, so the preview cannot drift from what actually
ships. This is the only way to catch a path that works in `npm run dev` and 404s once the game is a
folder deep — which is what `base: './'` in each `vite.config.ts` exists to prevent.

## Deploy

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds every folder named in its
`GAMES` variable on each push to `main` and publishes them as one GitHub Pages site — a static menu
from [`site/`](site) at the root, and each game in a folder named after it. Adding a game to the
site is one word in `GAMES`.
