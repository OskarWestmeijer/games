import * as THREE from 'three';

/**
 * Repair packs: what a bomber leaves behind when you shoot it down. One falls out of the
 * wreck, drifts down for ten seconds, and is gone — collected if you were close enough behind
 * your own shot to fly through it, and simply gone if you were not.
 *
 * **There was nothing to repair for a while, and this file said so.** The saucer stayed unarmed
 * (still is — see `fly/ufo.ts`), and there was no ground to hit, so a pack was a *reason to fly
 * at the wreck* rather than a resource, and the honest state of `Packs.taken` was a number
 * waiting for a use. Now a bomber shoots back on the way down, so it has one: a pack
 * healed by `PACK_HEAL_AMOUNT` in `fly-view.ts` is what patches that back up. The ten seconds
 * did not change — they are still short enough that taking one means committing to the kill
 * before you have made it.
 *
 * **They are not scored.** See the "no score, no timers, no objectives" line in CLAUDE.md: the
 * count exists so the view can say a word when you take one, not so it can keep a tally at you.
 *
 * Warm, like everything of ours here. The pack is deliberately smaller and quieter than the
 * boost rings — it is a thing to notice for ten seconds, not scenery.
 *
 * **Inside `MAGNET_RANGE` it stops sinking and comes to you instead, slow at first and then
 * fast.** A pack that only ever drifts downward is easy to lose the moment you break off to
 * finish the fight rather than babysit the wreck — the magnet is what makes "come back for it in
 * a few seconds" actually work. It ramps in over `MAGNET_RAMP_TIME` rather than snapping to full
 * speed, which is what makes it read as *pulled* rather than as teleporting: the first instant
 * inside range looks like nothing has changed, and then it visibly picks up. A thin tether
 * between the pack and the aircraft is the only sign the magnet is live at all — there is no
 * other feedback for a mechanic that is otherwise silent until the pack simply arrives.
 */

/** How many can be in the air at once: one per bomber, since one ship leaves one pack. */
const POOL = 4;

/** Seconds from the drop to it going, whether or not anyone came for it. */
export const PACK_LIFETIME = 10;
/** …of which the last stretch is spent fading, so it is clear it is on its way out. */
const FADE_TIME = 2.5;

/** How fast it sinks towards the planet. Slow — it is drifting, not falling; there is no
 *  gravity in this view and inventing one for a crate would be the first. */
const SINK_RATE = 5;
/** It turns as it goes, which is what says it is loose rather than parked. */
const TUMBLE_RATE = 0.9;

/** How close the aeroplane has to pass. Generous, like the laser's own hit radius and for the
 *  same reason: judging a gap in a chase camera at 24 units per second is hard enough. */
const PICKUP_RADIUS = 9;

/**
 * How close the aircraft has to be before a pack starts coming to it. Comfortably past
 * `PICKUP_RADIUS`, or the magnet would only ever cover the last instant of an approach you had
 * already finished — the point of it is to close a gap you have not quite closed yourself.
 */
const MAGNET_RANGE = 40;
/** How fast a fully "spun up" pull is, in world units a second — faster than the aircraft's own
 *  cruise (24), so a pack can catch up even if you are easing away from it. */
const MAGNET_MAX_SPEED = 50;
/** Seconds from entering range to full pull speed. The ramp, not the top speed, is what makes it
 *  read as a magnet rather than a snap: slow at first, then fast. */
const MAGNET_RAMP_TIME = 1.2;
/** The tether's own thickness. Thin — it is confirmation the magnet is live, not a laser bolt. */
const TETHER_THICKNESS = 0.28;
/** A box's own axis, which `setFromUnitVectors` turns onto the direction to the aircraft — the
 *  same trick `fly/bolts.ts` uses to aim its own boxes. */
const TETHER_AXIS = new THREE.Vector3(0, 0, 1);

/** The crate, and the cross on it. Over 1.0 on the cross alone, so what blooms is a marker and
 *  not a box. */
const CRATE_COLOR = 0x9a8a74;
export const PACK_GLOW = new THREE.Color(1.6, 1.05, 0.45);

