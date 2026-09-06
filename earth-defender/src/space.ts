import * as THREE from 'three';
import day4kUrl from './textures/planet-day-4k.webp';
import day8kUrl from './textures/planet-day-8k.webp';
import night2kUrl from './textures/planet-night-2k.webp';
import night4kUrl from './textures/planet-night-4k.webp';
import cloud2kUrl from './textures/planet-clouds-2k.webp';

/**
 * Everything outside the pod's window: the planet, its atmosphere, the starfield and a
 * nebula backdrop.
 *
 * The planet is Earth, shown as the source data has it: the surface is the NASA maps in
 * `src/textures/` sampled straight, with no warp, grade or procedural layer between the file
 * and the screen. The shader's job is lighting — terminator, clouds, city lights, limb haze —
 * not restyling. Procedural noise survives only in `fallbackColor()`, the stand-in world
 * rendered for the moment before the maps finish downloading.
 *
 * Units are arbitrary but consistent with the pod being ~7m wide (see `pod.ts`), so the
 * planet is deliberately toy-scaled: big enough to fill the window, small enough that the
 * camera's near/far range stays sane.
 */

/** Planet radius, centred on the world origin. */
export const PLANET_RADIUS = 300;

/**
 * Outer edge of the atmosphere, and the hard floor for every camera in the project.
 *
 * The outer shell is a `BackSide` fresnel: seen from outside it rings the planet, but a
 * camera *inside* it is wrapped in it and gets glow smeared across the whole sky. So the
 * pod's orbit (`ALTITUDE_RANGE.min` in `planet-view.ts`) and the inspector's closest
 * approach (`MIN_DISTANCE` in `planet-inspect.ts`) both have to stay outside this. It bit
 * once already, when the pod's altitude dropped from 70 to 20 with the shell still at
 * `1.22 x R`.
 */
export const ATMOSPHERE_RADIUS = PLANET_RADIUS * 1.035;

/**
 * Default direction *towards* the sun, in world space. Fixed for the pod's orbit, so as the
 * station works its way around it the terminator sweeps across the visible face on its own —
 * the scene animates itself without anything having to drive it.
 *
 * Each `buildSpace()` clones this into its own vector, shared by the planet and both
 * atmosphere shells and re-aimable through `Space.setSunDirection()` — which is how the
 * planet inspector's sun slider works without relighting the pod's window.
 *
 * Not a `DirectionalLight`: the planet uses a custom `ShaderMaterial` and so ignores
 * scene lights entirely. The pod's own lighting is set up separately in `planet-view.ts`.
 */
export const SUN_DIR = new THREE.Vector3(1, 0.35, 0.4).normalize();

/**
 * How high the sun sits above the orbital plane, in radians — the β angle, and the one knob
 * for how much of each lap is flown in daylight.
 *
 * An equatorial orbit under this sun (β ≈ 18°) spends nearly half of every lap over ground
 * the shader renders as fully dark, which is a lot of night for a five-minute lap. Tilting
 * the plane until the sun is high above it shortens that: the window is aimed towards the
 * +normal side (see `HORIZON_ELEVATION`), which is the sunward side, so it sees ground roughly
 * 20° of arc *further into the daylight* than the point directly below. At 74° the night
 * pass is down to about 31% of the lap and the station never enters the planet's shadow at
 * all (which needs β > α ≈ 69.6°) — daylight most of the way round, with a real night side
 * and its city lights still there to fly into.
 *
 * As a side effect the plane ends up inclined ≈73° to the equator, so the ground track runs
 * diagonally across the world from ice cap to ice cap instead of circling the equator.
 */
export const SUN_BETA = THREE.MathUtils.degToRad(74);
/**
 * The orbital plane of the system — the pod flies in it and so does the moon, which is what
 * makes the moon transit the window once every lap instead of wandering in and out over a
 * quarter of an hour.
 *
 * Built from `SUN_DIR` so the daylight reasoning in `SUN_BETA` holds whatever the sun is set
 * to: `ORBIT_NORMAL` is tilted `SUN_BETA` away from the plane perpendicular to the sun, and
 * `ORBIT_NOON` is the sun projected into the plane, which makes orbit angle 0 the most
 * sunlit point of a lap and angle π local midnight.
 */
export const ORBIT_NORMAL = SUN_DIR.clone()
  .multiplyScalar(Math.sin(SUN_BETA))
  .addScaledVector(
    new THREE.Vector3().crossVectors(SUN_DIR, new THREE.Vector3(0, 1, 0)).normalize(),
    Math.cos(SUN_BETA)
  )
  .normalize();
