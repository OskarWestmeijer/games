import * as THREE from 'three';
import type { Region } from '../regions';

/**
 * A pressurised box, built from a convex floor polygon.
 *
 * Every module except the office is one of these: floor, ceiling, a wall per edge, and a
 * ceiling strip to light it. Edges are named by index, so a module says *which* of its walls
 * is a doorway, which is glass, and which is not there at all — and that is the whole
 * vocabulary the layout needs to describe a hub, an arm, a corridor and a cupola with one
 * builder.
 *
 * The office keeps its own hand-built shell in `office/room.ts`: its window, frame and
 * proportions are tuned against a specific eye position, and re-deriving them from a generic
 * builder would be a way to lose that by accident.
 *
 * Everything here is authored in **station space** — the same space the camera walks in —
 * because every arm sits on a multiple of 90°, so nothing needs placing or rotating after the
 * fact. Rooms at other bearings would need a placement transform and would stop the footprint
 * boxes being axis-aligned.
 */

/** Doorway aperture. Wide and tall enough not to have to aim at it while walking. */
export const DOOR = { width: 1.8, height: 2.2 };

/**
 * The station's palette, in one place.
 *
 * Shared rather than re-declared per module: a second grey that is almost the first grey is
 * how a set of rooms stops reading as one building. Anything a module needs that is not here
 * — the office's wood, the hub's emitter — is a deliberate exception and says so locally.
 */
export const MATERIALS = {
  /** Hull: walls and ceilings. */
  shell: new THREE.MeshStandardMaterial({
    color: 0x232833,
    roughness: 0.78,
    metalness: 0.15,
    side: THREE.DoubleSide
  }),
  floor: new THREE.MeshStandardMaterial({
    color: 0x151920,
    roughness: 0.62,
    metalness: 0.2,
    side: THREE.DoubleSide
  }),
  /** Bright structural metal: frames, ribs, rails. Deliberately not polished — see room.ts. */
  frame: new THREE.MeshStandardMaterial({ color: 0x9aa6b4, roughness: 0.5, metalness: 0.55 }),
  /** Darker structural metal, for things that should recede. */
  strut: new THREE.MeshStandardMaterial({ color: 0x39404b, roughness: 0.45, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xaad4ff,
    roughness: 0.4,
    metalness: 0,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide
  }),
  // Over 1.0 on purpose, so `UnrealBloomPass` (threshold 1.0) picks it up and nothing else does.
  led: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 1.25, 1.8) })
};

const shellMaterial = MATERIALS.shell;
const floorMaterial = MATERIALS.floor;
const glassMaterial = MATERIALS.glass;
const ledMaterial = MATERIALS.led;

export interface ShellSpec {
  /** Convex XZ polygon in station space. Edge `i` runs from point `i` to point `i + 1`. */
  footprint: Region;
  height: number;
  /** Edges with no wall at all — a corridor's two open ends. */
  openEdges?: number[];
  /** Edges built as a wall with a doorway punched through the middle. */
  doorEdges?: number[];
  /** Edges built as glass rather than hull. */
  glazedEdges?: number[];
  /** A panel of floor replaced by glass. Must lie inside `footprint`. */
  glassFloor?: Region;
  /** A hole in the ceiling, for a module that builds something above it. Must lie inside `footprint`. */
  ceilingHole?: Region;
  /** Cold ceiling lights. Positions are station-space XZ; height is taken from the shell. */
  lampSpots?: THREE.Vector2[];
  lampColor?: number;
  lampIntensity?: number;
}

/** Lays a station-space XZ polygon into a `Shape`, whose Y then becomes world Z (see below). */
function shapeFromRegion(region: Region): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(region[0].x, region[0].y);
  for (let i = 1; i < region.length; i++) shape.lineTo(region[i].x, region[i].y);
  shape.closePath();
  return shape;
}

function pathFromRegion(region: Region): THREE.Path {
  const path = new THREE.Path();
  path.moveTo(region[0].x, region[0].y);
  for (let i = 1; i < region.length; i++) path.lineTo(region[i].x, region[i].y);
  path.closePath();
  return path;
}

/**
 * A horizontal plate from a polygon.
 *
 * `ShapeGeometry` lays out in XY facing +Z. Rotating by **+**π/2 about X sends shape-Y to
 * world +Z, so the polygon's coordinates are read straight as (x, z) with no sign flips. The
 * other direction mirrors the plate, which matters the moment it has a hole that is not
 * centred.
 */
