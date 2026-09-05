import * as THREE from 'three';
import { PLANET_RADIUS } from '../space';
import type { Space } from '../space';

/**
 * Boost rings: hoops hanging in the sky at fixed places around the planet, which you fly
 * *through* for a burst of speed. They are the reason the aeroplane's own throttle ceiling came
 * down — see `MAX_SPEED` in `fly-view.ts`. Cruising is now a matter of the throttle, and going
 * fast is a matter of flying somewhere, which is the whole point of this view.
 *
 * **They are placed, not spawned.** Every ring has a fixed home — a latitude, a longitude and
 * an altitude — and it lives there for the life of the session: fly through one and the same
 * hoop is back over the same country a few seconds later. That is what makes the marks on the
 * minimap worth reading as a *map*: the constellation is the same one every time you look at
 * it, so a run between three rings is a route you can plan and fly again. An earlier pass put
 * each ring out at a random bearing from the aircraft and moved it whenever it fell behind,
 * which made the map a list of things that happened to be near you and nothing you could aim at
 * twice.
 *
 * **The sites are spread by construction, not sprinkled.** A Fibonacci sphere puts `SITE_COUNT`
 * points at very nearly equal spacing over the whole globe, so there is always one within reach
 * wherever you are and no two are ever piled up together — which random latitudes and
 * longitudes do constantly, and which also bunches them at the poles.
 *
 * **Each site is a stack of three hoops, not one** — low, middle and high orbit over the same
 * patch of ground, at `ALTITUDES`. So a site is a place you can reach at any altitude you happen
 * to be flying at, rather than a hoop you have to climb or dive several tens of units to line up
 * on; and having found one, the obvious thing to do with it is take all three, which is a climb
 * through a stack and much the best thing this view has to fly. It also means the aeroplane's
 * whole altitude band is useful, where a single ring per site made one height right and the rest
 * of the band a place you passed through.
 *
 * **They do not block, catch, slow or turn the aeroplane.** There is no collision here at all:
 * a ring is a plane with a circle marked on it, and the only question ever asked of it is
 * whether the segment the aircraft flew this frame crossed that circle. Miss one and you fly
 * straight through the hoop's metal without anything happening, which is deliberate — this
 * scene has no ground and no walls, and a gate that could swat you out of the sky would be the
 * first solid thing in it.
 *
 * **The test is swept, for the same reason the laser's is.** At the speed a boosted aeroplane
 * reaches, a frame is 3 units and a slow frame is 16; asking "is the aircraft inside the ring
 * *now*" would miss most passes. The honest question is where the segment from last frame to
 * this one crossed the ring's plane, and it is no more expensive.
 *
 * **A ring always turns to face you, and it is not scenery for doing it.** Left on a fixed
 * heading, most of the hoops you found were edge-on: to fly through one you had to spot which
 * way it faced from several hundred units off, fly past it and come back round, which is a chore
 * rather than a boost. Facing them at the aircraft means a ring you can see is a ring you can
 * fly through, and the flying is the part worth having. It is aimed halfway between *you* and
 * the *way you are going*, so a ring you are already lined up on is square-on (both halves
 * agree) and one off to the side leans towards the path you would take to reach it.
 *
 * **A ring repairs as well as boosts, and it is not marked as doing it.** Flying through one
 * gives back `RING_HEAL_AMOUNT` of the aircraft's own health (see `fly-view.ts`) on top of the
 * speed — going fast and staying in the fight are the same errand now. A repair pack was hung in
 * the middle of every hoop for a while to say so, first a plain cross (read as a target reticle)
 * and then the pack itself, scaled up and tumbling — both were pulled: the heal is a bonus on
 * top of the boost you were already flying to the ring for, not a second landmark competing with
 * the boost rings' own six lamps and the actual falling packs for attention. It happens quietly,
 * the same way a ring at full health does nothing you would notice either.
 *
 * Warm, like everything else of ours in this scene — the alien half is all cold green.
 */

/** How many places have rings. Spread over the whole globe, so this is also how far apart they
 *  are: twelve sites is about a radian between neighbours, twenty seconds at cruise. */
