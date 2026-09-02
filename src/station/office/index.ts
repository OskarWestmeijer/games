import * as THREE from 'three';
import { buildWorkstation } from './desk';
import { buildRadio } from './radio';

/**
 * The office: the workstation from `desk.ts` with the radio from `radio.ts` on it. Still the
 * place you arrive in, and still the only fitted-out part of the station.
 *
 * It used to own a room too — a hand-built shell whose window and proportions were solved
 * against a specific eye position at the desk. That shell is now the hall (`station/hall.ts`),
 * which is one room for both storeys, so what is left here is furniture. It is authored in its
 * own room-local frame, with the origin on the floor and the window wall on -Z, and
 * `station/index.ts` places it with `OFFICE_PLACEMENT`.
 */

export { DESK, DESK_SPAWN } from './desk';

export interface Office {
  group: THREE.Group;
  /**
   * The radio's aiming volume. The office knows what its furniture *is*; `station/index.ts`
   * decides what looking at it does.
   */
  radioTarget: THREE.Object3D;
  /** The radio's indicator, driven from whatever the audio was wired up to. */
  setRadioLit(lit: boolean): void;
  /** Furniture footprints in room-local XZ, for `createFpvControls`. */
  obstacles: THREE.Box2[];
}

export function buildOffice(): Office {
  const group = new THREE.Group();

  const workstation = buildWorkstation();
  group.add(workstation.group);

  // No footprint of its own: it stands on the desk, which is already an obstacle.
  const radio = buildRadio();
  group.add(radio.group);

  return {
    group,
    radioTarget: radio.target,
    setRadioLit: radio.setLit,
    obstacles: workstation.obstacles
  };
}
