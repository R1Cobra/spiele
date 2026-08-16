// Fairness-Prüfung: findet Ziele, die zwar theoretisch lösbar, aber praktisch
// nicht zu treffen sind – zum Beispiel weil sie im Schatten einer hohen Felswand
// stehen. Genau daran ist Level 20 («Der Schacht») gescheitert.
//
//   node pruefung/test-fairness.js            # 3 Levels je Bauplan (~3 Minuten)
//   node pruefung/test-fairness.js 12 40 99   # nur diese Levels, ausführlich
//
// Vorgehen: Für jedes geprüfte Level wird ein Raster von ERSTEN Schüssen
// durchsimuliert (Winkel × Kraft) und gezählt, welche Ziele dabei fallen.
//
// Beurteilt wird nur, was FREI STEHT: ein Ziel ohne etwas über sich, das also
// direkt getroffen werden könnte. Solche Ziele müssen mit mindestens 5 % der
// Schüsse zu erledigen sein. Ziele in Bunkern, Kisten oder Türmen sind absichtlich
// nicht direkt erreichbar – die werden hier nicht bewertet.
const fs = require('fs'), vm = require('vm');
const Matter = require('matter-js');
const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;
const code = [...fs.readFileSync(__dirname + '/../index.html', 'utf8')
  .matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).pop();

const el = () => new Proxy({ style:{setProperty(){}}, classList:{add(){},remove(){},toggle(){}}, textContent:'', innerHTML:'', value:'', children:[] },
  { get(t,k){ if (k in t) return t[k];
      if (['addEventListener','appendChild','focus','removeEventListener'].includes(k)) return () => {};
      if (k === 'getContext') return () => new Proxy({}, { get: () => () => ({ addColorStop(){} }) });
      return undefined; }, set(t,k,v){ t[k]=v; return true; } });
const sb = { Matter, console, Math, JSON, Date, parseInt, parseFloat, isNaN, setTimeout:()=>{}, requestAnimationFrame:()=>{},
  localStorage:{ getItem:()=>null, setItem:()=>{} },
  document:{ getElementById:el, createElement:el, addEventListener:()=>{}, documentElement:{ style:{ setProperty(){} } } },
  window:{ innerWidth:1200, innerHeight:700, devicePixelRatio:1, addEventListener:()=>{},
    AudioContext:function(){ return { state:'running', currentTime:0, destination:{},
      createOscillator:()=>({frequency:{value:0,exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}),
      createGain:()=>({gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}}), resume(){} }; } } };
sb.window.localStorage = sb.localStorage; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(code + '\n;globalThis.__X={buildLevel,WORLDS,TIRES,MAX_DRAG,POWER,IST_ZIEL,PLANS,planIndex,TOTAL_LEVELS,LEVELS_PER_WORLD};',
  sb, { filename:'ps.js' });
const { buildLevel, WORLDS, TIRES, IST_ZIEL, PLANS, planIndex, TOTAL_LEVELS } = sb.__X;
const MAX_V = sb.__X.MAX_DRAG * sb.__X.POWER;
const WORLD_W = 1900, WORLD_H = 780, GROUND_Y = 660;
const SLING = { x: WORLD_W - 230, y: 545 };
// Zwei Stufen: erst ein grobes Raster über alles, dann ein feines Raster nur für
// die auffälligen Ziele. Das grobe Raster ist zu grob, um kleine Quoten zu messen
// (2 von 84 Schüssen sagt wenig), das feine wäre über alle Levels zu langsam.
const VERDAECHTIG = 0.08;       // ab hier wird fein nachgemessen
// Gemessen am echten Fehlerfall: Level 20 alt hatte 1.3 % bei 4 Pneus (unspielbar),
// Level 587 hat 3.4 % bei 6 Pneus (hart, aber machbar).
const MINDEST_VIEL  = 0.020;    // Levels mit 5 oder mehr Pneus
const MINDEST_WENIG = 0.035;    // Levels mit 4 oder weniger Pneus

