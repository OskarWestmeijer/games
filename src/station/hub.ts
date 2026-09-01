import * as THREE from 'three';
import { regularRegion } from '../regions';
import { buildShell, MATERIALS, placeOnEdge, type Shell } from './shell';
import { GLOBE, HUB, HUB_DOOR_EDGES, HUB_FOOTPRINT } from './layout';

/**
 * The hub: the room the globe stands in, and the only one with no windows.
 *
 * That is the point of it. Every arm looks out at something; this one looks in. It is the
 * tallest space in the station and the dimmest — the lamps are held well down so the globe is
 * the brightest thing in the room by a wide margin, and so that walking in from a glazed
 * module reads as stepping into a planetarium rather than into another corridor.
 *
 * Everything below is primitives. The octagon does most of the work: the eight corners give
 * the ribs somewhere to be, the eight facets give the rails and the doors a rhythm, and a
 * coffer cut on the same eight-fold symmetry ties the ceiling to the floor.
 */

/** The recess above the globe. Cut into the ceiling, so the room is taller over the middle. */
const COFFER = { radius: 2.35, rise: 0.62 };

/** The emitter the globe stands off: a low drum with a recessed lens in its top. */
const PLINTH = { height: 0.34, lensInset: 0.28 };

/** Handrails: a station has them everywhere, and they set the room's scale against a body. */
const RAIL = { height: 1.06, radius: 0.028, standoff: 0.11 };

/** Warm against the room's cold, and the only warm thing in it. */
const emitterGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 0.95, 0.55) });

/** A dark, matte lens — it has to read as something a projection comes out of, not a lamp. */
const lensMaterial = new THREE.MeshStandardMaterial({
  color: 0x0c0f14,
  roughness: 0.35,
  metalness: 0.1
});

const deckMaterial = new THREE.MeshStandardMaterial({
  color: 0x1b212a,
  roughness: 0.55,
  metalness: 0.35,
  side: THREE.DoubleSide
});

/** Lays a station-space XZ polygon flat. Same convention as `shell.ts` — shape Y becomes +Z. */
function plate(points: THREE.Vector2[], y: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, points[i].y);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