export const ORBIT_NOON = SUN_DIR.clone()
  .addScaledVector(ORBIT_NORMAL, -SUN_DIR.dot(ORBIT_NORMAL))
  .normalize();
export const ORBIT_DAWN = new THREE.Vector3().crossVectors(ORBIT_NORMAL, ORBIT_NOON);

/**
 * The moon. Still generous by real standards — 240 units across at 3000, so ~9° wide from the
 * pod against the Moon's real 0.5° — but no longer the loudest thing in the window, which at
 * 400 (~15°, over a third of the glass) it was.
 *
 * Size is the *only* lever on how long it is in view. The window shows about 11° of sky above
 * the limb, and the pod's own rotation sweeps that band past a fixed direction in about nine
 * seconds, so the transit lasts `(11° + size) / 1.2° per second` — ~15s standing back from the
 * glass, ~66s standing at it, where the opening subtends ±82° instead of ±40°.
 *
 * Sharing the pod's orbital plane is what makes it dependable. Measured over 18 phases of its
 * own orbit, every tilt away from that plane has phases where it never appears at all; in the
 * pod's plane it transits every single lap. `MOON_START` is chosen so the first one begins
 * ~10s after the view opens.
 *
 * The sun is 74° out of that plane, so the phase angle stays between about 75° and 105° —
 * the moon is always a half-lit disc with a clean terminator, never full and never new.
 */
export const MOON_RADIUS = 240;
export const MOON_ORBIT_RADIUS = 3000;
const MOON_PERIOD = 3600;
const MOON_START = 5.62;

const STAR_RADIUS = 8000;
const NEBULA_RADIUS = 9000;

/**
 * Shared GLSL noise. 3D simplex (the standard Ashima/Gustavson implementation) rather than
 * the hash value-noise this used to use: value noise has axis-aligned lattice artifacts and
 * weak high-frequency content, which is exactly what made the old procedural surface look
 * mushy. The `fbm` wrapper remaps to 0..1 so callers can keep reasoning in those terms.
 *
 * Octave counts are literals because GLSL ES 1.00 (what three.js emits by default) only
 * allows constant loop bounds.
 */
const NOISE_GLSL = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  /** 6 octaves, remapped to roughly 0..1 with a mean near 0.5. */
  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++) {
      sum += amp * (snoise(p) * 0.5 + 0.5);
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }

