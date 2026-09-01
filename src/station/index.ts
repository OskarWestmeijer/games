import * as THREE from 'three';
import type { InteractionTarget } from '../interaction';
import type { Flight } from '../flight';
import type { Region } from '../regions';
import type { TextureQuality } from '../space';
import { buildOffice, DESK_SPAWN, EYE_HEIGHT, ROOM } from './office';
import { buildShell, type Shell } from './shell';
import { buildGlobe, type Globe } from './globe';
import { buildHub } from './hub';
import { buildConsole, CONSOLE_REACH } from './console';
import * as layout from './layout';

/**
 * The station: a hub with a globe in it and four arms off it.
 *
 * This file is the seam. It composes the modules, concatenates what each of them contributes
 * — footprints, aim targets, lights — and hands `planet-view.ts` one object. Nothing here
 * knows how a room is built, and no room knows about any other.
 *
 * **Everything is authored in station space**, which is also rig space and also the space the
 * camera walks in. That identity is what keeps the whole thing simple, and it holds only
 * because every arm is on a multiple of 90°: a room at 30° would need a placement transform,
 * and its footprint boxes would stop being axis-aligned the moment it got one.
 *
 * Only the office is fitted out. The rest are shells with the right shape, the right
 * openings, and the right lights — enough to walk through and judge, and deliberately not
 * more than that yet.
 */

export { EYE_HEIGHT } from './office';

/** How close the eye has to be before the radio offers itself. */
const RADIO_REACH = 1.7;

/**
 * How far from a room's centre its lights are at full strength, and how far out they fade to
 * nothing. Lighting the whole station at once is around twenty point lights on top of a
 * full-screen planet shader; this keeps the bill to the room you are standing in and its
 * neighbours.
 *
 * Note this fades **intensity** and never touches `visible`. three.js drops invisible lights
 * when it assembles the light state, which changes the light *count*, which changes the
 * program cache key, which recompiles every material in the scene — a hitch on every doorway.
 * Fading also simply looks better: a room comes up as you walk into it.
 */
const LIGHT_FULL = 9;
const LIGHT_FADE = 20;

interface Zone {
  center: THREE.Vector2;
  lights: THREE.PointLight[];
  baseIntensity: number[];
}

export interface Station {
  group: THREE.Group;
  /** The walkable floor, as a union of convex regions. See `regions.ts`. */
  regions: Region[];
  /** Furniture footprints in station-space XZ. */
  obstacles: THREE.Box2[];
  spawn: { x: number; z: number; yaw: number };
  /** Built against the flight state, because the console's labels read it. */
  targets(flight: Flight, radio: { available: boolean; isOn(): boolean; toggle(): void }): InteractionTarget[];
  /** Fades each room's lamps by how near the eye is. Call once a frame. */
  updateLighting(eye: THREE.Vector3): void;
  /** The hub's hologram. Driven from the render loop, which is the only thing that has the rig. */
  globe: Globe;
  /** The office radio's indicator, wired up by whatever owns the audio. */
  setRadioLit(lit: boolean): void;
}

export interface StationOptions {
  /**
   * The renderer and the space's *live* sun vector, so the hub globe can be built from the
   * same `createEarthMaterial` the planet is. Passing a copy of the sun instead of the vector
   * itself would work until something moved it, and then the globe's terminator would quietly
   * stop agreeing with the window's.
   */
  renderer: THREE.WebGLRenderer;
  sunDirection: THREE.Vector3;
  quality?: TextureQuality;
}

