import { defineConfig, type Plugin } from 'vite';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const ASSET_ROOT = 'ai-assets';

interface ModelEntry {
  /** Site-root-relative URL (encoded), e.g. "/tripo3d/rock%20with%20moss...glb". */
  url: string;
  /** Human-readable name derived from the filename. */
  name: string;
  /** Source folder under ai-assets/ (e.g. "meshy", "tripo3d"). */
  source: string;
  /** Site-root-relative URL of a best-effort matching thumbnail, if any. */
  thumbnail: string | null;
  /** Size of the .glb file itself, in bytes. */
  sizeBytes: number;
}

/**
 * Scans ai-assets/<source>/ for .glb files and pairs each with a thumbnail: a .png in
 * the same folder whose filename starts with the .glb's own basename (case-insensitive)
 * — e.g. "rock with moss 3d model.glb" matches "rock with moss 3d model-0.png". This is
 * the reliable path: name a preview image after its model and it's guaranteed to be
 * picked up correctly, however many models/thumbnails share a folder.
 *
 * Filesystem mtimes were considered as a fallback pairing signal (files from the same
 * export land within moments of each other) but git doesn't preserve mtimes across a
 * clone, so that heuristic would silently stop working the moment this repo is checked
 * out fresh — a build-time manifest can't rely on it. When no name match exists (e.g.
 * a folder with exactly one model and one arbitrarily-named png), each glb instead
 * falls back to the folder's unclaimed PNGs round-robin, in filename order — a
 * best-effort guess, not a guaranteed match; rename the PNG to match the model's
 * basename if that guess is ever wrong.
 */
function scanModels(): ModelEntry[] {
  const entries: ModelEntry[] = [];
  let root: string[];
  try {
    root = readdirSync(ASSET_ROOT);
  } catch {
    return []; // ai-assets/ absent -> empty gallery, page still loads
  }

  for (const source of root) {
    const dir = join(ASSET_ROOT, source);
    if (!statSync(dir).isDirectory()) continue;

    const files = readdirSync(dir);
    const glbs = files.filter((f) => extname(f).toLowerCase() === '.glb').sort();
    const pngs = files.filter((f) => extname(f).toLowerCase() === '.png').sort();
    const unclaimedPngs = [...pngs]; // round-robin fallback pool, drained as names match

    glbs.forEach((glb) => {
      const glbBase = basename(glb, extname(glb)).toLowerCase();
      const name = basename(glb, extname(glb))
        .replace(/[_-]+/g, ' ')
        .replace(/\s+\d{6,}.*$/, '') // strip trailing id/timestamp blobs
        .trim();

      const matched = pngs.filter((png) => basename(png, extname(png)).toLowerCase().startsWith(glbBase));
      const thumbnail = matched.length > 0 ? matched[0] : (unclaimedPngs.shift() ?? null);

      entries.push({
        url: `/${encodeURIComponent(source)}/${encodeURIComponent(glb)}`,
        name: name || glb,
        source,
        thumbnail: thumbnail ? `/${encodeURIComponent(source)}/${encodeURIComponent(thumbnail)}` : null,
        sizeBytes: statSync(join(dir, glb)).size
      });
    });
  }

  return entries;
}

/** Exposes `virtual:model-manifest` with the .glb files currently in ai-assets/. */
function modelManifest(): Plugin {
  const virtualId = 'virtual:model-manifest';
  const resolvedId = '\0' + virtualId;
  return {
    name: 'model-manifest',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      const models = scanModels();
      return `export const models = ${JSON.stringify(models)};\n`;
    }
  };
}

export default defineConfig({
  base: './',
  publicDir: ASSET_ROOT,
  plugins: [modelManifest()],
  server: { open: false }
});
