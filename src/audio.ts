/**
 * The pod's sound: a station room-tone bed with sparse ambient music over it.
 *
 * **Nothing plays until somebody asks for it.** There is no autoplay and no HUD mute button —
 * the radio on the desk is the switch (`pod/radio.ts`), reached through `interaction.ts`. That
 * is what "off by default" means here, and it is taken literally: no `src` is assigned and no
 * byte is fetched until `setOn(true)`.
 *
 * **Files are discovered with `import.meta.glob`, not a Vite plugin.** The retired game used a
 * `virtual:audio-manifest` plugin that scanned `public/audio/` and handed back bare filenames
 * for the client to prefix with `BASE_URL`. A glob does better with none of it: Vite emits
 * each file to `dist/assets/` with a content hash and rewrites the URL against `base: './'`,
 * so the deployed `/games/` sub-path works without anyone reassembling a path by hand.
 *
 * Empty folders are a supported state. No files means `setOn()` is a no-op and the room stays
 * quiet — the build never depends on a binary being present.
 */

/** Every file in `audio/bed/` plays at once and loops forever: the hull, always the same. */
const BED = Object.values(
  import.meta.glob('./audio/bed/*.mp3', { eager: true, query: '?url', import: 'default' })
) as string[];

/** `audio/music/` is a playlist, shuffled once per session and crossfaded end to end. */
const MUSIC = Object.values(
  import.meta.glob('./audio/music/*.mp3', { eager: true, query: '?url', import: 'default' })
) as string[];

/**
 * Both layers sit well under 1. The window is the thing in this room; the music is furniture,
 * and a bed you can consciously hear is a bed that is too loud. The bed is quieter than the
 * music on purpose — it should register as the room not being dead rather than as a sound.
 */
const BED_VOL = 0.25;
const MUSIC_VOL = 0.35;

/** Seconds. Doubles as the crossfade length and as how far before the end the next one starts. */
const FADE = 4;

/**
 * Seconds. The radio going off is a deliberate "make it stop" gesture, not a scene transition
 * — it should read as an immediate mute, not a lingering fade-out to match the fade-in.
 */
const FADE_OUT = 0.6;

/** Seconds between playhead checks. Sixty times a second would be pointless for a 4s window. */
const CHECK_INTERVAL = 0.25;

export interface AudioOptions {
  bedVolume?: number;
  musicVolume?: number;
}

export interface PodAudio {
  /**
   * Whether there is anything to play at all. False when both folders are empty, which is a
   * supported state — `planet-view.ts` reads it to leave the radio out of the interaction
   * targets rather than offering a prompt for a switch that would do nothing.
   */
  available: boolean;
  /** The radio switch. Fades both layers in or out; safe to call before anything has loaded. */
  setOn(on: boolean): void;
  isOn(): boolean;
  /**
   * The *view's* start/stop, not the player's. Leaving the pod fades the sound out and pauses
   * it without forgetting where the radio was left, so coming back resumes mid-track rather
   * than restarting the playlist.
   */
  setEnabled(enabled: boolean): void;
  /**
   * Retries `play()` on whatever should be audible right now. The radio starts on by default,
   * which means `setOn(true)` fires before any user gesture has happened — autoplay is blocked,
   * `play()` rejects and is swallowed, and the elements sit there paused with their volume
   * still ramping. Call this from the first click/keydown/tap the page sees to pick it back up.
   * A no-op once the browser is already letting audio play.
   */
  resume(): void;
  /**
   * Advances the playlist. Called from the render loop rather than a `setInterval`: the old
   * implementation polled every 500 ms for the lifetime of the page even with the view parked,
   * and driving it from `dt` means it stops exactly when the view does, for free.
   */
  update(dt: number): void;
  dispose(): void;
}

/**
 * Fade generations, so two overlapping ramps on one element don't fight over `volume`. The
 * newer fade bumps the counter and the older one sees it and stops on its next frame.
 *
 * `requestAnimationFrame` rather than the render loop's `dt`, deliberately: the most important
 * fade is the one on the way *out*, and by then the render loop has already been stopped.
 */
const fadeGen = new WeakMap<HTMLAudioElement, number>();

