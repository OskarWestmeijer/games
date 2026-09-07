# games — a folder per project

This repo is a set of **independent MVP projects**. Each lives in its own root directory with its
own `package.json`, lockfile, `vite.config.ts`, `tsconfig.json`, `node_modules`, `dev/` harnesses
and **its own `CLAUDE.md`**, which is where that project's real notes are. This file is an index and
a set of house rules; it is deliberately short, and nothing about how any one project works belongs
in it.

| folder | what it is | deployed |
| --- | --- | --- |
| [`parking-game/`](parking-game/CLAUDE.md) | **Precision Parking** — a one-tap parking game on a 2D canvas. Vite + TypeScript, no framework, no renderer, under 20 kB of JS. | **yes** — `/games/parking-game/` |
| [`earth-defender/`](earth-defender/CLAUDE.md) | An aeroplane defending Earth from alien bombers: a lane, boost rings, a finite magazine, capitals that can be lost. The one project here with any game in it. | **yes** — `/games/earth-defender/` |
| [`space-station/`](space-station/CLAUDE.md) | A space station in orbit, walked in first person. A place to be, not something to do. Two `dev/` harnesses. | no |
| [`planet-inspector/`](planet-inspector/CLAUDE.md) | The planet alone on `OrbitControls`, with a sun slider. The smallest project here, and the lens the shader is judged through. | no |
| [`asset-viewer/`](asset-viewer/CLAUDE.md) | A gallery for AI-generated `.glb` models. Owns `ai-assets/`. A utility. | no |

`site/` is the sixth top-level directory and is **not** a project: one static `index.html`, no
build, no `package.json`, plus `preview.sh`. It is the menu at the root of the published site, and
`./site/preview.sh` is **the one thing in this repo that is run from the root** — it has to be,
because it assembles several games into one tree. See "Deploy".

## House rules

- **Projects do not import from each other.** No shared `src/`, no shared config, no root
  `package.json`, no workspaces. A folder is meant to survive being copied out of the repo on its
  own. If two projects ever want the same code, copy it — the duplication is cheaper than the
  coupling, at this size.
- **Three folders carry a copy of the same `space.ts` and the same NASA maps.** `earth-defender/`,
  `space-station/` and `planet-inspector/` render one world from three private copies. That is the
  house rule working as intended, and it has a cost: **a fix to the planet shader lands in one
  folder and not the other two.** Say which you changed. `space-station/dev/shots.mjs` is the only
  harness that renders that shader, so it is the closest thing to a regression test any of them
  have.
- **Work inside one folder at a time.** `cd` into it before `npm install`, `npm run dev`,
  `npm run build` or any `dev/` harness; none of them work from the root, and there is nothing at
  the root to run.
- **Read that project's `CLAUDE.md` first.** They carry a lot of "this was tried and reverted"; the
  odds are good that a decision which looks arbitrary was argued out already.
- **A new project is a new root folder**, with the same shape: `index.html`, `src/`, `dev/`, its own
  four config files, and a `CLAUDE.md`. Add a row to the table above.
- **`base: './'` in every `vite.config.ts` is load-bearing, not a default.** Several games share one
  Pages site by being served from a folder each, and a relative base is the only reason a build
  works without knowing what sub-path it landed on. A root-absolute path anywhere — a `fetch('/…')`,
  an `href="/…"` that survives the build — 404s on the deployed site and nowhere else.

## Deploy

`.github/workflows/deploy.yml` builds **every folder named in its `GAMES` env var** and assembles
them into one GitHub Pages site on every push to `main`:

```
https://oskarwestmeijer.github.io/games/                    site/index.html — the menu
https://oskarwestmeijer.github.io/games/parking-game/       parking-game/dist/
https://oskarwestmeijer.github.io/games/earth-defender/     earth-defender/dist/
```

**GitHub Pages serves one site per repo, but a site has directories.** That used to be written up
here as a zero-sum choice — which single game owns the URL — and it is not one: a game gets a folder
in the site, and the root is a static menu that belongs to no game. **Adding a project to the site
is one word in `GAMES` plus an `<li>` in `site/index.html`.** The three Three.js folders that are
not listed are left out by choice.

**`./site/preview.sh` serves the assembled site locally**, under a real `/games/` prefix, and reads
`GAMES` out of the workflow so it cannot drift from what ships. Use it after touching
`site/index.html`, after adding a game, and after anything that could turn an asset path absolute —
it is the only check that exercises the sub-path, since `npm run dev` serves a game at a root.

Two things to know before adding one:

- **It only works because of `base: './'`** (see the house rules). Check a new game's build for
  root-absolute paths first — they fail on the deployed site and nowhere else.
- **Weight.** The site is ~3.7 MB, nearly all of it earth-defender's surface maps. `space-station/`
  would add ~29 MB on top, nearly all of it music, which is the real reason to think about that one.

`npm run build` is what CI runs per game — `tsc && vite build`, so the type-check is included.
A failure in any one game fails the whole deploy and nothing is published; a half-updated site is
worse than a stale one. Beyond that nothing runs in CI: no tests, no linting. Whoever changes a
project runs that project's own `dev/` harnesses.

## History

Everything was a single Vite project — five scenes behind a mode dropdown, one `src/`, one
`package.json`. Precision Parking left first; the remaining four views (flight, station, inspector,
asset gallery) came apart into four folders after that. The pre-split notes, with each scene's full
design history, are at `git show ed3f592:CLAUDE.md`; **paths in it are pre-split twice over**, so
what it calls `src/` is now spread across four folders. Before that the repo was a narrative game,
*Vuodenkierto*, now fully retired but still in git history, which is why old commit messages
reference it.
