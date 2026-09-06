import * as THREE from 'three';
import { PLANET_RADIUS } from '../space';
import type { Space } from '../space';
import { CRUISE_ALTITUDE } from './lane';
import { createBolts } from './bolts';
import type { Bolts, BoltTarget } from './bolts';
import { createBurst } from './burst';
import type { Burst } from './burst';
import { CAPITALS } from './places';
import type { Capital } from './places';

/**
 * Alien bombers: they run in on a capital, **bomb it until there is nothing left of it**, and
 * then fly on to the next one. That loop is the game in this view.
 *
 * **A run has two halves, and the second is the one that matters.** The transit is a straight
 * level flight at `BOMBER_SPEED` from wherever the ship was to the city it is going to — a line
 * on the minimap with a real number of seconds on it, because the speed is fixed and the
 * distance is whatever it is. Then it *arrives*, and instead of vanishing (which is what a
 * landing ship used to do) it circles the place and drops a bomb every `BOMB_INTERVAL` while the
 * city's health drains in front of you. That window is the whole point: a countdown you either
 * beat or miss is a notice, where a city visibly coming apart under a ship you can still shoot
 * down is somewhere to fly *to*.
 *
 * **A capital that falls stays fallen, and so does a capital that is merely hurt.** The health
 * lives here, in `cities`, for the life of the flight — kill the bomber at two of six and that
 * is what the next ship finds. `reset()` is the only thing that puts the world back. When the
 * last capital goes, `survivingCount` is zero and `fly-view.ts` ends the flight on it.
 *
 * **The ship persists between runs, damage and all.** Twelve hits still kills one, and only
 * being shot down retires it — that is when it leaves a repair pack, waits, and comes back near
 * the aircraft. A bomber four hits from death that finishes a city carries those four hits to
 * the next one, so chasing a wounded ship is worth doing.
 *
 * **They only ever aim at capitals**, from the table in `places.ts`: the target *is* the row, so
 * the name on the countdown cannot disagree with the place it is over.
 */

/** How many exist. Each keeps its own target and its own clock, so the map usually has two or
 *  three fronts on it at once. */
export const BOMBER_COUNT = 3;

/**
 * How fast a ship crosses the world, in units a second over the ground.
 *
 * **The clock is distance now, not a constant.** It was a flat forty seconds from appearing to
 * arriving, whatever the distance — which was fine when the target was a random country and the
 * arrival was the end of the story, and is nonsense once a ship hops from the capital it just
 * destroyed to the nearest one still standing: those hops are anything from a few hundred units
 * to a third of the way round the planet. Five units a second is the old forty seconds over the
 * old half-radian hop, so nothing about the pace has changed — only that the countdown now means
 * what it says.
 */
const BOMBER_SPEED = 5;

/** The height the whole run is flown at: the aeroplane's lane, so a bomber is always something
 *  you can meet. See `fly/lane.ts` for why one file owns this number. */
const APPROACH_ALTITUDE = CRUISE_ALTITUDE;

/**
 * Where a *newly spawned* ship comes in from, in radians of arc from its first target: far
 * enough that it arrives from somewhere rather than appearing on top of the place. Only spawns
 * use this — a hop starts at the city the ship has just finished, which is the point of a front.
 */
const SPAWN_MIN_ARC = 0.35;
const SPAWN_MAX_ARC = 0.7;
/**
 * How far away a capital may be and still be given a *newly spawned* ship, in radians of arc
 * from the aircraft. Not a reachability limit — it is what keeps a fresh bomber a thing you might
 * go and do something about rather than a notice about the far side of the world.
 */
const MAX_SPAWN_ARC = 2.2;

/** Bigger than the ship, for the same reason the saucer's is. */
const HIT_RADIUS = 9;

