import * as THREE from 'three';

/**
 * The wingtip trails: two ribbons dragged behind the tips while the aeroplane is boosting, and
 * nothing at all when it is not. They are the whole animation of a boost — the speed readout
 * says a number, and this says it at the thing the number is about.
 *
 * **They are camera-facing ribbons, not lines.** `LineBasicMaterial.linewidth` is one pixel on
 * every platform that matters, which at a chase camera's distance is a scratch rather than a
 * wake. A ribbon whose width is spanned by `cross(direction of travel, direction to the
 * camera)` is always seen full-width instead of collapsing to an edge in a bank — which the
 * obvious alternatives, a ribbon spanned by the wing axis or by the aircraft's up, both do.
 *
 * **They taper in the vertex colours rather than in alpha.** Blending is additive, so black is
 * invisible: fading the colour to black along the length costs a three-component attribute,
 * where per-vertex alpha would want a four-component one and a material that respects it.
 *
 * **Both the taper and the width run on distance along the wake, not on sample index**, and
 * rewriting the colours every frame is the price of that. Index is the tempting shortcut,
 * because then the attribute is static — but the samples are frames, and the wake is cut at a
 * fixed *length*, so at speed the whole visible ribbon is the first three or four samples of
 * twenty-four. Tapered by index it is then uniformly full width and full brightness with a
 * square end: a paddle, not a wake, which is exactly what the first version looked like.
 *
 * **Nothing is allocated per boost.** Two fixed buffers of `SAMPLES` positions, rewritten in
 * place — a boost is a frequent event and this runs inside the render loop.
 */

/** How many positions of history each ribbon keeps. The wake's *length* is not this — see
 *  `MAX_LENGTH` — so this is only how finely the curve of it is drawn, and 24 is smooth
 *  through the hardest turn the aeroplane can fly. */
const SAMPLES = 24;
/**
 * How long the wake is, in metres, however fast the aeroplane is going.
 *
 * **It has to be shorter than the chase camera's 15 metres of standoff, and that is the whole
 * reason it exists.** Left as "whatever `SAMPLES` frames of history covers", the wake is 75
 * metres at boosted speed, so it runs sixty metres out *behind the camera* — and the part of
 * it sweeping past the lens is the head, which is the widest and brightest end. Two ribbons
 * half a metre wide at three metres from the eye fill a third of the screen each: the first
 * version looked like the aeroplane was towing two searchlight beams. Held under the standoff
 * the whole wake stays in front of the camera, where it is a wake.
 *
 * Samples past that distance are collapsed onto the cut, which costs a few degenerate quads
 * and keeps the buffer a fixed size — resampling the history by arc length would be the tidier
 * answer and a great deal more code for a ribbon nobody looks at for longer than two seconds.
 */
const MAX_LENGTH = 12;
/** Half-width at the head, in metres, tapering to nothing at the tail. */
const WIDTH = 0.26;
/** The wingtips, in aircraft-local metres: just aft of the navigation lights. */
const TIP = new THREE.Vector3(4.2, 0.05, 0.7);
/** Warm and over 1.0, like the nav lights and the rings that cause it — but well under the
 *  rings' own brightness. Additive blending plus a bloom pass turns anything hotter than this
 *  into two white slabs. */
const GLOW = new THREE.Color(1.5, 0.85, 0.36);
/** Below this the ribbon is not worth drawing, and the next boost starts a fresh one. */
const MIN_INTENSITY = 0.02;

export interface Trail {
  /** Add this to the scene. The ribbons are in world space, *not* under the aeroplane: a wake
   *  is left behind in the world, and parented to the aircraft it would turn with it. */
  group: THREE.Group;
  /**
   * Records this frame's wingtip positions and shows the ribbons at `intensity` (0..1, which
   * is how hard the aeroplane is boosting). At zero they are hidden and their history is
   * dropped, so the next boost does not draw a streak from wherever the last one ended.
   */
  update(plane: THREE.Object3D, cameraPosition: THREE.Vector3, intensity: number): void;
  /** Drops the history without waiting for the intensity to fall — for a teleport. */
  clear(): void;
}

/** One wingtip's worth: a strip of `SAMPLES - 1` quads, newest end first. */
function buildRibbon(material: THREE.Material) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SAMPLES * 2 * 3);
  const colors = new Float32Array(SAMPLES * 2 * 3);
  const indices: number[] = [];

  for (let i = 1; i < SAMPLES; i++) {
    const a = (i - 1) * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  const mesh = new THREE.Mesh(geometry, material);
  // The history is world-space and rewritten every frame, so a bounding sphere computed from
  // it would be stale the moment it was any use. Never culled instead — it is two meshes.
  mesh.frustumCulled = false;

  const history = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  /** The history cut to `MAX_LENGTH`: what actually gets written into the buffer, and how far
   *  along the wake (0..1) each of those points sits. */
  const drawn = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  const along = new Float32Array(SAMPLES);
  return {
    mesh,
    positions,
    colors,
    attribute: geometry.getAttribute('position'),
    colorAttribute: geometry.getAttribute('color'),
    history,
    drawn,
    along
  };
}

