// Generates a flat, numbered topdown schematic of the farm layout (not game code —
// a design mockup to review/iterate on before touching src/world.ts).
//   node design/farm-layout/generate.mjs
// Writes v5-umpipiha-topdown.svg + .html (the .html just embeds the .svg for screenshotting).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCALE = 6; // px per metre
const MARGIN = { left: 60, top: 90, right: 380, bottom: 60 };
const WORLD = { w: 145, h: 65 }; // metres — v5: shrunk again (v4 was 190x110)

const px = (x) => MARGIN.left + x * SCALE;
// y is inverted on purpose: the gate/fence should read near the bottom of the
// isometric camera (close to the viewer) with the pihapiiri receding upward
// behind it, so larger world-y (deeper into the yard) renders at the TOP and
// smaller world-y (toward the gate, fields, riihi) renders at the BOTTOM.
const py = (y) => MARGIN.top + (WORLD.h - y) * SCALE;

const SVG_W = MARGIN.left + MARGIN.right + WORLD.w * SCALE;
const SVG_H = MARGIN.top + MARGIN.bottom + WORLD.h * SCALE;

// ---- data (metres, world-space) ---------------------------------------------
// v5 — reworked per explicit feedback on v4:
//  - whole map shrunk again: gaps between riihi/lato/fields and the yard are
//    all tightened, and the world bounds shrink to fit (no more big empty
//    forest expanses — forest is "everything outside the map" anyway, so it
//    only needs a thin fringe, not a deep buffer).
//  - niitty was too big and too square: replaced with a much smaller,
//    irregular hexagon right next to the navetta.
//  - every field's forest-facing edge is now an irregular polygon (no more
//    simple 4-point quads) so they read as organic clearings, not survey plots.
//  - riihi pulled in much closer to the yard (~58m to tupa, vs v4's ~68m), with
//    the ruis field now sitting directly north of it (between riihi and the
//    yard) — riihi still only borders that field on one side; its other sides
//    stay open to forest.
//  - käymälä moved from the west side to tuck in between the navetta and the
//    niitty (their shared corner), reached by a short spur through a new gap
//    in the east fence.
//  - the gate path now runs all the way out to the south edge of the map
//    (toward the village hinted at earlier), instead of dead-ending in the
//    forest partway there.

const buildings = [
  { n: 1, fi: 'Tupa', en: 'main house', x: 60, y: 56, w: 8, h: 6 },
  { n: 2, fi: 'Aitta', en: 'storehouse (combined)', x: 46, y: 52, w: 6, h: 5 },
  { n: 3, fi: 'Navetta', en: 'cowshed', x: 70, y: 40, w: 5, h: 10 },
  { n: 4, fi: 'Savusauna', en: 'smoke sauna — edge of cluster, detached', x: 76, y: 56, w: 4, h: 4 },
  { n: 5, fi: 'Käymälä', en: 'outhouse (huussi) — tucked into the navetta/niitty corner', x: 77, y: 49, w: 2, h: 2 },
  { n: 6, fi: 'Riihi', en: 'threshing barn — close to the yard, a field directly north of it, forest on its other sides', x: 14, y: 18, w: 11, h: 6 },
  { n: 7, fi: 'Lato', en: 'hay barn — at the kaura field edge', x: 106, y: 30, w: 9, h: 5 },
];

const kaivo = { n: 8, fi: 'Kaivo', en: 'well', x: 68, y: 50, r: 0.7 };

const plots = [
  { n: 9, fi: 'Kasvimaa', en: 'vegetable garden', x: 54, y: 44, w: 10, h: 8,
    rows: ['nauris', 'kaali', 'sipuli', 'herneet', 'yrtit'] },
];

// yard (piha) perimeter: built where a building wall exists, dashed fence elsewhere.
// East wall has a gap for the käymälä side-path (navetta covers the wall above it).
const fenceSegments = [
  [[44, 62], [60, 62]], [[68, 62], [75, 62]],   // north wall, tupa fills the gap
  [[44, 40], [44, 62]],                          // west wall, no gap needed now
  [[75, 53], [75, 62]],                          // east wall, navetta fills 40-50, käymälä gap 50-53
  [[44, 40], [56, 40]], [[63, 40], [70, 40]],     // south wall, gate gap, navetta fills 70-75
];
const gate = { x: 56, y: 40, w: 7 };
const sideGate = { x: 75, y: 50, h: 3 };