function plate(shape: THREE.Shape, y: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/**
 * Positions a wall-sized plane on an edge. `PlaneGeometry` and `ShapeGeometry` both lie in XY
 * facing +Z, so the wall's local X has to be turned to run along the edge: after
 * `rotation.y = θ` local +X points at `(cos θ, 0, -sin θ)`, giving `θ = atan2(-dz, dx)`.
 *
 * Walls are `DoubleSide` and the facing is never solved for — the same call the pod makes.
 * The player cannot leave, so winding correctness buys nothing and a silently missing wall
 * costs a lot.
 */
export function placeOnEdge(object: THREE.Object3D, a: THREE.Vector2, b: THREE.Vector2, y: number): void {
  const dx = b.x - a.x;
  const dz = b.y - a.y;
  object.position.set((a.x + b.x) / 2, y, (a.y + b.y) / 2);
  object.rotation.y = Math.atan2(-dz, dx);
}

/**
 * Two jambs and a lintel standing proud of the opening on both faces.
 *
 * Symmetric about the wall plane on purpose: `placeOnEdge` never solves which way a wall
 * faces — the walls are `DoubleSide` and the player cannot leave — so a frame extruded one
 * way would sink into the hull on half the doors in the station.
 */
function doorFrame(a: THREE.Vector2, b: THREE.Vector2): THREE.Group {
  const frame = new THREE.Group();
  const t = 0.09; // how far the frame stands past the opening
  const d = 0.18; // how far it stands proud of the wall, both sides

  for (const side of [-1, 1]) {
    const jamb = new THREE.Mesh(
      new THREE.BoxGeometry(t, DOOR.height + t, d),
      MATERIALS.frame
    );
    jamb.position.set(side * (DOOR.width / 2 + t / 2), (DOOR.height + t) / 2, 0);
    frame.add(jamb);
  }

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR.width + t * 2, t, d),
    MATERIALS.frame
  );
  lintel.position.set(0, DOOR.height + t / 2, 0);
  frame.add(lintel);

  placeOnEdge(frame, a, b, 0);
  return frame;
}

export interface Shell {
  group: THREE.Group;
  /** Handed up to the station, which fades them by how near the player is. */
  lights: THREE.PointLight[];
}

export function buildShell(spec: ShellSpec): Shell {
  const {
    footprint,
    height,
    openEdges = [],
    doorEdges = [],
    glazedEdges = [],
    glassFloor,
    ceilingHole,
    lampSpots = [],
    lampColor = 0x66d9ff,
    lampIntensity = 2.4
  } = spec;

  const group = new THREE.Group();
  const lights: THREE.PointLight[] = [];

  // --- floor and ceiling ---------------------------------------------------------------
  const floorShape = shapeFromRegion(footprint);
  if (glassFloor) floorShape.holes.push(pathFromRegion(glassFloor));
  group.add(plate(floorShape, 0, floorMaterial));

  const ceilingShape = shapeFromRegion(footprint);
  if (ceilingHole) ceilingShape.holes.push(pathFromRegion(ceilingHole));
  group.add(plate(ceilingShape, height, shellMaterial));

  if (glassFloor) {
    // Sits a hair below the deck so it never z-fights the frame it is set into.
    group.add(plate(shapeFromRegion(glassFloor), -0.01, glassMaterial));
  }

  // --- walls ---------------------------------------------------------------------------
  for (let i = 0; i < footprint.length; i++) {
    if (openEdges.includes(i)) continue;

    const a = footprint[i];
    const b = footprint[(i + 1) % footprint.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);

    let wall: THREE.Mesh;
    if (glazedEdges.includes(i)) {
      wall = new THREE.Mesh(new THREE.PlaneGeometry(length, height), glassMaterial);
    } else if (doorEdges.includes(i)) {
      const shape = new THREE.Shape();
      shape.moveTo(-length / 2, 0);
      shape.lineTo(length / 2, 0);
      shape.lineTo(length / 2, height);
      shape.lineTo(-length / 2, height);
      shape.closePath();

      const hole = new THREE.Path();
      const hw = DOOR.width / 2;
      hole.moveTo(-hw, 0);
      hole.lineTo(hw, 0);
      hole.lineTo(hw, DOOR.height);
      hole.lineTo(-hw, DOOR.height);
      hole.closePath();
      shape.holes.push(hole);

      wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), shellMaterial);
      group.add(doorFrame(a, b));
    } else {
      wall = new THREE.Mesh(new THREE.PlaneGeometry(length, height), shellMaterial);
    }
    placeOnEdge(wall, a, b, height / 2);
    group.add(wall);

    // A strip along the top of each solid wall. Emissive geometry only — the actual lights
    // are the point lamps below, and keeping the two separate is what lets the station fade
    // a room's lighting without the strips visibly winking out.
    if (!glazedEdges.includes(i)) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(length - 0.3, 0.05, 0.05), ledMaterial);
      placeOnEdge(strip, a, b, height - 0.12);
      group.add(strip);
    }
  }

  // --- lamps ---------------------------------------------------------------------------
  for (const spot of lampSpots) {
    const lamp = new THREE.PointLight(lampColor, lampIntensity, Math.max(9, height * 3), 2);
    lamp.position.set(spot.x, height - 0.4, spot.y);
    group.add(lamp);
    lights.push(lamp);
  }

  return { group, lights };
}
