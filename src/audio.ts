/**
 * The station's sound, in two layers with two different owners.
 *
 * **The bed is the room, and it is not optional.** Every file in `audio/bed/` comes up with
 * the view and stays up: a pressurised hull hums whether or not anybody fancies listening to
 * it, and that hum is most of what makes the place feel inhabited rather than rendered.
 *
 * **The music is the radio's, and it starts off.** The playlist in `audio/music/` plays only
 * once somebody walks to the desk and switches the unit on (`station/office/radio.ts`, reached
 * through `interaction.ts`). Switching it off leaves the hum running — the radio is a radio,
 * not a mute button for the station.
 *
 * That split is also the download policy, and it is taken literally: no `src` is assigned and
 * no byte fetched for a layer until that layer is wanted. A visitor who never touches the
 * radio pays for the bed and nothing else.
 *
 * **Files are discovered with `import.meta.glob`, not a Vite plugin.** The retired game used a
 * `virtual:audio-manifest` plugin that scanned `public/audio/` and handed back bare filenames
 * for the client to prefix with `BASE_URL`. A glob does better with none of it: Vite emits
 * each file to `dist/assets/` with a content hash and rewrites the URL against `base: './'`,
 * so the deployed `/games/` sub-path works without anyone reassembling a path by hand.
 *
 * Empty folders are a supported state. No bed means silence on arrival, no music means the
 * radio is never offered as something to look at — the build never depends on a binary
 * being present.
 */

/** Every file in `audio/bed/` plays at once and repeats forever: the hull, always the same. */
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
   * Whether the radio has anything to play. False when `audio/music/` is empty, which is a
   * supported state — `station/index.ts` reads it to leave the radio out of the interaction
   * targets rather than offering a prompt for a switch that would do nothing. The bed is not
   * part of this: it is not the radio's, and it plays whether or not there is any music.
   */
  available: boolean;
  /** The radio switch. Fades the music in or out; safe to call before anything has loaded. */
  setOn(on: boolean): void;
  isOn(): boolean;
  /**
   * The *view's* start/stop, and the bed's switch. Entering the station brings the hum up;
   * leaving fades both layers out and pauses them without forgetting where the radio was left,
   * so coming back resumes mid-track rather than restarting the playlist.
   */
  setEnabled(enabled: boolean): void;
  /**
   * Retries `play()` on whatever should be audible right now. The bed comes up with the view,
   * which means it starts before any user gesture has happened — autoplay is blocked, `play()`
   * rejects and is swallowed, and the elements sit there paused with their volume still
   * ramping. Call this from the first click/keydown/tap the page sees to pick it back up.
   * A no-op once the browser is already letting audio play.
   */
  resume(): void;
  /**
   * Advances the playlist and repeats the bed. Called from the render loop rather than a
   * `setInterval`: the old implementation polled every 500 ms for the lifetime of the page
   * even with the view parked, and driving it from `dt` means it stops exactly when the view
   * does, for free.
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

/** A bed layer keeps its url, because repeating it means building the element again. */
interface BedTrack {
  url: string;
  el: HTMLAudioElement;
}

