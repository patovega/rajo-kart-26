// Reglas del juego: resetGame arma una partida (tráfico, rocas, aljibe y camino mojado) y step(dt) la simula: tráfico, rocas, salida automática, tránsito libre, la camioneta (velocidad, dirección, piso mojado) y las reglas (pretil, carril CAEX, choques, distancia al CAEX, adelantamientos, pista contraria, meta).
import { CRASH_U, CRUISE, FOLLOW_DIST, LANE, SPEED_LIMIT, VTOP } from '../config/diseno.js';
import { clamp } from '../comun/mates.js';
import { nextCaexId, resetCaexIds } from '../modelos/camiones.js';
import { scene } from '../escena.js';
import { CAEX_LANE, H, L, PLAT, START_S, START_U0, frame, seedWet, slickNow, updateRoad } from '../terreno/construir.js';
import { pad } from '../comun/texto.js';
import { G, P, endGame, inp, keys, oncs, pickup, rocasPista, rocks, trucks } from './estado.js';
import { beep } from '../ui/sonido.js';
import { cotillon, metaMensaje, renderAlerts, setBanner, speak } from '../ui/avisos.js';
import { mkRoca, updateRocks } from './rocas.js';
import { MOTO_CORD, mkAlj, mkMoto, mkSame, nombreEq, stepDozer, stepTrafico } from './trafico.js';
import { stepFree } from './libre.js';
import { stepArrival } from './llegada.js';

const KART = { CRUISE: 45 / 3.6, TOP: 110 / 3.6, META: { x: 1076.1, z: -493.6 } };      // modo karting: 45 km/h sola, hasta 110 con el acelerador; la meta es el punto de la ruta más cercano a META
KART.S = (() => { let b = null; for (let s = 0; s <= L; s += 1) { const f = frame(s), d = Math.hypot(f.x - KART.META.x, f.z - KART.META.z); if (!b || d < b.d) b = { s, d }; } return b.s; })();

/* ───────────── Simulación ───────────── */
function resetGame() {
  resetCaexIds();
  for (const t of trucks.concat(oncs)) { scene.remove(t.mesh); if (t.cord) scene.remove(t.cord); }
  for (const r of rocks) scene.remove(r.mesh);
  for (const c of rocasPista) scene.remove(c.mesh);
  rocasPista.length = 0;
  if (!G.TEST) for (let cs = START_S + 130 + Math.random() * 40; cs < L - 70; cs += 150 + Math.random() * 130) if (!PLAT || Math.abs(cs - PLAT.se) > PLAT.HL + 60) rocasPista.push(mkRoca(cs));
  trucks.length = 0; oncs.length = 0; rocks.length = 0; G.rockT = 6; G.crashSide = 0; G.crashT = 0; G.fall = null; G.crashFall = false; G.crush = null; G.arrive = null; pickup.scale.set(1, 1, 1);
  Object.assign(P, { s: START_S, u: START_U0, v: 0, vu: 0 }); G.intro = null; G.free = G.FREE0 ? { x: G.FREE0.x, z: G.FREE0.z, a: G.FREE0.a } : null;
  G.tGame = 0; G.overtakes = 0; G.spawnT = 8; G.wrongT = 0; G.beepT = 0; G.shake = 0;
  let s = START_S + 110;
  while (s < L - 60) { trucks.push(mkSame(s, nextCaexId())); s += 130 + Math.random() * 110; }
  {      // una motoniveladora nivelando tu pista en la mitad del recorrido, lejos del carril CAEX, del piso de la fase 7 y de los camiones
    let sm = null; for (let c = START_S + 1300 + Math.random() * 300; c < L - 900; c += 40) if (!(c > CAEX_LANE.a - 150 && c < CAEX_LANE.b + 50) && (!PLAT || Math.abs(c - PLAT.se) > PLAT.HL + 80)) { sm = c; break; }
    if (sm !== null) { for (let i = trucks.length - 1; i >= 0; i--) if (Math.abs(trucks[i].s - sm) < 90) { scene.remove(trucks[i].mesh); trucks.splice(i, 1); } trucks.push(mkMoto(sm)); }
  }
  for (let rs = CAEX_LANE.a + 30; rs < CAEX_LANE.b - 60; rs += 170) { const t = mkSame(rs, nextCaexId()); t.u = CAEX_LANE.u; trucks.push(t); }      // CAEX en el carril solo CAEX
  const alj = mkAlj(P.s + 190); oncs.push(alj);       // un solo aljibe: viene bajando y deja el camino mojado
  alj.cyc = 4; seedWet(alj.s + 7, alj.v, alj.cyc); G.aljT = 80 + Math.random() * 50; G.pickT = 20 + Math.random() * 15; updateRoad(0);
  if (G.TEST) { for (const t of trucks.concat(oncs)) { scene.remove(t.mesh); if (t.cord) scene.remove(t.cord); } trucks.length = 0; oncs.length = 0; }      // modo prueba: camino libre
  setBanner('');
}

