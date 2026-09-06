# games

A set of small, independent browser games. Each lives in its own directory with its own
dependencies and build — there is nothing to install or run at the repo root.

| folder | what it is | live |
| --- | --- | --- |
| [`parking-game/`](parking-game) | **Precision Parking** — a one-tap parking game on a 2D canvas. Five fixed bays, scored on how close you stopped. | [play it](https://oskarwestmeijer.github.io/games/) |
| [`earth-defender/`](earth-defender) | A Three.js world seen four ways: fly an aeroplane against alien landers, walk a space station in orbit, inspect the planet, browse the AI-generated assets. | not deployed |

## Run one

```bash
cd parking-game        # or earth-defender
npm install
npm run dev            # then open the printed http://localhost URL
npm run build          # type-check (tsc) + production build to dist/
```

Deployed to GitHub Pages on every push to `main` via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds `parking-game/` only.
