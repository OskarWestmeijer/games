import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { clampToRegions, deckAt, type Deck, type Region } from './regions';

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
 * Eye height is pinned to *the floor under you* and there is no astronaut body — this is a
 * camera with a walking speed. That floor is no longer a constant: the station is two storeys
 * now, so the walkable set is `Deck`s rather than `Region`s (see `regions.ts`), the controller
 * carries which storey you are on, and a staircase is a deck whose floor ramps. Nothing else
 * about movement changed.
 *
 * `PointerLockControls` writes `camera.position`/`camera.quaternion` and reads `camera.matrix`,
 * all of which are *local* to the camera's parent. That's what lets the camera hang off the
 * orbiting station rig in `planet-view.ts` and still be driven in plain station coordinates
 * here — `decks` is in station space, not world space.
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
 * The largest jump in floor height a single frame may make, in metres.
 *
 * `clampToRegions` moves a position outside every region onto the nearest boundary of the
 * *nearest* region, and with two storeys those two can be at different heights — a sideways
 * step from the hall floor towards the raised part of the staircase lands nearer the stair's
 * edge than the floor's, and without this the eye would be lifted through the mezzanine.
 * Rather than try to make the region layout unambiguous everywhere (it cannot be: the clamp is
 * a distance test, and distance knows nothing about height), a move that changes the floor by
 * more than a step is refused and the previous position kept.
 *
 * **It is bounded from both sides, and the window is not wide.** Below, by the steepest
 * *legitimate* frame — 2.4 m/s up a 33° flight with the 0.1 s dt cap is 0.156 m, so anything
 * under about 0.17 would make the stairs themselves unwalkable on a slow frame. Above, by the
 * shortest illegitimate one: walking at the flank of the flight, the clamp offers heights that
 * rise continuously from zero, so whatever this is set to is exactly how far up the side of the
 * staircase you can hop. At 0.5 that was a visible half-metre vault onto the third tread.
 */
const MAX_STEP = 0.25;

/**
 * Whether this browser has the Pointer Lock API. iOS has never implemented it, and calling
 * `lock()` there is a TypeError rather than a no-op, so every use of it is guarded.
 */
const POINTER_LOCK_SUPPORTED =
  typeof document !== 'undefined' && 'requestPointerLock' in document.documentElement;

export interface LeveledObstacle {
  box: THREE.Box2;
  /** Which storey it stands on. A desk downstairs must not block you on the mezzanine. */
  level: number;
}

