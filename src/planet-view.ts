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
 * pointing, while the player walks around in plain station coordinates — on either of the two
 * decks — oblivious to where the station currently is in space.
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

  // At the desk on the lower floor, as if you had just got up from the chair. Moving the eye a
  // few metres does not disturb the framing: the horizon is an angle about the optical axis and
  // the planet is 300 units away, so the limb sits where it always did. What changes is how
  // much of the glass is in view — and, going up to the bridge, where in it the limb lands.
  // See "The two storeys want different horizons" in CLAUDE.md.
  camera.position.set(station.spawn.x, station.spawn.y + EYE_HEIGHT, station.spawn.z);
  // YXZ, matching `PointerLockControls`: any other order turns an initial yaw into roll.
  camera.rotation.order = 'YXZ';
  camera.rotation.y = station.spawn.yaw;
  stationRig.add(camera);

  // The only lights not owned by the station. Everything else is staged in `station/index.ts`
  // and `station/bridge.ts`.
  //
  // A hemisphere on top of the ambient, because point lights alone cannot fill a room this
  // size: they fall off as 1/r², and from a roof at 6.5 m the floor got about 2% of the lamp,
  // which is why the whole aft half used to render as a black void. The hemisphere is the cheap
  // fill that makes the hull's own surfaces readable; the lamps are then free to be pools
  // rather than the only source. Warm above, near-black below — the floor should not glow.
  stationRig.add(new THREE.AmbientLight(0x2b2622, 0.7));
  //
  // The ground half is *not* near-black, and that is deliberate rather than sloppy: a hemisphere
  // light shades by which way a normal points, and the inside of a roof points **down**. Set the
  // ground colour dark for realism and the entire ceiling of the hall renders black, with the
  // LED strips floating in a void. Here it stands in for the bounce off a pale floor.
  stationRig.add(new THREE.HemisphereLight(0xffd0a4, 0x4a4048, 0.75));

  const controls = createFpvControls(camera, canvas, {
    decks: station.decks,
    obstacles: station.obstacles,
    spawnLevel: station.spawn.level,
    eyeHeight: EYE_HEIGHT,
    onLockChange: options.onLockChange,
    joystick: options.joystick
  });

  // The hull hum comes up with the view (`start()` below); the music waits for the radio,
  // which starts off. See `audio.ts`. Nothing is fetched for a layer until it is wanted, and
  // an empty folder is a supported state.
  const audio = createPodAudio();
  station.setRadioLit(audio.isOn());

  /** Set by the dev inspection handle below; parks the walk clamp so a shot can be framed. */
  let freecam = false;

  // Autoplay is blocked until the page has seen a user gesture, and the bed starts before one
  // — so pick playback back up on the first click/tap/key the view gets.
  const onFirstGesture = () => audio.resume();
  canvas.addEventListener('pointerdown', onFirstGesture, { once: true });
  window.addEventListener('keydown', onFirstGesture, { once: true });

  /** The radio's switch, and the one place its indicator is kept honest. */
  function toggleMusic() {
    audio.setOn(!audio.isOn());
    station.setRadioLit(audio.isOn());
  }

  /**
   * M toggles the music from anywhere aboard. The unit on the desk is still the real control
   * and the only *visible* one — this adds no HUD, no button and nothing to look at, which is
   * the line CLAUDE.md's "diegetic controls" item actually draws; it just spares you the walk
   * when the music is the one thing you came to change. Gated on `running`, or a keypress
   * meant for the asset viewer would move the radio's state behind its back. There is no M key
   * on an iPad, which is why the desk unit stays the control this is a shortcut *to*.
   */
  function onMusicKey(event: KeyboardEvent) {
    if (running && event.code === 'KeyM') toggleMusic();
  }
  window.addEventListener('keydown', onMusicKey);

  const interactions = createInteractions(
    camera,
    station.targets(flight, {
      available: audio.available,
      isOn: () => audio.isOn(),
      toggle: toggleMusic
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
   * hall's window wall, which has always been built on -Z, ends up facing the planet. The
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
   *   face. It has to come after the pitch: applied before it, the bearing cross-couples into
   *   the pitch and flattens it to zero at 90°, which is a very confusing bug to look at.
   *
   * Turning the station by `+bearing` moves the planet to `+bearing` in station azimuth,
   * where azimuth 0 is -Z (the window) and +90° is +X (the stair wall) — so the detent names
   * in `flight.ts` mean what they say.
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

  /**
   * Dev-only inspection handle, for `dev/shots.mjs`.
   *
   * The station's shape is judgeable only by eye — the walk harness proves you can get
   * everywhere and fit under the roof, and says nothing whatever about whether it looks like
   * the thing it was modelled on. So a headless browser drives this scene and screenshots it,
   * and that needs a camera the deck clamp will not immediately undo: `freecam` is what parks
   * `controls.update()` for the duration.
   *
   * `import.meta.env.DEV` is a compile-time constant, so Rollup folds this whole block away in
   * a production build and `__station` never exists on the deployed site.
   */
  if (import.meta.env.DEV) {
    let mapsReady = false;
    space.ready.then(() => {
      mapsReady = true;
    });
    const lookMatrix = new THREE.Matrix4();
    (window as unknown as Record<string, unknown>).__station = {
      camera,
      scene,
      stationRig,
      station,
      flight,
      space,
      get mapsReady() {
        return mapsReady;
      },
      /**
       * Put the eye at `pos` and aim it at `look`, both in **station** coordinates — the same
       * frame `DECKS` and the furniture are authored in, which is the only frame worth naming
       * a viewpoint in. Built with a local `Matrix4.lookAt` rather than `camera.lookAt`,
       * because that one works in world space and takes world up: with the rig thousands of
       * units away and steeply inclined it would both aim wrong and roll the horizon.
       */
      pose(pos: [number, number, number], look: [number, number, number]) {
        freecam = true;
        camera.position.set(pos[0], pos[1], pos[2]);
        lookMatrix.lookAt(
          new THREE.Vector3(pos[0], pos[1], pos[2]),
          new THREE.Vector3(look[0], look[1], look[2]),
          new THREE.Vector3(0, 1, 0)
        );
        camera.quaternion.setFromRotationMatrix(lookMatrix);
      },
      /** Hand the camera back to the player. */
      walk() {
        freecam = false;
      }
    };
  }

  const clock = new THREE.Clock(false);
  let rafId = 0;
  let running = false;

  function tick() {
    rafId = requestAnimationFrame(tick);
    // Cap dt so a long pause (a background tab, a slow first frame) doesn't teleport the
    // player across the station on the next frame.
    const dt = Math.min(clock.getDelta(), 0.1);

    if (!freecam) controls.update(dt);
    flight.update(dt);
    updateOrbit();
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
    // Brings the bed up, and the music too if the radio was left on. Both remember where they
    // had got to, so coming back in is a continuation rather than a restart.
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
    window.removeEventListener('keydown', onMusicKey);
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
