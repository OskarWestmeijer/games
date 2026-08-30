import * as THREE from 'three';
import dayMapUrl from './textures/planet-day.webp';
import nightMapUrl from './textures/planet-night.webp';
import cloudMapUrl from './textures/planet-clouds.webp';

/**
 * Everything outside the pod's window: the planet, its atmosphere, the starfield and a
 * nebula backdrop.
 *
 * The planet's structure comes from real NASA Earth maps (see `src/textures/`), which is
 * the only reliable way to get coastlines that look like coastlines. The shader then
 * restyles them completely — the lookup is domain-warped so the geography reads as an
 * invented world rather than Earth, and the palette is remapped to electric blue. Noise is
 * still here, but demoted to the high-frequency detail layer that keeps the surface crisp
 * when the camera is only 20 units above it.
 *
 * Units are arbitrary but consistent with the pod being ~7m wide (see `pod.ts`), so the
 * planet is deliberately toy-scaled: big enough to fill the window, small enough that the
 * camera's near/far range stays sane.
 */

/** Planet radius, centred on the world origin. */
export const PLANET_RADIUS = 300;

/**
 * Height of the station's orbit above the surface. Deliberately low — at this altitude the
 * limb sits `asin(300/320)` ≈ 69.6° off the nadir (an ISS-like orbit), which is what makes
 * the horizon read as a wide shallow arc rather than the edge of a ball. Raising it makes
 * the planet look smaller and rounder; `WINDOW_PITCH` in `planet-view.ts` then has to
 * follow, since it's derived from this angle.
 *
 * Anything that orbits or wraps the planet must stay clear of `PLANET_RADIUS + this` —
 * see the atmosphere shells in `buildSpace()`.
 */
export const ORBIT_ALTITUDE = 20;

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

  /** 4 octaves, for detail layers where the top frequency would otherwise alias. */
  float fbm4(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * (snoise(p) * 0.5 + 0.5);
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }

  /** Ridged fbm — the 1-|noise| folds turn smooth blobs into thin creases. */
  float ridged(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * (1.0 - abs(snoise(p)));
      p *= 2.07;
      amp *= 0.5;
    }
    return sum;
  }
`;

const SURFACE_VERT = /* glsl */ `
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

