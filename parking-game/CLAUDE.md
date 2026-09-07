# Precision Parking — project brief & working notes

> **This is one of several independent games in this repo, and it is one of the two that ship.**
> It has its own `package.json`, `vite.config.ts`, `tsconfig.json` and `node_modules`; nothing here
> imports from a sibling folder and nothing in a sibling folder imports from here. It used to be
> the *only* thing deployed and to own the site's root URL; it now has a folder in a shared site,
> alongside `earth-defender/` — see "Deploy" below.
>
> It was one of five scenes behind a mode dropdown in a single Vite project until the repo was
> split into a folder per game. The long-form history of every scene that used to share the page,
> and of every parking experiment that was tried and reverted, is one command away:
> `git show ed3f592:CLAUDE.md`. Read it before re-litigating a decision that looks arbitrary
> here — the odds are it was tried already.

## What this is

**A one-tap parking game on a plain 2D canvas.** The street is seen from above: a chunky toy taxi
rolls left to right along a kerbside towards a painted bay; one tap stops it dead; the score is how
close its centre landed to the bay's centre. **Parked means the whole car between the bay's two
lines** — the car's own size is part of the question, which is what makes it parking rather than
target practice, and overhead that rule needs no explaining, because the gap you can see is the gap
the car has to fit into.

A session is **five fixed bays, the same five for everybody, and you always play all five**: putting
the bodywork over a line or running into the car in front costs a flat penalty and the session
carries on. At the end you get one number, the total distance off centre, which is the point of the
whole thing — a score two strangers can hold up against each other.

It is drawn onto a **fixed 360 x 512 portrait board that is letterboxed into whatever viewport it
lands in** — not decoration but the load-bearing decision of the whole scene.

**No framework, no renderer, no assets.** Vite and TypeScript, one canvas, a few dozen flat fills.
The production build is under 20 kB of JavaScript and half a kilobyte of CSS, which is the point of
keeping it out of the three.js project it used to live in.

## Architecture

```
index.html            one #park-canvas and nothing else. Every readout — the round, the total,
                      the verdict, the prompt — is drawn *inside* the letterboxed board, in board
                      units, where an HTML overlay pinned to the viewport could not follow it.
                      That includes the "Tap" / "Press Space" split, made from matchMedia in
                      park-view.ts and drawn rather than swapped in CSS. Loads /src/main.ts
vite.config.ts        base: './' for the /games/ sub-path; publicDir: false — nothing here is a
                      static asset
src/
  main.ts             find the canvas, build the view, start it, and stop it when the tab is
                      hidden. All that is left of a five-scene setMode()
  style.css           the reset, the body, and #park-canvas. The palette lives in park/board.ts,
                      because the drawing needs it and CSS does not
  park-view.ts        createParkView(canvas) — the board transform, the
                      ready/rolling/judging/results state machine, the tap (back-dated to the
                      event's own timestamp, which is the whole reason the game is fair), the
                      scoring and the render loop
  park/board.ts       the board as constants: the 360x512 field, the street's bands (roofs,
                      pavements, kerbs, through lane, parking lane, LANE_Y), the track geometry,
                      the warm daylight palette, and rrect(). Stated once because three files
                      draw into it
  park/levels.ts      levelSpec(n) — the deterministic ladder: two curves and an integer hash of
                      the level number, and **no Math.random anywhere**, which is what makes
                      everybody's level 7 the same level 7. One bay per level, sized as the car's
                      own CAR_HALF plus the round's clearance, and nothing else on the street
  park/draw.ts        every 2D drawing routine, in board units and all of it from overhead: the
                      roofs opposite, the pavements and their props, the asphalt, the parking bay,
                      the taxi and the car parked in front of it, the skids and speed lines, the
                      header and the verdict. One hullPath()/drawHull() serves both cars
  park/effects.ts     createEffects() — one fixed particle pool (grit, tyre smoke, confetti,
                      debris, the roof sign coming off) plus the screen shake, allocated once and
                      parked. **No gravity**: a plan view has no down to fall towards
  park/best.ts        the only persistence: a versioned localStorage record holding the best
                      session total and the smallest error achieved on each level
dev/park.mjs          the harness. Not wired into `npm run build`
```


