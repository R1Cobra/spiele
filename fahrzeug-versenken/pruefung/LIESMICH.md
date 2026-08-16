# Fahrzeug versenken – automatische Prüfung

```bash
node pruefung/test-spiel.js
```

Läuft ohne Browser (Fake-DOM) und prüft in wenigen Sekunden:

1. **Aufstellung** – auf allen drei Parkplatzgrössen (8×8, 10×10, 12×12) und mit
   beiden Abstands-Regeln je 400 Zufalls-Aufstellungen: klappt sie immer, und
   hält sie die Regeln ein?
2. **Die Lücken-Regel** – direkt daneben parkieren ist mit «Lücke nötig»
   verboten, ohne die Regel erlaubt; überlappen bleibt immer verboten.
3. **Spielablauf** – 12 komplette Spiele je Grösse × Regel × Stufe: keines darf
   hängen bleiben. Die Durchschnitte zeigen auch gleich, ob die Einstellungen
   wirklich etwas ändern (ohne Lücke braucht der Computer deutlich länger).
4. **Stufen** – Normal muss Einfach schlagen, Profi muss Normal schlagen.
5. **Zeichnungen** – jedes der fünf Fahrzeuge kommt waagrecht und senkrecht
   sauber heraus (gültiges SVG, richtige Box, kein `undefined`/`NaN`).

Der Test endet mit `FEHLER: 0`, sonst ist der Rückgabewert 1.

Im Browser gibt es zusätzlich den eingebauten Kurztest mit `?test=1` in der
Adresszeile.

## Der Fuhrpark
| Fahrzeug | Felder |
|---|---|
| 🚛 LKW mit Anhänger | 5 |
| 🚗 Auto mit Anhänger | 4 |
| 🚐 Lieferwagen | 3 |
| 🚗 Auto | 3 |
| 🚲 Fahrrad | 2 |

Zusammen 17 Felder – die klassische Verteilung 5/4/3/3/2, damit das Spiel fair
und lösbar bleibt. Wer die Liste ändert, muss den Test neu laufen lassen
(auf 8×8 wird es sonst schnell unmöglich, alles unterzubringen).

Die Fahrzeuge werden als **ein SVG über mehrere Felder** gelegt (CSS-Grid-Spanne),
darum sehen sie wie Fahrzeuge aus und nicht wie aneinandergereihte Kästchen.
Gezeichnet wird immer «nach rechts fahrend»; senkrecht wird dieselbe Zeichnung
gedreht (`rotate(90) translate(0,-100)`).