const PLANET_FRAG = /* glsl */ `
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
   * The whole palette, indexed by the source map's luminance: near-black indigo through
   * deep blue and electric cyan to a white-cyan. Earth's own luminance ordering (oceans
   * darkest, then vegetation, then desert, then ice) does the sorting for us, so what comes
   * out reads as a coherent world rather than a recolour.
   */
  vec3 palette(float t) {
    vec3 c = mix(vec3(0.006, 0.032, 0.115), vec3(0.020, 0.135, 0.390),
                 smoothstep(0.04, 0.24, t));
    c = mix(c, vec3(0.050, 0.350, 0.720), smoothstep(0.22, 0.48, t));
    c = mix(c, vec3(0.220, 0.680, 1.000), smoothstep(0.48, 0.72, t));
    c = mix(c, vec3(0.800, 0.950, 1.000), smoothstep(0.72, 0.93, t));
    return c;
  }

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 sp = normalize(vPosL);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // --- warped lookup ------------------------------------------------------------
    // Displacing the UV by low-frequency noise keeps the real coastline detail but moves
    // it somewhere else, so the result is an invented world rather than Earth. Warping the
    // 2D UV rather than re-deriving it from a warped 3D direction is deliberate: the atan()
    // route has a branch cut that wrecks mip selection along one meridian, and fixing that
    // needs textureGrad, which GLSL ES 1.00 only has behind an extension.
    vec2 warp = vec2(fbm(sp * 1.7 + 3.0), fbm(sp * 1.7 + 19.0)) - 0.5;
    vec2 uv = vUv + 0.12 * warp;

    // --- surface ------------------------------------------------------------------
    vec3 dayTex = texture2D(uDayMap, uv).rgb;
    float texLum = dot(dayTex, vec3(0.299, 0.587, 0.114));
    // Earth's oceans are the only strongly blue-dominant thing on the day map.
    float texWater = 1.0 - smoothstep(-0.04, 0.02, max(dayTex.r, dayTex.g) - dayTex.b);

    // Fallback while the maps are still downloading — planet view is the first thing the
    // site shows, so it must never be a black sphere.
    float procH = clamp(0.5 + (fbm(sp * 3.0) - 0.5) * 2.4, 0.0, 1.0);
    float lum = mix(procH * 0.55, texLum, uHasMaps);
    float water = mix(1.0 - smoothstep(0.52, 0.58, procH), texWater, uHasMaps);
    float land = 1.0 - water;

    vec3 surface = palette(lum);
    // Push the seas deeper and colder, and let the land run warmer towards cyan.
    surface = mix(surface, surface * vec3(0.50, 0.72, 1.20), water);

    // High-frequency detail. This is what keeps the surface crisp at 4K when the eye is
    // only 20 units up — the map carries the structure, this carries the sharpness.
    float detail = fbm4(sp * 40.0);
    surface *= 0.88 + 0.24 * detail;

    // --- glowing filament networks ------------------------------------------------
    // Ridged noise gives thin creases; land-masked and emissive, these are the "flashy"
    // element that the source photography can't supply.
    float veinRidge = ridged(sp * 9.0);
    // A tight core with a broader halo around it, so the networks glow rather than just
    // being drawn on. Both land-masked.
    float veins = smoothstep(0.75, 0.93, veinRidge) * land;
    float veinHalo = smoothstep(0.64, 0.90, veinRidge) * land;

    // --- clouds --------------------------------------------------------------------
    float texCloud = texture2D(uCloudMap, uv + vec2(uTime * 0.0009, 0.0)).r;
    float procCloud = clamp(0.5 + (fbm(sp * 3.4) - 0.5) * 2.4, 0.0, 1.0);
    float cloud = smoothstep(0.44, 0.86, mix(procCloud, texCloud, uHasMaps)) * 0.7;

    vec3 albedo = mix(surface, vec3(0.62, 0.82, 1.00), cloud);

    // --- day / night ----------------------------------------------------------------
    float sd = dot(n, uSunDir);
    float day = smoothstep(-0.12, 0.22, sd);
    // smoothstep is undefined when edge0 > edge1, hence the flip rather than the more
    // obvious smoothstep(0.10, -0.15, sd).
    float night = 1.0 - smoothstep(-0.15, 0.10, sd);

    vec3 color = albedo * (0.05 + 0.95 * day);

    // Filaments read clearly on the lit side too — they're the "flashy" element the source
    // photography can't supply — and go incandescent at night.
    color += vec3(0.35, 0.85, 1.00) * veins * (0.85 + 0.75 * night) * (1.0 - cloud);
    color += vec3(0.10, 0.40, 0.80) * veinHalo * (0.22 + 0.30 * night) * (1.0 - cloud);

    // City lights, from the real night map, recoloured to match the palette.
    float lights = smoothstep(0.05, 0.45, dot(texture2D(uNightMap, uv).rgb,
                                              vec3(0.35, 0.40, 0.25))) * uHasMaps;
    color += vec3(0.60, 0.92, 1.00) * lights * (0.10 + 1.15 * night) * (1.0 - cloud);

    // --- limb haze -------------------------------------------------------------------
    // Atmosphere thickening towards the edge of the disc. Note the remap: from this low an
    // orbit we are looking *along* the surface, so grazing never drops below ~0.62 anywhere
    // in view — feeding it to pow() directly hazes the entire visible strip into a pale
    // smear rather than just the horizon.
    float grazing = 1.0 - abs(dot(n, viewDir));
    float haze = pow(smoothstep(0.62, 1.0, grazing), 2.5) * 0.72;
    color = mix(color, vec3(0.30, 0.62, 1.00) * (0.15 + 0.85 * day), haze);

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

export interface Space {
  group: THREE.Group;
  update(elapsed: number, dt: number): void;
}

export function buildSpace(renderer: THREE.WebGLRenderer): Space {
  const group = new THREE.Group();

  const planetMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: SUN_DIR },
      uTime: { value: 0 },
      uDayMap: { value: placeholderTexture() },
      uNightMap: { value: placeholderTexture() },
      uCloudMap: { value: placeholderTexture() },
      uHasMaps: { value: 0 }
    },
    vertexShader: SURFACE_VERT,
    fragmentShader: PLANET_FRAG
  });

  // Faded in once the maps arrive, rather than popped, so the swap from the procedural
  // fallback isn't a visible jolt.
  let mapsTarget = 0;

  const loader = new THREE.TextureLoader();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  Promise.all([
    loader.loadAsync(dayMapUrl),
    loader.loadAsync(nightMapUrl),
    loader.loadAsync(cloudMapUrl)
  ])
    .then(([day, night, clouds]) => {
      for (const texture of [day, night, clouds]) {
        texture.wrapS = THREE.RepeatWrapping; // the UV warp pushes past the seam
        texture.wrapT = THREE.ClampToEdgeWrapping; // ...but must not wrap over the poles
        // We look *along* the surface at a grazing angle for most of the view, which is
        // the worst case for plain mipmapping. Cheapest big win available here.
        texture.anisotropy = maxAnisotropy;
      }
      day.colorSpace = THREE.SRGBColorSpace;
      night.colorSpace = THREE.SRGBColorSpace;
      // The cloud map is read as a mask, not as colour, so it stays linear.

      planetMaterial.uniforms.uDayMap.value = day;
      planetMaterial.uniforms.uNightMap.value = night;
      planetMaterial.uniforms.uCloudMap.value = clouds;
      mapsTarget = 1;
    })
    .catch((error) => {
      // Not fatal: the shader keeps rendering its procedural fallback.
      console.error('Planet textures failed to load, falling back to procedural', error);
    });

  const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS, 160, 120), planetMaterial);
  group.add(planet);

  // Both shells MUST stay inside the orbit radius (PLANET_RADIUS + ORBIT_ALTITUDE). A
  // BackSide fresnel shell that ends up wrapped around the camera smears glow over the
  // whole sky instead of ringing the planet.
  group.add(makeAtmosphere(PLANET_RADIUS * 1.006, THREE.FrontSide, 0, 7.0, 2.2));
  group.add(makeAtmosphere(PLANET_RADIUS * 1.035, THREE.BackSide, 1, 2.0, 2.0));

  const sprite = makeStarSprite();
  group.add(makeStars(7000, 14, sprite));
  group.add(makeStars(420, 26, sprite));

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
    update(elapsed: number, dt: number) {
      planetMaterial.uniforms.uTime.value = elapsed;
      const has = planetMaterial.uniforms.uHasMaps;
      has.value += (mapsTarget - has.value) * Math.min(1, dt * 2.5);
      // A slow axial spin, independent of the station's orbit, so the surface moves too.
      planet.rotation.y = elapsed * 0.004;
    }
  };
}
