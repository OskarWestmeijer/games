import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildPod, EYE_HEIGHT, ROOM, ROOM_BOUNDS } from './pod';
import { buildSpace, ORBIT_ALTITUDE, PLANET_RADIUS } from './space';
import { createFpvControls } from './fpv-controls';

/**
 * "Planet view": a one-room space pod in orbit, with a first-person camera inside it and a
 * big window looking out at the planet.
 *
 * The camera is a *child* of `stationRig`, the group that carries the pod around its orbit.
 * That's the whole trick that keeps this simple: the rig handles orbiting and staying
 * pointed at the planet, while the player walks around in plain room coordinates,
 * oblivious to where the room currently is in space.
 */

const ORBIT_RADIUS = PLANET_RADIUS + ORBIT_ALTITUDE;

/** Seconds for one full lap. Slow enough to be ambient rather than a ride. */
const ORBIT_PERIOD = 300;

/**
 * Where on the orbit we start, in radians. Chosen so the terminator is already crossing
 * the visible face: the planet opens lit, with the night side and its city lights sliding
 * into view over the following minutes.
 */
const ORBIT_START = 1.45;

/**
 * How far the pod is pitched up from pointing straight at the planet's centre, in radians.
 *
 * This is the one knob for how the planet is framed in the window. From this altitude the
 * limb sits `asin(R / (R + altitude))` ≈ 54° off the planet-centre axis, so pitching up by
 * ~52° leaves it just above the eyeline — the horizon lands a little over halfway up the
 * window, with the surface below it and stars above. Raise it to push the horizon down.
 */
const WINDOW_PITCH = 0.90;

const PLANET_CENTER = new THREE.Vector3(0, 0, 0);
const ORBIT_UP = new THREE.Vector3(0, 1, 0);

export interface PlanetViewOptions {
  onLockChange?: (locked: boolean) => void;
}

export function createPlanetView(canvas: HTMLCanvasElement, options: PlanetViewOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  stationRig.add(buildPod());

  // Standing back from the window, so it frames the planet rather than filling the screen.
  camera.position.set(0, EYE_HEIGHT, 1.2);
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

  const space = buildSpace();
  scene.add(space.group);

  const controls = createFpvControls(camera, canvas, {
    bounds: ROOM_BOUNDS,
    eyeHeight: EYE_HEIGHT,
    onLockChange: options.onLockChange
  });

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
    stationRig.position.set(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS);

    // `Matrix4.lookAt` puts +Z *away* from the target, so -Z — and with it the window wall
    // built on -Z in `pod.ts` — ends up facing the planet.
    orbitMatrix.lookAt(stationRig.position, PLANET_CENTER, ORBIT_UP);
    stationRig.quaternion.setFromRotationMatrix(orbitMatrix);
    stationRig.rotateX(WINDOW_PITCH);
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
    space.update(elapsed);
    composer.render();
  }

  window.addEventListener('resize', resize);

  function start() {
    if (running) return;
    running = true;
    resize(); // the canvas had no size while the view was hidden
    controls.setEnabled(true);
    clock.start();
    tick();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    controls.setEnabled(false);
    clock.stop();
  }

  return { start, stop };
}
