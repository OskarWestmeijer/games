import * as THREE from 'three';
import { DOOR } from '../shell';

/**
 * The station interior's shell: the box, the window and the ceiling lights. Metres, with the
 * origin on the floor at the centre of the room. The window is in the **-Z** wall, matching
 * the camera's own default forward direction — `planet-view.ts` orients the whole rig so that
 * -Z faces the planet.
 *
 * What goes *in* the room lives beside this file (`desk.ts`); `index.ts` assembles the two.
 */

export const ROOM = { width: 7, height: 3.2, depth: 5 };

/** Camera height above the floor. There's no body, so this is just where the eyes sit. */
export const EYE_HEIGHT = 1.6;

/**
 * The window opening, centred horizontally in the -Z wall. Deliberately close to the size of
 * the wall itself — 6.2 x 2.7 in a 7 x 3.2 wall — so what is left of the wall reads as a rim
 * around a viewport rather than a wall with a porthole in it. From `DESK_SPAWN`, 2.4 m back
 * from the glass and off to one side, that is -26.6° to +64.4° horizontally and -29.0° to
 * +29.7° vertically — the opening fills most of the view rather than sitting in it. The
 * margins it leaves (0.4 at the sides, ~0.25 top and bottom) are what `FRAME_WIDTH` has to
 * fit inside.
 */
export const WINDOW = { width: 6.2, height: 2.7, centerY: 1.62, cornerRadius: 0.5 };

/**
 * How far the frame ring sticks out past the opening, and how far it stands proud of the
 * wall. Thin on purpose: the frame is there to give the hole an edge and catch a highlight,
 * and anything chunkier eats the view it is framing.
 */
const FRAME_WIDTH = 0.1;
export const FRAME_DEPTH = 0.14;

/**
 * Traces a rounded rectangle into `target`, which can be either a `Shape` (an outline) or
 * a `Path` (a hole) — `Shape` extends `Path`, so the same routine builds both halves of
 * the window: the hole punched through the wall and the frame ring around it.
 */
function traceRoundedRect(
  target: THREE.Path,
  width: number,
  height: number,
  radius: number,
  centerY: number
): void {
  const x0 = -width / 2;
  const x1 = width / 2;
  const y0 = centerY - height / 2;
  const y1 = centerY + height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  target.moveTo(x0 + r, y0);
  target.lineTo(x1 - r, y0);
  target.quadraticCurveTo(x1, y0, x1, y0 + r);
  target.lineTo(x1, y1 - r);
  target.quadraticCurveTo(x1, y1, x1 - r, y1);
  target.lineTo(x0 + r, y1);
  target.quadraticCurveTo(x0, y1, x0, y1 - r);
  target.lineTo(x0, y0 + r);
  target.quadraticCurveTo(x0, y0, x0 + r, y0);
}

function windowShape(inset = 0): THREE.Shape {
  const shape = new THREE.Shape();
  traceRoundedRect(
    shape,
    WINDOW.width + inset * 2,
    WINDOW.height + inset * 2,
    WINDOW.cornerRadius + inset,
    WINDOW.centerY
  );
  return shape;
}

function windowHole(): THREE.Path {
  const path = new THREE.Path();
  traceRoundedRect(path, WINDOW.width, WINDOW.height, WINDOW.cornerRadius, WINDOW.centerY);
  return path;
}

/**
 * Builds the shell. Walls are `DoubleSide` on purpose: the player can never leave the room,
 * so there is nothing to gain from getting every plane's winding right and a dark, silently
 * missing wall to lose if one of them is wrong.
 */