`;

export const SURFACE_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vPosL;
  varying vec2 vUv;

  void main() {
    vPosL = position;
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * Everything needed to show *this* Earth, shared by every material that does.
 *
 * The planet in the window and the hub globe are the same world seen twice, and the only way
 * to keep them honest about that is to light them with one piece of code. Concatenate this in
 * front of a `main()` and call `sampleEarth()`; the uniforms it needs are the ones
 * `createEarthMaterial` supplies.
 *
 * Requires the varyings from `SURFACE_VERT`.
 */
export const EARTH_SHADER_PRELUDE = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uCloudMap;
  uniform float uHasMaps;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vPosL;
  varying vec2 vUv;

  ${NOISE_GLSL}

  /**
   * Colour ramp for the procedural fallback only — the shape the world has for the fraction
   * of a second before the maps resolve. Indexed by a noise height: deep ocean, shelf, sand
   * at the waterline, vegetation, bare rock, snow. Once uHasMaps reaches 1 the day map's
   * own colour takes over completely and this contributes nothing.
   */
  vec3 fallbackColor(float h) {
    vec3 c = mix(vec3(0.020, 0.060, 0.160), vec3(0.050, 0.180, 0.320),
                 smoothstep(0.20, 0.52, h));
    c = mix(c, vec3(0.550, 0.480, 0.300), smoothstep(0.52, 0.57, h));
    c = mix(c, vec3(0.160, 0.300, 0.130), smoothstep(0.57, 0.63, h));
    c = mix(c, vec3(0.350, 0.320, 0.280), smoothstep(0.68, 0.80, h));
    c = mix(c, vec3(0.900, 0.920, 0.950), smoothstep(0.82, 0.93, h));
    return c;
  }

  struct EarthSample {
    /** Surface, clouds, terminator and city lights — everything but the limb haze. */
    vec3 color;
    /** Cloud coverage, 0..1, for anything that has to layer over the weather. */
    float cloud;
    /** The sunlit term, 0..1. Anything lit by scattered sunlight has to be scaled by it. */
    float day;
  };

  EarthSample sampleEarth(vec2 uv, vec3 n, vec3 sp) {
    // --- surface ------------------------------------------------------------------
    // The maps are shown exactly as they are: a plain vUv lookup, no domain warp, no colour
    // grade, no procedural detail multiplied over the top. This world used to be Earth-*like*
    // — the lookup was warped so the coastlines were real coastlines in invented places — and
    // is now simply Earth. Everything that used to sit between the file and the screen was a
    // way of making a photograph look wrong, so none of it survives.
    vec3 dayTex = texture2D(uDayMap, uv).rgb;

    // Fallback while the maps are still downloading — planet view is the first thing the
    // site shows, so it must never be a black sphere.
    float procH = clamp(0.5 + (fbm(sp * 3.0) - 0.5) * 2.4, 0.0, 1.0);
    vec3 surface = mix(fallbackColor(procH), dayTex, uHasMaps);

    // --- clouds --------------------------------------------------------------------
    float texCloud = texture2D(uCloudMap, uv + vec2(uTime * 0.0009, 0.0)).r;
    float procCloud = clamp(0.5 + (fbm(sp * 3.4) - 0.5) * 2.4, 0.0, 1.0);
    // Deliberately stingy. The 2048 composite is soft and slightly blotchy, and the old
    // thresholds (0.44..0.86 at 0.7) turned everything above thin haze into white, which put
    // the map's own mush over most of the disc. Starting the ramp well up the histogram keeps
    // only the thicker weather systems, and the lower opacity leaves the ground reading
    // through them.
    float cloud = smoothstep(0.62, 0.97, mix(procCloud, texCloud, uHasMaps)) * 0.5;

    vec3 albedo = mix(surface, vec3(0.97, 0.98, 1.00), cloud);

    // --- day / night ----------------------------------------------------------------
    float sd = dot(n, uSunDir);
    float day = smoothstep(-0.12, 0.22, sd);
    // smoothstep is undefined when edge0 > edge1, hence the flip rather than the more
    // obvious smoothstep(0.10, -0.15, sd).
    float night = 1.0 - smoothstep(-0.15, 0.10, sd);

    vec3 color = albedo * (0.05 + 0.95 * day);

    // City lights, from the night map, kept the warm sodium colour they actually are.
    float lights = smoothstep(0.05, 0.45, dot(texture2D(uNightMap, uv).rgb,
                                              vec3(0.35, 0.40, 0.25))) * uHasMaps;
    color += vec3(1.00, 0.78, 0.45) * lights * (0.10 + 1.15 * night) * (1.0 - cloud);

    return EarthSample(color, cloud, day);
  }
`;

