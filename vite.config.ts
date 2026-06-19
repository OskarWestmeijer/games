import { defineConfig, type Plugin } from 'vite';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Discover the soundscape dynamically from the folder contents, so you never have to
// maintain a tracks.json by hand. The actual audio files are git-ignored, so in CI /
// on GitHub Pages these scans come back empty and the game simply runs without sound.
const AUDIO_EXT = /\.(mp3|ogg|m4a|wav)$/i;
function listAudio(sub: string): string[] {
  try {
    return readdirSync(join('public', 'audio', sub))
      .filter((f) => AUDIO_EXT.test(f))
      .sort();
  } catch {
    return []; // folder absent (e.g. nothing committed) -> that layer is silent
  }
}

/** Exposes `virtual:audio-manifest` with the files currently in public/audio/. */
function audioManifest(): Plugin {
  const virtualId = 'virtual:audio-manifest';
  const resolvedId = '\0' + virtualId;
  return {
    name: 'audio-manifest',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      const nature = listAudio('nature');
      const music = listAudio('music');
      return `export const nature = ${JSON.stringify(nature)};\nexport const music = ${JSON.stringify(music)};\n`;
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [audioManifest()],
  server: { open: false }
});