export function buildHub(): Shell {
  const cofferFootprint = regularRegion(0, 0, COFFER.radius, 8);

  // The shell itself contributes no lamps — the hub lights itself below, because what it
  // needs is a ring in the coffer rather than points under the ceiling.
  const shell = buildShell({
    footprint: HUB_FOOTPRINT,
    height: HUB.height,
    doorEdges: Object.values(HUB_DOOR_EDGES),
    ceilingHole: cofferFootprint
  });
  const group = shell.group;
  const lights: THREE.PointLight[] = [];

  // --- structure ------------------------------------------------------------------------
  // A rib at each of the eight corners, floor to ceiling. Without them the octagon reads as a
  // curved wall that happens to have creases in it; with them it reads as built.
  for (const v of HUB_FOOTPRINT) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.16, HUB.height, 0.16), MATERIALS.strut);
    rib.position.set(v.x, HUB.height / 2, v.y);
    rib.rotation.y = Math.atan2(v.x, v.y);
    group.add(rib);
  }

  // --- handrails ------------------------------------------------------------------------
  // Only on the facets without a doorway in them: a rail across a hatch is a trip hazard in a
  // room where the floor is the one thing holding you down.
  const doorEdges = new Set(Object.values(HUB_DOOR_EDGES));
  for (let i = 0; i < HUB_FOOTPRINT.length; i++) {
    if (doorEdges.has(i)) continue;
    const a = HUB_FOOTPRINT[i];
    const b = HUB_FOOTPRINT[(i + 1) % HUB_FOOTPRINT.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y) - 0.5;

    const rail = new THREE.Group();
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(RAIL.radius, RAIL.radius, length, 10),
      MATERIALS.frame
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.z = RAIL.standoff;
    rail.add(bar);

    for (const side of [-1, 1]) {
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, RAIL.standoff),
        MATERIALS.frame
      );
      bracket.position.set((side * length) / 2, 0, RAIL.standoff / 2);
      rail.add(bracket);
    }

    placeOnEdge(rail, a, b, RAIL.height);
    group.add(rail);
  }

  // --- the deck -------------------------------------------------------------------------
  // A raised ring under the globe, a little brighter and a little more metallic than the
  // floor it sits on, so the middle of the room is a place rather than an area.
  const deckOuter = regularRegion(0, 0, 2.9, 8);
  const deck = plate(deckOuter, 0.015, deckMaterial);
  group.add(deck);

  // Eight studs let into the deck, aimed at the plinth. They pick up bloom, so at a glance
  // the floor has a ring of light on it rather than a ring of paint.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const stud = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.05), MATERIALS.led);
    stud.position.set(Math.cos(a) * 2.55, 0.024, Math.sin(a) * 2.55);
    stud.rotation.y = -a;
    group.add(stud);
  }

  // --- the emitter ----------------------------------------------------------------------
  const plinth = new THREE.Mesh(
    // Eight sides, tapering in: the same octagon as the room, so the globe's stand belongs to
    // the building rather than having been carried in.
    new THREE.CylinderGeometry(GLOBE.plinthRadius * 0.88, GLOBE.plinthRadius, PLINTH.height, 8, 1, false, Math.PI / 8),
    MATERIALS.strut
  );
  plinth.position.y = PLINTH.height / 2;
  group.add(plinth);

  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(
      GLOBE.plinthRadius * 0.88 - PLINTH.lensInset,
      GLOBE.plinthRadius * 0.88 - PLINTH.lensInset,
      0.05,
      8,
      1,
      false,
      Math.PI / 8
    ),
    lensMaterial
  );
  lens.position.y = PLINTH.height - 0.02;
  group.add(lens);

  // A warm ring around the lens. The globe above it is cold, so the emitter reading warm is
  // what says the light in the room is coming *from* the machine rather than from the Earth.
  const emitterRing = new THREE.Mesh(
    new THREE.TorusGeometry(GLOBE.plinthRadius * 0.88 - PLINTH.lensInset + 0.05, 0.016, 8, 40),
    emitterGlow
  );
  emitterRing.rotation.x = Math.PI / 2;
  emitterRing.position.y = PLINTH.height + 0.005;
  group.add(emitterRing);

  const emitterLamp = new THREE.PointLight(0xffb877, 1.1, 3.4, 2);
  emitterLamp.position.y = PLINTH.height + 0.25;
  group.add(emitterLamp);
  lights.push(emitterLamp);

  // --- the coffer -----------------------------------------------------------------------
  // The ceiling opens over the globe. Its lip carries the room's real lighting, which means
  // the light comes from above and behind the globe and the walls fall away into the dark.
  group.add(plate(cofferFootprint, HUB.height + COFFER.rise, MATERIALS.shell));

  for (let i = 0; i < cofferFootprint.length; i++) {
    const a = cofferFootprint[i];
    const b = cofferFootprint[(i + 1) % cofferFootprint.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(length, COFFER.rise), MATERIALS.shell);
    placeOnEdge(side, a, b, HUB.height + COFFER.rise / 2);
    group.add(side);
  }

  // Inside the lip, not on it. The coffer is an octagon of circumradius 2.35, so its apothem
  // is 2.17 — a ring any wider than that surfaces through the ceiling plate at each of the
  // eight flats and reads as a modelling mistake rather than as a cove light.
  const cofferRing = new THREE.Mesh(
    new THREE.TorusGeometry(COFFER.radius * 0.85, 0.022, 8, 64),
    MATERIALS.led
  );
  cofferRing.rotation.x = Math.PI / 2;
  cofferRing.position.y = HUB.height - 0.05;
  group.add(cofferRing);

  // Three lamps in the coffer, low: enough to model the ribs and the rails, not enough to
  // compete with what they are lit around.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const lamp = new THREE.PointLight(0x66d9ff, 1.1, 12, 2);
    lamp.position.set(Math.cos(a) * 1.7, HUB.height + 0.2, Math.sin(a) * 1.7);
    group.add(lamp);
    lights.push(lamp);
  }

  return { group, lights };
}
