import * as THREE from 'three';
import {
  createEarthMaterial,
  EARTH_SHADER_PRELUDE,
  PLANET_SPIN_RATE,
  SURFACE_VERT,
  type TextureQuality
} from '../space';
import type { FlightSnapshot } from '../flight';
import { GLOBE } from './layout';

/**
 * The bridge's globe: the same Earth that is out of the window, a metre across and indoors.
 *
 * It is built from `createEarthMaterial`, so it is not a *likeness* of the planet — it is the
 * planet, sharing its maps, its map cache, its sun and its axial spin. Point at a storm on
 * the globe and you can go and find it through the office window. That only holds because
 * three things are kept in step, and each is easy to break:
 *
 * - **The sun.** The material is handed the live `sunDirection` vector out of `Space`, not a
 *   copy, so a change of sun relights both at once and the terminator agrees.
 * - **The spin.** Both are turned by `simTime * PLANET_SPIN_RATE`, off the same clock — the
 *   one the navigation console scales.
 * - **The frame.** The globe hangs inside a station that is constantly turning, so it sits in
 *   a group counter-rotated by the rig. In world terms the globe holds still while the room
 *   moves around it, which is both correct and the reason its north pole drifts over a lap.
 *   Note the counter-rotation is applied to a *child* group, so moving the globe about the
 *   station (as the redesign did, from the hub floor to the back of the bridge) only touches
 *   the outer group's position and leaves that machinery alone.
 *
 * That last one is also what makes the next step cheap: a marker for the station's own
 * position has to live in this same world-oriented frame, and it is already here.
 *
 * The presentation is deliberately thin — a rim, a faint wash across the unlit side, and a
 * containment shell. The brief is real outside, warm inside, and the argument for showing a
 * photoreal Earth indoors is that this one is a readout of a real place rather than a second
 * view of it. Anything more stylised and the two stop being the same world, which was the
 * whole point.
 */

const GLOBE_FRAG = /* glsl */ `
  ${EARTH_SHADER_PRELUDE}

  uniform vec3 uRim;

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 sp = normalize(vPosL);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    EarthSample earth = sampleEarth(vUv, n, sp);
    vec3 color = earth.color;

    // The planet's limb haze is the wrong effect at this scale — it is scattered sunlight
    // through hundreds of kilometres of air, and there is none of that indoors. A rim takes
    // its place: bright where the surface turns away, which reads as a projected volume and
    // is the only thing keeping the night hemisphere's silhouette legible in a dark room.
    float grazing = 1.0 - abs(dot(n, viewDir));
    color += uRim * pow(grazing, 3.0) * 0.55;

    // A breath of the display's own colour across the unlit side. Enough that the globe reads
    // as a sphere rather than a crescent; low enough that the city lights still carry it.
    color += uRim * 0.05 * (1.0 - earth.day) * (1.0 - earth.cloud);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** The containment shell: a fresnel halo standing off the surface. Authored over 1.0 for bloom. */
const SHELL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float f = pow(1.0 - abs(dot(n, viewDir)), 3.2);
    gl_FragColor = vec4(uColor * f, f * 0.8);
  }
`;

export interface Globe {
  group: THREE.Group;
  /** Resolves once the maps are on the uniforms, or have failed. Never rejects. */
  ready: Promise<void>;
  /** Follows the page-wide surface-quality switch, exactly as the planet does. */
  setQuality(quality: TextureQuality): Promise<void>;
  /**
   * `rigQuaternion` is the station's own world rotation. Undoing it here is what holds the
   * globe still in space while the hub turns around it.
   */
  update(state: FlightSnapshot, rigQuaternion: THREE.Quaternion, dt: number): void;
}

export interface GlobeOptions {
  quality?: TextureQuality;
}

export function buildGlobe(
  renderer: THREE.WebGLRenderer,
  sunDirection: THREE.Vector3,
  options: GlobeOptions = {}
): Globe {
  const group = new THREE.Group();
  group.position.set(GLOBE.x, GLOBE.y, GLOBE.z);

  /**
   * World-oriented: everything in here is counter-rotated against the rig every frame, so it
   * shares the planet's own frame rather than the room's. The globe goes in it, and so will
   * anything that has to be placed in real orbital coordinates.
   */
  const worldFrame = new THREE.Group();
  group.add(worldFrame);

  const earth = createEarthMaterial(renderer, sunDirection, {
    quality: options.quality,
    fragmentShader: GLOBE_FRAG,
    uniforms: { uRim: { value: new THREE.Color(0.30, 0.72, 1.05) } }
  });

  // Denser than the ratio to the planet's 160x120 would suggest, because this is seen from a
  // metre and a half away, where the silhouette is the thing that gives faceting away.
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(GLOBE.radius, 96, 64), earth.material);
  worldFrame.add(sphere);

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE.radius * 1.055, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.35, 1.15, 1.7) } },
      vertexShader: SURFACE_VERT,
      fragmentShader: SHELL_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  group.add(shell);

  const inverse = new THREE.Quaternion();

  function update(state: FlightSnapshot, rigQuaternion: THREE.Quaternion, dt: number) {
    earth.update(state.simTime, dt);
    // Same clock and same rate as the planet in `space.ts`, so the continents agree.
    sphere.rotation.y = state.simTime * PLANET_SPIN_RATE;
    worldFrame.quaternion.copy(inverse.copy(rigQuaternion).invert());
  }

  return { group, ready: earth.ready, setQuality: earth.setQuality, update };
}
