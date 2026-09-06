import * as THREE from 'three';
import { PLANET_RADIUS } from '../space';
import type { Space } from '../space';
import type { Bolts, BoltTarget } from './bolts';
import { createBurst } from './burst';
import { LAND_TARGETS } from './places';

/**
 * Alien landing ships: they appear high up, descend along a straight approach to a point on the
 * surface, and are gone the moment they touch it. Forty seconds from appearing to landing —
 * which is the whole of the game in them. Shoot one down before it gets there or it lands, and
 * either way there is nothing left of it.
 *
 * Deliberately plain in one direction only. There is no landing sequence, no score for stopping
 * one and no penalty for missing: a ship is a marker on the map with a deadline on it, and the
 * flight *to* it is the thing worth having. A ship that reaches the ground is simply not there
 * any more. But a ship you *shoot* explodes — the flight to it is the whole of the game, so the
 * one moment it pays off is the one moment worth drawing. `fly/ufo.ts` is the same idea without
 * the clock, and its pop is the smaller sibling of the burst below.
 *
 * **They only ever come down on land.** The site is not a random point that might be sea — it
 * is a row out of `places.ts`, which is a table of inland coordinates and the country each one
 * is in. That is also where the name on the countdown comes from, so the label cannot disagree
 * with the place.
 *
 * They are unarmed, like the saucer.
 */

/** How many exist. Each keeps its own clock, so the map usually has one or two paths on it. */
export const LANDER_COUNT = 3;

/** Seconds from appearing to touchdown. The one number the player is actually playing against,
 *  and the one the HUD counts down — hence exported. */
export const LANDING_TIME = 40;

/** The approach: from this high, down to just above the surface. */
const ENTRY_ALTITUDE = 150;
const TOUCHDOWN_ALTITUDE = 1.5;
/**
 * How far the approach travels over the ground, in radians of arc. Long enough that the path
 * drawn on the minimap is a line you can read a direction off — 0.35 rad is about 105 units of
 * ground track, 0.7 is 210 — and short enough that the ship is not crossing continents.
 */
const APPROACH_MIN_ARC = 0.35;
const APPROACH_MAX_ARC = 0.7;
/**
 * How far away a country may be and still be given a ship, in radians of arc from the aircraft.
 * The aeroplane covers about five radians in the forty seconds of an approach, so this is not a
 * reachability limit — it is what keeps the countdown a thing you might actually go and do
 * something about rather than a notice about the far side of the world.
 */
const MAX_TARGET_ARC = 2.2;

/** Bigger than the ship, for the same reason the saucer's is. */
const HIT_RADIUS = 9;

/**
 * Hits it takes to bring one down. It used to be one — a bolt is a hitscan-fast beam fired six
 * times a second, so a lone ship on a straight approach died the instant it was noticed, and the
 * forty-second clock was really "forty seconds to notice it exists". Twelve hits is two seconds
 * of sustained fire at the laser's own cadence: against a forty-second approach that is real
 * commitment, not a click in passing, without being the grind twenty was — this is also why the
 * health bar exists, so a ship taking twelve hits reads as "getting there" rather than as one
 * that refuses to die.
 */
export const LANDER_MAX_HEALTH = 12;

/**
 * Its own return fire. Seconds between shots, per ship — independent of the pool's own
 * `interval` in `fly-view.ts`, which is the floor under the *combined* rate from every ship
 * shooting at once. A ship on its own therefore fires roughly this often; three of them do not
 * fire three times as often, because the pool will not let them.
 *
 * Came down from 1.6 — that read as a ship taking pot-shots rather than fighting back. Under a
 * second means a ship you linger in front of is a ship that keeps making you pay for it.
 */
const FIRE_INTERVAL = 0.9;
/**
 * How far it will even try, in world units. Comfortably inside the aircraft's own gun range —
 * this is a ship on a fixed, visible approach, not a sniper on the far side of the planet — and
 * well under what a fired bolt could reach on its own lifetime, so a shot taken at the edge of
 * this range is not a shot wasted into empty space.
 */
const FIRE_RANGE = 220;

