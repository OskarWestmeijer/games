import * as THREE from 'three';
import { PLANET_RADIUS, PLANET_SPIN_RATE } from './space';

/**
 * The station's flight state: where it is, how it is turned, and how fast time is running.
 *
 * This exists because three separate things now need the same numbers. The navigation console
 * *writes* them, the rig in `planet-view.ts` *reads* them to place and orient the station, and
 * the hub globe reads them again to draw the orbit it is describing. Threading that through
 * `planet-view.ts` as arguments would make the console reach across the whole scene to change
 * an altitude; owning it here means the console mutates state and everything else notices.
 *
 * **Attitude is three angles, and they are independent.** `lookAt` puts the rig's -Z on the
 * nadir; from there:
 *
 * - `roll` turns the station about the nadir axis. A horizon is a cone about the nadir, so
 *   rolling maps that cone onto itself: this changes which compass bearing a window looks
 *   along and never moves the horizon up or down. Fixed, for now.
 * - `horizon` says where the limb should sit relative to the optical axis, and the *pitch* is
 *   solved from it (`pitchFor`). Because it is defined as an angle about that axis, it holds
 *   its framing at every altitude — which is the property that made the original altitude
 *   slider work, here generalised from a constant into a control.
 * - `bearing` swings the planet round to a different face of the station.
 *
 * The order they are applied in is load-bearing and is documented at the call site in
 * `planet-view.ts`.
 */

/** Seconds for one lap under power. Slow enough to be ambient rather than a ride. */
export const FREE_PERIOD = 300;

/**
 * A lap that matches the planet's own rotation, so the ground stops sliding underneath.
 *
 * This is *synchronous*, not stationary: the orbit is still steeply inclined, so instead of
 * hanging over one point the station traces a slow figure-eight about it. Flattening the
 * plane to the equator is what the last step would need, and that is a bigger change than it
 * looks — the moon shares the station's orbital plane, and that is the whole reason its
 * transit is dependable once a lap.
 */
export const SYNCHRONOUS_PERIOD = (Math.PI * 2) / PLANET_SPIN_RATE;

/** Where a synchronous orbit parks. Altitude is not free once you are in one. */
export const SYNCHRONOUS_ALTITUDE = 480;

/**
 * How far the station reaches from its own centre, in metres — the hull's own farthest point,
 * the top of its shoulder at `hypot(6.5, 7.86)` ≈ 10.2, rounded up. It used to be the top of a
 * blunt tail; the tail is a closed round bulb now and the crown of the arch beat it.
 *
 * This sets the altitude floor rather than aesthetics does. The outer atmosphere shell is a
 * `BackSide` fresnel at `ATMOSPHERE_RADIUS`, 10.5 above the surface, and a camera inside it is
 * wrapped in glow across the whole sky instead of seeing a ring round the planet. The lowest
 * detent of 35 puts the farthest part of the hull 26 units clear of it.
 */
export const STATION_REACH = 9;

export const ALTITUDE_DETENTS = [35, 60, 120, 250, 400, 600];
export const ALTITUDE_RANGE = {
  min: ALTITUDE_DETENTS[0],
  max: ALTITUDE_DETENTS[ALTITUDE_DETENTS.length - 1],
  initial: 120
};

/** Degrees. Positive lifts the horizon up the wall windows; negative rolls the planet under the floor. */
export const HORIZON_DETENTS = [
  { value: -20, name: 'below the deck' },
  { value: -10, name: 'low' },
  { value: 0, name: 'level' },
  { value: 9.4, name: 'high' },
  { value: 20, name: 'filling the glass' }
];

export const TIME_DETENTS = [0.25, 1, 2, 4, 8];

/**
 * Which face of the hall the planet is swung round to. Bearing 0° is the station's -Z — the
 * window, and the only face with anything to look through, which is why it is where the view
 * opens and where it is worth coming back to. The other three point the glass at empty sky.
 */
export const BEARING_DETENTS = [
  { value: 0, name: 'the window' },
  { value: 90, name: 'starboard' },
  { value: 180, name: 'astern' },
  { value: 270, name: 'port' }
];

/**
 * How far the station is rolled about the nadir, in radians — the pod's old `WINDOW_YAW`.
 *
 * At 0 a window looks square across the track and the ground slides straight sideways past
 * it, which is a very static way to see a planet. At ≈34° the view is oblique: terrain comes
 * towards you and passes off to one side. A constant, because it is a quality of the view
 * rather than something worth flying.
 */
export const ROLL = 0.6;

/** Where on the orbit the view opens, in radians from local noon. ≈264° is just past sunrise. */
const ORBIT_START = 4.6;

/** Seconds an altitude or attitude change takes to run in. Long enough to read as a manoeuvre. */
const EASE = 0.9;