export const SITE_COUNT = 12;
/**
 * The three altitudes at every site, in units above the surface: low, middle and high orbit.
 * Low sits well clear of the floor the aeroplane cannot descend past (`MIN_RADIUS` in
 * `fly-view.ts`, 24.5 above the surface), and high is a long way inside its ceiling.
 * Spaced 60 apart, which is three seconds of a steep climb — far enough that the stack reads as
 * three separate things from the ground, close enough to take all three in one pass.
 */
const ALTITUDES = [50, 110, 170];
/** …so this many hoops exist. */
export const RING_COUNT = SITE_COUNT * ALTITUDES.length;

/** The hoop. Wide enough to aim at from a long way off, and to fly through in a bank. */
const RADIUS = 20;
const TUBE = 0.95;
/** Lamps round the inside, so a hoop seen edge-on is still a hoop and not a line. */
const LAMP_COUNT = 6;
const LAMP_RADIUS = 0.85;
/** They go round, which is what says the thing is switched on. Unlike the command post's
 *  ring there is no symmetry argument here: the lamps are visibly discrete. */
const SPIN_RATE = 0.7;
/**
 * How fast a hoop may turn to face the aircraft, in radians per second. Rate-limited rather
 * than snapped: a ring is a solid object, and one that tracks you exactly reads as a decal
 * pinned to the camera. It also stops the ring swinging round in your face as you shoot past a
 * near miss — there the bearing to you changes faster than any object could turn.
 */
const FACE_RATE = 1.2;

/** Seconds between one being flown through and the same hoop coming back at the same place. */
const RESPAWN_DELAY = 6;
/** The pop when you go through: it swells and fades rather than simply vanishing. */
const POP_TIME = 0.5;
const POP_SCALE = 1.9;

/**
 * **The hoop is a lit object, not a light**, and that is a correction. It was one bright warm
 * material authored well over 1.0, which put the whole of a 20-unit torus through the bloom
 * threshold: from any distance a ring was a white-hot circle, and with thirty-six of them the
 * scene's loudest thing was its scenery. The alien landing ships — the one thing here with a
 * clock on it — were quietly outshouted by the furniture. So the ring is warm metal now, lit by
 * the same sun and earthshine as the aeroplane, with a low emissive to keep it visible against
 * the night side, and everything it has that blooms is in the lamps.
 */
const HOOP_COLOR = 0x8c7a63;
const HOOP_EMISSIVE = new THREE.Color(0.26, 0.15, 0.05);
/**
 * The lamps *are* over 1.0 and do bloom, which is what makes a ring findable across a hemisphere
 * — but they are six spheres under a metre across rather than a torus, so what they contribute
 * is six points of light and not a glare. Well under the saucer's own green, which is the thing
 * that should catch your eye first.
 */
const LAMP_GLOW = new THREE.Color(1.7, 0.95, 0.34);

/** The golden angle, which is what makes a Fibonacci sphere evenly spaced. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface RingView {
  readonly active: boolean;
  /** Where it is right now, in world space — the live vector. It moves, slowly: the site is
   *  fixed to the *ground*, and the planet turns. */
  readonly position: THREE.Vector3;
}


export interface Rings {
  /** Add this to the scene. */
  group: THREE.Group;
  /** Every hoop, `RING_COUNT` of them. Nothing outside a dev harness reads it — the rings are
   *  not on the minimap; see `updateMapMarks()` in `fly-view.ts` for why. */
  all: readonly RingView[];
  /**
   * Keeps every hoop over its own patch of ground, turns it to face the aircraft, spins its
   * lamps, runs out any pops, brings back what has been used — and answers **how many rings the
   * aircraft flew through this frame**, which is almost always 0 and occasionally 1.
   *
   * `previous` and `current` are the ends of the segment it travelled: the caller has to keep
   * the former, because by the time this is called the aeroplane is already at the latter.
   * `heading` is the way the nose is pointing, which is half of what a hoop turns to face.
   */
  update(dt: number, previous: THREE.Vector3, current: THREE.Vector3, heading: THREE.Vector3): number;
  /** Puts every hoop back at its own site, facing `from`. The sites themselves never change. */
  reset(from: THREE.Vector3): void;
}

