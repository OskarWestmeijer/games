// Two-layer soundscape:
//   • NATURE bed — field recordings in public/audio/nature/, always looping (layered),
//     never muted. This is the ever-present forest/river/birdsong.
//   • MUSIC     — tracks in public/audio/music/, played as a crossfaded, looping
//     playlist *over* the bed, and toggleable with M.
//
// The track lists are discovered automatically from the folder contents at build time
// (see the audioManifest() plugin in vite.config.ts) — just drop files in the folders,
// no manifest to maintain. The audio files are git-ignored, so a deployed build (e.g.
// GitHub Pages) ships with empty lists and the game simply runs in silence.
//
// Audio is OPTIONAL: if a layer has no files it is skipped. Starts on the first user
// gesture (browser autoplay rules).

import { nature as natureFiles, music as musicFiles } from 'virtual:audio-manifest';

// Resolve against Vite's base URL so paths work both at the domain root and under a
// project sub-path like https://user.github.io/games/.
const BASE = import.meta.env.BASE_URL;
const NATURE_DIR = BASE + 'audio/nature/';
const MUSIC_DIR = BASE + 'audio/music/';
const NATURE_VOL = 0.42; // gentle ambient bed
const MUSIC_VOL = 0.5; // music sits on top
const FADE = 4; // fade-in / crossfade seconds

let started = false;
let musicMuted = false;

let natureEls: HTMLAudioElement[] = [];
let musicTracks: string[] = [];
let musicIdx = 0;
let activeMusic: HTMLAudioElement | null = null;

export async function startAudio(): Promise<void> {
  if (started) return;
  started = true;

  // --- nature bed: loop every file at once, always on ---
  natureEls = natureFiles.map((file) => {
    const a = makeAudio(NATURE_DIR + file);
    a.loop = true;
    a.play().catch(() => {});
    fadeTo(a, NATURE_VOL, FADE);
    return a;
  });
  if (natureFiles.length === 0) {
    console.info('[audio] No nature sounds in public/audio/nature/ — running silent.');
  }

  // --- music layer: crossfaded, looping playlist ---
  musicTracks = musicFiles.slice();
  if (musicTracks.length === 0) {
    console.info('[audio] No music in public/audio/music/ — running silent.');
    return;
  }
  activeMusic = makeAudio(MUSIC_DIR + musicTracks[0]);
  activeMusic.loop = musicTracks.length === 1;
  activeMusic.play().catch(() => {});
  fadeTo(activeMusic, musicMuted ? 0 : MUSIC_VOL, FADE);
  if (musicTracks.length > 1) scheduleCrossfade();
}

/** Mute/unmute the MUSIC layer only — the nature bed keeps playing. */
export function toggleMute(): boolean {
  musicMuted = !musicMuted;
  if (activeMusic) fadeTo(activeMusic, musicMuted ? 0 : MUSIC_VOL, 0.6);
  return musicMuted;
}

// ---- internals -----------------------------------------------------------
function makeAudio(url: string): HTMLAudioElement {
  const a = new Audio(url);
  a.preload = 'auto';
  a.volume = 0;
  return a;
}

/** Smoothly move an element's volume toward a target over `dur` seconds. */
function fadeTo(el: HTMLAudioElement, target: number, dur: number): void {
  const from = el.volume;
  const t0 = performance.now();
  const step = (now: number): void => {
    const k = dur <= 0 ? 1 : Math.min(1, (now - t0) / (dur * 1000));
    const v = from + (target - from) * k;
    el.volume = v < 0 ? 0 : v > 1 ? 1 : v;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** When the active music track nears its end, crossfade into the next one. */
function scheduleCrossfade(): void {
  const tick = (): void => {
    if (activeMusic && activeMusic.duration && activeMusic.currentTime > activeMusic.duration - FADE) {
      nextTrack();
    } else {
      setTimeout(tick, 500);
    }
  };
  setTimeout(tick, 500);
}

function nextTrack(): void {
  musicIdx = (musicIdx + 1) % musicTracks.length;
  const next = makeAudio(MUSIC_DIR + musicTracks[musicIdx]);
  next.play().catch(() => {});
  fadeTo(next, musicMuted ? 0 : MUSIC_VOL, FADE);

  const old = activeMusic;
  if (old) {
    fadeTo(old, 0, FADE);
    setTimeout(() => {
      old.pause();
      old.removeAttribute('src');
    }, FADE * 1000 + 250);
  }
  activeMusic = next;
  scheduleCrossfade();
}
