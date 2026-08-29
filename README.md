# 3D Asset Viewer

A small GitHub Pages site that visualizes the `.glb` models in [`ai-assets/`](ai-assets)
— AI-generated 3D assets from Meshy and Tripo3D. Pick a model from the sidebar gallery
to load it into an interactive Three.js viewport (orbit / zoom / pan).

See [CLAUDE.md](CLAUDE.md) for architecture notes and how to add new assets.

## Run

```bash
npm install
npm run dev      # then open the printed http://localhost URL
npm run build    # type-check (tsc) + production build to dist/
```

## Stack

Vite + TypeScript + [Three.js](https://threejs.org/). No game framework.

Deployed to GitHub Pages on every push to `main` via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Credits

Models generated with [Meshy](https://www.meshy.ai/) and [Tripo3D](https://www.tripo3d.ai/).
