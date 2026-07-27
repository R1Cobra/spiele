// Baut jedes der 500 Levels mit ECHTER Matter-Physik auf und lässt es 3 Sekunden ruhen.
// Ein gutes Level darf nicht von allein einstürzen.
const fs = require('fs'), vm = require('vm');
const Matter = require('matter-js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const code = blocks[blocks.length - 1];

const elProxy = () => new Proxy({ style:{}, classList:{add(){},remove(){},toggle(){}}, textContent:'', innerHTML:'', value:'' },
  { get(t,k){ if (k in t) return t[k];
      if (['addEventListener','appendChild','focus','removeEventListener'].includes(k)) return () => {};
      if (k === 'getContext') return () => ctxProxy(); return undefined; },
    set(t,k,v){ t[k]=v; return true; } });
const ctxProxy = () => new Proxy({}, { get(t,k){ if (k==='createLinearGradient') return () => ({addColorStop(){}}); return () => {}; }, set(){return true;} });
const sm = {};
const sandbox = { Matter, console, Math, JSON, Date, parseInt, parseFloat, isNaN, setTimeout: () => {}, requestAnimationFrame: () => {},
  localStorage: { getItem: k => (k in sm ? sm[k] : null), setItem: (k,v) => sm[k]=v },
  document: { getElementById: () => elProxy(), createElement: () => elProxy(), addEventListener: () => {} },
  window: { innerWidth:1200, innerHeight:700, devicePixelRatio:1, addEventListener: () => {},
    AudioContext: function(){ return { state:'running', currentTime:0, destination:{},
      createOscillator:()=>({frequency:{value:0,exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}),
      createGain:()=>({gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}}), resume(){} }; } } };
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);
vm.runInContext(code + '\n;globalThis.__X={buildLevel,TOTAL_LEVELS,WORLDS,LEVELS_PER_WORLD,VALUE};', sandbox, {filename:'ps.js'});
const { buildLevel, TOTAL_LEVELS, WORLDS, LEVELS_PER_WORLD } = sandbox.__X;

const { Engine, Bodies, Composite, Events } = Matter;
const WORLD_W = 1900, WORLD_H = 780, GROUND_Y = 660;

let einbrueche = [], selbstzerstoerung = [], startOverlap = [];
let maxDrift = 0, driftSum = 0;

for (let i = 0; i < TOTAL_LEVELS; i++) {
  const def = buildLevel(i);
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = WORLDS[def.world].grav || 1;
  const ground = Bodies.rectangle(WORLD_W/2, GROUND_Y+60, WORLD_W*2, 120, { isStatic:true, friction:.9 });
  Composite.add(engine.world, [ground, Bodies.rectangle(-60, WORLD_H/2, 120, WORLD_H*2, { isStatic:true })]);

  const start = [];
  for (const p of def.parts) {
    p.body.plugin.info = p;
    Composite.add(engine.world, p.body);
    start.push({ p, x:p.body.position.x, y:p.body.position.y });
  }

  // Schadensmodell wie im Spiel (vereinfacht: nur Trefferenergie zählen)
  let zerstoert = { blitzer:0, civil:0, andere:0 };
  Events.on(engine, 'collisionStart', ev => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const rel = Math.hypot(a.velocity.x-b.velocity.x, a.velocity.y-b.velocity.y);
      if (rel < 3) continue;
      const impact = rel * Math.min(a.mass, b.mass) * 1.4;
      for (const body of [a, b]) {
        const info = body.plugin.info;
        if (!info || info.solid || info.dead || impact < 4) continue;
        info.hp -= impact;
        if (info.hp <= 0) { info.dead = true;
          zerstoert[info.kind === 'blitzer' ? 'blitzer' : info.kind === 'civil' ? 'civil' : 'andere']++; }
      }
    }
  });

  for (let s = 0; s < 180; s++) Engine.update(engine, 1000/60);   // 3 Sekunden

  let drift = 0, wandert = 0;
  for (const s of start) {
    const d = Math.hypot(s.p.body.position.x - s.x, s.p.body.position.y - s.y);
    if (d > drift) drift = d;
    if (d > 55) wandert++;
  }
  driftSum += drift; if (drift > maxDrift) { maxDrift = drift; var maxLevel = i + 1; }
  if (wandert >= 3) einbrueche.push('Level ' + (i+1) + ': ' + wandert + ' Teile verrutscht (max ' + Math.round(drift) + 'px)');
  if (zerstoert.blitzer) selbstzerstoerung.push('Level ' + (i+1) + ': ' + zerstoert.blitzer + ' Blitzer fallen von selbst um');
  if (zerstoert.civil) selbstzerstoerung.push('Level ' + (i+1) + ': Fahrschüler stirbt von selbst!');
}

console.log('Levels simuliert:', TOTAL_LEVELS, '· je 3 Sekunden Ruhe');
console.log('grösste Bewegung ohne Schuss:', Math.round(maxDrift) + 'px (Level ' + maxLevel + ') · Durchschnitt:', Math.round(driftSum/TOTAL_LEVELS) + 'px');
console.log('\nEinstürze (>=3 verrutschte Teile): ' + einbrueche.length);
einbrueche.slice(0, 20).forEach(e => console.log('  ! ' + e));
console.log('Selbstzerstörung: ' + selbstzerstoerung.length);
selbstzerstoerung.slice(0, 20).forEach(e => console.log('  ✗ ' + e));
