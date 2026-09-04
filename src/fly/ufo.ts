import * as THREE from 'three';
import { PLANET_RADIUS } from '../space';

/**
 * The one thing in the flight view that is not scenery: a saucer, drifting slowly somewhere
 * over the planet, marked on the minimap so that finding it is a matter of flying there rather
 * than of luck.
 *
 * **It is unarmed, on purpose.** No weapon, no aggression, and no knowledge of where the
 * aircraft is beyond the point it was told to spawn away from: it wanders, and it can be shot
 * down. If it is ever given a gun this is the file, and `update()` is where it would have to
 * start caring where the player is.
 *
 * There is no score and no timer. Shoot it and it pops; a few seconds later there is another
 * one somewhere else on the map. It is deliberately a *sight* rather than an objective.
 */

/** Half the width of the saucer. */
const RADIUS = 8;
/** How close a bolt has to pass to count. Generously larger than the hull — aiming a chase
 *  camera at something two hundred units away is hard enough on its own. */
const HIT_RADIUS = 11;

/**
 * How fast it drifts. Slow — under the aircraft's own `MIN_SPEED` of 12 — so it can always be
 * caught, and slow enough that the minimap contact reads as a place to go rather than as a
 * chase.
 */
const SPEED = 8;
/** How hard it wanders off a great circle: a lazy S, not a search pattern. */
const WANDER_RATE = 0.09;
const WANDER_PERIOD = 11;
/** A slow rise and fall about its spawn altitude. A saucer that holds station to the metre
 *  looks like it is on rails. */
const BOB_AMPLITUDE = 2.5;
const BOB_PERIOD = 9;
/** The light ring turns and the hull does not — a saucer is read by its lights going round. */
const SPIN_RATE = 0.9;
/** …and it leans into its own direction of travel, which is how a disc says it is moving. */
const LEAN = 0.12;

/**
 * Where a new one appears: a random bearing and a random distance from a given point — the
 * aircraft — rather than a random point on the globe. The band is what makes it a contact
 * instead of either a jump scare or a needle in a haystack. 1.0 rad of arc is about seven
 * seconds away at cruise; 2.4 is most of the way to the far side of the planet.
 */
const SPAWN_MIN_ARC = 1.0;
const SPAWN_MAX_ARC = 2.4;
/** Its altitude band, kept inside the aircraft's own so it can always be reached without
 *  diving into the atmosphere shell or climbing out of the neighbourhood. */
const MIN_ALTITUDE = 45;
const MAX_ALTITUDE = 130;

/** Seconds between one being shot down and the next turning up. */
const RESPAWN_DELAY = 6;
/** The pop: an additive shell that expands and fades. No debris, no sound, no score popup. */
const FLASH_TIME = 0.7;
const FLASH_RADIUS = 34;

/**
 * Cold, and authored over 1.0 so the bloom pass turns it into a light — the same trick as the
 * aircraft's nav lights and the station's LED strips. Green because everything of the player's
 * in this scene is warm, and the contrast is most of what makes it read as alien.
 */
const GLOW = new THREE.Color(0.3, 2.9, 1.7);

/** The hull, its dome, the ring of lights that turns, and the belly light. Built at the origin
 *  facing -Z, so the caller only has to place it. */
function buildSaucer(): { saucer: THREE.Group; ring: THREE.Group } {
  const saucer = new THREE.Group();

  // A lathe rather than two flattened spheres: the profile *is* the shape, and it takes ten
  // points to say "lens, with a slight dome to it" exactly.
  const hull = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [0.0, 0.55],
        [1.6, 0.52],
        [3.4, 0.42],
        [5.6, 0.26],
        [7.2, 0.12],
        [RADIUS, 0.0],
        [7.0, -0.22],
        [5.0, -0.5],
        [2.6, -0.78],
        [0.0, -0.95]
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      56
    ),
    new THREE.MeshStandardMaterial({ color: 0xb4bdc7, roughness: 0.28, metalness: 0.8 })
  );
  saucer.add(hull);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0c1a1c, roughness: 0.1, metalness: 0.9 })
  );
  dome.position.y = 0.45;
  saucer.add(dome);

  // The lights are the only part that turns, and they are their own group for that reason: the
  // hull has to keep its lean while they go round.
  const ring = new THREE.Group();
  const lampGeometry = new THREE.SphereGeometry(0.42, 10, 8);
  const lampMaterial = new THREE.MeshBasicMaterial({ color: GLOW });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
    lamp.position.set(Math.cos(angle) * 6.2, -0.42, Math.sin(angle) * 6.2);
    ring.add(lamp);
  }
  saucer.add(ring);

  // The belly light. `rotation.x = π/2` turns a circle that faces +Z into one that faces -Y.
  const belly = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 32),
    new THREE.MeshBasicMaterial({
      color: GLOW,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    })
  );
  belly.rotation.x = Math.PI / 2;
  belly.position.y = -1.02;
  saucer.add(belly);

  return { saucer, ring };
}