const PLANET_FRAG = /* glsl */ `
  ${EARTH_SHADER_PRELUDE}

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 sp = normalize(vPosL);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    EarthSample earth = sampleEarth(vUv, n, sp);
    vec3 color = earth.color;

    // --- limb haze -------------------------------------------------------------------
    // Atmosphere thickening towards the edge of the disc. Note the remap: from the bottom of
    // the station's altitude range we are looking *along* the surface, so grazing never drops
    // below ~0.62 anywhere in view — feeding it to pow() directly hazes the entire visible
    // strip into a pale smear rather than just the horizon. Climbing only makes the remap
    // more correct, since grazing then reaches 0 at the nadir.
    //
    // Scaled by the day term, so it is scattered sunlight and nothing else. It used to keep
    // a 0.15 floor on the night side, which laid a blue wash over the dark limb and over the
    // city lights near it — nothing is lighting that air, so now there is no haze there.
    float grazing = 1.0 - abs(dot(n, viewDir));
    float haze = pow(smoothstep(0.62, 1.0, grazing), 2.5) * 0.72 * earth.day;
    color = mix(color, vec3(0.45, 0.68, 1.00), haze);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Both atmospheric shells share this. `uMode` picks which half of the effect this shell
 * is drawing: the inner rim (0) brightens towards the limb *over* the planet's disc —
 * the bright horizon line — while the outer band (1) is the glow bleeding off the edge
 * into space, brightest against the planet and fading outward.
 */
const ATMOSPHERE_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uColor;
  uniform float uMode;
  uniform float uPower;
  uniform float uIntensity;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float facing = abs(dot(n, viewDir));

    float glow = mix(pow(1.0 - facing, uPower), pow(facing, uPower), uMode);
    // Only the lit side of the planet has a visible atmosphere.
    float lit = smoothstep(-0.35, 0.30, dot(n, uSunDir));

    float a = glow * lit * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const NEBULA_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * The universe behind everything: two octaves of fbm multiplied into wisps, concentrated into
 * a band, added over a dark base.
 *
 * This has been rebuilt twice and reverted twice. Once as `smoothstep(fbm) * smoothstep(fbm)`
 * with a colour ramp, which is the same construction as the planet's cloud layer and looked
 * like overcast weather hung in space; once as domain-warped ridged filaments, which came out
 * smeared and streaky. Its colours were also put on a slow drift between authored palettes,
 * and that was scrapped too — the sky reads as space because it is constant, faint, isotropic
 * and mostly empty. **If you are about to reach for ridged noise, domain warping, a bright
 * core or animated colour here: each has been tried and each was worse.**
 */
const NEBULA_FRAG = /* glsl */ `
  varying vec3 vDir;

  ${NOISE_GLSL}

  void main() {
    vec3 d = normalize(vDir);
    float wisp = smoothstep(0.50, 0.86, fbm(d * 2.0 + 5.0))
               * smoothstep(0.36, 0.88, fbm(d * 4.6 - 2.0));
    // Concentrate the brightest cloud into a band, the way a galactic plane reads.
    // Squared by hand: pow() is undefined for a negative base, and d.y goes negative.
    float t = d.y * 2.1;
    float band = exp(-t * t);

    vec3 color = vec3(0.010, 0.016, 0.038);
    color += vec3(0.080, 0.260, 0.620) * wisp;
    color += vec3(0.050, 0.160, 0.430) * wisp * band;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * The moon's surface, entirely procedural — there is no moon map in `src/textures/` and a
 * body this small on screen does not need one.
 *
 * Craters come from a cellular (Worley) search: the nearest jittered lattice point is a
 * crater centre, its cell also gives the crater a radius, and `craterProfile()` turns the
 * distance into a bowl with a raised rim. The gradient comes out of the same search rather
 * than out of finite differences — knowing *which way* the nearest crater centre lies is
 * most of the answer, and the alternative costs three more 27-cell searches per octave.
 *
 * **Craters must stay sparse, shallow and unpainted.** Cellular noise is the standard way to
 * draw cells, scales and bacterial colonies, and the first version of this shader found out
 * why: one crater per lattice cell, all a similar size, evenly spaced, with bright rims and
 * dark blotches over the top, reads as an infection rather than as geology. Real cratering is
 * Poisson-random with a power-law size distribution — mostly smooth ground with a few big
 * holes in it. Hence the hash gate (~1 cell in 3 carries a crater), the squared radius term
 * (many small, few large), the shallow profile, and the rule that relief is *shaded* and not
 * also painted into the albedo. Every one of those is load-bearing; turning any of them back
 * up brings the rash back.
 */
const MOON_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uRadius;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vPosL;

  ${NOISE_GLSL}

  vec3 cellHash(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }

  /**
   * One crater in cross-section, by distance from its centre in units of its own radius.
   * The rim is the part that reads as a pustule when it is pronounced, so it stays a
   * suggestion — under half the depth of the bowl it surrounds.
   */
  float craterProfile(float t) {
    float bowl = -0.45 * (1.0 - smoothstep(0.0, 0.90, t));
    float rim = 0.22 * exp(-9.0 * (t - 1.0) * (t - 1.0));
    return bowl + rim;
  }

  /** Height in .x, surface gradient in .yzw, for one octave of craters. */
  vec4 craterOctave(vec3 p, float scale, float amp) {
    vec3 sp = p * scale;
    vec3 cell = floor(sp);
    vec3 f = sp - cell;

    float nearest = 8.0;
    vec3 offset = vec3(0.0);
    float radius = 0.5;

    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        for (int z = -1; z <= 1; z++) {
          vec3 o = vec3(float(x), float(y), float(z));
          vec3 jitter = cellHash(cell + o);
          // Most cells are empty ground. Without this every cell carries a crater, which is
          // an even cellular packing — the thing that reads as biology rather than geology.
          if (jitter.z < 0.38) {
            vec3 delta = o + jitter - f;
            float d = length(delta);
            if (d < nearest) {
              nearest = d;
              offset = delta;
              // Squared, so the distribution runs many small and a few large, the way real
              // cratering does. Under 1 cell, so neighbours rarely merge.
              radius = 0.18 + 0.55 * jitter.x * jitter.x;
            }
          }
        }
      }
    }

    float t = nearest / radius;
    float h = craterProfile(t);
    // Slope of the profile, not of the field: one extra profile evaluation, no extra search.
    float slope = (craterProfile(t + 0.02) - h) * 50.0;
    vec3 dir = nearest > 1e-4 ? -offset / nearest : vec3(0.0);
    return vec4(h * amp, dir * slope * amp);
  }

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 sp = normalize(vPosL);

    // The fine octave fades out with distance, measured in multiples of the moon's own
    // radius — what matters is how many pixels a crater lands on, so the threshold has to
    // follow the size. Procedural detail has no mipmaps; at pod range it would only shimmer.
    float detail = 1.0 - smoothstep(3.0, 9.0, distance(cameraPosition, vWorldPos) / uRadius);

    vec4 big = craterOctave(sp, 8.0, 1.0);
    vec4 small = craterOctave(sp, 19.0, 0.45 * detail);
    float relief = big.x + small.x;

    // Tilt the normal along the crater slopes: saturated first so a rim crest cannot fold it
    // inside out, then projected into the tangent plane so it only ever tilts.
    vec3 grad = big.yzw + small.yzw;
    grad = grad / (1.0 + length(grad));
    grad -= n * dot(n, grad);
    vec3 shaded = normalize(n - grad * 0.22);

    // Maria: broad dark plains, the one feature that reads at any distance. Low frequency and
    // close in tone — high-contrast blotches over a crater field is most of what made this
    // look diseased, and it is also half of what made the moon too loud in the window.
    float maria = smoothstep(0.44, 0.60, fbm(sp * 1.1));
    vec3 albedo = mix(vec3(0.66, 0.65, 0.63), vec3(0.55, 0.55, 0.57), maria);
    // Floors sit a little darker, and that is all: no bright rims. Drawing the same height
    // field as pigment on top of the shading it already drives doubles the pattern.
    albedo *= 1.0 + min(relief, 0.0) * 0.12;

    float sun = max(dot(shaded, uSunDir), 0.0);
    // Planetshine: the dark limb picks up light from the planet it orbits, at the origin.
    float shine = max(dot(shaded, normalize(-vWorldPos)), 0.0);

    // Deliberately under 1.0 everywhere: over the bloom threshold the moon would wear a halo.
    vec3 color = albedo * (sun + 0.02) + vec3(0.30, 0.44, 0.72) * shine * 0.05;
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** A soft round dot for the star points — cheaper and rounder than a square billboard. */
function makeStarSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Points scattered evenly over a sphere. `acos(1 - 2u)` rather than a uniform polar angle,
 * otherwise the stars bunch up at the poles.
 */
