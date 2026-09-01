import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { clampToRegions, type Region } from './regions';

/**
 * A first-person walk-around controller with two input paths, because the site has to work on
 * a tablet as well as a desktop:
 *
 * - **Mouse:** click to take the pointer lock, then mouse to look and WASD/arrows to move.
 * - **Touch:** drag anywhere on the canvas to look, and push the on-screen stick to move.
 *
 * The touch path is not a nicety. **iOS Safari has no Pointer Lock API at all** — not
 * disabled, absent — so `PointerLockControls.lock()` throws there and mouse-look never
 * happens. Both paths write the same `camera.quaternion` and both feed the same velocity
 * smoothing, so a device with a trackpad *and* a touchscreen can use either at any moment.
 *
 * Eye height is pinned to the floor and there is no astronaut body — this is a camera with a
 * walking speed. `PointerLockControls` writes `camera.position`/`camera.quaternion` and reads
 * `camera.matrix`, all of which are *local* to the camera's parent. That's what lets the
 * camera hang off the orbiting station rig in `planet-view.ts` and still be driven in plain
 * station coordinates here — `regions` is in station space, not world space.
 */

/** Radians of rotation per pixel dragged. Pointer-lock mouse look uses 0.002 per pixel. */
const TOUCH_LOOK_SPEED = 0.0035;

/** Stop just short of straight up and straight down, where yaw becomes meaningless. */
const PITCH_LIMIT = Math.PI / 2 - 0.02;

/** Fraction of the stick's travel that still counts as centred, so a resting thumb can't drift. */
const STICK_DEADZONE = 0.12;

/**
 * How far the eye is held off furniture. Smaller than `WALL_CLEARANCE`, which also has to
 * account for the walls being flat planes you would otherwise press your face against; here
 * the shapes are solid and standing close to them is the point.
 */
const PLAYER_RADIUS = 0.32;

/**
 * Whether this browser has the Pointer Lock API. iOS has never implemented it, and calling
 * `lock()` there is a TypeError rather than a no-op, so every use of it is guarded.
 */
const POINTER_LOCK_SUPPORTED =
  typeof document !== 'undefined' && 'requestPointerLock' in document.documentElement;

export interface FpvOptions {
  /**
   * The walkable floor, as a union of convex XZ polygons in the same space as
   * `camera.position`. See `regions.ts` — this was one `Box3` when there was one room, and a
   * station with arms off a hub is not a box.
   */
  regions: Region[];
  /**
   * Footprints in the walkable plane the player is pushed back out of — furniture. Optional,
   * and empty by default: an empty room needs none, and neither will EVA.
   */
  obstacles?: THREE.Box2[];
  eyeHeight: number;
  /** Top walking speed, units/second. */
  speed?: number;
  onLockChange?: (locked: boolean) => void;
  /**
   * The on-screen movement stick, shown by CSS only on coarse-pointer devices. Its first
   * element child is moved about as the knob. Omit it and touch users can look but not walk.
   */
  joystick?: HTMLElement | null;
}

export interface FpvControls {
  update(dt: number): void;
  /** Enables/disables input. Disabling also releases the pointer and drops any held keys. */
  setEnabled(enabled: boolean): void;
  /**
   * Takes the pointer lock without waiting for the player to click the canvas — for entering
   * the room from somewhere that was itself a click, so they arrive already looking around.
   * A no-op where there is no Pointer Lock API (iOS) or while input is disabled. **The caller
   * must still hold a user gesture**: the browser refuses the request otherwise, and there is
   * no way to ask politely.
   */
  lock(): void;
  dispose(): void;
}

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

