// Rajo Kart 26 — módulo principal: estado del juego, tráfico, reglas (step), HUD, avisos, entradas y bucle. El mundo lo arman js/terreno (al importarse) y js/operaciones (pasos de abajo).
import { CRASH_U, CRUISE, FOLLOW_DIST, LANE, REQ_RANGE, SPEED_LIMIT, TAU, VTOP } from './config/diseno.js';
import { paso } from './comun/pasos.js';
import { addPlates, bas, blob, box, brakeMat, cyl, lam, rockGeo } from './modelos/materiales.js';
import { camera, renderer, resize, scene } from './escena.js';
import { CAEX_LANE, CELL, F7EQ, GAP, GD, GNX, GNZ, GX0, GZ0, H, L, PAD_UP, PIT, PITC, PLAT, PLAT7, POST, RED52, SMIN, START_S, START_U0, ZONE_S, f7h, frame, inF7, seedWet, slickNow, updateRoad, wetRange } from './terreno/construir.js';
import { ALJ_PLATE, CAEX_PLATE, buildPickup, nextCaexId, protoAlj, protoOnc, protoSame, resetCaexIds, updateSpray } from './modelos/camiones.js';
import { buildDozerConRoca } from './modelos/dozers.js';
import { mundo as M, setWorldPose } from './mundo.js';
import { onRoadC } from './operaciones/malla.js';
import { animOps, buildDrills, buildOps } from './operaciones/carguio.js';
import { buildCable2, buildPowerLine, buildSem6 } from './operaciones/cables.js';
/* ───────────── Vehículos: los modelos están en js/modelos (camiones, palas, perforadoras, dozers) ───────────── */



const _look = new THREE.Vector3();
function place(mesh, s, u, dir, lat) {
  const f = frame(s), x = f.x + f.rx * u, z = f.z + f.rz * u, y = H(x, z) + 0.1;
  const sl = (H(x + f.tx * 3, z + f.tz * 3) - H(x - f.tx * 3, z - f.tz * 3)) / 6;
  mesh.position.set(x, y, z);
  _look.set(x + dir * f.tx + f.rx * (lat || 0), y + dir * sl, z + dir * f.tz + f.rz * (lat || 0));
  mesh.lookAt(_look);
  return y;
}

const pickup = buildPickup(); scene.add(pickup);
const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshBasicMaterial({ color: 0xffffff })); marker.visible = false; scene.add(marker);

/* ───────────── Estado del juego ───────────── */
const keys = { up: false, down: false, left: false, right: false };
const P = { s: 10, u: -LANE, v: 0, vu: 0, y: 0 };
const OBST = [];      // equipos detenidos en las bahías (x, z, radio): en el tránsito libre no se pueden atravesar
let free = null;      // tránsito libre por la fase 7 antes de tomar la Rampa Sur: { x, z, a }
const trucks = [], oncs = [], rocks = [], rocasPista = [];
let mode = 'menu', tGame = 0, tAnim = 0, overtakes = 0, spawnT = 8, wrongT = 0, beepT = 0, bannerT = 0;
let radioTimer = 0, shake = 0, aljT = 0, rockT = 6, pickT = 20, skidT = 0, camBeepT = 0, gapBeepT = 0, crashSide = 0, crashT = 0, fall = null, crashFall = false, crush = null, intro = null, arrive = null;

const $ = id => document.getElementById(id);
const el = { hud: $('hud'), kmh: $('kmh'), bar: $('barfill'), spd: $('spd'), alt: $('alt'), altmax: $('altmax'), tm: $('tm'), ovk: $('ovk'),
  alerts: $('alerts'), banner: $('banner'), radio: $('radio'), auth: $('auth'), ovStart: $('ovStart'), ovEnd: $('ovEnd') };
el.altmax.textContent = Math.round(L - START_S);
const pad = n => String(n).padStart(2, '0');
const fmt = t => Math.floor(t / 60) + ':' + pad(Math.floor(t % 60));

function mkSame(s, id) {
  const mesh = protoSame.clone(true); const b = mesh.getObjectByName('beacon'); b.material = b.material.clone(); scene.add(mesh);
  addPlates(mesh, id, CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s);
  return { id, s, u: -LANE, v: 0, v0: 2.0 + Math.random() * 1.6, mesh, beacon: b, auth: false, passed: false, prevD: s - P.s };
}
const protoPick = [buildPickup(0xc9141c, true)];      // camionetas en contra: rojas y doble cabina, como la tuya
function mkOncPickup(s) {      // camioneta que baja por la pista contraria (solo en ese sentido)
  const mesh = protoPick[Math.floor(Math.random() * protoPick.length)].clone(true), b = mesh.getObjectByName('beacon'); b.material = b.material.clone(); scene.add(mesh);
  const v0 = 6.5 + Math.random() * 2;
  return { s, u: LANE + (Math.random() - 0.5) * 1.0, v0, v: v0, kind: 'pickup', cl: 5.2, cw: 2.5, mesh, beacon: b };
}
function mkOnc(s) {
  const mesh = protoOnc.clone(true); const b = mesh.getObjectByName('beacon'); b.material = b.material.clone(); scene.add(mesh);
  const v0 = 4 + Math.random() * 2;
  addPlates(mesh, 100 + Math.floor(Math.random() * 90), CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s);
  return { s, u: LANE, v0, v: v0, kind: 'caex', cl: 9.8, cw: 5.2, mesh, beacon: b };      // CAEX a escala real (~15 × 9 m)
}
function mkAlj(s) {
  const mesh = protoAlj.clone(true); const b = mesh.getObjectByName('beacon'); b.material = b.material.clone(); scene.add(mesh);
  addPlates(mesh, 703, ALJ_PLATE.f, ALJ_PLATE.r, ALJ_PLATE.s);
  return { s, u: LANE, v0: 4.2, v: 4.2, kind: 'aljibe', cl: 7.8, cw: 4.2, mesh, beacon: b, spray: mesh.getObjectByName('spray'), cyc: 0, spraying: true };
}
/* ───────────── Operaciones mineras: en js/operaciones (carguio, malla, cables). Aquí solo se llena el mundo compartido y se llaman los pasos ───────────── */
Object.assign(M, { scene, H, frame, OBST, GD, GX0, GZ0, GNX, GNZ, CELL, PLAT7, PLAT, PITC, F7EQ, RED52, PIT, f7h, PAD_UP });      // lo que las operaciones necesitan del mundo
paso('operaciones: canchas de perforación, palas cargando, dozers y huellas', () => { buildDrills(); buildOps(); });
paso('cables: subestaciones, postes pasacables y SEM 6', () => { buildPowerLine(); buildCable2(); buildSem6(); });

/* ───────────── Final: domo mirador y estacionamiento de camiones ───────────── */
const END_S = L + 205;      // aquí se estaciona la camioneta, frente a la puerta del domo
paso('domo mirador', () => {
  const at = (s, u) => { const f = frame(s); return { x: f.x + f.rx * u, z: f.z + f.rz * u, f }; };
  const dark = lam(0x222426), conc = lam(0x8d8a84);
  // domo (cúpula geodésica con cinta de ventanales, entrada, letrero y bandera)
  const dc = at(L + 4, -44), dome = new THREE.Group();      // domo en el punto final del plano
  const base = new THREE.Mesh(new THREE.CylinderGeometry(15.5, 16, 1.4, 36), conc); base.position.y = 0.7; dome.add(base);
  const hemi = new THREE.SphereGeometry(14, 30, 15, 0, Math.PI * 2, 0, Math.PI / 2);
  const shell = new THREE.Mesh(hemi, new THREE.MeshPhongMaterial({ color: 0xf1f1ee, flatShading: true, shininess: 40 })); shell.position.y = 1.4; dome.add(shell);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(hemi), new THREE.LineBasicMaterial({ color: 0x9a9a96 })); wire.position.y = 1.4; dome.add(wire);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(14.2, 14.2, 2.6, 36, 1, true), new THREE.MeshBasicMaterial({ color: 0x1d2c3a, side: THREE.DoubleSide })); glass.position.y = 4.2; dome.add(glass);
  box(dome, 4.8, 4.2, 1.4, dark, 0, 3.5, 13.9); box(dome, 9, 0.5, 4.5, lam(0xc9141c), 0, 6.0, 15.6);
  box(dome, 6, 0.12, 22, conc, 0, 0.1, 26);                                     // vereda de acceso
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 512, 160); x.fillStyle = '#0b5a9c'; x.fillRect(0, 0, 512, 46); x.fillStyle = '#fff'; x.font = '700 30px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SIERRA GORDA', 256, 25);
  x.fillStyle = '#1b1b18'; x.font = '800 62px Arial Narrow, Arial'; x.fillText('DOMO MIRADOR', 256, 108);
  box(dome, 0.3, 4.5, 0.3, dark, -4.2, 2.25, 27); box(dome, 0.3, 4.5, 0.3, dark, 4.2, 2.25, 27);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 2.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide })); sg.position.set(0, 4.3, 27); dome.add(sg);
  const fc = document.createElement('canvas'); fc.width = 120; fc.height = 80; const fx = fc.getContext('2d');       // bandera de Chile
  fx.fillStyle = '#fff'; fx.fillRect(0, 0, 120, 40); fx.fillStyle = '#d52b1e'; fx.fillRect(0, 40, 120, 40); fx.fillStyle = '#0039a6'; fx.fillRect(0, 0, 40, 40);
  fx.fillStyle = '#fff'; fx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 11, a = -Math.PI / 2 + i * Math.PI / 5; fx.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); } fx.fill();
  cyl(dome, 0.18, 0.18, 15, conc, 15, 7.5, 20);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), side: THREE.DoubleSide })); flag.position.set(17.2, 13.4, 20); dome.add(flag);
  dome.position.set(dc.x, H(dc.x, dc.z), dc.z); dome.rotation.y = Math.atan2(dc.f.rx, dc.f.rz); scene.add(dome);
  // camiones estacionados (nariz hacia afuera), un aljibe y camionetas
  const freeze = m => { m.updateMatrixWorld(true); m.traverse(o => { o.matrixAutoUpdate = false; }); };
  const park = (proto, s, u, face, num, plates) => {
    const p = at(s, u), m = proto.clone(true); if (plates) addPlates(m, num, plates.f, plates.r, plates.s);
    scene.add(m); setWorldPose(m, p.x, p.z, p.f.rx * face, p.f.rz * face); freeze(m); return m;
  };
  for (let i = 0; i < 5; i++) park(protoOnc, L + 95 + i * 10.8, -34, -1, 140 + i, CAEX_PLATE);
  for (let i = 0; i < 4; i++) park(protoOnc, L + 100 + i * 10.8, -54, 1, 150 + i, CAEX_PLATE);
  const aj = park(protoAlj, L + 150, -34, -1, 703, ALJ_PLATE); const sp = aj.getObjectByName('spray'); if (sp) sp.visible = false;
  park(protoPick[0], L + 178, -24, 1, 0, null); park(protoPick[0], L + 190, -24, 1, 0, null);
});
(() => { // estacionamiento CAEX junto al poste pasacable (desactivado hasta ubicar la bahía)
  if (!CAEX_LANE.on) return;
  const freeze = m => { m.updateMatrixWorld(true); m.traverse(o => { o.matrixAutoUpdate = false; }); };
  const pt = (s, u) => { const f = frame(s); return { x: f.x + f.rx * u, z: f.z + f.rz * u, f }; };
  for (const [s, u, num] of [[CAEX_LANE.a + 46, 42, 161], [CAEX_LANE.a + 66, 42, 162]]) {
    const p = pt(s, u), m = protoOnc.clone(true); addPlates(m, num, CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s); scene.add(m);
    setWorldPose(m, p.x, p.z, -p.f.rx, -p.f.rz); freeze(m);
  }
  const q = pt(CAEX_LANE.a + 56, 34), g = new THREE.Group(), red = lam(0xe0401a), wh = lam(0xf4f4f4);      // poste pasacable: rojo y blanco con cruceta
  for (let y = 0; y < 9; y += 1.5) box(g, 0.35, 1.5, 0.35, (Math.floor(y / 1.5) % 2) ? wh : red, 0, y + 0.75, 0);
  box(g, 2.2, 0.3, 0.3, wh, 0, 9, 0);
  g.position.set(q.x, H(q.x, q.z), q.z); scene.add(g);
})();