function makeStars(count: number, size: number, sprite: THREE.Texture): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - 2 * Math.random());
    const phi = Math.random() * Math.PI * 2;
    positions[i * 3] = STAR_RADIUS * Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = STAR_RADIUS * Math.cos(theta);
    positions[i * 3 + 2] = STAR_RADIUS * Math.sin(theta) * Math.sin(phi);

    // Mostly white, tinted a little blue or amber, with a wide brightness spread so the
    // field doesn't read as a uniform screen of identical dots. Deliberately kept under
    // 1.0 — over the bloom threshold the brightest stars smear into fat blobs.
    const brightness = 0.42 + Math.pow(Math.random(), 2.0) * 0.52;
    const tint = Math.random();
    colors[i * 3] = brightness * (tint > 0.85 ? 1.0 : 0.82);
    colors[i * 3 + 1] = brightness * 0.9;
    colors[i * 3 + 2] = brightness * (tint < 0.35 ? 1.0 : 0.88);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      sizeAttenuation: true,
      map: sprite,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
}

function makeAtmosphere(
  sunDir: THREE.Vector3,
  radius: number,
  side: THREE.Side,
  mode: number,
  power: number,
  intensity: number
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: sunDir },
        uColor: { value: new THREE.Color(0.35, 0.68, 1.0) },
        uMode: { value: mode },
        uPower: { value: power },
        uIntensity: { value: intensity }
      },
      vertexShader: SURFACE_VERT,
      fragmentShader: ATMOSPHERE_FRAG,
      side,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
}

/** 1x1 stand-in so the sampler uniforms are never null before the real maps land. */
function placeholderTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Which set of surface maps to fly under. The name is the day map's width — that is the one
 * that carries every bit of visible surface detail, and the one the choice is really about.
 *
 * `8k` is the default: 2.9 MB for the three files, and it is what flying low over the terrain
 * is worth doing on. It costs GPU memory as well as download (an 8192x4096 map with mipmaps
 * is ~180 MB of texture per renderer, and the two planet scenes each have their own
 * renderer), so `4k` stays as the 1.2 MB fallback for a slow line or a thin GPU — at this
 * orbit it is already sharp enough that the limb is the thing that gives it away.
 */
export type TextureQuality = '4k' | '8k';

/**
 * The two sets. Clouds are 2048 in both: NASA publishes that composite at one size only,
 * and it is a soft mask over everything else rather than something you read detail from.
 * The night map follows the day map up, since city lights are the other thing you look
 * closely at.
 */