export interface FpvOptions {
  /**
   * The walkable floor: convex XZ polygons, each with a height and a storey, in the same space
   * as `camera.position`. See `regions.ts` — this was one `Box3` when there was one room, then
   * a union of flat regions, and a hall with a mezzanine in it is neither.
   */
  decks: Deck[];
  /**
   * Footprints in the walkable plane the player is pushed back out of — furniture. Optional,
   * and empty by default: an empty room needs none, and neither will EVA.
   */
  obstacles?: LeveledObstacle[];
  /** Which storey the camera starts on. Must match the deck the spawn point sits in. */
  spawnLevel?: number;
  /** How far the eye sits above whatever floor it is standing on. */
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
/** The keys that mean "I want to walk", and so are worth taking the pointer for. */
const MOVE_KEYS = [...FORWARD_KEYS, ...BACK_KEYS, ...LEFT_KEYS, ...RIGHT_KEYS];

export function createFpvControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
  options: FpvOptions
): FpvControls {
  const {
    decks,
    obstacles = [],
    spawnLevel = 0,
    eyeHeight,
    speed = 2.4,
    onLockChange,
    joystick = null
  } = options;

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
  /** Which storey the eye is on. The only piece of state the two-deck hall needs. */
  let level = spawnLevel;
  /** The floor the eye stood on last frame, so an impossible change of it can be refused. */
  let floorY: number | null = null;
  /** Reused by the clamp: the active decks' regions, refilled rather than re-allocated. */
  const _active: Deck[] = [];
  const _activeRegions: Region[] = [];
  let enabled = false;

  const held = (codes: string[]) => (codes.some((code) => keys.has(code)) ? 1 : 0);

  /**
   * Take the pointer if we can, and say nothing if we cannot.
   *
   * **Not `controls.lock()`.** That drops the promise `requestPointerLock()` returns, and every
   * browser refuses a lock that has no transient user activation behind it — so on a cold page
   * load, where the view starts itself, three's version leaves an unhandled rejection in the
   * console every time. Three tracks the lock from `pointerlockchange` either way, so calling
   * the DOM method directly costs nothing and lets us swallow the refusal.
   *
   * Called from three places, which between them are what "you arrive already walking" means:
   * when the view goes live (works whenever the player got here by clicking, e.g. the mode
   * dropdown), on a click, and on the first movement key. The last is the one that matters on a
   * cold load — the browser will not hand over the pointer until the player does *something*,
   * and pressing W is that something.
   */
  function tryLock() {
    if (!enabled || !POINTER_LOCK_SUPPORTED || controls.isLocked) return;
    try {
      const request = domElement.requestPointerLock() as unknown;
      if (request instanceof Promise) request.catch(() => {});
    } catch {
      // No user activation yet, or the browser is in its post-Escape cooldown. Either way the
      // click path is still there.
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!enabled) return;
    keys.add(event.code);
    if (MOVE_KEYS.includes(event.code)) tryLock();
  }

  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.code);
  }

  function onClick() {
    // Touch has no lock to take — it looks after itself in the pointer handlers below.
    tryLock();
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
    for (const obstacle of obstacles) {
      // Furniture belongs to one storey. The desk is directly under the mezzanine, and without
      // this test it would fence off a patch of the bridge deck for no visible reason.
      if (obstacle.level !== level) continue;
      const box = obstacle.box;
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
    // Where we were before this frame moved anything, so the step guard below has somewhere
    // known-good to put us back.
    const priorX = camera.position.x;
    const priorZ = camera.position.z;

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

    // Only the decks reachable from the storey you are on. This is what makes the mezzanine
    // safe: the floor below is not in the set, so there is no edge to walk off — and it is
    // what makes the staircase work, since the stair is the one deck in *both* sets.
    _active.length = 0;
    _activeRegions.length = 0;
    for (const deck of decks) {
      if (!deck.levels.includes(level)) continue;
      _active.push(deck);
      _activeRegions.push(deck.region);
    }

    // Held inside the union of the walkable regions. Unlike the furniture below this is a
    // *clamp*, not a push-out: a position outside every region is moved onto the nearest one
    // whatever the step size, so no walking speed can pass through a wall.
    _floor.set(camera.position.x, camera.position.z);
    clampToRegions(_floor, _activeRegions);
    camera.position.x = _floor.x;
    camera.position.z = _floor.y;
    // Twice, because the footprints can touch: one pass is enough to push you out of the desk
    // and straight into the chair beside it.
    pushOutOfObstacles();
    pushOutOfObstacles();

    // `deckAt` is first-match, so the order the station lists its decks in decides what you are
    // standing on where two of them share XZ — the staircase is listed before the floor it
    // runs over. The fallback can only fire on the frame a clamp lands exactly on a boundary.
    let deck = deckAt(camera.position.x, camera.position.z, _active) ?? _active[0];
    let nextFloor = deck.floorAt(camera.position.x, camera.position.z);

    if (floorY !== null && Math.abs(nextFloor - floorY) > MAX_STEP) {
      // Refuse the move rather than the height: putting the eye back where it was leaves it on
      // a deck it was already standing on, which is always a valid place to be.
      camera.position.x = priorX;
      camera.position.z = priorZ;
      velocity.set(0, 0);
      deck = deckAt(priorX, priorZ, _active) ?? deck;
      nextFloor = deck.floorAt(priorX, priorZ);
    }

    floorY = nextFloor;
    level = deck.levelAt(camera.position.x, camera.position.z);
    camera.position.y = nextFloor + eyeHeight;
  }

  function lock() {
    tryLock();
  }

  function setEnabled(next: boolean) {
    if (next === enabled) return;
    enabled = next;
    if (enabled) {
      // Straight into walking, rather than waiting to be clicked on. Succeeds whenever the
      // player reached this view by a gesture — switching modes, or coming back from the asset
      // viewer — and is a no-op on a cold load, where the first movement key picks it up.
      tryLock();
    } else {
      keys.clear();
      velocity.set(0, 0);
      stick.set(0, 0);
      moveKnob(0, 0);
      lookPointer = null;
      stickPointer = null;
      // Forgotten rather than kept: `planet-view.ts` re-places the camera on `start()`, and a
      // remembered floor from the last visit would read as a teleport on the first frame back.
      floorY = null;
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