export interface Packs {
  /** Add this to the scene. */
  group: THREE.Group;
  /** How many have been flown through. Nothing depends on it yet — see the header. */
  readonly taken: number;
  /** Leaves one at `at`. Silently does nothing if the pool is full, which needs four kills
   *  inside ten seconds and costs nothing to tolerate. */
  drop(at: THREE.Vector3): void;
  /**
   * Sinks and turns everything live, expires what has run out of time, and answers **how many
   * packs the aeroplane collected this frame**. `previous` and `current` are the ends of the
   * segment it flew — swept, like the rings' test and the laser's, because at speed a crate 9
   * units across sits between two frames.
   */
  update(dt: number, previous: THREE.Vector3, current: THREE.Vector3): number;
  /** Clears the sky of them. */
  clear(): void;
}

// Shared across every pack — a torus of crates and crosses would be wasteful when the shape
// never varies, only the material's opacity.
const crateGeometry = new THREE.BoxGeometry(2.6, 2.6, 2.6);
const barGeometry = new THREE.BoxGeometry(2.9, 0.55, 0.55);

export interface PackMesh {
  mesh: THREE.Group;
  crateMaterial: THREE.MeshStandardMaterial;
  crossMaterial: THREE.MeshBasicMaterial;
}

/**
 * One pack's worth of geometry: the crate and the cross on it. Its own pair of materials, not
 * shared, so each pack's opacity can be driven independently as it fades on its own ten-second
 * clock. Split out of `createPacks()` on its own rather than inlined in the pool below, which is
 * where it stood for a while — a boost ring hung a scaled-up, tumbling copy of this in its own
 * middle for a stretch, and though that was pulled (see `fly/rings.ts`'s own header), keeping
 * this as one function rather than folding it back is still the tidier shape for the file.
 */
export function buildPackMesh(): PackMesh {
  const crateMaterial = new THREE.MeshStandardMaterial({
    color: CRATE_COLOR,
    roughness: 0.5,
    metalness: 0.4,
    transparent: true
  });
  const crossMaterial = new THREE.MeshBasicMaterial({ color: PACK_GLOW, transparent: true });

  const mesh = new THREE.Group();
  mesh.add(new THREE.Mesh(crateGeometry, crateMaterial));
  // A cross, which is the one shape that says "medical" without a texture: two bars through
  // the crate, so it reads from every side.
  const across = new THREE.Mesh(barGeometry, crossMaterial);
  const upright = new THREE.Mesh(barGeometry, crossMaterial);
  upright.rotation.z = Math.PI / 2;
  const through = new THREE.Mesh(barGeometry, crossMaterial);
  through.rotation.y = Math.PI / 2;
  mesh.add(across, upright, through);

  return { mesh, crateMaterial, crossMaterial };
}

