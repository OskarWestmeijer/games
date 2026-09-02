import * as THREE from 'three';
import { MATERIALS } from './shell';
import {
  HALL,
  NOSE_Z,
  WINDOW,
  aftPolygon,
  halfWidthAt,
  hallEdges,
  hullOutline,
  noseRibs,
  nosePolygon
} from './layout';
import type { Region } from '../regions';

/**
 * The hall's shell: the tapered hull, the glazed nose, and the strip lights.
 *
 * Metres, origin on the lower floor at the middle of the room, prow on **-Z** — matching the
 * camera's default forward direction, which is what `planet-view.ts` aims at the planet.
 *
 * **The front third is a glass cage.** Both curving sides, the roof and the floor over that
 * stretch are glass, on top of the window in the prow itself. The office sits inside it, so the
 * desk has planet above, below and to both sides — which is the whole reason the hull slims
 * down there. Aft of `NOSE_Z` the hull goes square and opaque, and that is where the bridge is.
 *
 * The window construction — a wall-sized `Shape` with a rounded rectangle punched out of it, a
 * ring extruded back into the room for the frame, and a near-invisible sheet of glass in the
 * hole — is carried over from the pod's own window wall, which is the one bit of this geometry
 * that was ever tuned. Only the numbers changed.
 */

/**
 * How far the frame ring stands past the opening, and how far it stands proud of the wall.
 * Thin on purpose: the frame gives the hole an edge and catches a highlight, and anything
 * chunkier eats the view it is framing. It has to fit the 0.7 margin the opening leaves.
 */
const FRAME_WIDTH = 0.12;
const FRAME_DEPTH = 0.16;

/**
 * Traces a rounded rectangle into `target`, which can be either a `Shape` (an outline) or a
 * `Path` (a hole) — `Shape` extends `Path`, so the same routine builds both halves of the
 * window: the hole punched through the wall and the frame ring around it.
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

function shapeFromRegion(region: Region): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(region[0].x, region[0].y);
  for (let i = 1; i < region.length; i++) shape.lineTo(region[i].x, region[i].y);
  shape.closePath();
  return shape;
}

/**
 * A horizontal plate from a polygon. `ShapeGeometry` lays out in XY facing +Z; rotating by
 * **+**π/2 about X sends shape-Y to world +Z, so the polygon's coordinates read straight as
 * (x, z) with no sign flips. The other direction mirrors the plate.
 */
function plate(region: Region, y: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapeFromRegion(region)), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/**
 * Positions a wall-sized plane on an edge. `PlaneGeometry` and `ShapeGeometry` both lie in XY
 * facing +Z, so the wall's local X has to be turned to run along the edge: after
 * `rotation.y = θ` local +X points at `(cos θ, 0, -sin θ)`, giving `θ = atan2(-dz, dx)`.
 *
 * Walls are `DoubleSide` and the facing is never solved for. The player cannot leave, so
 * winding correctness buys nothing and a silently missing wall costs a lot.
 */
function placeOnEdge(object: THREE.Object3D, a: THREE.Vector2, b: THREE.Vector2, y: number): void {
  const dx = b.x - a.x;
  const dz = b.y - a.y;
  object.position.set((a.x + b.x) / 2, y, (a.y + b.y) / 2);
  object.rotation.y = Math.atan2(-dz, dx);
}

export function buildHall(): THREE.Group {
  const hall = new THREE.Group();
  const H = HALL.height;

  const outline = hullOutline();
  const edges = hallEdges();
  const glazed = new Set(edges.glazed);

  // --- floor and roof, opaque aft and glass forward ----------------------------------------
  const aft = aftPolygon();
  const nose = nosePolygon();

  hall.add(plate(aft, 0, MATERIALS.floor));
  hall.add(plate(aft, H, MATERIALS.shell));
  // A hair below the deck and a hair above the roof, so neither ever z-fights its opaque half.
  hall.add(plate(nose, -0.01, MATERIALS.glass));
  hall.add(plate(nose, H + 0.01, MATERIALS.glass));

  // --- walls --------------------------------------------------------------------------------
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);

    if (i === edges.front) {
      // A wall-sized shape with the window punched out of it as a hole.
      const wallShape = new THREE.Shape();
      wallShape.moveTo(-length / 2, 0);
      wallShape.lineTo(length / 2, 0);
      wallShape.lineTo(length / 2, H);
      wallShape.lineTo(-length / 2, H);
      wallShape.closePath();
      wallShape.holes.push(windowHole());

      const front = new THREE.Mesh(new THREE.ShapeGeometry(wallShape), MATERIALS.shell);
      placeOnEdge(front, a, b, 0);
      hall.add(front);

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
        MATERIALS.frame
      );
      placeOnEdge(frame, a, b, 0);
      hall.add(frame);

      const glass = new THREE.Mesh(new THREE.ShapeGeometry(windowShape(), 16), MATERIALS.glass);
      placeOnEdge(glass, a, b, 0);
      glass.position.z += 0.03;
      hall.add(glass);
      continue;
    }

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(length, H),
      glazed.has(i) ? MATERIALS.glass : MATERIALS.shell
    );
    placeOnEdge(wall, a, b, H / 2);
    hall.add(wall);
  }

  // --- mullions ------------------------------------------------------------------------------
  // A rib floor-to-roof at every seam between nose panels, on both sides. Without them the
  // faceted glass reads as a modelling artefact; with them it reads as glazing, and they are
  // what actually makes the taper legible from inside.
  for (const z of noseRibs()) {
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.09, H, 0.09), MATERIALS.frame);
      rib.position.set(side * halfWidthAt(z), H / 2, z);
      hall.add(rib);
    }
  }

  // The ring where the glass cage meets the hull. It is the seam between two materials on four
  // surfaces at once, and left bare it reads as a gap rather than as a joint.
  const seamWidth = HALL.width;
  for (const [y, h] of [
    [0.05, 0.1],
    [H - 0.05, 0.1]
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(seamWidth, h, 0.12), MATERIALS.frame);
    bar.position.set(0, y, NOSE_Z);
    hall.add(bar);
  }
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.12), MATERIALS.frame);
    post.position.set((side * HALL.width) / 2, H / 2, NOSE_Z);
    hall.add(post);
  }

  // --- LED strips ----------------------------------------------------------------------------
  // Plain unlit material with channel values above 1.0: the bloom pass in `planet-view.ts` is
  // what turns these into glowing lines, and it only picks up what is over its threshold. The
  // `PointLight`s that actually illuminate the hall live in `station/index.ts`.
  //
  // Aft only. The nose is glass on every face and has nowhere to mount a strip — and nothing
  // bright belongs in there anyway, since the whole point of it is what is outside.
  const strip = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MATERIALS.led);
    bar.position.set(x, y, z);
    hall.add(bar);
  };

  const aftLength = HALL.depth / 2 - NOSE_Z;
  for (const side of [-1, 1]) {
    strip(
      0.06,
      0.06,
      aftLength - 0.6,
      (side * HALL.width) / 2 - side * 0.14,
      H - 0.14,
      NOSE_Z + aftLength / 2
    );
  }
  strip(HALL.width - 0.9, 0.06, 0.06, 0, H - 0.12, NOSE_Z + 0.35);

  return hall;
}
