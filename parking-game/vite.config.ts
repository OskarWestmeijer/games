import { defineConfig } from 'vite';

export default defineConfig({
  // Relative, so the build works wherever it is served from — GitHub Pages puts this repo
  // under a /games/ sub-path rather than at a domain root.
  base: './',
  // Nothing here is a static asset. The whole game is drawn on a canvas from code: no models,
  // no textures, no audio, no fonts. `false` says that on purpose rather than leaving Vite
  // looking for a `public/` that will never exist.
  publicDir: false,
  server: { open: false }
});
