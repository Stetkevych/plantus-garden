#!/usr/bin/env bash
# Run the game locally. ES modules need a real HTTP server; opening index.html
# straight from the filesystem will fail on CORS.
set -euo pipefail
PORT="${1:-8080}"
cd "$(dirname "${BASH_SOURCE[0]}")"
echo "Plantus Garden running at http://localhost:${PORT}"
echo "Ctrl-C to stop."
python3 -m http.server "$PORT" --bind 127.0.0.1
