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
import { mkRoca, resetFallRocks, updateFallRocks, updateRocks } from './rocas.js';
import { mkAlj, mkSame, stepDozer, stepTrafico } from './trafico.js';
import { stepFree } from './libre.js';
import { stepArrival } from './llegada.js';

/* ───────────── Simulación ───────────── */
function resetGame() {
  resetCaexIds();
  for (const t of trucks.concat(oncs)) scene.remove(t.mesh);
  for (const r of rocks) scene.remove(r.mesh);
  for (const c of rocasPista) scene.remove(c.mesh);
  rocasPista.length = 0;
  if (!G.TEST) for (let cs = START_S + 130 + Math.random() * 40; cs < L - 70; cs += 150 + Math.random() * 130) if (!PLAT || Math.abs(cs - PLAT.se) > PLAT.HL + 60) rocasPista.push(mkRoca(cs));
  resetFallRocks();
  trucks.length = 0; oncs.length = 0; rocks.length = 0; G.rockT = 6; G.crashSide = 0; G.crashT = 0; G.fall = null; G.crashFall = false; G.crush = null; G.arrive = null; pickup.scale.set(1, 1, 1);
  Object.assign(P, { s: START_S, u: START_U0, v: 0, vu: 0 }); G.intro = null; G.free = G.FREE0 ? { x: G.FREE0.x, z: G.FREE0.z, a: G.FREE0.a } : null;
  G.tGame = 0; G.overtakes = 0; G.spawnT = 8; G.wrongT = 0; G.beepT = 0; G.shake = 0;
  let s = START_S + 110;
  while (s < L - 60) { trucks.push(mkSame(s, nextCaexId())); s += 130 + Math.random() * 110; }
  for (let rs = CAEX_LANE.a + 30; rs < CAEX_LANE.b - 60; rs += 170) { const t = mkSame(rs, nextCaexId()); t.u = CAEX_LANE.u; trucks.push(t); }      // CAEX en el carril solo CAEX
  const alj = mkAlj(P.s + 190); oncs.push(alj);       // un solo aljibe: viene bajando y deja el camino mojado
  alj.cyc = 4; seedWet(alj.s + 7, alj.v, alj.cyc); G.aljT = 80 + Math.random() * 50; G.pickT = 20 + Math.random() * 15; updateRoad(0);
  if (G.TEST) { for (const t of trucks.concat(oncs)) scene.remove(t.mesh); trucks.length = 0; oncs.length = 0; }      // modo prueba: camino libre
  setBanner('');
}

function step(dt) {
  stepDozer(dt);
  if (!G.TEST && P.v * 3.6 > SPEED_LIMIT) { G.overT += dt; if (G.overT >= 5) return endGame(false, 'Superaste el límite de 60 km/h por más de 5 segundos.'); }
  else G.overT = 0;
  if (G.arrive) { stepArrival(dt); return; }      // llegó a la meta: la camioneta sigue sola hasta el domo
  G.tGame += dt;

  stepTrafico(dt);
  updateRoad(dt); updateRocks(dt); updateFallRocks(dt);
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
  if (P.s > CAEX_LANE.a && P.s < CAEX_LANE.b && Math.abs(P.u - CAEX_LANE.u) < 7) return endGame(false, 'Entraste al carril solo para CAEX.');
  for (const t of trucks) if (Math.abs(t.s - P.s) < 9.8 && Math.abs(t.u - P.u) < 5.2) {
    G.crush = { by: t, dir: 0, t: 0, snd: false };
    return endGame(false, 'Chocaste con el camión CAEX-' + pad(t.id) + ': la camioneta quedó aplastada.');
  }
  for (const o of oncs) if (Math.abs(o.s - P.s) < (o.cl || 8.6) && Math.abs(o.u - P.u) < (o.cw || 4.7)) {
    G.crush = { by: o, dir: -1, t: 0, snd: false };
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
      t.passed = true; G.overtakes++; setBanner('Adelantamiento completado. Vuelve a tu pista.', 'ok'); G.bannerT = 2.2;
    }
    if (d > 0) t.passed = false;
    t.prevD = d;
  }
  for (const c of rocasPista) { const d = c.s - P.s; if (d > -15 && d < 55) context = true; }      // esquivar una roca justifica salir de la pista
  if (!G.TEST && P.u > -2 && !context) { G.wrongT += dt; if (G.wrongT > 4) return endGame(false, 'Circulaste por la pista contraria sin motivo.'); }
  else G.wrongT = Math.max(0, G.wrongT - dt * 2);

  if (P.s >= L - 2) { G.arrive = { t: 0 }; cotillon(); setBanner('¡Lo lograste! Sigue hasta el domo.', 'meta'); metaMensaje(); G.bannerT = 5; renderAlerts([]); speak('Llegaste a la superficie'); return; }
}

export { resetGame, step };
