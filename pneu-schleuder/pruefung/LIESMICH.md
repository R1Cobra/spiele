# Pneu-Schleuder – automatische Prüfung der 500 Levels

Diese vier Skripte prüfen die Levels, ohne dass man sie von Hand durchspielen muss.
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

Einmalig vorbereiten (nur für die Physik-Prüfungen nötig):

```bash
npm install matter-js
```

## 1. Struktur – dauert Sekunden

```bash
node pruefung/test-levels.js
```

Prüft alle 500 Levels: Hat jedes Level mindestens einen Blitzer? Steht nichts
ausserhalb der Welt oder in der Schleuder? Genug Pneus? Kommt in einer Welt kein
Bauplan doppelt vor und jeder Bauplan im ganzen Spiel oft genug?
Ist jedes Level reproduzierbar (Level 99 überall gleich)?

Es gibt 48 Baupläne, aber nur 25 Levels pro Welt – jede Welt spielt also eine
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
node pruefung/test-roboter.js alle     # alle 500 Levels (etwa 5 Minuten)
```

Spielt die Levels tatsächlich durch: Pro Pneu probiert er 70 Schüsse
und nimmt den besten. Spezialfähigkeiten nutzt er nicht – ein Mensch kann also
mehr. Schafft der Roboter ein Level nicht, heisst das nicht automatisch
«unmöglich», aber es lohnt sich, hinzuschauen.

Der Roboter kennt auch die Regel «aus dem Bild geflogen = zerstört», sonst
meldet er Levels als unlösbar, die man in Wirklichkeit längst gewonnen hat.

Richtwert bei dieser Version (48 Baupläne, 5 Zielarten): **126 von 126**
(Stichprobe) und **500 von 500** (`alle`).

## 4. Grafik – dauert etwa eine Minute

```bash
node pruefung/test-grafik.js
```

Zeichnet jedes Bauteil aus allen 500 Levels einmal auf ein Schein-Canvas.
Findet Tippfehler in der Zeichen-Routine, ohne das Spiel zu öffnen. Es sollten
alle 17 Arten vorkommen und 0 Fehler gemeldet werden.

## Reichweite der Schleuder

Der Auszug ist auf 150 px begrenzt (`MAX_DRAG` in `index.html`), das ergibt
Tempo 27.75. Damit fliegt ein Pneu bei vollem Zug bis ans linke Weltende
(erster Aufprall etwa bei x = 40). Blitzer können also überall stehen, auch
ganz hinten links bei x = 160.

Vorher (Auszug 130, Tempo 24.05) war bei x = 360 Schluss. Ziele weiter links
– zum Beispiel im Bauplan «Weitschuss» oder der hohe Blitzer in Level 9 –
waren dann nur über Kettenreaktionen oder gar nicht zu erwischen.
**Wer den Auszug ändert, muss danach alle drei Prüfungen laufen lassen.**

## Wenn etwas gemeldet wird
Die Levels entstehen aus den Bauplänen in `index.html` (Abschnitt `PLANS`).
Häufigste Ursachen:
- Teil zu weit links → Position im Bauplan begrenzen
- Level stürzt von selbst ein → Bauteile überlappen sich; Höhen nachrechnen
  (ein Kistenstapel ist `n × 56` hoch, nicht die gewünschte Höhe)
- Roboter schafft es nicht → mehr Pneus geben oder das Ziel freier stellen
- Neues Bauteil zeichnet nicht → fehlt der `else if (p.kind === '…')`-Zweig in
  `drawPart`? Der Grafik-Test zeigt, welche Arten er gesehen hat.