export interface FlightSnapshot {
  altitude: number;
  /** Radians. */
  bearing: number;
  /** Radians; the limb's elevation relative to the optical axis. */
  horizon: number;
  timeScale: number;
  synchronous: boolean;
  /** Radians round the orbit from local noon. */
  orbitAngle: number;
  /** Seconds of *simulated* time elapsed — scaled by `timeScale`, so everything stays in step. */
  simTime: number;
}

/** The pitch that puts the limb `horizon` above the optical axis at this altitude. */
export function pitchFor(altitude: number, horizon: number): number {
  return Math.asin(PLANET_RADIUS / (PLANET_RADIUS + altitude)) - horizon;
}

/** Index of the detent nearest `value`, so stepping always starts from where you actually are. */
function nearestIndex(values: number[], value: number): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i] - value) < Math.abs(values[best] - value)) best = i;
  }
  return best;
}

export function createFlight() {
  let altitudeTarget = ALTITUDE_RANGE.initial;
  let horizonTarget = THREE.MathUtils.degToRad(9.4);
  let bearingTarget = 0;
  let timeIndex = TIME_DETENTS.indexOf(1);
  let synchronous = false;

  const state: FlightSnapshot = {
    altitude: altitudeTarget,
    bearing: 0,
    horizon: horizonTarget,
    timeScale: 1,
    synchronous: false,
    orbitAngle: ORBIT_START,
    simTime: 0
  };

  function update(dt: number) {
    state.timeScale = TIME_DETENTS[timeIndex];
    state.synchronous = synchronous;

    const scaled = dt * state.timeScale;
    state.simTime += scaled;

    const period = synchronous ? SYNCHRONOUS_PERIOD : FREE_PERIOD;
    state.orbitAngle += (scaled / period) * Math.PI * 2;

    // Eased rather than snapped: the detents are far apart, and jumping 250 units of altitude
    // between two frames reads as a cut rather than a manoeuvre. Framed in dt so it behaves
    // the same at any frame rate.
    const k = 1 - Math.exp(-dt / EASE);
    state.altitude += (altitudeTarget - state.altitude) * k;
    state.horizon += (horizonTarget - state.horizon) * k;
    // Shortest way round, so stepping from 270° to 0° turns 90° rather than unwinding 270°.
    const delta = THREE.MathUtils.euclideanModulo(bearingTarget - state.bearing + Math.PI, Math.PI * 2) - Math.PI;
    state.bearing += delta * k;
  }

  function stepAltitude(direction: 1 | -1) {
    // Locked out while synchronous: the orbit's period and its altitude are one setting, and
    // letting you fly one without the other would make the console lie about what it is doing.
    if (synchronous) return;
    const i = nearestIndex(ALTITUDE_DETENTS, altitudeTarget) + direction;
    altitudeTarget = ALTITUDE_DETENTS[THREE.MathUtils.clamp(i, 0, ALTITUDE_DETENTS.length - 1)];
  }

  function stepHorizon(direction: 1 | -1) {
    const values = HORIZON_DETENTS.map((d) => d.value);
    const i = nearestIndex(values, THREE.MathUtils.radToDeg(horizonTarget)) + direction;
    horizonTarget = THREE.MathUtils.degToRad(values[THREE.MathUtils.clamp(i, 0, values.length - 1)]);
  }

  function cycleBearing() {
    const degrees = THREE.MathUtils.radToDeg(bearingTarget);
    const values = BEARING_DETENTS.map((d) => d.value);
    const i = (nearestIndex(values, degrees) + 1) % values.length;
    bearingTarget = THREE.MathUtils.degToRad(values[i]);
  }

  function cycleTime() {
    timeIndex = (timeIndex + 1) % TIME_DETENTS.length;
  }

  function toggleSynchronous() {
    synchronous = !synchronous;
    if (synchronous) altitudeTarget = SYNCHRONOUS_ALTITUDE;
  }

  /** What the next bearing step would aim at — the console's label needs to name it. */
  function nextBearingName(): string {
    const values = BEARING_DETENTS.map((d) => d.value);
    const i = (nearestIndex(values, THREE.MathUtils.radToDeg(bearingTarget)) + 1) % values.length;
    return BEARING_DETENTS[i].name;
  }

  function horizonName(): string {
    const values = HORIZON_DETENTS.map((d) => d.value);
    return HORIZON_DETENTS[nearestIndex(values, THREE.MathUtils.radToDeg(horizonTarget))].name;
  }

  return {
    state,
    update,
    stepAltitude,
    stepHorizon,
    cycleBearing,
    cycleTime,
    toggleSynchronous,
    nextBearingName,
    horizonName,
    altitudeTarget: () => altitudeTarget,
    isSynchronous: () => synchronous
  };
}

export type Flight = ReturnType<typeof createFlight>;
