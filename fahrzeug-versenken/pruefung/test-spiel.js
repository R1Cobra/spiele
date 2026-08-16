// Prüft "Fahrzeug versenken" headless (Fake-DOM, kein Browser nötig).
//   node pruefung/test-spiel.js
// Geprüft wird: Aufstellung auf allen Parkplatzgrössen und mit beiden
// Abstands-Regeln, die Regeln selbst, der Ablauf eines ganzen Spiels und
// dass jede Fahrzeug-Zeichnung sauber herauskommt.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const code = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).pop();
if (!code || code.length < 5000) { console.error('Script-Block nicht gefunden'); process.exit(1); }

/* ---- Fake-DOM: gerade so viel, dass das Spiel startet ---- */
const elemente = {};
function el() {
  const o = {
    style: { setProperty(){}, removeProperty(){} },
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    dataset: {}, children: [], textContent: '', innerHTML: '', value: '', disabled: false,
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){},
    querySelectorAll(){ return []; }, closest(){ return null; }, focus(){},
    getContext(){ return new Proxy({}, { get: () => () => ({ addColorStop(){} }) }); },
  };
  return o;
}
const doc = {
  getElementById(id) { return elemente[id] || (elemente[id] = el()); },
  createElement: el,
  addEventListener(){},
  documentElement: { style: { setProperty(){} } },
};
const sandbox = {
  console, Math, JSON, Date, parseInt, parseFloat, isNaN, isFinite,
  setTimeout: () => {}, clearTimeout: () => {}, requestAnimationFrame: () => {},
  document: doc,
  location: { search: '', hostname: 'test', href: '' },
  localStorage: { getItem: () => null, setItem: () => {} },
  window: { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1, addEventListener: () => {} },
};
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.document = doc;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code + `
;globalThis.__X = { newSide, randomFleet, fits, fire, alive, aiChoose, vehSVG,
                    neighbours, shipCells, placeShip, FLEET, UNKNOWN, MISS, HIT };
;globalThis.__setN = v => { N = v; };
;globalThis.__setAbstand = v => { ABSTAND = v; };
;globalThis.__N = () => N;
`, sandbox, { filename: 'fahrzeug-versenken.js' });

const X = sandbox.__X;
const GESAMT = X.FLEET.reduce((a, s) => a + s.len, 0);
let fehler = [], zeilen = [];
const pruefe = (name, ok, info) => {
  (ok ? zeilen : fehler).push((ok ? '  ✅ ' : '  ✗ ') + name + (info ? '  (' + info + ')' : ''));
};

/* ---- 1. Aufstellung auf allen Grössen und mit beiden Regeln ---- */
for (const n of [8, 10, 12]) {
  for (const abstand of [true, false]) {
    sandbox.__setN(n); sandbox.__setAbstand(abstand);
    let misserfolge = 0, regelBruch = 0;
    const VERSUCHE = 400;
    for (let t = 0; t < VERSUCHE; t++) {
      const s = X.newSide();
      if (!X.randomFleet(s)) { misserfolge++; continue; }
      const belegt = s.ships.reduce((a, x) => a + x.cells.length, 0);
      if (belegt !== GESAMT) { regelBruch++; continue; }
      for (const sh of s.ships) {
        for (const c of sh.cells) {
          if (s.board[c] !== sh.id) regelBruch++;
          if (!abstand) continue;
          for (const nb of X.neighbours(c, true)) {
            const da = s.board[nb];
            if (da !== -1 && da !== sh.id) regelBruch++;
          }
        }
      }
    }
    const marke = n + '×' + n + (abstand ? ' mit Lücke' : ' ohne Lücke');
    pruefe(marke + ': Aufstellung klappt immer', misserfolge === 0,
           misserfolge ? misserfolge + '/' + VERSUCHE + ' fehlgeschlagen' : VERSUCHE + '× geprüft');
    pruefe(marke + ': Regeln eingehalten', regelBruch === 0, regelBruch ? regelBruch + ' Verstösse' : '');
  }
}

