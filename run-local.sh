#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/public"
echo "Serving on http://localhost:8002 (in prod this same content lives under /rekap)"
exec python3 -m http.server 8002
