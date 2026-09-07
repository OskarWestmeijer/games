# Space Station

A space station in orbit around Earth, walked in first person. Click to lock the pointer, `WASD` to
move, `E` to use what you are looking at; drag to look and push the on-screen stick on a tablet.

There is nothing to do and that is the point. Altitude, attitude, orbit mode and the clock are keys
on the navigation console upstairs — there is no HUD for any of them — and the radio in the lounge
switches the music on.

See [CLAUDE.md](CLAUDE.md) for the architecture notes, and `reference/` for the two images the
hull's form was read from.

## Run

```bash
npm install
npm run dev      # then open the printed http://localhost URL
npm run build    # type-check (tsc) + production build to dist/
```

## Check a change

```bash
node dev/shots.mjs   # a PNG per scripted camera pose, to dev/shots/ — then look at them
node dev/walk.mjs    # replays the floor logic over a route through the station
```

Run `walk.mjs` after any change to the decks, the stair or a footprint; it is the only thing that
catches a floor bug.

## Stack

Vite + TypeScript + [Three.js](https://threejs.org/). Playwright for the two dev harnesses.

**Not deployed.** The repo's Pages workflow builds the parking game instead; see the root
[README](../README.md).

## Credits

Surface maps from [NASA Visible Earth](https://visibleearth.nasa.gov/) (public domain).
Ambient audio is CC0 / public domain — see [src/audio/CREDITS.md](src/audio/CREDITS.md).