export function buildStation(options: StationOptions): Station {
  const group = new THREE.Group();
  const zones: Zone[] = [];

  function addZone(cx: number, cz: number, shell: Shell) {
    group.add(shell.group);
    zones.push({
      center: new THREE.Vector2(cx, cz),
      lights: shell.lights,
      baseIntensity: shell.lights.map((l) => l.intensity)
    });
  }

  // --- hub ------------------------------------------------------------------------------
  addZone(0, 0, buildHub());

  const globe = buildGlobe(options.renderer, options.sunDirection, { quality: options.quality });
  group.add(globe.group);

  // --- office (bearing 0°) ---------------------------------------------------------------
  const office = buildOffice();
  office.group.position.set(layout.OFFICE_PLACEMENT.x, 0, layout.OFFICE_PLACEMENT.z);
  group.add(office.group);

  // The office builds and lights itself, so it contributes no zone lamps — but its own
  // ceiling lights still have to come from somewhere. They live here rather than in
  // `room.ts` for the same reason they used to live in `planet-view.ts`: the shell is
  // geometry, the lighting is staging.
  const officeLights: THREE.PointLight[] = [];
  for (const [x, z] of [
    [-ROOM.width / 2 + 0.5, -1.4],
    [ROOM.width / 2 - 0.5, -1.4],
    [-ROOM.width / 2 + 0.5, 1.6],
    [ROOM.width / 2 - 0.5, 1.6]
  ]) {
    const lamp = new THREE.PointLight(0x66d9ff, 3.0, 9, 2);
    lamp.position.set(x, ROOM.height - 0.4, z);
    office.group.add(lamp);
    officeLights.push(lamp);
  }
  // Cold light spilling in through the window, so the room reads as lit by the planet.
  const planetShine = new THREE.DirectionalLight(0x8fc6ff, 0.85);
  planetShine.position.set(0, 2.4, -6);
  planetShine.target.position.set(0, 0.8, 1.5);
  office.group.add(planetShine);
  office.group.add(planetShine.target);

  zones.push({
    center: new THREE.Vector2(layout.OFFICE_PLACEMENT.x, layout.OFFICE_PLACEMENT.z),
    lights: officeLights,
    baseIntensity: officeLights.map((l) => l.intensity)
  });

  // --- navigation (bearing 90°) ----------------------------------------------------------
  const navShell = buildShell({
    footprint: layout.NAV_FOOTPRINT,
    height: layout.NAV.height,
    doorEdges: [layout.NAV_DOOR_EDGE],
    glazedEdges: layout.NAV_GLAZED_EDGES,
    glassFloor: layout.NAV_GLASS_FLOOR,
    lampSpots: [new THREE.Vector2(9.4, -1.6), new THREE.Vector2(9.4, 1.6)]
  });
  addZone(11, 0, navShell);

  // Planet light coming up through the glass floor — this room's signature, set against the
  // office's warm desk lamp.
  const floorShine = new THREE.DirectionalLight(0x9fd0ff, 0.7);
  floorShine.position.set(12.9, -4, 0);
  floorShine.target.position.set(12.9, 2, 0);
  navShell.group.add(floorShine);
  navShell.group.add(floorShine.target);

  const console = buildConsole();
  group.add(console.group);

  // --- airlock (bearing 180°) ------------------------------------------------------------
  addZone(
    0,
    7.6,
    buildShell({
      footprint: layout.AIRLOCK_FOOTPRINT,
      height: layout.AIRLOCK.height,
      doorEdges: [layout.AIRLOCK_DOOR_EDGE],
      lampSpots: [new THREE.Vector2(0, 7.6)],
      lampColor: 0xffd9a0,
      lampIntensity: 2.0
    })
  );

  // --- reserve (bearing 270°) ------------------------------------------------------------
  addZone(
    -8.7,
    0,
    buildShell({
      footprint: layout.RESERVE_FOOTPRINT,
      height: layout.RESERVE.height,
      doorEdges: [layout.RESERVE_DOOR_EDGE],
      lampSpots: [new THREE.Vector2(-8.7, 0)],
      // Dim and unfitted, and meant to read that way.
      lampIntensity: 1.2
    })
  );

  // --- corridors -------------------------------------------------------------------------
  for (const corridor of Object.values(layout.CORRIDORS)) {
    const shell = buildShell({
      footprint: corridor.geometry,
      height: layout.CORRIDOR.height,
      openEdges: corridor.openEdges
    });
    group.add(shell.group);
  }

  // --- what the rest of the app sees -----------------------------------------------------
  const obstacles: THREE.Box2[] = [
    // The office authors its furniture in room-local coordinates, so it has to be moved out
    // to where the module actually sits. This is the one place the station-space rule needs
    // help, and it needs it because `desk.ts` predates the station.
    ...office.obstacles.map(
      (box) =>
        new THREE.Box2(
          new THREE.Vector2(box.min.x + layout.OFFICE_PLACEMENT.x, box.min.y + layout.OFFICE_PLACEMENT.z),
          new THREE.Vector2(box.max.x + layout.OFFICE_PLACEMENT.x, box.max.y + layout.OFFICE_PLACEMENT.z)
        )
    ),
    ...console.obstacles,
    // The globe's plinth. Square rather than octagonal, which lets you get a little closer at
    // the corners than the drum actually allows — nobody has ever noticed this in a room.
    new THREE.Box2(
      new THREE.Vector2(-layout.GLOBE.plinthRadius, -layout.GLOBE.plinthRadius),
      new THREE.Vector2(layout.GLOBE.plinthRadius, layout.GLOBE.plinthRadius)
    )
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

  function updateLighting(eye: THREE.Vector3) {
    for (const zone of zones) {
      const d = Math.hypot(eye.x - zone.center.x, eye.z - zone.center.y);
      const t = 1 - THREE.MathUtils.smoothstep(d, LIGHT_FULL, LIGHT_FADE);
      for (let i = 0; i < zone.lights.length; i++) {
        zone.lights[i].intensity = zone.baseIntensity[i] * t;
      }
    }
  }

  return {
    group,
    regions: layout.WALKABLE,
    obstacles,
    spawn: {
      x: DESK_SPAWN.x + layout.OFFICE_PLACEMENT.x,
      z: DESK_SPAWN.z + layout.OFFICE_PLACEMENT.z,
      yaw: DESK_SPAWN.yaw
    },
    targets,
    updateLighting,
    globe,
    setRadioLit: office.setRadioLit
  };
}
