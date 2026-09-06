import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ATMOSPHERE_RADIUS, PLANET_RADIUS, SUN_DIR, buildSpace } from './space';
import type { TextureQuality } from './space';
import { CEILING_ALTITUDE, CRUISE_ALTITUDE, CRUISE_RADIUS } from './fly/lane';
import { createUfo } from './fly/ufo';
import { createBolts } from './fly/bolts';
import type { BoltTarget } from './fly/bolts';
import { createBombers, BOMBER_GLOW, BOMBER_MAX_HEALTH, CAPITAL_MAX_HEALTH } from './fly/bombers';
import { CAPITALS } from './fly/places';
import { createCommandPost, REARM_RANGE } from './fly/command-post';
import { createRockets } from './fly/rockets';
import { createRings } from './fly/rings';
import { createPacks } from './fly/packs';
import { createTrail } from './fly/trail';
import { createBurst } from './fly/burst';

/**
 * "Flight view": the same world as the other two planet scenes, with a small aeroplane you
 * fly around the globe from a chase camera.
 *
 * It is deliberately the *minimum* that reads as flying. There is no lift, no drag, no stall,
 * no gravity and no ground: the aircraft is an orientation and a speed along its own nose,
 * held between two radii so it can neither dive into the atmosphere shell nor leave the
 * neighbourhood. Everything else is chrome. Do not grow this into a flight model without a
 * reason — the pleasure here is looking at NASA's Earth go past, not managing energy.
 *
 * Like `planet-inspect.ts` it builds its own `buildSpace()`, so it shares no GPU resources
 * and no sun with the other scenes.
 *
 * There is one saucer in the sky, a few bombers on their way down and shooting back,
 * an Earth defence command post going round overhead, stacks of boost rings to fly through, a
 * laser on the space bar and a health bar of the aircraft's own — see `fly/ufo.ts`,
 * `fly/bombers.ts`, `fly/command-post.ts`, `fly/rings.ts`, `fly/packs.ts` and `fly/bolts.ts`.
 * That is the extent of the game in here: still no score, and the only clock is the forty
 * seconds a bomber takes to arrive. What it is all *for* is having somewhere to fly to.
 */

/** Nose is -Z, up is +Y, right is +X — the same convention three's cameras use. */
const NOSE = new THREE.Vector3(0, 0, -1);
const ORIGIN = new THREE.Vector3();

/**
 * Climb and descent, as angles off the local horizon in radians — the *rates* are these times
 * the speed being flown, so a boosted aeroplane climbs the whole band in a second where an
 * unboosted one takes six, and taking a stack of rings in one climb stays the thing to do.
 *
 * **Altitude is commanded here, not flown.** The stick no longer integrates freely into a
 * height: Arrow Up asks for `CEILING_ALTITUDE` and holds it, releasing asks for
 * `CRUISE_ALTITUDE` again, and Arrow Down is only ever a steeper way back down to the lane —
 * there is nothing below it. The nose is then pointed along whatever climb that actually
 * produced (see `LEVEL_GAIN`), so the attitude is never a lie about what the aeroplane is
 * doing, and the aeroplane can no longer be pointed at empty sky.
 */
const CLIMB_ANGLE = 0.55;
const SINK_ANGLE = 0.45;
const DIVE_ANGLE = 0.8;

/**
 * Throttle, in world units per second. The planet is 300 across.
 *
 * **The ceiling is deliberately low, and it came down twice.** It was 130 — fast enough that the
 * throttle alone got you anywhere and the boost rings would have been a curiosity — then 70, and
 * it is 30 now. Under its own power the aeroplane loafs: a lap of the planet is four minutes,
 * the terrain is close enough to read, and going anywhere in a hurry means flying through
 * something. Everything fast in this view is now a ring, which is the point of them, and a
 * boosted aeroplane still does 120 — four times what the throttle alone will give.
 *
 * **`CRUISE_SPEED` is where the aeroplane lives, not where it starts.** The throttle is sprung,
 * like the lane is: hold S and it slows towards `MIN_SPEED` for as long as you hold it, hold W
 * and it runs up to `MAX_SPEED`, and the moment either key comes up it walks back to cruise.
 * Left as a setting you had to *put back*, the usual state of the aeroplane was whatever the
 * last thing you did to it left behind — most often dawdling at 12, because slowing down is
 * what you do in a fight. This way the aeroplane has a speed, and the keys are things you do
 * to it.
 */
const MIN_SPEED = 12;
const MAX_SPEED = 30;
const CRUISE_SPEED = 24;
/**
 * Throttle authority. Slowing is twice as quick as speeding up, so S reads as a brake.
 *
 * Scaled down with the ceiling, and it had to be: the usable range is 18 units wide now against
 * 118 at the original ceiling, so the old 34 a second crossed the whole of it in half a second
 * and the throttle stopped being a lever and became a switch. At 12 it is a second and a half
 * end to end, which is what it always felt like.
 */
const THROTTLE_UP = 12;
const THROTTLE_DOWN = 24;

/**
 * The boost, in world units per second on top of whatever the throttle is doing. Kept as its
 * own term rather than shoved into `speed`, which is what makes it read as a boost: the
 * throttle setting survives it untouched, so the aeroplane accelerates hard, coasts back down
 * and is still cruising at exactly what you left it on.
 *
 * One ring is worth `BOOST_GAIN`, which against a 30-unit throttle ceiling is half as much
 * again as the aeroplane can do on its own — deliberately dramatic, because a ring you can
 * barely feel is not worth flying to. They stack up to `BOOST_MAX`, three deep, which is what
 * makes taking a whole stack in one climb the best thing there is to do here. The decay is a
 * half-life of `BOOST_DECAY x ln 2`, a shade under two seconds: long enough to enjoy and far too
 * short to live on.
 */
const BOOST_GAIN = 45;
const BOOST_MAX = 90;
const BOOST_DECAY = 2.6;

/** Control authority, in radians per second at full deflection. The pitch stick has none of its
 *  own any more — it commands an altitude, and `CLIMB_ANGLE` is its authority. */
const YAW_RATE = 0.5;
/**
 * The left/right arrows command a **bank angle**, not a roll rate, and that distinction is
 * the difference between an aeroplane and a barrel. Held down, a roll *rate* passes through
 * 90° into inverted flight in under a second and a half — which is what the first pass did,
 * and it took the level-hold below with it, pointing the correction at the planet and flying
 * the aircraft into the floor. A bank *command* holds the turn for as long as you hold the
 * key and rolls itself level the moment you let go, which is what "fly around the globe with
 * four keys" actually needs.
 */
const MAX_BANK = 1.15;
/** How hard the bank is driven towards the commanded angle, and the rate limit on doing it. */
const BANK_GAIN = 2.8;
const ROLL_RATE = 2.2;
/**
 * A banked aeroplane turns, because its lift vector is no longer vertical. Modelling that
 * properly needs lift; measuring how far the right wing has risen above the local horizontal
 * and yawing by it costs two lines and is indistinguishable at this speed. It is what makes
 * the left/right arrows alone enough to fly a circuit — without it a roll only rolls, and you
 * have to work the rudder to go anywhere. At full bank it turns a circle in about 11 seconds.
 */
const BANK_TURN_RATE = 0.62;
/**
 * Level-hold, which is this scene's stand-in for gravity — and it is not a nicety.
 *
 * With the stick centred and nothing pulling the nose down, "straight and level" is a
 * *tangent*: you leave the planet behind within seconds and spend the rest of the flight
 * looking at empty sky, which is what the first pass actually did. So with the pitch stick
 * centred the nose is held on the local horizon, and the path bends round the globe.
 *
 * The feed-forward term is the half that matters. Going round a sphere at a given speed *is*
 * a pitch rate (`speed / radius`); a proportional correction alone has steady-state error
 * exactly equal to it, so you climb away anyway, only slower. `LEVEL_GAIN` is then just what
 * pulls the nose back after a deliberate climb or dive.
 *
 * **What it holds the nose on is the flight path, not the horizon**, and that is the whole of
 * how a climb looks like one now that the altitude is commanded rather than flown (see
 * `CLIMB_ANGLE`). Level in the lane the two are the same thing; climbing or gliding back down,
 * the target is the sine of the angle the aeroplane is *actually* going up or down at, so the
 * nose says exactly that and flattens out by itself the moment the altitude stops changing.
 * Nothing scales the hold down any more — the stick has no direct pitch authority to fight it
 * with, and it needs all of its own to point the nose at a climb it did not choose the size of.
 *
 * It is applied about `forward x radialUp` — the world-horizontal axis — and **not** about
 * the aircraft's own pitch axis, which is the obvious thing to reach for and is wrong the
 * moment you bank. At 66° of bank a pitch-axis correction has only cos(66°) of the authority
 * it needs, so a held turn sinks all the way to `MIN_RADIUS` and stays there.
 */
const LEVEL_GAIN = 1.6;

/** Seconds for a control to reach full deflection, so a keypress is a stick and not a switch. */
const CONTROL_LAG = 0.14;

/** Chase camera, in aircraft-local metres: behind (+Z) and above. */
const CHASE_OFFSET = new THREE.Vector3(0, 3.4, 15);
/** Aim point ahead of the nose. */
const CHASE_LOOK_AHEAD = 12;
/**
 * …and how far *below* it. This is what keeps the planet in the picture. Flying level at this
 * altitude the limb sits about 32° under the local horizontal, which is outside a 58° frame
 * aimed along the nose — aim slightly down and the Earth fills the bottom third while the
 * aeroplane stays centred.
 */
const CHASE_LOOK_DROP = 3.2;
/** How quickly the camera catches up, per second. Lag is what makes a turn feel like one. */
const CHASE_FOLLOW = 6.0;
/**
 * How much of the aircraft's roll the camera copies. **Not 1.** A chase camera welded to the
 * aircraft's own up makes a roll invisible: the aeroplane sits perfectly still in frame while
 * the entire universe rotates around it, which is what the first pass looked like. Splitting
 * the difference with the local vertical is what makes a bank read as a bank — at 60° of bank
 * the horizon tilts 40° and the aeroplane visibly leans the remaining 20°.
 *
 * Must not be exactly 0.5, which is the one value at which the blend collapses to nothing
 * when inverted.
 */
const CHASE_ROLL_SHARE = 0.65;

