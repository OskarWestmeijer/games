import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildStation, EYE_HEIGHT } from './station';
import { createInteractions } from './interaction';
import { buildSpace, ORBIT_DAWN, ORBIT_NOON, ORBIT_NORMAL, PLANET_RADIUS } from './space';
import type { TextureQuality } from './space';
import { createFpvControls } from './fpv-controls';
import { createPodAudio } from './audio';
import { createFlight, pitchFor, ROLL } from './flight';

/**
 * "Planet view": a space station in orbit, with a first-person camera walking around inside it.
 *
 * The camera is a *child* of `stationRig`, the group that carries the station around its
 * orbit. That is the whole trick that keeps this simple: the rig handles orbiting and
 * pointing, while the player walks around in plain station coordinates, oblivious to where
 * the station currently is in space.
 *
 * The division of labour is worth knowing before touching any of it. What the station *is*
 * lives in `station/`. What it is *doing* — altitude, attitude, orbit mode, the clock — lives
 * in `flight.ts`, because the navigation console writes it and both the rig and the hub globe
 * read it. This file is only the seam between those and the renderer.
 */

const PLANET_CENTER = new THREE.Vector3(0, 0, 0);

export interface PlanetViewOptions {
  onLockChange?: (locked: boolean) => void;
  /** Which surface map set to open on. See `TextureQuality` in `space.ts`. */
  quality?: TextureQuality;
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
  // Deliberately under 1: the station is meant to be a dark set of rooms lit by strip lights
  // and the planet, and it reads as washed-out neon long before it reads as too dim.
  renderer.toneMappingExposure = 0.8;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);

  // The station spans ~0.1-30 units from the eye and the planet a few hundred; far enough
  // apart, and both smooth enough, that a plain 24-bit depth buffer is plenty. No need for
  // a logarithmic one.
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 20000);

  const stationRig = new THREE.Group();
  scene.add(stationRig);

  // Built before the station, because the hub's globe is made from this space's Earth — the
  // same maps, the same map cache, the same sun. See `station/globe.ts`.
  // Takes the renderer so the planet's textures can pick up its max anisotropy.
  const space = buildSpace(renderer, { quality: options.quality });
  scene.add(space.group);

  const station = buildStation({
    renderer,
    sunDirection: space.sunDirection,
    quality: options.quality
  });
  stationRig.add(station.group);

  const flight = createFlight();

  // At the desk in the office, as if you had just got up from the chair. Moving the eye a few
  // metres does not disturb the framing: the horizon is an angle about the optical axis and
  // the planet is 300 units away, so the limb sits where it always did. What changes is how
  // much of a window is in view.
  camera.position.set(station.spawn.x, EYE_HEIGHT, station.spawn.z);
  // YXZ, matching `PointerLockControls`: any other order turns an initial yaw into roll.
  camera.rotation.order = 'YXZ';
  camera.rotation.y = station.spawn.yaw;
  stationRig.add(camera);

  // The only light not owned by a module. Everything else fades with the room it belongs to;
  // see `station.updateLighting`.
  stationRig.add(new THREE.AmbientLight(0x1a2430, 0.55));

  const controls = createFpvControls(camera, canvas, {
    regions: station.regions,
    obstacles: station.obstacles,
    eyeHeight: EYE_HEIGHT,
    onLockChange: options.onLockChange,
    joystick: options.joystick
  });

  // Not fetched until switched on — but that's on by default now, so it loads immediately.
  // See `audio.ts`. `setOn` is a no-op when the folders are empty, so this stays silent when
  // there's nothing to play.
  const audio = createPodAudio();
  audio.setOn(true);
  station.setRadioLit(audio.isOn());

  // Autoplay is blocked until the page has seen a user gesture, and `setOn(true)` above just
  // ran before one — so pick playback back up on the first click/tap/key the view gets.
  const onFirstGesture = () => audio.resume();
  canvas.addEventListener('pointerdown', onFirstGesture, { once: true });
  window.addEventListener('keydown', onFirstGesture, { once: true });

  const interactions = createInteractions(
    camera,
    station.targets(flight, {
      available: audio.available,
      isOn: () => audio.isOn(),
      toggle: () => {
        audio.setOn(!audio.isOn());
        station.setRadioLit(audio.isOn());
      }
    }),
    { prompt: options.interactPrompt }
  );

  // --- post-processing -----------------------------------------------------------------
  // The LED strips, the globe and the atmosphere are authored above 1.0 on purpose; bloom is
  // what turns them into light rather than just bright pixels. `OutputPass` has to come last
  // — with a composer in play the renderer skips its own tone mapping and colour conversion.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // A high threshold on purpose: only those three are authored over 1.0, so nothing else in
  // the station picks up a halo it hasn't earned.
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.4, 1.0));
  composer.addPass(new OutputPass());

  const orbitMatrix = new THREE.Matrix4();

  /**
   * Places and aims the station.
   *
   * `Matrix4.lookAt` puts +Z *away* from the target, so -Z ends up on the nadir — and the
   * office's window wall, which has always been built on -Z, ends up facing the planet. The
   * orbit normal is the up hint rather than world up: it is perpendicular to the line to the
   * planet by construction, so `lookAt` can never degenerate, which world up would do over
   * the poles of an orbit this steeply inclined.
   *
   * **The order of the three rotations is load-bearing.**
   *
   * - `rotateZ` is about the nadir axis, because that is where `lookAt` just put local Z. A
   *   horizon is a cone about the nadir, so rolling about it maps that cone onto itself: this
   *   picks which compass bearing a window looks along and can never tilt the horizon or move
   *   it up or down.
   * - `rotateX` then lifts the nose off the nadir by the pitch solved from the horizon dial.
   * - `rotateY` last, about the station's own vertical, swings the planet round to another
   *   arm. It has to come after the pitch: applied before it, the bearing cross-couples into
   *   the pitch and flattens it to zero at 90°, which is a very confusing bug to look at.
   *
   * Turning the station by `+bearing` moves the planet to `+bearing` in station azimuth,
   * where azimuth 0 is -Z (the office) and +90° is +X (navigation) — so the detent names in
   * `flight.ts` mean what they say.
   */
  function updateOrbit() {
    const { orbitAngle, altitude, horizon, bearing } = flight.state;
    const radius = PLANET_RADIUS + altitude;
    stationRig.position
      .copy(ORBIT_NOON)
      .multiplyScalar(Math.cos(orbitAngle) * radius)
      .addScaledVector(ORBIT_DAWN, Math.sin(orbitAngle) * radius);

    orbitMatrix.lookAt(stationRig.position, PLANET_CENTER, ORBIT_NORMAL);
    stationRig.quaternion.setFromRotationMatrix(orbitMatrix);
    stationRig.rotateZ(-ROLL);
    stationRig.rotateX(pitchFor(altitude, horizon));
    stationRig.rotateY(bearing);
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
    // player across the station on the next frame.
    const dt = Math.min(clock.getDelta(), 0.1);

    controls.update(dt);
    flight.update(dt);
    updateOrbit();
    station.updateLighting(camera.position);
    station.globe.update(flight.state, stationRig.quaternion, dt);
    // Simulated time, not wall-clock: the console's clock control scales it, and the planet's
    // spin, the moon and the terminator all have to speed up together or they drift apart.
    // The real `dt` still goes through, because the texture cross-fade is a load, not a
    // simulation, and has no business running at 8x.
    space.update(flight.state.simTime, dt);
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
    window.removeEventListener('keydown', onFirstGesture);
    canvas.removeEventListener('pointerdown', onFirstGesture);
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
    /**
     * Both at once: the planet out of the window and the globe in the hub are the same world,
     * so they have to be showing the same map set or the hub is lying about the surface.
     */
    setTextureQuality: (quality: TextureQuality) =>
      Promise.all([space.setQuality(quality), station.globe.setQuality(quality)]).then(() => undefined)
  };
}