export function createPodAudio(options: AudioOptions = {}): PodAudio {
  const bedVolume = options.bedVolume ?? BED_VOL;
  const musicVolume = options.musicVolume ?? MUSIC_VOL;

  let on = false;
  let enabled = false;
  let bedLoaded = false;
  let musicLoaded = false;
  let sinceCheck = 0;

  let bed: BedTrack[] = [];
  const playlist = shuffled(MUSIC);
  let trackIdx = 0;
  let music: HTMLAudioElement | null = null;
  /** Elements fading out behind a crossfade, retired once they reach silence. */
  const retiring = new Set<HTMLAudioElement>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  /** The hull hums whenever you are aboard; the radio has nothing to do with it. */
  const bedAudible = () => enabled;
  /** The music needs the radio on *and* somebody in the room to hear it. */
  const musicAudible = () => on && enabled;

  function makeAudio(url: string): HTMLAudioElement {
    const el = new Audio();
    el.preload = 'auto';
    el.volume = 0; // everything arrives from silence
    el.src = url;
    return el;
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

  /** Fades an outgoing element down and lets go of its buffer once it is inaudible. */
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

  /** Starts `url` at `volume` and crossfades whatever it replaces out underneath it. */
  function crossTo(url: string, previous: HTMLAudioElement | null, volume: number): HTMLAudioElement {
    const el = makeAudio(url);
    play(el);
    fadeTo(el, volume, FADE);
    if (previous) retire(previous);
    return el;
  }

  /**
   * The bed is deliberately *not* `loop = true`. An MP3 carries encoder padding at both ends,
   * so `loop` inserts a short silence every time round — a tick every couple of minutes,
   * forever. Repeating it as a crossfade into a second element hides that, and covers a
   * source whose own loop point isn't perfect either.
   */
  function repeatBed(track: BedTrack): void {
    track.el = crossTo(track.url, track.el, bedVolume);
  }

  /** First `setEnabled(true)` — and only then — is when the bed is actually fetched. */
  function loadBed(): void {
    if (bedLoaded) return;
    bedLoaded = true;
    bed = BED.map((url) => ({ url, el: makeAudio(url) }));
  }

  /** Likewise the music, on the first `setOn(true)`: the radio is what pays for the playlist. */
  function loadMusic(): void {
    if (musicLoaded) return;
    musicLoaded = true;
    if (playlist.length > 0) {
      music = makeAudio(playlist[0]);
      // A single track has nothing to cross into, so it loops itself; a playlist is advanced
      // by `update()` instead, which is what gives the crossfade something to overlap.
      music.loop = playlist.length === 1;
    }
  }

  function applyBed(): void {
    if (!bedLoaded) return;
    const dur = bedAudible() ? FADE : FADE_OUT;
    for (const { el } of bed) {
      if (bedAudible()) play(el);
      fadeTo(el, bedAudible() ? bedVolume : 0, dur);
    }
    if (!bedAudible()) {
      // Pause only once the ramp has finished. A re-enable inside that window starts a fresh
      // fade, and the guard below sees it.
      after(dur * 1000 + 250, () => {
        if (bedAudible()) return;
        for (const { el } of bed) el.pause();
      });
    }
  }

  function applyMusic(): void {
    if (!musicLoaded || !music) return;
    const el = music;
    const dur = musicAudible() ? FADE : FADE_OUT;
    if (musicAudible()) play(el);
    fadeTo(el, musicAudible() ? musicVolume : 0, dur);
    if (!musicAudible()) {
      after(dur * 1000 + 250, () => {
        if (musicAudible()) return;
        el.pause();
      });
    }
  }

  return {
    available: MUSIC.length > 0,

    setOn(next: boolean) {
      if (next === on || MUSIC.length === 0) return;
      on = next;
      if (on) loadMusic();
      applyMusic();
    },

    isOn: () => on,

    setEnabled(next: boolean) {
      if (next === enabled) return;
      enabled = next;
      if (enabled) loadBed();
      applyBed();
      applyMusic();
    },

    resume() {
      if (bedAudible()) for (const { el } of bed) if (el.paused) play(el);
      if (musicAudible() && music?.paused) play(music);
    },

    update(dt: number) {
      if (!enabled) return;
      sinceCheck += dt;
      if (sinceCheck < CHECK_INTERVAL) return;
      sinceCheck = 0;
      // `duration` is NaN until the metadata lands, which is exactly the case this must not
      // act on — NaN fails the comparison, so no guard is needed beyond the truthiness check.
      const spent = (el: HTMLAudioElement) => !!el.duration && el.currentTime > el.duration - FADE;
      for (const track of bed) if (spent(track.el)) repeatBed(track);
      if (musicAudible() && music && playlist.length > 1 && spent(music)) {
        trackIdx = (trackIdx + 1) % playlist.length;
        music = crossTo(playlist[trackIdx], music, musicVolume);
      }
    },

    dispose() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const el of [...bed.map((t) => t.el), ...retiring, ...(music ? [music] : [])]) {
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
