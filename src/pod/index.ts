import * as THREE from 'three';
import { buildRoom } from './room';
import { buildWorkstation } from './desk';
import { buildRadio } from './radio';

/**
 * The pod: the shell from `room.ts` with the workstation from `desk.ts` in it, and the radio
 * from `radio.ts` on the desk.
 *
 * This file is the seam the rest of the app sees. `planet-view.ts` imports `buildPod`,
 * `ROOM`, `EYE_HEIGHT` and `ROOM_BOUNDS` from `./pod` exactly as it did when the whole room
 * was one file, so the split cost nothing at the call site — and the room can now grow a
 * module at a time (handrails, a hatch, stowage) without any of them knowing about each other.
 */

export { ROOM, EYE_HEIGHT, ROOM_BOUNDS, WINDOW } from './room';
export { DESK, DESK_SPAWN } from './desk';

export interface Pod {
  group: THREE.Group;
  /**
   * The radio's aiming volume. The pod knows what its furniture *is*; `planet-view.ts`
   * decides what looking at it does.
   */
  radioTarget: THREE.Object3D;
  /** The radio's indicator, driven from whatever `planet-view.ts` wired the radio up to. */
  setRadioLit(lit: boolean): void;
  /** Furniture footprints in room-local XZ, for `createFpvControls`. */
  obstacles: THREE.Box2[];
}

export function buildPod(): Pod {
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
