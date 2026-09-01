import * as THREE from 'three';

/**
 * "Look at a thing, press E." One raycast a frame from the centre of the screen against a
 * short list of objects, a prompt that appears when one of them is in the middle of the view,
 * and a key (or a tap) that acts on it.
 *
 * **Why this is not part of `fpv-controls.ts`.** That module is a *controller*: it moves a
 * camera inside an injected `Box3` and has no idea what scene it is in, which is exactly what
 * makes it reusable for the EVA mode in CLAUDE.md's roadmap. Interaction is about the room's
 * contents. Folding it in would couple the walking code to the furniture, and to a DOM element
 * it was never handed.
 */

/** Always the middle of the viewport — the crosshair is drawn there and nowhere else. */
const SCREEN_CENTER = new THREE.Vector2(0, 0);

export interface InteractionTarget {
  /**
   * What the ray is tested against. An invisible box a little larger than the visible thing is
   * usually right — `THREE.Raycaster` ignores `visible`, and this is an aiming aid, not physics.
   */
  object: THREE.Object3D;
  /** Metres. Past this the target is ignored even when it is dead centre in the view. */
  reach: number;
  /**
   * What the prompt says can be done, e.g. "switch the radio on". A function when the verb depends
   * on the target's own state — a switch reads "switch the radio on" or "off" without ever
   * ceasing to be the same target, and a plain string would leave the prompt showing whichever
   * half it happened to be on when you first looked at it.
   */
  label: string | (() => string);
  activate(): void;
}

export interface InteractionOptions {
  /**
   * The prompt element — injected, never queried for, the same discipline as the joystick in
   * `fpv-controls.ts`. If it is a `<button>` a tap on it activates the live target, which is
   * how this works on a tablet: there is no E key there.
   */
  prompt?: HTMLElement | null;
  /**
   * Seconds between being enabled and being able to activate anything. Without it a key still
   * held from the click that got you here, or a fast second click, bounces you straight back
   * out of the room you have just entered.
   */
  armDelay?: number;
}

export interface Interactions {
  /**
   * **Call this after the render, not before.** `Raycaster.setFromCamera` reads
   * `camera.matrixWorld` and does not update it, and this camera is a child of an orbiting rig
   * that moves every frame — so before the render it would be tested against a world matrix one
   * frame stale, from a position several kilometres away. Rendering has just refreshed every
   * world matrix; a prompt that appears one frame late is invisible.
   */
  update(dt: number): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export function createInteractions(
  camera: THREE.Camera,
  targets: InteractionTarget[],
  options: InteractionOptions = {}
): Interactions {
  const { prompt = null, armDelay = 1 } = options;

  const raycaster = new THREE.Raycaster();
  let live: InteractionTarget | null = null;
  /** What the prompt is currently showing, so a label that changes under a live target is seen. */
  let shown: string | null = null;
  let enabled = false;
  let armed = 0;

  /**
   * Keyed on the rendered *text*, not on the target: a target whose label is a function can
   * change what it says while staying live, and comparing targets alone would miss that.
   */
  function setLive(next: InteractionTarget | null) {
    live = next;
    const label = next === null ? null : typeof next.label === 'function' ? next.label() : next.label;
    if (label === shown) return;
    shown = label;
    if (!prompt) return;
    prompt.hidden = label === null;
    // The prompt supplies its own "Press E to" / "Tap to" halves through the existing
    // `.fine-only` / `.coarse-only` media-query idiom; only the verb comes from here.
    if (label !== null) {
      prompt
        .querySelectorAll<HTMLElement>('[data-interact-label]')
        .forEach((slot) => (slot.textContent = label));
    }
  }

  function activate() {
    if (live && armed <= 0) live.activate();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (enabled && event.code === 'KeyE') activate();
  }

  function onPromptClick(event: Event) {
    event.preventDefault();
    if (enabled) activate();
  }

  window.addEventListener('keydown', onKeyDown);
  prompt?.addEventListener('click', onPromptClick);

  function update(dt: number) {
    if (!enabled) return;
    if (armed > 0) armed -= dt;

    raycaster.setFromCamera(SCREEN_CENTER, camera);

    for (const target of targets) {
      // Per-target, so "close enough to touch" is the ray's own job rather than a distance
      // comparison afterwards.
      raycaster.far = target.reach;
      if (raycaster.intersectObject(target.object, true).length > 0) {
        setLive(target);
        return;
      }
    }
    setLive(null);
  }

  function setEnabled(next: boolean) {
    if (next === enabled) return;
    enabled = next;
    if (enabled) {
      armed = armDelay;
    } else {
      setLive(null);
    }
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    prompt?.removeEventListener('click', onPromptClick);
  }

  return { update, setEnabled, dispose };
}
