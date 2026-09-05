import * as THREE from 'three';
import { PLANET_RADIUS } from '../space';

/**
 * A fixed pool of bolts that fly straight, expire, and are checked against a list of targets as
 * they go. Originally the aircraft's own laser and nothing else; the landing ships' return fire
 * (`fly/landers.ts`) is a second instance of this same pool, tuned slower and sparser through
 * `BoltsOptions` rather than forked into a second file — a bolt does not care who fired it.
 *
 * Cheap on purpose. Nothing here allocates after construction — the meshes are made once and
 * parked out of sight, `fire()` wakes one up and a dead one is simply made invisible again —
 * and there is no physics beyond a position and a velocity. The bolts do not inherit their
 * shooter's own speed either, which is both what a laser would do and, at the aircraft's
 * cruise, most of the answer anyway.
 */

/** How many can be in the air at once. At `DEFAULT_INTERVAL` and `DEFAULT_LIFETIME` below,
 *  twelve is the most that can ever be live from one pool; the rest is headroom. */
const DEFAULT_POOL = 24;
/** Well over the aircraft's `MAX_SPEED` of 30 (and its boosted 120), or you could out-run your
 *  own fire. */
const DEFAULT_SPEED = 340;
/** Seconds a bolt lives — about 750 units of reach, twice the planet's radius. */
const DEFAULT_LIFETIME = 2.2;
/** Seconds between shots: six a second, so holding Space is a stream and not a wall. */
const DEFAULT_INTERVAL = 0.16;

const LENGTH = 5;
const THICKNESS = 0.22;
/** Warm and over 1.0, so the bloom pass turns each bolt into a light. Everything of the
 *  player's in this scene is warm; the alien half — the saucer, and now the landing ships'
 *  return fire — is cold green instead, which is `BoltsOptions.color`'s job to change. */
const DEFAULT_COLOR = new THREE.Color(3.4, 1.5, 0.45);

/** A box's own axis, which `setFromUnitVectors` turns onto the direction of travel. */
const BOX_AXIS = new THREE.Vector3(0, 0, 1);

interface Bolt {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export interface BoltTarget {
  /** Live vector — the pool reads it every frame, it does not copy it. */
  position: THREE.Vector3;
  radius: number;
  /** Called on the frame a bolt arrives. Must tolerate being called twice: two bolts can land
   *  in the same frame, and both will say so. */
  hit(): void;
}

export interface BoltsOptions {
  /** Cold green for the landing ships' return fire; defaults to the player's own warm colour.
   *  Must be authored the same way — over 1.0 — or it will not pick up the bloom pass. */
  color?: THREE.Color;
  /** How many can be live at once. */
  pool?: number;
  /** World units per second. */
  speed?: number;
  /** Seconds a bolt lives before it expires on its own. */
  lifetime?: number;
  /** Seconds between shots — the pool's own floor under how often `fire()` can succeed,
   *  independent of anything a caller does with several shooters sharing the one pool. */
  interval?: number;
}

export interface Bolts {
  /** Add this to the scene. */
  group: THREE.Group;
  /**
   * Fires one from `origin` along `direction` (which must be normalised), unless the gun is
   * still cooling down — the cadence lives here rather than in the caller, so holding the key
   * is all the caller has to know about.
   */
  fire(origin: THREE.Vector3, direction: THREE.Vector3): boolean;
  /**
   * Advances every live bolt and tests it against each target, calling `hit()` on the first one
   * a given bolt reaches. The caller passes a list because there is more than one thing in the
   * sky; it is walked per bolt, which at a couple of dozen bolts and a handful of targets is
   * cheaper than any structure that would avoid it.
   */
  update(dt: number, targets: readonly BoltTarget[]): void;
  /** Puts every bolt away — for a reset, or for parking the view. */
  clear(): void;
}

export function createBolts(options: BoltsOptions = {}): Bolts {
  const POOL = options.pool ?? DEFAULT_POOL;
  const SPEED = options.speed ?? DEFAULT_SPEED;
  const LIFETIME = options.lifetime ?? DEFAULT_LIFETIME;
  const INTERVAL = options.interval ?? DEFAULT_INTERVAL;

  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(THICKNESS, THICKNESS, LENGTH);
  const material = new THREE.MeshBasicMaterial({ color: options.color ?? DEFAULT_COLOR });

  const bolts: Bolt[] = [];
  for (let i = 0; i < POOL; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    group.add(mesh);
    bolts.push({ mesh, velocity: new THREE.Vector3(), life: 0 });
  }

  const from = new THREE.Vector3();
  const segment = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const closest = new THREE.Vector3();
  let cooldown = 0;

  /**
   * Did the bolt pass within `radius` of the target on its way from `from` to where it is now?
   *
   * Asked as a *segment*, not as a point: a bolt covers about six units per frame at 60 fps and
   * more on a slow one, against a target eleven across, so a point test would let it through
   * the middle of the saucer often enough to feel broken.
   */
  function swept(now: THREE.Vector3, target: BoltTarget): boolean {
    segment.subVectors(now, from);
    toTarget.subVectors(target.position, from);
    const lengthSq = segment.lengthSq();
    const t = lengthSq > 0 ? THREE.MathUtils.clamp(toTarget.dot(segment) / lengthSq, 0, 1) : 0;
    closest.copy(from).addScaledVector(segment, t);
    return closest.distanceToSquared(target.position) <= target.radius * target.radius;
  }

  return {
    group,

    fire(origin: THREE.Vector3, direction: THREE.Vector3) {
      if (cooldown > 0) return false;
      const bolt = bolts.find((b) => b.life <= 0);
      if (!bolt) return false;
      bolt.mesh.position.copy(origin);
      bolt.mesh.quaternion.setFromUnitVectors(BOX_AXIS, direction);
      bolt.mesh.visible = true;
      bolt.velocity.copy(direction).multiplyScalar(SPEED);
      bolt.life = LIFETIME;
      cooldown = INTERVAL;
      return true;
    },

    update(dt: number, targets: readonly BoltTarget[]) {
      cooldown -= dt;
      for (const bolt of bolts) {
        if (bolt.life <= 0) continue;
        from.copy(bolt.mesh.position);
        bolt.mesh.position.addScaledVector(bolt.velocity, dt);
        bolt.life -= dt;

        for (const target of targets) {
          if (!swept(bolt.mesh.position, target)) continue;
          target.hit();
          bolt.life = 0;
          break;
        }
        // Into the ground. There is no ground, but there is a planet.
        if (bolt.life > 0 && bolt.mesh.position.lengthSq() < PLANET_RADIUS * PLANET_RADIUS) {
          bolt.life = 0;
        }

        if (bolt.life <= 0) bolt.mesh.visible = false;
      }
    },

    clear() {
      for (const bolt of bolts) {
        bolt.life = 0;
        bolt.mesh.visible = false;
      }
      cooldown = 0;
    }
  };
}
