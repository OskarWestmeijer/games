# Planet Inspector

The Earth from outside, on orbit controls: drag to swing round, scroll to zoom, and a `Sun` slider
sweeps the sun round the equator.

The same world [`earth-defender/`](../earth-defender) and [`space-station/`](../space-station)
render — same NASA maps, same shader, same nebula — with nothing in it. It exists so the planet can
be looked at directly, which is hard to do from inside a hull or from the cockpit of an aeroplane.

See [CLAUDE.md](CLAUDE.md) for the notes.

## Run

```bash
npm install
npm run dev      # then open the printed http://localhost URL
npm run build    # type-check (tsc) + production build to dist/
```

## Stack

Vite + TypeScript + [Three.js](https://threejs.org/).

**Not deployed** — the Pages workflow publishes `parking-game/` and `earth-defender/`. Adding this
one is a word in that workflow's `GAMES` variable; see the root [README](../README.md).

## Credits

Surface maps from [NASA Visible Earth](https://visibleearth.nasa.gov/) (public domain).
