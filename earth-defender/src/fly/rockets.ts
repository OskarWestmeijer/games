import * as THREE from 'three';
import { PLANET_RADIUS } from '../space';
import type { BoltTarget } from './bolts';
import { createBurst } from './burst';

/**
 * The aeroplane's second weapon: a small pool of guided rockets, fired one at a time at whatever
 * the gun is locked on (`takeAim()` in `fly-view.ts`).
 *
 * **A rocket is the laser's opposite in every way that matters.** The laser is instant, endless
 * to look at, six a second, and takes twelve of them to bring a bomber down; a rocket is slow
 * enough to watch, there are four of them, and two end a bomber. That is the whole reason it
 * exists: the laser makes every fight the same two seconds of held fire, and a weapon you have
 * *four* of is a decision — spend one here, or keep it for the ship with fifteen seconds left on
 * its clock.
 *
 * **It is guided, and it has to be.** An unguided rocket at this speed against a ship crossing
 * your nose is a coin toss, and a coin toss is a terrible thing to spend one of four shots on.
 * It steers at `TURN_RATE` towards the target it was fired at, which is fast enough to run down
 * anything in this scene from behind and slow enough to be thrown off by a target that is
 * genuinely off to one side — so the lock still has to be a lock, and a rocket fired at nothing
 * in particular simply flies straight until it expires.
 *
 * The target is held as the `BoltTarget` it was fired at, whose `position` is a live vector, so
 * a rocket chases the ship rather than the point the ship was at. `hit()` tolerates being called
 * repeatedly (it has to — two bolts can land in one frame), which is what lets one rocket be
 * worth `DAMAGE` hits without anything here knowing what a bomber's health is.
 */

/** How many can be in the air at once. Ammunition is what limits this in practice — see
 *  `ROCKET_AMMO` in `fly-view.ts` — so the pool is only ever "enough". */
const POOL = 6;
/**
 * World units per second. Faster than anything it chases (a boosted aeroplane does 120) but a
 * long way under a bolt's 340: a rocket you can watch cross the gap is the point of it, and it
 * is also what makes the guidance visible rather than academic.
 */
const SPEED = 150;
/** Seconds before it gives up and fades — about 900 units of reach at `SPEED`, well past
 *  `LOCK_RANGE`, so a rocket never expires on a target it was actually going to catch. */
const LIFETIME = 6;
/** How hard it can turn, in radians a second. See the header: enough to chase, not enough to
 *  make aiming irrelevant. */
const TURN_RATE = 1.9;
/** How close to its target it has to get to go off. Generous — the bombers' own hit radius is 9,
 *  and a proximity fuse is what a rocket has instead of a direct hit. */
const PROXIMITY = 11;
/**
 * How many of the laser's hits one rocket is worth. Two rockets bring a bomber down (12 health),
 * which is the number this is chosen for: a full load of four is two kills, and half a load is
 * one. Applied as repeated `hit()` calls rather than as a damage number, because `BoltTarget` is
 * a "something arrived" interface and every user of it already tolerates being called twice.
 */
export const ROCKET_DAMAGE = 6;

/** Warm, over 1.0 for the bloom, and the same family as the laser: this is ours. */
const BODY_COLOR = new THREE.Color(3.2, 1.2, 0.35);
const FLAME_COLOR = new THREE.Color(3.4, 2.0, 0.8);

const LENGTH = 3.2;
const THICKNESS = 0.55;

/** A box's own axis, which `setFromUnitVectors` turns onto the direction of travel. */
const BOX_AXIS = new THREE.Vector3(0, 0, 1);

interface Rocket {
  mesh: THREE.Mesh;
  direction: THREE.Vector3;
  target: BoltTarget | null;
  life: number;
}

export interface Rockets {
  /** Add this to the scene. */
  group: THREE.Group;
  /**
   * Sends one from `origin` along `direction`, chasing `target` if there is one. Returns false
   * if the pool is empty — the caller owns the ammunition, and the cadence, which is the one
   * way this differs from `fly/bolts.ts`: there is nothing to hold down here.
   */
  fire(origin: THREE.Vector3, direction: THREE.Vector3, target: BoltTarget | null): boolean;
  /**
   * Steers and advances every live rocket, sets off the ones that arrive, and runs the bursts.
   * `targets` is everything shootable, so a rocket that flies through a ship it was not aimed
   * at still goes off on it.
   */
  update(dt: number, targets: readonly BoltTarget[]): void;
  /** Puts every rocket away — for a reset, or for parking the view. */
  clear(): void;
}