/**
 * Hits it takes to bring one down. It used to be one — a bolt is a hitscan-fast beam fired six
 * times a second, so a lone ship on a straight approach died the instant it was noticed. Twelve
 * hits is two seconds of sustained fire at the laser's own cadence: real commitment, not a click
 * in passing, without being the grind twenty was — this is also why the health bar exists, so a
 * ship taking twelve hits reads as "getting there" rather than as one that refuses to die.
 */
export const BOMBER_MAX_HEALTH = 12;

/**
 * What a capital can take, in bombs, and how long the ship takes between them.
 *
 * Six bombs at two and a half seconds is about fifteen seconds of bombardment, which is the
 * number the whole fight is tuned around: long enough to cross a continent at cruise if you
 * leave the moment the alert bar changes, short enough that finishing something else first
 * costs a city. The first bomb comes sooner than the interval (`FIRST_BOMB_DELAY`) so that
 * arriving is visibly the start of something.
 */
export const CAPITAL_MAX_HEALTH = 6;
const BOMB_INTERVAL = 2.5;
const FIRST_BOMB_DELAY = 1;
/** The bomb itself: slower than any bolt in the scene, because it is falling 50 units, and fat
 *  enough to read as a thing rather than as a beam. */
const BOMB_SPEED = 90;
/** How close a bomb has to pass the city to count. Comfortably larger than the ~1.5 units a bomb
 *  covers in a frame — `fly/bolts.ts` kills a bolt that gets inside `PLANET_RADIUS`, and a bomb
 *  aimed at the ground passes exactly through it, so the hit must land first. */
const BOMB_HIT_RADIUS = 7;

/**
 * The circle a ship flies while it is bombing: how far out from the city, in world units, and
 * how fast round.
 *
 * **It circles rather than hovering.** A ship parked over a city reads as a bug — nothing else
 * in this scene is ever still — and a slow circle is also the one thing that makes a bombing run
 * something you can line up on from a distance: it is going somewhere predictable, at a speed you
 * can match. A lap takes about eighteen seconds, a little longer than the bombardment itself, so
 * a ship never quite laps the city it is destroying.
 */
const ORBIT_OFFSET = 26;
const ORBIT_RATE = 0.35;

/**
 * Its own return fire. Seconds between shots, per ship — independent of the pool's own
 * `interval` in `fly-view.ts`, which is the floor under the *combined* rate from every ship
 * shooting at once. A ship on its own therefore fires roughly this often; three of them do not
 * fire three times as often, because the pool will not let them.
 */
const FIRE_INTERVAL = 0.9;
/**
 * How far it will even try, in world units. Comfortably inside the aircraft's own gun range —
 * this is a ship on a fixed, visible run, not a sniper on the far side of the planet — and well
 * under what a fired bolt could reach on its own lifetime.
 */
const FIRE_RANGE = 220;

/** Seconds between one being shot down and the next appearing. A ship that finishes a city does
 *  not go through this: it simply flies on. */
const RESPAWN_MIN = 8;
const RESPAWN_MAX = 20;
/** …spread over the three, so they do not all arrive together on the first pass. */
const STAGGER = 9;