export function createRings(space: Space): Rings {
  const group = new THREE.Group();

  const hoopGeometry = new THREE.TorusGeometry(RADIUS, TUBE, 10, 48);
  const lampGeometry = new THREE.SphereGeometry(LAMP_RADIUS, 10, 8);

  const radialUp = new THREE.Vector3();
  const ringRight = new THREE.Vector3();
  const ringUp = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const aim = new THREE.Quaternion();
  const fromPrev = new THREE.Vector3();
  const fromCur = new THREE.Vector3();
  const crossing = new THREE.Vector3();

  /**
   * The sites: a Fibonacci sphere, so latitudes come from an even spread in sin and longitudes
   * step by the golden angle. Deterministic, so the constellation is the same every session and
   * a route between three of them is a route you can fly twice.
   */
  const places = Array.from({ length: SITE_COUNT }, (_, i) => ({
    latitude: THREE.MathUtils.radToDeg(Math.asin(1 - (2 * (i + 0.5)) / SITE_COUNT)),
    longitude: THREE.MathUtils.radToDeg(((i * GOLDEN_ANGLE) % (Math.PI * 2)) - Math.PI)
  }));

  const rings = places.flatMap((place) =>
    ALTITUDES.map((altitude, level) => makeRing(place, altitude, level))
  );

  function makeRing(place: { latitude: number; longitude: number }, altitude: number, level: number) {
    // Per ring rather than shared, because a pop fades one hoop and not the other thirty-five.
    const material = new THREE.MeshStandardMaterial({
      color: HOOP_COLOR,
      emissive: HOOP_EMISSIVE,
      roughness: 0.42,
      metalness: 0.65,
      transparent: true
    });
    const lampMaterial = new THREE.MeshBasicMaterial({ color: LAMP_GLOW, transparent: true });
    const mesh = new THREE.Group();
    // A torus lies in XY with its axis on +Z, which is the axis the pass test wants: so the
    // ring's own -Z is the way you fly through it, the same convention as everything else here.
    mesh.add(new THREE.Mesh(hoopGeometry, material));

    const lamps = new THREE.Group();
    for (let l = 0; l < LAMP_COUNT; l++) {
      const angle = (l / LAMP_COUNT) * Math.PI * 2;
      const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
      lamp.position.set(
        Math.cos(angle) * (RADIUS - TUBE - 1.1),
        Math.sin(angle) * (RADIUS - TUBE - 1.1),
        0
      );
      lamps.add(lamp);
    }
    mesh.add(lamps);
    group.add(mesh);

    // The lamps of a stack are offset from each other, so three hoops seen one above the other
    // are visibly three rather than one thing with a thick edge.
    lamps.rotation.z = (level / ALTITUDES.length) * ((Math.PI * 2) / LAMP_COUNT);

    return {
      mesh,
      lamps,
      material,
      lampMaterial,
      latitude: place.latitude,
      longitude: place.longitude,
      radius: PLANET_RADIUS + altitude,
      active: true,
      /** Counts down while the hoop is away. */
      wait: 0,
      /** Seconds into the pop, or `POP_TIME` once it is over. */
      popAge: POP_TIME,
      position: new THREE.Vector3(),
      /** The hoop's own normal: what "through" means for this ring. */
      axis: new THREE.Vector3(0, 0, 1)
    };
  }

  type Ring = (typeof rings)[number];

  /**
   * Turns a hoop towards `target`, by `t` of the way there — 1 to put it there outright. Its
   * own up is the local vertical rather than anything of the aircraft's, so the lamps never
   * roll and a ring is the same way up whichever way you came at it.
   */
  function aimAt(ring: Ring, target: THREE.Vector3, t: number) {
    radialUp.copy(ring.position).normalize();
    ringRight.crossVectors(radialUp, target);
    // Degenerate only if the hoop is being asked to face straight up or straight down, which
    // nothing here does: `target` is a bearing to an aircraft in more or less the same sky.
    if (ringRight.lengthSq() < 1e-8) return;
    ringRight.normalize();
    ringUp.crossVectors(target, ringRight).normalize();
    basis.makeBasis(ringRight, ringUp, target);
    aim.setFromRotationMatrix(basis);
    if (t >= 1) ring.mesh.quaternion.copy(aim);
    else ring.mesh.quaternion.slerp(aim, t);
    // The pass test asks the *mesh* which way it is facing, so the two can never disagree.
    ring.axis.set(0, 0, 1).applyQuaternion(ring.mesh.quaternion);
  }

  /**
   * Where the hoop is this frame. Its home is a place on the *ground*, not a point in space, so
   * it has to be asked for again every frame or the planet turns out from under it — the same
   * reasoning as the landing ships' two ends, and what keeps its mark on the minimap sitting on
   * the country it belongs to instead of creeping west all session.
   */
  function place(ring: Ring) {
    space.worldFromLatLon(ring.latitude, ring.longitude, ring.radius, ring.position);
    ring.mesh.position.copy(ring.position);
  }

  /** Puts one back at its own site, facing `from`, with everything a pop left behind undone. */
  function restore(ring: Ring, from: THREE.Vector3) {
    place(ring);
    // Facing the aeroplane from the moment it is back — usually over the horizon, where there
    // is nobody to see it turn, and arriving square-on is the point of the tracking below.
    facing.subVectors(from, ring.position).normalize();
    aimAt(ring, facing, 1);
    ring.mesh.scale.setScalar(1);
    ring.material.opacity = 1;
    ring.lampMaterial.opacity = 1;
    ring.mesh.visible = true;
    ring.active = true;
    ring.popAge = POP_TIME;
  }

  /** Did the segment `previous` → `current` pass through the hoop? */
  function crossed(ring: Ring, previous: THREE.Vector3, current: THREE.Vector3): boolean {
    fromPrev.subVectors(previous, ring.position);
    fromCur.subVectors(current, ring.position);
    const before = fromPrev.dot(ring.axis);
    const after = fromCur.dot(ring.axis);
    // Same side, or no movement across the plane at all: nothing happened.
    if (before === after || before * after > 0) return false;
    // Where it cut the plane, and how far that is off the hoop's centre.
    const t = before / (before - after);
    crossing.copy(fromPrev).lerp(fromCur, t);
    crossing.addScaledVector(ring.axis, -crossing.dot(ring.axis));
    return crossing.lengthSq() < RADIUS * RADIUS;
  }

  return {
    group,
    all: rings,

    update(dt: number, previous: THREE.Vector3, current: THREE.Vector3, heading: THREE.Vector3) {
      let passed = 0;

      for (const ring of rings) {
        if (ring.popAge < POP_TIME) {
          ring.popAge += dt;
          const t = Math.min(ring.popAge / POP_TIME, 1);
          ring.mesh.scale.setScalar(1 + t * (POP_SCALE - 1));
          ring.material.opacity = 1 - t;
          ring.lampMaterial.opacity = 1 - t;
          if (t >= 1) ring.mesh.visible = false;
        }

        if (!ring.active) {
          ring.wait -= dt;
          if (ring.wait <= 0) restore(ring, current);
          continue;
        }

        place(ring);
        ring.lamps.rotation.z += SPIN_RATE * dt;

        // Face the aeroplane: halfway between the bearing to it and the reverse of where it is
        // going. Lined up, the two are the same vector and the hoop is square to the approach;
        // off to one side, it leans towards the path you would fly to get there. Falls back to
        // the bearing alone in the one case they cancel — flying directly away from it.
        facing.subVectors(current, ring.position).normalize().addScaledVector(heading, -1);
        if (facing.lengthSq() < 1e-6) facing.subVectors(current, ring.position);
        aimAt(ring, facing.normalize(), Math.min(FACE_RATE * dt, 1));

        if (crossed(ring, previous, current)) {
          passed++;
          ring.active = false;
          ring.wait = RESPAWN_DELAY;
          // Left visible: the pop above is what it does on the way out.
          ring.popAge = 0;
        }
      }

      return passed;
    },

    reset(from: THREE.Vector3) {
      for (const ring of rings) restore(ring, from);
    }
  };
}
