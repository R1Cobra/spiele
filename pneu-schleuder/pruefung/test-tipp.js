// Prüft die Tipp-Funktion ("Lösungsweg zeigen"): Findet sie in verfahrenen
// Lagen wirklich einen Schuss, der ein Ziel erwischt – und stimmt der gelbe
// Ring, an den man den Pneu ziehen soll?
//   node pruefung/test-tipp.js
const fs = require('fs'), vm = require('vm');
const Matter = require('matter-js');
const code = [...fs.readFileSync(__dirname + '/../index.html', 'utf8')
  .matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).pop();

const ctx = new Proxy({}, { get(t, k) {
  if (k === 'createLinearGradient') return () => ({ addColorStop(){} });
  if (k === 'canvas') return { width:1200, height:700 };
  if (k === 'measureText') return () => ({ width:10 });
  return () => {};
}, set(){ return true; } });
const el = () => new Proxy({ style:{setProperty(){}}, classList:{add(){},remove(){},toggle(){}},
    textContent:'', innerHTML:'', value:'', disabled:false, width:1200, height:700, children:[] },
  { get(t,k){ if (k in t) return t[k];
      if (['addEventListener','appendChild','focus','removeEventListener','remove'].includes(k)) return () => {};
      if (k === 'querySelectorAll') return () => [];
      if (k === 'getContext') return () => ctx;
      return undefined; }, set(t,k,v){ t[k]=v; return true; } });
const sb = { Matter, console, Math, JSON, Date, parseInt, parseFloat, isNaN,
  setTimeout: (f) => { if (typeof f === 'function') f(); }, clearTimeout: () => {}, requestAnimationFrame: () => {},
  localStorage: { _:{}, getItem(k){ return this._[k] ?? null; }, setItem(k,v){ this._[k]=v; } },
  document: { getElementById: el, createElement: el, addEventListener: () => {}, documentElement:{ style:{ setProperty(){} } } },
  window: { innerWidth:1200, innerHeight:700, devicePixelRatio:1, addEventListener: () => {},
    AudioContext: function(){ return { state:'running', currentTime:0, destination:{},
      createOscillator:()=>({frequency:{value:0,exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}),
      createGain:()=>({gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}}), resume(){} }; } } };
sb.window.localStorage = sb.localStorage; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(code + `
;globalThis.__X = { loadLevel, tippWelt, tippSchuss, TIPP_WINKEL, TIPP_KRAFT, IST_ZIEL,
                    MAX_DRAG, POWER, SLING, TOTAL_LEVELS, TIRES, buildLevel };
;globalThis.__breakables = () => breakables;
;globalThis.__ziele = () => ziele;
;globalThis.__curTire = () => curTire;
`, sb, { filename:'ps.js' });
const X = sb.__X;

let fehler = [], zeilen = [];
const pruefe = (name, ok, info) => (ok ? zeilen : fehler).push((ok ? '  ✅ ' : '  ✗ ') + name + (info ? '  (' + info + ')' : ''));

/* ---- 1. Die Kopie der Lage stimmt ---- */
vm.runInContext('loadLevel(19)', sb);          // Level 20
{
  const orig = sb.__breakables();
  const st = vm.runInContext('tippWelt()', sb);
  pruefe('Kopie enthält gleich viele Teile wie die echte Lage', st.teile.length === orig.length,
         st.teile.length + ' von ' + orig.length);
  const abw = orig.map((o, i) => Math.hypot(o.body.position.x - st.teile[i].body.position.x,
                                            o.body.position.y - st.teile[i].body.position.y));
  pruefe('Alle Teile stehen in der Kopie an derselben Stelle', Math.max(...abw) < 0.01);
  const statisch = orig.filter(o => o.body.isStatic).length;
  pruefe('Feste Teile (Fels, Plattform, Hügel) bleiben fest',
         st.teile.filter(t => t.body.isStatic).length === statisch, statisch + ' Stück');
}

/* ---- 2. In verschiedenen Levels wird ein Treffer gefunden ---- */
const PROBEN = [20, 1, 36, 56, 60, 100, 250, 386, 515, 549, 578, 587, 600];
let ohneTreffer = [];
for (const nr of PROBEN) {
  vm.runInContext('loadLevel(' + (nr - 1) + ')', sb);
  const typ = sb.__curTire();
  let best = null;
  for (const w of X.TIPP_WINKEL) {
    for (const k of X.TIPP_KRAFT) {
      const r = vm.runInContext('tippSchuss(' + w + ',' + k + ',"' + typ + '")', sb);
      if (r.civilTot) continue;
      const punkte = r.getroffen * 100000 + r.wert;
      if (!best || punkte > best.punkte) best = { punkte, w, k, ziele: r.getroffen, bahn: r.bahn.length };
    }
  }
  if (!best || best.ziele === 0) { ohneTreffer.push(nr); continue; }
  // Der gelbe Ring muss innerhalb des erlaubten Auszugs liegen
  const zx = X.SLING.x + Math.cos(best.w) * X.MAX_DRAG * best.k;
  const zy = X.SLING.y + Math.sin(best.w) * X.MAX_DRAG * best.k;
  const auszug = Math.hypot(zx - X.SLING.x, zy - X.SLING.y);
  if (auszug > X.MAX_DRAG + 0.01) fehler.push('  ✗ Level ' + nr + ': Ring liegt ausserhalb des Auszugs (' + auszug.toFixed(0) + ')');
  if (!best.bahn) fehler.push('  ✗ Level ' + nr + ': keine Flugbahn zum Zeichnen');
  zeilen.push('  ✅ Level ' + String(nr).padStart(3) + ': Tipp trifft ' + best.ziele + ' Ziel(e)'
    + '  (' + Math.round(best.w*180/Math.PI) + '°, ' + Math.round(best.k*100) + '% Kraft, '
    + best.bahn + ' Bahnpunkte)');
}
pruefe('In jedem geprüften Level findet der Tipp einen Treffer', ohneTreffer.length === 0,
       ohneTreffer.length ? 'ohne Treffer: ' + ohneTreffer.join(', ') : PROBEN.length + ' Levels');

/* ---- 3. Der Tipp verrechnet sich nicht mit der echten Welt ---- */
vm.runInContext('loadLevel(19)', sb);
{
  const vorher = sb.__ziele().length;
  const typ = sb.__curTire();
  for (const w of X.TIPP_WINKEL.slice(0, 4))
    vm.runInContext('tippSchuss(' + w + ',0.9,"' + typ + '")', sb);
  pruefe('Die echte Lage bleibt vom Durchrechnen unberührt', sb.__ziele().length === vorher,
         vorher + ' Ziele vorher und nachher');
}

console.log('Tipp-Funktion – Selbsttest');
zeilen.forEach(z => console.log(z));
console.log('\nFEHLER: ' + fehler.length);
fehler.forEach(f => console.log(f));
process.exit(fehler.length ? 1 : 0);