const ROCK_ZIG = [[22, -8.2], [54, -2.6], [86, -8.2]];     // [metros desde el inicio de la zona, posición lateral]: zigzag entre tu pista y el centro
const fallRocks = [];
function resetFallRocks() {
  for (const r of fallRocks) scene.remove(r.mesh);
  fallRocks.length = 0;
  if (TEST) return;      // modo prueba: sin caída de rocas
  for (const [ds, u] of ROCK_ZIG) { const c = mkRoca(ZONE_S + ds, u); c.mesh.visible = false; c.state = 'wait'; c.t = 0; fallRocks.push(c); }
}
function updateFallRocks(dt) {
  for (const r of fallRocks) {
    if (r.state === 'wait') {
      if (r.s - P.s < 42 + 1.4 * P.v && r.s > P.s - 6) {      // se suelta cuando te acercas: cae del cerro y llega al camino antes que tú
        const f = frame(r.s - 4), sg = H(f.x + f.rx * 20, f.z + f.rz * 20) > H(f.x - f.rx * 20, f.z - f.rz * 20) ? 1 : -1;
        const sx = f.x + f.rx * sg * 24, sz = f.z + f.rz * sg * 24;
        r.from = { x: sx, y: H(sx, sz) + 16, z: sz }; r.state = 'fall'; r.t = 0; r.mesh.visible = true;
      }
    } else if (r.state === 'fall') {
      r.t += dt; const k = Math.min(1, r.t / 1.3), f = frame(r.s);
      const lx = f.x + f.rx * r.u, lz = f.z + f.rz * r.u, ly = H(lx, lz) + 0.1;
      r.mesh.position.set(r.from.x + (lx - r.from.x) * k, r.from.y + (ly - r.from.y) * k * k, r.from.z + (lz - r.from.z) * k);
      r.mesh.rotation.x += 6 * dt; r.mesh.rotation.z += 4 * dt;
      if (k >= 1) { place(r.mesh, r.s, r.u, 1, 0); r.state = 'done'; rocasPista.push(r); beep(70, 0.3, 'triangle', 0.1); if (Math.abs(r.s - P.s) < 90) shake = Math.max(shake, 0.4); }
    }
  }
}
function mkRoca(s, uFix) {      // roca grande caída en la pista (se esquiva por derecha o izquierda)
  const g = new THREE.Group(), mats = [lam(0x5d4c3b), lam(0x6f5b47), lam(0x4e3f31)];
  const part = (x, z, sx, sy, sz, k) => { const r = new THREE.Mesh(rockGeo, mats[k]); r.scale.set(sx, sy, sz); r.position.set(x, sy * 0.8, z); r.rotation.set(Math.random() * 0.6, Math.random() * 6, Math.random() * 0.6); g.add(r); };
  part(0, 0, 1.55, 1.05, 1.45, 0); part(1.1, -0.7, 0.8, 0.6, 0.75, 1); part(-1.0, 0.8, 0.7, 0.55, 0.7, 2); part(0.2, 1.2, 0.5, 0.4, 0.5, 1);
  blob(g, 6, 6); g.scale.set(1.15, 1.15, 1.15);
  const u = uFix != null ? uFix : -LANE + (Math.random() - 0.4) * 1.4;
  scene.add(g); place(g, s, u, 1, 0);
  return { s, u, r: 1.8, mesh: g };
}
const FREE0 = (() => {      // partida en el piso de la fase 7, en el extremo más alejado de la Rampa Sur
  const f0 = frame(START_S); let best = null;
  for (let iz = 0; iz < GNZ; iz += 2) for (let ix = 0; ix < GNX; ix += 2) {
    const i = iz * GNX + ix; if (GD[i] !== -1) continue; const x = GX0 + ix * CELL, z = GZ0 + iz * CELL; if (!inF7(x, z)) continue;
    let ok = true; for (let a = 0; a < 12 && ok; a++) { const qx = x + Math.cos(a * TAU / 12) * 14, qz = z + Math.sin(a * TAU / 12) * 14; if (Math.abs(H(qx, qz) - f7h(qx, qz)) > 0.4) ok = false; }
    if (!ok || OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 22)) continue;
    const d = Math.hypot(x - f0.x, z - f0.z); if (d > 390) continue;
    const gm = M.GATE ? { x: (M.GATE.p[0].x + M.GATE.p[1].x) / 2, z: (M.GATE.p[0].z + M.GATE.p[1].z) / 2 } : f0; let clear = true;      // camino recto despejado hasta el portón
    for (let t = 0; t <= 1 && clear; t += 0.03) { const qx = x + (gm.x - x) * t, qz = z + (gm.z - z) * t; if (Math.abs(H(qx, qz) - f7h(qx, qz)) > 6 && !onRoadC(qx, qz) || OBST.some(o => Math.hypot(o.x - qx, o.z - qz) < o.r + 5)) clear = false; }
    if (!clear) continue; if (!best || d > best.d) best = { x, z, d };
  }
  if (!best) return null;
  return { x: best.x, z: best.z, a: Math.atan2(f0.z - best.z, f0.x - best.x) };
})();
const freeBlocked = (x, z, hx, hz) => {      // talud, pila o caída adelante, o un equipo detenido
  if (x < GX0 + 10 || z < GZ0 + 10 || x > GX0 + (GNX - 1) * CELL - 10 || z > GZ0 + (GNZ - 1) * CELL - 10) return true;      // fin del terreno
  const h0 = H(x, z), h1 = H(x + hx * 3, z + hz * 3);
  if (Math.abs(h1 - h0) > 2.2) return true;      // más de ~35°: talud, pila o caída
  return OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r);
};
function stepFree(dt) {      // tránsito libre por el piso de la fase 7 (sin pistas ni reglas): se toma la Rampa Sur al llegar a ella
  const F = free, thr = Math.max(keys.up ? 1 : 0, inp.thr), brk = Math.max(keys.down ? 1 : 0, inp.brk);
  const vt = 8.3 + (TEST ? 13.9 : 5.6) * thr;      // 30 km/h sola, hasta 50 con ↑ o el pedal (80 en modo prueba)
  let acc; if (brk > 0.05) acc = -7 * brk; else if (P.v < vt) acc = Math.min(2.8, (vt - P.v) * 2.5 + 0.2); else acc = -Math.min(1.5, (P.v - vt) * 4);
  P.v = clamp(P.v + acc * dt, 0, VTOP);
  const kbs = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), steer = kbs || (inp.analog && Math.abs(inp.steer) > 0.05 ? inp.steer : 0);
  F.a += steer * Math.max(0.7, Math.min(P.v / 9, 1.3)) * dt;      // también gira detenida, para salir de un talud
  const hx = Math.cos(F.a), hz = Math.sin(F.a), nx = F.x + hx * P.v * dt, nz = F.z + hz * P.v * dt;
  let gateMsg = false;
  if (M.GATE && !F.gate && !TEST) {      // solo se llega a la Rampa Sur pasando entre los postes pasacables
    const near = (x, z) => { let b = null; for (let s = START_S; s < START_S + 260; s += 2) { const f = frame(s), d = Math.hypot(f.x - x, f.z - z); if (!b || d < b.d) b = { s, d }; } return b; };
    const hiA = H(F.x, F.z) > f7h(F.x, F.z) + 3, hiN = H(nx, nz) > f7h(nx, nz) + 3;      // arriba de la rampa o en la cancha de perforación (sobre el piso de la bahía) no rige el portón
    if (!hiN) { const a = near(F.x, F.z), b = near(nx, nz);
      if (a.d >= M.GATE.d && b.d < M.GATE.d) { if (b.s > M.GATE.s0 + 1.5 && b.s < M.GATE.s1 - 1.5) F.gate = true; else gateMsg = true; }
      else if (hiA && b.d < M.GATE.d) gateMsg = true; }      // bajar de la cancha hacia el camino tampoco vale: al camino se entra por el portón
  }
  if (gateMsg) { P.v = 0; setBanner('Entra a la Rampa Sur por entre los postes pasacables.', 'warn'); bannerT = 2; }
  else if (freeBlocked(nx, nz, hx, hz)) { if (P.v > 3) { beep(90, 0.18, 'sawtooth', 0.06); shake = Math.max(shake, 0.3); } P.v = 0; }
  else { F.x = nx; F.z = nz; }
  if (TEST) return;      // modo prueba: recorrido libre por toda la mina (no se amarra a la Rampa Sur)
  // ¿llegó a la Rampa Sur? (tramo junto a la fase 7)
  let bs = null; for (let s = START_S; s < START_S + 260; s += 2) { const f = frame(s), d = (f.x - F.x) ** 2 + (f.z - F.z) ** 2; if (!bs || d < bs.d) bs = { s, d, f }; }
  const f = bs.f, u = (F.x - f.x) * f.rx + (F.z - f.z) * f.rz;
  if ((F.gate || !M.GATE) && Math.abs(u) < CRASH_U - 2.5 && Math.abs((F.x - f.x) * f.tx + (F.z - f.z) * f.tz) < 3) {
    const along = hx * f.tx + hz * f.tz, side = hx * f.rx + hz * f.rz;
    Object.assign(P, { s: bs.s, u, v: P.v * Math.max(0.4, along), vu: P.v * side * 0.5 }); free = null; camSnap = false;
    setBanner('Tomaste la Rampa Sur. ¡Circula por la izquierda!', 'ok'); bannerT = 2.5;
  }
}
function resetGame() {
  resetCaexIds();
  for (const t of trucks.concat(oncs)) scene.remove(t.mesh);
  for (const r of rocks) scene.remove(r.mesh);
  for (const c of rocasPista) scene.remove(c.mesh);
  rocasPista.length = 0;
  if (!TEST) for (let cs = START_S + 130 + Math.random() * 40; cs < L - 70; cs += 150 + Math.random() * 130) if (!PLAT || Math.abs(cs - PLAT.se) > PLAT.HL + 60) rocasPista.push(mkRoca(cs));
  resetFallRocks();
  trucks.length = 0; oncs.length = 0; rocks.length = 0; rockT = 6; crashSide = 0; crashT = 0; fall = null; crashFall = false; crush = null; arrive = null; pickup.scale.set(1, 1, 1);
  Object.assign(P, { s: START_S, u: START_U0, v: 0, vu: 0 }); intro = null; free = FREE0 ? { x: FREE0.x, z: FREE0.z, a: FREE0.a } : null;
  tGame = 0; overtakes = 0; spawnT = 8; wrongT = 0; beepT = 0; shake = 0;
  let s = START_S + 110;
  while (s < L - 60) { trucks.push(mkSame(s, nextCaexId())); s += 130 + Math.random() * 110; }
  for (let rs = CAEX_LANE.a + 30; rs < CAEX_LANE.b - 60; rs += 170) { const t = mkSame(rs, nextCaexId()); t.u = CAEX_LANE.u; trucks.push(t); }      // CAEX en el carril solo CAEX
  const alj = mkAlj(P.s + 190); oncs.push(alj);       // un solo aljibe: viene bajando y deja el camino mojado
  alj.cyc = 4; seedWet(alj.s + 7, alj.v, alj.cyc); aljT = 80 + Math.random() * 50; pickT = 20 + Math.random() * 15; updateRoad(0);
  if (TEST) { for (const t of trucks.concat(oncs)) scene.remove(t.mesh); trucks.length = 0; oncs.length = 0; }      // modo prueba: camino libre
  setBanner('');
}

/* Audio */
let ac = null, eng = null, engG = null, muted = false;
let bus = null;
function getBus() {      // volumen general: sube todo el sonido (con compresor para que no distorsione)
  if (!bus && ac) { bus = ac.createGain(); bus.gain.value = 3.2; const cp = ac.createDynamicsCompressor(); cp.threshold.value = -14; cp.ratio.value = 6; bus.connect(cp); cp.connect(ac.destination); }
  return bus;
}
function beep(f, d, type, v, delay) {
  if (!ac || muted) return;
  const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(getBus()); o.start(t); o.stop(t + d + 0.02);
}
function startEngine() {
  if (!ac || eng) return;
  eng = ac.createOscillator(); engG = ac.createGain(); const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 360; eng.type = 'sawtooth'; eng.frequency.value = 46; engG.gain.value = muted ? 0 : 0.022;
  eng.connect(f); f.connect(engG); engG.connect(getBus()); eng.start();
}
function stopEngine() { if (eng) { try { eng.stop(); } catch (e) {} eng = null; engG = null; } }
$('snd').addEventListener('click', e => { muted = !muted; e.target.textContent = 'Sonido: ' + (muted ? 'no' : 'sí'); if (engG) engG.gain.value = muted ? 0 : 0.022; });

