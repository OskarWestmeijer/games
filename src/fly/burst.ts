import * as THREE from 'three';

/**
 * A one-shot explosion: an additive shell that expands and fades, with a handful of shards
 * thrown out of it. Originally a landing ship's own kill effect and nothing else; extracted here
 * once the aircraft's own destruction needed the same shape of thing in a different colour and
 * at a different scale, rather than forking a second copy of it.
 *
 * Built once and parked invisible — a kill, or a death, is not a moment to be allocating.
 */

export interface BurstOptions {
  /** Required rather than defaulted: a burst with nobody's colour on it is a mistake waiting to
   *  be made, not a sensible default. Must be authored over 1.0, like every other bloom-picked
   *  colour in this scene, or the shell will not read as a flash. */
  color: THREE.Color;
  /** Seconds from `fire()` to fully faded. */
  time?: number;
  /** How far the shell expands to, in world units, on top of its start radius of 2. */
  radius?: number;
  shardCount?: number;
  shardSpeedMin?: number;
  shardSpeedMax?: number;
  /** Half-extent of each shard's tetrahedron. */
  shardSize?: number;
  /** How much of its speed a shard keeps per second. Enough of a slow-down that the burst reads
   *  as thrown outwards and settling, rather than as a sphere of dots leaving at constant rate. */
  shardDrag?: number;
}

export interface Burst {
  /** Add this to the scene. */
  group: THREE.Group;
  /** Sets it off, in world space. */
  fire(at: THREE.Vector3): void;
  /** Runs it out. Cheap and safe to call while it is not running. */
  update(dt: number): void;
}

const DEFAULT_TIME = 1.1;
const DEFAULT_RADIUS = 26;
const DEFAULT_SHARD_COUNT = 14;
const DEFAULT_SHARD_SPEED_MIN = 16;
const DEFAULT_SHARD_SPEED_MAX = 40;
const DEFAULT_SHARD_SIZE = 1.1;
const DEFAULT_SHARD_DRAG = 0.35;

export function createBurst(options: BurstOptions): Burst {
  const TIME = options.time ?? DEFAULT_TIME;
  const RADIUS = options.radius ?? DEFAULT_RADIUS;
  const SHARD_COUNT = options.shardCount ?? DEFAULT_SHARD_COUNT;
  const SHARD_SPEED_MIN = options.shardSpeedMin ?? DEFAULT_SHARD_SPEED_MIN;
  const SHARD_SPEED_MAX = options.shardSpeedMax ?? DEFAULT_SHARD_SPEED_MAX;
  const SHARD_SIZE = options.shardSize ?? DEFAULT_SHARD_SIZE;
  const SHARD_DRAG = options.shardDrag ?? DEFAULT_SHARD_DRAG;

  const group = new THREE.Group();
  group.visible = false;

  const shellMaterial = new THREE.MeshBasicMaterial({
    color: options.color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), shellMaterial);
  group.add(shell);

  // One geometry and one material across every shard: they all fade together anyway.
  const shardGeometry = new THREE.TetrahedronGeometry(SHARD_SIZE);
  const shardMaterial = new THREE.MeshBasicMaterial({ color: options.color, transparent: true });
  const shards = Array.from({ length: SHARD_COUNT }, () => {
    const mesh = new THREE.Mesh(shardGeometry, shardMaterial);
    group.add(mesh);
    return { mesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3() };
  });

  let age = 0;

  return {
    group,

    fire(at: THREE.Vector3) {
      group.position.copy(at);
      group.visible = true;
      age = 0;

      shell.scale.setScalar(2);
      shellMaterial.opacity = 0.9;
      shardMaterial.opacity = 1;

      for (const shard of shards) {
        // A direction off the unit sphere, taken by rejection: a cube's corners would bunch
        // the shards along the diagonals, which at a dozen or more of them you can see.
        do {
          shard.velocity.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        } while (shard.velocity.lengthSq() < 1e-4 || shard.velocity.lengthSq() > 0.25);
        shard.velocity
          .normalize()
          .multiplyScalar(SHARD_SPEED_MIN + Math.random() * (SHARD_SPEED_MAX - SHARD_SPEED_MIN));
        shard.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14);
        shard.mesh.position.set(0, 0, 0);
        shard.mesh.rotation.set(0, 0, 0);
      }
    },

    update(dt: number) {
      if (!group.visible) return;
      age += dt;
      const t = age / TIME;
      if (t >= 1) {
        group.visible = false;
        return;
      }

      shell.scale.setScalar(2 + t * RADIUS);
      // Squared, so the flash is bright for a moment and then out of the way of the shards.
      shellMaterial.opacity = 0.9 * (1 - t) * (1 - t);

      const keep = Math.pow(SHARD_DRAG, dt);
      shardMaterial.opacity = 1 - t;
      for (const shard of shards) {
        shard.mesh.position.addScaledVector(shard.velocity, dt);
        shard.velocity.multiplyScalar(keep);
        shard.mesh.rotation.x += shard.spin.x * dt;
        shard.mesh.rotation.y += shard.spin.y * dt;
        shard.mesh.rotation.z += shard.spin.z * dt;
        shard.mesh.scale.setScalar(1 - t * 0.5);
      }
    }
  };
}
