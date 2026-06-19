# Audio — the soundscape

Two layers, served from `audio/...` (relative to the app's base URL):

- **`nature/`** — field recordings that **always loop** as an ambient bed. Every file
  plays **at once** (layered: birds + river + wind). Not affected by mute.
- **`music/`** — the score, played **on top** as a crossfaded, looping **playlist**.
  Toggle it on/off in-game with **M**. The nature bed keeps playing when music is muted.

## Adding / changing tracks
Just **drop audio files into the matching folder**. The track lists are discovered
**automatically from the folder contents** at dev/build time (no `tracks.json` to
maintain) by the `audioManifest()` plugin in `vite.config.ts`.

- Files within a folder play in **alphabetical order**. Prefix with `01-`, `02-`, … if
  you want a specific order.
- Restart `npm run dev` after adding/removing files so the manifest is rescanned.

## Notes
- Use **`.mp3`** (safest), `.ogg`, `.m4a`, or `.wav`. Long loops feel best.
- Mood: **Nordic / Skyrim / Guild Wars 2** — slow, calm, modal/minor, choir + strings
  + flute, lots of space.
- The audio files are **git-ignored** (see `.gitignore`); only this README is tracked.
  Because of that, a deployed build (e.g. **GitHub Pages**) ships with **no audio** and
  the game runs **silently** — audio is entirely optional.
- No files in a folder ⇒ that layer is simply silent.
- Levels & fade are tuned in `src/audio.ts` (`NATURE_VOL`, `MUSIC_VOL`, `FADE`).