/* HUD helpers */
let alSig = '', alKeys = new Set(), alVoiceT = {};
const AL_VOICE = { roca: 'Roca adelante', caex: 'Mantén distancia con el camión', vel: 'Exceso de velocidad', mojado: 'Piso mojado, reduce la velocidad', pl: 'Cuidado con el pretil', pr: 'Cuidado con el pretil', pista: 'Vuelve a tu pista', contra: 'Tráfico en contra', zona: 'Zona de caída de rocas' };
function speak(txt) {      // aviso hablado, como en Waze (solo si el sonido está activo)
  try {
    if (muted || !window.speechSynthesis || mode !== 'play') return;
    const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-CL'; u.rate = 1.12; u.volume = 1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}
function renderAlerts(list) {
  const sig = list.map(a => a.key + a.num + a.sev + a.ico).join('|');
  if (sig === alSig) return; alSig = sig;
  el.alerts.innerHTML = list.map(a => '<div class="al ' + a.sev + (a.sev === 'bad' ? ' pulse' : '') + '">' + (a.ico.startsWith('SIGN:') ? '<i class="sign">' + a.ico.slice(5) + '</i>' : '<i>' + a.ico + '</i>') +
    (a.num ? '<b>' + a.num + '</b>' : '') + '<span>' + a.label + '</span></div>').join('');
  const now = performance.now(), cur = new Set(list.map(a => a.key));
  for (const a of list) if (!alKeys.has(a.key) && AL_VOICE[a.key] && (!alVoiceT[a.key] || now - alVoiceT[a.key] > 9000)) { alVoiceT[a.key] = now; speak(AL_VOICE[a.key] + (a.key === 'roca' && a.num ? ', ' + a.num.replace(' m', ' metros') : '')); break; }
  alKeys = cur;
}
function setBanner(txt, kind) {
  if (!txt) { el.banner.style.display = 'none'; return; }
  el.banner.textContent = txt; el.banner.className = kind || ''; el.banner.style.display = 'block';
  el.banner.style.whiteSpace = 'pre-line'; el.banner.style.textAlign = 'center'; el.banner.style.maxWidth = '92vw';
}
function showRadio(html) {
  el.radio.innerHTML = html; el.radio.style.display = 'block';
  clearTimeout(radioTimer); radioTimer = setTimeout(() => { el.radio.style.display = 'none'; }, 4800);
}
function findTarget() {
  let best = null;
  for (const t of trucks) { const d = t.s - P.s; if (d > 0 && d < REQ_RANGE && !t.auth && (!best || d < best.d)) best = { t, d }; }
  return best;
}
function nearAuth() {
  let best = null;
  for (const t of trucks) { const d = t.s - P.s; if (d > -2 && d < 80 && t.auth && (!best || d < best.d)) best = { t, d }; }
  return best;
}
/* Zona de la superficie: un camión queda detenido en tu pista con las luces de freno encendidas.
   Al autorizar, aparece un wheel dozer que retrocede hacia la pista contraria y deja un espacio entre él y el camión. */
let zonaDoz = null;
function spawnZona() {
  if (zonaDoz) { scene.remove(zonaDoz.mesh); zonaDoz = null; }
  const s = GAP ? GAP.a : L - 45;      // al inicio de la bahía de la pala 2
  const mesh = protoSame.clone(true), b = mesh.getObjectByName('beacon'); b.material = b.material.clone();
  const bb = new THREE.Box3().setFromObject(mesh), rojo = bas(0xff2a1f);
  for (const x of [bb.min.x * 0.7, bb.max.x * 0.7]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.12), rojo); l.position.set(x, bb.max.y * 0.45, bb.min.z - 0.05); mesh.add(l); }
  scene.add(mesh); addPlates(mesh, 777, CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s);
  trucks.push({ id: 777, s, u: -LANE, v: 0, v0: 0, vInit: false, mesh, beacon: b, auth: false, passed: false, prevD: s - P.s, zona: true });
}
function startDozer(t) {      // al autorizar: el dozer aparece delante del camión y cruza de izquierda a derecha empujando la roca
  zonaDoz = { mesh: buildDozerConRoca(), t: 0, s0: t.s + 22, s1: t.s + 22 };
  scene.add(zonaDoz.mesh);
}
function stepDozer(dt) {
  const z = zonaDoz; if (!z) return;
  z.t += dt; const k = Math.min(1, z.t / 4), e = k * k * (3 - 2 * k);
  const s = z.s0 + (z.s1 - z.s0) * e, u = -LANE + 2 * LANE * e;
  z.cs = s; z.cu = u;      // posición actual del dozer, para el tráfico de frente
  const f = frame(s), x = f.x + f.rx * u, zz = f.z + f.rz * u, y = H(x, zz) + 0.1;
  z.mesh.position.set(x, y, zz);
  z.mesh.lookAt(x + f.rx * 10, y, zz + f.rz * 10);      // frente hacia la derecha de la pista
  if (Math.abs(s - P.s) < 4.4 && Math.abs(u - P.u) < 2.8) return endGame(false, 'Chocaste con un wheel dozer que empujaba una roca.');
}
function requestAuth() {
  if (mode !== 'play') return;
  const tg = findTarget(); if (!tg) return;
  const t = tg.t; t.auth = true;
  if (t.zona) startDozer(t);
  beep(520, 0.08, 'square', 0.04); beep(780, 0.1, 'square', 0.04, 0.1);
  showRadio('<b>Tú</b>: Solicito autorización para adelantar a CAEX-' + pad(t.id) + '.');
  setTimeout(() => {
    if (mode !== 'play') return;
    showRadio('<b>CAEX-' + pad(t.id) + '</b>: «Autorizado con precaución.»');
    beep(660, 0.09, 'sine', 0.05); beep(990, 0.14, 'sine', 0.05, 0.1);
  }, 700);
}
el.auth.addEventListener('click', requestAuth);

function cotillon() {      // cotillón de colores sobre el juego (3 s)
  const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight;
  c.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:50';
  document.body.append(c); const x = c.getContext('2d');
  const cols = ['#c9141c', '#e3a008', '#1f9d55', '#2f80ed', '#e05cb8', '#ffffff'];
  const ps = Array.from({ length: 170 }, () => ({ x: c.width / 2 + (Math.random() - 0.5) * 220, y: c.height * 0.7, vx: (Math.random() - 0.5) * 16, vy: -(Math.random() * 18 + 6), r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3 }));
  const t0 = performance.now();
  (function frame(now) {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }
    if (now - t0 < 3200) requestAnimationFrame(frame); else c.remove();
  })(t0);
}
function parkStep(dt) {      // estaciona en reversa entre las dos camionetas del domo; al terminar, cotillón y resultado
  const pk = arrive.park; pk.t += dt;
  const k = Math.min(1, pk.t / 5), e = k * k * (3 - 2 * k);
  P.s = pk.s0 + (pk.s1 - pk.s0) * e; P.u = pk.u0 + (pk.u1 - pk.u0) * e; P.v = 0; P.vu = 0;
  if (k >= 1 && !pk.fin) { pk.fin = true; cotillon(); setTimeout(() => { arrive = null; endGame(true, 'Saliste del rajo respetando las reglas del camino y llegaste al domo.'); }, 3200); }
}
function metaMensaje() {      // tarjeta de felicitación bajo el aviso de meta; se quita sola
  const m = document.createElement('div'); m.id = 'metaMsg';
  m.textContent = 'La práctica te hace rápido, la disciplina te mantiene seguro. El simulador es el lugar para forjar el carácter y el respeto que la operación real exige. Mantente atento a las condiciones, no te arriesgues y regresa a casa con los tuyos.';
  document.body.append(m); setTimeout(() => m.remove(), 9000);
}
function stepArrival(dt) {      // tramo final automático: sigue por la superficie, gira hacia el domo y se estaciona frente a su puerta
  if (arrive.park) { parkStep(dt); return; }
  arrive.t += dt;      // el tiempo se detiene al cruzar la meta
  const dist = END_S - P.s, vt = dist > 50 ? CRUISE : Math.max(0, Math.min(CRUISE, dist * 0.3));      // sobre la superficie va a 50 km/h y frena al llegar
  P.v += clamp(vt - P.v, -3.2 * dt, 2.5 * dt); P.s = Math.min(END_S, P.s + P.v * dt);
  arrive.brake = vt < P.v - 0.3;
  const ut = dist < 75 ? -21.5 : -LANE;
  P.vu += ((ut - P.u) * 1.1 - P.vu) * (1 - Math.exp(-dt * 3)); P.u += P.vu * dt;
  if (eng) eng.frequency.value = 46 + P.v * 9;
  if (!arrive.done && dist < 1.5 && P.v < 0.15) { arrive.done = true; arrive.brake = false; P.v = 0; P.vu = 0; arrive.park = { t: 0, s0: P.s, u0: P.u, s1: L + 184, u1: -28.5 }; }
}
let playerName = '';
let TEST = false;      // modo prueba (nombre «federicovega»): sin camiones ni tráfico, sin límite de velocidad ni regla de pista contraria, no se envía al ranking
const cleanName = v => v.replace(/[|\[\]<>\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20);
// Filtro de nombres: nombre y apellido; no puede coincidir con nombres_prohibidos.json; sin palabras de animales (el apellido "León" sí se permite)
let LISTA_NOMBRES = null;      // se carga desde nombres_prohibidos.json al abrir la página
fetch('nombres_prohibidos.json', { cache: 'no-store' }).then(r => r.json()).then(j => { LISTA_NOMBRES = j; }).catch(() => {});
const ANIMALES = ['perro','perra','gato','gata','vaca','toro','cerdo','cerda','chancho','cabra','oveja','caballo','burro','mula','gallina','gallo','pavo','conejo','raton','rata','lobo','zorro','oso','osa','tigre','elefante','jirafa','mono','gorila','cebra','hipopotamo','rinoceronte','ballena','delfin','tiburon','pez','sapo','rana','lagarto','lagartija','cocodrilo','serpiente','culebra','vibora','aguila','buho','paloma','loro','perico','gorrion','pajaro','ardilla','castor','nutria','foca','morsa','pinguino','camello','llama','alpaca','vicuna','pollo','hormiga','abeja','mosca','arana','mariposa','grillo','escarabajo','pulga','piojo','gusano','caracol','zancudo','mosquito','cucaracha','pulpo','calamar','medusa','cangrejo','langosta','tortuga','iguana','camaleon','dragon','topo','erizo','puma','jaguar','pantera','hiena','chacal','coyote','bisonte','bufalo','antilope','ciervo','venado','alce','reno','cuervo','buitre','halcon','gaviota','tucan','pitbull','bulldog'];
const norm = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const nombreValido = n => {
  const t = norm(n), palabras = t.split(/[^a-z0-9ñ]+/).filter(Boolean);
  if (t === 'pato') return true;                                                           // excepción: "pato" solo sí se permite (pato carlos, pato carlo, no)
  if (/\d/.test(n)) return false;                                                        // sin números
  if (palabras.length < 2) return false;                                                   // nombre y apellido
  if (t.replace(/\s/g, '').length < 5) return false;                                       // menos de 5 letras
  if (palabras.some(w => ANIMALES.includes(w))) return false;                              // palabras de animales
  if (/\bpato carlos?\b/.test(t)) return false;                                            // "pato" es diminutivo de Patricio: solo se bloquean "pato carlo" y "pato carlos"
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️‍]/u.test(n)) return false;         // emojis
  if (/\b(x+d+|x+p+)\b/.test(t)) return false;                                             // xd, xp, xdd...
  if (/(.)\1{3,}/.test(t.replace(/\s/g, ''))) return false;                              // letras repetidas: xxxx, aaaa
  const L = LISTA_NOMBRES; if (!L) return true;                                            // lista aún no cargada
  const enLista = (arr) => arr.some(x => t.includes(norm(x)));
  const nombres = Object.values(L.nombres).flat();
  if (enLista(nombres) || enLista(L.localidades)) return false;
  const pal = [].concat(...Object.entries(L.palabras_prohibidas).filter(([k]) => k !== 'exactas').map(([, v]) => v));
  if ((L.palabras_prohibidas.exactas || []).some(w => palabras.includes(norm(w)))) return false;      // solo palabra completa
  if (pal.some(p => p.includes(' ') || norm(p).length >= 4 ? t.includes(norm(p)) : palabras.includes(norm(p)))) return false;      // 4 letras o más: dentro del nombre; 3 o menos: palabra completa
  const frases = [].concat(...Object.entries(L.frases_prohibidas).filter(([k]) => k !== 'regex_sugeridas').map(([, v]) => v));
  if (frases.some(f => t.includes(norm(f)))) return false;
  if ((L.frases_prohibidas.regex_sugeridas || []).some(r => new RegExp(r).test(t))) return false;
  const emo = [].concat(...Object.entries(L.emoticones_prohibidos).filter(([k, v]) => Array.isArray(v) && !k.startsWith('regex')).map(([, v]) => v));
  const low = n.toLowerCase();
  if (emo.some(e => low.includes(e) || (/^[a-z]+$/.test(e) && palabras.includes(e)))) return false;
  return true;
};
const reasonCode = m => /dozer/i.test(m) ? 'frontal' : /roca/i.test(m) ? 'roca' : /menos de \d+ m del CAEX/.test(m) ? 'caex' : /rodaste y caíste/.test(m) ? 'rajo' : /pretil/i.test(m) ? 'pretil'
  : /Choque frontal/.test(m) ? 'frontal' : /Chocaste con el camión/.test(m) ? 'choqueCaex' : /sin solicitar autorización/.test(m) ? 'sinAut' : /derecha/.test(m) ? 'lado' : /pista contraria/i.test(m) ? 'pista' : 'otro';
