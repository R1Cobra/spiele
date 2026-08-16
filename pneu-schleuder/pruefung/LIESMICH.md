# Pneu-Schleuder – automatische Prüfung der 600 Levels

Diese sechs Skripte prüfen die Levels, ohne dass man sie von Hand durchspielen muss.
**Nach jeder Änderung an den Bauplänen laufen lassen.**

## Zielobjekte

Es gibt fünf Zielarten (Tabelle `ZIELE` in `index.html`). Alle sind **gleich gross
(46×60)** – so bleiben die Bauwerke gleich stabil, egal welche Art gewürfelt wird.
Unterschiedlich sind Aussehen, Zähigkeit und Punkte:

| Ziel | ab Welt | Leben | Punkte |
|---|---|---|---|
| 📸 Blitzer | 1 | 30 | 500 |
| 🚦 Ampel | 2 | 26 | 400 |
| 🅿️ Parkuhr | 3 | 20 | 350 |
| ⛔ Verbotstafel | 4 | 24 | 400 |
| 🛡️ Panzer-Blitzer | 6 | 78 | 1100 |

Der Panzer-Blitzer kommt höchstens **einmal pro Level** vor, nie weiter hinten als
d = 1350 (sonst unfair), und das Level bekommt dafür einen Pneu extra.

## Bauteile

| Bauteil | Leben | Besonderheit |
|---|---|---|
| Kiste / Balken | 45 / 38 | Standard-Holz |
| Stein | 120 | schwer, hält gut |
| Eis | 26 | zerspringt fast von selbst |
| Keil (Spitzdach) | 34 / 20 / 90 | Holz / Eis / Stein – rutscht seitlich weg |
| Fass | 22 | explodiert, Radius 210 |
| Steinkugel | 110 | rollt und walzt alles nieder |
| Sandsack | 55 | schwer und weich, schluckt den Schwung |
| Pneu (Hindernis) | 45 | rollt weg und federt zurück |
| Stahlträger | 220 | nur schwere Pneus knacken ihn |
| Fels / Plattform / Erdhügel | – | unzerstörbar (Gelände) |
| Sprungfeder | – | fest verschraubt, schleudert alles zurück |

Einmalig vorbereiten (nur für die Physik-Prüfungen nötig):

```bash
npm install matter-js
```

## 1. Struktur – dauert Sekunden

```bash
node pruefung/test-levels.js
```

Prüft alle 600 Levels: Hat jedes Level mindestens einen Blitzer? Steht nichts
ausserhalb der Welt oder in der Schleuder? Genug Pneus? Kommt in einer Welt kein
Bauplan doppelt vor und jeder Bauplan im ganzen Spiel oft genug?
Ist jedes Level reproduzierbar (Level 99 überall gleich)?

Es gibt 54 Baupläne, aber nur 25 Levels pro Welt – jede Welt spielt also eine
andere Auswahl davon. Darum fühlt sich keine Welt gleich an wie die vorige.
Zusätzlich wird geprüft, dass jede der fünf Zielarten wirklich vorkommt.

## 2. Standfestigkeit – etwa eine Minute

```bash
node pruefung/test-physik.js
```

Baut jedes Level mit echter Physik auf und lässt es 3 Sekunden in Ruhe.
Kein Level darf von allein einstürzen oder sich selbst einen Blitzer umwerfen.

## 3. Roboter-Spieler – etwa 80 Sekunden

```bash
node pruefung/test-roboter.js          # jedes vierte Level
node pruefung/test-roboter.js alle     # alle 600 Levels (etwa 90 Sekunden)
```

Spielt die Levels tatsächlich durch: Pro Pneu probiert er 70 Schüsse
und nimmt den besten. Spezialfähigkeiten nutzt er nicht – ein Mensch kann also
mehr. Schafft der Roboter ein Level nicht, heisst das nicht automatisch
«unmöglich», aber es lohnt sich, hinzuschauen.

Der Roboter kennt auch die Regel «aus dem Bild geflogen = zerstört», sonst
meldet er Levels als unlösbar, die man in Wirklichkeit längst gewonnen hat.

Richtwert bei dieser Version (54 Baupläne, 5 Zielarten, 24 Welten):
**151 von 151** (Stichprobe) und **600 von 600** (`alle`).

## 4. Grafik – dauert etwa eine Minute

```bash
node pruefung/test-grafik.js
```

