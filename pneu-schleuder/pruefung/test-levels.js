// Prüft alle 500 Levels von Pneu-Schleuder headless (Fake-DOM + Fake-Matter).
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

// letzten Inline-<script>-Block holen
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const code = blocks[blocks.length - 1];
if (!code || code.length < 5000) { console.error('Script-Block nicht gefunden'); process.exit(1); }

// ---- Fake-Matter ----
let bodyId = 0;
function mkBody(x, y, extra) {
  return Object.assign({ id: ++bodyId, position: { x, y }, velocity: { x:0, y:0 }, angle: 0,
    mass: 1, plugin: {}, isStatic: !!(extra && extra.isStatic), isSleeping: false }, extra || {});
}
const Matter = {
  Engine: { create: () => ({ world: { bodies: [] }, gravity: { y: 1 } }), update(){} },
  Bodies: {
    rectangle: (x,y,w,h,o) => Object.assign(mkBody(x,y,o), { _w:w, _h:h, _t:'rect' }),
    circle:    (x,y,r,o)   => Object.assign(mkBody(x,y,o), { circleRadius:r, _t:'circle' }),
    trapezoid: (x,y,w,h,s,o) => Object.assign(mkBody(x,y,o), { _w:w, _h:h, _t:'trap' })
  },
  Body: { setStatic(){}, setPosition(){}, setVelocity(){}, applyForce(){} },
  Composite: { add(){}, remove(){} },
  Events: { on(){} },
  Sleeping: { set(){} }
};

// ---- Fake-DOM ----
const elProxy = () => new Proxy({ style:{}, classList:{ add(){}, remove(){}, toggle(){} },
  textContent:'', innerHTML:'', value:'', dataset:{} }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'addEventListener' || k === 'appendChild' || k === 'focus' || k === 'removeEventListener') return () => {};
    if (k === 'getContext') return () => ctxProxy();
    return undefined;
  },
  set(t, k, v) { t[k] = v; return true; }
});
const ctxProxy = () => new Proxy({}, { get(t, k) {
  if (k === 'createLinearGradient') return () => ({ addColorStop(){} });
  if (k === 'canvas') return { width:0, height:0 };
  return () => {};
}, set(){ return true; } });

const storeMem = {};
const sandbox = {
  Matter, console, Math, JSON, Date, parseInt, parseFloat, isNaN, setTimeout: () => {}, clearTimeout: () => {},
  requestAnimationFrame: () => {},
  localStorage: { getItem: k => (k in storeMem ? storeMem[k] : null), setItem: (k,v) => storeMem[k] = v },
  document: { getElementById: () => elProxy(), createElement: () => elProxy(), addEventListener: () => {} },
  window: { innerWidth: 1200, innerHeight: 700, devicePixelRatio: 1, addEventListener: () => {},
            AudioContext: function(){ return { state:'running', currentTime:0, destination:{},
              createOscillator: () => ({ frequency:{ value:0, exponentialRampToValueAtTime(){} }, connect(){}, start(){}, stop(){} }),
              createGain: () => ({ gain:{ value:0, exponentialRampToValueAtTime(){} }, connect(){} }), resume(){} }; } }
};
sandbox.window.localStorage = sandbox.localStorage;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code + '\n;globalThis.__X = { buildLevel, PLANS, WORLDS, LEVELS_PER_WORLD, TOTAL_LEVELS, planIndex, TIRES, levelName };',
  sandbox, { filename: 'pneu-schleuder.js' });

// ---- Prüfung ----
const { buildLevel, PLANS, WORLDS, LEVELS_PER_WORLD, TOTAL_LEVELS, planIndex, TIRES } = sandbox.__X;
const SLING_X = 1900 - 230;
let fehler = [], warn = [];
const planCount = {}, worldPlans = {};
let minTeile = 1e9, maxTeile = 0, minBlitz = 1e9, maxBlitz = 0, minPneu = 1e9, maxPneu = 0;
let hoechstesTeil = 1e9, weitestesTeil = 0, naechstesTeil = 0;

