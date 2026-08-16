#!/bin/sh
# ---------------------------------------------------------------------------
# Kopiert Spiele aus diesem Ordner in die KMF-App (public/spiele/).
#
#   sh ~/spiele/in-kmf-app-kopieren.sh
#
# Zwei Dinge werden dabei automatisch angepasst, sonst ist es die gleiche Datei:
#
#  1) «kmf-cloud.js» wird herausgenommen.
#     Grund: In der App liegt das Spiel auf derselben Adresse wie die App
#     selbst. Der gemeinsame Spielstand würde sonst auch App-Daten aus dem
#     Browser-Speicher an den Spiele-Server schicken. In der App wird der
#     Punktestand darum nur auf dem Gerät gespeichert – wie beim Tetris.
#
#  2) Der Knopf «🎮 Spiele» (zurück zur Spiele-Startseite) wird zu einem
#     normalen Zurück-Knopf. Die Spiele-Startseite gibt es in der App nicht.
#
# Danach die App wie gewohnt auf der Synology neu bauen.
# ---------------------------------------------------------------------------
set -e

QUELLE="$HOME/spiele"
ZIEL="$HOME/Documents/GitHub/KMF-App-/public/spiele"
SPIELE="pneu-schleuder parkplatz-chaos"

[ -d "$ZIEL" ] || { echo "KMF-App nicht gefunden: $ZIEL"; exit 1; }

# gemeinsame Dateien (Logo, Physik-Bibliothek)
cp "$QUELLE/kmf-logo.jpg"   "$ZIEL/kmf-logo.jpg"
cp "$QUELLE/matter.min.js"  "$ZIEL/matter.min.js"
echo "gemeinsame Dateien kopiert (kmf-logo.jpg, matter.min.js)"

for SPIEL in $SPIELE; do
  [ -f "$QUELLE/$SPIEL/index.html" ] || { echo "fehlt: $QUELLE/$SPIEL/index.html"; exit 1; }
  mkdir -p "$ZIEL/$SPIEL"
  QUELLE="$QUELLE" ZIEL="$ZIEL" SPIEL="$SPIEL" python3 - <<'PY'
import os, re
q, z, spiel = os.environ["QUELLE"], os.environ["ZIEL"], os.environ["SPIEL"]
s = open(os.path.join(q, spiel, "index.html"), encoding="utf-8").read()

vorher = s
s = re.sub(r'[ \t]*<script src="\.\./kmf-cloud\.js"></script>\n?', "", s)
if s == vorher:
    print("  ! " + spiel + ": kmf-cloud.js war nicht drin (schon entfernt?)")

vorher = s
s = re.sub(
    r'<a href="\.\./" class="kmf-back"[^>]*>.*?</a>',
    '<a href="/portal" class="kmf-back" aria-label="Zurück"'
    ' onclick="if(history.length>1){history.back();return false}">↩ Zurück</a>',
    s, count=1)
if s == vorher:
    print("  ! " + spiel + ": Zurück-Knopf nicht gefunden")

open(os.path.join(z, spiel, "index.html"), "w", encoding="utf-8").write(s)
print("  " + spiel + " kopiert (" + str(len(s) // 1024) + " KB)")
PY
done

echo ""
echo "Fertig. Die Spiele liegen jetzt unter:"
echo "  $ZIEL/"
echo "Erreichbar in der App unter /spiele/<name>/index.html"
