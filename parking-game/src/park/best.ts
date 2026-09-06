/**
 * What survives a reload.
 *
 * This is the only persistence anywhere in the repo — the texture-quality switch is explicitly
 * *not* persisted, and nothing else has ever had a reason to be — so it establishes the
 * convention rather than following one:
 *
 * - **One versioned key.** A shape change bumps the version and the old record is ignored rather
 *   than migrated; there has never been anything here worth a migration. It is on `v3` now: `v1`
 *   held a best run *score* from the points era, and `v2` held a furthest *level* from the
 *   endless era. Neither means anything under a fixed five-round session.
 * - **Every access in a `try/catch`.** `localStorage` is not merely empty in a private window on
 *   some browsers, it *throws* on the property access itself, and a game that cannot start
 *   because it could not read a high score is a worse game than one with no high score.
 * - **A missing or malformed record is the same as no record.** Nothing here is trusted; it is a
 *   number a player could have typed into a console anyway.
 *
 * Both fields are now leaderboard-shaped, which they were not before. Every player runs the same
 * five bays in the same order, so `bestTotal` — the lowest total distance off centre across a
 * whole session — is a single number that means the same thing for everyone, and `bestRounds` is
 * the same fact split per round. There is no server and no network call here; a comparison
 * feature would send exactly these.
 */

const KEY = 'park.v3';

export interface ParkRecord {
  /** Lowest total distance off centre for a completed session. Lower is better. */
  bestTotal: number | null;
  /** round index -> lowest score on that round. */
  bestRounds: Record<number, number>;
}

const empty = (): ParkRecord => ({ bestTotal: null, bestRounds: {} });

function read(): ParkRecord {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<ParkRecord>;
    const total = Number(parsed.bestTotal);
    return {
      bestTotal: Number.isFinite(total) ? total : null,
      bestRounds:
        parsed.bestRounds && typeof parsed.bestRounds === 'object' ? parsed.bestRounds : {}
    };
  } catch {
    return empty();
  }
}

export function createBest() {
  // Read once at construction. The view is the only writer, so nothing else can make this stale,
  // and a read per frame for the header would be a JSON parse per frame.
  const record = read();

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(record));
    } catch {
      // A full or refused store is not worth telling the player about — the session still counts,
      // it just will not be there tomorrow.
    }
  }

  return {
    /** The session total to beat, or null before anyone has finished one. */
    get total() {
      return record.bestTotal;
    },

    /** The score to beat on one round, or null the first time it is played. */
    roundBest: (round: number): number | null => record.bestRounds[round] ?? null,

    /** Called once per round. Returns whether this was a personal best on it. */
    noteRound(round: number, score: number): boolean {
      const prior = record.bestRounds[round];
      if (prior !== undefined && score >= prior) return false;
      record.bestRounds[round] = score;
      save();
      return true;
    },

    /** Called once when a session finishes. Returns whether it was a new best. */
    noteSession(total: number): boolean {
      if (record.bestTotal !== null && total >= record.bestTotal) return false;
      record.bestTotal = total;
      save();
      return true;
    }
  };
}

export type Best = ReturnType<typeof createBest>;