/* Registro automático de cada partida (ganada o perdida) en la hoja de Google que configuraste en config.js */
const RRC = window.RR_CONFIG || {}, RR_Q = 'rajoRojo.pendientes';
const rrLoad = () => { try { return JSON.parse(localStorage.getItem(RR_Q) || '[]'); } catch (e) { return []; } };
const rrSave = q => { try { localStorage.setItem(RR_Q, JSON.stringify(q.slice(-50))); } catch (e) {} };
const rrStatus = t => { const e = document.getElementById('sendSt'); if (e) e.textContent = t; };
let rrBusy = false;
async function rrFlush() {      // envía lo pendiente; si no hay conexión, queda guardado en el celular y se reintenta solo
  if (!RRC.endpoint || rrBusy) return; rrBusy = true;
  try {
    let q = rrLoad();
    while (q.length) {
      const rec = q[0];
      await fetch(RRC.endpoint, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(rec) });
      q = rrLoad().filter(r => r.id !== rec.id); rrSave(q);
    }
    rrStatus('✔ Resultado registrado en el ranking.');
  } catch (e) { rrStatus('Sin conexión: el resultado queda guardado y se envía solo cuando vuelva.'); }
  rrBusy = false;
}
function rrSend(rec) {
  if (TEST) { rrStatus('Modo prueba: esta partida no se envía al ranking.'); return; }
  if (!RRC.endpoint) { rrStatus('El registro automático no está configurado: copia el texto y mándaselo al organizador.'); return; }
  const q = rrLoad(); q.push(rec); rrSave(q); rrStatus('Enviando resultado…'); rrFlush();
}
window.addEventListener('online', rrFlush); setInterval(rrFlush, 15000); setTimeout(rrFlush, 1500);
// Partidas en vivo: latido cada 2,5 s para la página de espectadores (no se guarda si no hay conexión)
let liveId = '', liveT = 0, liveOn = false, liveRetryT = 0;
// Pide una de las 10 plazas para enviar posiciones; si no hay plaza, reintenta cada 20 s
function liveJoin() {
  liveOn = false; liveRetryT = 20;
  if (TEST) return;      // modo prueba: no aparece en espectadores
  if (!RRC.endpoint || !liveId) return;
  const url = RRC.endpoint + (RRC.endpoint.includes('?') ? '&' : '?') + 'action=unirse&id=' + encodeURIComponent(liveId) + '&n=' + encodeURIComponent(playerName) + '&_=' + Date.now();
  fetch(url, { cache: 'no-store' }).then(r => r.json()).then(j => { liveOn = !!(j && j.track); }).catch(() => { liveOn = false; });
}
function liveSend() {
  if (!RRC.endpoint || !liveId || !liveOn) return;
  const metros = Math.max(0, Math.round(Math.min(P.s, END_S) - START_S));
  const rec = { action: 'live', token: RRC.token || '', id: liveId, n: playerName, v: Math.round(P.v * 3.6), d: metros, t: Math.round(tGame * 10) / 10, r: Math.round(END_S - START_S) };
  try { fetch(RRC.endpoint, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(rec) }).catch(() => {}); } catch (e) {}
}
function showResult(win, msg) {      // texto + código para el ranking (el ranking los lee de cualquier mensaje donde vayan pegados)
  const metros = Math.max(0, Math.round(Math.min(P.s, END_S) - START_S)), t = Math.round(tGame * 10) / 10;
  const id = Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
  const code = 'RR1:' + id + '|' + playerName + '|' + (win ? 'D' : 'P') + '|' + t.toFixed(1) + '|' + metros + '|' + (win ? '-' : reasonCode(msg));
  const human = win ? '🏁 Rajo Kart 26 · ' + playerName + ' llegó al domo en ' + fmt(tGame) + ' (' + metros + ' m)'
    : '💥 Rajo Kart 26 · ' + playerName + ' perdió a los ' + metros + ' m (' + fmt(tGame) + '): ' + msg.replace(/CAEX-\d+/g, 'un CAEX');
  $('resTxt').value = human + '\n[' + code + ']'; $('resBox').hidden = false; $('resCopy').textContent = '📋 Copiar resultado';
  $('resShare').hidden = !navigator.share;
  rrSend({ token: RRC.token || '', id, n: playerName, o: win ? 'D' : 'P', t, d: metros, w: win ? '' : reasonCode(msg), dev: coarseMq.matches ? 'celular' : (inp.src === 'pad' ? 'volante-mando' : 'teclado'), v: '1' });
}
async function copyResult() {
  const ta = $('resTxt'); let ok = false; ta.focus(); ta.select();
  try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) {} }
  $('resCopy').textContent = ok ? '✔ Copiado: pégalo en tu mensaje' : 'Selecciona el texto de arriba y cópialo';
}
$('resCopy').addEventListener('click', copyResult);
$('resShare').addEventListener('click', () => { try { navigator.share({ text: $('resTxt').value }).catch(() => {}); } catch (e) {} });
const coarseMq = matchMedia('(pointer:coarse)');
let rotBlocked = false;
function orient() { rotBlocked = coarseMq.matches && innerHeight > innerWidth; $('rot').hidden = !rotBlocked; }
window.addEventListener('resize', orient); window.addEventListener('orientationchange', orient); orient();
function horizontal() {      // en el celular: pantalla completa y bloqueo en horizontal, si el navegador lo permite
  try { if (!coarseMq.matches) return; const d = document.documentElement; const bloquear = () => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
    if (d.requestFullscreen && !document.fullscreenElement) d.requestFullscreen().then(bloquear).catch(() => bloquear()); else bloquear(); } catch (e) {}
}
function tryStart() {      // el nombre es obligatorio para jugar
  const n = cleanName($('pname').value);
  const test = norm(n).replace(/\s/g, '') === 'federicovega';
  if (!test && !nombreValido(n)) {
    const falta = norm(n).split(/[^a-z0-9ñ]+/).filter(Boolean).length < 2;
    const numero = /\d/.test(n);
    $('nameErr').textContent = numero ? '🤔 No hay nombres con números.' : falta ? 'Escribe tu nombre y apellido para poder jugar.' : '🤔 Esto no parece un nombre. Si es un error, contacta a pato vega.';
    $('nameErr').hidden = false; $('pname').focus(); return;
  }
  $('nameErr').hidden = true; playerName = n; TEST = test; horizontal(); launch();
}
$('pname').addEventListener('input', () => { if (nombreValido(cleanName($('pname').value))) $('nameErr').hidden = true; });
$('chgName').addEventListener('click', () => { resetGame(); mode = 'menu'; stopEngine(); el.ovEnd.hidden = true; el.ovStart.hidden = false; el.hud.hidden = true; $('pname').focus(); });
let pendingShot = false;      // se toma la captura del choque en el siguiente cuadro
function signOf(m) {         // señal de la regla incumplida
  if (/límite de 60/.test(m)) return 'EXCESO DE VELOCIDAD';
  if (/pista contraria/.test(m)) return 'SENTIDO CONTRARIO';
  if (/por la derecha/.test(m)) return 'ADELANTAMIENTO POR LA IZQUIERDA';
  if (/sin solicitar autorización/.test(m)) return 'ADELANTAMIENTO SIN AUTORIZACIÓN';
  if (/menos de/.test(m)) return 'DISTANCIA DE SEGURIDAD';
  if (/pretil|volcaste/.test(m)) return 'SALIRSE DE LA PISTA';
  return '';      // los choques no llevan señal
}
function endGame(win, msg) {
  if (mode !== 'play') return;
  mode = win ? 'win' : 'over'; stopEngine(); renderAlerts([]);
  $('endTitle').textContent = win ? '¡Llegaste a la superficie!' : 'Fin del juego';
  $('endMsg').textContent = msg;
  const sg = win ? '' : signOf(msg); $('signBox').hidden = !sg; $('signTxt').textContent = sg;
  $('shotImg').hidden = true; pendingShot = !win && (crashFall || crush || /roca|camión|Choque frontal|aplast/.test(msg));
  $('endAlt').textContent = Math.max(0, Math.min(Math.round(L - START_S), Math.round(P.s - START_S))); $('endOv').textContent = overtakes; $('endTm').textContent = fmt(tGame); showResult(win, msg);
  $('retryBtn').textContent = win ? 'Jugar de nuevo (R)' : 'Reintentar (R)';
  beep(win ? 880 : 140, win ? 0.4 : 0.6, win ? 'sine' : 'sawtooth', 0.08);
  setTimeout(() => { el.ovEnd.hidden = false; $('retryBtn').focus(); }, win ? 300 : (crashFall ? 4200 : ((crashSide || crush) ? 1900 : 700)));
  el.spd.classList.remove('flash'); shake = win ? 0 : 0.7;
}
function startGame() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
  resetGame(); overT = 0; mode = 'play'; stopEngine(); startEngine();
  liveId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); liveT = 0; liveJoin();      // identificador de esta partida y plaza para enviar posiciones
  if (tilt.on && tilt.ang != null) { tilt.neutral = tilt.ang; tilt.sm = 0; }      // el celular se calibra con la posición con que empiezas
  el.ovStart.hidden = true; el.ovEnd.hidden = true; el.hud.hidden = false;
  el.radio.style.display = 'none'; camSnap = true;
}
$('goBtn').addEventListener('click', tryStart);
$('retryBtn').addEventListener('click', () => { horizontal(); launch(); });

/* Entrada */
const keyMap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { if (e.key === 'Enter' && mode === 'menu') tryStart(); return; }      // al escribir el nombre no se activan los controles
  const k = keyMap[e.key];
  if (k) { keys[k] = true; e.preventDefault(); return; }
  if (e.key === '0' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) requestAuth(); }
  else if (e.key === 'r' || e.key === 'R') { if (mode === 'over' || mode === 'win' || mode === 'play') startGame(); }
  else if (e.key === 'Enter' && mode === 'menu') tryStart();
});
window.addEventListener('keyup', e => { const k = keyMap[e.key]; if (k) keys[k] = false; });

