# Pneu-Schleuder – automatische Prüfung der 500 Levels

Diese drei Skripte prüfen die Levels, ohne dass man sie von Hand durchspielen muss.
**Nach jeder Änderung an den Bauplänen laufen lassen.**

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

Es gibt 40 Baupläne, aber nur 25 Levels pro Welt – jede Welt spielt also eine
andere Auswahl davon. Darum fühlt sich keine Welt gleich an wie die vorige.

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

Richtwert bei dieser Version (40 Baupläne): **126 von 126** (Stichprobe) und
**500 von 500** (`alle`).

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
