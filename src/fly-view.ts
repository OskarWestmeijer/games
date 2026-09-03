import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ATMOSPHERE_RADIUS, PLANET_RADIUS, SUN_DIR, buildSpace } from './space';
import type { TextureQuality } from './space';

/**
 * "Flight view": the same world as the other two planet scenes, with a small aeroplane you
 * fly around the globe from a chase camera.
 *
 * It is deliberately the *minimum* that reads as flying. There is no lift, no drag, no stall,
 * no gravity and no ground: the aircraft is an orientation and a speed along its own nose,
 * held between two radii so it can neither dive into the atmosphere shell nor leave the
 * neighbourhood. Everything else is chrome. Do not grow this into a flight model without a
 * reason — the pleasure here is looking at NASA's Earth go past, not managing energy.
 *
 * Like `planet-inspect.ts` it builds its own `buildSpace()`, so it shares no GPU resources
 * and no sun with the other scenes.
 */

/** Nose is -Z, up is +Y, right is +X — the same convention three's cameras use. */
const NOSE = new THREE.Vector3(0, 0, -1);
const ORIGIN = new THREE.Vector3();

/**
 * How low the aircraft may fly. Every camera in this repo has to stay outside
 * `ATMOSPHERE_RADIUS` or the outer `BackSide` shell wraps it and smears glow over the whole
 * sky — and the chase camera sits *below* the aircraft as often as not, so the aircraft's own
 * floor has to carry clearance for it as well as for itself.
 */
const MIN_RADIUS = ATMOSPHERE_RADIUS + 14;
/** Far enough out to see the whole disc, and nowhere near the moon at 3000. */
const MAX_RADIUS = PLANET_RADIUS * 6;

/** Throttle, in world units per second. The planet is 300 across, so 45 is a brisk cruise. */
const MIN_SPEED = 12;
const MAX_SPEED = 130;
const CRUISE_SPEED = 45;
/** Throttle authority. Slowing is twice as quick as speeding up, so S reads as a brake. */
const THROTTLE_UP = 34;
const THROTTLE_DOWN = 70;

/** Control authority, in radians per second at full deflection. */
const PITCH_RATE = 0.95;
const YAW_RATE = 0.5;
/**
 * The left/right arrows command a **bank angle**, not a roll rate, and that distinction is
 * the difference between an aeroplane and a barrel. Held down, a roll *rate* passes through
 * 90° into inverted flight in under a second and a half — which is what the first pass did,
 * and it took the level-hold below with it, pointing the correction at the planet and flying
 * the aircraft into the floor. A bank *command* holds the turn for as long as you hold the
 * key and rolls itself level the moment you let go, which is what "fly around the globe with
 * four keys" actually needs.
 */
const MAX_BANK = 1.15;
/** How hard the bank is driven towards the commanded angle, and the rate limit on doing it. */
const BANK_GAIN = 2.8;
const ROLL_RATE = 2.2;
/**
 * A banked aeroplane turns, because its lift vector is no longer vertical. Modelling that
 * properly needs lift; measuring how far the right wing has risen above the local horizontal
 * and yawing by it costs two lines and is indistinguishable at this speed. It is what makes
 * the left/right arrows alone enough to fly a circuit — without it a roll only rolls, and you
 * have to work the rudder to go anywhere. At full bank it turns a circle in about 11 seconds.
 */
const BANK_TURN_RATE = 0.62;
/**
 * Level-hold, which is this scene's stand-in for gravity — and it is not a nicety.
 *
 * With the stick centred and nothing pulling the nose down, "straight and level" is a
 * *tangent*: you leave the planet behind within seconds and spend the rest of the flight
 * looking at empty sky, which is what the first pass actually did. So with the pitch stick
 * centred the nose is held on the local horizon, and the path bends round the globe.
 *
 * The feed-forward term is the half that matters. Going round a sphere at a given speed *is*
 * a pitch rate (`speed / radius`); a proportional correction alone has steady-state error
 * exactly equal to it, so you climb away anyway, only slower. `LEVEL_GAIN` is then just what
 * pulls the nose back after a deliberate climb or dive.
 *
 * Both are scaled by how far the stick is *off* centre, so full deflection disables the hold
 * entirely and you can fly straight up if you want to.
 *
 * It is applied about `forward x radialUp` — the world-horizontal axis — and **not** about
 * the aircraft's own pitch axis, which is the obvious thing to reach for and is wrong the
 * moment you bank. At 66° of bank a pitch-axis correction has only cos(66°) of the authority
 * it needs, so a held turn sinks all the way to `MIN_RADIUS` and stays there.
 */
const LEVEL_GAIN = 1.6;