function fadeTo(el: HTMLAudioElement, target: number, dur: number): void {
  const gen = (fadeGen.get(el) ?? 0) + 1;
  fadeGen.set(el, gen);
  const from = el.volume;
  const t0 = performance.now();
  const step = (now: number): void => {
    if (fadeGen.get(el) !== gen) return; // superseded by a newer fade
    const k = dur <= 0 ? 1 : Math.min(1, (now - t0) / (dur * 1000));
    const v = from + (target - from) * k;
    el.volume = v < 0 ? 0 : v > 1 ? 1 : v;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Fisher-Yates. The playlist order is per-session, so a second visit isn't the same evening. */
function shuffled(urls: string[]): string[] {
  const out = [...urls];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createPodAudio(options: AudioOptions = {}): PodAudio {
  const bedVolume = options.bedVolume ?? BED_VOL;
  const musicVolume = options.musicVolume ?? MUSIC_VOL;

  let on = false;
  let enabled = false;
  let loaded = false;
  let sinceCheck = 0;

  let bed: HTMLAudioElement[] = [];
  const playlist = shuffled(MUSIC);
  let trackIdx = 0;
  let music: HTMLAudioElement | null = null;
  /** Elements fading out behind a crossfade, retired once they reach silence. */
  const retiring = new Set<HTMLAudioElement>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const silent = () => BED.length === 0 && MUSIC.length === 0;

  function makeAudio(url: string): HTMLAudioElement {
    const el = new Audio();
    el.preload = 'auto';
    el.volume = 0; // everything arrives from silence
    el.src = url;
    return el;
  }

  /** First `setOn(true)` — and only then — is when any of this is actually fetched. */
  function load(): void {
    if (loaded) return;
    loaded = true;
    bed = BED.map((url) => {
      const el = makeAudio(url);
      el.loop = true;
      return el;
    });
    if (playlist.length > 0) {
      music = makeAudio(playlist[0]);
      // A single track has nothing to cross into, so it loops itself; a playlist is advanced
      // by `update()` instead, which is what gives the crossfade something to overlap.
      music.loop = playlist.length === 1;
    }
  }

  /** `play()` rejects on an autoplay block, which is a normal outcome here, not an error. */
  function play(el: HTMLAudioElement): void {
    void el.play().catch(() => {});
  }

  function after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  /** Should sound be coming out right now? Both switches have to agree. */
  const audible = () => on && enabled;

  function apply(): void {
    if (!loaded) return;
    const dur = audible() ? FADE : FADE_OUT;
    for (const el of bed) {
      if (audible()) play(el);
      fadeTo(el, audible() ? bedVolume : 0, dur);
    }
    if (music) {
      if (audible()) play(music);
      fadeTo(music, audible() ? musicVolume : 0, dur);
    }
    if (!audible()) {
      // Pause only once the ramp has finished, or the fade is a cut. Captured by value: a
      // re-enable inside the window starts a fresh fade, and the guard below sees it.
      after(dur * 1000 + 250, () => {
        if (audible()) return;
        for (const el of bed) el.pause();
        music?.pause();
      });
    }
  }

  function retire(el: HTMLAudioElement): void {
    retiring.add(el);
    fadeTo(el, 0, FADE);
    after(FADE * 1000 + 250, () => {
      el.pause();
      el.removeAttribute('src');
      el.load(); // drops the decoded buffer; without it the element holds it until GC
      retiring.delete(el);
    });
  }

  function nextTrack(): void {
    const previous = music;
    trackIdx = (trackIdx + 1) % playlist.length;
    music = makeAudio(playlist[trackIdx]);
    play(music);
    fadeTo(music, musicVolume, FADE);
    if (previous) retire(previous);
  }

  return {
    available: !silent(),

    setOn(next: boolean) {
      if (next === on || silent()) return;
      on = next;
      if (on) load();
      apply();
    },

    isOn: () => on,

    setEnabled(next: boolean) {
      if (next === enabled) return;
      enabled = next;
      apply();
    },

    resume() {
      if (!audible()) return;
      for (const el of bed) if (el.paused) play(el);
      if (music?.paused) play(music);
    },

    update(dt: number) {
      if (!audible() || !music || playlist.length < 2) return;
      sinceCheck += dt;
      if (sinceCheck < CHECK_INTERVAL) return;
      sinceCheck = 0;
      // `duration` is NaN until the metadata lands, which is exactly the case this must not
      // act on — NaN fails the comparison, so no guard is needed beyond the truthiness check.
      if (music.duration && music.currentTime > music.duration - FADE) nextTrack();
    },

    dispose() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const el of [...bed, ...retiring, ...(music ? [music] : [])]) {
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
      bed = [];
      retiring.clear();
      music = null;
      on = false;
      enabled = false;
    }
  };
}
