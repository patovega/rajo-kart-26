// Tráfico: CAEX en el mismo sentido (mkSame), tráfico en contra (CAEX, aljibe, camionetas), su movimiento y aparición (stepTrafico), autorización para adelantar (requestAuth, findTarget, nearAuth) y la zona de la superficie con el wheel dozer que cruza empujando una roca (stepDozer).
import { LANE, REQ_RANGE } from '../config/diseno.js';
import { clamp, hash } from '../comun/mates.js';
import { addPlates } from '../modelos/materiales.js';
import { ALJ_PLATE, CAEX_PLATE, buildPickup, protoAlj, protoOnc, protoSame } from '../modelos/camiones.js';
import { buildDozerConRoca } from '../modelos/dozers.js';
import { motoniveladora } from '../modelos/motoniveladora.js';
import { scene } from '../escena.js';
import { H, L, SMIN, frame, wetRange } from '../terreno/construir.js';
import { pad } from '../comun/texto.js';
import { G, P, endGame, oncs, rocasPista, trucks } from './estado.js';
import { beep } from '../ui/sonido.js';
import { showRadio } from '../ui/avisos.js';

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
const MOTO_CORD = -2.9;      // el cordón de tierra de la motoniveladora queda 2,9 m a su izquierda (punta trasera de la hoja, hacia el pretil): se la pasa por la derecha, por el otro lado del cordón
function mkMoto(s) {      // motoniveladora nivelando tu pista (subiendo a ~7 km/h con la hoja abajo): deja un cordón de tierra a su izquierda; hay que pedirle autorización y pasarla por la derecha
  const mesh = motoniveladora(); scene.add(mesh);
  const pos = [], idx = [], n = Math.max(2, Math.floor(Math.min(700, L - 5 - s) / 2));
  for (let i = 0; i <= n; i++) { const f = frame(s + i * 2), w = 0.6 + 0.2 * hash(i, 5), h = 0.5 + 0.3 * hash(5, i), dl = (hash(i * 3, 1) - 0.5) * 0.3;
    for (const [du, y] of [[-w, 0], [dl, h], [w, 0]]) { const u = -LANE + MOTO_CORD + du, x = f.x + f.rx * u, z = f.z + f.rz * u; pos.push(x, H(x, z) + 0.05 + y, z); } }
  for (let i = 0; i < n; i++) { const a = 3 * i, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
  const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.setIndex(idx); ge.computeVertexNormals(); ge.setDrawRange(0, 0);
  const cord = new THREE.Mesh(ge, new THREE.MeshLambertMaterial({ color: 0x7f6648, flatShading: true, side: THREE.DoubleSide })); scene.add(cord);
  return { id: 0, kind: 'moto', s, u: -LANE, v: 0, v0: 1.9, mesh, beacon: null, auth: false, passed: false, prevD: s - P.s, s0: s, cord, ncord: n };
}
const nombreEq = t => t.kind === 'moto' ? 'la motoniveladora MN-01' : 'CAEX-' + pad(t.id);
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
  if (G.mode !== 'play' || G.modo !== 'route') return;      // ningún modo pide autorización por ahora (karting: se adelanta sin pedirla; simulador: no hay ruta)
  const tg = findTarget(); if (!tg) return;
  const t = tg.t; t.auth = true;
  if (t.zona) startDozer(t);
  beep(520, 0.08, 'square', 0.04); beep(780, 0.1, 'square', 0.04, 0.1);
  showRadio('<b>Tú</b>: Solicito autorización para adelantar a ' + nombreEq(t) + '.');
  setTimeout(() => {
    if (G.mode !== 'play') return;
    showRadio(t.kind === 'moto' ? '<b>MN-01</b>: «Autorizado. Me detengo; pasa por la derecha, por el otro lado del cordón.»' : '<b>CAEX-' + pad(t.id) + '</b>: «Autorizado con precaución.»');
    beep(660, 0.09, 'sine', 0.05); beep(990, 0.14, 'sine', 0.05, 0.1);
  }, 700);
}

function stepTrafico(dt) {      // camiones en el mismo sentido, tráfico en contra (CAEX, aljibe, camionetas) y su aparición
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
  if (!G.TEST) {      // tráfico en contra (no en modo prueba)
  G.spawnT -= dt;
  if (G.spawnT <= 0) { if (P.s + 260 < L - 30 && !oncs.some(o => Math.abs(o.s - (P.s + 260)) < 60)) oncs.push(mkOnc(P.s + 260)); G.spawnT = 11 + Math.random() * 10; }
  if (!oncs.some(o => o.kind === 'aljibe')) {                  // nunca más de un aljibe
    G.aljT -= dt;
    if (G.aljT <= 0 && P.s + 250 < L - 40 && !oncs.some(o => Math.abs(o.s - (P.s + 250)) < 60)) { oncs.push(mkAlj(P.s + 250)); G.aljT = 80 + Math.random() * 50; }
  }
  G.pickT -= dt;
  if (G.pickT <= 0) { if (P.s + 260 < L - 30 && !oncs.some(o => Math.abs(o.s - (P.s + 260)) < 60)) oncs.push(mkOncPickup(P.s + 260)); G.pickT = 28 + Math.random() * 30; }
  }
}

export { MOTO_CORD, mkMoto, nombreEq, mkSame, mkOncPickup, mkOnc, mkAlj, findTarget, nearAuth, requestAuth, stepDozer, stepTrafico };