export function createRockets(): Rockets {
  const group = new THREE.Group();

  const body = new THREE.BoxGeometry(THICKNESS, THICKNESS, LENGTH);
  const flame = new THREE.BoxGeometry(THICKNESS * 0.7, THICKNESS * 0.7, LENGTH * 0.8);
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: BODY_COLOR });
  const flameMaterial = new THREE.MeshBasicMaterial({ color: FLAME_COLOR });

  const rockets: Rocket[] = [];
  for (let i = 0; i < POOL; i++) {
    const mesh = new THREE.Mesh(body, bodyMaterial);
    // The motor, hung off the tail (+Z is behind, since -Z is the way it goes). Small, bright
    // and part of the mesh rather than a second thing to move.
    const motor = new THREE.Mesh(flame, flameMaterial);
    motor.position.z = LENGTH * 0.85;
    mesh.add(motor);
    mesh.visible = false;
    group.add(mesh);
    rockets.push({ mesh, direction: new THREE.Vector3(), target: null, life: 0 });
  }

  /**
   * One burst per rocket in the pool, so two going off together are two explosions. Smaller and
   * shorter than a bomber's own death — this is the weapon arriving, not the ship ending; the
   * ship's own burst still fires on top of it when the last of its health goes.
   */
  const bursts = rockets.map(() => {
    const burst = createBurst({ color: FLAME_COLOR, time: 0.55, radius: 15, shardCount: 9 });
    group.add(burst.group);
    return burst;
  });

  const from = new THREE.Vector3();
  const wanted = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const segment = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const spin = new THREE.Quaternion();

  /** The same swept question `fly/bolts.ts` asks, and for the same reason: a rocket covers 2.5
   *  units a frame at 60 fps and ten times that on a slow one. */
  function swept(now: THREE.Vector3, target: BoltTarget, radius: number): boolean {
    segment.subVectors(now, from);
    toTarget.subVectors(target.position, from);
    const lengthSq = segment.lengthSq();
    const t = lengthSq > 0 ? THREE.MathUtils.clamp(toTarget.dot(segment) / lengthSq, 0, 1) : 0;
    closest.copy(from).addScaledVector(segment, t);
    return closest.distanceToSquared(target.position) <= radius * radius;
  }

  function detonate(rocket: Rocket, index: number, target: BoltTarget | null) {
    bursts[index].fire(rocket.mesh.position);
    rocket.life = 0;
    rocket.target = null;
    rocket.mesh.visible = false;
    if (!target) return;
    for (let i = 0; i < ROCKET_DAMAGE; i++) target.hit();
  }

  return {
    group,

    fire(origin: THREE.Vector3, direction: THREE.Vector3, target: BoltTarget | null) {
      const rocket = rockets.find((r) => r.life <= 0);
      if (!rocket) return false;
      rocket.mesh.position.copy(origin);
      rocket.direction.copy(direction).normalize();
      rocket.mesh.quaternion.setFromUnitVectors(BOX_AXIS, rocket.direction);
      rocket.mesh.visible = true;
      rocket.target = target;
      rocket.life = LIFETIME;
      return true;
    },

    update(dt: number, targets: readonly BoltTarget[]) {
      rockets.forEach((rocket, index) => {
        // Outside the live check, exactly like a bomber's own burst: the explosion outlives the
        // rocket that made it, and has to keep running while that slot is empty.
        bursts[index].update(dt);
        if (rocket.life <= 0) return;

        // Steering, before the move: turn the heading towards the target by at most
        // `TURN_RATE * dt`, about the axis between the two, which is the shortest way round and
        // costs one cross product. A rocket with no target simply keeps its heading.
        if (rocket.target) {
          wanted.subVectors(rocket.target.position, rocket.mesh.position);
          if (wanted.lengthSq() > 1e-6) {
            wanted.normalize();
            axis.crossVectors(rocket.direction, wanted);
            if (axis.lengthSq() > 1e-9) {
              axis.normalize();
              const angle = Math.acos(THREE.MathUtils.clamp(rocket.direction.dot(wanted), -1, 1));
              rocket.direction
                .applyQuaternion(spin.setFromAxisAngle(axis, Math.min(angle, TURN_RATE * dt)))
                .normalize();
            }
          }
          rocket.mesh.quaternion.setFromUnitVectors(BOX_AXIS, rocket.direction);
        }

        from.copy(rocket.mesh.position);
        rocket.mesh.position.addScaledVector(rocket.direction, SPEED * dt);
        rocket.life -= dt;

        // Its own target first, on a proximity fuse; then anything else it happened to fly
        // through, on that thing's own radius.
        if (rocket.target && swept(rocket.mesh.position, rocket.target, PROXIMITY)) {
          detonate(rocket, index, rocket.target);
          return;
        }
        for (const target of targets) {
          if (target === rocket.target || !swept(rocket.mesh.position, target, target.radius)) {
            continue;
          }
          detonate(rocket, index, target);
          return;
        }

        // Into the ground, or out of time. Both end it quietly: a rocket that hit nothing is a
        // rocket you wasted, and telling you so twice would be unkind.
        if (rocket.mesh.position.lengthSq() < PLANET_RADIUS * PLANET_RADIUS) rocket.life = 0;
        if (rocket.life <= 0) {
          rocket.mesh.visible = false;
          rocket.target = null;
        }
      });
    },

    clear() {
      for (const rocket of rockets) {
        rocket.life = 0;
        rocket.target = null;
        rocket.mesh.visible = false;
      }
    }
  };
}
