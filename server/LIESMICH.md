# KMF Spiele – Spielstand-Server

Speichert die Spielstände aller KMF-Spiele zentral, damit Handy, iPad und Computer
denselben Stand haben. Anmeldung nur mit Namen, kein Passwort.

## Wo er läuft
- Synology (Fahrschule): `/volume1/docker/spiele-server/`
- Container: `spiele-server` (Port 8095 → intern 3000) + `tailscale-spiele`
- Öffentlich: **https://spiele.tail06709a.ts.net**
- Spielstände: `/volume1/docker/spiele-server/data/spielstaende.json`
  (alle 6 Stunden zusätzlich `spielstaende.sicherung.json`)

## Starten / Aktualisieren
Ein Copy-Paste-Befehl im Terminal (fragt nach dem Synology-Passwort):

```
ssh -t -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i ~/.ssh/id_ed25519 marco@data-kmf "cd /volume1/docker/spiele-server && sudo /usr/local/bin/docker compose up -d --build"
```

## Wenn Tailscale meckert
Der `TS_AUTHKEY` in `.env` wird nur beim allerersten Start gebraucht. Ist er
abgelaufen, in der Tailscale-Verwaltung einen neuen Auth-Key erzeugen, in `.env`
eintragen und den Befehl oben nochmals ausführen.

## Schnittstelle
Alle Aufrufe brauchen `?k=<ZUGANG>` (steht in `.env` und in `spiele/kmf-cloud.js`).

| Weg | Zweck |
|---|---|
| `GET /api/status` | läuft der Server? (ohne Schlüssel) |
| `GET /api/spieler` | Liste aller Spieler samt Rekorden |
| `POST /api/spieler` | Spieler anmelden/anlegen `{name}` |
| `GET /api/stand?spieler=X` | Spielstand holen |
| `POST /api/stand` | Spielstand speichern `{spieler, keys}` |
| `GET /api/bestenliste` | Rangliste über alle Spieler und Spiele |

Beim Speichern gewinnt immer der **neuere Zeitstempel**, deshalb überschreibt ein
altes Gerät keinen frischen Stand.

## Neues Spiel anschliessen
1. Im `<head>` des Spiels `<script src="../kmf-cloud.js"></script>` einfügen – fertig,
   der Spielstand wird ab sofort abgeglichen.
2. Damit es in der Bestenliste auftaucht: in `server.js` bei `REKORDE` einen Eintrag
   ergänzen, der aus den localStorage-Schlüsseln des Spiels die Punktzahl liest.