/* ---- 2. Die Lücken-Regel greift wirklich ---- */
sandbox.__setN(10); sandbox.__setAbstand(true);
{
  const s = X.newSide();
  X.placeShip(s, s.ships[0], X.shipCells(0, 0, s.ships[0].len, 0), 0);   // Zeile 0
  const daneben = X.shipCells(1, 0, 2, 0);                               // direkt darunter
  pruefe('Mit Lücke: direkt daneben ist verboten', !X.fits(s, daneben, 9));
  sandbox.__setAbstand(false);
  pruefe('Ohne Lücke: direkt daneben ist erlaubt', X.fits(s, daneben, 9));
  sandbox.__setAbstand(true);
  const drauf = X.shipCells(0, 0, 2, 0);
  pruefe('Überlappen bleibt immer verboten', !X.fits(s, drauf, 9));
}

/* ---- 3. Ein ganzes Spiel läuft zu Ende ---- */
for (const n of [8, 10, 12]) {
  for (const abstand of [true, false]) {
    for (const stufe of [0, 1, 2]) {
      sandbox.__setN(n); sandbox.__setAbstand(abstand);
      let summe = 0, haenger = 0;
      const SPIELE = 12;
      for (let g = 0; g < SPIELE; g++) {
        const ziel = X.newSide();
        X.randomFleet(ziel);
        let z = 0;
        while (X.alive(ziel) && z <= n * n) { const i = X.aiChoose(ziel, stufe); if (i < 0) break; X.fire(ziel, i); z++; }
        if (X.alive(ziel)) haenger++;
        summe += z;
      }
      const marke = n + '×' + n + (abstand ? ' mit Lücke' : ' ohne Lücke') + ' · Stufe ' + stufe;
      pruefe(marke + ': jedes Spiel geht zu Ende', haenger === 0,
             'Ø ' + (summe / SPIELE).toFixed(1) + ' Versuche');
    }
  }
}

/* ---- 4. Profi muss deutlich besser sein als Zufall ---- */
sandbox.__setN(10); sandbox.__setAbstand(true);
const mittel = stufe => {
  let s2 = 0;
  for (let g = 0; g < 40; g++) {
    const ziel = X.newSide(); X.randomFleet(ziel);
    let z = 0;
    while (X.alive(ziel) && z <= 100) { const i = X.aiChoose(ziel, stufe); if (i < 0) break; X.fire(ziel, i); z++; }
    s2 += z;
  }
  return s2 / 40;
};
const mEinfach = mittel(0), mNormal = mittel(1), mProfi = mittel(2);
pruefe('Normal schlägt Einfach', mNormal < mEinfach, mNormal.toFixed(1) + ' < ' + mEinfach.toFixed(1));
pruefe('Profi schlägt Normal', mProfi < mNormal, mProfi.toFixed(1) + ' < ' + mNormal.toFixed(1));
pruefe('Profi braucht im Schnitt unter 55 Versuche', mProfi < 55, mProfi.toFixed(1));

/* ---- 5. Jede Fahrzeug-Zeichnung kommt sauber heraus ---- */
for (const f of X.FLEET) {
  for (const senkrecht of [false, true]) {
    const svg = X.vehSVG(f.typ, f.len, senkrecht);
    const auf = (svg.match(/</g) || []).length, zu = (svg.match(/>/g) || []).length;
    const box = senkrecht ? '0 0 100 ' + f.len * 100 : '0 0 ' + f.len * 100 + ' 100';
    pruefe(f.n + (senkrecht ? ' senkrecht' : ' waagrecht') + ': Zeichnung in Ordnung',
           svg.startsWith('<svg') && svg.endsWith('</svg>') && auf === zu &&
           svg.includes('viewBox="' + box + '"') && !/undefined|NaN/.test(svg));
  }
}

console.log('Fahrzeug versenken – Selbsttest');
console.log('Fuhrpark: ' + X.FLEET.map(f => f.n + ' (' + f.len + ')').join(' · ') + '  = ' + GESAMT + ' Felder');
zeilen.forEach(z => console.log(z));
console.log('\nFEHLER: ' + fehler.length);
fehler.forEach(f => console.log(f));
process.exit(fehler.length ? 1 : 0);
