# games — a folder per project

This repo is a set of **independent MVP projects**. Each lives in its own root directory with its
own `package.json`, lockfile, `vite.config.ts`, `tsconfig.json`, `node_modules`, `dev/` harnesses
and **its own `CLAUDE.md`**, which is where that project's real notes are. This file is an index and
a set of house rules; it is deliberately short, and nothing about how any one project works belongs
in it.

| folder | what it is | deployed |
| --- | --- | --- |
| [`parking-game/`](parking-game/CLAUDE.md) | **Precision Parking** — a one-tap parking game on a 2D canvas. Vite + TypeScript, no framework, no renderer, under 20 kB of JS. | **yes** — this is the site |
| [`earth-defender/`](earth-defender/CLAUDE.md) | An aeroplane defending Earth from alien bombers: a lane, boost rings, a finite magazine, capitals that can be lost. The one project here with any game in it. | no, until further notice |
| [`space-station/`](space-station/CLAUDE.md) | A space station in orbit, walked in first person. A place to be, not something to do. Two `dev/` harnesses. | no |
| [`planet-inspector/`](planet-inspector/CLAUDE.md) | The planet alone on `OrbitControls`, with a sun slider. The smallest project here, and the lens the shader is judged through. | no |
| [`asset-viewer/`](asset-viewer/CLAUDE.md) | A gallery for AI-generated `.glb` models. Owns `ai-assets/`. A utility. | no |

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

## Deploy

`.github/workflows/deploy.yml` builds `parking-game/` and publishes `parking-game/dist/` to GitHub
Pages on every push to `main`. **It is the only thing in the repo that is deployed**, and
**GitHub Pages serves one site per repo** — so making another project the published one is a
decision about which owns `https://oskarwestmeijer.github.io/games/`, not a config tweak to add
alongside. The workflow is parameterised by one `GAME` env var, so making that decision is a
one-line change.

Nothing else runs in CI: no build check, no tests, no linting. Whoever changes a project runs that
project's own `npm run build` and its `dev/` harnesses.

## History

Everything was a single Vite project — five scenes behind a mode dropdown, one `src/`, one
`package.json`. Precision Parking left first; the remaining four views (flight, station, inspector,
asset gallery) came apart into four folders after that. The pre-split notes, with each scene's full
design history, are at `git show ed3f592:CLAUDE.md`; **paths in it are pre-split twice over**, so
what it calls `src/` is now spread across four folders. Before that the repo was a narrative game,
*Vuodenkierto*, now fully retired but still in git history, which is why old commit messages
reference it.
