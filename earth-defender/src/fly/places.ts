/**
 * Where a landing ship can come down: a table of points that are all comfortably **inland**.
 *
 * This exists because a ship must never drop in the ocean, and there is no land mask here to
 * ask — the planet is three NASA images on a sphere, and nothing in the scene knows a coast
 * from a continental shelf. Rather than test a random point and hope, the sites *are* the
 * table: pick a row and you have both a place that is certainly land and the name to put on
 * the countdown, with no lookup that could disagree with itself.
 *
 * Each is a country and a point well inside it — the middle of the landmass, not the capital,
 * so that nothing lands in a bay. Add rows freely; the only rule is that a coordinate must be
 * somewhere you could stand.
 */

export interface LandTarget {
  /** As it appears on the HUD. */
  name: string;
  latitude: number;
  longitude: number;
}

export const LAND_TARGETS: LandTarget[] = [
  // --- the Americas ---------------------------------------------------------------------
  { name: 'Canada', latitude: 55, longitude: -105 },
  { name: 'Alaska', latitude: 64, longitude: -152 },
  { name: 'Greenland', latitude: 72, longitude: -42 },
  { name: 'United States', latitude: 39, longitude: -98 },
  { name: 'Mexico', latitude: 23, longitude: -102 },
  { name: 'Venezuela', latitude: 7, longitude: -66 },
  { name: 'Colombia', latitude: 4, longitude: -73 },
  { name: 'Peru', latitude: -10, longitude: -75 },
  { name: 'Brazil', latitude: -10, longitude: -52 },
  { name: 'Bolivia', latitude: -17, longitude: -64 },
  { name: 'Chile', latitude: -38, longitude: -71 },
  { name: 'Argentina', latitude: -33, longitude: -64 },
  // --- Europe ---------------------------------------------------------------------------
  { name: 'Iceland', latitude: 65, longitude: -18.5 },
  { name: 'Britain', latitude: 52.5, longitude: -1.5 },
  { name: 'France', latitude: 47, longitude: 2.5 },
  { name: 'Spain', latitude: 40, longitude: -4 },
  { name: 'Germany', latitude: 51, longitude: 10 },
  { name: 'Italy', latitude: 43, longitude: 12 },
  { name: 'Poland', latitude: 52, longitude: 19 },
  { name: 'Norway', latitude: 61, longitude: 9 },
  { name: 'Sweden', latitude: 62, longitude: 15 },
  { name: 'Finland', latitude: 63, longitude: 26 },
  { name: 'Romania', latitude: 46, longitude: 25 },
  { name: 'Ukraine', latitude: 49, longitude: 32 },
  { name: 'Russia', latitude: 57, longitude: 60 },
  { name: 'Siberia', latitude: 62, longitude: 105 },
  // --- Africa ---------------------------------------------------------------------------
  { name: 'Morocco', latitude: 31.5, longitude: -6 },
  { name: 'Algeria', latitude: 28, longitude: 3 },
  { name: 'Libya', latitude: 27, longitude: 17 },
  { name: 'Egypt', latitude: 26, longitude: 30 },
  { name: 'Mali', latitude: 18, longitude: -2 },
  { name: 'Niger', latitude: 17, longitude: 9 },
  { name: 'Chad', latitude: 15, longitude: 19 },
  { name: 'Sudan', latitude: 15, longitude: 30 },
  { name: 'Nigeria', latitude: 10, longitude: 8 },
  { name: 'Ethiopia', latitude: 9, longitude: 39 },
  { name: 'Kenya', latitude: 1, longitude: 37.5 },
  { name: 'the Congo', latitude: -3, longitude: 23 },
  { name: 'Tanzania', latitude: -6, longitude: 35 },
  { name: 'Angola', latitude: -12, longitude: 18 },
  { name: 'Zambia', latitude: -14, longitude: 27 },
  { name: 'Namibia', latitude: -22, longitude: 17 },
  { name: 'Botswana', latitude: -22, longitude: 24 },
  { name: 'South Africa', latitude: -29, longitude: 25 },
  { name: 'Madagascar', latitude: -19, longitude: 46.5 },
  // --- Asia -----------------------------------------------------------------------------
  { name: 'Turkey', latitude: 39, longitude: 33 },
  { name: 'Saudi Arabia', latitude: 24, longitude: 45 },
  { name: 'Iran', latitude: 32, longitude: 54 },
  { name: 'Afghanistan', latitude: 34, longitude: 66 },
  { name: 'Kazakhstan', latitude: 48, longitude: 67 },
  { name: 'Pakistan', latitude: 30, longitude: 69 },
  { name: 'India', latitude: 22, longitude: 79 },
  { name: 'Nepal', latitude: 28, longitude: 84 },
  { name: 'Mongolia', latitude: 47, longitude: 104 },
  { name: 'China', latitude: 35, longitude: 103 },
  { name: 'Myanmar', latitude: 21, longitude: 96 },
  { name: 'Thailand', latitude: 15, longitude: 101 },
  { name: 'Japan', latitude: 36, longitude: 138 },
  // --- Oceania --------------------------------------------------------------------------
  { name: 'Borneo', latitude: -1, longitude: 114 },
  { name: 'New Guinea', latitude: -6, longitude: 144 },
  { name: 'Australia', latitude: -25, longitude: 134 },
  { name: 'New Zealand', latitude: -43.5, longitude: 171 },
  // --- and the one nobody lives on ------------------------------------------------------
  { name: 'Antarctica', latitude: -80, longitude: 20 }
];
