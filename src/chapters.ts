// The year's chapters — see "Chapters" in CLAUDE.md. Not yet wired to gameplay/days;
// for now a chapter only picks which seasonal scene art is shown (see scenes.ts'
// `seasonal` lookup) and shows its own description in the UI.
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface Chapter {
  id: number;
  title: string;
  season: Season;
  months: string; // Finnish agricultural year, roughly when the chapter takes place
  description: string;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: 'Spring Sowing',
    season: 'spring',
    months: 'Huhti–toukokuu (April–May)',
    description:
      'A new year begins. The farm awakens after winter: fields are prepared and seed grain is sown. Introduces the household, the buildings, and the landscape.',
  },
  {
    id: 2,
    title: 'Juhannus',
    season: 'summer',
    months: 'Kesäkuu (June)',
    description:
      'Community and nature. The growing season is underway; focus shifts to midsummer traditions, folk beliefs, fishing, and gathering.',
  },
  {
    id: 3,
    title: 'Harvest',
    season: 'autumn',
    months: 'Elokuu (August)',
    description:
      "The year's outcome. Crops are harvested and brought in from the fields — the single most important period of the farming year.",
  },
  {
    id: 4,
    title: 'Riihi and Kekri',
    season: 'autumn',
    months: 'Syys–marraskuu (September–November)',
    description:
      'Preservation and celebration. Grain is dried in the riihi and stored for winter. Ends with Kekri: traditions, feasting, and reflection on the completed harvest.',
  },
  {
    id: 5,
    title: 'Winter',
    season: 'winter',
    months: 'Joulu–maaliskuu (December–March)',
    description:
      'Survival and preparation. Forestry work, livestock care, household crafts, and storytelling fill the cold season. Ends as preparations for the next spring begin again.',
  },
];
