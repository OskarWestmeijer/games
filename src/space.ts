import * as THREE from 'three';

/**
 * Everything outside the pod's window: the planet, its atmosphere, the starfield and a
 * nebula backdrop. All of it is generated in code — the planet surface, clouds, city
 * lights and nebula are fbm noise evaluated per-fragment in GLSL rather than baked into
 * a texture, which keeps startup instant and is the only tidy way to get the day/night
 * terminator and its city lights out of a single material.
 *
 * Units are arbitrary but consistent with the pod being ~7m wide (see `pod.ts`), so the
 * planet is deliberately toy-scaled: big enough to fill the window, small enough that the
 * camera's near/far range stays sane.
 */

/** Planet radius, centred on the world origin. */
export const PLANET_RADIUS = 300;
/** Height of the station's orbit above the surface. */
export const ORBIT_ALTITUDE = 70;

/**
 * Direction *towards* the sun, in world space. Fixed, so as the station works its way
 * around the orbit the terminator sweeps across the visible face on its own — the scene
 * animates itself without anything having to drive it.
 *
 * Not a `DirectionalLight`: the planet uses a custom `ShaderMaterial` and so ignores
 * scene lights entirely. The pod's own lighting is set up separately in `planet-view.ts`.
 */
export const SUN_DIR = new THREE.Vector3(1, 0.35, 0.4).normalize();

const STAR_RADIUS = 8000;
const NEBULA_RADIUS = 9000;

/**
 * Shared GLSL: a cheap hash-based value noise plus a 6-octave fbm over it. Used by both
 * the planet and the nebula, so the two read as belonging to the same world. The octave
 * count is a literal because GLSL ES 1.00 (what three.js emits by default) only allows
 * constant loop bounds.
 */