export interface Ufo {
  /** Add this to the scene. The saucer and its death flash live inside it, in world space. */
  group: THREE.Group;
  /** The saucer's world position — the live vector, not a copy. Meaningless while dead. */
  position: THREE.Vector3;
  /** How close a bolt has to pass to bring it down. */
  hitRadius: number;
  readonly alive: boolean;
  /** Puts one in the sky at a random bearing and distance from `from`. */
  spawn(from: THREE.Vector3): void;
  /**
   * Drift, bob and spin — or, while dead, run the flash out and count down to the next one.
   * `from` is only read on the frame it respawns, and is the aircraft: a new saucer belongs a
   * flight away from wherever the player now is, not from wherever the last one died.
   */
  update(dt: number, from: THREE.Vector3): void;
  /** Shoots it down. False if there was nothing there — so two bolts in one frame cannot pop
   *  the same saucer twice. */
  hit(): boolean;
}

export function createUfo(): Ufo {
  const group = new THREE.Group();
  const { saucer, ring } = buildSaucer();
  saucer.visible = false;
  group.add(saucer);

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshBasicMaterial({
      color: GLOW,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  flash.visible = false;
  group.add(flash);

  const position = new THREE.Vector3(0, PLANET_RADIUS + MIN_ALTITUDE, 0);
  const heading = new THREE.Vector3(1, 0, 0);
  const radialUp = new THREE.Vector3();
  const east = new THREE.Vector3();
  const north = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const back = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  let alive = false;
  let baseRadius = PLANET_RADIUS + MIN_ALTITUDE;
  let age = 0;
  let respawnIn = 0;
  let flashAge = 0;

  function spawn(from: THREE.Vector3) {
    // `from` may be `position` itself; it is read into `radialUp` before anything is written.
    radialUp.copy(from).normalize();
    // Any vector that is not the local vertical gives a horizon to measure a bearing against.
    east.set(0, 1, 0);
    if (Math.abs(east.dot(radialUp)) > 0.9) east.set(1, 0, 0);
    east.crossVectors(radialUp, east).normalize();
    north.crossVectors(east, radialUp).normalize();

    const bearing = Math.random() * Math.PI * 2;
    const arc = SPAWN_MIN_ARC + Math.random() * (SPAWN_MAX_ARC - SPAWN_MIN_ARC);
    // Turning the local vertical about a horizontal axis *is* travelling that arc along the
    // surface, which is what makes "somewhere over there" mean what it says on a sphere.
    axis.copy(east).multiplyScalar(Math.cos(bearing)).addScaledVector(north, Math.sin(bearing));
    baseRadius = PLANET_RADIUS + MIN_ALTITUDE + Math.random() * (MAX_ALTITUDE - MIN_ALTITUDE);
    position.copy(radialUp).applyAxisAngle(axis, arc).multiplyScalar(baseRadius);

    // A random tangent to set off along: any vector at all, with its radial part taken out.
    radialUp.copy(position).normalize();
    do {
      heading.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      heading.addScaledVector(radialUp, -heading.dot(radialUp));
    } while (heading.lengthSq() < 1e-4);
    heading.normalize();

    age = 0;
    alive = true;
    saucer.visible = true;
  }

  return {
    group,
    position,
    hitRadius: HIT_RADIUS,
    get alive() {
      return alive;
    },
    spawn,

    update(dt: number, from: THREE.Vector3) {
      if (flash.visible) {
        flashAge += dt;
        const t = flashAge / FLASH_TIME;
        if (t >= 1) {
          flash.visible = false;
        } else {
          flash.scale.setScalar(2 + t * FLASH_RADIUS);
          // Squared, so it is bright for a moment and then gone rather than lingering.
          (flash.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t) * (1 - t);
        }
      }

      if (!alive) {
        respawnIn -= dt;
        if (respawnIn <= 0) spawn(from);
        return;
      }

      age += dt;
      radialUp.copy(position).normalize();

      // Wander: turn about the local vertical at a rate that swings slowly through zero.
      heading.applyAxisAngle(
        radialUp,
        Math.sin((age / WANDER_PERIOD) * Math.PI * 2) * WANDER_RATE * dt
      );
      // Held tangent, or rounding walks the heading off the tangent plane over a long drift.
      heading.addScaledVector(radialUp, -heading.dot(radialUp)).normalize();

      position.addScaledVector(heading, SPEED * dt);
      // "Level" round a sphere is a radius, not a direction: set the length rather than
      // integrate a pitch, and the bob comes free on top of it.
      position.setLength(baseRadius + Math.sin((age / BOB_PERIOD) * Math.PI * 2) * BOB_AMPLITUDE);

      radialUp.copy(position).normalize();
      // Its own frame: +Y the local vertical, +Z *behind* it — the nose-down-(-Z) convention
      // the aircraft and three's cameras both use. x = y × z keeps the basis right-handed.
      back.copy(heading).negate();
      right.crossVectors(radialUp, back);
      basis.makeBasis(right, radialUp, back);
      saucer.position.copy(position);
      saucer.quaternion.setFromRotationMatrix(basis);
      saucer.rotateX(-LEAN);
      ring.rotation.y += SPIN_RATE * dt;
    },

    hit() {
      if (!alive) return false;
      alive = false;
      saucer.visible = false;
      flash.position.copy(position);
      flash.scale.setScalar(2);
      flash.visible = true;
      flashAge = 0;
      respawnIn = RESPAWN_DELAY;
      return true;
    }
  };
}