/** Seconds for a control to reach full deflection, so a keypress is a stick and not a switch. */
const CONTROL_LAG = 0.14;

/** Chase camera, in aircraft-local metres: behind (+Z) and above. */
const CHASE_OFFSET = new THREE.Vector3(0, 3.4, 15);
/** Aim point ahead of the nose. */
const CHASE_LOOK_AHEAD = 12;
/**
 * …and how far *below* it. This is what keeps the planet in the picture. Flying level at this
 * altitude the limb sits about 32° under the local horizontal, which is outside a 58° frame
 * aimed along the nose — aim slightly down and the Earth fills the bottom third while the
 * aeroplane stays centred.
 */
const CHASE_LOOK_DROP = 3.2;
/** How quickly the camera catches up, per second. Lag is what makes a turn feel like one. */
const CHASE_FOLLOW = 6.0;
/**
 * How much of the aircraft's roll the camera copies. **Not 1.** A chase camera welded to the
 * aircraft's own up makes a roll invisible: the aeroplane sits perfectly still in frame while
 * the entire universe rotates around it, which is what the first pass looked like. Splitting
 * the difference with the local vertical is what makes a bank read as a bank — at 60° of bank
 * the horizon tilts 40° and the aeroplane visibly leans the remaining 20°.
 *
 * Must not be exactly 0.5, which is the one value at which the blend collapses to nothing
 * when inverted.
 */
const CHASE_ROLL_SHARE = 0.65;

/**
 * Where the aircraft starts. Low enough that the planet fills the bottom of the frame — the
 * curve of the limb is the whole reason to be here — and still 60 above the atmosphere shell.
 */
const START_RADIUS = PLANET_RADIUS + 60;
const START_DIRECTION = new THREE.Vector3(0.35, 0.3, 0.89).normalize();

/**
 * A box aeroplane: fuselage, wings, tailplane, fin, a dark canopy and the two navigation
 * lights. Built nose-down -Z at the origin, so the caller only has to place it.
 *
 * The nav lights and the exhaust are authored over 1.0 on purpose — that is the side of the
 * bloom threshold that turns a small bright face into an actual light, the same trick the
 * station's LED strips use.
 */
function buildPlane(): THREE.Group {
  const plane = new THREE.Group();

  // Mid grey rather than white. At white the aeroplane saturated over the day side and blew
  // straight through the bloom threshold, so the subject of the scene was a glowing smear.
  const body = new THREE.MeshStandardMaterial({ color: 0x9aa1a9, roughness: 0.42, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x39404a, roughness: 0.6, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.12, metalness: 0.85 });

  const part = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    plane.add(mesh);
    return mesh;
  };

  part(new THREE.BoxGeometry(0.95, 0.95, 6.4), body, 0, 0, 0);
  // A shorter, thinner box in front of the fuselage is the whole of the nose taper.
  part(new THREE.BoxGeometry(0.55, 0.55, 1.5), trim, 0, 0, -3.7);
  part(new THREE.BoxGeometry(8.4, 0.18, 1.7), body, 0, 0.05, 0.3);
  part(new THREE.BoxGeometry(3.2, 0.16, 0.9), body, 0, 0.05, 2.7);
  part(new THREE.BoxGeometry(0.16, 1.5, 1.1), body, 0, 0.85, 2.8);
  part(new THREE.BoxGeometry(0.72, 0.42, 1.3), glass, 0, 0.6, -0.9);

  // Port red, starboard green — the one aviation convention worth spending two spheres on.
  const tip = new THREE.SphereGeometry(0.17, 10, 8);
  part(tip, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.25, 0.3) }), -4.2, 0.05, 0.3);
  part(tip, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 2.6, 0.5) }), 4.2, 0.05, 0.3);
  part(
    new THREE.BoxGeometry(0.5, 0.5, 0.12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 0.8, 0.4) }),
    0,
    0,
    3.25
  );

  return plane;
}

export interface FlyViewOptions {
  /** Which surface map set to open on. See `TextureQuality` in `space.ts`. */
  quality?: TextureQuality;
  /** Live readouts in the HUD pill. Injected, never queried for. */
  speedLabel?: HTMLElement | null;
  altitudeLabel?: HTMLElement | null;
}

