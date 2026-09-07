import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  buildSpace,
  ATMOSPHERE_RADIUS,
  MOON_ORBIT_RADIUS,
  MOON_RADIUS,
  PLANET_RADIUS,
  SUN_DIR
} from './space';
import type { TextureQuality } from './space';

/**
 * "Planet inspector": the same world as the planet view with the pod taken away and the
 * camera put outside on an orbit control. Planet view is a place to stand and look out of a
 * window; this is the view for actually studying the planet — swing round it, drop to the
 * station's altitude to read the surface, drag the sun across to light whichever face you
 * want to see.
 *
 * It builds its own `buildSpace()` rather than sharing the planet view's. The two scenes
 * then have independent suns (moving the sun here doesn't relight the pod's window) and
 * independent WebGL resources, at the cost of a second copy of the textures on the GPU —
 * which is the same trade the two renderers already make.
 */

/**
 * How close the camera may get: just outside the outer atmosphere shell, which is wrapped
 * around any camera that gets inside it and smears glow over the whole sky (see
 * `ATMOSPHERE_RADIUS`). The 3% is margin, not superstition — at exactly the shell radius the
 * near clip plane is already through it.
 *
 * Deliberately *not* tied to where the pod flies. The pod's altitude is a slider now, and
 * this floor is a property of the atmosphere.
 */
const MIN_DISTANCE = ATMOSPHERE_RADIUS * 1.03;
/**
 * How far out the camera may go. Eight planet radii frames the whole disc among stars with
 * room to spare — but it also has to stay well inside the moon's orbit, or pulling back far
 * enough will eventually fly the camera through the moon. Three moon radii of clearance is
 * what keeps the moon from swallowing the frame when the two line up; the moon is the
 * binding constraint now that it is 400 across.
 */
const MAX_DISTANCE = Math.min(PLANET_RADIUS * 8, MOON_ORBIT_RADIUS - MOON_RADIUS * 3);

/** Far enough out for the whole disc plus a margin of stars. */
const START_DISTANCE = PLANET_RADIUS * 3;

/**
 * Where the camera starts, as a direction from the planet's centre. Roughly 53° off
 * `SUN_DIR`, so the opening frame has the terminator and a slice of the night side in it
 * rather than a flatly lit disc.
 */
const START_DIRECTION = new THREE.Vector3(0.2, 0.3, 0.93).normalize();

/**
 * The sun slider sweeps the sun around the equator at its original elevation — one knob
 * instead of two, and elevation is the axis that matters least for lighting a given face.
 */
const SUN_ELEVATION = Math.asin(SUN_DIR.y);

/** Slider default, in degrees: the same sun the pod flies under. */
export const DEFAULT_SUN_AZIMUTH =
  (THREE.MathUtils.radToDeg(Math.atan2(SUN_DIR.z, SUN_DIR.x)) + 360) % 360;

export interface PlanetInspectOptions {
  /** Which surface map set to open on. See `TextureQuality` in `space.ts`. */
  quality?: TextureQuality;
}

export function createPlanetInspect(canvas: HTMLCanvasElement, options: PlanetInspectOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // See the note in `planet-view.ts`: retina tablets pay four times over for a scene that is
  // almost entirely full-screen shader.
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2)
  );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Unlike the pod's dim interior (0.8 there), nothing here is meant to sit in shadow.
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);

  // Near/far only has to span the planet and the star sphere at 8000. At the closest
  // approach the surface is ~20 units away, so a near plane of 1 is plenty of headroom and
  // keeps a plain depth buffer precise.
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 20000);
  camera.position.copy(START_DIRECTION).multiplyScalar(START_DISTANCE);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  // The planet is the subject: the target stays on its centre, so there is nothing to pan to.
  controls.enablePan = false;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  controls.zoomSpeed = 0.6;

  // No spin: a planet you are inspecting should hold still, and the sun slider covers what
  // the rotation was there to provide.
  const space = buildSpace(renderer, { spinRate: 0, quality: options.quality });
  scene.add(space.group);

  // Same reasoning as planet view: the atmosphere is authored over 1.0 so bloom turns it
  // into light, and `OutputPass` has to stay last in the chain.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.4, 1.0));
  composer.addPass(new OutputPass());

  const sunDir = new THREE.Vector3();

  /** Sweeps the sun around the equator. Degrees, 0..360; see `DEFAULT_SUN_AZIMUTH`. */
  function setSunAzimuth(degrees: number) {
    const azimuth = THREE.MathUtils.degToRad(degrees);
    const horizontal = Math.cos(SUN_ELEVATION);
    space.setSunDirection(
      sunDir.set(Math.cos(azimuth) * horizontal, Math.sin(SUN_ELEVATION), Math.sin(azimuth) * horizontal)
    );
  }

  setSunAzimuth(DEFAULT_SUN_AZIMUTH);

  /**
   * Orbit controls rotate the camera about the planet's centre, but what the eye judges is
   * how fast the *surface* slides past — and that is amplified by `distance / altitude`,
   * which is 16x at the closest approach. Scaling the rotate speed by the inverse keeps a
   * drag worth about the same amount of screen movement at every zoom level.
   */
  function updateRotateSpeed() {
    const distance = controls.getDistance();
    controls.rotateSpeed = THREE.MathUtils.clamp((distance - PLANET_RADIUS) / distance, 0.04, 1.0);
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
    const dt = Math.min(clock.getDelta(), 0.1);

    updateRotateSpeed();
    controls.update();
    space.update(clock.elapsedTime, dt);
    composer.render();
  }

  window.addEventListener('resize', resize);

  function start() {
    if (running) return;
    running = true;
    resize(); // the canvas had no size while the view was hidden
    controls.enabled = true;
    clock.start();
    tick();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    controls.enabled = false;
    clock.stop();
  }

  return {
    start,
    stop,
    setSunAzimuth,
    setTextureQuality: (quality: TextureQuality) => space.setQuality(quality)
  };
}
