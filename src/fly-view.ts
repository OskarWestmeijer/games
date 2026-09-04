import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ATMOSPHERE_RADIUS, PLANET_RADIUS, SUN_DIR, buildSpace } from './space';
import type { TextureQuality } from './space';
import { createUfo } from './fly/ufo';
import { createBolts } from './fly/bolts';
import type { BoltTarget } from './fly/bolts';
import { createLanders, LANDING_TIME } from './fly/landers';
import { createCommandPost } from './fly/command-post';

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
 *
 * There is one saucer in the sky, a few landing ships on their way down, an Earth defence
 * command post going round overhead and a laser on the space bar — see `fly/ufo.ts`,
 * `fly/landers.ts`, `fly/command-post.ts` and `fly/bolts.ts`. That is the extent of the game in
 * here: no score, nothing that can shoot back, and the only clock is the forty seconds a landing
 * ship takes to arrive. What it is all *for* is having somewhere to fly to.
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
 * The guns, in aircraft-local metres: the wingtips, just ahead of the navigation lights they
 * sit beside. Mirrored in x and fired alternately, which is what makes a stream of bolts read
 * as an aeroplane's rather than as a cursor's.
 */
const MUZZLE = new THREE.Vector3(4.2, 0.05, -0.6);
/**
 * How far down the nose the reticle is projected — the range it is boresighted for.
 *
 * It exists because the chase camera does *not* look along the nose: it is aimed a little below
 * it so the planet stays in the picture, so the middle of the screen is not where the shots go,
 * and a gun whose aim you cannot see is a guess rather than a gun.
 *
 * There is a range in it because the camera sits 3.4 above the nose line, so the angle from the
 * camera down to a point ahead of the aeroplane depends on how far ahead it is: 1.7° at 100
 * units, 1.0° at 200, 0.5° at 400. One ring cannot be right at every range — the same boresight
 * problem a real gunsight has — so it is set for the middle of the range things actually get
 * shot at, where the residual error is well inside the saucer's own hit radius. The wingtips
 * straddle it symmetrically and so bias it not at all.
 */
const RETICLE_RANGE = 220;

/**
 * The minimap's SVG overlay is drawn in map fractions — 100 across by 50 down, which is the
 * panel's own 2:1 — so a longitude is an x and a latitude is a y with nothing in between.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAP_W = 100;
const MAP_H = 50;
/** The landing ship's mark on that map, in the same units. */
const SHIP_MARK = 2.6;
/** When a countdown stops being information and starts being your problem. */
const URGENT_SECONDS = 10;

/**
 * What the command post says when you arrive, and how long it stays up. Short, because a line
 * you have already read is in the way of the game — it snaps on and fades off, and the flight
 * has not waited for it.
 */
const BRIEFING = 'We are under attack — shoot down the landing ships!';
const MESSAGE_SECONDS = 5;

/**
 * How quickly the minimap marker's heading follows the track it is leaving. It is smoothed
 * because it comes from the *difference* between two positions a frame apart — a small number
 * over a variable dt, which a marker pointed straight at it would jitter on.
 */
