import { PLANET_RADIUS } from '../space';

/**
 * The vertical band the flight view is flown in.
 *
 * **This exists because four files have to agree on one number.** The aeroplane flies in a lane
 * at `CRUISE_ALTITUDE` and may climb to `CEILING_ALTITUDE` and no further; the bombers fly
 * their approaches in the same lane, the boost rings are stacked between the two, and the
 * saucer's own band sits inside them. Any of those tuned on its own puts something the player is
 * meant to reach somewhere the aeroplane can no longer go, which is exactly what a shared
 * altitude ceiling is for.
 *
 * `CRUISE_ALTITUDE` is both the height the aeroplane holds and the lowest it can be — there is no
 * descending out of the lane, only climbing out of it and gliding back. 50 keeps the aircraft
 * about 25 units clear of `ATMOSPHERE_RADIUS` (10.5 above the surface), which is the clearance
 * the old floor carried: every camera in this repo has to stay outside that shell or its outer
 * `BackSide` face wraps the view and smears glow over the whole sky, and the chase camera sits
 * *below* the aeroplane as often as not.
 *
 * The band is 70 units tall, which at cruise is about six seconds of climb and a rather longer
 * glide back — deep enough that a climb is a decision and shallow enough that the planet never
 * leaves the bottom of the frame.
 */
export const CRUISE_ALTITUDE = 50;
export const CEILING_ALTITUDE = 120;

/** The same two as radii from the planet's centre, which is what everything actually places with. */
export const CRUISE_RADIUS = PLANET_RADIUS + CRUISE_ALTITUDE;
export const CEILING_RADIUS = PLANET_RADIUS + CEILING_ALTITUDE;
