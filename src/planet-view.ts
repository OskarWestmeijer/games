import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildPod, DESK_SPAWN, EYE_HEIGHT, ROOM, ROOM_BOUNDS } from './pod';
import { createInteractions } from './interaction';
import {
  buildSpace,
  ATMOSPHERE_RADIUS,
  ORBIT_DAWN,
  ORBIT_NOON,
  ORBIT_NORMAL,
  PLANET_RADIUS
} from './space';
import type { TextureQuality } from './space';
import { createFpvControls } from './fpv-controls';
import { createPodAudio } from './audio';

/**
 * "Planet view": a one-room space pod in orbit, with a first-person camera inside it and a
 * big window looking out at the planet.
 *
 * The camera is a *child* of `stationRig`, the group that carries the pod around its orbit.
 * That's the whole trick that keeps this simple: the rig handles orbiting and staying
 * pointed at the planet, while the player walks around in plain room coordinates,
 * oblivious to where the room currently is in space.
 *
 * The orbit is steeply inclined and the window is aimed down and forward rather than flat at
 * the horizon — `ALTITUDE_RANGE`, `HORIZON_ELEVATION` and `WINDOW_YAW` below are the knobs,
 * plus `SUN_BETA` in `space.ts`, which tilts the orbital plane this flies in and decides how
 * much of the lap is flown in daylight.
 */

/**
 * How high the pod flies, in world units above the surface — the slider in the corner, and
 * the biggest single lever on what the window looks like.
 *
 * At the bottom of the range the limb is `asin(300/320)` ≈ 69.6° off the nadir, an ISS-like
 * orbit where the horizon is a wide shallow arc and you are reading terrain; by the top it
 * is 19.5° and the planet is a ball hanging in the glass with space around it. The default
 * sits where the curvature of the world is unmistakable but the surface is still close
 * enough to have texture in it.
 *
 * The floor is not arbitrary: at altitude 10.5 the pod would be inside the outer atmosphere
 * shell (`ATMOSPHERE_RADIUS`), which wraps the camera in glow. 20 keeps clear of it.
 * The ceiling is well inside the starfield at 8000 and the camera's far plane at 20000.
 */
export const ALTITUDE_RANGE = { min: 20, max: 600, initial: 120 };

/** Seconds for one full lap. Slow enough to be ambient rather than a ride. */
const ORBIT_PERIOD = 300;

/**
 * Where on the orbit we start, in radians, measured from local noon (see `ORBIT_NOON`).
 * ≈264° is just past sunrise: the opening frame has the terminator running diagonally
 * across the window and then two and a half minutes of full daylight ahead of it.
 */
const ORBIT_START = 4.6;

/**
 * Where the horizon sits in the window, in radians above the optical axis — 9.4°, which from
 * `DESK_SPAWN` (2.4 m back from the glass, which there spans -29.0° to +29.7° vertically)
 * puts it about two thirds of the way up: surface below it, a band of stars above.
 *
 * This is the framing constant now, rather than the pitch itself. The limb sits at
 * `α - pitch` relative to the optical axis, where `α = asin(R / (R + altitude))`, so pinning
 * the limb and solving for the pitch (`pitchFor()`) is what lets the altitude slider move
 * without the horizon sliding off the top or the bottom of the glass on the way. Lower this
 * to trade planet for sky; at 0 the window looks flat out at the limb, which is where this
 * started and why so little of the planet was in it.
 */
const HORIZON_ELEVATION = 0.164;

/** The pitch that puts the limb `HORIZON_ELEVATION` above the optical axis at this altitude. */
function pitchFor(altitude: number): number {
  return Math.asin(PLANET_RADIUS / (PLANET_RADIUS + altitude)) - HORIZON_ELEVATION;
}

/**
 * How far the pod is turned about its own vertical before being pitched up, in radians —
 * positive swings the window towards the direction of travel.
 *
 * At 0 the window looks square across the track and the ground slides straight sideways
 * past it, which is a very static way to see a planet. At ≈34° the view is oblique: terrain
 * comes towards you and passes off to one side, and the terminator crosses the glass on a
 * diagonal rather than as a vertical bar. Because a horizon is a cone about the nadir, this
 * is a pure azimuth change — it does not tilt the horizon or move it up or down, so it stays
 * independent of the pitch.
 */
const WINDOW_YAW = 0.6;

const PLANET_CENTER = new THREE.Vector3(0, 0, 0);

