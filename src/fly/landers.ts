import * as THREE from 'three';
import { PLANET_RADIUS } from '../space';
import type { Space } from '../space';
import type { BoltTarget } from './bolts';
import { LAND_TARGETS } from './places';

/**
 * Alien landing ships: they appear high up, descend along a straight approach to a point on the
 * surface, and are gone the moment they touch it. Forty seconds from appearing to landing —
 * which is the whole of the game in them. Shoot one down before it gets there or it lands, and
 * either way there is nothing left of it.
 *
 * Deliberately plain. No animation, no landing sequence, no explosion, no score for stopping
 * one and no penalty for missing: a ship is a marker on the map with a deadline on it, and the
 * flight *to* it is the thing worth having. `fly/ufo.ts` is the same idea without the clock.
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
const GLOW = new THREE.Color(0.3, 2.9, 1.7);

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
    new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
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

export function createLanders(space: Space): Landers {
  const group = new THREE.Group();

  const scratchDir = new THREE.Vector3();
  const scratchPoint = new THREE.Vector3();
  const entryDir = new THREE.Vector3();
  const siteDir = new THREE.Vector3();
  const back = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();

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

    const state = {
      mesh,
      active: false,
      /** 0 at the entry point, 1 at the ground. */
      progress: 0,
      wait: i * STAGGER,
      name: '',
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
        if (!state.active) return;
        // Shot down: it simply goes. No debris and no flash — see the note at the top.
        state.active = false;
        state.mesh.visible = false;
        state.wait = RESPAWN_MIN + Math.random() * (RESPAWN_MAX - RESPAWN_MIN);
      }
    };

    return state;
  });

  type Lander = (typeof landers)[number];

  function spawn(lander: Lander, from: THREE.Vector3) {
    const target = pickTarget(from);
    lander.name = target.name;
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

    collect(into: BoltTarget[]) {
      for (const lander of landers) if (lander.active) into.push(lander.target);
    },

    update(dt: number, from: THREE.Vector3) {
      for (const lander of landers) {
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
      }
    },

    reset() {
      landers.forEach((lander, i) => {
        lander.active = false;
        lander.mesh.visible = false;
        lander.progress = 0;
        lander.wait = i * STAGGER;
      });
    }
  };
}