/**
 * The guns, in aircraft-local metres: the wingtips, just ahead of the navigation lights they
 * sit beside. Mirrored in x and fired alternately, which is what makes a stream of bolts read
 * as an aeroplane's rather than as a cursor's.
 */
const MUZZLE = new THREE.Vector3(4.2, 0.05, -0.6);
/** How close a bomber's bolt has to pass the aircraft to count — the wingspan is 8.4, so
 *  this is generous the same way the saucer's and the bombers' own hit radii are: judging
 *  a near miss on a moving target from a chase camera is hard enough without a stingy hitbox. */
const PLANE_HIT_RADIUS = 4.5;
/**
 * How far down the nose the reticle is projected — the range it is boresighted for.
 *
 * It exists because the chase camera does *not* look along the nose: it is aimed a little below
 * it so the planet stays in the picture, so the middle of the screen is not where the shots go,
 * and a gun whose aim you cannot see is a guess rather than a gun.
 *
 * There is a range in it because the camera sits 3.4 above the nose line, so the angle from the
 * camera down to a point ahead of the aeroplane depends on how far ahead it is: 1.7° at 100
 * units, 1.0° at 200, 0.5° at 400. One ring cannot be right at every range — the same boresight
 * problem a real gunsight has — so it is set for the middle of the range things actually get
 * shot at, where the residual error is well inside the saucer's own hit radius. The wingtips
 * straddle it symmetrically and so bias it not at all.
 *
 * **It is projected onto the lane, not along the nose**, which is the other half of what the
 * curve of the planet did to this gun — see `LOCK_CONE`. A shot down a level nose is a tangent,
 * and a tangent to a 350-unit sphere is 15 units above the ground track by the time it has gone
 * 100: the reticle sat on empty sky above everything worth shooting at. The point it marks now
 * is the one `RETICLE_RANGE` ahead *at the aircraft's own height*, which is where the shot
 * actually goes, and it keeps whatever climb the nose has so a climbing shot still leads upwards.
 */
const RETICLE_RANGE = 220;

/**
 * Aim assist: how far off the nose, in radians of *bearing*, a target may be and still be taken
 * as the one being aimed at — and how far away it may be.
 *
 * **The gun needs this because everything in the fight now flies at one height** (`fly/lane.ts`),
 * and two things at the same altitude on a 350-unit sphere do not see each other along the
 * horizontal: a bomber 220 units ahead sits about 18° *below* a level nose, and the whole
 * of the old boresight was built on the assumption that the shot and the nose were the same
 * line. Rather than ask the player to guess a depression that changes with every range, the
 * laser picks the thing you are pointed at and fires at *it* — the reticle moves onto it, so
 * the lock is something you can see rather than something the gun does behind your back.
 *
 * The cone is measured **in bearing only**, flattened onto the local horizontal, because the
 * elevation to a target is decided by the curve rather than by aiming: point the aeroplane at
 * something and it is locked, whatever the planet is doing to the line between you. Ties go to
 * the tightest bearing, not the nearest ship — the one dead ahead is the one you meant.
 *
 * `LOCK_RANGE` is inside the horizon, which at this altitude is 180 units for each of you and
 * so about 360 between two aircraft in the lane: past that a target is behind the planet, and a
 * lock on something you cannot see would fire the laser into the ground. It also sits just
 * outside the bombers' own `FIRE_RANGE` of 220, so the fight opens at about the range they
 * start shooting back at.
 */
const LOCK_CONE = 0.3;
const LOCK_RANGE = 260;

/**
 * What the aeroplane carries, and it is finite now.
 *
 * **Endless ammunition made the laser the answer to everything**: the trigger was free, so
 * holding it down cost nothing and there was never a moment in this view where you had to
 * decide anything. A magazine turns the gun into a resource and the command post into a place
 * you have to go — which is the other half of it, because until now the post was the one thing
 * up here with nothing to do (`fly/command-post.ts`).
 *
 * `LASER_AMMO` is twenty seconds of held fire at the laser's own cadence, or ten bombers' worth
 * of hits if none of it misses — generous on purpose. Running dry should be the result of a bad
 * afternoon, not of a single fight, or the rearm run stops being an errand and becomes the game.
 * `ROCKET_AMMO` is deliberately tiny: see `fly/rockets.ts` for what one is worth.
 */
const LASER_AMMO = 120;
const ROCKET_AMMO = 4;
/**
 * The magazine bar on the aeroplane's own spine, full and empty. Warm amber at full — the laser's
 * own colour, because that is what it is a bar of — running to the same red the fallen capitals
 * are marked in. Authored over 1.0 at both ends so the bloom keeps it a light rather than a
 * painted stripe; the red is *brighter* than the amber on purpose, because the one moment this
 * has to be impossible to miss is the moment it is nearly out.
 */
const AMMO_FULL = new THREE.Color(3.2, 1.5, 0.45);
const AMMO_EMPTY = new THREE.Color(3.6, 0.5, 0.3);

/** What the command post says when you pass through it with something to refill. */
const REARM_MESSAGE = 'Rearmed and repaired. Good hunting.';
/** …and when the trigger comes up empty. Held off by `MESSAGE_SECONDS` like everything else, so
 *  an empty gun says this once and then lets you get on with flying to the post. */
const DRY_MESSAGE = 'Out of ammunition — rearm at the command post.';

/**
 * How far above a bomber its floating health bar sits, in world units — clear of the hull
 * (the tallest point is the collar at y = 3.1) so the bar never overlaps the model it belongs
 * to. Offset along the local vertical (the ship's own position, normalised) rather than along
 * its mesh orientation: the mesh's own "up" is the direction of travel, which on a descent
 * points mostly at the ground, and a bar hung off that would drift underneath the ship rather
 * than staying above it.
 */
const BOMBER_BAR_OFFSET = 6.5;
/**
 * …and how far above the *city* its own bar sits. Much higher than a ship's: the city is a
 * point on the ground with a bomber circling 26 units out and 50 up, and a bar pinned to the
 * surface would sit in the middle of the terrain the bombs are landing on.
 */
const CAPITAL_BAR_OFFSET = 26;

/**
 * The player's own health. The saucer stays unarmed on purpose (see `fly/ufo.ts`), but a landing
 * ship now shoots back while it is in the air — this is what its return fire takes off, and
 * what a recovered repair pack (`fly/packs.ts`) puts back. There is still no ground to hit and
 * no consequence written in for reaching zero: it clamps there and stops, which is as far as
 * this was asked to go.
 */
/** 100, then up 20% — a bit more margin for a fight that now has return fire, boost rings and
 *  repair packs all touching the same number. */
const PLANE_MAX_HEALTH = 120;
/**
 * How much one hit from a bomber's return fire takes off. Was 7 — a shade under half a
 * tank for twelve hits, which read as sniping rather than fighting back, especially alongside
 * the faster `FIRE_INTERVAL` that came with this. At 15 against a 120-health aircraft, eight
 * hits brings a fresh one down, which against a ship that now fires under once a second means
 * standing in front of one and trading shots is a real risk rather than background noise.
 */
const BOMBER_HIT_DAMAGE = 15;
/** How much a recovered repair pack gives back, capped at `PLANE_MAX_HEALTH`. Two packs make you
 *  whole exactly, at 60 against 120 — kept a clean multiple of `PLANE_MAX_HEALTH` when that went
 *  up 20%, rather than let "two packs" quietly stop being true. */
const PACK_HEAL_AMOUNT = 60;
/**
 * How much flying through one boost ring gives back — a quarter of the tank, so four rings
 * (a third of a stack, or a stack and change) make a fresh aircraft whole. On top of the boost
 * itself, which is the ring's original job: going fast and staying alive are the same errand
 * now, rather than the healing being a reason to fly to a ring on its own.
 */
const RING_HEAL_AMOUNT = PLANE_MAX_HEALTH / 4;
/**
 * How far above the aircraft its bar floats, along the aircraft's *own* up rather than the local
 * vertical a bomber's bar uses. A bomber sits still relative to the ground it is
 * over; the aeroplane banks, and anchoring to world "up" would swing the bar out to one side of
 * the fuselage in every turn instead of staying parked over it the way the chase camera expects.
 */
const PLANE_BAR_OFFSET = 3;

/**
 * The minimap's SVG overlay is drawn in map fractions — 100 across by 50 down, which is the
 * panel's own 2:1 — so a longitude is an x and a latitude is a y with nothing in between.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAP_W = 100;
const MAP_H = 50;
/** The bomber's mark on that map, in the same units. */
const SHIP_MARK = 2.6;
/** Half the width of a fallen capital's cross, in those same map units. A shade larger than a
 *  ship's mark: it is the one thing on this panel that is permanent, and the only red. */
const CROSS_ARM = 1.6;
/** When a countdown stops being information and starts being your problem. */
const URGENT_SECONDS = 10;

/**
 * What the command post says when you arrive, and how long it stays up. Short, because a line
 * you have already read is in the way of the game — it snaps on and fades off, and the flight
 * has not waited for it.
 */
const BRIEFING = 'We are under attack — shoot down the bombers!';
const MESSAGE_SECONDS = 5;
/**
 * What the command post says when the aircraft's own health runs out. Unlike `BRIEFING` this is
 * never given a duration to fade on — `update()` stops running the moment `destroyed` is set, so
 * the countdown that would remove it never gets another tick. It stays up until `reset()` takes
 * it down, which is what makes it read as a stopping point rather than a passing remark.
 *
 * **It has to say how to get out of the state it just put you in.** The first version was just
 * the first sentence, and the frozen scene it sits over gives no other hint that Space is the
 * way back — there is no on-screen prompt anywhere else in this view for a key to press, because
 * everywhere else the keys are the permanent legend in the corner. That legend still says
 * "laser" against Space here, which is now also wrong, so the message is the only place left to
 * say what the key does.
 */
const DEFEAT_MESSAGE = 'The fight for Earth has been lost. Press Space to fly again.';

/**
 * The other way to lose, and the one the whole map is about: every capital bombed to nothing
 * (`survivingCount` in `fly/bombers.ts`). It reads differently from `DEFEAT_MESSAGE` on purpose
 * — that one is about the aeroplane, this one is about the world it was defending, and the
 * aircraft is not even destroyed when it happens. Like the other, it has to say how to get out
 * of the state it just put you in.
 */
const EARTH_LOST_MESSAGE = 'The last capital has fallen. Earth is lost — press Space to fly again.';