const NOISE_GLSL = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), u.x),
          mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
      mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), u.x),
          mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
      u.z);
  }

  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++) {
      sum += amp * noise3(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }
`;

const SURFACE_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vPosL;

  void main() {
    vPosL = position;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const PLANET_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uTime;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vPosL;

  ${NOISE_GLSL}

  void main() {
    vec3 n = normalize(vNormalW);
    // Noise is sampled on the unit sphere so the surface is independent of planet radius.
    vec3 sp = normalize(vPosL);
    float lat = abs(sp.y);

    // --- terrain -----------------------------------------------------------------
    // fbm sums to a bell curve tight around 0.5, so stretch it out first. That's what
    // makes the thresholds below mean something you can reason about: after this, h is
    // spread across most of 0..1 and "land above 0.6" really is roughly a third of the
    // surface. Widen the multiplier for a more extreme world, narrow it for a flatter one.
    float raw = fbm(sp * 2.2) * 0.75 + fbm(sp * 7.4 + 13.7) * 0.25;
    float h = clamp(0.5 + (raw - 0.5) * 2.6, 0.0, 1.0);
    float land = smoothstep(0.600, 0.645, h);

    vec3 ocean = mix(vec3(0.010, 0.045, 0.150), vec3(0.045, 0.210, 0.400),
                     smoothstep(0.36, 0.60, h));
    vec3 ground = mix(vec3(0.085, 0.175, 0.105), vec3(0.270, 0.230, 0.150),
                      smoothstep(0.65, 0.82, h));
    // Snow on peaks, ice at the poles.
    ground = mix(ground, vec3(0.86, 0.90, 0.94), smoothstep(0.80, 0.92, h));
    vec3 surface = mix(ocean, ground, land);
    surface = mix(surface, vec3(0.82, 0.88, 0.94), smoothstep(0.84, 0.95, lat));

    // --- clouds ------------------------------------------------------------------
    // Rotate the sample point about the planet's axis so the cloud deck drifts.
    float ca = cos(uTime * 0.008);
    float sa = sin(uTime * 0.008);
    vec3 cq = vec3(ca * sp.x + sa * sp.z, sp.y, -sa * sp.x + ca * sp.z);
    float cloudRaw = clamp(0.5 + (fbm(cq * 3.1) - 0.5) * 2.6, 0.0, 1.0);
    float cloud = smoothstep(0.60, 0.88, cloudRaw) * 0.85;

    vec3 albedo = mix(surface, vec3(0.80, 0.86, 0.93), cloud);

    // --- day / night -------------------------------------------------------------
    float sd = dot(n, uSunDir);
    float day = smoothstep(-0.12, 0.22, sd);
    vec3 color = albedo * (0.045 + 0.955 * day);

    // Sun glinting off the water, only where there is water and no cloud.
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float spec = pow(max(dot(reflect(-uSunDir, n), viewDir), 0.0), 64.0);
    color += vec3(0.55, 0.72, 0.95) * spec * (1.0 - land) * (1.0 - cloud) * 0.7;

    // City lights: only on the night side, only on land, and hidden under cloud.
    // (smoothstep with edge0 > edge1 is undefined in GLSL, hence the flip rather than
    // the more obvious smoothstep(0.10, -0.15, sd).)
    float night = 1.0 - smoothstep(-0.15, 0.10, sd);
    // Two scales: a low-frequency mask so cities cluster into inhabited regions rather
    // than dusting the whole landmass, times a single high-frequency octave — not fbm,
    // whose lowest octave would dominate and turn the lights back into big blobs.
    float region = smoothstep(0.42, 0.56, fbm(sp * 5.0 + 41.0));
    float speckle = smoothstep(0.55, 0.72, noise3(sp * 170.0));
    float cities = region * speckle * land * (1.0 - smoothstep(0.68, 0.88, lat));
    color += vec3(1.0, 0.80, 0.52) * cities * night * (1.0 - cloud) * 5.0;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Both atmospheric shells share this. `uMode` picks which half of the effect this shell
 * is drawing: the inner haze (0) brightens towards the limb *over* the planet's disc —
 * the bright horizon band — while the outer glow (1) is the halo bleeding off the edge
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

const NEBULA_FRAG = /* glsl */ `
  varying vec3 vDir;

  ${NOISE_GLSL}

  void main() {
    vec3 d = normalize(vDir);
    float wisp = smoothstep(0.52, 0.86, fbm(d * 2.0 + 5.0))
               * smoothstep(0.38, 0.88, fbm(d * 4.6 - 2.0));
    // Concentrate the brightest cloud into a band, the way a galactic plane reads.
    // Squared by hand: pow() is undefined for a negative base, and d.y goes negative.
    float t = d.y * 2.1;
    float band = exp(-t * t);

    vec3 color = vec3(0.010, 0.016, 0.038);
    color += vec3(0.070, 0.230, 0.560) * wisp;
    color += vec3(0.045, 0.140, 0.380) * wisp * band;

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
        uSunDir: { value: SUN_DIR },
        uColor: { value: new THREE.Color(0.30, 0.62, 1.0) },
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

export interface Space {
  group: THREE.Group;
  update(elapsed: number): void;
}

export function buildSpace(): Space {
  const group = new THREE.Group();

  const planetMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: SUN_DIR },
      uTime: { value: 0 }
    },
    vertexShader: SURFACE_VERT,
    fragmentShader: PLANET_FRAG
  });

  const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS, 128, 96), planetMaterial);
  group.add(planet);

  // Inner haze sits just above the surface and is what makes the horizon glow; the outer
  // shell is much thicker and supplies the halo that spills past the planet's silhouette.
  group.add(makeAtmosphere(PLANET_RADIUS * 1.015, THREE.FrontSide, 0, 4.5, 0.65));
  group.add(makeAtmosphere(PLANET_RADIUS * 1.22, THREE.BackSide, 1, 3.0, 2.0));

  const sprite = makeStarSprite();
  group.add(makeStars(5200, 14, sprite));
  group.add(makeStars(320, 26, sprite));

  const nebula = new THREE.Mesh(
    new THREE.SphereGeometry(NEBULA_RADIUS, 48, 32),
    new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  nebula.renderOrder = -1; // draw first, behind everything else
  group.add(nebula);

  return {
    group,
    update(elapsed: number) {
      planetMaterial.uniforms.uTime.value = elapsed;
      // A slow axial spin, independent of the station's orbit, so the continents move too.
      planet.rotation.y = elapsed * 0.004;
    }
  };
}