/* ───────────── Volante, mando y celular como volante ───────────── */
const inp = { steer: 0, thr: 0, brk: 0, analog: false, src: '' };
let wheelCfg = {}; try { wheelCfg = JSON.parse(localStorage.getItem('rajoRojo.wheel.v2') || '{}'); } catch (e) {}
const saveCfg = () => { try { localStorage.setItem('rajoRojo.wheel.v2', JSON.stringify(wheelCfg)); } catch (e) {} };
const tilt = { on: false, inv: false, neutral: 0, ang: null, sm: 0 };
try { const t = JSON.parse(localStorage.getItem('rajoRojo.tilt.v1') || '{}'); tilt.inv = !!t.inv; } catch (e) {}
const saveTilt = () => { try { localStorage.setItem('rajoRojo.tilt.v1', JSON.stringify({ inv: tilt.inv })); } catch (e) {} };
const hidPads = [];
const pads = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : []), ...hidPads].filter(g => g && g.connected); } catch (e) { return []; } };
const wrap180 = a => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
const dzone = (v, d) => Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d);
let authPrev = false, ctlTxt = '';
function setCtl(t) { if (t !== ctlTxt) { ctlTxt = t; $('ctlInfo').textContent = t; } }
const devKey = (g, all) => { const same = all.filter(x => x.id === g.id); return same.length > 1 ? g.id + '#' + same.indexOf(g) : g.id; };
function padMap() { const all = pads(), m = {}; all.forEach(g => { m[devKey(g, all)] = g; }); return { all, m }; }
const shortName = id => id.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 34);
function pollInput() {
  inp.analog = false; inp.steer = 0; inp.thr = 0; inp.brk = 0; inp.src = '';
  const { all, m } = padMap();
  if (all.length) {
    const rd = c => { const g = c && m[c.dev]; if (!g) return null; return (c.t === 'b' ? (g.buttons[c.i] ? g.buttons[c.i].value : 0) : g.axes[c.i]) || 0; };
    const rel = c => { const v = rd(c); return v == null || Math.abs(c.f - c.r) < 0.02 ? 0 : clamp((v - c.r) / (c.f - c.r), -1, 1); };
    // El volante siempre funciona solo: si falta lo configurado (por ejemplo la pedalera) se usa el primer mando real:
    // giro = eje 0, y en un mando estándar los gatillos aceleran y frenan. Lo que no encuentre queda en automático / teclado.
    const base = all.find(g => !g.dev) || all[0], std = base.mapping === 'standard', ok = c => !!(c && m[c.dev]);
    const trig = n => (std && base.buttons[n] ? base.buttons[n].value : 0);
    const st = ok(wheelCfg.steer) ? rel(wheelCfg.steer) : (base.axes[0] || 0);
    const th = ok(wheelCfg.thr) ? Math.max(0, rel(wheelCfg.thr)) : trig(7);
    const br = ok(wheelCfg.brk) ? Math.max(0, rel(wheelCfg.brk)) : trig(6);
    let au = false;
    if (ok(wheelCfg.auth)) { const g = m[wheelCfg.auth.dev]; au = !!(g.buttons[wheelCfg.auth.i] && g.buttons[wheelCfg.auth.i].pressed); }
    else au = !!(std && base.buttons[0] && base.buttons[0].pressed);
    const faltan = ['steer', 'thr', 'brk'].filter(k => wheelCfg[k] && !m[wheelCfg[k].dev]).length;
    const label = faltan ? 'falta conectar parte de lo configurado: giras con el volante y aceleras con ↑ o en automático' : (wheelCfg.steer || wheelCfg.thr || wheelCfg.brk ? 'configurado' : 'gira con el volante; acelera sola, frena con ↓');
    inp.analog = true; inp.src = 'pad'; inp.steer = Math.sign(st) * Math.pow(Math.abs(dzone(st, 0.03)), 1.25); inp.thr = clamp(th, 0, 1); inp.brk = clamp(br, 0, 1);
    if (au && !authPrev && mode === 'play') requestAuth(); authPrev = au;
    setCtl('Dispositivos detectados (' + all.length + '): ' + all.map(g => shortName(g.id)).join(' + ') + ' · ' + label);
  } else if (vw.on) {
    if (vw.id == null) vw.steer += (0 - vw.steer) * 0.22;      // al soltar, el volante vuelve al centro
    inp.analog = true; inp.src = 'vw'; inp.steer = Math.abs(vw.steer) < 0.05 ? 0 : vw.steer;
    $('vwG').setAttribute('transform', 'rotate(' + (vw.steer * 90).toFixed(1) + ' 50 50)');
    setCtl('Volante en pantalla: gíralo con el pulgar. ▲ acelera y ▼ frena.');
  } else if (tilt.on) {
    if (tilt.ang != null) {
      const d = wrap180(tilt.ang - tilt.neutral); tilt.sm += (d - tilt.sm) * 0.35;
      inp.analog = true; inp.src = 'tilt'; inp.steer = clamp((-tilt.sm / 32) * (tilt.inv ? -1 : 1), -1, 1);
      if (Math.abs(inp.steer) < 0.06) inp.steer = 0;
    }
    setCtl('Celular como volante: sostenlo en horizontal como un volante y gíralo.' + (tilt.ang == null ? ' (esperando el sensor…)' : ''));
  } else setCtl('Control: teclado o pantalla táctil. Si conectas un volante o una pedalera, muévelos o presiona un botón para que el navegador los detecte.');
  document.body.classList.toggle('wheel-on', inp.analog);
  if (inp.analog) $('wheelG').setAttribute('transform', 'rotate(' + (inp.steer * 110).toFixed(1) + ' 50 50)');
}
window.addEventListener('gamepadconnected', e => setCtl('Control detectado: ' + e.gamepad.id.slice(0, 44)));