/** Seconds between one going (landed or shot) and the next appearing. */
const RESPAWN_MIN = 8;
const RESPAWN_MAX = 20;
/** …spread over the three, so they do not all arrive together on the first pass. */
const STAGGER = 9;

/** Longitudes have to come back into -180..180 after a step east or west across the seam. */
function wrapLongitude(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/** Cold, over 1.0 for the bloom, and the same green as the saucer: both of them are theirs. */
/** Exported so `fly-view.ts` can colour these ships' return fire the same cold green rather
 *  than duplicating the value — the alien half of this scene is one palette. */
export const LANDER_GLOW = new THREE.Color(0.3, 2.9, 1.7);

/**
 * The explosion, from `fly/burst.ts`. Longer and bigger than the saucer's pop (`FLASH_TIME` 0.7,
 * `FLASH_RADIUS` 34 over a hull twice this one's size) because it is the payoff for a flight
 * across a continent rather than for a target of opportunity. Only a *kill* gets one; a landing
 * is still nothing at all. `createBurst({ color: LANDER_GLOW })` below takes every other default
 * from that file, which is this ship's own original tuning.
 */

/** A blunt cone with a collar and a light underneath. Built nose-down -Z, upright in +Y. */
function buildShip(): THREE.Group {
  const ship = new THREE.Group();

  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(3.6, 5.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8e97a3, roughness: 0.35, metalness: 0.7 })
  );
  // A cone points +Y; this one is a descent module, so it points at the ground.
  hull.rotation.x = Math.PI;
  hull.position.y = 0.6;
  ship.add(hull);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(4.3, 4.3, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a424d, roughness: 0.5, metalness: 0.6 })
  );
  collar.position.y = 3.1;
  ship.add(collar);

  const lamp = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 20),
    new THREE.MeshBasicMaterial({ color: LANDER_GLOW, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  lamp.rotation.x = Math.PI / 2;
  lamp.position.y = -2.3;
  ship.add(lamp);

  return ship;
}

export interface LanderView {
  readonly active: boolean;
  /** The country it is coming down on, for the countdown in the HUD. */
  readonly name: string;
  /** Hits left before it goes down, for the health bar in the HUD. Resets to
   *  `LANDER_MAX_HEALTH` on every spawn — it is not carried between ships. */
  readonly health: number;
  /** 0 where it came in, 1 on the ground — so `(1 - progress) * LANDING_TIME` is what the HUD
   *  counts down. */
  readonly progress: number;
  /** Where it is now. Live vectors, all three — the minimap reads them every frame. */
  readonly position: THREE.Vector3;
  /** Where it came in, and where it is going: the two ends of the path drawn on the map. */
  readonly entry: THREE.Vector3;
  readonly site: THREE.Vector3;
}

export interface Landers {
  /** Add this to the scene. */
  group: THREE.Group;
  /** How many have been shot down since the view opened. Ships that *land* are not in it —
   *  the number is a tally of what the player did, not of what happened. Zeroed by `reset()`. */
  readonly downed: number;
  /** For the minimap. Always `LANDER_COUNT` long; check `active` before drawing one. */
  all: readonly LanderView[];
  /** Appends every live ship's hit target to `into`, without allocating. */
  collect(into: BoltTarget[]): void;
  /** Descends everything live, lands what has run out of time, and counts the rest down.
   *  `from` is the aircraft — new ships appear a flight away from wherever it is. */
  update(dt: number, from: THREE.Vector3): void;
  /** Takes them all off the board and re-staggers their arrivals. */
  reset(): void;
}

export interface LanderOptions {
  /** Called with the world position of a ship the moment it is shot down — *not* when one
   *  lands, which is nobody's doing. `fly-view.ts` drops a repair pack there. The vector is
   *  live and reused, so copy it rather than keeping it. */
  onShotDown?(at: THREE.Vector3): void;
  /**
   * The pool a live ship's own shots come out of — the same `fly/bolts.ts` pool the aircraft's
   * laser uses, a second instance of it tuned slower and cold green in `fly-view.ts`. Optional
   * so a caller that never passes it simply gets landing ships that do not shoot, the same as
   * before this existed.
   */
  enemyBolts?: Bolts;
}

export function createLanders(space: Space, options: LanderOptions = {}): Landers {
  const group = new THREE.Group();

  let downed = 0;

  const scratchDir = new THREE.Vector3();
  const scratchPoint = new THREE.Vector3();
  const entryDir = new THREE.Vector3();
  const siteDir = new THREE.Vector3();
  const back = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const fireDir = new THREE.Vector3();

  /**
   * A country to aim at: a random one of those within `MAX_TARGET_ARC` of the aircraft, or the
   * nearest if the aircraft happens to be over an empty stretch of ocean. Measured in world
   * space, so the planet's own rotation is in the answer.
   */
  function pickTarget(from: THREE.Vector3) {
    scratchDir.copy(from).normalize();
    let nearest = LAND_TARGETS[0];
    let nearestDot = -2;
    const reachable = LAND_TARGETS.filter((candidate) => {
      space.worldFromLatLon(candidate.latitude, candidate.longitude, PLANET_RADIUS, scratchPoint);
      const dot = scratchPoint.normalize().dot(scratchDir);
      if (dot > nearestDot) {
        nearestDot = dot;
        nearest = candidate;
      }
      return dot > Math.cos(MAX_TARGET_ARC);
    });
    return reachable.length ? reachable[Math.floor(Math.random() * reachable.length)] : nearest;
  }

  const landers = Array.from({ length: LANDER_COUNT }, (_, i) => {
    const mesh = buildShip();
    mesh.visible = false;
    group.add(mesh);

    const burst = createBurst({ color: LANDER_GLOW });
    group.add(burst.group);

    const state = {
      mesh,
      burst,
      active: false,
      /** 0 at the entry point, 1 at the ground. */
      progress: 0,
      wait: i * STAGGER,
      name: '',
      health: LANDER_MAX_HEALTH,
      /** Counts down to its next shot. Randomised on every spawn so ships do not all open up
       *  the instant they appear, and so several ships in the air do not all reload in lockstep
       *  — the pool's own cooldown already caps their *combined* rate; this only staggers it. */
      fireCooldown: Math.random() * FIRE_INTERVAL,
      /** The two ends, as places on the ground: the world positions are derived from these
       *  every frame, so the approach turns with the planet instead of sliding over it. */
      siteLat: 0,
      siteLon: 0,
      entryLat: 0,
      entryLon: 0,
      position: new THREE.Vector3(),
      entry: new THREE.Vector3(),
      site: new THREE.Vector3(),
      target: null as unknown as BoltTarget
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
      }
    };

    return state;
  });

  type Lander = (typeof landers)[number];

  function spawn(lander: Lander, from: THREE.Vector3) {
    const target = pickTarget(from);
    lander.name = target.name;
    lander.health = LANDER_MAX_HEALTH;
    // A short random delay rather than zero: a ship should not open fire in the same frame it
    // appears, before there has been any chance to see it coming.
    lander.fireCooldown = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    lander.siteLat = target.latitude;
    lander.siteLon = target.longitude;

    // Where it comes in from: the same place, a random bearing and arc away. Done in degrees
    // rather than with a rotation, dividing the longitude by cos(latitude) so the step is the
    // same distance over the ground wherever it is taken. Crude near the poles, which is why
    // the latitude is clamped — this only decides which way the ship arrives from.
    const arc = THREE.MathUtils.radToDeg(
      APPROACH_MIN_ARC + Math.random() * (APPROACH_MAX_ARC - APPROACH_MIN_ARC)
    );
    const bearing = Math.random() * Math.PI * 2;
    lander.entryLat = THREE.MathUtils.clamp(target.latitude + arc * Math.cos(bearing), -85, 85);
    const spread = Math.max(Math.cos(THREE.MathUtils.degToRad(target.latitude)), 0.35);
    lander.entryLon = wrapLongitude(target.longitude + (arc * Math.sin(bearing)) / spread);

    place(lander);
    lander.position.copy(lander.entry);
    lander.progress = 0;
    lander.active = true;
    lander.mesh.visible = true;
  }

  /** Both ends of the approach, in world space, as they are *this* frame. */
  function place(lander: Lander) {
    space.worldFromLatLon(
      lander.entryLat,
      lander.entryLon,
      PLANET_RADIUS + ENTRY_ALTITUDE,
      lander.entry
    );
    space.worldFromLatLon(
      lander.siteLat,
      lander.siteLon,
      PLANET_RADIUS + TOUCHDOWN_ALTITUDE,
      lander.site
    );
  }

  return {
    group,
    all: landers,
    get downed() {
      return downed;
    },

    collect(into: BoltTarget[]) {
      for (const lander of landers) if (lander.active) into.push(lander.target);
    },

    update(dt: number, from: THREE.Vector3) {
      for (const lander of landers) {
        // Outside the active check: a burst outlives the ship that made it, and has to keep
        // running while the next one is waiting to appear.
        lander.burst.update(dt);

        if (!lander.active) {
          lander.wait -= dt;
          if (lander.wait <= 0) spawn(lander, from);
          continue;
        }

        lander.progress += dt / LANDING_TIME;
        if (lander.progress >= 1) {
          // Landed. That is the whole event: it is on the ground, so it is gone.
          lander.active = false;
          lander.mesh.visible = false;
          lander.wait = RESPAWN_MIN + Math.random() * (RESPAWN_MAX - RESPAWN_MIN);
          continue;
        }

        // Both ends are places on the ground, so they move as the planet turns and have to be
        // asked for again every frame. The ship then rides between them.
        place(lander);
        entryDir.copy(lander.entry).normalize();
        siteDir.copy(lander.site).normalize();

        // Straight in: the direction slides from entry to site while the altitude comes off.
        // `lerp` then `normalize` rather than a proper slerp — over the two-thirds of a radian
        // this covers, the two agree to well under the ship's own width.
        scratchDir.copy(entryDir).lerp(siteDir, lander.progress).normalize();
        lander.position
          .copy(scratchDir)
          .multiplyScalar(
            PLANET_RADIUS +
              ENTRY_ALTITUDE +
              (TOUCHDOWN_ALTITUDE - ENTRY_ALTITUDE) * lander.progress
          );

        // Upright, facing the way it is going. No spin and no bob: it is on approach.
        back.subVectors(lander.entry, lander.site).normalize();
        right.crossVectors(scratchDir, back);
        if (right.lengthSq() > 1e-6) {
          right.normalize();
          back.crossVectors(right, scratchDir).normalize();
          basis.makeBasis(right, scratchDir, back);
          lander.mesh.quaternion.setFromRotationMatrix(basis);
        }
        lander.mesh.position.copy(lander.position);

        // Return fire. Gated on distance as well as on the clock — a ship the aircraft has
        // flown well past should not keep sniping at it from beyond `FIRE_RANGE`.
        if (options.enemyBolts) {
          lander.fireCooldown -= dt;
          if (lander.fireCooldown <= 0) {
            fireDir.subVectors(from, lander.position);
            const distanceSq = fireDir.lengthSq();
            if (distanceSq < FIRE_RANGE * FIRE_RANGE) {
              fireDir.multiplyScalar(1 / Math.sqrt(distanceSq));
              if (options.enemyBolts.fire(lander.position, fireDir)) {
                lander.fireCooldown = FIRE_INTERVAL;
              } else {
                // The shared pool was on its own cooldown or full — try again shortly rather
                // than waiting out a whole interval on top of whatever that was.
                lander.fireCooldown = 0.2;
              }
            } else {
              // Out of range: no point spinning the cooldown down every frame for nothing: come
              // back and check again in a moment, in case the aircraft closes the distance.
              lander.fireCooldown = 0.5;
            }
          }
        }
      }
    },

    reset() {
      downed = 0;
      landers.forEach((lander, i) => {
        lander.active = false;
        lander.mesh.visible = false;
        lander.burst.group.visible = false;
        lander.progress = 0;
        lander.wait = i * STAGGER;
      });
    }
  };
}
