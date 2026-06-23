// The year's chapters — see "Chapters" in CLAUDE.md. Not yet wired to gameplay/days;
// for now a chapter only picks which seasonal scene art is shown (see scenes.ts'
// `seasonal` lookup) and shows its own description in the UI.
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// The exact in-world copy for a chapter's pitch-black intro card (see intro.ts) — a
// separate, Finnish-language sibling to the flat fields below, which stay English for
// the dev-only admin panel. Verbatim from the title/chapter-intro design handoff.
export interface ChapterCard {
  roman: string; // 'I'..'V' — shown as "Luku {roman}"
  titleFi: string; // Finnish chapter title, e.g. 'Kevätkylvö'
  seasonLabel: string; // Finnish season label shown on the card — more specific than
  // `season` below (e.g. chapter 2's 'Keskikesä' / chapter 3's 'Loppukesä' both fall
  // under `season: 'summer'`), so it can't just be derived from that enum.
  blurb: string;
}

export interface Chapter {
  id: number;
  title: string;
  season: Season;
  months: string; // Finnish agricultural year, roughly when the chapter takes place
  description: string;
  card: ChapterCard;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: 'Spring Sowing',
    season: 'spring',
    months: 'Huhti–toukokuu (April–May)',
    description:
      'A new year begins. The farm awakens after winter: fields are prepared and seed grain is sown. Introduces the household, the buildings, and the landscape.',
    card: {
      roman: 'I',
      titleFi: 'Kevätkylvö',
      seasonLabel: 'Kevät',
      blurb:
        'Vuosi alkaa alusta. Tila herää talven jälkeen: pellot muokataan ja siemenvilja kylvetään multaan.',
    },
  },
  {
    id: 2,
    title: 'Juhannus',
    season: 'summer',
    months: 'Kesäkuu (June)',
    description:
      'Community and nature. The growing season is underway; focus shifts to midsummer traditions, folk beliefs, fishing, and gathering.',
    card: {
      roman: 'II',
      titleFi: 'Juhannus',
      seasonLabel: 'Keskikesä',
      blurb:
        'Kasvukausi on käynnissä. Katse kääntyy juhannustaikoihin, kansanuskoon, kalastukseen ja yhteisön elämään.',
    },
  },
  {
    id: 3,
    title: 'Harvest',
    season: 'autumn',
    months: 'Elokuu (August)',
    description:
      "The year's outcome. Crops are harvested and brought in from the fields — the single most important period of the farming year.",
    card: {
      roman: 'III',
      titleFi: 'Sato',
      seasonLabel: 'Loppukesä',
      blurb:
        'Vuoden tärkein hetki. Vilja korjataan pelloilta ja kannetaan talteen ennen syksyn sateita.',
    },
  },
  {
    id: 4,
    title: 'Riihi and Kekri',
    season: 'autumn',
    months: 'Syys–marraskuu (September–November)',
    description:
      'Preservation and celebration. Grain is dried in the riihi and stored for winter. Ends with Kekri: traditions, feasting, and reflection on the completed harvest.',
    card: {
      roman: 'IV',
      titleFi: 'Riihi ja Kekri',
      seasonLabel: 'Syksy',
      blurb:
        'Vilja kuivataan riihessä ja varastoidaan talveksi. Kekri päättää työvuoden juhlaan ja muisteluun.',
    },
  },
  {
    id: 5,
    title: 'Winter',
    season: 'winter',
    months: 'Joulu–maaliskuu (December–March)',
    description:
      'Survival and preparation. Forestry work, livestock care, household crafts, and storytelling fill the cold season. Ends as preparations for the next spring begin again.',
    card: {
      roman: 'V',
      titleFi: 'Talvi',
      seasonLabel: 'Talvi',
      blurb:
        'Selviytymistä ja valmistautumista. Metsätöitä, karjanhoitoa ja tarinointia pakkasen keskellä.',
    },
  },
];