/* volante en pantalla: se gira con el dedo (funciona en cualquier celular, sin sensores) */
const vw = { on: false, id: null, a0: 0, s0: 0, steer: 0 };
const vwEl = $('vwheel'), vwAng = e => { const r = vwEl.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
vwEl.addEventListener('pointerdown', e => { vw.id = e.pointerId; try { vwEl.setPointerCapture(e.pointerId); } catch (x) {} vw.a0 = vwAng(e); vw.s0 = vw.steer; e.preventDefault(); });
vwEl.addEventListener('pointermove', e => { if (e.pointerId !== vw.id) return; vw.steer = clamp(vw.s0 + wrap180(vwAng(e) - vw.a0) / 65, -1, 1); });
['pointerup', 'pointercancel'].forEach(t => vwEl.addEventListener(t, e => { if (e.pointerId === vw.id) vw.id = null; }));
function setVw(on) { vw.on = on; vw.steer = 0; vw.id = null; document.body.classList.toggle('vw-on', on); $('vwBtn').textContent = '🕹 Volante en pantalla: ' + (on ? 'sí' : 'no'); }
$('vwBtn').addEventListener('click', () => { if (!vw.on && tilt.on) tiltToggle(); setVw(!vw.on); try { localStorage.setItem('rajoRojo.ctl', vw.on ? 'vw' : 'btn'); } catch (e) {} });
// en el celular el volante en pantalla es el único control de giro
if (coarseMq.matches) setVw(true);      // en el celular el único control de giro es el volante en pantalla

/* WebHID: lectura directa de un dispositivo USB (útil si el navegador no entrega la pedalera como mando).
   Se interpreta el descriptor del dispositivo: cada campo de varios bits es un eje; cada campo de 1 bit, un botón. */
function hidBits(dv, bit, size, signed) {
  let v = 0;
  for (let i = 0; i < size; i++) { const b = bit + i, by = b >> 3; if (by < dv.byteLength && ((dv.getUint8(by) >> (b & 7)) & 1)) v += Math.pow(2, i); }
  if (signed && size > 1 && v >= Math.pow(2, size - 1)) v -= Math.pow(2, size);
  return v;
}
function hidAdd(d) {
  if (hidPads.some(v => v.dev === d)) return;
  const tabla = {};
  for (const col of d.collections || []) for (const rep of col.inputReports || []) {
    let bit = 0; const campos = [];
    for (const it of rep.items || []) {
      const n = it.reportCount || 1, sz = it.reportSize || 0;
      if (!it.isConstant) for (let k = 0; k < n; k++) campos.push({ bit: bit + k * sz, size: sz, min: it.logicalMinimum, max: it.logicalMaximum });
      bit += sz * n;
    }
    tabla[rep.reportId || 0] = (tabla[rep.reportId || 0] || []).concat(campos);
  }
  const pad = { id: 'HID ' + (d.productName || 'dispositivo USB') + ' (' + (d.vendorId || 0).toString(16) + ':' + (d.productId || 0).toString(16) + ')', index: 100 + hidPads.length, connected: true, mapping: '', axes: [], buttons: [], dev: d };
  d.addEventListener('inputreport', e => {
    const campos = tabla[e.reportId || 0]; if (!campos) return;
    const ax = [], bt = [];
    for (const c of campos) {
      if (c.size <= 0 || c.size > 32) continue;
      const v = hidBits(e.data, c.bit, c.size, c.min < 0);
      if (c.size === 1) bt.push({ pressed: v > 0, value: v > 0 ? 1 : 0 });
      else ax.push(c.max === c.min ? 0 : clamp((v - c.min) / (c.max - c.min) * 2 - 1, -1, 1));
    }
    pad.axes = ax; pad.buttons = bt;
  });
  hidPads.push(pad);
}
async function hidOpen(d) { try { if (!d.opened) await d.open(); hidAdd(d); return true; } catch (e) { return false; } }
const HID_BLOQUEADO = 'El navegador no permite el acceso USB directo en esta página. Usa Chrome o Edge en un computador, abriendo el juego desde su dirección https.';
async function hidConnect() {
  const msg = $('calHidMsg');
  if (!navigator.hid) { msg.textContent = 'Este navegador no permite WebHID. Usa Chrome o Edge en un computador.'; return; }
  try {
    const lista = await navigator.hid.requestDevice({ filters: [] });
    if (!lista.length) { msg.textContent = 'No elegiste ningún dispositivo.'; return; }
    let ok = 0; for (const d of lista) if (await hidOpen(d)) ok++;
    msg.textContent = ok ? 'Conectado. Pisa los pedales y mira abajo si cambian los valores.' : 'No pude abrir el dispositivo (puede estar en uso por otro programa).';
  } catch (e) { msg.textContent = /permissions policy|disallowed/i.test(String(e && e.message)) ? HID_BLOQUEADO : 'No se pudo conectar: ' + (e && e.message ? e.message : e); }
}
(function hidInit() {
  if (!navigator.hid) return;
  $('calHidBox').hidden = false; $('calHid').addEventListener('click', hidConnect);
  try { if (document.featurePolicy && document.featurePolicy.allowsFeature && !document.featurePolicy.allowsFeature('hid')) $('calHidMsg').textContent = HID_BLOQUEADO; } catch (e) {}
  try { navigator.hid.getDevices().then(ds => ds.forEach(hidOpen)).catch(() => {}); } catch (e) {}
})();

/* asistente de configuración: detecta solo qué dispositivo y qué eje o botón es el giro, el acelerador, el freno y la autorización
   (sirve con un volante, con una pedalera en otro USB, o con ambos en uno solo) */
const cal = { open: false, step: 0, base: null, t0: 0, det: null, cfg: {}, prev: null };
const CAL_STEPS = [['steer', 'Gira el volante a la DERECHA hasta donde quieras que sea el giro máximo y mantenlo.'], ['thr', 'Pisa el ACELERADOR a fondo y mantenlo.'], ['brk', 'Pisa el FRENO a fondo y mantenlo. Si no pasa nada, pisa el freno un par de veces seguidas.'], ['auth', 'Presiona el botón o la paleta para PEDIR AUTORIZACIÓN.']];
const CAL_NAMES = ['Giro del volante', 'Acelerador', 'Freno', 'Botón de autorización'];
function calRender(msg) {
  $('calMsg').textContent = msg || CAL_STEPS[cal.step][1];
  $('calSteps').innerHTML = CAL_STEPS.map((c, i) => (i < cal.step ? '✔ ' : (i === cal.step ? '▶ ' : '○ ')) + CAL_NAMES[i] + (cal.cfg[c[0]] != null && cal.cfg[c[0]].dev ? ' <small>(' + shortName(cal.cfg[c[0]].dev.replace(/#\d+$/, '')) + ')</small>' : '')).join('<br>');
}
function calStart() { cal.open = true; cal.step = 0; cal.base = null; cal.cfg = {}; cal.det = null; cal.prev = null; cal.t0 = performance.now(); $('calib').hidden = false; calRender('Mueve el volante y pisa los pedales (o presiona un botón de cada aparato) para que el navegador los detecte.'); }
function calNext() { cal.step++; cal.base = null; cal.det = null; cal.t0 = performance.now(); if (cal.step >= CAL_STEPS.length) calFinish(); else calRender(); }
function calFinish() { wheelCfg = Object.assign({}, cal.cfg); saveCfg(); cal.open = false; $('calib').hidden = true; }
const calRead = () => { const { all, m } = padMap(), o = {}; for (const k in m) o[k] = { a: m[k].axes.slice(), b: m[k].buttons.map(b => b.value), p: m[k].buttons.map(b => b.pressed) }; return { o, n: all.length }; };
const calVal = (snap, c) => { const d = snap.o[c.dev]; return d ? ((c.t === 'b' ? d.b[c.i] : d.a[c.i]) || 0) : 0; };
const sameSrc = (a, b) => a && b && a.dev === b.dev && a.t === b.t && a.i === b.i;
function calTick() {
  const snap = calRead();
  if (!snap.n) { calRender('No detecto nada. Mueve el volante, pisa los pedales o presiona un botón.'); $('calLive').textContent = ''; cal.step = 0; cal.base = null; cal.cfg = {}; return; }
  const live = [], mv = [];
  for (const k in snap.o) {
    live.push(shortName(k.replace(/#\d+$/, '')) + (k.includes('#') ? ' ' + k.split('#')[1] : '') + ': ' + snap.o[k].a.map((v, i) => i + '=' + v.toFixed(2)).join(' '));
    if (cal.base && cal.base.o[k]) { snap.o[k].a.forEach((v, i) => { if (Math.abs(v - cal.base.o[k].a[i]) > 0.15) mv.push('eje ' + i + ' = ' + v.toFixed(2)); }); snap.o[k].b.forEach((v, i) => { if (Math.abs(v - cal.base.o[k].b[i]) > 0.15) mv.push('botón ' + i + ' = ' + v.toFixed(2)); }); }
  }
  $('calLive').textContent = 'Dispositivos que ve el navegador: ' + snap.n + '\n' + live.join('\n') + '\nSe mueve: ' + (mv.length ? mv.join(', ') : '(nada)') + (snap.n < 2 && cal.step > 0 ? '\n⚠ Solo veo 1 dispositivo: si la pedalera es otro USB y no aparece, el navegador no la entrega como mando.' + (navigator.hid ? ' Usa «Conectar pedalera por USB (HID)».' : '') : '');
  if (!cal.base) {
    const held = Object.values(cal.cfg).some(c => c && typeof c === 'object' && c.f != null && Math.abs(calVal(snap, c) - c.r) > 0.2);
    if (held) { cal.t0 = performance.now(); calRender('Suelta el pedal o vuelve el volante al centro…'); return; }      // antes de medir el siguiente paso, todo vuelve al reposo
    if (performance.now() - cal.t0 < 600) return;
    cal.base = snap; cal.prev = snap; calRender(); return;
  }
  const key = CAL_STEPS[cal.step][0];
  if (key === 'auth') {
    for (const k in snap.o) snap.o[k].p.forEach((pr, i) => { if (pr && !(cal.prev.o[k] && cal.prev.o[k].p[i]) && !cal.cfg.auth) cal.cfg.auth = { dev: k, i }; });
    cal.prev = snap; if (cal.cfg.auth) calNext(); return;
  }
  let best = null, bd = 0;
  const consider = (c, v, r) => { const d = v - r; if (Math.abs(d) > Math.abs(bd)) { bd = d; best = c; } };
  for (const k in snap.o) {
    const b0 = cal.base.o[k]; if (!b0) continue;
    snap.o[k].a.forEach((v, i) => {
      const c = { dev: k, t: 'a', i };
      if (key !== 'steer' && sameSrc(c, cal.cfg.steer)) return;
      if (key === 'brk' && sameSrc(c, cal.cfg.thr) && (v - b0.a[i]) * (cal.cfg.thr.f - cal.cfg.thr.r) > 0) return;      // pedales en un solo eje: el freno va hacia el otro lado
      consider(c, v, b0.a[i]);
    });
    if (key !== 'steer') snap.o[k].b.forEach((v, i) => {                     // algunos aparatos entregan los pedales como botones analógicos
      const c = { dev: k, t: 'b', i };
      if (key === 'brk' && sameSrc(c, cal.cfg.thr)) return;
      consider(c, v, b0.b[i]);
    });
  }
  if (!cal.det) { if (best && Math.abs(bd) > (key === 'steer' ? 0.08 : 0.4)) cal.det = { c: best, t: performance.now(), ext: calVal(snap, best) }; }
  else {      // se mide durante ~1 s: el valor más lejano del reposo es el tope (giro máximo o pedal a fondo)
    const c = cal.det.c, v = calVal(snap, c), r = calVal(cal.base, c);
    if (Math.abs(v - r) > Math.abs(cal.det.ext - r)) cal.det.ext = v;
    if (performance.now() - cal.det.t > 1000) { cal.cfg[key] = { dev: c.dev, t: c.t, i: c.i, r, f: cal.det.ext }; calNext(); }
  }
}
$('wheelBtn').addEventListener('click', calStart);
$('calSkip').addEventListener('click', () => { if (cal.open) calNext(); });
$('calClose').addEventListener('click', () => { if (Object.keys(cal.cfg).length) { wheelCfg = Object.assign({}, wheelCfg, cal.cfg); saveCfg(); } cal.open = false; $('calib').hidden = true; });      // «Cerrar» guarda lo que alcanzó a detectar
$('calReset').addEventListener('click', () => { wheelCfg = {}; saveCfg(); cal.cfg = {}; cal.step = 0; cal.base = null; cal.det = null; calRender('Configuración borrada. Vuelve a empezar o cierra: el volante funciona igual por sí solo.'); });

/* celular como volante: se usa la rotación del celular alrededor de la normal de la pantalla (acelerómetro) */
let tiltWired = false;
function onMotion(e) { const a = e.accelerationIncludingGravity; if (!a || a.x == null || a.y == null || Math.hypot(a.x, a.y) < 3) return; tilt.ang = Math.atan2(a.x, a.y) * 180 / Math.PI; }
async function tiltToggle() {
  if (!tilt.on) {
    try { if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') { const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') { setCtl('No se dio permiso para usar el sensor de giro del celular.'); return; } } } catch (e) {}
    if (!tiltWired) { window.addEventListener('devicemotion', onMotion); tiltWired = true; }
    tilt.on = true; if (tilt.ang != null) tilt.neutral = tilt.ang;
    try { if (document.featurePolicy && document.featurePolicy.allowsFeature && !document.featurePolicy.allowsFeature('accelerometer')) tilt.ang = null; } catch (e) {}
    tiltAviso();
  } else tilt.on = false;
  document.body.classList.toggle('tilt-on', tilt.on); $('tiltBtn').textContent = '📱 Inclinar el celular como volante: ' + (tilt.on ? 'sí' : 'no');
}
$('tiltBtn').addEventListener('click', () => { if (vw.on) setVw(false); tiltToggle(); });
function tiltAviso() {      // si el navegador no entrega el sensor, se avisa y se ofrece el volante en pantalla
  setTimeout(() => { if (tilt.on && tilt.ang == null) { tilt.on = false; document.body.classList.remove('tilt-on'); $('tiltBtn').textContent = '📱 Inclinar el celular como volante: no'; setVw(true); setCtl('Este celular no entrega el sensor de giro dentro de Claude. Activé el volante en pantalla: gíralo con el pulgar.'); } }, 1600);
}
function tiltCalibrar(aviso) { if (tilt.ang != null) { tilt.neutral = tilt.ang; tilt.sm = 0; if (aviso) { setBanner('Volante calibrado', 'ok'); bannerT = 2; } return true; } return false; }
$('wheel').addEventListener('click', () => { if (tilt.on) tiltCalibrar(true); });      // en la partida: tocar el volante de la esquina recalibra
$('tiltCal').addEventListener('click', () => { if (!tiltCalibrar(false)) setCtl('Todavía no llega el sensor de giro. Mueve un poco el celular.'); else setCtl('Calibrado con esta posición.'); });
function launch() {      // cuenta 3-2-1-¡YA! como en Mario Kart; la camioneta no se mueve hasta el ¡YA!
  if (tilt.on && tilt.ang == null) tiltAviso();
  const box = $('cdown'), num = $('cdNum'), seq = ['3', '2', '1', '¡YA!'], cols = ['#1f9d55', '#2f80ed', '#f2c200', '#c9141c'];
  $('cdMsg').textContent = tilt.on ? 'Sostén el celular como un volante, derecho' : '¡Prepárate!';
  box.querySelector('.sub').hidden = !tilt.on;
  box.classList.add('transp'); el.ovStart.hidden = true;      // el menú se oculta para ver el rajo y la pista
  let i = 0; box.hidden = false; num.textContent = seq[0]; num.style.setProperty('--c', cols[0]); beep(523, 0.15, 'square', 0.06);
  const iv = setInterval(() => {
    i++;
    if (i < seq.length) { num.textContent = seq[i]; num.style.setProperty('--c', cols[i]); beep(i === seq.length - 1 ? 880 : 523, 0.15, 'square', 0.06); return; }
    clearInterval(iv); box.hidden = true; box.classList.remove('transp');
    if (tilt.on && tilt.ang != null) tiltCalibrar(false);
    startGame();
  }, 1000);
}
$('tiltInv').addEventListener('click', () => { tilt.inv = !tilt.inv; saveTilt(); $('tiltInv').textContent = tilt.inv ? 'Giro invertido ✔' : 'Invertir giro'; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.querySelectorAll('[data-k]').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; b.classList.add('on'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { keys[k] = false; b.classList.remove('on'); }));
});

/* ───────────── Rocas que caen de los camiones cargados ───────────── */
const rockMat = lam(0x6e5c49);
function dropRock(t) {
  const m = new THREE.Mesh(rockGeo, rockMat), sc = 0.28 + Math.random() * 0.3, f = frame(t.s);
  m.scale.set(sc, sc * 0.8, sc);
  m.position.copy(t.mesh.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 4.4, 7.4, -6.3))); scene.add(m);
  const lat = (Math.random() - 0.5) * 2.5;
  rocks.push({ mesh: m, sc, vx: f.tx * t.v * 0.6 + f.rx * lat, vy: 1 + Math.random() * 1.2, vz: f.tz * t.v * 0.6 + f.rz * lat,
    sx: (Math.random() - 0.5) * 6, sz: (Math.random() - 0.5) * 6, bounces: 0, resting: false, age: 0 });
}
function updateRocks(dt) {
  rockT -= dt;
  if (rockT <= 0) {
    rockT = 5 + Math.random() * 7;
    const cand = trucks.filter(t => { const d = t.s - P.s; return d > 14 && d < 120; });
    if (cand.length && rocks.length < 6) dropRock(cand[Math.floor(Math.random() * cand.length)]);
  }
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i], p = r.mesh.position;
    if (r.resting) { r.age += dt; if (r.age > 14) { scene.remove(r.mesh); rocks.splice(i, 1); } continue; }
    r.vy -= 24 * dt; p.x += r.vx * dt; p.y += r.vy * dt; p.z += r.vz * dt;
    r.mesh.rotation.x += r.sx * dt; r.mesh.rotation.z += r.sz * dt;
    const ground = H(p.x, p.z) + 0.12 + r.sc * 0.5;
    if (p.y < ground) {
      p.y = ground;
      if (Math.hypot(p.x - pickup.position.x, p.z - pickup.position.z) < 40) beep(95, 0.12, 'triangle', 0.05);
      if (r.vy < -2.5 && r.bounces < 3) { r.vy = -r.vy * 0.35; r.vx *= 0.6; r.vz *= 0.6; r.sx *= 0.6; r.sz *= 0.6; r.bounces++; }
      else { r.resting = true; r.vx = r.vy = r.vz = 0; }
    }
  }
}

/* ───────────── Simulación ───────────── */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let overT = 0;      // segundos seguidos por encima del límite de velocidad
function step(dt) {
  stepDozer(dt);
  if (!TEST && P.v * 3.6 > SPEED_LIMIT) { overT += dt; if (overT >= 5) return endGame(false, 'Superaste el límite de 60 km/h por más de 5 segundos.'); }
  else overT = 0;
  if (arrive) { stepArrival(dt); return; }      // llegó a la meta: la camioneta sigue sola hasta el domo
  tGame += dt;

  // Camiones en el mismo sentido
  trucks.sort((a, b) => a.s - b.s);
  for (let i = trucks.length - 1; i >= 0; i--) {
    const t = trucks[i], lead = trucks[i + 1]; let v = t.v0;
    if (lead && lead.s - t.s < 34) v = Math.min(v, lead.v);
    if (t.auth && !t.passed && t.s > P.s - 6) v = 0;        // autorizó el adelantamiento: se detiene de a poco hasta que lo pases
    if (!t.vInit) { t.v = v; t.vInit = true; }
    t.v += clamp(v - t.v, -1.0 * dt, 0.8 * dt); t.s += t.v * dt;
  }
  for (const t of trucks) { let tg = 0; for (const c of rocasPista) { const d = c.s - t.s; if (d > -7 && d < 42) tg = 3.6; } t.off = (t.off || 0) + (tg - (t.off || 0)) * Math.min(1, dt * 2); }
  for (let i = trucks.length - 1; i >= 0; i--) if (trucks[i].s > L + 12) { scene.remove(trucks[i].mesh); trucks.splice(i, 1); }

  // Tráfico en contra
  oncs.sort((a, b) => a.s - b.s);
  for (let i = 0; i < oncs.length; i++) {
    const o = oncs[i], lead = oncs[i - 1]; let v = o.v0;
    if (lead && o.s - lead.s < 34) v = Math.min(v, lead.v);
    const zd = zonaDoz;      // con el dozer ya en la pista derecha, el camión de frente frena antes de llegar a él
    if (zd && zd.t >= 4 && Math.abs(o.u - zd.cu) < 6 && o.s > zd.cs && o.s - zd.cs < 110) v = Math.min(v, Math.max(0, (o.s - zd.cs - 10) * 0.4));
    o.v = v; const prev = o.s; o.s -= v * dt;
    if (o.kind === 'aljibe') { o.cyc += dt; o.spraying = (o.cyc % 20) < 10; if (o.spraying) wetRange(o.s + 7, prev + 7); }   // riega 10 s, descansa 10 s
  }
  for (let i = oncs.length - 1; i >= 0; i--) { const o = oncs[i]; if (o.s < Math.max(SMIN + 8, P.s - 90)) { scene.remove(o.mesh); oncs.splice(i, 1); } }
  if (!TEST) {      // tráfico en contra (no en modo prueba)
  spawnT -= dt;
  if (spawnT <= 0) { if (P.s + 260 < L - 30 && !oncs.some(o => Math.abs(o.s - (P.s + 260)) < 60)) oncs.push(mkOnc(P.s + 260)); spawnT = 11 + Math.random() * 10; }
  if (!oncs.some(o => o.kind === 'aljibe')) {                  // nunca más de un aljibe
    aljT -= dt;
    if (aljT <= 0 && P.s + 250 < L - 40 && !oncs.some(o => Math.abs(o.s - (P.s + 250)) < 60)) { oncs.push(mkAlj(P.s + 250)); aljT = 80 + Math.random() * 50; }
  }
  pickT -= dt;
  if (pickT <= 0) { if (P.s + 260 < L - 30 && !oncs.some(o => Math.abs(o.s - (P.s + 260)) < 60)) oncs.push(mkOncPickup(P.s + 260)); pickT = 28 + Math.random() * 30; }
  }
  updateRoad(dt); updateRocks(dt); updateFallRocks(dt);
  if (intro) {      // salida de la explanada: la camioneta sale sola de junto a la pala y se incorpora a su pista
    intro.t += dt; const k = Math.min(1, intro.t / 3.6), e = k * k * (3 - 2 * k), nu = intro.u0 + (-LANE - intro.u0) * e;
    P.vu = (nu - P.u) / Math.max(dt, 1e-3); P.u = nu; P.v = Math.min(CRUISE, intro.t * 3.6); P.s += P.v * dt;
    if (k >= 1) { intro = null; P.vu = 0; }
    return;
  }
  if (free) { stepFree(dt); return; }

  // Camioneta
  const slick = slickNow(P.s);             // piso mojado donde pasó el aljibe: menos agarre
  const thr = Math.max(keys.up ? 1 : 0, inp.thr), brk = Math.max(keys.down ? 1 : 0, inp.brk);
  const vt = CRUISE + (VTOP - CRUISE) * thr;      // sola hasta 50 km/h; con ↑ o el pedal hasta 80; el freno (↓ o pedal) frena
  let acc;
  if (brk > 0.05) acc = -(7 - 4.2 * slick) * brk;
  else if (P.v < vt) acc = Math.min(2.8, (vt - P.v) * 2.5 + 0.2) * (1 - 0.35 * slick);
  else acc = -Math.min(1.5, (P.v - vt) * 4) * (1 - 0.5 * slick);
  P.v = clamp(P.v + acc * dt, 0, VTOP);
  const kbs = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), asteer = inp.analog && Math.abs(inp.steer) > 0.05 ? inp.steer : 0;
  const steer = kbs || asteer, grip = Math.min(1, P.v / 2.5), kmhNow = P.v * 3.6;
  let target;
  if (steer) target = steer * 5.2 * grip * (1 - 0.3 * slick);
  else { const c = P.u < 0 ? -LANE : LANE; target = clamp((c - P.u) * 1.0, -2.5, 2.5) * grip * (1 - 0.5 * slick); }
  P.vu += (target - P.vu) * (1 - Math.exp(-dt * (7 - 4.6 * slick)));
  if (slick > 0.05 && kmhNow > 30) {      // se patina: la camioneta se desliza de lado, más al frenar o girar fuerte
    const amp = slick * Math.min(1.6, (kmhNow - 30) / 35) * (1 + (brk > 0.05 ? 0.8 : 0) + Math.abs(steer) * 0.4);
    P.vu += (Math.sin(tGame * 2.3) + 0.6 * Math.sin(tGame * 3.9 + 1)) * 6 * amp * dt;
  }
  P.u += P.vu * dt;
  skidT -= dt;
  if (slick > 0.3 && kmhNow > 35 && (steer || brk > 0.05) && skidT <= 0) { beep(1100 + Math.random() * 250, 0.14, 'sawtooth', 0.03); skidT = 0.22; }
  P.s += P.v * dt;

  // Reglas
  const kmh = P.v * 3.6;
  if (Math.abs(P.u) > CRASH_U) {
    crashSide = P.u < 0 ? -1 : 1; crashT = 0;
    const cf = frame(P.s); crashFall = H(cf.x + cf.rx * crashSide * 20, cf.z + cf.rz * crashSide * 20) < H(cf.x, cf.z) - 3;      // ¿el terreno de ese lado cae al rajo?
    return endGame(false, crashFall ? 'Pasaste el pretil hacia el rajo: rodaste y caíste.' : 'Te fuiste contra el pretil y volcaste de lado.');
  }
  if (P.s > CAEX_LANE.a && P.s < CAEX_LANE.b && Math.abs(P.u - CAEX_LANE.u) < 7) return endGame(false, 'Entraste al carril solo para CAEX.');
  for (const t of trucks) if (Math.abs(t.s - P.s) < 9.8 && Math.abs(t.u - P.u) < 5.2) {
    crush = { by: t, dir: 0, t: 0, snd: false };
    return endGame(false, 'Chocaste con el camión CAEX-' + pad(t.id) + ': la camioneta quedó aplastada.');
  }
  for (const o of oncs) if (Math.abs(o.s - P.s) < (o.cl || 8.6) && Math.abs(o.u - P.u) < (o.cw || 4.7)) {
    crush = { by: o, dir: -1, t: 0, snd: false };
    return endGame(false, o.kind === 'pickup' ? 'Choque frontal con otra camioneta que venía en sentido contrario.' : 'Choque frontal: el camión te pasó por encima y la camioneta quedó aplastada.');
  }
  for (const t of trucks) {
    const d = t.s - P.s;
    if (!t.auth && d > 0 && Math.abs(t.u - P.u) < 3.2 && d - 9.8 < FOLLOW_DIST)      // con autorización no rige la distancia
      return endGame(false, 'Te acercaste a menos de ' + FOLLOW_DIST + ' m del CAEX-' + pad(t.id) + '.');
  }
  for (const c of rocasPista) if (Math.abs(c.s - P.s) < c.r + 2.4 && Math.abs(c.u - P.u) < c.r + 0.95)
    return endGame(false, 'Chocaste con una roca en el camino.');

  let context = false;
  for (const t of trucks) {
    const d = t.s - P.s;
    if (d > -30 && d < 42) context = true;
    if (t.prevD > 0 && d <= 0) {
      if (!t.auth) return endGame(false, 'Adelantaste a CAEX-' + pad(t.id) + ' sin solicitar autorización.');
      if (P.u < t.u + 2) return endGame(false, 'Solo se adelanta por la derecha.');
      t.passed = true; overtakes++; setBanner('Adelantamiento completado. Vuelve a tu pista.', 'ok'); bannerT = 2.2;
    }
    if (d > 0) t.passed = false;
    t.prevD = d;
  }
  for (const c of rocasPista) { const d = c.s - P.s; if (d > -15 && d < 55) context = true; }      // esquivar una roca justifica salir de la pista
  if (!TEST && P.u > -2 && !context) { wrongT += dt; if (wrongT > 4) return endGame(false, 'Circulaste por la pista contraria sin motivo.'); }
  else wrongT = Math.max(0, wrongT - dt * 2);

  if (P.s >= L - 2) { arrive = { t: 0 }; cotillon(); setBanner('¡Lo lograste! Sigue hasta el domo.', 'meta'); metaMensaje(); bannerT = 5; renderAlerts([]); speak('Llegaste a la superficie'); return; }
}

