import * as THREE from 'three';
import type { InteractionTarget } from '../interaction';
import type { Flight } from '../flight';
import { BRIDGE, CONSOLE } from './layout';

/**
 * The navigation console: the station's only controls.
 *
 * There is no HUD for any of this. Altitude, bearing, horizon, orbit mode and time exist here
 * and nowhere else, which deletes UI rather than adding it — you walk up to the bridge and
 * operate the station where the station is operated from.
 *
 * It stands on the mezzanine at its front edge with its long axis along X, so you work it with
 * your back to the globe, looking down the hall over the office and out of the window. The
 * keys read left to right in the order they are listed.
 *
 * **Steppers with named detents, not sliders.** A slider needs a drag; `interaction.ts` gives
 * a look and a keypress, and it already supports a label that is a *function* of state, which
 * is what lets one target read "raise the orbit to 250 km" and then "…to 400 km" without ever
 * ceasing to be the same target. Named detents also say more than a number does: "hold the
 * horizon level" is a thing you can want, where "-0.0 rad" is not. It works identically under
 * a thumb, because the prompt is a real button.
 *
 * **Targets are tested in array order and the first hit wins**, so these are listed smallest
 * first. That ordering has been latent for as long as the radio was the only interactable in
 * the station; with seven boxes on one desk it stops being latent.
 */

/** How close the eye has to be before the console offers anything. */
export const CONSOLE_REACH = 1.9;

const KEY_SIZE = new THREE.Vector3(0.26, 0.16, 0.3);

const deskMaterial = new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.55, metalness: 0.45 });
const keyMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.5, metalness: 0.2 });

export interface Console {
  group: THREE.Group;
  /** Built against a `Flight` so the labels can read live state. */
  targets(flight: Flight): InteractionTarget[];
  obstacles: THREE.Box2[];
}

export function buildConsole(): Console {
  const group = new THREE.Group();
  group.position.set(CONSOLE.x, BRIDGE.y, CONSOLE.z);

  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(CONSOLE.width, 0.06, CONSOLE.depth),
    deskMaterial
  );
  desk.position.y = CONSOLE.top;
  group.add(desk);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, CONSOLE.top, CONSOLE.depth * 0.8),
      deskMaterial
    );
    leg.position.set(side * (CONSOLE.width / 2 - 0.2), CONSOLE.top / 2, 0);
    group.add(leg);
  }

  /**
   * One control: a visible cap, and an invisible box twice its size for the ray to find.
   * `THREE.Raycaster` does not check `visible`, so the aiming volume costs one more object
   * and makes looking at a 30 cm key forgiving enough to hit with a thumb.
   */
  function key(x: number): THREE.Object3D {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(KEY_SIZE.x, KEY_SIZE.y, KEY_SIZE.z), keyMaterial);
    cap.position.set(x, CONSOLE.top + 0.06, 0);
    group.add(cap);

    const aim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.52), keyMaterial);
    aim.position.copy(cap.position);
    aim.visible = false;
    group.add(aim);
    return aim;
  }

  // Laid out along the desk, left to right as you stand at it.
  const keys = {
    altitudeDown: key(-1.2),
    altitudeUp: key(-0.8),
    horizonDown: key(-0.32),
    horizonUp: key(0.08),
    bearing: key(0.56),
    orbit: key(0.98),
    time: key(1.34)
  };

  function targets(flight: Flight): InteractionTarget[] {
    const step = (
      object: THREE.Object3D,
      label: () => string,
      activate: () => void
    ): InteractionTarget => ({ object, reach: CONSOLE_REACH, label, activate });

    return [
      step(
        keys.altitudeUp,
        () =>
          flight.isSynchronous()
            ? 'leave synchronous orbit first'
            : `climb from ${Math.round(flight.altitudeTarget())} km`,
        () => flight.stepAltitude(1)
      ),
      step(
        keys.altitudeDown,
        () =>
          flight.isSynchronous()
            ? 'leave synchronous orbit first'
            : `descend from ${Math.round(flight.altitudeTarget())} km`,
        () => flight.stepAltitude(-1)
      ),
      step(keys.horizonUp, () => `raise the horizon (${flight.horizonName()})`, () => flight.stepHorizon(1)),
      step(keys.horizonDown, () => `drop the horizon (${flight.horizonName()})`, () => flight.stepHorizon(-1)),
      step(keys.bearing, () => `aim the station at ${flight.nextBearingName()}`, () => flight.cycleBearing()),
      step(
        keys.orbit,
        () => (flight.isSynchronous() ? 'break synchronous orbit' : 'hold synchronous orbit'),
        () => flight.toggleSynchronous()
      ),
      step(keys.time, () => `change the clock (${flight.state.timeScale}x)`, () => flight.cycleTime())
    ];
  }

  const obstacles = [
    new THREE.Box2(
      new THREE.Vector2(CONSOLE.x - CONSOLE.width / 2, CONSOLE.z - CONSOLE.depth / 2),
      new THREE.Vector2(CONSOLE.x + CONSOLE.width / 2, CONSOLE.z + CONSOLE.depth / 2)
    )
  ];

  return { group, targets, obstacles };
}
