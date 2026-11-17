// Llegada: tramo automático por la superficie hasta el domo (stepArrival) y estacionamiento en reversa entre las camionetas, con cotillón y resultado (parkStep).
import { CRUISE, LANE } from '../config/diseno.js';
import { clamp } from '../comun/mates.js';
import { L } from '../terreno/construir.js';
import { END_S, G, P, endGame } from './estado.js';
import { motorRpm } from '../ui/sonido.js';
import { cotillon } from '../ui/avisos.js';

function parkStep(dt) {      // estaciona en reversa entre las dos camionetas del domo; al terminar, cotillón y resultado
  const pk = G.arrive.park; pk.t += dt;
  const k = Math.min(1, pk.t / 5), e = k * k * (3 - 2 * k);
  P.s = pk.s0 + (pk.s1 - pk.s0) * e; P.u = pk.u0 + (pk.u1 - pk.u0) * e; P.v = 0; P.vu = 0;
  if (k >= 1 && !pk.fin) { pk.fin = true; cotillon(); setTimeout(() => { G.arrive = null; endGame(true, 'Saliste del rajo respetando las reglas del camino y llegaste al domo.'); }, 3200); }
}
function stepArrival(dt) {      // tramo final automático: sigue por la superficie, gira hacia el domo y se estaciona frente a su puerta
  if (G.arrive.park) { parkStep(dt); return; }
  G.arrive.t += dt;      // el tiempo se detiene al cruzar la meta
  const dist = END_S - P.s, vt = dist > 50 ? CRUISE : Math.max(0, Math.min(CRUISE, dist * 0.3));      // sobre la superficie va a 50 km/h y frena al llegar
  P.v += clamp(vt - P.v, -3.2 * dt, 2.5 * dt); P.s = Math.min(END_S, P.s + P.v * dt);
  G.arrive.brake = vt < P.v - 0.3;
  const ut = dist < 75 ? -21.5 : -LANE;
  P.vu += ((ut - P.u) * 1.1 - P.vu) * (1 - Math.exp(-dt * 3)); P.u += P.vu * dt;
  motorRpm(P.v);
  if (!G.arrive.done && dist < 1.5 && P.v < 0.15) { G.arrive.done = true; G.arrive.brake = false; P.v = 0; P.vu = 0; G.arrive.park = { t: 0, s0: P.s, u0: P.u, s1: L + 184, u1: -28.5 }; }
}

export { stepArrival };