/* ───────────── Cámara ───────────── */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tp = new THREE.Vector3(), tl = new THREE.Vector3();
let camSnap = true;
function updateCamera(dt) {
  const fb = frame(P.s - 14), ff = frame(P.s + 20), cu = P.u * 0.55, lu = P.u * 0.35;
  const cx = fb.x + fb.rx * cu, cz = fb.z + fb.rz * cu, lx = ff.x + ff.rx * lu, lz = ff.z + ff.rz * lu;
  tp.set(cx, H(cx, cz) + 5.6, cz); tl.set(lx, H(lx, lz) + 1.8, lz);
  if (free) { const hx = Math.cos(free.a), hz = Math.sin(free.a), bx = free.x - hx * 14, bz = free.z - hz * 14, ax = free.x + hx * 20, az = free.z + hz * 20; tp.set(bx, Math.max(H(bx, bz), H(free.x, free.z)) + 5.6, bz); tl.set(ax, H(ax, az) + 1.8, az); }
  if (fall && crashFall) {      // sigue la caída desde el lado del camino
    const ff = fall.f; tl.copy(fall.p);
    tp.set(fall.p.x - ff.tx * 10 - ff.rx * 8 * crashSide, 0, fall.p.z - ff.tz * 10 - ff.rz * 8 * crashSide); tp.y = Math.max(fall.p.y + 7, H(tp.x, tp.z) + 3);
  }
  const k = camSnap ? 1 : 1 - Math.exp(-dt * 8); camSnap = false;
  camPos.lerp(tp, k); camLook.lerp(tl, k);
  camera.position.copy(camPos);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.2); }
  camera.lookAt(camLook);
}

/* ───────────── Radar ───────────── */
const rc = $('radar'), rx = rc.getContext('2d'); rx.scale(2, 2);
function drawRadar() {
  const W = 120, Hh = 240, sx = W / 28, sy = Hh / 170, behind = 35;
  const X = u => W / 2 + u * sx, Y = ds => Hh - (ds + behind) * sy;
  rx.clearRect(0, 0, W, Hh);
  rx.fillStyle = '#2e2a26'; rx.fillRect(0, 0, W, Hh);
  rx.fillStyle = '#6f5f48'; rx.fillRect(X(-12.1), 0, 24.2 * sx, Hh);
  rx.strokeStyle = '#f2efe6'; rx.lineWidth = 1.5; rx.beginPath(); rx.moveTo(X(-12.1), 0); rx.lineTo(X(-12.1), Hh); rx.moveTo(X(12.1), 0); rx.lineTo(X(12.1), Hh); rx.stroke();
  rx.strokeStyle = '#f2b705'; rx.setLineDash([6, 6]); rx.beginPath(); rx.moveTo(X(0), 0); rx.lineTo(X(0), Hh); rx.stroke(); rx.setLineDash([]);
  const veh = (s, u, w, l, fill, stroke) => {
    const ds = s - P.s; if (ds < -behind - l || ds > 135 + l) return;
    rx.fillStyle = fill; rx.fillRect(X(u) - w * sx / 2, Y(ds) - l * sy / 2, w * sx, l * sy);
    if (stroke) { rx.strokeStyle = stroke; rx.lineWidth = 2; rx.strokeRect(X(u) - w * sx / 2, Y(ds) - l * sy / 2, w * sx, l * sy); }
  };
  for (const c of rocasPista) { const ds = c.s - P.s; if (ds < -behind - 4 || ds > 140) continue; rx.fillStyle = '#b3a592'; rx.strokeStyle = '#2a2018'; rx.lineWidth = 1.5; rx.beginPath(); rx.arc(X(c.u), Y(ds), c.r * sx, 0, TAU); rx.fill(); rx.stroke(); }
  for (const t of trucks) veh(t.s, t.u, 7.2, 12, '#f7c600', t.auth ? '#35d27a' : '#241a10');
  for (const o of oncs) veh(o.s, o.u, o.kind === 'pickup' ? 2.6 : 7.2, o.kind === 'pickup' ? 5.5 : 12, o.kind === 'aljibe' ? '#3a8fe8' : (o.kind === 'pickup' ? '#f2f2f2' : '#f7c600'), (o.s - P.s) < 110 && (o.s - P.s) > 0 ? '#ff3b3b' : '#9a948a');
  veh(P.s, P.u, 2.4, 5, '#ff2a2a', '#fff');
  rx.fillStyle = 'rgba(255,255,255,.7)'; rx.font = '10px sans-serif'; rx.fillText('IZQ', 6, Hh - 6); rx.fillText('DER', W - 24, Hh - 6);
}

