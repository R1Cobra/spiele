// Zeichnet jedes Bauteil aus allen 500 Levels einmal mit einem Schein-Canvas.
// Findet Tippfehler in der Zeichen-Routine, ohne dass man das Spiel öffnen muss.
const fs = require('fs'), vm = require('vm');
const Matter = require('matter-js');
const code = [...fs.readFileSync(__dirname + '/../index.html', 'utf8')
  .matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).pop();

let aufrufe = 0;
const ctx = new Proxy({}, { get(t, k) {
  if (k === 'createLinearGradient') return () => ({ addColorStop(){} });
  if (k === 'canvas') return { width: 1200, height: 700 };
  if (k === 'measureText') return () => ({ width: 10 });
  return (...a) => { aufrufe++; for (const v of a) if (typeof v === 'number' && !isFinite(v)) throw new Error('ungültige Zahl bei ctx.' + String(k)); };
}, set(){ return true; } });
const el = () => new Proxy({ style:{}, classList:{add(){},remove(){},toggle(){}}, textContent:'', innerHTML:'', value:'', width:1200, height:700 },
  { get(t,k){ if (k in t) return t[k];
      if (['addEventListener','appendChild','focus','removeEventListener'].includes(k)) return () => {};
      if (k === 'getContext') return () => ctx; return undefined; }, set(t,k,v){ t[k]=v; return true; } });
const sb = { Matter, console, Math, JSON, Date, parseInt, parseFloat, isNaN, setTimeout: () => {}, requestAnimationFrame: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { getElementById: el, createElement: el, addEventListener: () => {} },
  window: { innerWidth:1200, innerHeight:700, devicePixelRatio:1, addEventListener: () => {},
    AudioContext: function(){ return { state:'running', currentTime:0, destination:{},
      createOscillator:()=>({frequency:{value:0,exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}),
      createGain:()=>({gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}}), resume(){} }; } } };
sb.window.localStorage = sb.localStorage; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(code + '\n;globalThis.__X={loadLevel,drawPart,breakables,TOTAL_LEVELS,PLANS,WORLDS,LEVELS_PER_WORLD};', sb, { filename:'ps.js' });
vm.runInContext('resize();', sb);

const fehler = [];
const gesehen = new Set(), kulissen = new Set();
for (let i = 0; i < sb.__X.TOTAL_LEVELS; i++) {
  try {
    vm.runInContext('loadLevel(' + i + '); globalThis.__T = breakables;', sb);
    for (const p of sb.__T) {
      gesehen.add(p.kind);
      try { vm.runInContext('drawPart(__T[' + sb.__T.indexOf(p) + '])', sb); }
      catch (e) { fehler.push('Level ' + (i+1) + ' · ' + p.kind + ': ' + e.message); }
    }
    // einmal pro Welt die ganze Kulisse zeichnen (Himmel, Hügel, Silhouetten, Wetter)
    if (i % sb.__X.LEVELS_PER_WORLD === 0) {
      kulissen.add(sb.__X.WORLDS[i / sb.__X.LEVELS_PER_WORLD].n);
      try { vm.runInContext('draw()', sb); }
      catch (e) { fehler.push('Kulisse ' + sb.__X.WORLDS[i / sb.__X.LEVELS_PER_WORLD].n + ': ' + e.message); }
    }
  } catch (e) { fehler.push('Level ' + (i+1) + ' laden: ' + e.message); }
}
console.log('Gezeichnete Arten (' + gesehen.size + '): ' + [...gesehen].sort().join(', '));
console.log('Gezeichnete Kulissen (' + kulissen.size + '): ' + [...kulissen].join(', '));
console.log('Zeichen-Befehle: ' + aufrufe);
console.log('\nFEHLER: ' + fehler.length);
[...new Set(fehler)].slice(0, 20).forEach(f => console.log('  ✗ ' + f));
