# games — a folder per game

This repo is a set of **independent MVP games**. Each lives in its own root directory with its own
`package.json`, lockfile, `vite.config.ts`, `tsconfig.json`, `node_modules`, `dev/` harnesses and
**its own `CLAUDE.md`**, which is where that game's real notes are. This file is an index and a set
of house rules; it is deliberately short, and nothing about how any one game works belongs in it.

| folder | what it is | deployed |
| --- | --- | --- |
| [`parking-game/`](parking-game/CLAUDE.md) | **Precision Parking** — a one-tap parking game on a 2D canvas. Vite + TypeScript, no framework, no renderer, under 20 kB of JS. | **yes** — this is the site |
| [`earth-defender/`](earth-defender/CLAUDE.md) | One Three.js world seen four ways: an aeroplane defending Earth from landers, a space station in orbit, a planet inspector, and an AI-asset viewer. | no, until further notice |

## House rules

- **Games do not import from each other.** No shared `src/`, no shared config, no root
  `package.json`, no workspaces. A game folder is meant to survive being copied out of the repo on
  its own. If two games ever want the same code, copy it — the duplication is cheaper than the
  coupling, at this size.
- **Work inside one game folder at a time.** `cd` into it before `npm install`, `npm run dev`,
  `npm run build` or any `dev/` harness; none of them work from the root, and there is nothing at
  the root to run.
- **Read that game's `CLAUDE.md` first.** They carry a lot of "this was tried and reverted"; the
  odds are good that a decision which looks arbitrary was argued out already.
- **A new game is a new root folder**, with the same shape: `index.html`, `src/`, `dev/`, its own
  four config files, and a `CLAUDE.md`. Add a row to the table above.

## Deploy

`.github/workflows/deploy.yml` builds `parking-game/` and publishes `parking-game/dist/` to GitHub
Pages on every push to `main`. **It is the only thing in the repo that is deployed**, and
**GitHub Pages serves one site per repo** — so making another game the published one is a decision
about which game owns `https://oskarwestmeijer.github.io/games/`, not a config tweak to add
alongside.

Nothing else runs in CI: no build check, no tests, no linting. Whoever changes a game runs that
game's own `npm run build` and its `dev/` harnesses.

## History

Everything was a single Vite project — five scenes behind a mode dropdown, one `src/`, one
`package.json` — until this split. The pre-split notes, with each scene's full design history, are
at `git show ed3f592:CLAUDE.md`; paths in it are pre-split. Before that the repo was a narrative
game, *Vuodenkierto*, now fully retired but still in git history, which is why old commit messages
reference it.