/** Longitudes have to come back into -180..180 after a step east or west across the seam. */
function wrapLongitude(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/** Cold, over 1.0 for the bloom, and the same green as the saucer: both of them are theirs.
 *  Exported so `fly-view.ts` can colour these ships' return fire the same green rather than
 *  duplicating the value — the alien half of this scene is one palette. */
export const BOMBER_GLOW = new THREE.Color(0.3, 2.9, 1.7);
/** A city going up is *ours* burning, not theirs: warm, and the one warm explosion in this file. */
const CITY_FIRE = new THREE.Color(3.4, 1.1, 0.35);

/**
 * A blunt cone with a collar and a light underneath. Built nose-forward along -Z, upright in +Y,
 * which is the basis `update()` gives it: +Y the local vertical, -Z the way it is going.
 *
 * **The nose points along the run, not at the ground.** The same hull aimed downwards read as a
 * descent module, which is what it was. A ship flying level over a country with its nose on the
 * horizon reads as a bomber, and the belly lamp is where the bombs come from.
 */
function buildShip(): THREE.Group {
  const ship = new THREE.Group();

  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(3.6, 5.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8e97a3, roughness: 0.35, metalness: 0.7 })
  );
  // A cone points +Y; -90° about x lays it along -Z, the direction of travel.
  hull.rotation.x = -Math.PI / 2;
  ship.add(hull);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(4.3, 4.3, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a424d, roughness: 0.5, metalness: 0.6 })
  );
  // Round the tail, so the hull is a cone coming out of a ring rather than a plain dart.
  collar.rotation.x = Math.PI / 2;
  collar.position.z = 2.2;
  ship.add(collar);

  const lamp = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 20),
    new THREE.MeshBasicMaterial({ color: BOMBER_GLOW, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  lamp.rotation.x = Math.PI / 2;
  lamp.position.y = -2.3;
  ship.add(lamp);

  return ship;
}

/** What a ship is doing right now. There is no third state: a bomber is always going somewhere
 *  or destroying somewhere. */
export type BomberPhase = 'transit' | 'bombing';

/** A capital and what is left of it. */
interface City {
  capital: Capital;
  health: number;
}

/**
 * One ship's whole state. Written out rather than inferred from the object that makes it,
 * because the ships and the functions that retarget them refer to each other — `hop()` takes a
 * `Bomber` and is called from inside the object literal that builds one, which is a circle
 * TypeScript cannot infer its way round.
 */
interface Bomber {
  mesh: THREE.Group;
  burst: Burst;
  active: boolean;
  phase: BomberPhase;
  progress: number;
  /** Written every frame in `update()` for the alert bar — see `BomberView`. */
  secondsLeft: number;
  targetHealth: number;
  runSeconds: number;
  wait: number;
  name: string;
  health: number;
  city: City | null;
  fireCooldown: number;
  bombCooldown: number;
  orbitAngle: number;
  siteLat: number;
  siteLon: number;
  entryLat: number;
  entryLon: number;
  position: THREE.Vector3;
  entry: THREE.Vector3;
  site: THREE.Vector3;
  targetSurface: THREE.Vector3;
  target: BoltTarget;
  bombTarget: BoltTarget;
}

export interface BomberView {
  readonly active: boolean;
  /** The capital it is running in on, or the one it is destroying. For the alert bar. */
  readonly name: string;
  /** Hits left before it goes down, for the bar over the ship. */
  readonly health: number;
  readonly phase: BomberPhase;
  /** 0 where the run began, 1 over the city. Only meaningful in `'transit'`. */
  readonly progress: number;
  /** Seconds until it arrives (`'transit'`) or until the city falls at its current rate
   *  (`'bombing'`). The one number the alert bar counts down. */
  readonly secondsLeft: number;
  /** What is left of the city it is going for, out of `CAPITAL_MAX_HEALTH`. */
  readonly targetHealth: number;
  /** Where it is now. Live vectors, all of them — the minimap reads them every frame. */
  readonly position: THREE.Vector3;
  /** The two ends of the line drawn on the map, both at lane height. */
  readonly entry: THREE.Vector3;
  readonly site: THREE.Vector3;
  /** …and the city itself, on the ground: where the bombs land, where it goes up, and what the
   *  floating health bar in `fly-view.ts` is anchored over. */
  readonly targetSurface: THREE.Vector3;
}

export interface Bombers {
  /** Add this to the scene. */
  group: THREE.Group;
  /** How many ships have been shot down since the view opened — a tally of what the player did,
   *  not of what happened. Zeroed by `reset()`. */
  readonly downed: number;
  /** How many capitals are still standing. Zero is the end of the flight, and `fly-view.ts`
   *  watches it for exactly that. */
  readonly survivingCount: number;
  /** For the minimap and the alert bar. Always `BOMBER_COUNT` long; check `active` first. */
  all: readonly BomberView[];
  /** Appends every live ship's hit target to `into`, without allocating. **Cities are never in
   *  here** — see `bombTargets` below. */
  collect(into: BoltTarget[]): void;
  /** Flies everything live, drops the bombs, and destroys what has run out of health.
   *  `from` is the aircraft — new ships appear a flight away from wherever it is. */
  update(dt: number, from: THREE.Vector3): void;
  /** Takes the ships off the board, re-staggers their arrivals, and puts every capital back. */
  reset(): void;
}

export interface BomberOptions {
  /** Called with the world position of a ship the moment it is shot down. `fly-view.ts` drops a
   *  repair pack there. The vector is live and reused, so copy it rather than keeping it. */
  onShotDown?(at: THREE.Vector3): void;
  /**
   * Called the moment a capital's last point of health goes, with the city and its position on
   * the ground. `fly-view.ts` puts a red cross on the minimap there and says the line. Same
   * shape as `onShotDown`, and the same warning: the vector is live.
   */
  onCapitalDestroyed?(capital: Capital, at: THREE.Vector3): void;
  /**
   * The pool a live ship's shots *at the aircraft* come out of — the same `fly/bolts.ts` pool
   * the laser is, tuned slower and cold green in `fly-view.ts`. Optional, so a caller that never
   * passes it gets bombers that do not shoot back.
   */
  enemyBolts?: Bolts;
}

export function createBombers(space: Space, options: BomberOptions = {}): Bombers {
  const group = new THREE.Group();

  let downed = 0;

  /**
   * The world's capitals and what is left of each. Owned here rather than in `fly-view.ts`
   * because it is what these ships are *for* — and because a city's hit target must never end
   * up in the list the player's laser is tested against. A target that never leaves this file
   * cannot be shot by mistake.
   */
  const cities: City[] = CAPITALS.map((capital) => ({ capital, health: CAPITAL_MAX_HEALTH }));

  /**
   * The bombs. A third instance of the laser's own pool, owned here rather than injected like
   * `enemyBolts`: its targets are the cities, and nothing outside this file should be able to
   * reach them. Slow, short and fat, so it reads as dropped rather than fired, and its own
   * `interval` is set low because the cadence belongs to each ship (`bombCooldown`) — unlike the
   * return fire, where the shared cap on three ships at once is the whole point.
   */
  const bombs = createBolts({
    color: BOMBER_GLOW,
    pool: 8,
    speed: BOMB_SPEED,
    lifetime: 2,
    interval: 0.05,
    length: 1.8,
    thickness: 0.75
  });
  group.add(bombs.group);

  /**
   * Two explosions for the cities, cycled between bombings, warm rather than the ships' own cold
   * green. Shared rather than one per ship on purpose: a bomber's own burst is its *death*, and
   * a ship shot a second after it finished a city would otherwise restart the city's explosion
   * as its own.
   */
  let cityFireNext = 0;
  const cityFires = [0, 1].map(() => {
    const burst = createBurst({ color: CITY_FIRE, time: 1.6, radius: 34, shardCount: 20 });
    group.add(burst.group);
    return burst;
  });

  const scratchDir = new THREE.Vector3();
  const scratchPoint = new THREE.Vector3();
  const entryDir = new THREE.Vector3();
  const siteDir = new THREE.Vector3();
  const east = new THREE.Vector3();
  const north = new THREE.Vector3();
  const travel = new THREE.Vector3();
  const back = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const fireDir = new THREE.Vector3();
  const POLE = new THREE.Vector3(0, 1, 0);

  /** Every city being bombed this frame, rebuilt in `update()` and handed to the bomb pool.
   *  Never leaves this module — see `cities`. */
  const bombTargets: BoltTarget[] = [];

  /** A city's direction from the planet's centre, as it is *this* frame: the planet turns, so
   *  this is asked again every time rather than remembered. */
  function directionOf(city: City, target: THREE.Vector3) {
    space.worldFromLatLon(city.capital.latitude, city.capital.longitude, PLANET_RADIUS, target);
    return target.normalize();
  }

  /**
   * The nearest capital to `from` that is still standing and that no other live ship is already
   * working on. The claim check is what keeps three bombers on three fronts instead of all three
   * piling onto one city; `except` is the ship doing the asking, which must not block itself.
   */
  function nearestCity(from: THREE.Vector3, except: Bomber | null): City | null {
    scratchDir.copy(from).normalize();
    let best: City | null = null;
    let bestDot = -2;
    for (const city of cities) {
      if (city.health <= 0) continue;
      if (bombers.some((b) => b !== except && b.active && b.city === city)) continue;
      const dot = directionOf(city, scratchPoint).dot(scratchDir);
      if (dot > bestDot) {
        bestDot = dot;
        best = city;
      }
    }
    return best;
  }

  /**
   * A capital for a *newly spawned* ship: a random one of those within `MAX_SPAWN_ARC` of the
   * aircraft, or the nearest standing one if the aircraft happens to be over an empty ocean.
   * Random rather than nearest, unlike a hop — a fresh ship arriving at the city you are already
   * defending, every time, would read as the game following you around.
   */
  function spawnCity(from: THREE.Vector3): City | null {
    scratchDir.copy(from).normalize();
    const reachable: City[] = [];
    let nearest: City | null = null;
    let nearestDot = -2;
    for (const city of cities) {
      if (city.health <= 0) continue;
      if (bombers.some((b) => b.active && b.city === city)) continue;
      const dot = directionOf(city, scratchPoint).dot(scratchDir);
      if (dot > nearestDot) {
        nearestDot = dot;
        nearest = city;
      }
      if (dot > Math.cos(MAX_SPAWN_ARC)) reachable.push(city);
    }
    return reachable.length ? reachable[Math.floor(Math.random() * reachable.length)] : nearest;
  }

  const bombers: Bomber[] = Array.from({ length: BOMBER_COUNT }, (_, i) => {
    const mesh = buildShip();
    mesh.visible = false;
    group.add(mesh);

    const burst = createBurst({ color: BOMBER_GLOW });
    group.add(burst.group);

    const state: Bomber = {
      mesh,
      burst,
      active: false,
      phase: 'transit',
      /** 0 where the run began, 1 over the city. */
      progress: 0,
      /** Both written every frame, so the HUD never has to know how a run works. */
      secondsLeft: 0,
      targetHealth: CAPITAL_MAX_HEALTH,
      /** How long this run's transit takes, from its own length: see `BOMBER_SPEED`. */
      runSeconds: 1,
      wait: i * STAGGER,
      name: '',
      health: BOMBER_MAX_HEALTH,
      /** What it is going for. Null only between being shot down and coming back. */
      city: null as City | null,
      /** Counts down to its next shot at the aircraft, and to its next bomb. Randomised on
       *  spawn so ships do not all open up at once. */
      fireCooldown: Math.random() * FIRE_INTERVAL,
      bombCooldown: FIRST_BOMB_DELAY,
      /** Where it is round the city while bombing — see `ORBIT_RATE`. */
      orbitAngle: 0,
      /** The two ends of the run, as places on the ground: the world positions are derived from
       *  these every frame, so a run turns with the planet instead of sliding over it. */
      siteLat: 0,
      siteLon: 0,
      entryLat: 0,
      entryLon: 0,
      position: new THREE.Vector3(),
      entry: new THREE.Vector3(),
      site: new THREE.Vector3(),
      targetSurface: new THREE.Vector3(),
      target: null as unknown as BoltTarget,
      bombTarget: null as unknown as BoltTarget
    };

    state.target = {
      position: state.position,
      radius: HIT_RADIUS,
      hit() {
        // Tolerates being called any number of times: several bolts can land in the same
        // frame, and every one of them past the ship's last point of health must do nothing.
        if (!state.active) return;
        state.health--;
        if (state.health > 0) return;
        state.active = false;
        state.mesh.visible = false;
        state.burst.fire(state.position);
        downed++;
        options.onShotDown?.(state.position);
        state.wait = RESPAWN_MIN + Math.random() * (RESPAWN_MAX - RESPAWN_MIN);
        // The city it was working on is left exactly as damaged as it is. That is the deal:
        // a rescue is real, and it is not a repair.
        state.city = null;
      }
    };

    // The city under this ship, as something a bomb can arrive at. Only ever handed to the bomb
    // pool, and only while this ship is bombing.
    state.bombTarget = {
      position: state.targetSurface,
      radius: BOMB_HIT_RADIUS,
      hit() {
        const city = state.city;
        if (!city || city.health <= 0) return;
        city.health--;
        if (city.health > 0) return;
        // Gone. The fire is a shared one — see `cityFires` — and the ship flies straight on.
        cityFires[cityFireNext].fire(state.targetSurface);
        cityFireNext = (cityFireNext + 1) % cityFires.length;
        options.onCapitalDestroyed?.(city.capital, state.targetSurface);
        hop(state);
      }
    };

    return state;
  });

  /** Starts a run to `city` from wherever `entryLat`/`entryLon` already say. The transit's
   *  length decides its own duration, which is what makes `secondsLeft` a real number. */
  function beginRun(bomber: Bomber, city: City) {
    bomber.city = city;
    bomber.name = city.capital.name;
    bomber.siteLat = city.capital.latitude;
    bomber.siteLon = city.capital.longitude;
    bomber.phase = 'transit';
    bomber.progress = 0;

    place(bomber);
    const arc = Math.acos(
      THREE.MathUtils.clamp(
        entryDir.copy(bomber.entry).normalize().dot(siteDir.copy(bomber.site).normalize()),
        -1,
        1
      )
    );
    // A hop to the city next door is still a few seconds of flying, not an instant one.
    bomber.runSeconds = Math.max((arc * (PLANET_RADIUS + APPROACH_ALTITUDE)) / BOMBER_SPEED, 4);
  }

  /** What happens the moment a city falls: on to the nearest one still standing, starting from
   *  the wreck of the last. A ship with nowhere left to go simply stops — by then `fly-view.ts`
   *  has ended the flight on `survivingCount`. */
  function hop(bomber: Bomber) {
    const next = nearestCity(bomber.position, bomber);
    if (!next) {
      bomber.active = false;
      bomber.mesh.visible = false;
      bomber.city = null;
      bomber.wait = Number.POSITIVE_INFINITY;
      return;
    }
    bomber.entryLat = bomber.siteLat;
    bomber.entryLon = bomber.siteLon;
    beginRun(bomber, next);
  }

  function spawn(bomber: Bomber, from: THREE.Vector3) {
    const city = spawnCity(from);
    if (!city) {
      // Nothing left to attack. Ask again in a moment rather than every frame.
      bomber.wait = 1;
      return;
    }
    bomber.health = BOMBER_MAX_HEALTH;
    // A short random delay rather than zero: a ship should not open fire in the same frame it
    // appears, before there has been any chance to see it coming.
    bomber.fireCooldown = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);

    // Where it comes in from: the target's own place, a random bearing and arc away. Done in
    // degrees rather than with a rotation, dividing the longitude by cos(latitude) so the step is
    // the same distance over the ground wherever it is taken. Crude near the poles, which is why
    // the latitude is clamped — this only decides which way the ship arrives from.
    const arc = THREE.MathUtils.radToDeg(SPAWN_MIN_ARC + Math.random() * (SPAWN_MAX_ARC - SPAWN_MIN_ARC));
    const bearing = Math.random() * Math.PI * 2;
    bomber.entryLat = THREE.MathUtils.clamp(city.capital.latitude + arc * Math.cos(bearing), -85, 85);
    const spread = Math.max(Math.cos(THREE.MathUtils.degToRad(city.capital.latitude)), 0.35);
    bomber.entryLon = wrapLongitude(city.capital.longitude + (arc * Math.sin(bearing)) / spread);

    beginRun(bomber, city);
    bomber.position.copy(bomber.entry);
    bomber.active = true;
    bomber.mesh.visible = true;
  }

  /** The run's two ends and the city itself, in world space, as they are *this* frame. The ends
   *  are at lane height so the line between them is level; the city is on the ground, because
   *  that is where the bombs go. */
  function place(bomber: Bomber) {
    space.worldFromLatLon(bomber.entryLat, bomber.entryLon, PLANET_RADIUS + APPROACH_ALTITUDE, bomber.entry);
    space.worldFromLatLon(bomber.siteLat, bomber.siteLon, PLANET_RADIUS + APPROACH_ALTITUDE, bomber.site);
    space.worldFromLatLon(bomber.siteLat, bomber.siteLon, PLANET_RADIUS + 1, bomber.targetSurface);
  }

  /** Upright and facing the way it is going: +Y the local vertical, -Z the direction of travel. */
  function orient(bomber: Bomber, up: THREE.Vector3, forward: THREE.Vector3) {
    back.copy(forward).negate();
    right.crossVectors(up, back);
    if (right.lengthSq() <= 1e-6) return;
    right.normalize();
    back.crossVectors(right, up).normalize();
    basis.makeBasis(right, up, back);
    bomber.mesh.quaternion.setFromRotationMatrix(basis);
  }

  return {
    group,
    all: bombers,
    get downed() {
      return downed;
    },
    get survivingCount() {
      return cities.reduce((n, city) => n + (city.health > 0 ? 1 : 0), 0);
    },

    collect(into: BoltTarget[]) {
      for (const bomber of bombers) if (bomber.active) into.push(bomber.target);
    },

    update(dt: number, from: THREE.Vector3) {
      // Outside everything else: a city's fire outlives the ship that lit it, and has to keep
      // running while that ship is halfway to the next place.
      for (const fire of cityFires) fire.update(dt);
      bombTargets.length = 0;

      for (const bomber of bombers) {
        // Same reasoning: a ship's own death burst runs on while its slot waits to refill.
        bomber.burst.update(dt);

        if (!bomber.active) {
          bomber.wait -= dt;
          if (bomber.wait <= 0) spawn(bomber, from);
          continue;
        }

        // Both ends are places on the ground, so they move as the planet turns and have to be
        // asked for again every frame.
        place(bomber);
        siteDir.copy(bomber.site).normalize();

        if (bomber.phase === 'transit') {
          bomber.progress += dt / bomber.runSeconds;
          if (bomber.progress >= 1) {
            // Arrived. Nothing happens to the city on arrival — the bombs do that, and the
            // first one is a beat away, which is what makes the arrival readable.
            bomber.progress = 1;
            bomber.phase = 'bombing';
            bomber.bombCooldown = FIRST_BOMB_DELAY;
            bomber.orbitAngle = Math.random() * Math.PI * 2;
          } else {
            // Straight in: the direction slides from entry to site at a fixed height. `lerp`
            // then `normalize` rather than a proper slerp — over the arcs this covers, the two
            // agree to well under the ship's own width.
            entryDir.copy(bomber.entry).normalize();
            scratchDir.copy(entryDir).lerp(siteDir, bomber.progress).normalize();
            bomber.position.copy(scratchDir).multiplyScalar(PLANET_RADIUS + APPROACH_ALTITUDE);
            travel.subVectors(siteDir, entryDir);
            travel.addScaledVector(scratchDir, -travel.dot(scratchDir));
            if (travel.lengthSq() > 1e-9) orient(bomber, scratchDir, travel.normalize());
            bomber.mesh.position.copy(bomber.position);
          }
        }

        if (bomber.phase === 'bombing') {
          // Round the city on a small circle: a basis on the ground under it, and a point at
          // `ORBIT_OFFSET` from the middle of it. The tangent to that circle is the direction of
          // travel, taken analytically rather than from where the ship was last frame.
          east.crossVectors(POLE, siteDir);
          if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
          east.normalize();
          north.crossVectors(siteDir, east).normalize();
          bomber.orbitAngle += ORBIT_RATE * dt;
          const arc = ORBIT_OFFSET / (PLANET_RADIUS + APPROACH_ALTITUDE);
          const cos = Math.cos(bomber.orbitAngle);
          const sin = Math.sin(bomber.orbitAngle);
          scratchDir
            .copy(siteDir)
            .multiplyScalar(Math.cos(arc))
            .addScaledVector(east, Math.sin(arc) * cos)
            .addScaledVector(north, Math.sin(arc) * sin)
            .normalize();
          bomber.position.copy(scratchDir).multiplyScalar(PLANET_RADIUS + APPROACH_ALTITUDE);
          travel.copy(east).multiplyScalar(-sin).addScaledVector(north, cos);
          travel.addScaledVector(scratchDir, -travel.dot(scratchDir));
          if (travel.lengthSq() > 1e-9) orient(bomber, scratchDir, travel.normalize());
          bomber.mesh.position.copy(bomber.position);

          // …and the bombs. Straight down at the city from wherever it has got to on the circle,
          // which is why they fall at an angle rather than vertically — it is over the place, not
          // on top of it.
          if (bomber.city) {
            bombTargets.push(bomber.bombTarget);
            bomber.bombCooldown -= dt;
            if (bomber.bombCooldown <= 0) {
              fireDir.subVectors(bomber.targetSurface, bomber.position).normalize();
              if (bombs.fire(bomber.position, fireDir)) bomber.bombCooldown = BOMB_INTERVAL;
            }
          }
        }

        // What the HUD reads, worked out here so nothing outside this file has to know how a run
        // is put together: how long the city has, and what is left of it. In transit that is the
        // flight time remaining; under the bombs it is what the bombs still have to do, the last
        // one included, which is why the current cooldown is part of it.
        bomber.targetHealth = bomber.city ? bomber.city.health : 0;
        bomber.secondsLeft =
          bomber.phase === 'transit'
            ? (1 - bomber.progress) * bomber.runSeconds
            : Math.max(0, (bomber.targetHealth - 1) * BOMB_INTERVAL + Math.max(bomber.bombCooldown, 0));

        // Return fire. Gated on distance as well as on the clock — a ship the aircraft has flown
        // well past should not keep sniping at it from beyond `FIRE_RANGE`.
        if (options.enemyBolts) {
          bomber.fireCooldown -= dt;
          if (bomber.fireCooldown <= 0) {
            fireDir.subVectors(from, bomber.position);
            const distanceSq = fireDir.lengthSq();
            if (distanceSq < FIRE_RANGE * FIRE_RANGE) {
              fireDir.multiplyScalar(1 / Math.sqrt(distanceSq));
              if (options.enemyBolts.fire(bomber.position, fireDir)) {
                bomber.fireCooldown = FIRE_INTERVAL;
              } else {
                // The shared pool was on its own cooldown or full — try again shortly rather
                // than waiting out a whole interval on top of whatever that was.
                bomber.fireCooldown = 0.2;
              }
            } else {
              // Out of range: no point spinning the cooldown down every frame for nothing.
              bomber.fireCooldown = 0.5;
            }
          }
        }
      }

      // Last, and against this frame's list: a bomb that lands calls `hit()` above, which may
      // destroy a city and hop the ship that dropped it — after everything has already moved.
      bombs.update(dt, bombTargets);
    },

    reset() {
      downed = 0;
      for (const city of cities) city.health = CAPITAL_MAX_HEALTH;
      bombs.clear();
      bombers.forEach((bomber, i) => {
        bomber.active = false;
        bomber.mesh.visible = false;
        bomber.burst.group.visible = false;
        bomber.city = null;
        bomber.phase = 'transit';
        bomber.progress = 0;
        bomber.wait = i * STAGGER;
      });
      for (const fire of cityFires) fire.group.visible = false;
    }
  };
}