const TRACK_LAG = 0.25;

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
  /**
   * The minimap's marker, sitting inside a panel that holds a flat map of the whole world.
   * Injected like the readouts — `main.ts` is the only file that reaches for DOM ids — and the
   * panel it is a child of is what supplies the proportions `updateMinimap()` needs.
   */
  planeMarker?: HTMLElement | SVGElement | null;
  /** The minimap's marker for the saucer. Hidden by this module while there isn't one. */
  ufoMarker?: HTMLElement | SVGElement | null;
  /** The minimap's marker for the command post, which is always up there. */
  postMarker?: HTMLElement | SVGElement | null;
  /**
   * An empty `<svg>` over the minimap, in which this module draws one approach path and one
   * mark per landing ship. Handed the container rather than the marks themselves because how
   * many there are belongs to `fly/landers.ts`, not to the markup.
   */
  landerLayer?: SVGElement | null;
  /**
   * The banner across the top of the screen. This module appends one countdown per landing ship
   * to it and hides the whole panel when there is nothing on its way down. Same arrangement as
   * `landerLayer`, and for the same reason.
   */
  alertPanel?: HTMLElement | null;
  /**
   * The command post's message panel and the line inside it. This module writes the text and
   * shows the panel for a few seconds; everything else about it is markup and CSS.
   */
  messagePanel?: HTMLElement | null;
  messageText?: HTMLElement | null;
  /** The aiming reticle, placed over wherever the nose is pointing. */
  reticle?: HTMLElement | SVGElement | null;
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

  // One saucer, drifting; one pool of laser bolts. Both live in world space beside the
  // aeroplane rather than under it.
  const ufo = createUfo();
  scene.add(ufo.group);
  const landers = createLanders(space);
  scene.add(landers.group);
  const post = createCommandPost();
  scene.add(post.group);
  const bolts = createBolts();
  scene.add(bolts.group);
  /** Built once: the position inside it is the saucer's own live vector. */
  const ufoTarget: BoltTarget = {
    position: ufo.position,
    radius: ufo.hitRadius,
    hit: () => ufo.hit()
  };
  /** What the laser can hit right now. Refilled every frame, never reallocated. */
  const boltTargets: BoltTarget[] = [];
  /** Which wingtip fires next. */
  let muzzleSide = 1;

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

  /** Where the aircraft is on the flat map, 0..1 each way. See `Space.surfaceUv`. */
  const groundTrack = new THREE.Vector2();
  /** Smoothed direction of travel *as the map draws it*, in panel widths per second. */
  let trackX = 0;
  let trackY = 0;
  let hasTrack = false;
  let lastU = 0;
  let lastV = 0;
  let heading = 0;
  /** The minimap panel's own proportions, read in `resize()`. 2:1 unless the CSS says else. */
  let mapAspect = 2;
  /** Where the saucer, and each landing ship, is on that same map. */
  const contactUv = new THREE.Vector2();

  function setLine(line: SVGElement, x1: number, y1: number, x2: number, y2: number) {
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.style.display = '';
  }

  /**
   * One countdown per landing ship: a mark the colour of its square on the map, and the seconds
   * it has left. Built here for the same reason the map's marks are — how many there are is
   * `LANDER_COUNT`'s business, not the markup's.
   */
  const timerRows = options.alertPanel
    ? landers.all.map(() => {
        const el = (tag: string, className: string, parent: HTMLElement) => {
          const node = document.createElement(tag);
          node.className = className;
          parent.appendChild(node);
          return node;
        };
        const row = document.createElement('div');
        row.className = 'fly-alert';
        row.style.display = 'none';
        const head = el('div', 'alert-head', row);
        el('span', 'timer-mark', head);
        const place = el('span', 'timer-place', head);
        const value = el('span', 'timer-value', head);
        // The bar proper: a track that stays put and a fill that runs out of it.
        const fill = el('div', 'alert-fill', el('div', 'alert-track', row) as HTMLElement);
        options.alertPanel!.appendChild(row);
        // `shown` is the last number written: the countdown ticks once a second against a frame
        // rate sixty times that, so this is what keeps it from rewriting the DOM all day.
        return { row, place, value, fill, shown: -1, named: '' };
      })
    : null;

  /**
   * One approach path, its wrapped twin, its landing site and its ship mark, per landing ship.
   * Made here rather than written into `index.html`: it is the same four nodes repeated, and
   * how many times is `LANDER_COUNT`'s business.
   */
  const landerSlots = options.landerLayer
    ? landers.all.map(() => {
        const node = (tag: string, className: string) => {
          const el = document.createElementNS(SVG_NS, tag) as SVGElement;
          el.setAttribute('class', className);
          el.style.display = 'none';
          options.landerLayer!.appendChild(el);
          return el;
        };
        const path = node('line', 'lander-path');
        const wrap = node('line', 'lander-path');
        const site = node('circle', 'lander-site');
        site.setAttribute('r', '1.3');
        const ship = node('rect', 'lander-ship');
        ship.setAttribute('width', String(SHIP_MARK));
        ship.setAttribute('height', String(SHIP_MARK));
        return [path, wrap, site, ship] as const;
      })
    : null;

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const radialUp = new THREE.Vector3();
  const chase = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const planeUp = new THREE.Vector3();
  const levelAxis = new THREE.Vector3();
  const spin = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const muzzle = new THREE.Vector3();
  const aim = new THREE.Vector3();
  /** Seconds of screen time the current message has left. Counted down in `update()`, so it
   *  stops with the view rather than running on behind a parked scene. */
  let messageLeft = 0;

  /**
   * Puts a line on screen from the command post. Public in spirit — the next thing to say here
   * is what happens when a ship gets through, which is a message and not a mechanic yet.
   */
  function say(text: string, seconds = MESSAGE_SECONDS) {
    if (!options.messagePanel || !options.messageText) return;
    options.messageText.textContent = text;
    options.messagePanel.classList.add('show');
    messageLeft = seconds;
  }

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
    // The marker's heading is a difference between frames, so it has no meaning across a jump.
    hasTrack = false;
    bolts.clear();
    ufo.spawn(plane.position);
    landers.reset();
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

    if (messageLeft > 0) {
      messageLeft -= dt;
      // Dropping the class hands it back to the transition, which is the fade.
      if (messageLeft <= 0) options.messagePanel?.classList.remove('show');
    }

    // The trigger. `forward` is the nose as it is *after* the level-hold has had its say, which
    // is the direction the aeroplane is actually pointing and so the direction it fires in. The
    // cadence lives in `bolts`, so holding the key down is all this has to know.
    if (keys.has('Space')) {
      muzzle
        .set(MUZZLE.x * muzzleSide, MUZZLE.y, MUZZLE.z)
        .applyQuaternion(plane.quaternion)
        .add(plane.position);
      if (bolts.fire(muzzle, forward)) muzzleSide = -muzzleSide;
    }
    // Tested before anything moves, so a bolt is checked against the target it was aimed at
    // this frame rather than against where it has got to since.
    boltTargets.length = 0;
    if (ufo.alive) boltTargets.push(ufoTarget);
    landers.collect(boltTargets);
    bolts.update(dt, boltTargets);
    ufo.update(dt, plane.position);
    landers.update(dt, plane.position);
    // Neither shootable nor interactive: it just goes round, whatever else is happening.
    post.update(dt);

    placeCamera(1 - Math.exp(-dt * CHASE_FOLLOW));

    if (options.speedLabel) options.speedLabel.textContent = `${Math.round(speed)}`;
    if (options.altitudeLabel) {
      options.altitudeLabel.textContent = `${Math.round(plane.position.length() - PLANET_RADIUS)}`;
    }
  }

  /**
   * Puts the aeroplane on the minimap. The panel is a *static* equirectangular Earth, so the
   * marker's position on it simply is the ground track: `surfaceUv` answers where the aircraft
   * is on the same map the planet is wearing, and the marker goes there as a percentage of the
   * panel — no pixels, so it stays right while the panel is sized in `vw`.
   *
   * The heading is finite-differenced **in map space** rather than taken from the aircraft's
   * own nose, because the marker sits on a projection: due north over Greenland is drawn as a
   * run along the top of the map, and a marker pointing up there would disagree with the track
   * it is leaving. The planet's axial spin falls out of the difference for free, `surfaceUv`
   * working in the planet's local frame — fly slowly enough due east and the track really does
   * creep backwards, which is the correct answer and not one the nose could have given.
   */
  function updateMinimap(dt: number) {
    const marker = options.planeMarker;
    if (!marker || dt <= 0) return;

    space.surfaceUv(plane.position, groundTrack);
    const u = groundTrack.x;
    const v = groundTrack.y;

    if (hasTrack) {
      // Wrapped, or the one frame that crosses the antimeridian reads as a sprint the whole
      // way back across the map and snaps the marker round on the spot.
      let du = u - lastU;
      if (du > 0.5) du -= 1;
      else if (du < -0.5) du += 1;
      // Into panel space: `u` spans a panel `mapAspect` times as wide as `v` spans it tall, and
      // screen y grows downwards where `v` grows towards the north pole.
      const dx = (du * mapAspect) / dt;
      const dy = (lastV - v) / dt;
      const blend = 1 - Math.exp(-dt / TRACK_LAG);
      trackX += (dx - trackX) * blend;
      trackY += (dy - trackY) * blend;
      // A dart drawn pointing up lies along (dx, dy) once turned clockwise by atan2(dx, -dy).
      if (trackX * trackX + trackY * trackY > 1e-9) heading = Math.atan2(trackX, -trackY);
    } else {
      hasTrack = true;
    }
    lastU = u;
    lastV = v;

    marker.style.left = `${u * 100}%`;
    marker.style.top = `${(1 - v) * 100}%`;
    marker.style.transform = `translate(-50%, -50%) rotate(${heading}rad)`;

    // The command post's own ground track, by the same means. It is never hidden: unlike the
    // saucer, there is always one, which is rather the point of it.
    if (options.postMarker) {
      space.surfaceUv(post.position, contactUv);
      options.postMarker.style.left = `${contactUv.x * 100}%`;
      options.postMarker.style.top = `${(1 - contactUv.y) * 100}%`;
    }

    // The saucer on the same map, by the same means. It carries no heading — a contact is a
    // place, and eight units per second would make a dart's direction a lie at this scale.
    const contact = options.ufoMarker;
    if (!contact) return;
    if (!ufo.alive) {
      contact.style.display = 'none';
      return;
    }
    space.surfaceUv(ufo.position, contactUv);
    contact.style.display = '';
    contact.style.left = `${contactUv.x * 100}%`;
    contact.style.top = `${(1 - contactUv.y) * 100}%`;
  }

  /**
   * The landing ships on the same map: each one's approach drawn as a line from where it came
   * in to where it is going to touch down, with a ring on the landing site and a square for the
   * ship itself somewhere along it. The line is the point of the whole thing — a mark on its own
   * says where something is, a line says where it is *going*, which is what you need to decide
   * whether to go after it.
   *
   * Redrawn every frame rather than once at spawn, because the planet turns underneath: both
   * ends are fixed in space, so on the map they creep west together with the ground they are
   * over.
   */
  function updateLanderMarkers() {
    let anyInbound = false;
    landers.all.forEach((lander, i) => {
      const timer = timerRows?.[i];
      if (timer) {
        if (lander.active) {
          // Rounded up, so it never reads 0 while the ship is still in the air.
          const left = Math.max(0, Math.ceil((1 - lander.progress) * LANDING_TIME));
          if (left !== timer.shown) {
            timer.value.textContent = `${left}s`;
            timer.shown = left;
          }
          if (lander.name !== timer.named) {
            timer.place.textContent = lander.name;
            timer.named = lander.name;
          }
          // The bar itself: what is left of the approach, which is the same number the count is
          // rounded from. Written every frame — it is one style property on at most three bars,
          // and a bar that only moved once a second would tick rather than drain.
          timer.fill.style.width = `${(1 - lander.progress) * 100}%`;
          timer.row.classList.toggle('urgent', left <= URGENT_SECONDS);
          timer.row.style.display = '';
          anyInbound = true;
        } else {
          timer.row.style.display = 'none';
          timer.shown = -1;
        }
      }

      const slot = landerSlots?.[i];
      if (!slot) return;
      if (!lander.active) {
        for (const node of slot) node.style.display = 'none';
        return;
      }
      space.surfaceUv(lander.entry, contactUv);
      const x1 = contactUv.x * MAP_W;
      const y1 = (1 - contactUv.y) * MAP_H;
      space.surfaceUv(lander.site, contactUv);
      const x2 = contactUv.x * MAP_W;
      const y2 = (1 - contactUv.y) * MAP_H;
      space.surfaceUv(lander.position, contactUv);
      const shipX = contactUv.x * MAP_W;
      const shipY = (1 - contactUv.y) * MAP_H;

      const [path, wrap, site, ship] = slot;
      // A path whose ends are more than half a map apart is the short way round the *back* of
      // the world, and drawn as one line it streaks all the way across instead. Drawn twice, a
      // map width apart, the panel's own clipping leaves exactly the two halves you should see.
      const shift = Math.abs(x2 - x1) > MAP_W / 2 ? (x2 > x1 ? -MAP_W : MAP_W) : 0;
      setLine(path, x1, y1, x2 + shift, y2);
      if (shift) setLine(wrap, x1 - shift, y1, x2, y2);
      else wrap.style.display = 'none';

      site.setAttribute('cx', String(x2));
      site.setAttribute('cy', String(y2));
      ship.setAttribute('x', String(shipX - SHIP_MARK / 2));
      ship.setAttribute('y', String(shipY - SHIP_MARK / 2));
      site.style.display = '';
      ship.style.display = '';
    });
    // The banner is only there when something is on its way down; an empty header is furniture.
    if (options.alertPanel) options.alertPanel.hidden = !anyInbound;
  }

  /**
   * Puts the reticle where the nose is pointing.
   *
   * **Called after the render, and that is load-bearing.** `Vector3.project` reads
   * `camera.matrixWorldInverse` without updating it, and `placeCamera()` has just moved the
   * camera — asked before the render it would mark where the nose pointed last frame, which at
   * two radians a second of roll is visibly wrong. Rendering has just refreshed the matrices.
   */
  function updateReticle() {
    const el = options.reticle;
    if (!el) return;
    aim
      .copy(NOSE)
      .applyQuaternion(plane.quaternion)
      .multiplyScalar(RETICLE_RANGE)
      .add(plane.position)
      .project(camera);
    // z > 1 is behind the camera, where the projection folds over and the reticle would appear
    // on the opposite side of the screen from the thing it is aiming at.
    if (aim.z > 1) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.left = `${(aim.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-aim.y * 0.5 + 0.5) * 100}%`;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!running) return;
    keys.add(event.code);
    // The arrows would otherwise scroll whatever is behind the canvas on a short viewport, and
    // the space bar scrolls it a page at a time.
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
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

    // The marker's heading needs the minimap panel's proportions (see `updateMinimap`). Read
    // here rather than per frame: touching `clientWidth` forces layout, and this is the one
    // place that already knows the window changed. Zero while the panel is hidden — a narrow
    // viewport drops it — in which case the last good value stands and nothing can see it.
    const panel = options.planeMarker?.parentElement;
    if (panel && panel.clientHeight > 0) mapAspect = panel.clientWidth / panel.clientHeight;
  }

  const clock = new THREE.Clock(false);
  let rafId = 0;
  let running = false;

  function tick() {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.1);
    update(dt);
    space.update(clock.elapsedTime, dt);
    // After `space.update()`, which is where this frame's spin lands on the planet. The marker
    // is a question about the surface, so it has to be asked of the surface as it is about to
    // be drawn rather than as it was last frame.
    updateMinimap(dt);
    updateLanderMarkers();
    composer.render();
    updateReticle();
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
    say(BRIEFING);
    clock.start();
    tick();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    keys.clear();
    // Nothing counts down while the view is parked, so a message would otherwise still be
    // sitting there on the way back in.
    messageLeft = 0;
    options.messagePanel?.classList.remove('show');
    // Bolts in the air would otherwise be hanging there, mid-flight, on the way back in.
    bolts.clear();
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
      },
      /** Lets a harness check the marker against the coastline it is supposed to be over. */
      get groundTrack() {
        return { u: groundTrack.x, v: groundTrack.y };
      },
      ufo,
      landers,
      post
    };
  }

  return {
    start,
    stop,
    reset,
    setTextureQuality: (quality: TextureQuality) => space.setQuality(quality)
  };
}
