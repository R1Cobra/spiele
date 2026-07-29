// Roboter-Spieler: probiert pro Pneu 27 Schüsse durch, nimmt den besten (gierig),
// und schaut, ob das Level so geschafft wird. Ohne Spezialfähigkeiten – der Mensch hat also mehr.
const fs = require('fs'), vm = require('vm');
const Matter = require('matter-js');
const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const code = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).pop();

const elP = () => new Proxy({ style:{}, classList:{add(){},remove(){},toggle(){}}, textContent:'', innerHTML:'', value:'' },
  { get(t,k){ if (k in t) return t[k];
      if (['addEventListener','appendChild','focus','removeEventListener'].includes(k)) return () => {};
      if (k === 'getContext') return () => cxP(); return undefined; }, set(t,k,v){ t[k]=v; return true; } });
const cxP = () => new Proxy({}, { get(t,k){ if (k==='createLinearGradient') return () => ({addColorStop(){}}); return () => {}; }, set(){return true;} });
const sm = {};
const sb = { Matter, console, Math, JSON, Date, parseInt, parseFloat, isNaN, setTimeout: () => {}, requestAnimationFrame: () => {},
  localStorage: { getItem: k => (k in sm ? sm[k] : null), setItem: (k,v) => sm[k]=v },
  document: { getElementById: () => elP(), createElement: () => elP(), addEventListener: () => {} },
  window: { innerWidth:1200, innerHeight:700, devicePixelRatio:1, addEventListener: () => {},
    AudioContext: function(){ return { state:'running', currentTime:0, destination:{},
      createOscillator:()=>({frequency:{value:0,exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}),
      createGain:()=>({gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}}), resume(){} }; } } };
sb.window.localStorage = sb.localStorage;
vm.createContext(sb);
vm.runInContext(code + '\n;globalThis.__X={buildLevel,TOTAL_LEVELS,WORLDS,TIRES,VALUE,MAX_DRAG,POWER};', sb, {filename:'ps.js'});
const { buildLevel, TOTAL_LEVELS, WORLDS, TIRES } = sb.__X;

const WORLD_W = 1900, WORLD_H = 780, GROUND_Y = 660;
const SLING = { x: WORLD_W - 230, y: 545 };
// Schleuderkraft direkt aus dem Spiel übernehmen – nicht doppelt pflegen
const MAX_V = sb.__X.MAX_DRAG * sb.__X.POWER;