export function createTrail(): Trail {
  const group = new THREE.Group();
  group.visible = false;

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const ribbons = [buildRibbon(material), buildRibbon(material)];
  for (const ribbon of ribbons) group.add(ribbon.mesh);

  const tip = new THREE.Vector3();
  const along = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const side = new THREE.Vector3();
  let live = false;

  function writeRibbon(ribbon: (typeof ribbons)[number], cameraPosition: THREE.Vector3) {
    const { history, positions, colors, drawn, along: fraction } = ribbon;

    // Walk back along the history, cutting it at `MAX_LENGTH` and noting how far along the wake
    // each sample sits. Everything past the cut lands on it, so those quads have no area.
    let run = 0;
    drawn[0].copy(history[0]);
    fraction[0] = 0;
    for (let i = 1; i < SAMPLES; i++) {
      const step = history[i].distanceTo(history[i - 1]);
      if (run + step <= MAX_LENGTH) {
        run += step;
        drawn[i].copy(history[i]);
        fraction[i] = run / MAX_LENGTH;
      } else {
        const left = Math.max(MAX_LENGTH - run, 0);
        drawn[i].copy(history[i - 1]).lerp(history[i], step > 1e-6 ? left / step : 0);
        for (let j = i; j < SAMPLES; j++) {
          if (j > i) drawn[j].copy(drawn[i]);
          fraction[j] = 1;
        }
        break;
      }
    }

    for (let i = 0; i < SAMPLES; i++) {
      const point = drawn[i];
      const taper = 1 - fraction[i];
      // Squared, so the ribbon holds its colour over the first stretch and then goes quickly —
      // a linear fade reads as a stick with a soft end rather than as something burning off.
      const fade = taper * taper;
      for (const s of [0, 1]) {
        const c = (i * 2 + s) * 3;
        colors[c] = GLOW.r * fade;
        colors[c + 1] = GLOW.g * fade;
        colors[c + 2] = GLOW.b * fade;
      }
      // The direction the ribbon runs *here*: its neighbours, or the one it has at the ends.
      along.subVectors(drawn[Math.max(i - 1, 0)], drawn[Math.min(i + 1, SAMPLES - 1)]);
      toCamera.subVectors(cameraPosition, point);
      side.crossVectors(along, toCamera);
      // Degenerate where the wake points straight at the camera, and where two samples landed
      // on the same spot — a paused frame, or the head of a freshly started trail.
      const length = side.length();
      if (length > 1e-6) side.multiplyScalar((WIDTH * taper) / length);
      else side.set(0, 0, 0);

      const v = i * 6;
      positions[v] = point.x - side.x;
      positions[v + 1] = point.y - side.y;
      positions[v + 2] = point.z - side.z;
      positions[v + 3] = point.x + side.x;
      positions[v + 4] = point.y + side.y;
      positions[v + 5] = point.z + side.z;
    }
    ribbon.attribute.needsUpdate = true;
    ribbon.colorAttribute.needsUpdate = true;
  }

  return {
    group,

    update(plane: THREE.Object3D, cameraPosition: THREE.Vector3, intensity: number) {
      if (intensity < MIN_INTENSITY) {
        live = false;
        group.visible = false;
        return;
      }

      ribbons.forEach((ribbon, index) => {
        tip
          .set(index === 0 ? -TIP.x : TIP.x, TIP.y, TIP.z)
          .applyQuaternion(plane.quaternion)
          .add(plane.position);

        if (!live) {
          // Starting: collapse the whole history onto the tip, so the ribbon grows out of the
          // wing rather than snapping into existence between here and the last boost.
          for (const point of ribbon.history) point.copy(tip);
        } else {
          // Roll the history back one and put this frame at the head. Thirty copies a ribbon
          // a frame, which is cheaper than any index arithmetic that would avoid them.
          for (let i = SAMPLES - 1; i > 0; i--) ribbon.history[i].copy(ribbon.history[i - 1]);
          ribbon.history[0].copy(tip);
        }

        writeRibbon(ribbon, cameraPosition);
      });

      live = true;
      material.opacity = Math.min(intensity, 1);
      group.visible = true;
    },

    clear() {
      live = false;
      group.visible = false;
    }
  };
}
