# Earth Defender

A small aeroplane defending the Earth from alien bombers, on a Three.js globe. Fly in a fixed lane,
shoot down the ships bombing the world's capitals, boost through rings to go fast, and land a pass
through the command post before the guns run dry. Lose every capital and the flight is over.

Keyboard only: arrows climb and bank, `A`/`D` rudder, `W`/`S` throttle, `Space` the laser, `R` a
rocket.

See [CLAUDE.md](CLAUDE.md) for the design notes — the constants, and why each of them is what it is.

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
