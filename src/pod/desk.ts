import * as THREE from 'three';
import { makeScreenTexture } from './screen';

/**
 * The workstation: a desk under the window, a chair pushed back from it, and the computer you
 * were sitting at a moment ago. Room-local metres, same frame as `room.ts` — origin on the
 * floor at the centre, window wall at z = -2.5 with its frame standing 0.14 proud of it.
 *
 * Two things decide the placement, and neither is aesthetic:
 *
 * - **It is off to the left, not centred**, at x = -2 in a room that spans ±3.5. That keeps it
 *   out of the middle of the glass, where the horizon `HORIZON_ELEVATION` was tuned to place
 *   would run straight across it, and it leaves the whole right-hand two thirds of the window
 *   clear. You arrive standing at it (`DESK_SPAWN`), so the monitor is in front of you and
 *   below the limb — near enough to notice, low enough not to be in the way.
 * - **The chair is offset from the monitor, not square to it.** It is an obstacle like the desk
 *   is, and left where you would actually sit it fences off the one spot you need to stand in
 *   to read the screen. Pushed back and to the right, it reads as one somebody has just got
 *   out of and leaves the approach open.
 *
 * The materials are the first warm ones in the room — see "Real outside, warm inside" in
 * CLAUDE.md. Everything the shell is made of is grey-blue; this is not.
 */

/**
 * Desk slab: 2.2 x 0.7, top surface at 0.74, centred here. Exported because anything else
 * that stands on the desk has to be placed against it — see `radio.ts`.
 */
export const DESK = { x: -2.0, z: -2.0, width: 2.2, depth: 0.7, top: 0.74, thickness: 0.05 };

/**
 * Where the chair sits, and how far it is turned out from the desk. Pushed back into the room
 * rather than tucked under the desk, and clear of the line between the door side of the room
 * and the monitor: the chair is a solid obstacle, and parked square in front of the desk it
 * fences off the one spot you have to stand in to read the screen.
 */
const CHAIR = { x: -1.5, z: -0.6, yaw: 0.5 };

/**
 * Where the player is standing when they arrive: at the desk, half a step back and to the
 * left of the chair, as if they had just pushed it aside and stood up. Facing the window, so
 * the opening frame is the planet with their own monitor below it — the reveal and the way
 * back out in one look.
 *
 * It must sit outside every footprint below once those are inflated by the player radius in
 * `fpv-controls.ts`; a player spawned *inside* an obstacle is ejected in a direction nobody
 * chose. `yaw` is applied to the camera about the room's vertical, so 0 looks straight at the
 * window in the -Z wall.
 */
export const DESK_SPAWN = { x: -1.9, z: -0.1, yaw: 0 };

/**
 * The monitor's screen, in metres. The panel tilts back 8° so it faces slightly up towards a
 * standing eye at 1.6 rather than square at the chest of someone sitting down.
 */
const PANEL = { width: 0.66, height: 0.42, tilt: -0.14, centerY: 1.06 };