Zeichnet jedes Bauteil aus allen 600 Levels einmal auf ein Schein-Canvas und
dazu einmal pro Welt die ganze Kulisse (Himmel, Hügel, Silhouetten, Wetter).
Findet Tippfehler in der Zeichen-Routine, ohne das Spiel zu öffnen. Es sollten
alle 21 Bauteil-Arten und alle 24 Kulissen vorkommen, bei 0 Fehlern.

**Achtung:** Der Test prüft nur, dass nichts abstürzt – ob es *schön* aussieht,
sieht man nur im Spiel.

## 5. Fairness – etwa eine Minute

```bash
node pruefung/test-fairness.js            # 3 Levels je Bauplan
node pruefung/test-fairness.js 20 587     # einzelne Levels, ausführlich
```

**Der wichtigste Test.** Der Roboter-Test sagt nur, ob ein Level *überhaupt*
lösbar ist – er hat unendlich Geduld. Ein Mensch nicht. Dieser Test misst, mit
wie vielen von vielen probierten ersten Schüssen jedes Ziel fällt.

Bewertet wird nur, was **frei steht** (nichts direkt darüber). Ziele in Bunkern
oder Türmen sind absichtlich nicht direkt erreichbar und werden übersprungen.
Erst wird grob gemessen, auffällige Ziele danach fein nachgemessen.

Grenzwerte, geeicht an einem echten Fehler: **Level 20 («Der Schacht») war mit
1.3 % bei 4 Pneus unspielbar** – ein Ziel stand im Schatten einer 300 px hohen
Felswand. Level 587 liegt bei 3.4 %, hat aber 6 Pneus und ist machbar. Darum:
mindestens **2 %** bei 5+ Pneus, **3.5 %** bei 4 oder weniger.

Wird etwas gemeldet, sind das die üblichen Hebel:
- Ziel hinter einer hohen, unzerstörbaren Wand → Ziel auf die Schleuder-Seite
  stellen oder die Wand niedriger machen
- Ziel sehr weit links → näher heranholen (in `buildLevel` gibt es dafür schon
  automatisch einen Pneu extra, wenn ein Ziel weiter links als x = 620 steht)

## 6. Tipp-Funktion – Sekunden

```bash
node pruefung/test-tipp.js
```

Prüft den Knopf «💡 Tipp», der ab drei Fehlversuchen im gleichen Level erscheint:
Ist die durchgerechnete Kopie der Lage identisch mit der echten? Findet die Suche
in verschiedenen Levels wirklich einen Treffer? Liegt der gelbe Ring innerhalb des
erlaubten Auszugs? Und – wichtig – bleibt die echte Spiellage vom Durchrechnen
unberührt?

## Reichweite der Schleuder

Der Auszug ist auf 150 px begrenzt (`MAX_DRAG` in `index.html`), das ergibt
Tempo 27.75. Damit fliegt ein Pneu bei vollem Zug bis ans linke Weltende
(erster Aufprall etwa bei x = 40). Blitzer können also überall stehen, auch
ganz hinten links bei x = 160.

Vorher (Auszug 130, Tempo 24.05) war bei x = 360 Schluss. Ziele weiter links
– zum Beispiel im Bauplan «Weitschuss» oder der hohe Blitzer in Level 9 –
waren dann nur über Kettenreaktionen oder gar nicht zu erwischen.
**Wer den Auszug ändert, muss danach alle vier Prüfungen laufen lassen.**

## Welten hinzufügen

`TOTAL_LEVELS` wird aus `WORLDS.length × LEVELS_PER_WORLD` gerechnet – eine neue
Welt in die Liste `WORLDS` einzutragen ergibt also automatisch 25 neue Levels.
Braucht die Welt eine eigene Silhouette, kommt sie in `drawSilhouettes` dazu;
für Wetter gibt es die Schalter `snow`, `ash`, `rain`, `laub`, `fog`, `night`
und `innen` (drinnen = keine Wolken).

## Wenn etwas gemeldet wird
Die Levels entstehen aus den Bauplänen in `index.html` (Abschnitt `PLANS`).
Häufigste Ursachen:
- Teil zu weit links → Position im Bauplan begrenzen
- Level stürzt von selbst ein → Bauteile überlappen sich; Höhen nachrechnen
  (ein Kistenstapel ist `n × 56` hoch, nicht die gewünschte Höhe)
- Roboter schafft es nicht → mehr Pneus geben oder das Ziel freier stellen
- Neues Bauteil zeichnet nicht → fehlt der `else if (p.kind === '…')`-Zweig in
  `drawPart`? Der Grafik-Test zeigt, welche Arten er gesehen hat.
