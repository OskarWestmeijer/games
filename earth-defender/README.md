# Earth Defender

One Three.js world seen four ways, picked from the dropdown in the top-right corner:

- **Flight view** — a small aeroplane on a chase camera, boost rings, a laser, and alien landing
  ships that shoot back.
- **Planet view** — a space station in orbit, walked in first person. Somewhere to be, not
  something to do.
- **Planet inspector** — the same world from outside, on orbit controls, with a sun slider.
- **Asset view** — a gallery of the AI-generated `.glb` models in [`ai-assets/`](ai-assets), from
  [Meshy](https://www.meshy.ai/) and [Tripo3D](https://www.tripo3d.ai/).

See [CLAUDE.md](CLAUDE.md) for architecture notes and how to add new assets.

## Run

```bash
npm install
npm run dev      # then open the printed http://localhost URL
npm run build    # type-check (tsc) + production build to dist/
```

## Stack

Vite + TypeScript + [Three.js](https://threejs.org/). No game framework.

**Not deployed.** The repo's Pages workflow builds the parking game instead; see the root
[README](../README.md).

## Credits

Surface maps from [NASA Visible Earth](https://visibleearth.nasa.gov/) (public domain).
Models generated with [Meshy](https://www.meshy.ai/) and [Tripo3D](https://www.tripo3d.ai/).
