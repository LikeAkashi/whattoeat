#!/usr/bin/env bash
# Copy the web app into Android assets/www (macOS / Linux / CI).
# Usage (in the dinner-app folder): bash delivery/sync-web.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dst="$root/delivery/android/app/src/main/assets/www"

rm -rf "$dst"
mkdir -p "$dst/data"
cp "$root/index.html" "$root/app.js" "$root/styles.css" "$dst/"
for f in dishes.js dishes.generated.js; do
  [ -f "$root/data/$f" ] && cp "$root/data/$f" "$dst/data/"
done

echo "synced -> $dst ($(du -sh "$dst" | cut -f1))"