const MAP_SETS: Record<TextureQuality, { day: string; night: string; clouds: string }> = {
  '4k': { day: day4kUrl, night: night2kUrl, clouds: cloud2kUrl },
  '8k': { day: day8kUrl, night: night4kUrl, clouds: cloud2kUrl }
};

interface PlanetMaps {
  day: THREE.Texture;
  night: THREE.Texture;
  clouds: THREE.Texture;
}

/**
 * Loaded map sets, shared by every `Space` in the page and never disposed — there are at
 * most two of them, and holding on to both is what makes switching quality back and forth
 * instant instead of a re-download. Keyed by quality rather than by URL, so the 2048 cloud
 * file is fetched once per set; the second one is a browser cache hit.
 *
 * `anisotropy` is taken from whichever renderer asks first. Both planet scenes run on the
 * same GPU, so they report the same maximum.
 */
const mapCache = new Map<TextureQuality, Promise<PlanetMaps>>();

function loadMaps(quality: TextureQuality, maxAnisotropy: number): Promise<PlanetMaps> {
  const cached = mapCache.get(quality);
  if (cached) return cached;

  const urls = MAP_SETS[quality];
  const loader = new THREE.TextureLoader();
  const pending = Promise.all([
    loader.loadAsync(urls.day),
    loader.loadAsync(urls.night),
    loader.loadAsync(urls.clouds)
  ])
    .then(([day, night, clouds]) => {
      for (const texture of [day, night, clouds]) {
        texture.wrapS = THREE.RepeatWrapping; // equirectangular: longitude wraps
        texture.wrapT = THREE.ClampToEdgeWrapping; // ...but must not wrap over the poles
        // We look *along* the surface at a grazing angle for most of the view, which is
        // the worst case for plain mipmapping. Cheapest big win available here.
        texture.anisotropy = maxAnisotropy;
      }
      day.colorSpace = THREE.SRGBColorSpace;
      night.colorSpace = THREE.SRGBColorSpace;
      // The cloud map is read as a mask, not as colour, so it stays linear.
      return { day, night, clouds };
    })
    .catch((error) => {
      // Drop the failed attempt so a later switch back can retry rather than re-serving
      // the rejection for the rest of the session.
      mapCache.delete(quality);
      throw error;
    });

  mapCache.set(quality, pending);
  return pending;
}

/**
 * Radians per second of axial spin — a slow drift that keeps the surface alive under the
 * station's windows. Exported because `flight.ts` needs it: an orbit whose period matches
 * this is the one where the ground stops sliding underneath, which is what "synchronous"
 * means on the navigation console.
 */
export const PLANET_SPIN_RATE = 0.004;

export interface SpaceOptions {
  /**
   * Radians per second of axial spin. Defaults to `PLANET_SPIN_RATE`; the inspector passes 0,
   * since a planet you are trying to look closely at should hold still and be lit by moving
   * the sun instead.
   */
  spinRate?: number;
  /** Which map set to start on. Defaults to `8k`; changed later with `setQuality()`. */
  quality?: TextureQuality;
}

export interface Space {
  group: THREE.Group;
  /**
   * Resolves once the opening map set is on the material's uniforms — or once it has failed
   * and the procedural fallback is what you are going to get. It **never rejects**:
   * `applyMaps()` already swallows the error so the scene keeps rendering either way.
   *
   * This exists so a caller can get the textures in hand *before* showing the scene. Without
   * it the first render after they arrive is where the GPU upload lands, and that is exactly
   * the frame you don't want to be in front of someone.
   */
  ready: Promise<void>;
  /**
   * This space's sun, as the live vector the shaders read — not a copy.
   *
   * Handed out so that anything else showing the same Earth (the hub globe) is lit by the
   * same sun and puts its terminator in the same place, including after `setSunDirection`.
   * Mutate it through `setSunDirection` rather than directly.
   */
  sunDirection: THREE.Vector3;
  update(elapsed: number, dt: number): void;
  /** Re-aims this space's sun. The vector is normalised for you. */
  setSunDirection(dir: THREE.Vector3): void;
  /** Swaps in another map set. Resolves once it is on screen. */
  setQuality(quality: TextureQuality): Promise<void>;
  /**
   * Where a point in space sits on the surface maps: the same `uv` the planet's own shader
   * samples them with. `u` runs 0..1 west to east from the left edge of the map — 180° W, the
   * maps being plain equirectangular — and `v` is 1 at the north pole, 0 at the south.
   *
   * Handed out for the flight view's minimap, which draws that same day map flat and needs the
   * aircraft's ground track on it. It is *derived* from `SphereGeometry`'s own convention
   * rather than guessed at, which is why it can be trusted to land on the right coastline:
   *
   *   x = -r·cos(2πu)·sin(πw),  y = r·cos(πw),  z = r·sin(2πu)·sin(πw),  v = 1 - w
   *
   * inverted. Note **in the planet's local frame**, not the world's — that is what makes the
   * slow axial spin come out in the answer instead of being quietly ignored.
   */
  surfaceUv(point: THREE.Vector3, target: THREE.Vector2): THREE.Vector2;
  /**
   * The other way round: a latitude and longitude on the planet's surface, at `radius` from its
   * centre, as a point in **world** space — so a place on the ground stays on that place while
   * the planet turns underneath it.
   *
   * The same `SphereGeometry` convention `surfaceUv` inverts, run forwards. Handed out for the
   * flight view's bombers, which aim at a country rather than at a point in space.
   */
  worldFromLatLon(
    latitude: number,
    longitude: number,
    radius: number,
    target: THREE.Vector3
  ): THREE.Vector3;
}

