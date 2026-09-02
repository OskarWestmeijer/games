import * as THREE from 'three';
import type { InteractionTarget } from '../interaction';
import type { Flight } from '../flight';
import type { Deck } from '../regions';
import type { TextureQuality } from '../space';
import type { LeveledObstacle } from '../fpv-controls';
import { buildOffice, DESK_SPAWN } from './office';
import { buildHall } from './hall';
import { buildBridge } from './bridge';
import { buildGlobe, type Globe } from './globe';
import { buildConsole } from './console';
import * as layout from './layout';

/**
 * The station: one hall, two storeys.
 *
 * This file is the seam. It composes the shell, the bridge, the office furniture, the console
 * and the globe, concatenates what each contributes — footprints, aim targets — and hands
 * `planet-view.ts` one object. Nothing here knows how a room is built.
 *
 * **Everything is authored in station space**, which is also rig space and also the space the
 * camera walks in. The one exception is the office furniture, which predates the station and
 * stays in its own room-local frame, translated by `OFFICE_PLACEMENT` below.
 *
 * There is no per-room light fading any more. It existed because a hub with four arms off it
 * was around twenty point lights on top of a full-screen planet shader, and the only way to
 * afford that was to pay for the room you were standing in. One hall is ten lights, all of
 * which are meant to be visible from anywhere in it — a mezzanine you can see the underside of
 * is the whole idea — so they simply stay on.
 */

export { EYE_HEIGHT } from './layout';

/** How close the eye has to be before the radio offers itself. */
const RADIO_REACH = 1.7;

export interface Station {
  group: THREE.Group;
  /** The walkable floor, as decks at heights. See `regions.ts`. */
  decks: Deck[];
  /** Furniture footprints in station-space XZ, each tagged with the storey it stands on. */
  obstacles: LeveledObstacle[];
  spawn: { x: number; y: number; z: number; yaw: number; level: number };
  /** Built against the flight state, because the console's labels read it. */
  targets(flight: Flight, radio: { available: boolean; isOn(): boolean; toggle(): void }): InteractionTarget[];
  /** The bridge's hologram. Driven from the render loop, which is the only thing that has the rig. */
  globe: Globe;
  /** The office radio's indicator, wired up by whatever owns the audio. */
  setRadioLit(lit: boolean): void;
}

export interface StationOptions {
  /**
   * The renderer and the space's *live* sun vector, so the globe can be built from the same
   * `createEarthMaterial` the planet is. Passing a copy of the sun instead of the vector itself
   * would work until something moved it, and then the globe's terminator would quietly stop
   * agreeing with the window's.
   */
  renderer: THREE.WebGLRenderer;
  sunDirection: THREE.Vector3;
  quality?: TextureQuality;
}

export function buildStation(options: StationOptions): Station {
  const group = new THREE.Group();

  // --- the shell ---------------------------------------------------------------------------
  group.add(buildHall());

  const bridge = buildBridge();
  group.add(bridge.group);

  // --- the office, on the lower floor ------------------------------------------------------
  const office = buildOffice();
  office.group.position.set(layout.OFFICE_PLACEMENT.x, 0, layout.OFFICE_PLACEMENT.z);
  group.add(office.group);

  // --- the globe, behind the console -------------------------------------------------------
  const globe = buildGlobe(options.renderer, options.sunDirection, { quality: options.quality });
  group.add(globe.group);

  const console = buildConsole();
  group.add(console.group);

  // --- lighting ----------------------------------------------------------------------------
  // Four cold points high under the roof, over the square part of the hall between the nose and
  // the bridge. The bridge brings its own — two more cold ones over the deck and two warm under
  // the slab — and the desk lamp in `office/desk.ts` is the warm pool at the window end.
  //
  // **Nothing is hung in the nose.** It is glass on every face, so there is nowhere to mount a
  // lamp and nothing that should compete with what is outside it: the office is lit by its own
  // desk lamp and by the planet, and that contrast is the brief.
  for (const [x, z] of [
    [-3.8, -1.6],
    [3.8, -1.6],
    [-3.8, 1.6],
    [3.8, 1.6]
  ]) {
    const lamp = new THREE.PointLight(0x66d9ff, 3.2, 14, 2);
    lamp.position.set(x, layout.HALL.height - 0.5, z);
    group.add(lamp);
  }

  // Cold light spilling in through the nose, so the hall reads as lit by the planet. Aimed aft
  // from the glass, which is what puts a rim on the bridge's front edge.
  const planetShine = new THREE.DirectionalLight(0x8fc6ff, 0.9);
  planetShine.position.set(0, 3.0, -layout.HALL.depth / 2);
  planetShine.target.position.set(0, 1.4, 2.0);
  group.add(planetShine);
  group.add(planetShine.target);

  // --- what the rest of the app sees -------------------------------------------------------
  const obstacles: LeveledObstacle[] = [
    // The office authors its furniture in room-local coordinates, so it has to be moved out to
    // where the module actually sits. This is the one place the station-space rule needs help,
    // and it needs it because `desk.ts` predates the station.
    ...office.obstacles.map((box) => ({
      level: 0,
      box: new THREE.Box2(
        new THREE.Vector2(
          box.min.x + layout.OFFICE_PLACEMENT.x,
          box.min.y + layout.OFFICE_PLACEMENT.z
        ),
        new THREE.Vector2(
          box.max.x + layout.OFFICE_PLACEMENT.x,
          box.max.y + layout.OFFICE_PLACEMENT.z
        )
      )
    })),
    ...console.obstacles.map((box) => ({ level: 1, box })),
    ...bridge.obstacles.map((box) => ({ level: 1, box }))
  ];

  function targets(
    flight: Flight,
    radio: { available: boolean; isOn(): boolean; toggle(): void }
  ): InteractionTarget[] {
    return [
      // Console keys first: they are the smallest targets in the station, and the first hit
      // wins. See the note in `console.ts`.
      ...console.targets(flight),
      // Dropped entirely when `src/audio/` is empty — the unit stays on the desk as a prop,
      // but a prompt offering to switch on something that cannot make a sound is a lie.
      ...(radio.available
        ? [
            {
              object: office.radioTarget,
              reach: RADIO_REACH,
              label: () => (radio.isOn() ? 'switch the radio off' : 'switch the radio on'),
              activate: radio.toggle
            }
          ]
        : [])
    ];
  }

  return {
    group,
    decks: layout.DECKS,
    obstacles,
    spawn: {
      x: DESK_SPAWN.x + layout.OFFICE_PLACEMENT.x,
      y: 0,
      z: DESK_SPAWN.z + layout.OFFICE_PLACEMENT.z,
      yaw: DESK_SPAWN.yaw,
      level: 0
    },
    targets,
    globe,
    setRadioLit: office.setRadioLit
  };
}
