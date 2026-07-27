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
ausserhalb der Welt oder in der Schleuder? Genug Pneus? Spielt jede Welt jeden
Bauplan genau einmal? Ist jedes Level reproduzierbar (Level 99 überall gleich)?

## 2. Standfestigkeit – etwa eine Minute

```bash
node pruefung/test-physik.js
```

Baut jedes Level mit echter Physik auf und lässt es 3 Sekunden in Ruhe.
Kein Level darf von allein einstürzen oder sich selbst einen Blitzer umwerfen.

## 3. Roboter-Spieler – etwa 20 Sekunden

```bash
node pruefung/test-roboter.js
```

Spielt jedes vierte Level tatsächlich durch: Pro Pneu probiert er 70 Schüsse
und nimmt den besten. Spezialfähigkeiten nutzt er nicht – ein Mensch kann also
mehr. Schafft der Roboter ein Level nicht, heisst das nicht automatisch
«unmöglich», aber es lohnt sich, hinzuschauen.

Richtwert beim Bau dieser Version: **122 von 126 gelöst**.

## Wenn etwas gemeldet wird
Die Levels entstehen aus den Bauplänen in `index.html` (Abschnitt `PLANS`).
Häufigste Ursachen:
- Teil zu weit links → Position im Bauplan begrenzen
- Level stürzt von selbst ein → Bauteile überlappen sich; Höhen nachrechnen
  (ein Kistenstapel ist `n × 56` hoch, nicht die gewünschte Höhe)
- Roboter schafft es nicht → mehr Pneus geben oder das Ziel freier stellen
