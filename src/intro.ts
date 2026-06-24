// Pitch-black title + chapter-1 intro, shown once at boot then dismissed for good.
// Adapted from the title-screen design handoff with two deliberate deviations (see
// CLAUDE.md's "Active build"): the chapter card stays pitch black instead of blending
// in dimmed scene art, and there's no prev/next paging — chapters only change today via
// the admin dev dropdown (see main.ts), which doesn't replay this.
import { CHAPTERS } from './chapters';

export interface IntroOverlay {
  // True until the player dismisses the chapter-1 card — gates scene.update() in
  // main.ts's frame loop so Jussi can't be walked around, off-screen, behind the
  // opaque overlay before the player has even seen the world.
  isActive: () => boolean;
}

export function createIntro(): IntroOverlay {
  const overlay = document.getElementById('intro-overlay') as HTMLDivElement;
  const titleLayer = document.getElementById('intro-title') as HTMLDivElement;
  const cardLayer = document.getElementById('intro-card') as HTMLDivElement;
  const cardRoman = document.getElementById('intro-card-roman')!;
  const cardTitle = document.getElementById('intro-card-title')!;
  const cardSeason = document.getElementById('intro-card-season')!;
  const cardBlurb = document.getElementById('intro-card-blurb')!;

  const chapter1 = CHAPTERS[0].card;
  cardRoman.textContent = `Luku ${chapter1.roman}`;
  cardTitle.textContent = chapter1.titleFi;
  cardSeason.textContent = chapter1.seasonLabel;
  cardBlurb.textContent = chapter1.blurb;

  let phase: 'title' | 'card' | 'done' = 'title';

  function advance(): void {
    if (phase === 'title') {
      phase = 'card';
      titleLayer.classList.remove('intro-shown');
      cardLayer.classList.add('intro-shown');
    } else if (phase === 'card') {
      phase = 'done';
      overlay.classList.add('intro-dismissed');
      window.removeEventListener('keydown', onKeydown);
      overlay.removeEventListener('click', advance);
      overlay.addEventListener('transitionend', () => overlay.style.setProperty('display', 'none'), {
        once: true,
      });
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      advance();
    }
  }

  window.addEventListener('keydown', onKeydown);
  overlay.addEventListener('click', advance);

  return { isActive: () => phase !== 'done' };
}