export function createPacks(): Packs {
  const group = new THREE.Group();

  const segment = new THREE.Vector3();
  const toPack = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const toPlane = new THREE.Vector3();
  const midpoint = new THREE.Vector3();

  let taken = 0;

  // Shared across every tether — like the pack's own geometry, its shape never varies, only
  // its per-pack transform and opacity.
  const tetherGeometry = new THREE.BoxGeometry(TETHER_THICKNESS, TETHER_THICKNESS, 1);

  const packs = Array.from({ length: POOL }, () => {
    // One pair of materials each: they fade out one at a time.
    const { mesh, crateMaterial, crossMaterial } = buildPackMesh();
    mesh.visible = false;
    group.add(mesh);

    // The tether: its own material, so it can fade independently of the crate it belongs to
    // (both should be gone together, but nothing enforces that two opacities driven from the
    // same fade fraction would ever disagree).
    const tetherMaterial = new THREE.MeshBasicMaterial({
      color: PACK_GLOW,
      transparent: true,
      opacity: 0.6
    });
    const tether = new THREE.Mesh(tetherGeometry, tetherMaterial);
    tether.visible = false;
    group.add(tether);

    return {
      mesh,
      crateMaterial,
      crossMaterial,
      tether,
      tetherMaterial,
      live: false,
      age: 0,
      /** Seconds spent inside `MAGNET_RANGE` without a break — reset the instant the aircraft
       *  leaves range, which is what makes the ramp mean "how long has it been pulling", not
       *  "how long has it existed". */
      pullTime: 0,
      position: new THREE.Vector3()
    };
  });

  type Pack = (typeof packs)[number];

  /** Closest approach of the segment `previous` → `current` to the pack. */
  function reached(pack: Pack, previous: THREE.Vector3, current: THREE.Vector3): boolean {
    segment.subVectors(current, previous);
    toPack.subVectors(pack.position, previous);
    const length = segment.lengthSq();
    const t = length > 1e-9 ? THREE.MathUtils.clamp(toPack.dot(segment) / length, 0, 1) : 0;
    closest.copy(previous).addScaledVector(segment, t);
    return closest.distanceToSquared(pack.position) < PICKUP_RADIUS * PICKUP_RADIUS;
  }

  function retire(pack: Pack) {
    pack.live = false;
    pack.mesh.visible = false;
    pack.tether.visible = false;
    pack.pullTime = 0;
  }

  return {
    group,
    get taken() {
      return taken;
    },

    drop(at: THREE.Vector3) {
      const pack = packs.find((candidate) => !candidate.live);
      if (!pack) return;
      pack.position.copy(at);
      pack.mesh.position.copy(at);
      pack.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      pack.crateMaterial.opacity = 1;
      pack.crossMaterial.opacity = 1;
      pack.age = 0;
      pack.pullTime = 0;
      pack.live = true;
      pack.mesh.visible = true;
    },

    update(dt: number, previous: THREE.Vector3, current: THREE.Vector3) {
      let collected = 0;

      for (const pack of packs) {
        if (!pack.live) continue;

        pack.age += dt;
        if (pack.age >= PACK_LIFETIME) {
          retire(pack);
          continue;
        }

        toPlane.subVectors(current, pack.position);
        const distanceSq = toPlane.lengthSq();

        if (distanceSq < MAGNET_RANGE * MAGNET_RANGE) {
          // Pulled: the ramp is what makes it a magnet rather than a leash. `pullTime` is
          // seconds spent *inside* range without a break, so a pack you fly past and back into
          // range for starts the ramp over rather than remembering how long ago it first felt
          // the pull.
          pack.pullTime += dt;
          const pullSpeed = Math.min(MAGNET_MAX_SPEED, (pack.pullTime / MAGNET_RAMP_TIME) * MAGNET_MAX_SPEED);
          const distance = Math.sqrt(distanceSq);
          if (distance > 1e-4) {
            // Never overshoot the aircraft itself in one frame — `reached()` below is what
            // actually collects it, this only has to get it close.
            pack.position.addScaledVector(toPlane, Math.min(pullSpeed * dt, distance) / distance);
          }
          pack.mesh.position.copy(pack.position);

          // The tether: a box stretched from the pack to the aircraft, the same technique
          // `fly/bolts.ts` uses to aim its own boxes onto a direction. Recomputed against where
          // the pack just moved *to*, not where it started this frame, or the tether would lag
          // a step behind the crate it is supposed to be attached to.
          toPlane.subVectors(current, pack.position);
          const tetherLength = toPlane.length();
          pack.tether.position.copy(midpoint.addVectors(pack.position, current).multiplyScalar(0.5));
          pack.tether.scale.z = tetherLength;
          if (tetherLength > 1e-4) {
            pack.tether.quaternion.setFromUnitVectors(TETHER_AXIS, toPlane.divideScalar(tetherLength));
          }
          pack.tether.visible = true;
        } else {
          pack.pullTime = 0;
          pack.tether.visible = false;
          // Straight down the local vertical: "down" round a sphere is a radius.
          pack.position.setLength(pack.position.length() - SINK_RATE * dt);
          pack.mesh.position.copy(pack.position);
        }

        pack.mesh.rotation.x += TUMBLE_RATE * dt;
        pack.mesh.rotation.y += TUMBLE_RATE * 0.6 * dt;

        const left = PACK_LIFETIME - pack.age;
        const fade = Math.min(left / FADE_TIME, 1);
        pack.crateMaterial.opacity = fade;
        pack.crossMaterial.opacity = fade;
        pack.tetherMaterial.opacity = 0.6 * fade;

        if (reached(pack, previous, current)) {
          collected++;
          taken++;
          retire(pack);
        }
      }

      return collected;
    },

    clear() {
      for (const pack of packs) retire(pack);
    }
  };
}