/**
 * How quickly the minimap marker's heading follows the track it is leaving. It is smoothed
 * because it comes from the *difference* between two positions a frame apart — a small number
 * over a variable dt, which a marker pointed straight at it would jitter on.
 */
const TRACK_LAG = 0.25;

/**
 * Where the aircraft starts: in the lane, like everything else in this view. Low enough that the
 * planet fills the bottom of the frame — the curve of the limb is the whole reason to be here —
 * and clear of the atmosphere shell by the margin `fly/lane.ts` argues out.
 */
const START_RADIUS = CRUISE_RADIUS;
const START_DIRECTION = new THREE.Vector3(0.35, 0.3, 0.89).normalize();

/**
 * A box aeroplane: fuselage, wings, tailplane, fin, a dark canopy and the two navigation
 * lights. Built nose-down -Z at the origin, so the caller only has to place it.
 *
 * The nav lights and the exhaust are authored over 1.0 on purpose — that is the side of the
 * bloom threshold that turns a small bright face into an actual light, the same trick the
 * station's LED strips use.
 */
/**
 * The aeroplane, and the two things on it that are *readouts* rather than shape.
 *
 * **The magazine is on the aircraft, not only in the corner pill.** The chase camera keeps the
 * aeroplane in the middle of the screen for the whole flight, so the one surface guaranteed to be
 * in your eyeline is the aeroplane itself — a number in a corner is something you have to
 * remember to read, and running dry is the one state that changes what you should be doing. So
 * the fuselage carries a bar that drains and reddens with the rounds (`AMMO_FULL` → `AMMO_EMPTY`),
 * and the four rockets are four pips under the port wing that go out as they are spent.
 *
 * Both are `MeshBasicMaterial` over 1.0, like the nav lights: they have to read at night and from
 * fifteen units back, and the bloom is what makes a half-unit box a light rather than a speck.
 */
function buildPlane(): { plane: THREE.Group; ammoFill: THREE.Mesh; rocketPips: THREE.Mesh[] } {
  const plane = new THREE.Group();

  // Mid grey rather than white. At white the aeroplane saturated over the day side and blew
  // straight through the bloom threshold, so the subject of the scene was a glowing smear.
  const body = new THREE.MeshStandardMaterial({ color: 0x9aa1a9, roughness: 0.42, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x39404a, roughness: 0.6, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.12, metalness: 0.85 });

  const part = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    plane.add(mesh);
    return mesh;
  };

  part(new THREE.BoxGeometry(0.95, 0.95, 6.4), body, 0, 0, 0);
  // A shorter, thinner box in front of the fuselage is the whole of the nose taper.
  part(new THREE.BoxGeometry(0.55, 0.55, 1.5), trim, 0, 0, -3.7);
  part(new THREE.BoxGeometry(8.4, 0.18, 1.7), body, 0, 0.05, 0.3);
  part(new THREE.BoxGeometry(3.2, 0.16, 0.9), body, 0, 0.05, 2.7);
  part(new THREE.BoxGeometry(0.16, 1.5, 1.1), body, 0, 0.85, 2.8);
  part(new THREE.BoxGeometry(0.72, 0.42, 1.3), glass, 0, 0.6, -0.9);

  // Port red, starboard green — the one aviation convention worth spending two spheres on.
  const tip = new THREE.SphereGeometry(0.17, 10, 8);
  part(tip, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.25, 0.3) }), -4.2, 0.05, 0.3);
  part(tip, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 2.6, 0.5) }), 4.2, 0.05, 0.3);
  part(
    new THREE.BoxGeometry(0.5, 0.5, 0.12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 0.8, 0.4) }),
    0,
    0,
    3.25
  );

  // The magazine: a dark track across the spine behind the canopy, and a fill inside it that is
  // scaled and recoloured every time a round is spent.
  //
  // **Across the aeroplane, not along it.** The obvious place is the spine, fore and aft, and it
  // is useless there: the chase camera sits directly astern, so a bar running away from you is
  // foreshortened into a dot, and the first pass had a gauge you could not read at all. Laid
  // across the fuselage it is broadside to the camera for the whole flight.
  //
  // It drains from the port end because the geometry is translated so the box's origin *is* that
  // end — scaled about its middle it would shrink towards the centre, which reads as a thing
  // getting smaller rather than as a magazine emptying.
  const trackWidth = 3;
  part(
    new THREE.BoxGeometry(trackWidth, 0.1, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.06, 0.08) }),
    0,
    0.52,
    1.25
  );
  const fillGeometry = new THREE.BoxGeometry(trackWidth, 0.16, 0.32);
  fillGeometry.translate(trackWidth / 2, 0, 0);
  const ammoFill = part(fillGeometry, new THREE.MeshBasicMaterial({ color: AMMO_FULL.clone() }), -trackWidth / 2, 0.52, 1.25);

  // …and the rockets, as four pips under the port wing, in the order they are fired: what a rack
  // of four actually looks like from behind, which is the whole reason they are pips and not a
  // second bar.
  const pipGeometry = new THREE.BoxGeometry(0.22, 0.22, 0.5);
  const pipMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.2, 0.35) });
  const rocketPips = [0, 1, 2, 3].map((i) => part(pipGeometry, pipMaterial, -1.5 - i * 0.55, -0.16, 0.3));

  return { plane, ammoFill, rocketPips };
}

export interface FlyViewOptions {
  /** Which surface map set to open on. See `TextureQuality` in `space.ts`. */
  quality?: TextureQuality;
  /** Live readouts in the HUD pill. Injected, never queried for. */
  speedLabel?: HTMLElement | null;
  altitudeLabel?: HTMLElement | null;
  /** How many bombers have been shot down. Written only when it changes — it moves a
   *  handful of times a session against sixty frames a second. */
  downedLabel?: HTMLElement | null;
  /**
   * What is left in the guns: laser rounds and rockets. Both are written only when they change,
   * like `downedLabel`, and both take a `.empty` class when they run out — a number you cannot
   * spend is a different thing from a low one, and the pill is otherwise all one colour.
   */
  ammoLabel?: HTMLElement | null;
  rocketLabel?: HTMLElement | null;
  /** How many capitals have been lost. Takes a `.lost` class from the first one — the mirror of
   *  the ammunition counts' `.empty`, which only matters at zero. */
  lostLabel?: HTMLElement | null;
  /**
   * The minimap's marker, sitting inside a panel that holds a flat map of the whole world.
   * Injected like the readouts — `main.ts` is the only file that reaches for DOM ids — and the
   * panel it is a child of is what supplies the proportions `updateMinimap()` needs.
   */
  planeMarker?: HTMLElement | SVGElement | null;
  /** The minimap's marker for the saucer. Hidden by this module while there isn't one. */
  ufoMarker?: HTMLElement | SVGElement | null;
  /** The minimap's marker for the command post, which is always up there. */
  postMarker?: HTMLElement | SVGElement | null;
  /**
   * An empty `<svg>` over the minimap, in which this module draws one approach path and one
   * mark per bomber. Handed the container rather than the marks themselves because how
   * many there are belongs to `fly/bombers.ts`, not to the markup.
   */
  mapOverlay?: SVGElement | null;
  /**
   * The banner across the top of the screen. This module appends one countdown per bomber
   * to it and hides the whole panel when there is nothing on its way down. Same arrangement as
   * `mapOverlay`, and for the same reason.
   */
  alertPanel?: HTMLElement | null;
  /**
   * The command post's message panel and the line inside it. This module writes the text and
   * shows the panel for a few seconds; everything else about it is markup and CSS.
   */
  messagePanel?: HTMLElement | null;
  messageText?: HTMLElement | null;
  /** The aiming reticle, placed over wherever the nose is pointing. */
  reticle?: HTMLElement | SVGElement | null;
  /**
   * An empty container this module fills with one floating health bar per bomber,
   * anchored over the ship itself rather than in a corner panel — a ship you are actually
   * aiming at is not something you want to read a status bar for somewhere else on screen.
   * How many there are is `fly/bombers.ts`'s business (`BOMBER_COUNT`), not the markup's.
   */
  bomberHealthLayer?: HTMLElement | null;
  /**
   * The player's own floating health bar and its fill. Only one of these exists, unlike the
   * bombers' bars, so it is markup (`#fly-plane-health`) rather than something this
   * module builds — see `updatePlaneHealthBar()`.
   */
  planeHealthBar?: HTMLElement | null;
  planeHealthFill?: HTMLElement | null;
  /**
   * The word in the corner legend against the Space key — "laser" normally. Swapped to "restart"
   * for as long as the aircraft is destroyed, since the same key does a different job then and
   * the permanent legend is the one piece of on-screen help that would otherwise go on saying
   * the wrong thing.
   */
  spaceLabel?: HTMLElement | null;
}

