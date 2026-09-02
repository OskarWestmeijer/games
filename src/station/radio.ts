import * as THREE from 'three';

/**
 * The radio: a small unit on the lounge table, and the only control the station's music has.
 * Look at it and press E (or tap the prompt) and the playlist comes up; do it again and it goes.
 * The room tone underneath is not its business — see "Ambient audio" in CLAUDE.md.
 *
 * **Why this rather than a mute button in the HUD.** It is the first instance of CLAUDE.md's
 * "diegetic controls" — a switch you walk up to deletes UI instead of adding it, and the
 * mechanism it needs (`interaction.ts`) was already in the room. It also gets the iPad for free:
 * the interact prompt is a real `<button>`, so a tap on it toggles the radio without a single
 * new element in `index.html`.
 *
 * It used to sit on the desk in the nose. There is no desk; it sits on the low table in the
 * middle of the couch instead, on the window side of it, so it is in reach of the one spot the
 * lounge is built around — standing in the mouth of the U with the planet in front of you.
 */

/** Chassis, in metres, sitting on whatever surface it is placed on. */
const BODY = { width: 0.24, height: 0.1, depth: 0.14 };

export interface Radio {
  group: THREE.Group;
  /**
   * What `interaction.ts` aims at: an invisible box a good deal larger than the radio itself.
   * The chassis is a quarter of a metre wide, which is a hard thing to keep a crosshair on, let
   * alone a thumb.
   */
  target: THREE.Object3D;
  /** Switches the indicator. Driven from the audio's own state, not from the click. */
  setLit(lit: boolean): void;
}

/** Built at the origin; the caller stands it on a surface. */
export function buildRadio(): Radio {
  const group = new THREE.Group();

  // Warm, and matte. Everything the shell of the station is made of is grey-blue; like the
  // upholstery, this is deliberately not — see "Real outside, warm inside" in CLAUDE.md.
  const shell = new THREE.MeshStandardMaterial({ color: 0xbfae95, roughness: 0.72, metalness: 0.08 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.6, metalness: 0.15 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x39404b, roughness: 0.4, metalness: 0.65 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(BODY.width, BODY.height, BODY.depth), shell);
  body.position.y = BODY.height / 2;
  group.add(body);

  // Grille: a dark inset panel on the face turned into the room. At this size it reads as a
  // speaker without any of the geometry a real grille would cost.
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.062, 0.012), dark);
  grille.position.set(-0.045, BODY.height / 2, BODY.depth / 2);
  group.add(grille);

  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 12), metal);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.062, BODY.height / 2, BODY.depth / 2);
  group.add(knob);

  // The indicator. `MeshBasicMaterial` with `toneMapped: false` so it reads as emitting rather
  // than as a lit surface, and the lit colour stays under 1.0 on every channel so it sits below
  // the bloom threshold — only the LED strips and the atmosphere have earned a halo.
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.016, 0.008),
    new THREE.MeshBasicMaterial({ color: 0x2a2622, toneMapped: false })
  );
  indicator.position.set(0.062, BODY.height / 2 + 0.03, BODY.depth / 2 + 0.002);
  group.add(indicator);

  const lamp = indicator.material as THREE.MeshBasicMaterial;

  const target = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), dark);
  target.position.y = BODY.height / 2;
  target.visible = false;
  group.add(target);

  return {
    group,
    target,
    setLit: (lit: boolean) => lamp.color.setHex(lit ? 0xe0a068 : 0x2a2622)
  };
}