const fields = [
  { fi: 'Pelto — ruis (rye)', pts: [[6, 26], [20, 22], [24, 24], [38, 30], [34, 46], [16, 50], [4, 38]] },
  { fi: 'Pelto — kaura (oats)', pts: [[84, 38], [96, 41], [104, 26], [96, 16], [88, 18], [80, 24]], label: [92, 30] },
  { fi: 'Nauris', pts: [[58, 30], [66, 33], [74, 32], [72, 18], [62, 15], [58, 20]] },
  { fi: 'Pelto — ohra (barley)', pts: [[110, 26], [124, 28], [138, 20], [134, 4], [120, 0], [106, 14]] },
];

// pasture tucked into the navetta/käymälä corner — small and irregular, not a
// big square paddock.
const niitty = { fi: 'Niitty — kesälaidun (navetalta)', pts: [[82, 46], [94, 42], [103, 48], [100, 58], [88, 60], [80, 52]], label: [91, 51] };

// lähde/puro dropped from this map per feedback — the stream was cutting
// through the rye field; it lives elsewhere off-map, not a concern here.

// gate → south edge of the map (the road to the village mentioned earlier),
// with a fork to the riihi. Routed through the open corridor east of the
// riihi and south of the ruis field (not through any crop rows) — riihi
// sits north of its fork, ruis sits north of riihi, so all three read
// clearly stacked in the isometric camera instead of overlapping.
// A separate short spur leads from the east-wall gap to the käymälä.
const paths = [
  [[56, 40], [50, 34], [40, 26], [30, 18], [28, 0]],
  [[40, 26], [32, 22], [26, 20]],
  [[75, 51], [78, 51]],
];

// ---- svg helpers -------------------------------------------------------------

const ptsToAttr = (pts) => pts.map(([x, y]) => `${px(x)},${py(y)}`).join(' ');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

let svg = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" font-family="Georgia, serif">`);
svg.push(`<rect width="${SVG_W}" height="${SVG_H}" fill="#f5f0e6"/>`);

svg.push(`<text x="${MARGIN.left}" y="34" font-size="22" fill="#3a2f25" font-weight="bold">Umpipiha — farm layout, v5 (topdown schematic)</text>`);
svg.push(`<text x="${MARGIN.left}" y="56" font-size="13" fill="#6b5d4a">Smaller map, irregular field/niitty edges; käymälä by the navetta/niitty corner; gate path reaches the map edge.</text>`);

// forest — the default backdrop; fields/yard/pasture are clearings cut into it
svg.push(`<rect x="${px(0)}" y="${py(WORLD.h)}" width="${WORLD.w * SCALE}" height="${WORLD.h * SCALE}" fill="#9fb08a"/>`);

// fields
for (const f of fields) {
  svg.push(`<polygon points="${ptsToAttr(f.pts)}" fill="#dce8c8" stroke="#7c8f63" stroke-width="1.5"/>`);
  const [cx, cy] = f.label || [
    f.pts.reduce((s, p) => s + p[0], 0) / f.pts.length,
    f.pts.reduce((s, p) => s + p[1], 0) / f.pts.length,
  ];
  svg.push(`<text x="${px(cx)}" y="${py(cy)}" font-size="11" fill="#5a6b46" text-anchor="middle">${f.fi}</text>`);
}

// pasture (niitty)
svg.push(`<polygon points="${ptsToAttr(niitty.pts)}" fill="#e3edd2" stroke="#9aab83" stroke-width="1.5"/>`);
{
  const [cx, cy] = niitty.label;
  svg.push(`<text x="${px(cx)}" y="${py(cy)}" font-size="11" fill="#5a6b46" text-anchor="middle">${niitty.fi}</text>`);
}

// paths — light casing under a dashed line so they stay legible crossing fields
for (const p of paths) {
  svg.push(`<polyline points="${ptsToAttr(p)}" fill="none" stroke="#efe6d3" stroke-width="6" stroke-linecap="round"/>`);
  svg.push(`<polyline points="${ptsToAttr(p)}" fill="none" stroke="#8a6a44" stroke-width="2" stroke-dasharray="2 5"/>`);
}

// fences
for (const [a, b] of fenceSegments) {
  svg.push(`<line x1="${px(a[0])}" y1="${py(a[1])}" x2="${px(b[0])}" y2="${py(b[1])}" stroke="#5a4632" stroke-width="2" stroke-dasharray="4 3"/>`);
}
svg.push(`<text x="${px(gate.x + gate.w / 2)}" y="${py(gate.y) + 16}" font-size="10" fill="#5a4632" text-anchor="middle">portti</text>`);

