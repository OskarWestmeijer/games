import './home.css';

/**
 * The homepage stand-in's own behaviour: the EN/DE/FI switch, and nothing else.
 *
 * Deliberately free of any `three` import, so this file — and the markup it drives — stays in
 * the page's initial chunk while the whole 3D world sits behind a dynamic `import()` in
 * `main.ts`. That split is the point of the prototype: the homepage has to be up and usable
 * before a byte of the world is fetched.
 *
 * The copy is lifted verbatim from the real site's `src/routes/+page.svelte`.
 */

type Language = 'en' | 'de' | 'fi';

interface Content {
  role: string;
  lines: string[];
}

const CONTENT: Record<Language, Content> = {
  en: {
    role: 'Software Developer · Hamburg',
    lines: [
      'I work as a developer and am located in Hamburg, Germany.',
      'In my free time, I stay physically active by working out at the gym, bouldering and going for runs.',
      "I love to read and do it a lot. I'm also passionate about history, geopolitics, and maps.",
      'During vacations, I enjoy traveling and exploring history and art museums.'
    ]
  },
  de: {
    role: 'Softwareentwickler · Hamburg',
    lines: [
      'Ich arbeite als Entwickler und lebe in Hamburg.',
      'In meiner Freizeit gehe ich gerne ins Fitnessstudio, Bouldern und Joggen.',
      'Ich lese viel und interessiere mich besonders für Geschichte, Geopolitik und Karten.',
      'Im Urlaub reise ich gerne und besuche vor allem Museen für Geschichte und Kunst.'
    ]
  },
  fi: {
    role: 'Ohjelmistokehittäjä · Hampuri',
    lines: [
      'Olen kehittäjä ja asun Hampurissa.',
      'Vapaa-ajallani pysyn aktiivisena käymällä salilla, kiipeilemällä ja juoksemalla.',
      'Rakastan lukemista, ja olen erityisen kiinnostunut historiasta, geopolitiikasta ja kartoista.',
      'Lomilla matkustan usein ja käyn mieluiten taide- ja historiamuseoissa.'
    ]
  }
};

export function initHomepage(root: HTMLElement): void {
  const role = root.querySelector<HTMLParagraphElement>('.hp-role')!;
  const bio = root.querySelector<HTMLDivElement>('.hp-bio')!;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.hp-langs button'));

  function show(language: Language) {
    const content = CONTENT[language];
    role.textContent = content.role;
    bio.replaceChildren(
      ...content.lines.map((line) => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
      })
    );
    buttons.forEach((button) => button.classList.toggle('current', button.dataset.lang === language));
  }

  buttons.forEach((button) =>
    button.addEventListener('click', () => show(button.dataset.lang as Language))
  );

  show('en');
}