export function createFlyView(canvas: HTMLCanvasElement, options: FlyViewOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // Same reasoning as the other two planet scenes: this is almost entirely full-screen
  // shader plus a bloom composer, and 2x device pixels on a retina tablet is four times the
  // fragment cost for a difference nobody can see.
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2)
  );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);

  // The aircraft is ~8 units across and the star sphere is at 8000; a near plane of 0.5 keeps
  // a plain depth buffer precise across that without a logarithmic one.
  const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 20000);

  const space = buildSpace(renderer, { quality: options.quality });
  scene.add(space.group);

  // The planet lights itself from `SUN_DIR` inside its own shader; these are for the
  // aeroplane alone.
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.0);
  sun.position.copy(SUN_DIR).multiplyScalar(1000);
  scene.add(sun);
  /**
   * Earthshine, and it is the light that does the work here. A `HemisphereLight` takes its
   * axis from its `position`, so re-aiming it along the local vertical every frame gives the
   * aeroplane a cool sky above and a bright planet below wherever on the globe it happens to
   * be. Without it the whole night side of the orbit is a flat black silhouette against the
   * stars — which is what the scene actually looked like the first time round.
   */
  const earthshine = new THREE.HemisphereLight(0x1b2536, 0x74869a, 1.15);
  scene.add(earthshine);
  scene.add(new THREE.AmbientLight(0x2c3646, 0.4));

  const plane = buildPlane();
  scene.add(plane);

  // Same chain as the other planet scenes: the atmosphere and the nav lights are authored
  // over 1.0 so bloom turns them into light, and `OutputPass` has to stay last.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.4, 1.0));
  composer.addPass(new OutputPass());

  /** Held keys. Read as an axis pair, so pressing both cancels rather than latching. */
  const keys = new Set<string>();
  const axis = (positive: string[], negative: string[]) =>
    (positive.some((k) => keys.has(k)) ? 1 : 0) - (negative.some((k) => keys.has(k)) ? 1 : 0);

  // Smoothed control deflections, -1..1.
  let pitch = 0;
  let roll = 0;
  let yaw = 0;
  let speed = CRUISE_SPEED;

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const radialUp = new THREE.Vector3();
  const chase = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const planeUp = new THREE.Vector3();
  const levelAxis = new THREE.Vector3();
  const spin = new THREE.Quaternion();
  const basis = new THREE.Matrix4();

  function reset() {
    plane.position.copy(START_DIRECTION).multiplyScalar(START_RADIUS);
    // Level flight: nose along a tangent, wings square to the local horizontal. `Matrix4.lookAt`
    // puts +Z *away* from its target, so aiming it at the heading leaves -Z — the nose — on it.
    radialUp.copy(plane.position).normalize();
    forward.crossVectors(radialUp, new THREE.Vector3(0, 1, 0)).normalize();
    basis.lookAt(ORIGIN, forward, radialUp);
    plane.quaternion.setFromRotationMatrix(basis);

    pitch = roll = yaw = 0;
    speed = CRUISE_SPEED;
    placeCamera(1);
  }

  /** Moves the chase camera towards where it belongs. `t` of 1 snaps it there. */
  function placeCamera(t: number) {
    radialUp.copy(plane.position).normalize();
    planeUp.set(0, 1, 0).applyQuaternion(plane.quaternion);
    // See `earthshine`: its axis is its position, and "up" is wherever the planet is not.
    earthshine.position.copy(radialUp);

    chase.copy(CHASE_OFFSET).applyQuaternion(plane.quaternion).add(plane.position);
    // The camera has the same floor the aircraft does, and for the same reason — a chase
    // camera slung below a banked turn is exactly where it would otherwise get inside the shell.
    const radius = chase.length();
    if (radius < ATMOSPHERE_RADIUS * 1.02) chase.multiplyScalar((ATMOSPHERE_RADIUS * 1.02) / radius);

    camera.position.lerp(chase, t);
    lookTarget
      .copy(NOSE)
      .applyQuaternion(plane.quaternion)
      .multiplyScalar(CHASE_LOOK_AHEAD)
      .addScaledVector(planeUp, -CHASE_LOOK_DROP)
      .add(plane.position);
    // Part of the aircraft's roll, part of the local vertical — see `CHASE_ROLL_SHARE`.
    camera.up.copy(radialUp).lerp(planeUp, CHASE_ROLL_SHARE).normalize();
    camera.lookAt(lookTarget);
  }

  function update(dt: number) {
    // Arrows are the stick (pitch, and commanded bank), A/D the rudder, W/S the throttle.
    // Arrow Up climbs — this is an arcade chase view, not a sim with a yoke to push forward.
    const target = {
      pitch: axis(['ArrowUp'], ['ArrowDown']),
      roll: axis(['ArrowLeft'], ['ArrowRight']),
      yaw: axis(['KeyA'], ['KeyD'])
    };
    const blend = 1 - Math.exp(-dt / CONTROL_LAG);
    pitch += (target.pitch - pitch) * blend;
    roll += (target.roll - roll) * blend;
    yaw += (target.yaw - yaw) * blend;

    const throttle = axis(['KeyW'], ['KeyS']);
    speed = THREE.MathUtils.clamp(
      speed + throttle * (throttle > 0 ? THROTTLE_UP : THROTTLE_DOWN) * dt,
      MIN_SPEED,
      MAX_SPEED
    );

    plane.rotateX(pitch * PITCH_RATE * dt);
    plane.rotateY(yaw * YAW_RATE * dt);

    radialUp.copy(plane.position).normalize();
    right.set(1, 0, 0).applyQuaternion(plane.quaternion);
    planeUp.set(0, 1, 0).applyQuaternion(plane.quaternion);

    // Bank towards what the stick asks for — positive is right-wing-up, i.e. banked left,
    // which is also the sign `ArrowLeft` gives. Releasing asks for zero, so it rolls level.
    const bank = Math.atan2(right.dot(radialUp), planeUp.dot(radialUp));
    plane.rotateZ(
      THREE.MathUtils.clamp((roll * MAX_BANK - bank) * BANK_GAIN, -ROLL_RATE, ROLL_RATE) * dt
    );

    // The turn that bank buys, taken about the **local vertical** rather than about the
    // aircraft's own up axis. `plane.rotateY` is the obvious spelling and is a trap: once
    // banked, the aircraft's up is tilted, so yawing about it drives the nose downwards at
    // sin²(bank) x the turn rate — 0.5 rad/s at full bank, which is more than the level-hold
    // has authority to answer, and a held turn spirals into `MIN_RADIUS` and stays there.
    // A rotation about the local vertical is a pure heading change and costs no height at all.
    right.set(1, 0, 0).applyQuaternion(plane.quaternion);
    plane.quaternion.premultiply(
      spin.setFromAxisAngle(radialUp, right.dot(radialUp) * BANK_TURN_RATE * dt)
    );

    // Level-hold: put the nose back on the local horizon, about the world-horizontal axis
    // rather than the aircraft's own. See `LEVEL_GAIN` — both halves of it matter.
    forward.copy(NOSE).applyQuaternion(plane.quaternion);
    const climb = forward.dot(radialUp);
    const hold = 1 - Math.min(Math.abs(pitch), 1);
    levelAxis.crossVectors(forward, radialUp);
    if (levelAxis.lengthSq() > 1e-6) {
      levelAxis.normalize();
      const correction = -(speed / plane.position.length() + climb * LEVEL_GAIN) * hold * dt;
      plane.quaternion.premultiply(spin.setFromAxisAngle(levelAxis, correction));
      forward.copy(NOSE).applyQuaternion(plane.quaternion);
    }

    plane.position.addScaledVector(forward, speed * dt);

    // No ground and no ceiling, only two spheres. Sliding along them is the whole collision
    // response: at this speed a bounce would read as a bug rather than as terrain.
    const radius = plane.position.length();
    const clamped = THREE.MathUtils.clamp(radius, MIN_RADIUS, MAX_RADIUS);
    if (clamped !== radius) plane.position.multiplyScalar(clamped / radius);

    placeCamera(1 - Math.exp(-dt * CHASE_FOLLOW));

    if (options.speedLabel) options.speedLabel.textContent = `${Math.round(speed)}`;
    if (options.altitudeLabel) {
      options.altitudeLabel.textContent = `${Math.round(plane.position.length() - PLANET_RADIUS)}`;
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!running) return;
    keys.add(event.code);
    // The arrows would otherwise scroll whatever is behind the canvas on a short viewport.
    if (event.code.startsWith('Arrow')) event.preventDefault();
  }

  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
  // A tab-out with the throttle open would otherwise leave the key held forever.
  const onBlur = () => keys.clear();

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    composer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }

  const clock = new THREE.Clock(false);
  let rafId = 0;
  let running = false;

  function tick() {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.1);
    update(dt);
    space.update(clock.elapsedTime, dt);
    composer.render();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  reset();

  function start() {
    if (running) return;
    running = true;
    resize(); // the canvas had no size while the view was hidden
    clock.start();
    tick();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    keys.clear();
    clock.stop();
  }

  /**
   * Dev-only handle, the same idea as `__station` in `planet-view.ts`: a screenshot harness
   * needs to know when the surface maps have landed, or every frame it takes is of the
   * procedural stand-in rather than of Earth. Stripped from a production build.
   */
  if (import.meta.env.DEV) {
    let mapsReady = false;
    space.ready.then(() => {
      mapsReady = true;
    });
    (window as unknown as Record<string, unknown>).__fly = {
      camera,
      scene,
      plane,
      space,
      get mapsReady() {
        return mapsReady;
      },
      get speed() {
        return speed;
      }
    };
  }

  return {
    start,
    stop,
    reset,
    setTextureQuality: (quality: TextureQuality) => space.setQuality(quality)
  };
}
