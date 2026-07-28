/*
 * KMF Spiele – Spielstand-Server
 * ------------------------------
 * Speichert die Spielstände aller KMF-Spiele zentral, damit man auf Handy,
 * iPad und Computer denselben Stand hat. Anmeldung nur mit Namen (kein Passwort).
 *
 * Bewusst OHNE fremde Pakete geschrieben (kein npm install nötig) und mit einer
 * einfachen JSON-Datei als Speicher – für eine Familie ist das mehr als genug
 * und es kann beim Aktualisieren nichts kaputtgehen.
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATEI = path.join(DATA_DIR, "spielstaende.json");
const SICHERUNG = path.join(DATA_DIR, "spielstaende.sicherung.json");
const ZUGANG = process.env.ZUGANG || "kmf-spiele";      // einfacher Riegel gegen Fremde

const MAX_SPIELER = 200, MAX_NAME = 20, MAX_WERT = 300 * 1024, MAX_KEYS = 400;

// ---------------------------------------------------------------- Speicher
let db = { spieler: {} };
try {
  db = JSON.parse(fs.readFileSync(DATEI, "utf8"));
  if (!db || typeof db !== "object" || !db.spieler) db = { spieler: {} };
} catch (e) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e2) {}
}
let schreibTimer = null, letzteSicherung = 0;
function sichern() {
  clearTimeout(schreibTimer);
  schreibTimer = setTimeout(() => {
    try {
      const text = JSON.stringify(db);
      const tmp = DATEI + ".tmp";
      fs.writeFileSync(tmp, text);
      fs.renameSync(tmp, DATEI);                        // atomar: nie eine halbe Datei
      if (Date.now() - letzteSicherung > 6 * 3600e3) {  // alle 6 Stunden eine Kopie
        fs.writeFileSync(SICHERUNG, text);
        letzteSicherung = Date.now();
      }
    } catch (e) { console.error("Speichern fehlgeschlagen:", e.message); }
  }, 400);
}

// ------------------------------------------------- Rekorde je Spiel ablesen
// Zentral hier gepflegt – so muss kein Spiel dafür angefasst werden.
const zahl = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const jsonOf = v => { try { return JSON.parse(v); } catch (e) { return null; } };
const REKORDE = [
  { spiel: "Pneu-Schleuder", icon: "🛞", einheit: "Punkte", lies(k) {
      const d = jsonOf(k["ps_data"]); if (!d || !d.players) return null;
      let p = 0, s = 0, lvl = 0;
      for (const n in d.players) {                      // alle Profile dieses Geräts zusammen
        const sp = d.players[n];
        for (const x in (sp.best || {})) p += zahl(sp.best[x]);
        for (const x in (sp.stars || {})) s += zahl(sp.stars[x]);
        lvl = Math.max(lvl, zahl(sp.unlocked) + 1);
      }
      return p ? { wert: p, zusatz: "⭐ " + s + " · Level " + lvl } : null;
    }},
  { spiel: "Berg-Racer", icon: "🏔️", einheit: "Sterne", lies(k) {
      const st = zahl(k["bergracer-stars"]), c = zahl(k["bergracer-coins"]);
      return st || c ? { wert: st, zusatz: "🪙 " + c } : null;
    }},
  { spiel: "Fahrzeug-Tetris", icon: "🧩", einheit: "Punkte", lies: k =>
      zahl(k["kmf_tetris_best"]) ? { wert: zahl(k["kmf_tetris_best"]) } : null },
  { spiel: "Block Blast", icon: "🧱", einheit: "Punkte", lies: k =>
      zahl(k["kmfBlockBlast.best"]) ? { wert: zahl(k["kmfBlockBlast.best"]) } : null },
  { spiel: "Loch-Sauger", icon: "🕳️", einheit: "Punkte", lies: k =>
      zahl(k["kmfLochSauger.best"]) ? { wert: zahl(k["kmfLochSauger.best"]) } : null },
  { spiel: "KMF-Werkstatt", icon: "🔧", einheit: "Sterne", lies(k) {
      const d = jsonOf(k["kmf-werkstatt-v2"]); if (!d) return null;
      let s = zahl(d.sterne);
      for (const x in (d.besteSterne || {})) s += zahl(d.besteSterne[x]);
      return s ? { wert: s, zusatz: "Level " + zahl(d.level) } : null;
    }},
  { spiel: "Parkplatz-Chaos", icon: "🅿️", einheit: "Level", lies(k) {
      const d = jsonOf(k["parkplatz.v1"]); if (!d) return null;
      const m = zahl(d.max); return m > 1 ? { wert: m } : null;
    }},
  { spiel: "Reagenzgläser", icon: "🧪", einheit: "Level", lies(k) {
      const d = jsonOf(k["reagenz.v1"]); if (!d) return null;
      const m = Math.max(zahl(d.max), zahl(d.level), zahl(d.lvl));
      return m > 1 ? { wert: m } : null;
    }},
  { spiel: "Spider Solitär", icon: "🕷️", einheit: "Punkte", lies(k) {
      let b = 0; for (const x in k) if (x.startsWith("spider-best-")) b = Math.max(b, zahl(k[x]));
      return b ? { wert: b } : null;
    }},
  { spiel: "Schiffe versenken", icon: "🚢", einheit: "Züge", hochBesser: false, lies(k) {
      let b = 0; for (const x in k) if (x.startsWith("kmf-schiffe-best-")) {
        const v = zahl(k[x]); if (v && (!b || v < b)) b = v; }
      return b ? { wert: b } : null;
    }}
];
function werteAus(sp) {
  const k = {};
  for (const key in (sp.keys || {})) k[key] = sp.keys[key].v;
  const out = {};
  for (const r of REKORDE) {
    let e = null;
    try { e = r.lies(k); } catch (err) {}
    if (e) out[r.spiel] = { icon: r.icon, einheit: r.einheit, hochBesser: r.hochBesser !== false, ...e };
  }
  return out;
}

// ------------------------------------------------------------------ Helfer
function antwort(res, code, obj) {
  const text = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    // Nötig, wenn die Seite im Internet liegt und der Server über Tailscale läuft:
    // Chrome hält die Tailscale-Adresse für "lokal" und fragt vorher um Erlaubnis.
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store"
  });
  res.end(text);
}
function leseKoerper(req) {
  return new Promise((ok, fehler) => {
    let d = "", zuviel = false;
    req.on("data", c => { d += c; if (d.length > 4e6) { zuviel = true; req.destroy(); } });
    req.on("end", () => { if (zuviel) return fehler(new Error("zu gross"));
      try { ok(d ? JSON.parse(d) : {}); } catch (e) { fehler(new Error("kein JSON")); } });
    req.on("error", fehler);
  });
}
// ------------------------------------------- Spiele-Dateien selbst ausliefern
const SPIELE_DIR = process.env.SPIELE_DIR || "/spiele";
const TYPEN = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml",
  ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".gif":"image/gif", ".webp":"image/webp",
  ".ico":"image/x-icon", ".mp3":"audio/mpeg", ".mp4":"video/mp4", ".woff2":"font/woff2", ".txt":"text/plain; charset=utf-8" };
function statisch(req, res, weg) {
  var rein = decodeURIComponent(weg).replace(/\\/g, "/");
  if (rein.indexOf("\0") >= 0 || rein.split("/").indexOf("..") >= 0) {
    res.writeHead(400); return res.end("ungültiger Pfad");
  }
  var datei = path.join(SPIELE_DIR, rein);
  if (!datei.startsWith(SPIELE_DIR)) { res.writeHead(400); return res.end("ungültiger Pfad"); }
  try {
    if (fs.statSync(datei).isDirectory()) datei = path.join(datei, "index.html");
  } catch (e) {
    if (rein === "/") {   // noch keine Spiele hochgeladen -> wenigstens den Status zeigen
      return antwort(res, 200, { ok: true, dienst: "KMF Spiele – Spielstände",
        hinweis: "Spiele-Ordner ist leer", spieler: Object.keys(db.spieler).length });
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("nicht gefunden");
  }
  fs.readFile(datei, function (err, inhalt) {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("nicht gefunden"); }
    res.writeHead(200, {
      "Content-Type": TYPEN[path.extname(datei).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"     // Spiele sollen sich sofort aktualisieren
    });
    res.end(inhalt);
  });
}

const saubererName = n => String(n || "").replace(/[<>&"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
function spielerHolen(name, anlegen) {
  const n = saubererName(name);
  if (!n) return null;
  if (!db.spieler[n]) {
    if (!anlegen) return null;
    if (Object.keys(db.spieler).length >= MAX_SPIELER) return null;
    db.spieler[n] = { erstellt: Date.now(), gesehen: Date.now(), keys: {} };
  }
  return db.spieler[n];
}

// ------------------------------------------------------------------ Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const weg = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") return antwort(res, 204, {});

  if (weg === "/api" || weg === "/api/status") {
    return antwort(res, 200, { ok: true, dienst: "KMF Spiele – Spielstände",
      spieler: Object.keys(db.spieler).length, spieleOrdner: fs.existsSync(SPIELE_DIR), zeit: Date.now() });
  }

  // Alles ausser /api/... sind die Spiele selbst. Werden sie von hier ausgeliefert,
  // liegen Seite und Server auf derselben Adresse – dann kann kein Browser
  // die Abgleich-Anfragen wegen "fremder Herkunft" blockieren.
  if (!weg.startsWith("/api/")) return statisch(req, res, weg);

  // ab hier: Zugangsschlüssel nötig (steckt fest im Spiele-Client)
  const schluessel = url.searchParams.get("k") || req.headers["x-kmf-zugang"];
  if (schluessel !== ZUGANG) return antwort(res, 403, { fehler: "kein Zugang" });

  try {
    // --- Spielerliste ---
    if (weg === "/api/spieler" && req.method === "GET") {
      const liste = Object.keys(db.spieler).map(n => ({
        name: n, gesehen: db.spieler[n].gesehen || 0, spiele: werteAus(db.spieler[n])
      })).sort((a, b) => b.gesehen - a.gesehen);
      return antwort(res, 200, { spieler: liste });
    }

    // --- Spieler anlegen / anmelden ---
    if (weg === "/api/spieler" && req.method === "POST") {
      const body = await leseKoerper(req);
      const sp = spielerHolen(body.name, true);
      if (!sp) return antwort(res, 400, { fehler: "Name ungültig oder zu viele Spieler" });
      sp.gesehen = Date.now();
      sichern();
      return antwort(res, 200, { ok: true, name: saubererName(body.name), keys: sp.keys });
    }

    // --- Stand holen ---
    if (weg === "/api/stand" && req.method === "GET") {
      const sp = spielerHolen(url.searchParams.get("spieler"), false);
      if (!sp) return antwort(res, 404, { fehler: "unbekannter Spieler" });
      sp.gesehen = Date.now(); sichern();
      return antwort(res, 200, { keys: sp.keys });
    }

    // --- Stand speichern (neuerer Zeitstempel gewinnt) ---
    if (weg === "/api/stand" && req.method === "POST") {
      const body = await leseKoerper(req);
      const sp = spielerHolen(body.spieler, true);
      if (!sp) return antwort(res, 400, { fehler: "Name ungültig" });
      let n = 0;
      for (const key in (body.keys || {})) {
        if (Object.keys(sp.keys).length >= MAX_KEYS && !sp.keys[key]) continue;
        const e = body.keys[key];
        if (!e || typeof e.v !== "string" || e.v.length > MAX_WERT) continue;
        const alt = sp.keys[key];
        if (!alt || zahl(e.t) >= zahl(alt.t)) { sp.keys[key] = { v: e.v, t: zahl(e.t) || Date.now() }; n++; }
      }
      sp.gesehen = Date.now();
      sichern();
      return antwort(res, 200, { ok: true, uebernommen: n, keys: sp.keys });
    }

    // --- Bestenliste über alle Spieler und Spiele ---
    if (weg === "/api/bestenliste" && req.method === "GET") {
      const tabellen = {};
      for (const n in db.spieler) {
        const w = werteAus(db.spieler[n]);
        for (const spiel in w) {
          (tabellen[spiel] = tabellen[spiel] || { icon: w[spiel].icon, einheit: w[spiel].einheit,
            hochBesser: w[spiel].hochBesser, plaetze: [] })
            .plaetze.push({ name: n, wert: w[spiel].wert, zusatz: w[spiel].zusatz || "" });
        }
      }
      for (const spiel in tabellen) {
        const t = tabellen[spiel];
        t.plaetze.sort((a, b) => t.hochBesser ? b.wert - a.wert : a.wert - b.wert);
        t.plaetze = t.plaetze.slice(0, 20);
      }
      return antwort(res, 200, { spiele: tabellen });
    }

    return antwort(res, 404, { fehler: "unbekannter Weg" });
  } catch (e) {
    return antwort(res, 400, { fehler: e.message });
  }
});

server.listen(PORT, () => console.log("KMF Spiele-Server läuft auf Port " + PORT + ", Daten in " + DATEI));
process.on("SIGTERM", () => { try { fs.writeFileSync(DATEI, JSON.stringify(db)); } catch (e) {} process.exit(0); });