export interface EarthMaterial {
  material: THREE.ShaderMaterial;
  /** Resolves once the opening map set is on the uniforms, or has failed. Never rejects. */
  ready: Promise<void>;
  setQuality(quality: TextureQuality): Promise<void>;
  update(elapsed: number, dt: number): void;
}

export interface EarthMaterialOptions {
  quality?: TextureQuality;
  /** Defaults to the planet's own. Pass one built on `EARTH_SHADER_PRELUDE`. */
  fragmentShader?: string;
  /** Merged in after the shared set, for whatever the caller's own `main()` needs. */
  uniforms?: Record<string, THREE.IUniform>;
  /** Merged into the `ShaderMaterial` constructor — `side`, `transparent`, and so on. */
  material?: THREE.ShaderMaterialParameters;
}

/**
 * A material that shows this Earth: the NASA maps, the terminator, the clouds and the city
 * lights, lit by the sun vector it is handed.
 *
 * Both the planet in `buildSpace` and the hub globe in `station/globe.ts` are built from
 * this. That is the whole point of it — the globe is supposed to be the *same* world as the
 * one out of the window, and two materials that merely resemble each other would drift apart
 * the first time either was touched. It also means the globe costs no extra download: the
 * map cache is page-wide, so it gets whatever the planet already has in hand.
 *
 * `renderer` is taken only for `capabilities.getMaxAnisotropy()`.
 */
export function createEarthMaterial(
  renderer: THREE.WebGLRenderer,
  sunDir: THREE.Vector3,
  options: EarthMaterialOptions = {}
): EarthMaterial {
  const { quality: initialQuality = '8k', fragmentShader = PLANET_FRAG } = options;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDir },
      uTime: { value: 0 },
      uDayMap: { value: placeholderTexture() },
      uNightMap: { value: placeholderTexture() },
      uCloudMap: { value: placeholderTexture() },
      uHasMaps: { value: 0 },
      ...(options.uniforms ?? {})
    },
    vertexShader: SURFACE_VERT,
    fragmentShader,
    ...(options.material ?? {})
  });

  // Faded in once the maps arrive, rather than popped, so the swap from the procedural
  // fallback isn't a visible jolt.
  let mapsTarget = 0;

  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  let quality = initialQuality;

  function applyMaps(requested: TextureQuality): Promise<void> {
    return loadMaps(requested, maxAnisotropy)
      .then((maps) => {
        // A switch made while this one was still downloading wins; whatever is on the
        // uniforms now is newer than what this promise is holding.
        if (quality !== requested) return;
        material.uniforms.uDayMap.value = maps.day;
        material.uniforms.uNightMap.value = maps.night;
        material.uniforms.uCloudMap.value = maps.clouds;
        mapsTarget = 1;
      })
      .catch((error) => {
        // Not fatal: the shader keeps rendering whatever it has — the previous set, or the
        // procedural fallback if this was the first load.
        console.error('Planet textures failed to load', error);
      });
  }

  return {
    material,
    ready: applyMaps(quality),
    setQuality(next: TextureQuality) {
      if (next === quality) return Promise.resolve();
      quality = next;
      return applyMaps(next);
    },
    update(elapsed: number, dt: number) {
      material.uniforms.uTime.value = elapsed;
      const has = material.uniforms.uHasMaps;
      has.value += (mapsTarget - has.value) * Math.min(1, dt * 2.5);
    }
  };
}