`src/park-view.ts` and `src/park/` are the whole game; `main.ts` does nothing but build it and
start it. Three decisions govern everything below and none is cosmetic.

- **The scene is drawn from above, and it was side-on for a long time.** That was the mistake and
  the redesign is the correction: in profile the action reads as *stop the truck on the mark*,
  which is precisely the framing the game left behind when the win condition became the whole
  vehicle between two lines. Overhead the rule explains itself — the gap you can see **is** the
  gap the car has to fit into — and a car is far easier to draw legibly at 58 units than a van in
  profile was. **Nothing about the geometry moved when the camera did**: every scoring constant in
  `board.ts` and the whole of `levels.ts` are byte-identical across the change, which is why the
  ladder, `dev/park.mjs` and every stored personal best survived it untouched. Two consequences
  run through the drawing: a plan view has **no gravity**, so nothing thrown arcs; and the car's
  *width* is free while its *length* is what the game is scored on, so every transform applied to
  the car touches y and never x.
- **The board is a fixed 360 x 512 field, letterboxed.** Every number in the game — the car's
  length, the bay's half-width, the error you are scored on — is in board units, and one
  transform in `render()` maps the field onto the canvas. This is not about looking right in
  portrait. It is what makes two runs the *same run*: the stated goal is eventually to say "here
  is how close you got on level 7, and here is how close everybody else got", and a board that
  stretched to the viewport would make a four-unit miss a different achievement on a phone and on
  a desktop. Letterboxing is the price and it is cheap. **The scene's size is set by the board's
  width** — the street spans 26..334 of the 360 — so making the board *taller* cannot make the car
  bigger; only making it wider could, and that would mean re-tuning the whole ladder.
- **The ladder is a pure function of the level number.** `park/levels.ts` may not call
  `Math.random()` — speed, bay size and position all come out of two curves and a 32-bit integer
  hash of *n*. A single random call in there would look identical on screen and would quietly
  delete the comparison the board was shaped for, along with any hope of going back to beat your
  own stage record. `dev/park.mjs` asserts the ladder is byte-identical across two page loads,
  which is the only way that stays true.

And the rest of it, in the order it bites:

- **The whole field is visible and the camera never scrolls.** You see the car, the gap and the
  bay from the moment it launches, which is what makes the tap a judgement rather than a reaction
  — the feeling the scene is for. The cost is a 308-unit track, which caps speed: at 260 u/s
  there is well under a second of approach. So **difficulty is carried by the clearance
  shrinking**, 36 units either side of the car down to 4 — a nine-fold squeeze — while the speed
  curve asymptotes short of unwatchable. The five rungs a session uses give tap windows of 686,
  246, 102, 48 and 34 ms; the last is about where human timing precision runs out, and exactly
  where five rounds should finish. **Both curves are much steeper than they first were**, which
  is a correction rather than a taste: the original pair took twenty rungs to become interesting,
  which in a game whose whole appeal is the instant of a tap is nineteen too many.
- **A rating band has to be measured against the perfect band, not only against the clearance.**
  At the top of the ladder a quarter of the clearance is *narrower* than the perfect band itself,
  so `GREAT` — tested after `PERFECT` — had a window entirely inside it and could never be
  awarded. It takes the wider of the two now. Worth remembering before any further tuning: the
  shrinking bay eventually crosses every fixed threshold in the file.
- **The stop is instantaneous, and back-dated to the tap.** No braking curve and no skid, because
  either would put a second skill between the tap and the result when the tap *is* the result.
  More importantly the car's position is computed from the *event's* own timestamp, not read at
  the next animation frame: at 255 u/s one frame is over four board units against a level-22
  clearance of 4.3, so sampling at the frame would hand the whole bay to the frame clock and no
  amount of skill would get it back. `MAX_BACKDATE_MS` caps how far that interpolation is
  trusted, so a stale or synthetic timestamp cannot teleport the car. What the player gets
  instead of brakes is weight — the body splaying on its springs, smoke off all four contact
  patches, two black lines on the tarmac — all cosmetic, none of which move the judged number.