// plots (kasvimaa)
for (const p of plots) {
  svg.push(`<rect x="${px(p.x)}" y="${py(p.y + p.h)}" width="${p.w * SCALE}" height="${p.h * SCALE}" fill="#ddeec0" stroke="#5a4632" stroke-width="1.5" stroke-dasharray="3 2"/>`);
  if (p.rows) {
    for (let i = 1; i < p.rows.length; i++) {
      const rx = px(p.x) + (i * p.w * SCALE) / p.rows.length;
      svg.push(`<line x1="${rx}" y1="${py(p.y + p.h) + 4}" x2="${rx}" y2="${py(p.y + p.h) + p.h * SCALE - 4}" stroke="#7c8f63" stroke-width="1"/>`);
    }
  }
  svg.push(`<text x="${px(p.x) + 4}" y="${py(p.y + p.h) + 14}" font-size="11" fill="#3a2f25" font-weight="bold">${p.n}</text>`);
}

// buildings
for (const b of buildings) {
  svg.push(`<rect x="${px(b.x)}" y="${py(b.y + b.h)}" width="${b.w * SCALE}" height="${b.h * SCALE}" fill="#e8dcc0" stroke="#3a2f25" stroke-width="2"/>`);
  svg.push(`<text x="${px(b.x) + b.w * SCALE / 2}" y="${py(b.y + b.h / 2) + 5}" font-size="14" fill="#3a2f25" font-weight="bold" text-anchor="middle">${b.n}</text>`);
}

// well
svg.push(`<circle cx="${px(kaivo.x)}" cy="${py(kaivo.y)}" r="${kaivo.r * SCALE}" fill="#cfe3ea" stroke="#3a2f25" stroke-width="2"/>`);
svg.push(`<text x="${px(kaivo.x)}" y="${py(kaivo.y) + 4}" font-size="10" fill="#3a2f25" text-anchor="middle">${kaivo.n}</text>`);

// ---- distance call-outs, so the hierarchy from the spec is checkable at a glance ----

const tupaCenter = [buildings[0].x + buildings[0].w / 2, buildings[0].y + buildings[0].h / 2];
const riihiB = buildings.find((b) => b.fi === 'Riihi');
const riihiCenter = [riihiB.x + riihiB.w / 2, riihiB.y + riihiB.h / 2];
const riihiDist = Math.round(dist(tupaCenter, riihiCenter));
svg.push(`<text x="${px(20)}" y="${py(8)}" font-size="10" fill="#8a3b2a" text-anchor="middle" font-style="italic">~${riihiDist} m to tupa</text>`);

// gate-to-nearest-field gap (gate sits at y=40; the nearest field edge — nauris — at y≈33)
const gapX = 66, gateY = gate.y, fieldY = 33;
svg.push(`<line x1="${px(gapX)}" y1="${py(gateY)}" x2="${px(gapX)}" y2="${py(fieldY)}" stroke="#8a3b2a" stroke-width="1.5"/>`);
svg.push(`<line x1="${px(gapX) - 4}" y1="${py(gateY)}" x2="${px(gapX) + 4}" y2="${py(gateY)}" stroke="#8a3b2a" stroke-width="1.5"/>`);
svg.push(`<line x1="${px(gapX) - 4}" y1="${py(fieldY)}" x2="${px(gapX) + 4}" y2="${py(fieldY)}" stroke="#8a3b2a" stroke-width="1.5"/>`);
svg.push(`<text x="${px(gapX) + 8}" y="${py((gateY + fieldY) / 2) + 4}" font-size="10" fill="#8a3b2a" font-style="italic">~${Math.round(gateY - fieldY)} m gap</text>`);

// core-cluster width call-out (aitta to käymälä, the widest span of the tight cluster)
const clusterY = 50;
svg.push(`<line x1="${px(46)}" y1="${py(clusterY)}" x2="${px(79)}" y2="${py(clusterY)}" stroke="#8a3b2a" stroke-width="1.5"/>`);
svg.push(`<line x1="${px(46)}" y1="${py(clusterY) - 4}" x2="${px(46)}" y2="${py(clusterY) + 4}" stroke="#8a3b2a" stroke-width="1.5"/>`);
svg.push(`<line x1="${px(79)}" y1="${py(clusterY) - 4}" x2="${px(79)}" y2="${py(clusterY) + 4}" stroke="#8a3b2a" stroke-width="1.5"/>`);
svg.push(`<text x="${px(62)}" y="${py(clusterY) - 6}" font-size="10" fill="#8a3b2a" text-anchor="middle" font-style="italic">~33 m core cluster</text>`);