export function buildSpace(renderer: THREE.WebGLRenderer, options: SpaceOptions = {}): Space {
  const { spinRate = PLANET_SPIN_RATE, quality: initialQuality = '8k' } = options;
  const group = new THREE.Group();

  // One vector per space instance, referenced by the planet's uniform and both shells', so
  // a single copy() re-lights all three — and two spaces in the same page don't share a sun.
  const sunDir = SUN_DIR.clone();

  const surface = createEarthMaterial(renderer, sunDir, { quality: initialQuality });

  const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS, 160, 120), surface.material);
  group.add(planet);

  // The inner rim brightens the limb over the disc; the outer band is the glow bleeding off
  // the edge into space. Every camera has to stay outside the outer one — see
  // `ATMOSPHERE_RADIUS`.
  group.add(makeAtmosphere(sunDir, PLANET_RADIUS * 1.006, THREE.FrontSide, 0, 7.0, 2.2));
  group.add(makeAtmosphere(sunDir, ATMOSPHERE_RADIUS, THREE.BackSide, 1, 2.0, 2.0));

  const moon = new THREE.Mesh(
    // Generous segment counts: in the inspector the moon can be 37° across, and at 64
    // segments the limb is visibly faceted at that size.
    new THREE.SphereGeometry(MOON_RADIUS, 128, 96),
    new THREE.ShaderMaterial({
      uniforms: { uSunDir: { value: sunDir }, uRadius: { value: MOON_RADIUS } },
      vertexShader: SURFACE_VERT,
      fragmentShader: MOON_FRAG
    })
  );
  group.add(moon);

  const sprite = makeStarSprite();
  group.add(makeStars(7000, 14, sprite));
  group.add(makeStars(420, 26, sprite));

  // No `renderOrder`. It used to be -1, which forced the skydome to draw before everything
  // else and so shade every pixel on screen — including the ~80% of the pod view hidden
  // behind the room and the planet. Left in the ordinary opaque queue it is drawn back to
  // front *after* nearer opaques, and the depth test throws away the occluded sky. Do not
  // "optimise" that line back in.
  const nebula = new THREE.Mesh(
    new THREE.SphereGeometry(NEBULA_RADIUS, 48, 32),
    new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  group.add(nebula);

  /** Scratch for `surfaceUv`, which is called every frame by the flight view's minimap. */
  const localPoint = new THREE.Vector3();

  return {
    group,
    ready: surface.ready,
    sunDirection: sunDir,
    update(elapsed: number, dt: number) {
      surface.update(elapsed, dt);
      // A slow axial spin, independent of the station's orbit, so the surface moves too.
      planet.rotation.y = elapsed * spinRate;

      const moonAngle = MOON_START + (elapsed / MOON_PERIOD) * Math.PI * 2;
      moon.position
        .copy(ORBIT_NOON)
        .multiplyScalar(Math.cos(moonAngle) * MOON_ORBIT_RADIUS)
        .addScaledVector(ORBIT_DAWN, Math.sin(moonAngle) * MOON_ORBIT_RADIUS);
      // Tidally locked, like every moon that has been round long enough: the same face is
      // always turned towards the planet.
      moon.lookAt(0, 0, 0);
    },
    setSunDirection(dir: THREE.Vector3) {
      sunDir.copy(dir).normalize();
    },
    setQuality(next: TextureQuality) {
      return surface.setQuality(next);
    },
    surfaceUv(point: THREE.Vector3, target: THREE.Vector2) {
      // `update()` above spins the planet, so "where is this on the map" is a question about
      // the planet's *local* frame. `updateWorldMatrix` first because a caller may well ask
      // before the renderer has refreshed the matrices this frame — the same trap as
      // raycasting from a rig that has already moved.
      planet.updateWorldMatrix(true, false);
      planet.worldToLocal(localPoint.copy(point)).normalize();
      const u = Math.atan2(localPoint.z, -localPoint.x) / (Math.PI * 2);
      const w = Math.acos(THREE.MathUtils.clamp(localPoint.y, -1, 1)) / Math.PI;
      // `u - floor(u)` rather than a modulo: atan2 is signed, and a negative longitude has to
      // come back as the east end of the map, not as a negative fraction of it.
      return target.set(u - Math.floor(u), 1 - w);
    },
    worldFromLatLon(latitude: number, longitude: number, radius: number, target: THREE.Vector3) {
      const phi = ((longitude + 180) / 360) * Math.PI * 2;
      const theta = ((90 - latitude) / 180) * Math.PI;
      localPoint
        .set(
          -Math.cos(phi) * Math.sin(theta),
          Math.cos(theta),
          Math.sin(phi) * Math.sin(theta)
        )
        .multiplyScalar(radius);
      planet.updateWorldMatrix(true, false);
      return target.copy(planet.localToWorld(localPoint));
    }
  };
}