- **The win condition is the whole car inside the bay, and the ladder is built out of that.** The
  judged point is the car's centre — one number, and the only one a tap can move — but the band
  it has to land in is the round's **clearance**, which is the bay's half-width less `CAR_HALF`.
  So `park/levels.ts` shrinks the clearance, 36 down to 4, and the bay itself only goes from 130
  units wide to 67. It can never go below 58: **a bay shorter than the car is not a hard bay, it
  is an impossible one.** An earlier ladder shrank the *bay* to ±4 and judged the centre alone,
  which worked only because the car's own size was not in the question — and that is what made
  the target read as a mark to aim at rather than a space to fit into.
- **It was the tyres for a while, and the car's outline is better.** The tyres reached 1.5 units
  inside the bodywork, so the bumper legitimately overhung a bay the game called parked, and the
  rule needed a sentence to explain. The silhouette needs none — you can see whether it is between
  the lines — and it takes the drawing and the scoring off two different measurements of the same
  object. **Nothing drawn may stick out past `CAR_HALF`**; `dev/park.mjs` asserts the wheels do
  not, and `WHEEL_R` is the tyre's half-length *along the street* now (5.5, not the side-on
  wheel's 11 — a 22-unit tyre on a 58-unit car reads as a tractor from overhead).
- **The wheels are symmetric about the car's centre.** They were drawn at -16 and +17 while they
  were only ever decoration, and a car whose centre is not the midpoint of its own drawing is one
  whose judged number sits half a unit out in one direction forever.
- **The brake squash is lateral, and that is a correctness fix.** The bay is measured against the
  car's outline, so **anything that changes its drawn length is a scoring bug, not a visual one** —
  the player checks "is it between the lines" by eye, and a drawing that shortens under the brakes
  puts a car genuinely over a line inside it. Side-on the same rule made the nose dip a vertical
  shear rather than a rotation, because a rotation swung the axles in by 1.7 units at the crash
  tilt, 40% of the last round's clearance. From above the answer is a scale in y alone:
  `transform(1, 0, 0, 1 + k, 0, 0)` maps (x, y) to (x, y(1 + k)), the body splays out on its
  springs, and the footprint is provably untouched at any k. The same constraint binds anything
  drawn on the car — the shadow is offset **down the board only**, because an offset along x would
  put a dark edge past the bumper the player is judging.
- **The car's front must be tellable from its back, and from above that is not free.** The roof
  panel is offset aft inside the greenhouse, which leaves a windscreen half again as deep as the
  rear window; the headlights are wide and pale and the tail lights narrow and amber. A game about
  which end of the car crossed which line is unplayable if the car looks the same both ways round.
- **The bay's two lines are painted outside the judged edges, not inside them.** Drawn inward,
  five units of paint at each end meant the visible gap was ten units narrower than the space the
  judge measured, so "between the lines" and "in the bay" were two different rules. Outside, the
  inner edges of the paint *are* the boundary.
- **A failed round marks the line it crossed in red and the end of the car that crossed it in
  white, on a dark backing.** Not decoration: at the last round's 4.3 units of clearance, missing by a tenth of a
  unit puts the bodywork a tenth of a *pixel* past the paint, and an honest verdict on a stop like
  that is indistinguishable from a bug. The mark is the difference between "the game is wrong" and
  "oh — that end, that line". The dark backing is not decoration either: on a small overhang the
  mark lands *on top of* the red line it is calling out, and white on red on a yellow car is one
  contrast too few.
- **The car in front stands directly after the bay, and `BLOCK_GAP` is as small as the geometry
  allows.** `failLine` is `bay far edge + BLOCK_GAP - CAR_HALF`. With the whole car measured, the
  bumper and the judged edge are the same line, so the band between "your nose crossed the paint"
  and "your nose is in somebody's boot" is exactly `BLOCK_GAP` on every round — `dev/park.mjs`
  asserts that identity rather than a range. It was 24, and crashing was then almost impossible:
  you had to overshoot by most of a car length, so every failure was a miss and the thing at the
  end was scenery. The rule now is **stop short and you miss, go past and you hit it** — four
  units is sixteen milliseconds at round five's speed.
