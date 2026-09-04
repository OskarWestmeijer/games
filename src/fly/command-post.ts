import * as THREE from 'three';
import { ORBIT_DAWN, ORBIT_NOON, PLANET_RADIUS } from '../space';

/**
 * Earth defence command post: a station going round and round the planet, high above the
 * aeroplane's own band, warm-lit and on the minimap.
 *
 * It is scenery with a job description. Nothing is run from it — there is no interior, no
 * docking and nothing to shoot — but it is the one thing up here that says the saucers are
 * being *answered* rather than merely being watched. Everything of the player's in this scene
 * is warm and everything of theirs is cold green; this is the biggest warm thing in it.
 *
 * **It is not the station in `src/station/`.** That one is a 15.6 m hull you walk around inside
 * in planet view, modelled in metres. This view is arcade-scaled — the aeroplane is 8 units
 * across against a 300-unit Earth — so the same building here would be far smaller than a
 * pixel. This is a symbol of a station, built from primitives like the aeroplane and the
 * saucer, and the two have nothing in common but the idea.
 */

/**
 * How high it flies: well above the saucer's band (45–130) and the landing ships' entry
 * altitude (150), so it reads as being *over* the traffic, and well inside the aeroplane's
 * ceiling so it can be climbed to and looked at.
 */
const ORBIT_ALTITUDE = 220;
const ORBIT_RADIUS = PLANET_RADIUS + ORBIT_ALTITUDE;
/** Seconds for a lap. Three times the aeroplane's own, so it is overtaken rather than chased. */
const ORBIT_PERIOD = 150;
/** Where in that lap it starts: orbit angle 0 is local noon, so this opens it in daylight. */
const START_ANGLE = 0.6;
/** The habitat ring turns, slowly. Its lights and spokes turn with it, or nothing would show. */
const RING_SPIN = 0.15;

/** Warm and over 1.0, so the bloom pass makes lights of them. */
const LIGHT = new THREE.Color(2.8, 1.7, 0.7);
const BEACON = new THREE.Color(3.0, 0.45, 0.35);

/**
 * Hub, habitat ring on four spokes, two solar wings and a dish. About 50 units across against
 * the aeroplane's 8.4 — big enough to read as architecture from a long way off, which is the
 * whole job. Built with its spine along +Y, which `update()` keeps pointing away from Earth.
 */
function buildPost(): { post: THREE.Group; ring: THREE.Group } {
  const post = new THREE.Group();

  const hull = new THREE.MeshStandardMaterial({ color: 0xc4cad2, roughness: 0.35, metalness: 0.62 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x39414c, roughness: 0.5, metalness: 0.5 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.35, metalness: 0.45 });

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 20, 12), hull);
  post.add(spine);
  const collarGeometry = new THREE.CylinderGeometry(3.4, 3.4, 1.6, 12);
  for (const y of [-7, 7]) {
    const collar = new THREE.Mesh(collarGeometry, trim);
    collar.position.y = y;
    post.add(collar);
  }

  // The ring and everything mounted on it turn together — a torus on its own is symmetrical,
  // so a spin nobody can see is a spin that may as well not be there.
  const ring = new THREE.Group();
  const torus = new THREE.Mesh(new THREE.TorusGeometry(13, 1.6, 8, 36), hull);
  // A torus lies in XY with its hole along Z; this lays it flat about the spine.
  torus.rotation.x = Math.PI / 2;
  ring.add(torus);

  const spokeGeometry = new THREE.BoxGeometry(11, 0.8, 0.8);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeometry, trim);
    // Rotating about +Y by -angle is what puts a box built along +X onto this bearing.
    spoke.position.set(Math.cos(angle) * 6.8, 0, Math.sin(angle) * 6.8);
    spoke.rotation.y = -angle;
    ring.add(spoke);
  }

  // The lamps are sized for *distance*, not for the model: at 250 units a half-unit sphere is
  // one pixel and blooms into nothing, and the post's whole job is being recognisable from a
  // long way off — including over the night side, where they are all there is of it.
  const lampGeometry = new THREE.SphereGeometry(1.05, 10, 8);
  const lampMaterial = new THREE.MeshBasicMaterial({ color: LIGHT });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
    lamp.position.set(Math.cos(angle) * 13, 0, Math.sin(angle) * 13);
    ring.add(lamp);
  }
  post.add(ring);

  // Solar wings, out along the spine's own X, clear of the ring.
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 8), trim);
  boom.rotation.z = Math.PI / 2;
  boom.position.y = -9;
  post.add(boom);
  for (const x of [-21, 21]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 7), panel);
    wing.position.set(x, -9, 0);
    post.add(wing);
  }

  // A dish on top, aimed away from the planet, and a beacon above it.
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.6),
    hull
  );
  dish.position.y = 10.5;
  post.add(dish);
  const beacon = new THREE.Mesh(lampGeometry, new THREE.MeshBasicMaterial({ color: BEACON }));
  beacon.position.y = 13.4;
  post.add(beacon);

  return { post, ring };
}

export interface CommandPost {
  /** Add this to the scene. */
  group: THREE.Group;
  /** Where it is now — the live vector, for the minimap. */
  position: THREE.Vector3;
  update(dt: number): void;
}

export function createCommandPost(): CommandPost {
  const { post, ring } = buildPost();

  const position = new THREE.Vector3();
  const travel = new THREE.Vector3();
  const up = new THREE.Vector3();
  const back = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  let angle = START_ANGLE;

  function place() {
    // The same construction `space.ts` flies the moon round on, in the same inclined plane: the
    // orbit is a circle in the basis (ORBIT_NOON, ORBIT_DAWN), so there is no integration to
    // drift and the ground track crosses latitudes instead of tracing the equator.
    position
      .copy(ORBIT_NOON)
      .multiplyScalar(Math.cos(angle) * ORBIT_RADIUS)
      .addScaledVector(ORBIT_DAWN, Math.sin(angle) * ORBIT_RADIUS);
    // Which way it is going is that circle's derivative, and needs no memory of last frame.
    travel
      .copy(ORBIT_NOON)
      .multiplyScalar(-Math.sin(angle))
      .addScaledVector(ORBIT_DAWN, Math.cos(angle))
      .normalize();

    // Spine away from Earth, ring flat to it, facing along the track: +Y up, +Z behind.
    up.copy(position).normalize();
    back.copy(travel).negate();
    right.crossVectors(up, back);
    basis.makeBasis(right, up, back);
    post.position.copy(position);
    post.quaternion.setFromRotationMatrix(basis);
  }

  place();

  return {
    group: post,
    position,
    update(dt: number) {
      angle += (dt / ORBIT_PERIOD) * Math.PI * 2;
      place();
      ring.rotation.y += RING_SPIN * dt;
    }
  };
}
