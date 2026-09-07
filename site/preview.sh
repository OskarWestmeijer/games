#!/usr/bin/env bash
#
# Previews the *assembled* Pages site locally — the menu plus every game, each in its folder,
# served under a /games/ prefix exactly as GitHub Pages serves it.
#
#   ./site/preview.sh              build everything, then serve
#   ./site/preview.sh --no-build   reuse the last build (fast, for editing site/index.html)
#   ./site/preview.sh --port 9000  serve somewhere else
#
# `npm run dev` inside a game folder is still the right tool for working *on* a game. This is for
# the thing dev mode cannot show you: whether the site holds together once the games are built and
# nested one folder deep. Two failures only appear here —
#
#   1. a root-absolute path (`/assets/…`, `fetch('/…')`) that works at a domain root and 404s
#      under /games/<game>/, which is why every game sets `base: './'`;
#   2. a broken link between the menu and a game.
#
# The list of games is read out of .github/workflows/deploy.yml rather than repeated here, so this
# preview cannot drift from what actually gets deployed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT=8099
BUILD=1
while [ $# -gt 0 ]; do
  case "$1" in
    --no-build) BUILD=0; shift ;;
    --port) PORT="$2"; shift 2 ;;
    # Everything from line 2 up to the first line that is not a comment, so the help text stays
    # correct however the header grows.
    -h|--help) sed -n '2,/^[^#]/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

command -v python3 >/dev/null || { echo "needs python3 for the static server" >&2; exit 1; }

# Checked up front, because python's http.server answers a taken port with a bare traceback —
# and worse, a *previous* run of this script left on that port will happily serve stale files
# while looking like it worked.
if python3 -c "import socket,sys; s=socket.socket(); sys.exit(0 if s.connect_ex(('127.0.0.1',$PORT))==0 else 1)"; then
  echo "port $PORT is already in use — stop whatever is on it, or pass --port <n>" >&2
  exit 1
fi

# The single source of truth is the workflow's GAMES variable.
GAMES="$(sed -n 's/^  GAMES:[[:space:]]*//p' .github/workflows/deploy.yml)"
[ -n "$GAMES" ] || { echo "could not read GAMES from .github/workflows/deploy.yml" >&2; exit 1; }
echo "games: $GAMES"

if [ "$BUILD" -eq 1 ]; then
  for game in $GAMES; do
    echo "--- building $game"
    ( cd "$game" && npm run build >/dev/null )
  done
else
  for game in $GAMES; do
    [ -d "$game/dist" ] || { echo "$game/dist is missing — run without --no-build" >&2; exit 1; }
  done
fi

# Assembled exactly as the workflow does it. `cp -r <dir>/.` copies the contents, not the
# directory — without the trailing `/.` each game would land at /games/<game>/dist/.
rm -rf _site _serve
mkdir -p _site
cp site/index.html _site/
for game in $GAMES; do
  mkdir -p "_site/$game"
  cp -r "$game/dist/." "_site/$game/"
done

# _site/ is what gets uploaded; _serve/ only exists to put it one level down, so that the URLs
# below match the deployed ones character for character.
mkdir -p _serve/games
cp -r _site/. _serve/games/

echo
echo "  http://localhost:$PORT/games/"
for game in $GAMES; do echo "  http://localhost:$PORT/games/$game/"; done
echo
echo "Ctrl-C to stop."
exec python3 -m http.server "$PORT" --directory _serve
