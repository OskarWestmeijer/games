// The player can be one of these — picked via the character dropdown in the UI.
// Jussi was the only one with art at first; this shape exists so a second character
// (Miina) is just another entry, not a rework of scenes.ts.
import jussiUrl from '../assets/jussi-sprite-sheet.png';
import miinaUrl from '../assets/miina-sprite-sheet.svg';

export interface Character {
  id: string;
  label: string;
  spriteUrl: string;
  // Sprite sheet layout — see the comment above SCENES in scenes.ts for what the
  // rows/frames mean; jussi-sprite-sheet.png is a 4x4 sheet, each cell 180x280.
  cellW: number;
  cellH: number;
  frameCount: number;
  rows: { front: number; back: number; walkLeft: number; walkRight: number };
  // Rendered height relative to FIGURE_H in scenes.ts. Cells share one grid size for
  // layout convenience, but the art inside doesn't have to fill it the same way for
  // every character — Miina's cat needs to read as cat-sized next to Jussi, not
  // human-sized. Omit for "fills FIGURE_H like Jussi does".
  heightScale?: number;
}

export const CHARACTERS: Character[] = [
  {
    id: 'jussi',
    label: 'Jussi',
    spriteUrl: jussiUrl,
    cellW: 180,
    cellH: 280,
    frameCount: 4,
    rows: { front: 0, back: 1, walkLeft: 2, walkRight: 3 },
  },
  {
    id: 'miina',
    label: 'Miina (kissa)',
    spriteUrl: miinaUrl,
    cellW: 180,
    cellH: 280,
    // miina-sprite-sheet.svg's row 3 (walk-left) is only 3 real walk frames — its 4th
    // cell is a "sleep" pose, not a walk frame — so both directions are capped at 3 to
    // stay in sync (row 2/walk-right's 4th frame goes unused, but that's harmless).
    frameCount: 3,
    // Row 0 (idle-0..3) is a front-on idle loop, frame 0 a plain neutral pose — same
    // convention as Jussi's FRONT_FRAME. Row 1 (paw-up/yawn/alert/look-up) is unused
    // flavour idle art for now; `back` just points at it since nothing reads it yet.
    rows: { front: 0, back: 1, walkLeft: 3, walkRight: 2 },
    heightScale: 0.35,
  },
];
