/*
 * KMF Spiele – gemeinsamer Spielstand ("Cloud")
 * =============================================
 * Wird in jedem Spiel im <head> eingebunden:
 *     <script src="../kmf-cloud.js"></script>
 * und auf der Startseite mit:
 *     <script src="kmf-cloud.js" data-startseite></script>
 *
 * Idee: Die Spiele speichern weiterhin ganz normal im localStorage des Browsers.
 * Dieses Skript legt sich davor, merkt sich zu jedem Eintrag den Zeitpunkt der
 * Änderung und gleicht ihn im Hintergrund mit dem Server auf der Synology ab.
 * Dadurch muss kein Spiel umgebaut werden – und ohne Netz läuft alles weiter
 * wie bisher, es wird einfach beim nächsten Mal abgeglichen.
 */
(function () {
  "use strict";

  // Läuft die Seite schon auf der Synology, sprechen wir den Server auf derselben
  // Adresse an (dann kann kein Browser die Anfragen als "fremde Herkunft" blockieren).
  // Nur auf GitHub Pages brauchen wir die volle Adresse.
  // window.KMF_SERVER / window.KMF_ZUGANG dienen zum Testen auf dem eigenen Rechner.
  var AUSWAERTS = /github\.io$/i.test(location.hostname);
  var SERVER  = window.KMF_SERVER || (AUSWAERTS ? "https://spiele.tail06709a.ts.net" : "");
  var ZUGANG  = window.KMF_ZUGANG || "kmf-spiele-2026";   // muss zum Wert ZUGANG auf dem Server passen
  var K_NAME  = "kmf.spieler";            // wer gerade spielt
  var K_ZEIT  = "kmf.zeit";               // {schluessel: zeitpunkt}
  var K_SYNC  = "kmf.letzterAbgleich";
  var EIGEN   = /^kmf\.(spieler|zeit|letzterAbgleich)$/;   // wird selbst nicht abgeglichen

  var script = document.currentScript;
  var istStartseite = !!(script && script.hasAttribute("data-startseite"));

  // Originale merken – wir rufen sie später selbst auf, damit unser Haken
  // nicht bei unseren eigenen Schreibvorgängen auslöst.
  var LS = window.localStorage;
  var setzeRoh = LS.setItem.bind(LS);
  var loescheRoh = LS.removeItem.bind(LS);

  function lies(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function zeiten() { try { return JSON.parse(lies(K_ZEIT)) || {}; } catch (e) { return {}; } }
  function zeitenSchreiben(z) { try { setzeRoh(K_ZEIT, JSON.stringify(z)); } catch (e) {} }
  function spielKeys() {
    var out = [];
    for (var i = 0; i < LS.length; i++) {
      var k = LS.key(i);
      if (k && !EIGEN.test(k)) out.push(k);
    }
    return out;
  }

  var API = {
    spieler: lies(K_NAME) || null,
    bereit: false,
    online: null
  };

  // ------------------------------------------------------------ Netzverkehr
  function ruf(weg, optionen) {
    var o = optionen || {};
    var url = SERVER + weg + (weg.indexOf("?") < 0 ? "?" : "&") + "k=" + encodeURIComponent(ZUGANG);
    var steuer = new AbortController();
    var abbruch = setTimeout(function () { steuer.abort(); }, o.zeit || 8000);
    return fetch(url, {
      method: o.methode || "GET",
      headers: o.daten ? { "Content-Type": "application/json" } : undefined,
      body: o.daten ? JSON.stringify(o.daten) : undefined,
      signal: steuer.signal,
      cache: "no-store"
    }).then(function (r) {
      clearTimeout(abbruch);
      API.online = r.ok;
      if (!r.ok) throw new Error("Server antwortet " + r.status);
      return r.json();
    }, function (e) { clearTimeout(abbruch); API.online = false; throw e; });
  }

  // ------------------------------------------------- Herunterladen / Mischen
  // Übernimmt Server-Einträge, die neuer sind als die hiesigen.
  function uebernehmen(serverKeys) {
    var z = zeiten(), geaendert = 0;
    for (var k in serverKeys) {
      if (EIGEN.test(k)) continue;
      var s = serverKeys[k];
      var eigen = z[k] || 0;
      if (!s || typeof s.v !== "string") continue;
      if (s.t > eigen || lies(k) === null) {
        if (lies(k) !== s.v) geaendert++;
        try { setzeRoh(k, s.v); } catch (e) {}
        z[k] = s.t;
      }
    }
    zeitenSchreiben(z);
    return geaendert;
  }

  function hochladenJetzt() {
    if (!API.spieler) return Promise.resolve();
    var z = zeiten(), keys = {}, n = 0;
    spielKeys().forEach(function (k) {
      var v = lies(k);
      if (v === null || v.length > 300000) return;
      keys[k] = { v: v, t: z[k] || Date.now() };
      n++;
    });
    if (!n) return Promise.resolve();
    return ruf("/api/stand", { methode: "POST", daten: { spieler: API.spieler, keys: keys } })
      .then(function (a) {
        try { setzeRoh(K_SYNC, String(Date.now())); } catch (e) {}
        return a;
      })
      .catch(function () { /* offline: beim nächsten Mal wieder */ });
  }

  var planer = null;
  function hochladenPlanen() {
    if (!API.spieler) return;
    clearTimeout(planer);
    planer = setTimeout(hochladenJetzt, 1500);
  }

  // ------------------------------------------- Haken in den Browser-Speicher
  try {
    LS.setItem = function (k, v) {
      setzeRoh(k, v);
      if (!EIGEN.test(String(k))) {
        var z = zeiten(); z[k] = Date.now(); zeitenSchreiben(z);
        hochladenPlanen();
      }
    };
    LS.removeItem = function (k) {
      loescheRoh(k);
      if (!EIGEN.test(String(k))) {
        var z = zeiten(); z[k] = Date.now(); zeitenSchreiben(z);
        hochladenPlanen();
      }
    };
  } catch (e) { /* manche Browser lassen das nicht zu – dann bleibt alles lokal */ }

  // Beim Verlassen/Wegschalten sicher noch hochladen
  ["pagehide", "beforeunload"].forEach(function (ev) {
    window.addEventListener(ev, function () {
      if (!API.spieler) return;
      try {
        var z = zeiten(), keys = {};
        spielKeys().forEach(function (k) {
          var v = lies(k); if (v !== null && v.length <= 300000) keys[k] = { v: v, t: z[k] || Date.now() };
        });
        var text = JSON.stringify({ spieler: API.spieler, keys: keys });
        navigator.sendBeacon(SERVER + "/api/stand?k=" + encodeURIComponent(ZUGANG),
          new Blob([text], { type: "application/json" }));
      } catch (e) {}
    });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") hochladenJetzt();
  });

  // ------------------------------------------------------- Öffentliche Wege
  API.spielerListe = function () {
    return ruf("/api/spieler").then(function (a) { return a.spieler || []; });
  };
  API.bestenliste = function () {
    return ruf("/api/bestenliste").then(function (a) { return a.spiele || {}; });
  };

  // Prüft vor dem Anmelden, ob es auf beiden Seiten Spielstände gibt.
  API.pruefen = function (name) {
    var lokal = spielKeys().length;
    return ruf("/api/spieler").then(function (a) {
      var e = (a.spieler || []).filter(function (s) { return s.name === name; })[0];
      var serverHat = !!(e && Object.keys(e.spiele || {}).length);
      return { neu: !e, serverHat: serverHat, lokalHat: lokal > 0,
               konflikt: !!(serverHat && lokal > 0 && name !== API.spieler) };
    });
  };

  /* richtung: "auto"   – normal mischen (neuere Änderung gewinnt)
     "server"  – Stand vom Server nehmen, hiesigen verwerfen
     "geraet"  – Stand dieses Geräts behalten und hochladen           */
  API.anmelden = function (name, richtung) {
    name = String(name || "").trim().slice(0, 20);
    if (!name) return Promise.reject(new Error("Kein Name"));
    var wechsel = API.spieler && API.spieler !== name;
    if (wechsel || richtung === "server") {
      spielKeys().forEach(function (k) { loescheRoh(k); });   // fremden Stand wegräumen
      zeitenSchreiben({});
    }
    setzeRoh(K_NAME, name);
    API.spieler = name;
    return ruf("/api/spieler", { methode: "POST", daten: { name: name } }).then(function (a) {
      if (richtung !== "geraet") uebernehmen(a.keys || {});
      return hochladenJetzt().then(function () { return { ok: true, name: name }; });
    });
  };

  API.abmelden = function () {
    return hochladenJetzt().then(function () {
      spielKeys().forEach(function (k) { loescheRoh(k); });
      zeitenSchreiben({});
      loescheRoh(K_NAME);
      API.spieler = null;
    });
  };

  API.jetztHochladen = hochladenJetzt;

  // -------------------------------------------------- Start: Stand abgleichen
  API.abgleichen = function () {
    if (!API.spieler) { API.bereit = true; return Promise.resolve(0); }
    return ruf("/api/stand?spieler=" + encodeURIComponent(API.spieler))
      .then(function (a) {
        var n = uebernehmen(a.keys || {});
        API.bereit = true;
        return hochladenJetzt().then(function () { return n; });
      })
      .catch(function () { API.bereit = true; return 0; });
  };

  window.KMF = API;

  // In einem Spiel: wenn der Server einen neueren Stand hatte, einmal neu laden,
  // damit das Spiel wirklich mit dem neuen Stand startet.
  API.abgleichen().then(function (geaendert) {
    document.dispatchEvent(new CustomEvent("kmf-bereit", { detail: { geaendert: geaendert } }));
    if (!istStartseite && geaendert > 0) {
      try {
        if (!sessionStorage.getItem("kmf.neugeladen")) {
          sessionStorage.setItem("kmf.neugeladen", "1");
          location.reload();
        }
      } catch (e) {}
    }
  });
})();