// ---- Spiel-Regeln nachgebaut ----
function neueWelt(def) {
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = WORLDS[def.world].grav || 1;
  Composite.add(engine.world, [
    Bodies.rectangle(WORLD_W/2, GROUND_Y+60, WORLD_W*2, 120, { isStatic:true, friction:.9 }),
    Bodies.rectangle(-60, WORLD_H/2, 120, WORLD_H*2, { isStatic:true })]);
  const st = { engine, parts:[], blitzer:0, civil:0, punkte:0, pending:[] };
  for (const p of def.parts) {
    p.hp = p.maxHp; p.dead = false;
    p.body.plugin.info = p;
    Composite.add(engine.world, p.body);
    st.parts.push(p);
    if (p.kind === 'blitzer') st.blitzer++;
  }
  Events.on(engine, 'collisionStart', ev => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const rel = Math.hypot(a.velocity.x-b.velocity.x, a.velocity.y-b.velocity.y);
      if (rel < 3) continue;
      const T = TIRES[a.plugin.type || b.plugin.type];
      const mult = (a.plugin.isTire || b.plugin.isTire) ? (T ? T.dmg : 1) : 1;
      const imp = rel * Math.min(a.mass, b.mass) * mult * 1.4;
      schaden(st, a.plugin.info, imp); schaden(st, b.plugin.info, imp);
    }
  });
  return st;
}
function schaden(st, info, dmg) {
  if (!info || info.solid || info.dead || dmg < 4) return;
  info.hp -= dmg;
  if (info.hp <= 0) { info.dead = true; st.pending.push(info); }
}
function abraeumen(st) {
  let g = 0;
  while (st.pending.length && g++ < 40) {
    const list = st.pending; st.pending = [];
    for (const info of list) {
      const p = info.body.position;
      Composite.remove(st.engine.world, info.body);
      st.parts = st.parts.filter(x => x !== info);
      for (const x of st.parts) if (!x.body.isStatic) Sleeping.set(x.body, false);
      if (info.kind === 'blitzer') { st.blitzer--; st.punkte += 500; }
      else if (info.kind === 'civil') { st.civil++; st.punkte -= 750; }
      else if (info.kind === 'barrel') { st.punkte += 150; explode(st, p.x, p.y, 210, 1); }
      else st.punkte += 50;
    }
  }
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
    schaden(st, p, f * 95);
  }
}
function schuss(st, typ, winkel, kraft) {
  const T = TIRES[typ];
  const t = Bodies.circle(SLING.x, SLING.y - (T.r-26), T.r, { density:T.dens, friction:.7, restitution:T.rest, frictionAir:.008 });
  t.plugin.isTire = true; t.plugin.type = typ;
  Composite.add(st.engine.world, t);
  const v = MAX_V * kraft;
  Body.setVelocity(t, { x: -v*Math.cos(winkel), y: -v*Math.sin(winkel) });
  const wind = WORLDS[st.world] && WORLDS[st.world].wind;
  for (let s = 0; s < 300; s++) {
    if (wind) Body.applyForce(t, t.position, { x: wind*t.mass, y: 0 });
    Engine.update(st.engine, 1000/60);
    abraeumen(st);
    if (t.position.y > WORLD_H+200 || t.position.x < -200) break;
  }
  for (let s = 0; s < 60; s++) { Engine.update(st.engine, 1000/60); abraeumen(st); }  // nachwirken lassen
  Composite.remove(st.engine.world, t);
}
function spiele(i, schuesse) {   // Level FRISCH bauen (neue Bodies!), dann alle bisherigen Schüsse wiederholen
  const def = buildLevel(i);
  const st = neueWelt(def); st.world = def.world;
  for (const s of schuesse) schuss(st, s.typ, s.w, s.k);
  return st;
}

const WINKEL = [6,11,16,21,26,31,36,41,46,52,58,64,70,76].map(g => g*Math.PI/180);
const KRAFT = [0.5, 0.65, 0.8, 0.9, 1.0];

function roboter(i) {
  const def = buildLevel(i);
  const schuesse = [];
  for (let n = 0; n < def.tires.length; n++) {
    const typ = def.tires[n];
    let best = null;
    for (const w of WINKEL) for (const k of KRAFT) {
      const st = spiele(i, schuesse);
      if (st.blitzer === 0) { best = null; break; }
      const vorher = st.blitzer, civ0 = st.civil, pk0 = st.punkte;
      schuss(st, typ, w, k);
      const wert = (vorher - st.blitzer)*1000 + (st.punkte - pk0) - (st.civil - civ0)*750;
      if (!best || wert > best.wert) best = { wert, w, k };
    }
    if (!best) break;
    schuesse.push({ typ, w: best.w, k: best.k });
    const st = spiele(i, schuesse);
    if (st.blitzer === 0) return { ok:true, n: n+1, von: def.tires.length, civil: st.civil, def };
  }
  const st = spiele(i, schuesse);
  return { ok: st.blitzer === 0, rest: st.blitzer, n: schuesse.length, von: def.tires.length, civil: st.civil, def };
}

// Standard: jedes vierte Level. Mit «node pruefung/test-roboter.js alle» werden
// alle 500 geprüft (dauert ein paar Minuten).
const alle = process.argv.includes('alle');
const proben = [];
for (let i = 0; i < TOTAL_LEVELS; i += (alle ? 1 : 4)) proben.push(i);
if (!alle) proben.push(TOTAL_LEVELS - 1);

let ok = 0, fail = [];
const t0 = Date.now();
for (const i of proben) {
  const r = roboter(i);
  if (r.ok) ok++;
  else fail.push('Level ' + (i+1) + ' (Welt ' + (r.def.world+1) + ', ' + r.def.name + '): ' + r.rest + ' Blitzer übrig, ' + r.von + ' Pneus');
  process.stdout.write(r.ok ? '.' : 'X');
}
console.log('\n\nRoboter-Test: ' + ok + '/' + proben.length + ' Levels geschafft  (' + Math.round((Date.now()-t0)/1000) + 's)');
fail.forEach(f => console.log('  X ' + f));