export interface Workstation {
  group: THREE.Group;
  /** Footprints in room-local XZ the player is pushed out of. Height is not considered. */
  obstacles: THREE.Box2[];
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildWorkstation(): Workstation {
  const group = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ color: 0x6b5540, roughness: 0.68, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x39404b, roughness: 0.45, metalness: 0.6 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0x4d5361, roughness: 0.92, metalness: 0.0 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x191d24, roughness: 0.55, metalness: 0.1 });

  // --- desk --------------------------------------------------------------------------------
  group.add(
    box(DESK.width, DESK.thickness, DESK.depth, wood, DESK.x, DESK.top - DESK.thickness / 2, DESK.z)
  );

  // Panel legs rather than four posts: fewer meshes, and a solid end reads as built-in rather
  // than as furniture that was carried aboard.
  const legHeight = DESK.top - DESK.thickness;
  for (const side of [-1, 1]) {
    group.add(
      box(
        0.05,
        legHeight,
        DESK.depth - 0.08,
        steel,
        DESK.x + side * (DESK.width / 2 - 0.1),
        legHeight / 2,
        DESK.z
      )
    );
  }

  // --- monitor -----------------------------------------------------------------------------
  const monitor = new THREE.Group();
  monitor.position.set(DESK.x, DESK.top, DESK.z - 0.12);
  group.add(monitor);

  monitor.add(box(0.26, 0.02, 0.16, steel, 0, 0.01, 0));
  monitor.add(box(0.07, 0.13, 0.05, steel, 0, 0.085, 0));

  const head = new THREE.Group();
  head.position.y = PANEL.centerY - DESK.top;
  head.rotation.x = PANEL.tilt;
  monitor.add(head);

  head.add(box(PANEL.width, PANEL.height, 0.028, plastic, 0, 0, 0));

  // Three things about this material, each of which is wrong by default:
  //  - `toneMapped: false`, or ACES at `toneMappingExposure` 0.8 turns a white web page into
  //    dingy grey. It is a screen emitting its own light, not a surface being lit.
  //  - `color` under 1.0, so the white stays below the bloom threshold (just over 1.0). Only
  //    the LED strips and the atmosphere have earned a halo.
  //  - `MeshBasicMaterial`, so the room's lights don't shade it.
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL.width - 0.05, PANEL.height - 0.05),
    new THREE.MeshBasicMaterial({ map: makeScreenTexture(), color: 0xebebeb, toneMapped: false })
  );
  screen.position.z = 0.016;
  head.add(screen);

  // A little spill, so the panel reads as switched on rather than as a pale rectangle.
  const glow = new THREE.PointLight(0xdfe8ff, 0.35, 1.4, 2);
  glow.position.set(0, 0, 0.25);
  head.add(glow);

  group.add(box(0.42, 0.018, 0.14, plastic, DESK.x + 0.05, DESK.top + 0.009, DESK.z + 0.19));

  // The room's own lights are four cold ceiling points spread over 7 x 5 metres, and under
  // them the desk is a dark smudge against a lit planet — you cannot read the one object the
  // player has to find. One short-range warm lamp over it fixes that and does the first half
  // of CLAUDE.md's "relight it warm": a warm pool in the corner someone works in, against the
  // cold light off the window.
  const lamp = new THREE.PointLight(0xffb877, 2.2, 4.5, 2);
  lamp.position.set(DESK.x, 1.95, DESK.z + 0.35);
  group.add(lamp);

  // --- chair -------------------------------------------------------------------------------
  const chair = new THREE.Group();
  chair.position.set(CHAIR.x, 0, CHAIR.z);
  chair.rotation.y = CHAIR.yaw;
  group.add(chair);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 20), steel);
  base.position.y = 0.02;
  chair.add(base);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 12), steel);
  post.position.y = 0.23;
  chair.add(post);

  chair.add(box(0.46, 0.08, 0.46, fabric, 0, 0.44, 0));

  const backrest = box(0.44, 0.46, 0.07, fabric, 0, 0.71, 0.21);
  backrest.rotation.x = 0.12;
  chair.add(backrest);

  // --- obstacles ---------------------------------------------------------------------------
  // Axis-aligned rectangles rather than the furniture's real outline: the player is a point
  // with a clearance-sized fudge around it, so the resolve only has to be honest to about
  // that. The chair's box is generous on purpose — it is rotated, and a box that traced it
  // exactly would let a shoulder through the backrest.
  const footprint = (x: number, z: number, w: number, d: number) =>
    new THREE.Box2(
      new THREE.Vector2(x - w / 2, z - d / 2),
      new THREE.Vector2(x + w / 2, z + d / 2)
    );

  return {
    group,
    obstacles: [
      footprint(DESK.x, DESK.z, DESK.width, DESK.depth),
      footprint(CHAIR.x, CHAIR.z, 0.66, 0.66)
    ]
  };
}