/**
 * How wide the radio's aiming box is against the monitor's, and how close the eye has to be
 * before the prompt offers it, in metres. It sits on the near edge of the desk rather than
 * behind it, so it is both harder to aim at and closer when you are — a shorter reach than a
 * larger target further back would need, and the two staying apart is what stops a sweep
 * across the desk flickering between prompts.
 */
const RADIO_REACH = 1.7;

export interface PlanetViewOptions {
  onLockChange?: (locked: boolean) => void;
  /** Which surface map set to open on. See `TextureQuality` in `space.ts`. */
  quality?: TextureQuality;
  /** Opening altitude. Defaults to `ALTITUDE_RANGE.initial`. */
  altitude?: number;
  /** The on-screen movement stick for touch devices; see `createFpvControls`. */
  joystick?: HTMLElement | null;
  /** The "press E to…" element; see `createInteractions`. Injected, never queried for. */
  interactPrompt?: HTMLElement | null;
}

export function createPlanetView(canvas: HTMLCanvasElement, options: PlanetViewOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // A retina tablet is the worst case for this scene: nearly every pixel is full-screen
  // shader work plus a bloom composer, and 2x device pixels on an iPad is four times the
  // fragment cost of 1x. Coarse-pointer devices get 1.5, which is indistinguishable at
  // arm's length and roughly halves that. `planet-inspect.ts` does the same.
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2)
  );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Deliberately under 1: the pod is meant to be a dark room lit by strip lights and the
  // planet, and it reads as washed-out neon long before it reads as too dim.
  renderer.toneMappingExposure = 0.8;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);

  // The pod spans ~0.1-10 units from the eye and the planet a few hundred; far enough
  // apart, and both smooth enough, that a plain 24-bit depth buffer is plenty. No need for
  // a logarithmic one.
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 20000);

  const stationRig = new THREE.Group();
  scene.add(stationRig);
  const pod = buildPod();
  stationRig.add(pod.group);

  let altitude = options.altitude ?? ALTITUDE_RANGE.initial;

  // At the desk, as if you had just got up from the chair — see `DESK_SPAWN` in `pod/desk.ts`.
  // Moving the eye a couple of metres does not disturb `HORIZON_ELEVATION`: that is an angle
  // about the optical axis and the planet is 300 units away, so the limb sits where it always
  // did. What changes is how much of the window is in view, which grows as you approach the
  // glass — the opening frame is wider here than it was from the middle of the room.
  camera.position.set(DESK_SPAWN.x, EYE_HEIGHT, DESK_SPAWN.z);
  // YXZ, matching `PointerLockControls`: any other order turns an initial yaw into roll.
  camera.rotation.order = 'YXZ';
  camera.rotation.y = DESK_SPAWN.yaw;
  stationRig.add(camera);

  // --- interior lighting ---------------------------------------------------------------
  stationRig.add(new THREE.AmbientLight(0x1a2430, 0.55));

  const ledPositions: [number, number, number][] = [
    [-ROOM.width / 2 + 0.5, ROOM.height - 0.4, -1.4],
    [ROOM.width / 2 - 0.5, ROOM.height - 0.4, -1.4],
    [-ROOM.width / 2 + 0.5, ROOM.height - 0.4, 1.6],
    [ROOM.width / 2 - 0.5, ROOM.height - 0.4, 1.6]
  ];
  for (const [x, y, z] of ledPositions) {
    const lamp = new THREE.PointLight(0x66d9ff, 3.0, 9, 2);
    lamp.position.set(x, y, z);
    stationRig.add(lamp);
  }

  // Cold light spilling in through the window, so the room reads as lit by the planet.
  const planetShine = new THREE.DirectionalLight(0x8fc6ff, 0.85);
  planetShine.position.set(0, 2.4, -6);
  planetShine.target.position.set(0, 0.8, 1.5);
  stationRig.add(planetShine);
  stationRig.add(planetShine.target);

  // Takes the renderer so the planet's textures can pick up its max anisotropy.
  const space = buildSpace(renderer, { quality: options.quality });
  scene.add(space.group);

  const controls = createFpvControls(camera, canvas, {
    bounds: ROOM_BOUNDS,
    obstacles: pod.obstacles,
    eyeHeight: EYE_HEIGHT,
    onLockChange: options.onLockChange,
    joystick: options.joystick
  });

  // Silent, and not even fetched, until the radio on the desk is switched on. See `audio.ts`.
  const audio = createPodAudio();

  function toggleRadio() {
    audio.setOn(!audio.isOn());
    pod.setRadioLit(audio.isOn());
  }

  const interactions = createInteractions(
    camera,
    [
      // Dropped entirely when `src/audio/` is empty — the unit stays on the desk as a prop,
      // but a prompt offering to switch on something that cannot make a sound is a lie.
      ...(audio.available
        ? [
            {
              object: pod.radioTarget,
              reach: RADIO_REACH,
              label: () => (audio.isOn() ? 'switch the radio off' : 'switch the radio on'),
              activate: toggleRadio
            }
          ]
        : [])
    ],
    { prompt: options.interactPrompt }
  );

  // --- post-processing -----------------------------------------------------------------
  // The LED strips and the atmosphere are authored above 1.0 on purpose; bloom is what
  // turns them into light rather than just bright pixels. `OutputPass` has to come last —
  // with a composer in play the renderer skips its own tone mapping and colour conversion.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // A high threshold on purpose: only the strips and the planet's limb are authored over
  // 1.0, so nothing else in the room picks up a halo it hasn't earned.
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.4, 1.0));
  composer.addPass(new OutputPass());

  const orbitMatrix = new THREE.Matrix4();

  function updateOrbit(elapsed: number) {
    const angle = ORBIT_START + (elapsed / ORBIT_PERIOD) * Math.PI * 2;
    const radius = PLANET_RADIUS + altitude;
    stationRig.position
      .copy(ORBIT_NOON)
      .multiplyScalar(Math.cos(angle) * radius)
      .addScaledVector(ORBIT_DAWN, Math.sin(angle) * radius);

    // `Matrix4.lookAt` puts +Z *away* from the target, so -Z — and with it the window wall
    // built on -Z in `pod.ts` — ends up facing the planet. The orbit normal is the up hint
    // rather than world up: it is perpendicular to the line to the planet by construction,
    // so `lookAt` can never degenerate, which world up would do over the poles of an orbit
    // this steeply inclined.
    orbitMatrix.lookAt(stationRig.position, PLANET_CENTER, ORBIT_NORMAL);
    stationRig.quaternion.setFromRotationMatrix(orbitMatrix);
    // Yaw first, then pitch: turning about the local vertical and *then* lifting the nose is
    // what keeps the horizon level. Doing it the other way round banks the pod instead.
    stationRig.rotateZ(-WINDOW_YAW);
    stationRig.rotateX(pitchFor(altitude));
  }

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
    // Cap dt so a long pause (a background tab, a slow first frame) doesn't teleport the
    // player across the room on the next frame.
    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;

    controls.update(dt);
    updateOrbit(elapsed);
    space.update(elapsed, dt);
    composer.render();
    audio.update(dt);
    // After the render, deliberately. The interaction raycast reads `camera.matrixWorld`
    // without updating it, and this camera hangs off a rig that `updateOrbit()` has just
    // moved — before the render it would be tested from where the station was last frame,
    // several kilometres away. See the note on `Interactions.update`.
    interactions.update(dt);
  }

  window.addEventListener('resize', resize);

  function start() {
    if (running) return;
    running = true;
    resize(); // the canvas had no size while the view was hidden
    controls.setEnabled(true);
    interactions.setEnabled(true);
    // Fades back in only if the radio was left on; it remembers where the track had got to,
    // so coming back in is a continuation rather than the playlist starting over.
    audio.setEnabled(true);
    clock.start();
    tick();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    controls.setEnabled(false);
    interactions.setEnabled(false);
    audio.setEnabled(false);
    clock.stop();
  }

  /**
   * Not used by this repo — the page keeps every view it has built, so there is nothing to
   * tear down. It exists for the port: a Svelte component unmounts, and without this the
   * renderer, its context and the resize listener leak on every mount.
   */
  function dispose() {
    stop();
    window.removeEventListener('resize', resize);
    interactions.dispose();
    controls.dispose();
    audio.dispose();
    composer.dispose();
    renderer.dispose();
  }

  return {
    start,
    stop,
    dispose,
    setTextureQuality: (quality: TextureQuality) => space.setQuality(quality),
    /**
     * Moves the orbit. Takes effect on the next frame — `updateOrbit()` re-derives both the
     * radius and the window pitch from it every tick, so dragging the slider is continuous
     * and needs no easing of its own.
     */
    setAltitude: (value: number) => {
      altitude = THREE.MathUtils.clamp(value, ALTITUDE_RANGE.min, ALTITUDE_RANGE.max);
    }
  };
}
