import * as THREE from 'three';
import type { InteractionTarget } from '../interaction';
import type { Flight } from '../flight';
import type { Deck } from '../regions';
import type { TextureQuality } from '../space';
import type { LeveledObstacle } from '../fpv-controls';
import { buildHall } from './hall';
import { buildBridge } from './bridge';
import { buildGlobe, type Globe } from './globe';
import { buildConsole } from './console';
import { buildLounge } from './lounge';
import * as layout from './layout';

/**
 * The station: one lofted hull, two storeys.
 *
 * This file is the seam. It composes the shell, the bridge, the lounge, the office furniture,
 * the console and the globe, concatenates what each contributes — footprints, aim targets — and hands
 * `planet-view.ts` one object. Nothing here knows how a room is built.
 *
 * **Everything is authored in station space**, which is also rig space and also the space the
 * camera walks in. There used to be one exception — the office furniture, which predated the
 * station and was translated into place by an `OFFICE_PLACEMENT` offset. The office is gone and
 * so is the exception: the lounge places its own group and returns station-space footprints.
 *
 * There is no per-room light fading any more. It existed because a hub with four arms off it
 * was around twenty point lights on top of a full-screen planet shader, and the only way to
 * afford that was to pay for the room you were standing in. One hall is a dozen lights, all of
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

  // --- the globe, behind the console -------------------------------------------------------
  const globe = buildGlobe(options.renderer, options.sunDirection, { quality: options.quality });
  group.add(globe.group);

  // --- the lounge, forward in the glass -----------------------------------------------------
  const lounge = buildLounge();
  group.add(lounge.group);

  const console = buildConsole();
  group.add(console.group);

  // --- lighting ----------------------------------------------------------------------------
  // **Everything forward of the seam is glass now, so there is nothing to hang a lamp from.**
  // Four warm points used to sit under the crown at z = -1.0 and 2.2, which is inside the
  // canopy — a lamp floating in a window, and a bright one at that, right where the planet is.
  //
  // What replaces them is the two places there is still structure. The **seam hoop** at
  // `NOSE_Z` is where the glass meets the shell and is the last real frame in the hall; a pair
  // hung off it throws the length of the room from behind you as you look out. The **floor
  // line** is the other, and it is the reference sheet's own answer — lighting integrated along
  // the walls, at knee height, washing up off the deck. Between them the middle of the hall is
  // deliberately left dim: the window is the thing in this room.
  for (const x of [-2.6, 2.6]) {
    const lamp = new THREE.PointLight(0xffc39a, 15, 15, 2);
    lamp.position.set(x, layout.roofAt(layout.NOSE_Z) - 2.0, layout.NOSE_Z);
    group.add(lamp);
  }

  // Down at the lit rim, which is a `MeshBasicMaterial` and so lights nothing by itself. These
  // are what make it read as a source rather than as a bright stripe painted on the floor.
  for (const z of [-0.4, -4.6]) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.PointLight(0xffb877, 6, 8, 2);
      lamp.position.set(side * (layout.halfWidthAt(z, 0) - 0.4), 0.35, z);
      group.add(lamp);
    }
  }

  // Cold light spilling in through the nose, so the hall reads as lit by the planet. Aimed aft
  // from the glass, which is what puts a rim on the bridge's front edge.
  const planetShine = new THREE.DirectionalLight(0x8fc6ff, 0.9);
  planetShine.position.set(0, 2.6, layout.Z_TIP);
  planetShine.target.position.set(0, 1.3, 1.6);
  group.add(planetShine);
  group.add(planetShine.target);

  // --- what the rest of the app sees -------------------------------------------------------
  const obstacles: LeveledObstacle[] = [
    ...lounge.obstacles.map((box) => ({ level: 0, box })),
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
      // Dropped entirely when `src/audio/` is empty — the unit stays on the table as a prop,
      // but a prompt offering to switch on something that cannot make a sound is a lie.
      ...(radio.available
        ? [
            {
              object: lounge.radioTarget,
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
      x: layout.SPAWN.x,
      y: 0,
      z: layout.SPAWN.z,
      yaw: layout.SPAWN.yaw,
      level: layout.SPAWN.level
    },
    targets,
    globe,
    setRadioLit: lounge.setRadioLit
  };
}
