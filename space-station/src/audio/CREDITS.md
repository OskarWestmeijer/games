# Audio — provenance and licence

Everything in this folder must be **CC0 / public domain**, for the same reason the planet
textures are NASA's rather than Solar System Scope's (see "Planet textures — provenance and
licence" in `CLAUDE.md`): this repo is public and these files are committed, so the licence has
to permit redistribution with no strings — no attribution condition riding along forever, on
this repo or on anyone's fork.

**CC BY is not acceptable here**, however generous it looks. The credit below is courtesy and
provenance, exactly like `#planet-credit`; nothing in it is imposed on anyone.

## Files

| file | layer | title | author | source | licence |
| --- | --- | --- | --- | --- | --- |
| `station-drone.mp3` | bed | Space Station Drone | db3005 | [Freesound](https://freesound.org/people/db3005/sounds/686237/) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `001_Synthwave_4k.mp3` | music | Calm Ambient 1 (Synthwave 4k) | The Cynic Project | [OpenGameArt](https://opengameart.org/content/calm-ambient-1-synthwave-4k) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `002_Synthwave_15k.mp3` | music | Calm Ambient 2 (Synthwave 15k) | The Cynic Project | [OpenGameArt](https://opengameart.org/content/calm-ambient-2-synthwave-15k) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `003_lifeWave_2k.mp3` | music | Calm Ambient 3 (Lifewave 2k) | The Cynic Project | [OpenGameArt](https://opengameart.org/content/calm-ambient-3-lifewave-2k) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

Fill a row in per file: the `.mp3` as committed, `bed` or `music`, the original title, the
author as they credit themselves, a link to the page the file came from, and a link to the
licence deed (`https://creativecommons.org/publicdomain/zero/1.0/`). Add a "changes" note for
anything done beyond re-encoding — a trim, a loop crossfade, a level change.

`station-drone.mp3` is Freesound's own 128 kbps MP3 preview of the sound, used as-is: the
original is a WAV behind a login, the preview is public, and 128 kbps is more than a bed needs.
Both are covered by the same CC0 dedication.

## Encoding

MP3, because the iPad is a target and it is the one format every browser plays without a
fallback `<source>`. Keep the whole folder under ~4 MB: it downloads on top of the surface
maps, and only when somebody switches the radio on.

```sh
# music: stereo, 96 kbps is plenty for pads
ffmpeg -i source.wav -c:a libmp3lame -b:a 96k -ar 44100 music/ambient-1.mp3

# bed: mono is fine and halves it
ffmpeg -i hum.wav -c:a libmp3lame -b:a 80k -ac 1 -ar 44100 bed/station-hum.mp3
```

**Bed tracks do not have to loop perfectly.** `audio.ts` repeats them by crossfading each one
into a fresh element of itself rather than setting `loop` — it has to, because an MP3 carries
encoder padding and `loop` would insert a short silence every time round. That crossfade also
covers a source whose own loop point is untidy. Still prefer one that is close: the fade is
`FADE` seconds long and cannot hide a track that ends somewhere completely different from
where it began. Music tracks need not loop at all; `audio.ts` crossfades between them.

## Vetted CC0 sources

Confirmed public-domain dedications, as of September 2026:

- [Calm Ambient 1 (Synthwave 4k)](https://opengameart.org/content/calm-ambient-1-synthwave-4k)
  and [Calm Ambient 2 (Synthwave 15k)](https://opengameart.org/content/calm-ambient-2-synthwave-15k)
  — The Cynic Project, OpenGameArt, CC0. Warm pads and soft chords; the closest thing here to
  the Mass Effect register this room is after.
- [Outer Space Loop](https://opengameart.org/content/outer-space-loop) — wipics,
  OpenGameArt, CC0. Confirmed to loop seamlessly.
- [Straylight Drones](https://freemusicarchive.org/music/John_Bartmann/100-ambient-atmospheric-soundtracks-straylight-drones-collection)
  — John Bartmann, Free Music Archive, CC0 1.0. 101 tracks of four minutes plus; most lean
  thriller, so pick the warm ones.
- [Background Space Track](https://opengameart.org/content/background-space-track) — yd,
  OpenGameArt, CC0. Cold and mechanical ("my very own dead ship") — a bed candidate rather
  than music.
- [Space Station Drone](https://freesound.org/people/db3005/sounds/686237/) — db3005,
  Freesound, CC0. Two minutes of low machine drone; the bed in use.
- [Freesound, licence filtered to CC0](https://freesound.org/search/?q=spaceship+interior+hum&f=license:%22Creative+Commons+0%22)
  for the room tone. **Read the badge on the individual sound page, not the search results** —
  Freesound mixes CC0, CC BY and CC BY-NC in one list, and only the first is usable here.
