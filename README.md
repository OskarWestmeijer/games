# games

A set of small, independent browser projects. Each lives in its own directory with its own
dependencies and build — there is nothing to install or run at the repo root.

| folder | what it is | live |
| --- | --- | --- |
| [`parking-game/`](parking-game) | **Precision Parking** — a one-tap parking game on a 2D canvas. Five fixed bays, scored on how close you stopped. | [play it](https://oskarwestmeijer.github.io/games/) |
| [`earth-defender/`](earth-defender) | An aeroplane defending Earth from alien bombers, flown round a Three.js globe. | not deployed |
| [`space-station/`](space-station) | A space station in orbit above that same Earth, walked in first person. | not deployed |
| [`planet-inspector/`](planet-inspector) | The planet on its own, on orbit controls, with a sun slider. | not deployed |
| [`asset-viewer/`](asset-viewer) | A gallery for the AI-generated `.glb` models in `asset-viewer/ai-assets/`. | not deployed |

The middle three were one Vite project with a mode dropdown until they were split apart; they still
render the same planet, from three **copied** `space.ts` files. Nothing imports across folders.

## Run one

```bash
cd parking-game        # or any other folder in the table
npm install
npm run dev            # then open the printed http://localhost URL
npm run build          # type-check (tsc) + production build to dist/
```

Deployed to GitHub Pages on every push to `main` via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds `parking-game/` only.