export function createFlyView(canvas: HTMLCanvasElement, options: FlyViewOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // Same reasoning as the other two planet scenes: this is almost entirely full-screen
  // shader plus a bloom composer, and 2x device pixels on a retina tablet is four times the
  // fragment cost for a difference nobody can see.
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2)
  );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);

  // The aircraft is ~8 units across and the star sphere is at 8000; a near plane of 0.5 keeps
  // a plain depth buffer precise across that without a logarithmic one.
  const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 20000);

  const space = buildSpace(renderer, { quality: options.quality });
  scene.add(space.group);

  // The planet lights itself from `SUN_DIR` inside its own shader; these are for the
  // aeroplane alone.
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.0);
  sun.position.copy(SUN_DIR).multiplyScalar(1000);
  scene.add(sun);
  /**
   * Earthshine, and it is the light that does the work here. A `HemisphereLight` takes its
   * axis from its `position`, so re-aiming it along the local vertical every frame gives the
   * aeroplane a cool sky above and a bright planet below wherever on the globe it happens to
   * be. Without it the whole night side of the orbit is a flat black silhouette against the
   * stars — which is what the scene actually looked like the first time round.
   */
  const earthshine = new THREE.HemisphereLight(0x1b2536, 0x74869a, 1.15);
  scene.add(earthshine);
  scene.add(new THREE.AmbientLight(0x2c3646, 0.4));

  const { plane, ammoFill, rocketPips } = buildPlane();
  scene.add(plane);

  // One saucer, drifting; one pool of laser bolts. Both live in world space beside the
  // aeroplane rather than under it.
  const ufo = createUfo();
  scene.add(ufo.group);
  const packs = createPacks();
  scene.add(packs.group);
  // The bombers' own return fire: the same pool the player's laser is, cold green and
  // tuned slower and sparser — see `BoltsOptions` in `fly/bolts.ts` and the header of
  // `fly/bombers.ts` for the shared-cooldown reasoning.
  const enemyBolts = createBolts({
    color: BOMBER_GLOW,
    pool: 16,
    speed: 200,
    lifetime: 2.4,
    // Loosened from 0.35 along with the faster per-ship `FIRE_INTERVAL` in `fly/bombers.ts` —
    // left at the old value this would have been the thing actually capping the rate of fire,
    // not the ships' own cadence.
    interval: 0.28
  });
  scene.add(enemyBolts.group);
  // A ship you shoot down leaves a repair pack where it died. Ten seconds, then it is gone —
  // see `fly/packs.ts`. Recovering one now also patches the aircraft back up, which is the
  // "if damage is ever added" that file's header was written for.
  const bombers = createBombers(space, {
    onShotDown: (at) => packs.drop(at),
    // A capital going is the one event in this view that is purely bad news, so it is the one
    // thing here that both writes to the map and says something out loud.
    onCapitalDestroyed: (capital, at) => {
      markCapitalLost(capital, at);
      capitalsLost++;
      say(`${capital.name} has fallen.`);
    },
    enemyBolts
  });
  scene.add(bombers.group);
  /** The last kill count written to the HUD. -1 so the opening zero is written once. */
  let shownDowned = -1;
  const post = createCommandPost();
  scene.add(post.group);
  const rings = createRings(space);
  scene.add(rings.group);
  // In world space beside the aeroplane rather than under it: a wake is left behind in the
  // world, and parented to the aircraft it would turn with it.
  const trail = createTrail();
  scene.add(trail.group);
  /**
   * The aircraft's own destruction — `fly/burst.ts` again, the same shape of effect as a
   * bomber's kill, warm rather than cold because this one is ours, and bigger and a
   * little slower (34 units, 1.4 s, eighteen shards against a ship's 26/1.1/14) because it is
   * the one explosion in this scene that ends the flight rather than just removing a target.
   */
  const planeBurst = createBurst({
    color: new THREE.Color(3.2, 1.4, 0.4),
    radius: 34,
    time: 1.4,
    shardCount: 18
  });
  scene.add(planeBurst.group);
  const bolts = createBolts();
  // The second weapon, and the only thing in this view fired one at a time — see `fly/rockets.ts`.
  const rockets = createRockets();
  scene.add(bolts.group);
  scene.add(rockets.group);
  /** Built once: the position inside it is the saucer's own live vector. */
  const ufoTarget: BoltTarget = {
    position: ufo.position,
    radius: ufo.hitRadius,
    hit: () => ufo.hit()
  };
  /** What the laser can hit right now. Refilled every frame, never reallocated. */
  const boltTargets: BoltTarget[] = [];
  /**
   * The aircraft itself, as a target for the bombers' return fire. A stable one-element
   * array rather than something rebuilt every frame like `boltTargets` above — there is always
   * exactly one aircraft, so there is nothing here that ever changes shape.
   */
  const planeTarget: BoltTarget = {
    position: plane.position,
    radius: PLANE_HIT_RADIUS,
    hit: () => {
      // Tolerates being called after death like every other `hit()` here does after its own
      // kill: two bolts can land in the same frame, and the second must not fire a second
      // explosion or a second defeat message.
      if (destroyed) return;
      health = Math.max(0, health - BOMBER_HIT_DAMAGE);
      if (health <= 0) {
        destroyed = true;
        plane.visible = false;
        trail.clear();
        planeBurst.fire(plane.position);
        say(DEFEAT_MESSAGE);
        if (options.spaceLabel) options.spaceLabel.textContent = 'restart';
      }
    }
  };
  const enemyBoltTargets: readonly BoltTarget[] = [planeTarget];
  /** Which wingtip fires next. */
  let muzzleSide = 1;

  // Same chain as the other planet scenes: the atmosphere and the nav lights are authored
  // over 1.0 so bloom turns them into light, and `OutputPass` has to stay last.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.4, 1.0));
  composer.addPass(new OutputPass());

  /** Held keys. Read as an axis pair, so pressing both cancels rather than latching. */
  const keys = new Set<string>();
  const axis = (positive: string[], negative: string[]) =>
    (positive.some((k) => keys.has(k)) ? 1 : 0) - (negative.some((k) => keys.has(k)) ? 1 : 0);

  // Smoothed control deflections, -1..1.
  let pitch = 0;
  let roll = 0;
  let yaw = 0;
  let speed = CRUISE_SPEED;
  /**
   * Height above the surface, in world units. The aeroplane's position is *set* from this every
   * frame rather than drifting into it, so it is the one thing about the flight that cannot be
   * argued with by a bank, a boost or a long turn — see `CLIMB_ANGLE` and `fly/lane.ts`.
   */
  let altitude = CRUISE_ALTITUDE;
  /** What the rings have added on top of the throttle, decaying towards zero. */
  let boost = 0;
  /** See `PLANE_MAX_HEALTH` — currently never reduced. */
  let health = PLANE_MAX_HEALTH;
  /** Set once, the frame health reaches zero. `update()` stops doing anything else the moment
   *  this is true — see the top of that function — until `reset()` clears it. */
  let destroyed = false;

  /** Where the aircraft is on the flat map, 0..1 each way. See `Space.surfaceUv`. */
  const groundTrack = new THREE.Vector2();
  /** Smoothed direction of travel *as the map draws it*, in panel widths per second. */
  let trackX = 0;
  let trackY = 0;
  let hasTrack = false;
  let lastU = 0;
  let lastV = 0;
  let heading = 0;
  /** The minimap panel's own proportions, read in `resize()`. 2:1 unless the CSS says else. */
  let mapAspect = 2;
  /** Where the saucer, and each bomber, is on that same map. */
  const contactUv = new THREE.Vector2();

  function setLine(line: SVGElement, x1: number, y1: number, x2: number, y2: number) {
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.style.display = '';
  }

  /**
   * One countdown per bomber: a mark the colour of its square on the map, and the seconds
   * it has left. Built here for the same reason the map's marks are — how many there are is
   * `BOMBER_COUNT`'s business, not the markup's. The health bar is a separate, floating thing
   * anchored over the ship itself — see `updateBomberHealthBars()` — because a ship you are
   * actually aiming at is not something you want to read off a panel in the corner.
   */
  const timerRows = options.alertPanel
    ? bombers.all.map(() => {
        const el = (tag: string, className: string, parent: HTMLElement) => {
          const node = document.createElement(tag);
          node.className = className;
          parent.appendChild(node);
          return node;
        };
        const row = document.createElement('div');
        row.className = 'fly-alert';
        row.style.display = 'none';
        const head = el('div', 'alert-head', row);
        el('span', 'timer-mark', head);
        const place = el('span', 'timer-place', head);
        const value = el('span', 'timer-value', head);
        // The bar proper: a track that stays put and a fill that runs out of it.
        const fill = el('div', 'alert-fill', el('div', 'alert-track', row) as HTMLElement);
        options.alertPanel!.appendChild(row);
        // `shown` is the last number written: the countdown ticks once a second against a frame
        // rate sixty times that, so this is what keeps it from rewriting the DOM all day.
        return { row, place, value, fill, shown: -1, named: '' };
      })
    : null;

  /**
   * One approach path, its wrapped twin, its landing site and its ship mark, per bomber.
   * Made here rather than written into `index.html`: it is the same four nodes repeated, and
   * how many times is `BOMBER_COUNT`'s business.
   */
  const bomberSlots = options.mapOverlay
    ? bombers.all.map(() => {
        const node = (tag: string, className: string) => {
          const el = document.createElementNS(SVG_NS, tag) as SVGElement;
          el.setAttribute('class', className);
          el.style.display = 'none';
          options.mapOverlay!.appendChild(el);
          return el;
        };
        const path = node('line', 'bomber-path');
        const wrap = node('line', 'bomber-path');
        const site = node('circle', 'bomber-site');
        site.setAttribute('r', '1.3');
        const ship = node('rect', 'bomber-ship');
        ship.setAttribute('width', String(SHIP_MARK));
        ship.setAttribute('height', String(SHIP_MARK));
        return [path, wrap, site, ship] as const;
      })
    : null;

  /**
   * A red cross per capital, hidden until that capital falls — the map's memory of the session.
   *
   * **Placed once and then never touched again**, unlike every other mark on this panel. The
   * minimap is a *static* map and `surfaceUv()` is asked in the planet's local frame, so a fixed
   * latitude and longitude has a fixed place on it: the ships move over the map and the crosses
   * do not, however far the planet has turned since. Two lines rather than a glyph, because the
   * overlay's own coordinate space is 100 x 50 and a font would be stretched by exactly the
   * factor `preserveAspectRatio="none"` is there to allow.
   */
  const capitalCrosses = options.mapOverlay
    ? CAPITALS.map(() => {
        const cross = document.createElementNS(SVG_NS, 'path') as SVGElement;
        cross.setAttribute('class', 'capital-cross');
        cross.style.display = 'none';
        options.mapOverlay!.appendChild(cross);
        return cross;
      })
    : null;

  /** Puts one of those crosses where a capital used to be. `at` is the city on the ground. */
  function markCapitalLost(capital: (typeof CAPITALS)[number], at: THREE.Vector3) {
    const cross = capitalCrosses?.[CAPITALS.indexOf(capital)];
    if (!cross) return;
    space.surfaceUv(at, contactUv);
    const x = contactUv.x * MAP_W;
    const y = (1 - contactUv.y) * MAP_H;
    const r = CROSS_ARM;
    cross.setAttribute('d', `M${x - r} ${y - r}L${x + r} ${y + r}M${x - r} ${y + r}L${x + r} ${y - r}`);
    cross.style.display = '';
  }

  /**
   * One floating health bar per bomber, built the same way as everything else whose
   * count is `fly/bombers.ts`'s business. Positioned in `updateBomberHealthBars()`.
   */
  const bomberHealthBars = options.bomberHealthLayer
    ? bombers.all.map(() => {
        const el = document.createElement('div');
        el.className = 'bomber-health';
        el.style.display = 'none';
        const fill = document.createElement('div');
        fill.className = 'bomber-health-fill';
        el.appendChild(fill);
        options.bomberHealthLayer!.appendChild(el);
        return { el, fill, shown: -1 };
      })
    : null;

  /**
   * …and one per bomber for the *city* it is bombing, in the same layer and the same shape, red
   * rather than green. One per ship rather than one per capital because at most three cities can
   * be under attack at once, and a bar over a place nobody is bombing says nothing.
   *
   * It is the same fact as the alert row's own bar, said where the thing is: the row tells you a
   * city somewhere is being destroyed, and this tells you *that* is the city, once you get there.
   */
  const capitalHealthBars = options.bomberHealthLayer
    ? bombers.all.map(() => {
        const el = document.createElement('div');
        el.className = 'capital-health';
        el.style.display = 'none';
        const fill = document.createElement('div');
        fill.className = 'capital-health-fill';
        el.appendChild(fill);
        options.bomberHealthLayer!.appendChild(el);
        return { el, fill, shown: -1 };
      })
    : null;

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const radialUp = new THREE.Vector3();
  const chase = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const planeUp = new THREE.Vector3();
  const levelAxis = new THREE.Vector3();
  const spin = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const muzzle = new THREE.Vector3();
  const bomberAnchor = new THREE.Vector3();
  const planeAnchor = new THREE.Vector3();
  const aim = new THREE.Vector3();
  /**
   * Where the gun is pointed this frame, in world space: the locked target if there is one, and
   * the point `RETICLE_RANGE` ahead in the lane if there is not. One vector, written in
   * `update()` and read by both the trigger and `updateReticle()` — the reticle has to be over
   * the place the shots are going or it is decoration.
   */
  const aimAt = new THREE.Vector3();
  /** …and what it is, when it is one. The reticle only needs to know *whether* (`locked`); a
   *  rocket needs the target itself, because it chases the live vector inside it. */
  let lockTarget: BoltTarget | null = null;
  let locked = false;
  /** …and whether that lock is the *station* rather than something to shoot — see `takeAim()`.
   *  The reticle draws it differently, because "fly here" and "shoot this" must not look alike. */
  let waypoint = false;
  /** How many capitals have been bombed to nothing this flight. The crosses on the map are the
   *  same fact; this is it as a number, next to the kills it is the other half of. */
  let capitalsLost = 0;
  let shownLost = -1;
  /** Rounds and rockets left. Refilled by a pass through the command post, and by `reset()`. */
  let laserAmmo = LASER_AMMO;
  let rocketAmmo = ROCKET_AMMO;
  /** The last of each written to the HUD. -1 so the opening numbers are written once. */
  let shownAmmo = -1;
  let shownRockets = -1;
  /**
   * A rocket asked for and not yet launched. **Set from the keydown event, not from the held
   * keys** — a rocket is one press, one rocket, so the trigger is an edge and the held-key set
   * cannot express one: holding R would empty the rack in six frames, and a tap that begins and
   * ends between two frames would be dropped entirely. Consumed by the next `update()`, which is
   * where the aim it is fired along lives. Same reasoning as `Space` restarting a destroyed
   * aircraft from its own event.
   */
  let rocketWanted = false;
  const aimDir = new THREE.Vector3();
  const flatNose = new THREE.Vector3();
  const flatTo = new THREE.Vector3();
  /** Where the aeroplane was at the top of this frame. The rings' pass test needs the segment
   *  it flew, not the point it ended at — see `fly/rings.ts`. */
  const wasAt = new THREE.Vector3();
  /** Seconds of screen time the current message has left. Counted down in `update()`, so it
   *  stops with the view rather than running on behind a parked scene. */
  let messageLeft = 0;

  /**
   * Puts a line on screen from the command post. Public in spirit — the next thing to say here
   * is what happens when a ship gets through, which is a message and not a mechanic yet.
   */
  function say(text: string, seconds = MESSAGE_SECONDS) {
    if (!options.messagePanel || !options.messageText) return;
    options.messageText.textContent = text;
    options.messagePanel.classList.add('show');
    messageLeft = seconds;
  }

  function reset() {
    plane.position.copy(START_DIRECTION).multiplyScalar(START_RADIUS);
    // Level flight: nose along a tangent, wings square to the local horizontal. `Matrix4.lookAt`
    // puts +Z *away* from its target, so aiming it at the heading leaves -Z — the nose — on it.
    radialUp.copy(plane.position).normalize();
    forward.crossVectors(radialUp, new THREE.Vector3(0, 1, 0)).normalize();
    basis.lookAt(ORIGIN, forward, radialUp);
    plane.quaternion.setFromRotationMatrix(basis);

    pitch = roll = yaw = 0;
    speed = CRUISE_SPEED;
    altitude = CRUISE_ALTITUDE;
    locked = false;
    lockTarget = null;
    waypoint = false;
    rocketWanted = false;
    // A fresh aeroplane is a full one. Nothing carries across a restart here — see LASER_AMMO.
    laserAmmo = LASER_AMMO;
    rocketAmmo = ROCKET_AMMO;
    boost = 0;
    health = PLANE_MAX_HEALTH;
    // Undoes the destruction, if there was one — `update()` reads this flag first thing, so
    // this is what actually starts the flight running again as well as bringing the aircraft
    // back into view.
    destroyed = false;
    plane.visible = true;
    planeBurst.group.visible = false;
    options.messagePanel?.classList.remove('show');
    if (options.spaceLabel) options.spaceLabel.textContent = 'laser';
    trail.clear();
    // The marker's heading is a difference between frames, so it has no meaning across a jump.
    hasTrack = false;
    bolts.clear();
    rockets.clear();
    enemyBolts.clear();
    ufo.spawn(plane.position);
    // Every capital back on its feet — `bombers.reset()` is what actually restores their health;
    // these two are the record of it that lives on this side.
    bombers.reset();
    capitalsLost = 0;
    if (capitalCrosses) for (const cross of capitalCrosses) cross.style.display = 'none';
    packs.clear();
    rings.reset(plane.position);
    placeCamera(1);
  }

  /** Moves the chase camera towards where it belongs. `t` of 1 snaps it there. */
  function placeCamera(t: number) {
    radialUp.copy(plane.position).normalize();
    planeUp.set(0, 1, 0).applyQuaternion(plane.quaternion);
    // See `earthshine`: its axis is its position, and "up" is wherever the planet is not.
    earthshine.position.copy(radialUp);

    chase.copy(CHASE_OFFSET).applyQuaternion(plane.quaternion).add(plane.position);
    // The camera has the same floor the aircraft does, and for the same reason — a chase
    // camera slung below a banked turn is exactly where it would otherwise get inside the shell.
    const radius = chase.length();
    if (radius < ATMOSPHERE_RADIUS * 1.02) chase.multiplyScalar((ATMOSPHERE_RADIUS * 1.02) / radius);

    camera.position.lerp(chase, t);
    lookTarget
      .copy(NOSE)
      .applyQuaternion(plane.quaternion)
      .multiplyScalar(CHASE_LOOK_AHEAD)
      .addScaledVector(planeUp, -CHASE_LOOK_DROP)
      .add(plane.position);
    // Part of the aircraft's roll, part of the local vertical — see `CHASE_ROLL_SHARE`.
    camera.up.copy(radialUp).lerp(planeUp, CHASE_ROLL_SHARE).normalize();
    camera.lookAt(lookTarget);
  }

  function update(dt: number) {
    // Everything below this stops the instant the aircraft is destroyed. The explosion still
    // has to run its own course, so it is ticked here rather than in the dead code beneath it —
    // and that is the only thing that keeps moving until `reset()` (Space) starts the flight
    // over. Bombers, the saucer, the rings and the incoming bolts all hold exactly where they
    // were, which is the point: this is a stopping point, not a pause with everything still
    // happening around a plane that is no longer there.
    if (destroyed) {
      planeBurst.update(dt);
      return;
    }

    // Arrows are the stick (commanded altitude, and commanded bank), A/D the rudder, W/S the
    // throttle. Arrow Up climbs — this is an arcade chase view, not a sim with a yoke to push
    // forward — and Arrow Down only ever hurries the way back down to the lane.
    const target = {
      pitch: axis(['ArrowUp'], ['ArrowDown']),
      roll: axis(['ArrowLeft'], ['ArrowRight']),
      yaw: axis(['KeyA'], ['KeyD'])
    };
    const blend = 1 - Math.exp(-dt / CONTROL_LAG);
    pitch += (target.pitch - pitch) * blend;
    roll += (target.roll - roll) * blend;
    yaw += (target.yaw - yaw) * blend;

    // The throttle is a *setting the aeroplane comes back from*, the same shape as the lane
    // above: `CRUISE_SPEED` is where it flies, S slows it towards `MIN_SPEED` for as long as it
    // is held, W pushes it to `MAX_SPEED`, and letting go of either walks it back to cruise.
    const throttle = axis(['KeyW'], ['KeyS']);
    const wantedSpeed =
      CRUISE_SPEED +
      throttle * (throttle >= 0 ? MAX_SPEED - CRUISE_SPEED : CRUISE_SPEED - MIN_SPEED);
    const throttleStep = (wantedSpeed > speed ? THROTTLE_UP : THROTTLE_DOWN) * dt;
    speed =
      wantedSpeed > speed
        ? Math.min(wantedSpeed, speed + throttleStep)
        : Math.max(wantedSpeed, speed - throttleStep);
    // Exponential, so it is frame-rate independent and never quite reaches zero — the trail's
    // own threshold is what decides when a boost is over.
    boost *= Math.exp(-dt / BOOST_DECAY);
    const velocity = speed + boost;

    // The band. The stick's *up* half asks for an altitude between the lane and the ceiling and
    // holds it for as long as it is held; releasing asks for the lane back, and the down half
    // only chooses how quickly that is answered. The stick is the smoothed deflection, so a tap
    // is a small climb and a release is a glide rather than a switch being thrown.
    const wanted =
      CRUISE_ALTITUDE + Math.max(pitch, 0) * (CEILING_ALTITUDE - CRUISE_ALTITUDE);
    const climbing = wanted > altitude;
    const angle = climbing ? CLIMB_ANGLE : pitch < 0 ? DIVE_ANGLE : SINK_ANGLE;
    const step = velocity * Math.sin(angle) * dt;
    const wasAbove = altitude;
    altitude = climbing
      ? Math.min(wanted, altitude + step)
      : Math.max(wanted, altitude - step);
    // What the nose is therefore doing, as the sine of its angle above the horizon. Taken from
    // the change that actually happened rather than from `angle`, so the frame that arrives at
    // the ceiling with three units left in it levels off over that frame instead of holding a
    // climbing attitude into a height it is not going to gain.
    const climbWanted = dt > 0 ? THREE.MathUtils.clamp((altitude - wasAbove) / dt / velocity, -1, 1) : 0;

    plane.rotateY(yaw * YAW_RATE * dt);

    radialUp.copy(plane.position).normalize();
    right.set(1, 0, 0).applyQuaternion(plane.quaternion);
    planeUp.set(0, 1, 0).applyQuaternion(plane.quaternion);

    // Bank towards what the stick asks for — positive is right-wing-up, i.e. banked left,
    // which is also the sign `ArrowLeft` gives. Releasing asks for zero, so it rolls level.
    const bank = Math.atan2(right.dot(radialUp), planeUp.dot(radialUp));
    plane.rotateZ(
      THREE.MathUtils.clamp((roll * MAX_BANK - bank) * BANK_GAIN, -ROLL_RATE, ROLL_RATE) * dt
    );

    // The turn that bank buys, taken about the **local vertical** rather than about the
    // aircraft's own up axis. `plane.rotateY` is the obvious spelling and is a trap: once
    // banked, the aircraft's up is tilted, so yawing about it drives the nose downwards at
    // sin²(bank) x the turn rate — 0.5 rad/s at full bank, which is more than the level-hold
    // has authority to answer, and a held turn spirals into `MIN_RADIUS` and stays there.
    // A rotation about the local vertical is a pure heading change and costs no height at all.
    right.set(1, 0, 0).applyQuaternion(plane.quaternion);
    plane.quaternion.premultiply(
      spin.setFromAxisAngle(radialUp, right.dot(radialUp) * BANK_TURN_RATE * dt)
    );

    // Level-hold: put the nose on the flight path — the local horizon in the lane, tilted by
    // exactly the climb or glide happening this frame — about the world-horizontal axis rather
    // than the aircraft's own. See `LEVEL_GAIN`; both halves of it matter.
    forward.copy(NOSE).applyQuaternion(plane.quaternion);
    const climb = forward.dot(radialUp);
    levelAxis.crossVectors(forward, radialUp);
    if (levelAxis.lengthSq() > 1e-6) {
      levelAxis.normalize();
      const correction =
        -(velocity / plane.position.length() + (climb - climbWanted) * LEVEL_GAIN) * dt;
      plane.quaternion.premultiply(spin.setFromAxisAngle(levelAxis, correction));
      forward.copy(NOSE).applyQuaternion(plane.quaternion);
    }

    // Kept before the move: the rings are tested against the segment flown, below.
    wasAt.copy(plane.position);
    plane.position.addScaledVector(forward, velocity * dt);

    // The aeroplane flies on a shell, and the shell is what moves: the height is *set* from the
    // commanded altitude rather than clamped between a floor and a ceiling it can wander to.
    // What the move above therefore contributes is the ground track, and only that, which is
    // also what makes a hard bank cost nothing — a held turn used to spiral into the floor and
    // stay there. The nose is already pointed along the climb this projects out, so nothing
    // about it reads as being held: see `LEVEL_GAIN`.
    plane.position.setLength(PLANET_RADIUS + altitude);

    // The rings. They neither block nor deflect — flying through one only adds speed, and the
    // test is swept over the segment above, so a boosted pass cannot skip through the hoop
    // between two frames. Two in one frame is possible and simply stacks.
    // `forward` is the nose after the level-hold has had its say, which is both the direction
    // the aeroplane is actually travelling and half of what each hoop turns to face.
    const ringsPassed = rings.update(dt, wasAt, plane.position, forward);
    boost = Math.min(boost + ringsPassed * BOOST_GAIN, BOOST_MAX);
    // A ring repairs as well as boosts, `RING_HEAL_AMOUNT` a hoop — the same "no consequence for
    // reaching zero except this one" clamp as everywhere else health is touched.
    if (ringsPassed > 0) health = Math.min(PLANE_MAX_HEALTH, health + ringsPassed * RING_HEAL_AMOUNT);

    // …and the packs, over the same segment. This is `PACK_HEAL_AMOUNT`'s job — the landing
    // ships' own return fire is what makes recovering one worth anything now.
    const recovered = packs.update(dt, wasAt, plane.position);
    if (recovered > 0) {
      health = Math.min(PLANE_MAX_HEALTH, health + recovered * PACK_HEAL_AMOUNT);
      say('Repair pack recovered.', 2.5);
    }

    if (messageLeft > 0) {
      messageLeft -= dt;
      // Dropping the class hands it back to the transition, which is the fade.
      if (messageLeft <= 0) options.messagePanel?.classList.remove('show');
    }

    // What the laser can hit right now. Collected before the trigger rather than after it,
    // because the gun picks which of them it is pointed at — and still before anything moves,
    // so a bolt is checked against the target it was aimed at this frame rather than against
    // where it has got to since.
    boltTargets.length = 0;
    if (ufo.alive) boltTargets.push(ufoTarget);
    bombers.collect(boltTargets);
    takeAim();

    // The trigger. It fires at `aimAt` — the locked target, or the lane ahead if nothing is in
    // the cone — which is the same point the reticle is drawn over, so what you see is where
    // the shot goes. The cadence lives in `bolts`, so holding the key down is all this has to
    // know, and the wingtips alternate, so both barrels converge on the one point.
    if (keys.has('Space')) {
      if (laserAmmo > 0) {
        muzzle
          .set(MUZZLE.x * muzzleSide, MUZZLE.y, MUZZLE.z)
          .applyQuaternion(plane.quaternion)
          .add(plane.position);
        aimDir.subVectors(aimAt, muzzle);
        if (aimDir.lengthSq() > 1e-6) {
          aimDir.normalize();
          // The round is spent on the shot leaving, not on the trigger being held: `fire()`
          // answers false while the gun is between shots, and a magazine that emptied at the
          // frame rate would be gone in two seconds.
          if (bolts.fire(muzzle, aimDir)) {
            laserAmmo--;
            muzzleSide = -muzzleSide;
          }
        }
      } else if (messageLeft <= 0) {
        say(DRY_MESSAGE);
      }
    }

    // The rockets, on R. One press is one rocket — see `rocketWanted` — and it is fired at the
    // *target*, not at a point: `fly/rockets.ts` chases the live vector inside it. Fired from
    // the nose rather than the wingtips, because it is one thing and not a stream.
    if (rocketWanted) {
      rocketWanted = false;
      if (rocketAmmo > 0) {
        muzzle.set(0, MUZZLE.y, MUZZLE.z - 2).applyQuaternion(plane.quaternion).add(plane.position);
        aimDir.subVectors(aimAt, muzzle);
        if (aimDir.lengthSq() > 1e-6) {
          aimDir.normalize();
          if (rockets.fire(muzzle, aimDir, lockTarget)) rocketAmmo--;
        }
      } else if (messageLeft <= 0) {
        say(DRY_MESSAGE);
      }
    }

    bolts.update(dt, boltTargets);
    rockets.update(dt, boltTargets);

    // Rearming: a pass through the package hanging under the command post fills both guns **and
    // patches the aircraft up**. Measured to the package rather than to the middle of the
    // station, because the package is the thing you can see and aim at — see `REARM_RANGE`.
    // Tested as a plain distance rather than swept like a ring's: the package is a wide target
    // and the aeroplane cannot cross it between two frames even boosted. Silent when there is
    // nothing to give, so orbiting it does not chatter.
    if (
      (laserAmmo < LASER_AMMO || rocketAmmo < ROCKET_AMMO || health < PLANE_MAX_HEALTH) &&
      plane.position.distanceTo(post.packagePosition) < REARM_RANGE
    ) {
      laserAmmo = LASER_AMMO;
      rocketAmmo = ROCKET_AMMO;
      // Full, not a top-up. A pack is 60 and a ring a quarter of the tank because both are things
      // you pick up *in* the fight; this is the one thing you have to leave the fight for, and it
      // has to be worth the trip.
      health = PLANE_MAX_HEALTH;
      say(REARM_MESSAGE);
    }
    ufo.update(dt, plane.position);
    bombers.update(dt, plane.position);
    // …and the other way to lose, checked the frame after the bombs that caused it. The
    // aeroplane is **not** exploded here — nothing shot it, and the world it was defending is
    // simply gone. Everything else about the state is the same one being shot down leaves:
    // `update()` returns at the top from now on, and Space is the way out.
    if (!destroyed && bombers.survivingCount === 0) {
      destroyed = true;
      say(EARTH_LOST_MESSAGE);
      if (options.spaceLabel) options.spaceLabel.textContent = 'restart';
    }
    // The bombers' own fire, tested against the aircraft the same way theirs is tested
    // against them — `enemyBoltTargets` never changes shape, so nothing here allocates.
    enemyBolts.update(dt, enemyBoltTargets);
    // Neither shootable nor interactive: it just goes round, whatever else is happening.
    post.update(dt);

    placeCamera(1 - Math.exp(-dt * CHASE_FOLLOW));
    // After the camera, which is what the ribbons are turned to face — asked before it, they
    // would be spanned against where the camera was last frame and go thin in a hard turn.
    trail.update(plane, camera.position, boost / BOOST_GAIN);

    if (options.speedLabel) {
      options.speedLabel.textContent = `${Math.round(speed + boost)}`;
      // The readout goes warm while there is a boost on it, so the number and the wake behind
      // the wings are saying the same thing.
      options.speedLabel.classList.toggle('boosting', boost > BOOST_GAIN * 0.1);
    }
    if (options.downedLabel && bombers.downed !== shownDowned) {
      shownDowned = bombers.downed;
      options.downedLabel.textContent = `${shownDowned}`;
    }
    // Both written only on a change, like the kill count: the laser's ticks down six times a
    // second at most, and the rockets' four times a sortie. The bar and the pips on the aeroplane
    // itself are written from the same test, so the readout you are looking at and the one in the
    // corner can never disagree — see `buildPlane()`.
    if (laserAmmo !== shownAmmo) {
      shownAmmo = laserAmmo;
      if (options.ammoLabel) {
        options.ammoLabel.textContent = `${laserAmmo}`;
        options.ammoLabel.classList.toggle('empty', laserAmmo === 0);
      }
      const left = laserAmmo / LASER_AMMO;
      // Never quite zero: a bar of no length is an aeroplane with no bar on it, which reads as
      // "there is no gauge" rather than as "there is nothing in it". The colour is what says
      // empty; the sliver is what says the gauge is still there saying it.
      ammoFill.scale.x = Math.max(left, 0.04);
      (ammoFill.material as THREE.MeshBasicMaterial).color.lerpColors(AMMO_EMPTY, AMMO_FULL, left);
    }
    if (rocketAmmo !== shownRockets) {
      shownRockets = rocketAmmo;
      if (options.rocketLabel) {
        options.rocketLabel.textContent = `${rocketAmmo}`;
        options.rocketLabel.classList.toggle('empty', rocketAmmo === 0);
      }
      rocketPips.forEach((pip, i) => {
        pip.visible = i < rocketAmmo;
      });
    }
    // The one number in this pill that only ever goes the wrong way, so it is red from the first
    // one — unlike the ammunition counts, which are only red at zero.
    if (options.lostLabel && capitalsLost !== shownLost) {
      shownLost = capitalsLost;
      options.lostLabel.textContent = `${capitalsLost}`;
      options.lostLabel.classList.toggle('lost', capitalsLost > 0);
    }
    if (options.altitudeLabel) {
      options.altitudeLabel.textContent = `${Math.round(plane.position.length() - PLANET_RADIUS)}`;
    }
  }

  /**
   * Puts the aeroplane on the minimap. The panel is a *static* equirectangular Earth, so the
   * marker's position on it simply is the ground track: `surfaceUv` answers where the aircraft
   * is on the same map the planet is wearing, and the marker goes there as a percentage of the
   * panel — no pixels, so it stays right while the panel is sized in `vw`.
   *
   * The heading is finite-differenced **in map space** rather than taken from the aircraft's
   * own nose, because the marker sits on a projection: due north over Greenland is drawn as a
   * run along the top of the map, and a marker pointing up there would disagree with the track
   * it is leaving. The planet's axial spin falls out of the difference for free, `surfaceUv`
   * working in the planet's local frame — fly slowly enough due east and the track really does
   * creep backwards, which is the correct answer and not one the nose could have given.
   */
  function updateMinimap(dt: number) {
    const marker = options.planeMarker;
    if (!marker || dt <= 0) return;

    space.surfaceUv(plane.position, groundTrack);
    const u = groundTrack.x;
    const v = groundTrack.y;

    if (hasTrack) {
      // Wrapped, or the one frame that crosses the antimeridian reads as a sprint the whole
      // way back across the map and snaps the marker round on the spot.
      let du = u - lastU;
      if (du > 0.5) du -= 1;
      else if (du < -0.5) du += 1;
      // Into panel space: `u` spans a panel `mapAspect` times as wide as `v` spans it tall, and
      // screen y grows downwards where `v` grows towards the north pole.
      const dx = (du * mapAspect) / dt;
      const dy = (lastV - v) / dt;
      const blend = 1 - Math.exp(-dt / TRACK_LAG);
      trackX += (dx - trackX) * blend;
      trackY += (dy - trackY) * blend;
      // A dart drawn pointing up lies along (dx, dy) once turned clockwise by atan2(dx, -dy).
      if (trackX * trackX + trackY * trackY > 1e-9) heading = Math.atan2(trackX, -trackY);
    } else {
      hasTrack = true;
    }
    lastU = u;
    lastV = v;

    marker.style.left = `${u * 100}%`;
    marker.style.top = `${(1 - v) * 100}%`;
    marker.style.transform = `translate(-50%, -50%) rotate(${heading}rad)`;

    // The command post's own ground track, by the same means. It is never hidden: unlike the
    // saucer, there is always one, which is rather the point of it.
    if (options.postMarker) {
      space.surfaceUv(post.position, contactUv);
      options.postMarker.style.left = `${contactUv.x * 100}%`;
      options.postMarker.style.top = `${(1 - contactUv.y) * 100}%`;
    }

    // The saucer on the same map, by the same means. It carries no heading — a contact is a
    // place, and eight units per second would make a dart's direction a lie at this scale.
    const contact = options.ufoMarker;
    if (!contact) return;
    if (!ufo.alive) {
      contact.style.display = 'none';
      return;
    }
    space.surfaceUv(ufo.position, contactUv);
    contact.style.display = '';
    contact.style.left = `${contactUv.x * 100}%`;
    contact.style.top = `${(1 - contactUv.y) * 100}%`;
  }

  /**
   * The bombers on the same map: each one's approach drawn as a line from where it came
   * in to where it is going to touch down, with a ring on the landing site and a square for the
   * ship itself somewhere along it. The line is the point of the whole thing — a mark on its own
   * says where something is, a line says where it is *going*, which is what you need to decide
   * whether to go after it.
   *
   * Redrawn every frame rather than once at spawn, because the planet turns underneath: both
   * ends are fixed in space, so on the map they creep west together with the ground they are
   * over.
   *
   * **The boost rings are deliberately not on here.** They were, briefly, one mark per site.
   * The map is for finding the things that are *happening* — where a ship is coming down and how
   * long it has — and a fixed constellation of hoops turned it into a scatter of warm rings with
   * the green marks that matter somewhere among them. The rings are big, lit, and now at exactly
   * the height you are flying at; you find them by looking out of the window.
   */
  function updateMapMarks() {
    let anyInbound = false;
    bombers.all.forEach((bomber, i) => {
      const timer = timerRows?.[i];
      if (timer) {
        if (bomber.active) {
          // Rounded up, so it never reads 0 while the city is still standing. The number comes
          // from the ship now (`secondsLeft`) rather than from a constant here: a run's length is
          // its own distance, and under the bombs it is what the bombs have left to do.
          const left = Math.max(0, Math.ceil(bomber.secondsLeft));
          if (left !== timer.shown) {
            timer.value.textContent = `${left}s`;
            timer.shown = left;
          }
          if (bomber.name !== timer.named) {
            timer.place.textContent = bomber.name;
            timer.named = bomber.name;
          }
          // **The bar says two different things, and the class says which.** In transit it is
          // the approach draining — how much of the flight is left. The moment the bombing
          // starts it becomes the city's own health, in red: the same question ("how long has
          // this place got") answered by the thing that is actually deciding it.
          const bombing = bomber.phase === 'bombing';
          timer.fill.style.width = bombing
            ? `${(bomber.targetHealth / CAPITAL_MAX_HEALTH) * 100}%`
            : `${(1 - bomber.progress) * 100}%`;
          timer.row.classList.toggle('bombing', bombing);
          timer.row.classList.toggle('urgent', !bombing && left <= URGENT_SECONDS);
          timer.row.style.display = '';
          anyInbound = true;
        } else {
          timer.row.style.display = 'none';
          timer.shown = -1;
        }
      }

      const slot = bomberSlots?.[i];
      if (!slot) return;
      if (!bomber.active) {
        for (const node of slot) node.style.display = 'none';
        return;
      }
      space.surfaceUv(bomber.entry, contactUv);
      const x1 = contactUv.x * MAP_W;
      const y1 = (1 - contactUv.y) * MAP_H;
      space.surfaceUv(bomber.site, contactUv);
      const x2 = contactUv.x * MAP_W;
      const y2 = (1 - contactUv.y) * MAP_H;
      space.surfaceUv(bomber.position, contactUv);
      const shipX = contactUv.x * MAP_W;
      const shipY = (1 - contactUv.y) * MAP_H;

      const [path, wrap, site, ship] = slot;
      // A path whose ends are more than half a map apart is the short way round the *back* of
      // the world, and drawn as one line it streaks all the way across instead. Drawn twice, a
      // map width apart, the panel's own clipping leaves exactly the two halves you should see.
      const shift = Math.abs(x2 - x1) > MAP_W / 2 ? (x2 > x1 ? -MAP_W : MAP_W) : 0;
      setLine(path, x1, y1, x2 + shift, y2);
      if (shift) setLine(wrap, x1 - shift, y1, x2, y2);
      else wrap.style.display = 'none';

      site.setAttribute('cx', String(x2));
      site.setAttribute('cy', String(y2));
      ship.setAttribute('x', String(shipX - SHIP_MARK / 2));
      ship.setAttribute('y', String(shipY - SHIP_MARK / 2));
      site.style.display = '';
      ship.style.display = '';
    });
    // The banner is only there when something is on its way down; an empty header is furniture.
    if (options.alertPanel) options.alertPanel.hidden = !anyInbound;
  }

  /**
   * Puts the reticle where the nose is pointing.
   *
   * **Called after the render, and that is load-bearing.** `Vector3.project` reads
   * `camera.matrixWorldInverse` without updating it, and `placeCamera()` has just moved the
   * camera — asked before the render it would mark where the nose pointed last frame, which at
   * two radians a second of roll is visibly wrong. Rendering has just refreshed the matrices.
   */
  /**
   * Decides what the laser is pointed at, and writes the one point everything downstream uses:
   * `aimAt` for the trigger and the reticle, `locked` for what the reticle looks like.
   *
   * The pick is a bearing test and nothing else (see `LOCK_CONE`): the target nearest the nose
   * *in the horizontal*, inside `LOCK_RANGE`. Elevation is left out on purpose — on a world this
   * small the angle down to something at your own height is a function of how far away it is,
   * and asking the player to fly that correction by eye is what made the bombers
   * unhittable in the first place. With nothing in the cone the gun points at the lane ahead,
   * which is at least where the shot would go, rather than up the tangent the nose is on.
   */
  function takeAim() {
    radialUp.copy(plane.position).normalize();
    // **Out of everything: the gun stops looking for ships and points at the station.** With both
    // magazines empty there is nothing to lock a target for, and exactly one thing worth knowing
    // — where the resupply package is. So the reticle becomes a waypoint on it, at any range and
    // any bearing (a lock you can only get by already facing the right way is no help at all),
    // and `lockTarget` stays null because nothing here is something to shoot.
    if (laserAmmo === 0 && rocketAmmo === 0) {
      lockTarget = null;
      locked = true;
      waypoint = true;
      aimAt.copy(post.packagePosition);
      return;
    }
    waypoint = false;
    flatNose.copy(forward).addScaledVector(radialUp, -forward.dot(radialUp));
    let best: BoltTarget | null = null;
    if (flatNose.lengthSq() > 1e-6) {
      flatNose.normalize();
      // Starts at the edge of the cone, so anything that beats it is inside the cone as well as
      // being the best so far.
      let bestBearing = Math.cos(LOCK_CONE);
      for (const target of boltTargets) {
        flatTo.subVectors(target.position, plane.position);
        if (flatTo.lengthSq() > LOCK_RANGE * LOCK_RANGE) continue;
        flatTo.addScaledVector(radialUp, -flatTo.dot(radialUp));
        if (flatTo.lengthSq() < 1e-6) continue;
        const bearing = flatTo.normalize().dot(flatNose);
        if (bearing > bestBearing) {
          bestBearing = bearing;
          best = target;
        }
      }
    }
    lockTarget = best;
    locked = best !== null;
    if (best) {
      aimAt.copy(best.position);
      return;
    }
    aimAt
      .copy(plane.position)
      .addScaledVector(forward, RETICLE_RANGE)
      .setLength(plane.position.length() + RETICLE_RANGE * forward.dot(radialUp));
  }

  function updateReticle() {
    const el = options.reticle;
    if (!el) return;
    // Nothing to aim once the gun is gone with the rest of the aircraft.
    if (destroyed) {
      el.style.display = 'none';
      return;
    }
    // Over whatever `takeAim()` settled on this frame, which is the point the shots are going
    // to — a reticle drawn anywhere else is decoration.
    el.classList.toggle('locked', locked);
    el.classList.toggle('waypoint', waypoint);
    aim.copy(aimAt).project(camera);
    // z > 1 is behind the camera, where the projection folds over and the reticle would appear
    // on the opposite side of the screen from the thing it is aiming at.
    if (aim.z > 1) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.left = `${(aim.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-aim.y * 0.5 + 0.5) * 100}%`;
  }

  /**
   * Puts a floating health bar over every live bomber. Same load-bearing ordering as
   * `updateReticle()` — called after the render, because `Vector3.project` reads
   * `camera.matrixWorldInverse` without refreshing it and the camera has just moved.
   */
  function updateBomberHealthBars() {
    if (!bomberHealthBars) return;
    bombers.all.forEach((bomber, i) => {
      const bar = bomberHealthBars[i];
      if (!bomber.active) {
        bar.el.style.display = 'none';
        bar.shown = -1;
        return;
      }
      bomberAnchor
        .copy(bomber.position)
        .normalize()
        .multiplyScalar(BOMBER_BAR_OFFSET)
        .add(bomber.position)
        .project(camera);
      // Behind the camera, same fold-over as the reticle's own z > 1 check.
      if (bomberAnchor.z > 1) {
        bar.el.style.display = 'none';
        return;
      }
      bar.el.style.display = '';
      bar.el.style.left = `${(bomberAnchor.x * 0.5 + 0.5) * 100}%`;
      bar.el.style.top = `${(-bomberAnchor.y * 0.5 + 0.5) * 100}%`;
      if (bomber.health !== bar.shown) {
        bar.fill.style.width = `${(bomber.health / BOMBER_MAX_HEALTH) * 100}%`;
        bar.shown = bomber.health;
      }
    });
  }

  /**
   * The same, over the city each bombing ship is destroying. Anchored over the place on the
   * ground rather than over the ship — they are `ORBIT_OFFSET` apart, and the point is to mark
   * the *city* — and offset along that point's own up rather than the aircraft's, or it would
   * lean over with every bank. Runs after the render for the same reason all of these do.
   */
  function updateCapitalHealthBars() {
    if (!capitalHealthBars) return;
    bombers.all.forEach((bomber, i) => {
      const bar = capitalHealthBars[i];
      if (!bomber.active || bomber.phase !== 'bombing') {
        bar.el.style.display = 'none';
        bar.shown = -1;
        return;
      }
      bomberAnchor
        .copy(bomber.targetSurface)
        .normalize()
        .multiplyScalar(CAPITAL_BAR_OFFSET)
        .add(bomber.targetSurface)
        .project(camera);
      if (bomberAnchor.z > 1) {
        bar.el.style.display = 'none';
        return;
      }
      bar.el.style.display = '';
      bar.el.style.left = `${(bomberAnchor.x * 0.5 + 0.5) * 100}%`;
      bar.el.style.top = `${(-bomberAnchor.y * 0.5 + 0.5) * 100}%`;
      if (bomber.targetHealth !== bar.shown) {
        bar.fill.style.width = `${(bomber.targetHealth / CAPITAL_MAX_HEALTH) * 100}%`;
        bar.shown = bomber.targetHealth;
      }
    });
  }

  /**
   * Puts the player's own health bar over the aeroplane. Same load-bearing after-the-render
   * ordering as the reticle and the bombers' bars: `project()` reads
   * `camera.matrixWorldInverse` without refreshing it, and the camera has just moved.
   */
  function updatePlaneHealthBar() {
    const el = options.planeHealthBar;
    const fill = options.planeHealthFill;
    if (!el || !fill) return;
    // A bar of nothing floating over an aircraft that is no longer there is worse than no bar.
    if (destroyed) {
      el.style.display = 'none';
      return;
    }
    planeAnchor
      .copy(planeUp)
      .multiplyScalar(PLANE_BAR_OFFSET)
      .add(plane.position)
      .project(camera);
    if (planeAnchor.z > 1) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.left = `${(planeAnchor.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-planeAnchor.y * 0.5 + 0.5) * 100}%`;
    fill.style.width = `${(health / PLANE_MAX_HEALTH) * 100}%`;
  }

  /**
   * Whether the key that just arrived belongs to something being typed in rather than to the
   * aeroplane. Nothing on this screen has a caret today — `#fly-notes` is a static list — but
   * **every key in this view is a control**, with no modifier and no focus rules: the first text
   * field ever put over the HUD would otherwise fly the aeroplane as it was typed in. Asked of
   * the event's own target and by tag, so that field is covered before it exists.
   */
  function isTyping(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!running || isTyping(event)) return;
    // Space restarts once the aircraft is gone, rather than firing a gun that no longer exists.
    // Read from the keydown event itself, not `keys.has('Space')` in the render loop — the key
    // is very likely still held from the shot that caused this, and a level-triggered check
    // would restart the instant the explosion began, before there was any chance to read the
    // message on screen.
    if (destroyed && event.code === 'Space') {
      reset();
      return;
    }
    // The rocket asks from here rather than from the held keys — see `rocketWanted`. `repeat`
    // is the operating system's key repeat, which would otherwise be a second trigger pull.
    if (event.code === 'KeyR' && !event.repeat) rocketWanted = true;
    keys.add(event.code);
    // The arrows would otherwise scroll whatever is behind the canvas on a short viewport, and
    // the space bar scrolls it a page at a time.
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  }

  // Not gated on `isTyping`, deliberately: a key released over a text field may well have been
  // *pressed* over the scene, and a held control nothing ever clears is stuck for good. Deleting
  // one that was never added costs nothing.
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
  // A tab-out with the throttle open would otherwise leave the key held forever.
  const onBlur = () => keys.clear();

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    composer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();

    // The marker's heading needs the minimap panel's proportions (see `updateMinimap`). Read
    // here rather than per frame: touching `clientWidth` forces layout, and this is the one
    // place that already knows the window changed. Zero while the panel is hidden — a narrow
    // viewport drops it — in which case the last good value stands and nothing can see it.
    const panel = options.planeMarker?.parentElement;
    if (panel && panel.clientHeight > 0) mapAspect = panel.clientWidth / panel.clientHeight;
  }

  const clock = new THREE.Clock(false);
  let rafId = 0;
  let running = false;

  function tick() {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.1);
    update(dt);
    space.update(clock.elapsedTime, dt);
    // After `space.update()`, which is where this frame's spin lands on the planet. The marker
    // is a question about the surface, so it has to be asked of the surface as it is about to
    // be drawn rather than as it was last frame.
    updateMinimap(dt);
    updateMapMarks();
    composer.render();
    updateReticle();
    updateBomberHealthBars();
    updateCapitalHealthBars();
    updatePlaneHealthBar();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  reset();

  function start() {
    if (running) return;
    running = true;
    resize(); // the canvas had no size while the view was hidden
    // `stop()` takes any message down with it, including `DEFEAT_MESSAGE` — so a return trip
    // while still destroyed needs it put back, not papered over with the arrival briefing.
    say(destroyed ? DEFEAT_MESSAGE : BRIEFING);
    clock.start();
    tick();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    keys.clear();
    // Nothing counts down while the view is parked, so a message would otherwise still be
    // sitting there on the way back in.
    messageLeft = 0;
    options.messagePanel?.classList.remove('show');
    // …and the wake would otherwise be a streak from wherever the aeroplane was parked to
    // wherever it is when the next boost starts.
    trail.clear();
    // A pack's ten seconds do not run while the view is parked, so one left behind would still
    // be sitting there — and its clock would restart — on the way back in.
    packs.clear();
    // Bolts and rockets in the air would otherwise be hanging there, mid-flight, on the way back in.
    bolts.clear();
    rockets.clear();
    enemyBolts.clear();
    clock.stop();
  }

  /**
   * Dev-only handle, the same idea as `__station` in `planet-view.ts`: a screenshot harness
   * needs to know when the surface maps have landed, or every frame it takes is of the
   * procedural stand-in rather than of Earth. Stripped from a production build.
   */
  if (import.meta.env.DEV) {
    let mapsReady = false;
    space.ready.then(() => {
      mapsReady = true;
    });
    (window as unknown as Record<string, unknown>).__fly = {
      camera,
      scene,
      plane,
      space,
      get mapsReady() {
        return mapsReady;
      },
      get speed() {
        return speed;
      },
      /** Lets a harness check the marker against the coastline it is supposed to be over. */
      get groundTrack() {
        return { u: groundTrack.x, v: groundTrack.y };
      },
      get boost() {
        return boost;
      },
      get health() {
        return health;
      },
      get destroyed() {
        return destroyed;
      },
      get running() {
        return running;
      },
      /** The lane, and what the gun has found in it — the two things about this view that are
       *  invisible from outside and that a harness has no other way to ask about. */
      get altitude() {
        return altitude;
      },
      get locked() {
        return locked;
      },
      ufo,
      bombers,
      post,
      rings,
      packs,
      enemyBolts
    };
  }

  return {
    start,
    stop,
    reset,
    setTextureQuality: (quality: TextureQuality) => space.setQuality(quality)
  };
}
