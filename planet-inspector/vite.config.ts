import { defineConfig } from 'vite';

/**
 * `base: './'` keeps every emitted asset path relative, so the build works from a
 * sub-path (e.g. /games/ on GitHub Pages) as well as from a domain root.
 *
 * No `publicDir`: everything this view loads — surface maps, audio — is imported from
 * TypeScript, so Vite emits it to dist/assets/ content-hashed. The AI-generated .glb
 * assets and the manifest plugin that scans them live in `asset-viewer/`.
 */
export default defineConfig({
  base: './',
  server: { open: false }
});