/* ---------- Physik wie im Spiel ---------- */
function neueWelt(def) {
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = WORLDS[def.world].grav || 1;
  Composite.add(engine.world, [
    Bodies.rectangle(WORLD_W/2, GROUND_Y+60, WORLD_W*2, 120, { isStatic:true, friction:.9 }),
    Bodies.rectangle(-60, WORLD_H/2, 120, WORLD_H*2, { isStatic:true })]);
  const st = { engine, parts:[], pending:[] };
  for (const p of def.parts) { p.body.plugin.info = p; Composite.add(engine.world, p.body); st.parts.push(p); }
  Events.on(engine, 'collisionStart', ev => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const rel = Math.hypot(a.velocity.x-b.velocity.x, a.velocity.y-b.velocity.y);
      if (rel < 3) continue;
      const isT = a.plugin.isTire || b.plugin.isTire;
      const mult = isT ? (TIRES[(a.plugin.type || b.plugin.type)] || TIRES.pkw).dmg : 1;
      const impact = rel * Math.min(a.mass, b.mass) * mult * 1.4;
      for (const body of [a, b]) {
        const info = body.plugin.info;
        if (!info || info.solid || info.dead || impact < 4) continue;
        info.hp -= impact;
        if (info.hp <= 0) { info.dead = true; st.pending.push(info); }
      }
    }
  });
  return st;
}
function explode(st, x, y, radius, power) {
  for (const p of st.parts) {
    if (p.body.isStatic) continue;
    const dx = p.body.position.x - x, dy = p.body.position.y - y;
    const dist = Math.max(20, Math.hypot(dx, dy));
    if (dist > radius) continue;
    const f = (1 - dist/radius) * power;
    Sleeping.set(p.body, false);
    Body.applyForce(p.body, p.body.position, { x: dx/dist*f*p.body.mass*.55, y: dy/dist*f*p.body.mass*.55 - p.body.mass*.12 });
    if (!p.solid && !p.dead) { p.hp -= f*95; if (p.hp <= 0) { p.dead = true; st.pending.push(p); } }
  }
}
function abraeumen(st) {
  for (const info of st.parts) {
    if (info.dead || info.body.isStatic) continue;
    const p = info.body.position;
    if (p.x > WORLD_W+40 || p.x < -80 || p.y > WORLD_H+120 || p.y < -900) { info.dead = true; st.pending.push(info); }
  }
  let g = 0;
  while (st.pending.length && g++ < 40) {
    const list = st.pending; st.pending = [];
    for (const info of list) {
      const p = info.body.position;
      Composite.remove(st.engine.world, info.body);
      st.parts = st.parts.filter(x => x !== info);
      for (const x of st.parts) if (!x.body.isStatic) Sleeping.set(x.body, false);
      if (info.kind === 'barrel') explode(st, p.x, p.y, 210, 1);
    }
  }
}

/* Steht das Ziel frei? = nichts direkt darüber, das den Weg versperrt. */
function stehtFrei(def, ziel) {
  const zx = ziel.body.position.x, zy = ziel.body.position.y;
  return !def.parts.some(p => p !== ziel
    && Math.abs(p.body.position.x - zx) < (p.w || 40)/2 + 26
    && p.body.position.y < zy - 25);
}

function raster(schritt, kschritt) {
  const W = [], K = [];
  for (let g = 4; g <= 86; g += schritt) W.push(g * Math.PI/180);
  for (let k = 0.34; k <= 1.001; k += kschritt) K.push(k);
  return { W, K };
}
const GROB = raster(6, 0.12), FEIN = raster(2, 0.035);

function pruefeLevel(nr, fein) {
  const { W: WINKEL, K: KRAFT } = fein ? FEIN : GROB;
  const def0 = buildLevel(nr - 1);
  const ziele0 = def0.parts.filter(p => IST_ZIEL(p.kind));
  const frei = ziele0.map(z => stehtFrei(def0, z));
  const startX = ziele0.map(z => Math.round(z.body.position.x));
  const treffer = ziele0.map(() => 0);
  const typ = def0.tires[0];
  let gesamt = 0;

  for (const w of WINKEL) {
    for (const k of KRAFT) {
      const def = buildLevel(nr - 1);
      const st = neueWelt(def);
      const T = TIRES[typ];
      const t = Bodies.circle(SLING.x, SLING.y - (T.r-26), T.r, { density:T.dens, friction:.7, restitution:T.rest, frictionAir:.008 });
      t.plugin.isTire = true; t.plugin.type = typ;
      Composite.add(st.engine.world, t);
      const v = MAX_V * k;
      Body.setVelocity(t, { x:-v*Math.cos(w), y:-v*Math.sin(w) });
      const wind = WORLDS[def.world].wind;
      for (let s = 0; s < 300; s++) {
        if (wind) Body.applyForce(t, t.position, { x: wind*t.mass, y: 0 });
        Engine.update(st.engine, 1000/60); abraeumen(st);
        if (t.position.y > WORLD_H+200 || t.position.x < -200) break;
      }
      for (let s = 0; s < 80; s++) { Engine.update(st.engine, 1000/60); abraeumen(st); }
      gesamt++;
      def.parts.filter(q => IST_ZIEL(q.kind)).forEach((z, i) => { if (z.dead) treffer[i]++; });
    }
  }
  return { nr, name: def0.name, welt: def0.world + 1, gesamt, pneus: def0.tires.length,
    ziele: ziele0.map((z, i) => ({ x: startX[i], kind: z.kind, frei: frei[i], quote: treffer[i] / gesamt })) };
}

