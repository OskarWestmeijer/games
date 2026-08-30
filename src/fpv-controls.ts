import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

/**
 * A first-person walk-around controller: mouse to look, WASD/arrows to move in the
 * horizontal plane, eye height pinned to the floor. There is no astronaut body — this is
 * a camera with a walking speed.
 *
 * `PointerLockControls` writes `camera.position`/`camera.quaternion` and reads
 * `camera.matrix`, all of which are *local* to the camera's parent. That's what lets the
 * camera hang off the orbiting station rig in `planet-view.ts` and still be driven in
 * plain room coordinates here — `bounds` is in room space, not world space.
 */

export interface FpvOptions {
  /** Walkable volume, in the same space as `camera.position` (i.e. room-local). */
  bounds: THREE.Box3;
  eyeHeight: number;
  /** Top walking speed, units/second. */
  speed?: number;
  onLockChange?: (locked: boolean) => void;
}

export interface FpvControls {
  update(dt: number): void;
  /** Enables/disables input. Disabling also releases the pointer and drops any held keys. */
  setEnabled(enabled: boolean): void;
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
  const { bounds, eyeHeight, speed = 2.4, onLockChange } = options;

  const controls = new PointerLockControls(camera, domElement);
  const keys = new Set<string>();
  // Room-plane velocity: x is strafe, y is forward. Smoothed towards the input direction
  // rather than snapped, so starting and stopping has a little weight to it.
  const velocity = new THREE.Vector2();
  let enabled = false;

  const held = (codes: string[]) => (codes.some((code) => keys.has(code)) ? 1 : 0);

  function onKeyDown(event: KeyboardEvent) {
    if (enabled) keys.add(event.code);
  }

  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.code);
  }

  function onClick() {
    if (enabled) controls.lock();
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
  controls.addEventListener('lock', onLock);
  controls.addEventListener('unlock', onUnlock);

  function update(dt: number) {
    const forward = held(FORWARD_KEYS) - held(BACK_KEYS);
    const strafe = held(RIGHT_KEYS) - held(LEFT_KEYS);

    // Normalised so walking diagonally isn't faster than walking straight.
    const length = Math.hypot(strafe, forward);
    const targetX = length > 0 ? (strafe / length) * speed : 0;
    const targetY = length > 0 ? (forward / length) * speed : 0;

    // Exponential smoothing, framed in terms of dt so it behaves the same at any frame rate.
    const k = 1 - Math.exp(-12 * dt);
    velocity.x += (targetX - velocity.x) * k;
    velocity.y += (targetY - velocity.y) * k;

    controls.moveRight(velocity.x * dt);
    controls.moveForward(velocity.y * dt);

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, bounds.min.x, bounds.max.x);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.min.z, bounds.max.z);
    camera.position.y = eyeHeight;
  }

  function setEnabled(next: boolean) {
    if (next === enabled) return;
    enabled = next;
    if (!enabled) {
      keys.clear();
      velocity.set(0, 0);
      controls.unlock();
    }
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    domElement.removeEventListener('click', onClick);
    controls.removeEventListener('lock', onLock);
    controls.removeEventListener('unlock', onUnlock);
    controls.dispose();
  }

  return { update, setEnabled, dispose };
}