export function buildRoom(): THREE.Group {
  const pod = new THREE.Group();

  const { width: W, height: H, depth: D } = ROOM;

  const shell = new THREE.MeshStandardMaterial({
    color: 0x232833,
    roughness: 0.78,
    metalness: 0.15,
    side: THREE.DoubleSide
  });

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x151920,
    roughness: 0.62,
    metalness: 0.2,
    side: THREE.DoubleSide
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  pod.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), shell);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  pod.add(ceiling);

  // The +Z wall is the one the corridor arrives at, so it is a wall with a doorway in it —
  // same Shape-with-a-hole construction as the window below, at a much duller scale.
  const backShape = new THREE.Shape();
  backShape.moveTo(-W / 2, 0);
  backShape.lineTo(W / 2, 0);
  backShape.lineTo(W / 2, H);
  backShape.lineTo(-W / 2, H);
  backShape.closePath();

  const doorway = new THREE.Path();
  const dw = DOOR.width / 2;
  doorway.moveTo(-dw, 0);
  doorway.lineTo(dw, 0);
  doorway.lineTo(dw, DOOR.height);
  doorway.lineTo(-dw, DOOR.height);
  doorway.closePath();
  backShape.holes.push(doorway);

  const back = new THREE.Mesh(new THREE.ShapeGeometry(backShape), shell);
  back.position.set(0, 0, D / 2);
  back.rotation.y = Math.PI;
  pod.add(back);

  const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), shell);
  left.position.set(-W / 2, H / 2, 0);
  left.rotation.y = Math.PI / 2;
  pod.add(left);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(D, H), shell);
  right.position.set(W / 2, H / 2, 0);
  right.rotation.y = -Math.PI / 2;
  pod.add(right);

  // --- the window wall ---------------------------------------------------------------
  // A wall-sized shape with the window punched out of it as a hole. `ShapeGeometry` lays
  // this out in the XY plane facing +Z, which is exactly the orientation the -Z wall needs.
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-W / 2, 0);
  wallShape.lineTo(W / 2, 0);
  wallShape.lineTo(W / 2, H);
  wallShape.lineTo(-W / 2, H);
  wallShape.lineTo(-W / 2, 0);
  wallShape.holes.push(windowHole());

  const front = new THREE.Mesh(new THREE.ShapeGeometry(wallShape), shell);
  front.position.z = -D / 2;
  pod.add(front);

  // The frame is a ring — a slightly larger rounded rect with the opening as its hole —
  // extruded back into the room, so the window reads as a hole with depth rather than a
  // picture painted on a flat wall.
  const frameShape = windowShape(FRAME_WIDTH);
  frameShape.holes.push(windowHole());

  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(frameShape, {
      depth: FRAME_DEPTH,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 2,
      curveSegments: 16
    }),
    // Fairly rough for a metal: polished, it catches the window light in one hot spot on
    // the frame's bottom lip, which reads as a bug rather than a highlight.
    new THREE.MeshStandardMaterial({ color: 0x9aa6b4, roughness: 0.5, metalness: 0.55 })
  );
  frame.position.z = -D / 2;
  pod.add(frame);

  const glass = new THREE.Mesh(
    new THREE.ShapeGeometry(windowShape(), 16),
    new THREE.MeshStandardMaterial({
      color: 0xaad4ff,
      roughness: 0.4,
      metalness: 0.0,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  glass.position.z = -D / 2 + 0.03;
  pod.add(glass);

  // --- LED strips ----------------------------------------------------------------------
  // Plain unlit material with channel values above 1.0: the bloom pass in `planet-view.ts`
  // is what turns these into the glowing lines, and it only picks up what's over its
  // threshold. The `PointLight`s that actually illuminate the room live in `planet-view.ts`.
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 1.25, 1.8) });

  const strip = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), led);
    bar.position.set(x, y, z);
    pod.add(bar);
  };

  // Ceiling only. There were verticals flanking the window too, but the window has since
  // grown to nearly the full wall — there is no wall left to put them on, and keeping the
  // glow overhead leaves the eye nothing bright to compete with the planet.
  //
  // Along both ceiling/side-wall seams, running the depth of the room.
  strip(0.05, 0.05, D - 0.4, -W / 2 + 0.12, H - 0.12, 0);
  strip(0.05, 0.05, D - 0.4, W / 2 - 0.12, H - 0.12, 0);
  // Across the ceiling just inside the window wall.
  strip(W - 0.7, 0.05, 0.05, 0, H - 0.1, -D / 2 + 0.4);

  return pod;
}
