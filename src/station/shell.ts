import * as THREE from 'three';

/**
 * The station's palette and the two placement helpers everything else is built with.
 *
 * This file used to hold `buildShell()` too — a generic pressurised box built from a convex
 * floor polygon, which was how the hub, the four arms and the corridors were all made from one
 * builder. The hall replaced every one of those, and a single hand-built room does not need a
 * room *generator*; it is in git if the station ever grows arms again.
 *
 * The palette stays shared rather than re-declared per module: a second grey that is almost the
 * first grey is how a set of rooms stops reading as one building. Anything a module needs that
 * is not here — the office's wood, the bridge's emitter — is a deliberate exception and says so
 * locally.
 */
export const MATERIALS = {
  /** Hull: walls and ceilings. */
  shell: new THREE.MeshStandardMaterial({
    color: 0x232833,
    roughness: 0.78,
    metalness: 0.15,
    side: THREE.DoubleSide
  }),
  floor: new THREE.MeshStandardMaterial({
    color: 0x151920,
    roughness: 0.62,
    metalness: 0.2,
    side: THREE.DoubleSide
  }),
  /**
   * Bright structural metal: frames, rails, stringers. Deliberately not polished — polished, it
   * catches the window light in one hot spot on the frame's bottom lip, which reads as a bug
   * rather than as a highlight.
   */
  frame: new THREE.MeshStandardMaterial({ color: 0x9aa6b4, roughness: 0.5, metalness: 0.55 }),
  /** Darker structural metal, for things that should recede. */
  strut: new THREE.MeshStandardMaterial({ color: 0x39404b, roughness: 0.45, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xaad4ff,
    roughness: 0.4,
    metalness: 0,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide
  }),
  // Over 1.0 on purpose, so `UnrealBloomPass` (threshold 1.0) picks it up and nothing else does.
  led: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 1.25, 1.8) })
};