/* ───────────── Render por frame ───────────── */
const t0 = new THREE.Color();
function blink(b, auth) {
  const on = Math.sin(tAnim * 7) > 0;
  b.material.color.setHex(auth ? (on ? 0x2dff6a : 0x0f4a22) : (on ? 0xffb000 : 0x4a3300));
}
const _fq = new THREE.Quaternion(), _fa = new THREE.Vector3(), _fo = new THREE.Vector3();
function updateFall(dt) {       // se pasó el pretil del lado del rajo: rueda por la pendiente y cae
  if (!fall) {
    const f = frame(P.s);
    fall = { f, p: new THREE.Vector3(pickup.position.x, pickup.position.y + 1.2, pickup.position.z), q: pickup.quaternion.clone(),
      v: new THREE.Vector3(f.tx * P.v * 0.6 + f.rx * 4.5 * crashSide, 2.2, f.tz * P.v * 0.6 + f.rz * 4.5 * crashSide),
      w: new THREE.Vector3((f.tx * 6 + f.rx * 1.2) * crashSide, 0, (f.tz * 6 + f.rz * 1.2) * crashSide), t: 0, bounces: 0, rest: false };
  }
  const F = fall;
  if (!F.rest) {
    F.t += dt;
    const v = F.v, p = F.p;
    v.y -= 22 * dt; p.addScaledVector(v, dt);
    const gnd = H(p.x, p.z) + 1.1; let onG = false;
    if (p.y < gnd) {
      p.y = gnd; onG = true;
      if (v.y < -3 && F.bounces < 8) { v.y = -v.y * 0.35; F.bounces++; shake = Math.max(shake, 0.3); beep(85, 0.14, 'triangle', 0.06); } else v.y = 0;
      const e = 0.6, gx = (H(p.x + e, p.z) - H(p.x - e, p.z)) / (2 * e), gz = (H(p.x, p.z + e) - H(p.x, p.z - e)) / (2 * e);
      v.x += -gx * 14 * dt; v.z += -gz * 14 * dt;            // la pendiente lo arrastra hacia abajo
      v.x *= 1 - 0.9 * dt; v.z *= 1 - 0.9 * dt;
      F.w.multiplyScalar(Math.max(0, 1 - 0.7 * dt));
    }
    const wl = F.w.length();
    if (wl > 1e-4) { _fa.copy(F.w).divideScalar(wl); _fq.setFromAxisAngle(_fa, wl * dt); F.q.premultiply(_fq); }
    if (F.t > 7 || (F.t > 1 && onG && Math.hypot(v.x, v.z) < 0.5 && wl < 0.6)) F.rest = true;
  }
  _fo.set(0, 1.2, 0).applyQuaternion(F.q);                    // gira alrededor de su centro
  pickup.quaternion.copy(F.q); pickup.position.copy(F.p).sub(_fo);
  P.y = Math.max(0, F.p.y - 1.1);
}
function nearestRoca() {
  let best = null;
  for (const c of rocasPista) { const d = c.s - P.s - 2.4; if (d > -2 && d < 55 && Math.abs(c.u - P.u) < c.r + 3.2 && (!best || d < best.d)) best = { c, d }; }
  return best;
}
const camMarker = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0xff5a00 }));
camMarker.rotation.x = Math.PI; camMarker.visible = false; scene.add(camMarker);
function updateVisuals(dt) {
  if (free) { setWorldPose(pickup, free.x, free.z, Math.cos(free.a), Math.sin(free.a)); P.y = pickup.position.y; }
  else P.y = place(pickup, P.s, P.u, arrive && arrive.park ? -1 : 1, P.vu / Math.max(P.v, 3) * 0.6);      // en reversa al estacionar
  const braking = (keys.down || inp.brk > 0.15 || (arrive && arrive.brake)) && mode === 'play';      // luces de freno de la camioneta
  brakeMat.color.setHex(braking ? 0xff2a1f : 0x5a0d0d);
  for (const ch of pickup.children) if (ch.name === 'brakeGlow') ch.material.opacity = braking ? 0.95 : 0;
  if (mode === 'over' && crush) {      // el camión sigue su marcha por encima y la camioneta queda aplastada
    crush.t += dt;
    if (crush.dir && crush.t < 2.8) crush.by.s += crush.dir * Math.max(crush.by.v0 || 4, 4) * dt;
    const k = Math.min(1, Math.max(0, (crush.t - 0.12) / 0.4)), e = k * k * (3 - 2 * k);
    if (k > 0 && !crush.snd) { crush.snd = true; beep(70, 0.4, 'sawtooth', 0.1); shake = Math.max(shake, 0.9); }
    pickup.scale.set(1 + 0.3 * e, 1 - 0.9 * e, 1 + 0.12 * e);
  } else if (pickup.scale.y !== 1) pickup.scale.set(1, 1, 1);
  if (mode === 'over' && crashFall) updateFall(dt);
  else if (mode === 'over' && crashSide) {      // choque contra el pretil: se desliza y vuelca de lado
    crashT += dt; const k = Math.min(1, crashT / 0.9), e = 1 - (1 - k) * (1 - k);
    P.y = place(pickup, P.s + P.v * 0.8 * e, P.u + crashSide * 0.9 * e, 1, 0);
    const ang = crashSide * (Math.PI / 2) * e;
    pickup.rotateZ(ang);
    pickup.position.y += Math.abs(Math.sin(ang)) * 1.0 + Math.sin(Math.PI * k) * 0.8;
  }
  const pb = pickup.getObjectByName('beacon'); if (pb) pb.material.color.setHex(Math.sin(tAnim * 7) > 0 ? 0x3d8bff : 0x0a1c4d);
  for (const t of trucks) { place(t.mesh, t.s, t.u + (t.off || 0), 1, 0); blink(t.beacon, t.auth); }
  for (const o of oncs) { place(o.mesh, o.s, o.u, -1, 0); blink(o.beacon, false); if (o.spray) { o.spray.visible = o.spraying; if (o.spraying) updateSpray(o.spray, tAnim); } }

  animOps(dt, tAnim);
  camMarker.visible = false; marker.visible = false;      // sin rombos ni triángulos sobre vehículos o rocas
  updateCamera(dt);
}

function updateHud() {
  const kmh = P.v * 3.6;
  el.kmh.textContent = Math.round(kmh);
  el.bar.style.width = Math.min(100, kmh / 90 * 100) + '%';
  el.bar.className = kmh > 60 ? 'bad' : (kmh >= 56 ? 'warn' : '');
  el.spd.classList.toggle('flash', kmh > 60 && mode === 'play');
  el.alt.textContent = Math.max(0, Math.min(Math.round(L - START_S), Math.round(P.s - START_S))); el.tm.textContent = fmt(tGame); el.ovk.textContent = overtakes;

  if (mode !== 'play') return;
  const tg = findTarget(), na = nearAuth();
  if (tg) { el.auth.disabled = false; el.auth.className = ''; el.auth.innerHTML = 'Solicitar autorización<span class="kbk"> (0 / Espacio)</span><small>CAEX-' + pad(tg.t.id) + ' · a ' + Math.max(0, Math.round(tg.d - 8.5)) + ' m</small>'; }
  else if (na) { el.auth.disabled = true; el.auth.className = 'done'; el.auth.innerHTML = 'Autorizado<small>Adelanta por la derecha</small>'; }
  else { el.auth.disabled = true; el.auth.className = ''; el.auth.innerHTML = 'Solicitar autorización<span class="kbk"> (0 / Espacio)</span><small>Acércate a un camión (hasta ' + REQ_RANGE + ' m)</small>'; }

  // avisos
  let oncNear = false;
  for (const o of oncs) { const d = o.s - P.s; if (d > 0 && d < 120 && P.u > -2.5) oncNear = true; }
  let gapMin = 99;
  for (const t of trucks) { const d = t.s - P.s; if (!t.auth && d > 0 && Math.abs(t.u - P.u) < 3.2) gapMin = Math.min(gapMin, d - 9.8); }
  const cn = nearestRoca(), camNear = cn ? cn.d : null;
  const al = [], A = (key, ico, num, label, sev) => al.push({ key, ico, num, label, sev });
  if (!intro && !arrive && !free && P.u < -(CRASH_U - 1.9)) A('pl', '⚠', '', 'Pretil izq.', 'bad');
  else if (!intro && !arrive && !free && P.u > CRASH_U - 1.9) A('pr', '⚠', '', 'Pretil der.', 'bad');
  if (camNear !== null) A('roca', '🚧', Math.max(0, Math.round(camNear)) + ' m', 'Roca', camNear < 25 ? 'bad' : 'warn');
  if (gapMin < FOLLOW_DIST + 12) A('caex', '🚛', Math.max(0, Math.round(gapMin)) + ' m', 'Mín. ' + FOLLOW_DIST + ' m', gapMin < FOLLOW_DIST + 5 ? 'bad' : 'warn');
  if (kmh > 60 && !TEST) A('vel', 'SIGN:' + Math.round(kmh), '', 'Límite 60', 'bad');
  else if (kmh >= 56) A('vel', 'SIGN:60', '', 'Cerca del límite', 'warn');
  if (slickNow(P.s) > 0.3) A('mojado', '💧', '', 'Piso mojado', 'warn');
  if (!TEST && P.s > ZONE_S - 110 && P.s < ZONE_S + ROCK_ZIG[2][0] + 12) A('zona', '⛰', '', 'Caída de rocas', 'warn');
  if (wrongT > 1.5) A('pista', '↩', '', 'Tu pista', 'bad');
  else if (oncNear) A('contra', '🚗', '', 'En contra', 'bad');
  al.sort((a, b) => (b.sev === 'bad') - (a.sev === 'bad'));
  renderAlerts(al.slice(0, 4));
  if (bannerT > 0) bannerT -= 1 / 60; else setBanner('');

  // sonido de aviso
  beepT -= 1 / 60;
  if (kmh > 60 && !TEST && beepT <= 0) { beep(880, 0.1, 'square', 0.05); beepT = 0.28; }
  camBeepT -= 1 / 60; gapBeepT -= 1 / 60;
  if (gapMin < FOLLOW_DIST + 12 && gapBeepT <= 0) { beep(520, 0.12, 'sawtooth', 0.04); gapBeepT = 0.25 + Math.max(0, gapMin - FOLLOW_DIST) / 12 * 0.6; }   // CAEX muy cerca: pitido grave
  if (eng) eng.frequency.value = 46 + P.v * 9;
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; tAnim += dt;
  pollInput(); if (cal.open) calTick();
  if (mode === 'play' && !rotBlocked) step(dt);      // en vertical (celular) el juego queda en pausa
  if (mode === 'menu') { P.s = START_S; P.u = START_U0; if (FREE0 && free) Object.assign(free, FREE0); }
  if (mode === 'play') {      // latido cada 4 s para espectadores, solo si tiene plaza; si no, reintenta pedirla cada 20 s
    liveT -= dt; if (liveT <= 0) { liveT = 4; liveSend(); }
    if (!liveOn) { liveRetryT -= dt; if (liveRetryT <= 0) liveJoin(); }
  }
  updateVisuals(dt); updateHud();
  if (mode === 'play') drawRadar();
  renderer.render(scene, camera);
  if (pendingShot) { pendingShot = false; const im = $('shotImg'); im.src = renderer.domElement.toDataURL('image/jpeg', 0.85); im.hidden = false; }
}
resetGame(); camSnap = true;
requestAnimationFrame(loop);