function step(dt) {
  stepDozer(dt);
  const K = G.modo === 'kart';
  if (!G.TEST && !K && P.v * 3.6 > SPEED_LIMIT) { G.overT += dt; if (G.overT >= 5) return endGame(false, 'Superaste el límite de 60 km/h por más de 5 segundos.'); }
  else G.overT = 0;
  if (G.arrive) { stepArrival(dt); return; }      // llegó a la meta: la camioneta sigue sola hasta el domo
  G.tGame += dt;

  stepTrafico(dt);
  updateRoad(dt); updateRocks(dt);
  if (G.intro) {      // salida de la explanada: la camioneta sale sola de junto a la pala y se incorpora a su pista
    G.intro.t += dt; const k = Math.min(1, G.intro.t / 3.6), e = k * k * (3 - 2 * k), nu = G.intro.u0 + (-LANE - G.intro.u0) * e;
    P.vu = (nu - P.u) / Math.max(dt, 1e-3); P.u = nu; P.v = Math.min(CRUISE, G.intro.t * 3.6); P.s += P.v * dt;
    if (k >= 1) { G.intro = null; P.vu = 0; }
    return;
  }
  if (G.free) { stepFree(dt); return; }

  // Camioneta
  const slick = slickNow(P.s);             // piso mojado donde pasó el aljibe: menos agarre
  const thr = Math.max(keys.up ? 1 : 0, inp.thr), brk = Math.max(keys.down ? 1 : 0, inp.brk);
  const vt = K ? KART.CRUISE + (KART.TOP - KART.CRUISE) * thr : CRUISE + (VTOP - CRUISE) * thr;      // camioneta: sola hasta 50 km/h, con ↑ o el pedal hasta 80; kart: 45 y hasta 110, acelera y frena más fuerte
  let acc;
  if (brk > 0.05) acc = -((K ? 11 : 7) - 4.2 * slick) * brk;
  else if (P.v < vt) acc = Math.min(K ? 6 : 2.8, (vt - P.v) * 2.5 + 0.2) * (1 - 0.35 * slick);
  else acc = -Math.min(1.5, (P.v - vt) * 4) * (1 - 0.5 * slick);
  P.v = clamp(P.v + acc * dt, 0, K ? KART.TOP : VTOP);
  const kbs = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), asteer = inp.analog && Math.abs(inp.steer) > 0.05 ? inp.steer : 0;
  const steer = kbs || asteer, grip = Math.min(1, P.v / 2.5), kmhNow = P.v * 3.6;
  let target;
  if (steer) target = steer * (K ? 9 : 5.2) * grip * (1 - 0.3 * slick);      // el kart dobla rápido y no vuelve solo a su pista (solo se endereza un poco)
  else if (K) target = P.vu * 0.85;
  else { const c = P.u < 0 ? -LANE : LANE; target = clamp((c - P.u) * 1.0, -2.5, 2.5) * grip * (1 - 0.5 * slick); }
  P.vu += (target - P.vu) * (1 - Math.exp(-dt * ((K ? 10 : 7) - 4.6 * slick)));
  if (slick > 0.05 && kmhNow > 30) {      // se patina: la camioneta se desliza de lado, más al frenar o girar fuerte
    const amp = slick * Math.min(1.6, (kmhNow - 30) / 35) * (1 + (brk > 0.05 ? 0.8 : 0) + Math.abs(steer) * 0.4);
    P.vu += (Math.sin(G.tGame * 2.3) + 0.6 * Math.sin(G.tGame * 3.9 + 1)) * 6 * amp * dt;
  }
  P.u += P.vu * dt;
  G.skidT -= dt;
  if (slick > 0.3 && kmhNow > 35 && (steer || brk > 0.05) && G.skidT <= 0) { beep(1100 + Math.random() * 250, 0.14, 'sawtooth', 0.03); G.skidT = 0.22; }
  P.s += P.v * dt;

  // Reglas
  const kmh = P.v * 3.6;
  if (Math.abs(P.u) > CRASH_U) {
    G.crashSide = P.u < 0 ? -1 : 1; G.crashT = 0;
    const cf = frame(P.s); G.crashFall = H(cf.x + cf.rx * G.crashSide * 20, cf.z + cf.rz * G.crashSide * 20) < H(cf.x, cf.z) - 3;      // ¿el terreno de ese lado cae al rajo?
    return endGame(false, G.crashFall ? 'Pasaste el pretil hacia el rajo: rodaste y caíste.' : 'Te fuiste contra el pretil y volcaste de lado.');
  }
  if (!K && P.s > CAEX_LANE.a && P.s < CAEX_LANE.b && Math.abs(P.u - CAEX_LANE.u) < 7) return endGame(false, 'Entraste al carril solo para CAEX.');
  for (const t of trucks) if (t.kind === 'moto' && P.s > t.s0 && P.s < t.s + 1 && P.u < -LANE + MOTO_CORD + 1.9)      // el cordón de tierra que deja la hoja
    return endGame(false, 'Pasaste por encima del cordón de tierra de la motoniveladora: se pasa por el otro lado del cordón.');
  for (const t of trucks) if (Math.abs(t.s - P.s) < 9.8 && Math.abs(t.u - P.u) < (t.kind === 'moto' ? 3.8 : 5.2)) {
    G.crush = { by: t, dir: 0, t: 0, snd: false };
    return endGame(false, t.kind === 'moto' ? 'Chocaste con la motoniveladora.' : 'Chocaste con el camión CAEX-' + pad(t.id) + ': la camioneta quedó aplastada.');
  }
  for (const o of oncs) if (Math.abs(o.s - P.s) < (o.cl || 8.6) && Math.abs(o.u - P.u) < (o.cw || 4.7)) {
    G.crush = { by: o, dir: -1, t: 0, snd: false };
    return endGame(false, o.kind === 'pickup' ? 'Choque frontal con otra camioneta que venía en sentido contrario.' : 'Choque frontal: el camión te pasó por encima y la camioneta quedó aplastada.');
  }
  for (const t of trucks) {
    const d = t.s - P.s;
    if (!K && !t.auth && d > 0 && Math.abs(t.u - P.u) < 3.2 && d - 9.8 < FOLLOW_DIST)      // con autorización no rige la distancia; en el karting no rige
      return endGame(false, 'Te acercaste a menos de ' + FOLLOW_DIST + ' m ' + (t.kind === 'moto' ? 'de la motoniveladora' : 'del CAEX-' + pad(t.id)) + '.');
  }
  for (const c of rocasPista) if (Math.abs(c.s - P.s) < c.r + 2.4 && Math.abs(c.u - P.u) < c.r + 0.95)
    return endGame(false, 'Chocaste con una roca en el camino.');

  let context = false;
  for (const t of trucks) {
    const d = t.s - P.s;
    if (d > -30 && d < 42) context = true;
    if (t.prevD > 0 && d <= 0 && K) { G.overtakes++; t.prevD = d; continue; }      // karting: se adelanta sin pedir autorización, por cualquier lado
    if (t.prevD > 0 && d <= 0) {
      if (!t.auth) return endGame(false, 'Adelantaste a ' + nombreEq(t) + ' sin solicitar autorización.');
      if (P.u < t.u + 2) return endGame(false, t.kind === 'moto' ? 'A la motoniveladora se la pasa por la derecha, por el otro lado del cordón.' : 'Solo se adelanta por la derecha.');
      t.passed = true; G.overtakes++; setBanner('Adelantamiento completado. Vuelve a tu pista.', 'ok'); G.bannerT = 2.2;
    }
    if (d > 0) t.passed = false;
    t.prevD = d;
  }
  for (const c of rocasPista) { const d = c.s - P.s; if (d > -15 && d < 55) context = true; }      // esquivar una roca justifica salir de la pista
  if (!G.TEST && !K && P.u > -2 && !context) { G.wrongT += dt; if (G.wrongT > 4) return endGame(false, 'Circulaste por la pista contraria sin motivo.'); }
  else G.wrongT = Math.max(0, G.wrongT - dt * 2);

  if (K && P.s >= KART.S) { renderAlerts([]); cotillon(); setBanner('¡Meta!', 'meta'); G.bannerT = 4; speak('Llegaste a la meta'); return endGame(true, '¡Llegaste a la meta en ' + Math.floor(G.tGame / 60) + ':' + String(Math.floor(G.tGame % 60)).padStart(2, '0') + '!'); }
  if (P.s >= L - 2) { G.arrive = { t: 0 }; cotillon(); setBanner('¡Lo lograste! Sigue hasta el domo.', 'meta'); metaMensaje(); G.bannerT = 5; renderAlerts([]); speak('Llegaste a la superficie'); return; }
}

export { KART, resetGame, step };