- **`BUFFER_W` is the judged footprint of that car and not how much of it is drawn.** Only the face
  is ever tested, so the car ahead is drawn a full 58 units long from it and simply runs off the
  board when the bay sits far down the street. Widening `BUFFER_W` to a real car length instead
  would cost 44 units of usable track, narrow the level-22 placement window from 75 units to 31,
  move every bay through `hash01()` and invalidate every stored record — for a number nothing
  reads.
- **The cheaper failure is the early one, and that is deliberate.** A miss costs 40 and a crash
  60, so the whole session is played a fraction early on purpose — exactly how anyone parks a real
  car towards the one in front. Because that car is fixed to the bay's far line and the bay narrows
  every round, the space you may stop in closes from the left as the session goes on, with the
  obstacle staying where it is.
- **The bay never starts where the car does.** At level 1 it is 127 units wide on a 308-unit
  street, and without `BAY_CLEAR` the near line would land behind the start line and the car would
  begin the level already parked. That constraint binds at the bottom of the ladder and the
  roll-time one binds at the top, which is why `minCentre` is a `max` of the two.
- **The setting is a kerbside street, and it lives everywhere except the tarmac.** The far side of
  the board is the **roofs** of the buildings opposite, because from directly overhead that is what
  a row of buildings is — drawn as shopfronts first, it read as a keyboard laid along the top of
  the board. Below them a pavement, a kerb, the through lane, the parking lane the bay is painted
  in, the near kerb, and the pavement that carries every prop: a street tree, a lamp post reaching
  out over the kerb, a bench, a bin, two bollards and the pigeon (which survived the delivery
  depot it was invented for, being the only living thing in the scene). **None of it is on the
  tarmac between the start and the bay** — that stretch stays empty, settled twice over, and props
  are drawn before the asphalt so nothing can creep onto it. From above the rule costs nothing: a
  pavement is exactly where a bin and a tree belong.
- **The roof sign comes off on a crash, once.** `effects.trim()` throws it at the moment of impact
  and `drawCar` stops drawing it from then on, so the one cartwheeling down the street is the only
  one left. It is how the "a thing you can lose" beat survives the delivery van that beat was
  invented for — something visibly leaves the car when you hit somebody, and it is not a scoring
  event. A miss keeps its sign: you parked badly, you did not hit anything.
- **The bay is drawn as a bay — a wash of colour between two bold end lines — not as a block of
  hazard chevrons.** The chevrons were right while the target was something to aim the bonnet at;
  they are wrong for a space to fit into, where the two lines and the gap between them are the
  entire question. The centre mark survives as a faint dashed tick, because it is what the score
  is measured from rather than what you have to hit.
- **The paint is white, and red is reserved for failure.** The bay's lines were the same yellow as
  the car for a while, which is two ways of saying nothing; they have to be the loudest thing on
  the board because they are the only question it asks. And nothing else on the street is allowed
  to be red — no red cars, no postbox, no red awning — so the crossed-line mark and the verdict
  word are the only red anywhere, which is the entire reason they read. The car in front is teal
  and the tail lights are amber for exactly that reason.
- **There is no precision ruler, and its removal is why the board is 512 tall rather than 640.** A
  hundred units above the street carried the level's clearance blown up to the full width of the
  board, with a dashed bracket for the stage record and a tick for where the car stopped. It was
  the densest thing on screen and it did not read: a second, magnified coordinate space stacked
  over the real one, which people took for a progress bar. **The street says the same thing in the
  only frame that matters — the car sitting between two painted lines.** Its ghost bracket became
  `personalBest` on the verdict: "your best here", a fact rather than a figure.
