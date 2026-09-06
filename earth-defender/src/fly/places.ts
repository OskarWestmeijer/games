/**
 * The capitals the bombers go after: a short table of cities, each a name and a coordinate.
 *
 * **This is the board the game is played on.** Every one of these is somewhere a bomber can be
 * sent, somewhere it can be stopped, and — once it has been bombed to nothing — a red cross on
 * the minimap that stays there for the rest of the session. When the last one falls, the flight
 * is over: see `survivingCount` in `fly/bombers.ts`.
 *
 * **Deliberately about four per continent, and no more.** It was sixty-four countries when a
 * ship's target was a place to touch down and vanish at, where the only thing the table had to
 * be was varied. A capital is a *thing you can lose*, so the list has to be short enough that
 * losing one matters and that the crosses on a 100 x 50 minimap can be told apart. Twenty-odd
 * cities is a world you can hold in your head; sixty-four is a scatter chart.
 *
 * **The old "must be well inland" rule is retired**, and that is worth saying out loud because
 * it was load-bearing for years: the table existed so that a ship on a descent never touched
 * down in a bay, with no land mask anywhere in this scene to ask. Nothing descends any more —
 * bombers run in level and bomb from the lane (`fly/lane.ts`) — so a coastal capital is fine,
 * and Lima, Jakarta and Wellington are all on the water on purpose. What survives of the rule is
 * its better half: the target *is* the row, so the name on the countdown cannot disagree with
 * the place it is over.
 *
 * Add rows freely. The one thing to keep is the spread — the nearest surviving capital is where
 * a bomber goes next, so a cluster of five cities in one region is a bomber that never leaves it.
 */

export interface Capital {
  /** As it appears on the HUD and in the command post's line when it falls. */
  name: string;
  latitude: number;
  longitude: number;
}

export const CAPITALS: Capital[] = [
  // --- North America --------------------------------------------------------------------
  { name: 'Ottawa', latitude: 45.4, longitude: -75.7 },
  { name: 'Washington', latitude: 38.9, longitude: -77 },
  { name: 'Mexico City', latitude: 19.4, longitude: -99.1 },
  // --- South America --------------------------------------------------------------------
  { name: 'Bogotá', latitude: 4.7, longitude: -74.1 },
  { name: 'Lima', latitude: -12, longitude: -77 },
  { name: 'Brasília', latitude: -15.8, longitude: -47.9 },
  { name: 'Buenos Aires', latitude: -34.6, longitude: -58.4 },
  // --- Europe ---------------------------------------------------------------------------
  { name: 'London', latitude: 51.5, longitude: -0.1 },
  { name: 'Paris', latitude: 48.9, longitude: 2.4 },
  { name: 'Berlin', latitude: 52.5, longitude: 13.4 },
  { name: 'Moscow', latitude: 55.8, longitude: 37.6 },
  // --- Africa ---------------------------------------------------------------------------
  { name: 'Cairo', latitude: 30, longitude: 31.2 },
  { name: 'Abuja', latitude: 9.1, longitude: 7.4 },
  { name: 'Nairobi', latitude: -1.3, longitude: 36.8 },
  { name: 'Pretoria', latitude: -25.7, longitude: 28.2 },
  // --- Asia -----------------------------------------------------------------------------
  { name: 'Ankara', latitude: 39.9, longitude: 32.9 },
  { name: 'New Delhi', latitude: 28.6, longitude: 77.2 },
  { name: 'Beijing', latitude: 39.9, longitude: 116.4 },
  { name: 'Tokyo', latitude: 35.7, longitude: 139.7 },
  { name: 'Jakarta', latitude: -6.2, longitude: 106.8 },
  // --- Oceania --------------------------------------------------------------------------
  { name: 'Canberra', latitude: -35.3, longitude: 149.1 },
  { name: 'Wellington', latitude: -41.3, longitude: 174.8 }
];