for (let i = 0; i < TOTAL_LEVELS; i++) {
  let def;
  try { def = buildLevel(i); }
  catch (e) { fehler.push('Level ' + (i+1) + ': ' + e.message); continue; }

  const w = Math.floor(i / LEVELS_PER_WORLD);
  const pi = planIndex(i);
  planCount[pi] = (planCount[pi] || 0) + 1;
  (worldPlans[w] = worldPlans[w] || []).push(pi);

  const blitz = def.parts.filter(p => p.kind === 'blitzer').length;
  const civils = def.parts.filter(p => p.kind === 'civil').length;
  if (blitz === 0) fehler.push('Level ' + (i+1) + ': KEIN Blitzer');
  if (!def.parts.length) fehler.push('Level ' + (i+1) + ': leer');
  if (def.tires.length < 2) fehler.push('Level ' + (i+1) + ': nur ' + def.tires.length + ' Pneu(s)');
  if (def.tires.length < blitz) warn.push('Level ' + (i+1) + ': ' + def.tires.length + ' Pneus für ' + blitz + ' Blitzer');
  for (const t of def.tires) if (!TIRES[t]) fehler.push('Level ' + (i+1) + ': unbekannter Pneu ' + t);
  if (def.max <= 0) fehler.push('Level ' + (i+1) + ': max ' + def.max);

  for (const p of def.parts) {
    const x = p.body.position.x, y = p.body.position.y;
    if (!isFinite(x) || !isFinite(y)) { fehler.push('Level ' + (i+1) + ': Teil ohne Position (' + p.kind + ')'); continue; }
    if (x > SLING_X - 160) fehler.push('Level ' + (i+1) + ': ' + p.kind + ' steht in der Schleuder (x=' + Math.round(x) + ')');
    if (x < 40) fehler.push('Level ' + (i+1) + ': ' + p.kind + ' ausserhalb links (x=' + Math.round(x) + ')');
    if (y - (p.h||0)/2 < 10) fehler.push('Level ' + (i+1) + ': ' + p.kind + ' zu hoch (y=' + Math.round(y) + ')');
    if (y > 700) fehler.push('Level ' + (i+1) + ': ' + p.kind + ' unter dem Boden (y=' + Math.round(y) + ')');
    hoechstesTeil = Math.min(hoechstesTeil, y - (p.h||0)/2);
    weitestesTeil = Math.max(weitestesTeil, 1900 - x);
    naechstesTeil = Math.max(naechstesTeil, x);
  }
  // Fahrschüler dürfen nicht in einem Blitzer stecken
  for (const cv of def.parts.filter(p => p.kind === 'civil'))
    for (const bl of def.parts.filter(p => p.kind !== 'civil'))
      if (Math.abs(cv.body.position.x - bl.body.position.x) < 22 && Math.abs(cv.body.position.y - bl.body.position.y) < 45)
        warn.push('Level ' + (i+1) + ': Fahrschüler steckt in ' + bl.kind);

  minTeile = Math.min(minTeile, def.parts.length); maxTeile = Math.max(maxTeile, def.parts.length);
  minBlitz = Math.min(minBlitz, blitz); maxBlitz = Math.max(maxBlitz, blitz);
  minPneu = Math.min(minPneu, def.tires.length); maxPneu = Math.max(maxPneu, def.tires.length);
}

// in einer Welt darf kein Bauplan doppelt vorkommen (25 Levels aus dem Bauplan-Vorrat)
for (const w in worldPlans) {
  const s = new Set(worldPlans[w]);
  if (s.size !== LEVELS_PER_WORLD) fehler.push('Welt ' + (+w+1) + ': nur ' + s.size + ' verschiedene Baupläne');
}
// und jeder Bauplan soll über das ganze Spiel verteilt regelmässig drankommen
for (let p = 0; p < PLANS.length; p++) {
  const n = planCount[p] || 0;
  if (n < 8) fehler.push('Bauplan "' + PLANS[p].n + '" kommt nur ' + n + '× vor');
}
// Determinismus: zweimal bauen -> gleiches Ergebnis
for (const i of [0, 42, 123, 250, 377, 499]) {
  const a = buildLevel(i), b = buildLevel(i);
  const key = d => d.parts.map(p => p.kind + Math.round(p.body.position.x) + ',' + Math.round(p.body.position.y)).join('|') + '#' + d.tires.join(',');
  if (key(a) !== key(b)) fehler.push('Level ' + (i+1) + ' ist NICHT reproduzierbar');
}

console.log('Baupläne:', PLANS.length, '· Welten:', WORLDS.length, '· Levels:', TOTAL_LEVELS);
console.log('Teile pro Level:', minTeile + '–' + maxTeile, '· Blitzer:', minBlitz + '–' + maxBlitz, '· Pneus:', minPneu + '–' + maxPneu);
console.log('höchster Punkt y=' + Math.round(hoechstesTeil), '· weitestes Ziel d=' + Math.round(weitestesTeil), '· nächstes Teil x=' + Math.round(naechstesTeil));
const nutzung = Object.values(planCount);
console.log('Bauplan-Nutzung: ' + Math.min(...nutzung) + '–' + Math.max(...nutzung) + '× pro Bauplan · verschiedene Baupläne pro Welt: ' + LEVELS_PER_WORLD);
console.log('\nFEHLER: ' + fehler.length);
fehler.slice(0, 25).forEach(f => console.log('  ✗ ' + f));
console.log('WARNUNGEN: ' + warn.length);
[...new Set(warn)].slice(0, 15).forEach(f => console.log('  ! ' + f));