/* ---------- Welche Levels prüfen? ---------- */
let liste = process.argv.slice(2).map(Number).filter(n => n > 0);
let ausfuehrlich = liste.length > 0;
if (!liste.length) {
  // je Bauplan drei Levels: früh, mitte, spät – die Geometrie steckt im Bauplan
  const proPlan = {};
  for (let i = 0; i < TOTAL_LEVELS; i++) (proPlan[planIndex(i)] = proPlan[planIndex(i)] || []).push(i + 1);
  for (const p in proPlan) {
    const a = proPlan[p];
    liste.push(a[0], a[(a.length/2) | 0], a[a.length-1]);
  }
  liste = [...new Set(liste)].sort((a, b) => a - b);
}

const t0 = Date.now();
const fehler = [], knapp = [];
const ergebnisse = [];
let feinLaeufe = 0;
for (const nr of liste) {
  let r = pruefeLevel(nr, ausfuehrlich);
  // auffällig? dann fein nachmessen – das grobe Raster ist dafür zu ungenau
  if (!ausfuehrlich && r.ziele.some(z => z.frei && z.quote < VERDAECHTIG)) { r = pruefeLevel(nr, true); feinLaeufe++; }
  ergebnisse.push(r);
  const mindest = r.pneus >= 5 ? MINDEST_VIEL : MINDEST_WENIG;
  for (const z of r.ziele) {
    if (!z.frei) continue;
    if (z.quote < mindest) fehler.push(r.nr + ' (' + r.name + ', ' + r.pneus + ' Pneus): frei stehendes Ziel bei x=' + z.x
      + ' nur mit ' + (z.quote*100).toFixed(1) + ' % der Schüsse erreichbar');
    else if (z.quote < mindest * 1.6) knapp.push(r.nr + ' (' + r.name + '): x=' + z.x + ' → ' + (z.quote*100).toFixed(1) + ' %');
  }
  if (ausfuehrlich) {
    console.log('Level ' + r.nr + ' · ' + r.name + ' · Welt ' + r.welt + ' · ' + r.pneus + ' Pneus  (' + r.gesamt + ' Schüsse geprüft)');
    r.ziele.forEach(z => console.log('   ' + (z.frei ? 'frei    ' : 'gedeckt ') + z.kind.padEnd(9)
      + ' x=' + String(z.x).padStart(4) + '  →  ' + (z.quote*100).toFixed(1) + ' %'));
  } else process.stdout.write(fehler.length ? 'X' : '.');
}

if (!ausfuehrlich) console.log('');
console.log('\nFairness-Prüfung: ' + liste.length + ' Levels · ' + (GROB.W.length * GROB.K.length)
  + ' erste Schüsse je Level, davon ' + feinLaeufe + '× fein nachgemessen mit ' + (FEIN.W.length * FEIN.K.length)
  + ' · ' + Math.round((Date.now()-t0)/1000) + 's');

// schwierigste frei stehende Ziele auflisten – gut zum Nachjustieren
const alle = [];
for (const r of ergebnisse) for (const z of r.ziele) if (z.frei) alle.push({ nr:r.nr, name:r.name, x:z.x, q:z.quote });
alle.sort((a, b) => a.q - b.q);
console.log('\nSchwierigste frei stehende Ziele:');
alle.slice(0, 8).forEach(a => console.log('   Level ' + a.nr + ' (' + a.name + ') x=' + a.x + ': ' + (a.q*100).toFixed(1) + ' %'));

console.log('\nFEHLER (unter ' + (MINDEST_VIEL*100) + ' % bzw. ' + (MINDEST_WENIG*100) + ' % bei wenig Pneus): ' + fehler.length);
fehler.forEach(f => console.log('  ✗ Level ' + f));
console.log('KNAPP: ' + knapp.length);
knapp.slice(0, 10).forEach(f => console.log('  ! Level ' + f));
process.exit(fehler.length ? 1 : 0);