- **The asphalt runs the full width of the board and off both edges, and this reverses an earlier
  rule.** The road used to be drawn only as far as the obstacle, so it visibly lengthened as the
  levels placed their bays further out — because a wooden block standing in the middle of a road
  reads as an obstacle rather than as the end of one. The thing at the end is a parked car now,
  and a street carrying on past a parked car is the most ordinary sight there is. It is also what
  lets that car be drawn a full length long and simply run out of frame, instead of being cut off
  by a road that stops around it. The whole street band is clipped to `STREET_TOP..STREET_BOTTOM`,
  which is what keeps the bleed off the header and the verdict.
- **A session is five fixed bays and you always play all five. This is the load-bearing decision
  and it took two wrong turns to reach.** There are exactly two structures that produce a number
  two strangers can compare: a *variable* length whose score **is** the length (Flappy Bird — a
  count of pipes, comparable because the unit repeats), or a *fixed* length scored on quality
  (Dialed.gg, and this). The game was neither for a while — endless with one life, scored on total
  distance, lower better — under which quitting on round one with a tidy stop beat a flawless run
  to round twenty. Before that, failing had no consequence at all. **A fixed denominator is the
  fix, and the one-life rule is what had to go for it.** `SESSION` in `park/levels.ts` is the five
  rungs, spread across the ladder rather than taken off the bottom of it, so one session runs from
  686 ms of tap window down to 34 ms.
