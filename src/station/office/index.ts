import * as THREE from 'three';
import { buildRoom } from './room';
import { buildWorkstation } from './desk';
import { buildRadio } from './radio';

/**
 * The office/bedroom: the shell from `room.ts` with the workstation from `desk.ts` in it, and
 * the radio from `radio.ts` on the desk. The station's first module, and still the one you
 * arrive in.
 *
 * Its window, frame and proportions are solved against a specific eye position at the desk,
 * which is why it keeps a hand-built shell rather than going through `station/shell.ts` like
 * every other module. It sits on bearing 0° — station -Z, the same -Z the window has always
 * been on — so it needs no rotation and the framing carries over untouched.
 */

export { ROOM, EYE_HEIGHT, WINDOW } from './room';
export { DESK, DESK_SPAWN } from './desk';

export interface Office {
  group: THREE.Group;
  /**
   * The radio's aiming volume. The office knows what its furniture *is*; `planet-view.ts`
   * decides what looking at it does.
   */
  radioTarget: THREE.Object3D;
  /** The radio's indicator, driven from whatever `planet-view.ts` wired the radio up to. */
  setRadioLit(lit: boolean): void;
  /** Furniture footprints in room-local XZ, for `createFpvControls`. */
  obstacles: THREE.Box2[];
}

export function buildOffice(): Office {
  const group = new THREE.Group();
  group.add(buildRoom());

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
