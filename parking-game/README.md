# Precision Parking

A one-tap parking game on a plain 2D canvas, seen from above. A toy taxi rolls along a kerbside
towards a painted bay; one tap stops it dead. **Parked means the whole car between the two lines.**

Five fixed bays, the same five for everybody, and you always play all five. Your score is the total
distance off centre across the session — lower is better.

▶ **[Play it](https://oskarwestmeijer.github.io/games/)**

See [CLAUDE.md](CLAUDE.md) for the design notes and why almost every number in it is what it is.

## Run

```bash
npm install
npm run dev      # then open the printed http://localhost URL
npm run build    # type-check (tsc) + production build to dist/
npm run check    # the harness: determinism, tap back-dating, the ladder's invariants
```

## Stack

Vite + TypeScript. No framework, no renderer, no assets — the whole game is drawn from code, and
the build is under 20 kB of JavaScript.