- **A failed round costs a flat penalty, not the distance it missed by.** A failure has to score
  *something* or the total is meaningless, and the real distance can be two hundred units if you
  stop at the start line — one flubbed round would swamp four good ones. `MISS_PENALTY` is 40,
  more than the widest round can score by parking badly (round one's clearance is 36), so failing
  is always worse than any successful park however sloppy; `dev/park.mjs` asserts that against the
  session's own widest clearance rather than trusting the comment. The verdict still shows the
  *real* distance as feedback; the results screen shows what the round cost. Those differ on a
  failure, and the word next to the number is what makes that legible.
- **`CRASH_PENALTY` is 60 — a crash costs half as much again as a miss, because it is worse.**
  Stopping outside the bay is bad parking; putting the bumper into somebody's boot is bad parking
  *and* hitting something, and charging the same for both says the car in front is scenery. It also gives
  the two failures different shapes to play against: overshooting long is cheaper than overshooting
  into the wall, so a round that is already lost still has something left to get right. Five
  crashes cap a session at 300.
- **The score is the distance, and lower is better.** `error` — how far the car's centre finished
  from the bay's centre, in board units — is the whole of it. There is no points formula: there
  used to be one (a thousand times a squared falloff, plus a perfect bonus, times a zone
  multiplier) and it was three arbitrary constants standing between the player and the one fact
  the game measures. `PERFECT` / `GREAT` / `CLOSE` survive as *feedback* — they pick the colour and
  fire the confetti — but they are derived from the distance and are not a second score.
- **The session's figure is the total distance, which only ever goes up.** The header calls it
  `TOTAL OFF` rather than `SCORE`, because a number labelled "score" is one a player assumes they
  want large. It sits beside `ROUND 3/5` — **the denominator is on screen the whole time**, because
  it is the entire reason the total means anything. A best total is a legitimate record now and
  `park/best.ts` keeps one; it was refused while the game was endless.
- **The two failures differ only in what they look like.** `CRASHED` is the car past the fail line
  and into the one in front: debris, the car ahead nudged and skewed, the roof sign thrown and a
  hard shake. (The skew is legal there for the reason it is forbidden on the taxi — nothing about
  that car is measured.) `MISSED` is a car parked politely in the wrong place: a puff of smoke and
  nothing else. The verdict names which.
- **The results screen is its own screen, not a panel over the street.** A summary laid over the
  parked car covers the one thing worth looking at — a run-ending card did exactly that once and
  was deleted for it. **Don't put a modal over the street.** Results are fine as a full screen because
  by then the last verdict has been and gone. They carry the total, whether it beat the stored
  best, and a row per round: number, rating, and what it cost. The breakdown earns its place — a
  total of 53 built from five sloppy stops and one built from four good stops and a miss are very
  different sessions, and the rows say which round to go back for.
- **A failed round's penalty counts towards the round record but is not announced.** "Your best
  here" printed under a word that has just cost you forty units reads as congratulation for
  failing.
- **`reset()` starts a fresh session and is the only way out of `results`.** Round 1, total and
  per-round scores cleared, effects cleared. Nothing carries forward except what `park/best.ts`
  wrote to disk.
- **There is one bay on the street and nothing else, and this reverses several earlier features.**
  Oil slicks on the approach and a small 3x bonus zone both existed and both are gone; so did an
  unnumbered tape measure under the street and a run-history strip of small bars along the bottom
  of the verdict. Each was defensible alone and together they were the problem: three things to
  read in the half-second before a tap that is only ever about one of them, on a screen already
  carrying too many numbers. A street with patches on it also stops looking like a street — which
  is also why the two worn patches briefly painted on the tarmac from overhead came straight back
  off: they read as puddles, and a plain road beats a road with artefacts on it.
  **Everything is the parking bay now** — how wide it is, how far away, and how fast you are going
  at it — and difficulty comes from the two curves alone. Don't reintroduce a second scoring
  target, a hazard on the tarmac, or anything painted on the road that is not the bay; that is the
  history you would be arguing with.
- **The `ready` phase exists so the bay can be read before anything moves.** Each level parks the
  car at the start line and waits for a tap to launch. Without it the first thing you would do
  every level is look at where the bay is while the car was already rolling towards it.
- **`arm()` clears the last verdict, and forgetting to was a real bug.** The verdict is drawn
  whenever the phase is not `ready`, so a `result` left lying around reappeared the instant the
  *next* level was launched: the previous stop's word and distance, under a car that had not been
  anywhere yet. It looked like the game was scoring you before you had done anything. The harness
  asserts `result` is null once a level advances.
- **`INPUT_LOCKOUT` is not politeness.** The tap that stopped the car is very often still on its
  way up when the verdict lands, and without it the same press would stop the car and launch the
  next level.
- **`stop()` re-arms a level that was mid-roll.** Switching away and back would otherwise return
  you to a car still rolling towards a bay you have not looked at since. Run and score are kept;
  the launch is not.
- **`park/best.ts` is the only persistence here**, and it carries the reasoning: one
  versioned key, every access in a `try/catch` because the property access itself throws in some
  private-browsing modes, and a malformed record treated as no record. `bestError` — the smallest
  distance on each level — is the leaderboard-shaped half of it. **Nothing on screen reads it back
  any more** now the ruler is gone; what the player gets is `personalBest`, the one-bit answer to
  "was that your best here". `errorFor()` stays as the read side so the data is not orphaned. The
  key is at `v2`: `v1` also held a best run *score*, which could not survive the score becoming a
  distance.
- **Effects are drawn under the car, not over it, and so are the skid marks.** Grit and tyre smoke
  belong beneath the thing that threw them; on top they read as dirt on the paintwork, which is
  what the first pass looked like. The skids go under the **bay's paint** as well — in life rubber
  would sit on top of it, but the two lines are the only question the picture asks and nothing is
  allowed to dim them.
- **The DPR cap is 2 even on a coarse pointer**, unlike `fly-view.ts`, which caps at 1.5. That cap
  is there because nearly every pixel in flight view is shader work under a bloom composer; this
  is a few dozen flat fills, and crisp text at arm's length is worth more than the fragments.
- **There is no sound**, deliberately: `src/audio/` is CC0-only by policy and view-owned, and a
  satisfying stop wants a real sound pass and a licence check rather than a file dropped in.
- **`node dev/park.mjs`** is the harness, and it exists for the two things no screenshot can show:
  that the ladder is deterministic, and that the stop is back-dated. It also walks the ladder
  asserting every bay is on the street and wider than the car, that none starts where the car
  does, that every fail line leaves room for the car in front and every bay's far end is reachable
  before the bumper meets it, and that every level gives at least `MIN_ROLL_SECONDS` of approach. It
  drives the win condition at its own boundary — a nose on the line is in, a tenth of a unit past
  it is out — through `tapAt`, so that is tested through the real judging rather than by doing the
  arithmetic twice. It prints the ladder as a table with each level's tap window in milliseconds,
  which is the number the curves are really tuned against. Not wired into `npm run build`.


## Touch, and iPad in particular

- **`touch-action: none` on the canvas**, or Safari treats a drag as a page scroll — and here also
  because the whole game is tapping, and Safari reads a quick second tap as a request to zoom.
- **`100dvh`, not `100vh`** — iOS counts the space behind its own chrome.
- **The "Tap" / "Press Space" wording is chosen in JS, not CSS**, because it is drawn inside the
  board rather than laid over it. `matchMedia('(pointer: coarse)')`, read once at construction.
- **Pixel ratio is capped at 2, not 1.5.** The three.js scenes this game used to share a page with
  cap lower because nearly every pixel in them is shader work under a bloom composer; this is a few
  dozen flat fills, and crisp text at arm's length is worth more than the fragments saved.

## Checking a change

**`node dev/park.mjs`** (or `npm run check`) — the harness, and it exists for the two things no
screenshot can show: that the ladder is deterministic, and that the stop is back-dated. It also
walks the ladder asserting every bay is on the street and wider than the car, that none starts where
the car does, that every fail line leaves room for the car in front and every bay's far end is
reachable before the bumper meets it, and that every level gives at least `MIN_ROLL_SECONDS` of
approach. It drives the win condition at its own boundary — a nose on the line is in, a tenth of a
unit past it is out — through `tapAt`, so that is tested through the real judging rather than by
doing the arithmetic twice. It prints the ladder as a table with each level's tap window in
milliseconds, which is the number the curves are really tuned against.

It starts its own Vite server and drives `window.__park`, the dev-only handle at the bottom of
`park-view.ts`. **Playwright is pinned exactly, not caret-ranged**: it ships a matching browser
build, and a minor bump silently invalidates the download in `~/.cache/ms-playwright`.

**There is no screenshot harness, and the drawing is the half of this scene that numbers cannot
check.** Every art decision above was made by rendering the board and looking at it. If you change
`draw.ts`, do the same.

## Deploy — GitHub Pages

`.github/workflows/deploy.yml` at the repo root builds every folder named in its `GAMES` variable —
currently this one and `earth-defender/` — and publishes them as one site on every push to `main`.
This game lives at **`https://oskarwestmeijer.github.io/games/parking-game/`**; the root is a static
menu from `site/`.

**It used to be at the root**, and the URL moved when the site went from one game to several. The
root could not stay this game, because `index.html` here is a bare canvas that paints its own
surround — there is deliberately nowhere in it to put a link to anything else.

**`base: './'` is why the move cost nothing.** Vite emits `./assets/…` rather than `/assets/…`, so
the build does not know or care which folder it is served from. Keep it that way: a root-absolute
path added here would work in `npm run dev`, work in `npm run preview`, and 404 only once deployed.

## Where this is going

It is a score game with a level ladder, a personal best and a stated ambition to **compare stages
between players**. That ambition is why `park/levels.ts` may not call `Math.random()` and why the
board is a fixed field rather than a stretched one: everybody's level 7 has to be the same level 7,
and "4 units off centre" has to mean the same thing on a phone and on a desktop. `onSessionEnd` in
`ParkViewOptions` is the hook a leaderboard would hang off; nothing uses it yet.

Nearer-term, in rough order:

1. **Sound.** There is none, deliberately — a satisfying stop wants a real sound pass and a licence
   check rather than a file dropped in. Anything added must be **CC0**, for the same reason the
   other project's textures are NASA's: this repo is public and its files are committed.
2. **A screenshot harness**, alongside `dev/park.mjs`, so the drawing gets checked the way the
   numbers are.
3. **More rounds, or a second session shape** — but not at the cost of the fixed denominator. See
   the `SESSION` note above for why that is load-bearing.