// orientation note (no compass — this view is staged for the isometric camera,
// not true north): fence/gate near the bottom (close to camera), pihapiiri
// receding upward (background) behind it.
svg.push(`<text x="${MARGIN.left}" y="${py(WORLD.h) - 10}" font-size="11" fill="#6b5d4a" font-style="italic">↑ background / further away</text>`);
svg.push(`<text x="${MARGIN.left}" y="${py(0) + 20}" font-size="11" fill="#6b5d4a" font-style="italic">↓ foreground — camera / player approaches from here</text>`);
const sbX = MARGIN.left, sbY = SVG_H - MARGIN.bottom + 25;
svg.push(`<line x1="${sbX}" y1="${sbY}" x2="${sbX + 20 * SCALE}" y2="${sbY}" stroke="#3a2f25" stroke-width="2"/>`);
svg.push(`<line x1="${sbX}" y1="${sbY - 5}" x2="${sbX}" y2="${sbY + 5}" stroke="#3a2f25" stroke-width="2"/>`);
svg.push(`<line x1="${sbX + 20 * SCALE}" y1="${sbY - 5}" x2="${sbX + 20 * SCALE}" y2="${sbY + 5}" stroke="#3a2f25" stroke-width="2"/>`);
svg.push(`<text x="${sbX + 10 * SCALE}" y="${sbY + 18}" font-size="11" fill="#3a2f25" text-anchor="middle">20 m</text>`);

// ---- legend, with colour swatches -------------------------------------------

const legendX = SVG_W - MARGIN.right + 20;
let ly = MARGIN.top + 10;

function swatchRect(y, fill, stroke, dash) {
  svg.push(`<rect x="${legendX}" y="${y - 11}" width="16" height="12" fill="${fill}" stroke="${stroke || '#3a2f25'}" stroke-width="1" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`);
}
function swatchLine(y, stroke, dash, width = 2) {
  svg.push(`<line x1="${legendX}" y1="${y - 5}" x2="${legendX + 16}" y2="${y - 5}" stroke="${stroke}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`);
}
function legendText(y, text) {
  svg.push(`<text x="${legendX + 24}" y="${y}" font-size="11.5" fill="#3a2f25">${text}</text>`);
}

svg.push(`<text x="${legendX}" y="${ly}" font-size="14" fill="#3a2f25" font-weight="bold">Legend</text>`);
ly += 24;

const allNumbered = [
  ...buildings.map((b) => ({ fill: '#e8dcc0', text: `${b.n}. ${b.fi} — ${b.en}${b.w ? ` — ${b.w}×${b.h} m` : ''}` })),
  { fill: '#cfe3ea', text: `${kaivo.n}. ${kaivo.fi} — ${kaivo.en}` },
  ...plots.map((p) => ({ fill: '#ddeec0', dash: '3 2', text: `${p.n}. ${p.fi} — ${p.en} — ${p.w}×${p.h} m` })),
];
for (const row of allNumbered) {
  swatchRect(ly, row.fill, '#3a2f25', row.dash);
  legendText(ly, row.text);
  ly += 18;
}

ly += 12;
svg.push(`<text x="${legendX}" y="${ly}" font-size="12" fill="#3a2f25" font-weight="bold">Terrain</text>`);
ly += 20;

swatchRect(ly, '#dce8c8', '#7c8f63'); legendText(ly, 'Pellot — fields (rye/barley/oats/turnip)'); ly += 18;
swatchRect(ly, '#e3edd2', '#9aab83'); legendText(ly, 'Niitty — meadow / summer pasture'); ly += 18;
swatchRect(ly, '#9fb08a', '#9fb08a'); legendText(ly, 'Metsä — forest (koivu/mänty/kuusi)'); ly += 18;
swatchLine(ly, '#5a4632', '4 3'); legendText(ly, 'Puuaita — fence (dashed)'); ly += 18;
swatchLine(ly, '#8a6a44', '2 5'); legendText(ly, 'Polku — path (dashed, light casing)'); ly += 18;
swatchLine(ly, '#8a3b2a', null, 1.5); legendText(ly, 'Distance call-out (this iteration only)'); ly += 18;

svg.push(`</svg>`);
const svgStr = svg.join('\n');

writeFileSync(join(__dirname, 'v5-umpipiha-topdown.svg'), svgStr);
writeFileSync(
  join(__dirname, 'v5-umpipiha-topdown.html'),
  `<!doctype html><html><body style="margin:0">${svgStr}</body></html>`
);
console.log(`wrote v5-umpipiha-topdown.svg/.html (${SVG_W}x${SVG_H}px)`);