export function createFpvControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
  options: FpvOptions
): FpvControls {
  const { regions, obstacles = [], eyeHeight, speed = 2.4, onLockChange, joystick = null } = options;

  const controls = new PointerLockControls(camera, domElement);
  const keys = new Set<string>();
  const knob = joystick?.firstElementChild as HTMLElement | null;
  // Reused by the touch look handler. YXZ so yaw and pitch stay independent and there is
  // never any roll, which is the same order PointerLockControls uses.
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  /** Stick output in room-plane terms: x strafes, y walks forward, each -1..1. */
  const stick = new THREE.Vector2();
  let lookPointer: number | null = null;
  let stickPointer: number | null = null;
  let lastX = 0;
  let lastY = 0;
  // Room-plane velocity: x is strafe, y is forward. Smoothed towards the input direction
  // rather than snapped, so starting and stopping has a little weight to it.
  const velocity = new THREE.Vector2();
  /** Scratch for the floor clamp, so `update` allocates nothing per frame. */
  const _floor = new THREE.Vector2();
  let enabled = false;

  const held = (codes: string[]) => (codes.some((code) => keys.has(code)) ? 1 : 0);

  function onKeyDown(event: KeyboardEvent) {
    if (enabled) keys.add(event.code);
  }

  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.code);
  }

  function onClick() {
    // Touch has no lock to take — it looks after itself in the pointer handlers below.
    if (enabled && POINTER_LOCK_SUPPORTED) controls.lock();
  }

  // --- touch: drag to look ---------------------------------------------------------------

  function onPointerDown(event: PointerEvent) {
    // Mouse goes through the pointer lock instead; this is for fingers and pens.
    if (!enabled || event.pointerType === 'mouse' || lookPointer !== null) return;
    lookPointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    // Capture, so a drag that wanders off the canvas keeps steering rather than sticking.
    domElement.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== lookPointer) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    // Read the current orientation back rather than keeping a private copy: pointer-lock
    // mouse look writes the same quaternion, so the two paths can be interleaved freely.
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= dx * TOUCH_LOOK_SPEED;
    euler.x = THREE.MathUtils.clamp(euler.x - dy * TOUCH_LOOK_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
    camera.quaternion.setFromEuler(euler);
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerId === lookPointer) lookPointer = null;
  }

  // --- touch: the movement stick ----------------------------------------------------------

  function moveKnob(x: number, y: number) {
    if (knob) knob.style.transform = `translate(${x}px, ${y}px)`;
  }

  function onStickDown(event: PointerEvent) {
    if (!enabled || !joystick || stickPointer !== null) return;
    stickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    onStickMove(event);
  }

  function onStickMove(event: PointerEvent) {
    if (event.pointerId !== stickPointer || !joystick) return;
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = (event.clientX - (rect.left + radius)) / radius;
    let dy = (event.clientY - (rect.top + radius)) / radius;

    const reach = Math.hypot(dx, dy);
    if (reach > 1) {
      dx /= reach;
      dy /= reach;
    }
    // Screen y grows downwards; walking forward is -y.
    const live = Math.hypot(dx, dy) > STICK_DEADZONE;
    stick.set(live ? dx : 0, live ? -dy : 0);
    moveKnob(dx * radius * 0.55, dy * radius * 0.55);
  }

  function releaseStick(event: PointerEvent) {
    if (event.pointerId !== stickPointer) return;
    stickPointer = null;
    stick.set(0, 0);
    moveKnob(0, 0);
  }

  function onLock() {
    onLockChange?.(true);
  }

  function onUnlock() {
    keys.clear();
    onLockChange?.(false);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  domElement.addEventListener('click', onClick);
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', onPointerUp);
  joystick?.addEventListener('pointerdown', onStickDown);
  joystick?.addEventListener('pointermove', onStickMove);
  joystick?.addEventListener('pointerup', releaseStick);
  joystick?.addEventListener('pointercancel', releaseStick);
  controls.addEventListener('lock', onLock);
  controls.addEventListener('unlock', onUnlock);

  /**
   * Minimum-translation push-out against the furniture. Each footprint is inflated by
   * `PLAYER_RADIUS`, and an eye found inside one is shoved out along whichever axis it is
   * least deep in — which for a walk into a flat desk edge is straight back out of it.
   *
   * Not swept: a fast enough step could pass clean through a box between two frames. At the
   * 2.4 m/s walking speed and the 0.1 s dt cap in `planet-view.ts` that is a 24 cm step
   * against a 70 cm desk, so it cannot happen without changing one of those numbers.
   */
  function pushOutOfObstacles() {
    for (const box of obstacles) {
      const minX = box.min.x - PLAYER_RADIUS;
      const maxX = box.max.x + PLAYER_RADIUS;
      const minZ = box.min.y - PLAYER_RADIUS;
      const maxZ = box.max.y + PLAYER_RADIUS;
      const { x, z } = camera.position;
      if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) continue;

      const left = x - minX;
      const right = maxX - x;
      const back = z - minZ;
      const front = maxZ - z;
      const least = Math.min(left, right, back, front);

      if (least === left) camera.position.x = minX;
      else if (least === right) camera.position.x = maxX;
      else if (least === back) camera.position.z = minZ;
      else camera.position.z = maxZ;
    }
  }

  function update(dt: number) {
    const forward = held(FORWARD_KEYS) - held(BACK_KEYS) + stick.y;
    const strafe = held(RIGHT_KEYS) - held(LEFT_KEYS) + stick.x;

    // Clamped rather than normalised: keys are 0 or 1, so a diagonal still comes back to full
    // speed and no faster, but a half-pushed stick walks at half speed instead of snapping to
    // a run.
    const length = Math.hypot(strafe, forward);
    const scale = length > 1 ? 1 / length : 1;
    const targetX = strafe * scale * speed;
    const targetY = forward * scale * speed;

    // Exponential smoothing, framed in terms of dt so it behaves the same at any frame rate.
    const k = 1 - Math.exp(-12 * dt);
    velocity.x += (targetX - velocity.x) * k;
    velocity.y += (targetY - velocity.y) * k;

    controls.moveRight(velocity.x * dt);
    controls.moveForward(velocity.y * dt);

    // Held inside the union of the walkable regions. Unlike the furniture below this is a
    // *clamp*, not a push-out: a position outside every region is moved onto the nearest one
    // whatever the step size, so no walking speed can pass through a wall.
    _floor.set(camera.position.x, camera.position.z);
    clampToRegions(_floor, regions);
    camera.position.x = _floor.x;
    camera.position.z = _floor.y;
    // Twice, because the footprints can touch: one pass is enough to push you out of the desk
    // and straight into the chair beside it.
    pushOutOfObstacles();
    pushOutOfObstacles();
    camera.position.y = eyeHeight;
  }

  function lock() {
    if (enabled && POINTER_LOCK_SUPPORTED) controls.lock();
  }

  function setEnabled(next: boolean) {
    if (next === enabled) return;
    enabled = next;
    if (!enabled) {
      keys.clear();
      velocity.set(0, 0);
      stick.set(0, 0);
      moveKnob(0, 0);
      lookPointer = null;
      stickPointer = null;
      if (POINTER_LOCK_SUPPORTED) controls.unlock();
    }
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    domElement.removeEventListener('click', onClick);
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
    domElement.removeEventListener('pointercancel', onPointerUp);
    joystick?.removeEventListener('pointerdown', onStickDown);
    joystick?.removeEventListener('pointermove', onStickMove);
    joystick?.removeEventListener('pointerup', releaseStick);
    joystick?.removeEventListener('pointercancel', releaseStick);
    controls.removeEventListener('lock', onLock);
    controls.removeEventListener('unlock', onUnlock);
    controls.dispose();
  }

  return { update, setEnabled, lock, dispose };
}
