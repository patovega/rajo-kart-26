// Tránsito libre por el piso de la fase 7 antes de tomar la Rampa Sur: punto de partida (buscarPartidaLibre), obstáculos (taludes, pilas, equipos) y el portón entre los postes pasacables (stepFree).
import { CRASH_U, TAU, VTOP } from '../config/diseno.js';
import { clamp } from '../comun/mates.js';
import { CELL, GD, GNX, GNZ, GX0, GZ0, H, L, START_S, f7h, frame, inF7 } from '../terreno/construir.js';
import { onRoadC } from '../operaciones/malla.js';
import { G, OBST, P, endGame, inp, keys } from './estado.js';
import { beep } from '../ui/sonido.js';
import { setBanner } from '../ui/avisos.js';
import { mundo as M } from '../mundo.js';

function buscarPartidaLibre() {      // punto de partida del tránsito libre: en el piso de la fase 7, en el extremo más alejado de la Rampa Sur, con camino recto despejado hasta el portón
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
}
const freeBlocked = (x, z, hx, hz) => {      // talud, pila o caída adelante, o un equipo detenido
  if (x < GX0 + 10 || z < GZ0 + 10 || x > GX0 + (GNX - 1) * CELL - 10 || z > GZ0 + (GNZ - 1) * CELL - 10) return true;      // fin del terreno
  const h0 = H(x, z), h1 = H(x + hx * 3, z + hz * 3);
  if (Math.abs(h1 - h0) > 2.2) return true;      // más de ~35°: talud, pila o caída
  return OBST.some(o => o.r !== 1.2 && Math.hypot(o.x - x, o.z - z) < o.r);      // los cables por el piso (r 1,2) no frenan: se pasa por encima (y se paga)
};
const cableBajo = (x, z) => OBST.some(o => o.r === 1.2 && Math.hypot(o.x - x, o.z - z) < 1.9);      // la camioneta está sobre un cable tendido por el piso
function stepFree(dt) {      // tránsito libre por el piso de la fase 7 (sin pistas ni reglas): se toma la Rampa Sur al llegar a ella
  const F = G.free, thr = Math.max(keys.up ? 1 : 0, inp.thr), brk = Math.max(keys.down ? 1 : 0, inp.brk);
  const vt = G.modo === 'kart' ? 12.5 + 18 * thr : 8.3 + (G.TEST ? 13.9 : 5.6) * thr;      // camioneta: 30 km/h sola, hasta 50 con ↑ o el pedal (80 en modo prueba); kart: 45 y hasta 110
  let acc; if (brk > 0.05) acc = -7 * brk; else if (P.v < vt) acc = Math.min(2.8, (vt - P.v) * 2.5 + 0.2); else acc = -Math.min(1.5, (P.v - vt) * 4);
  P.v = clamp(P.v + acc * dt, 0, Math.max(VTOP, vt));
  const kbs = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), steer = kbs || (inp.analog && Math.abs(inp.steer) > 0.05 ? inp.steer : 0);
  F.a += steer * Math.max(0.7, Math.min(P.v / 9, 1.3, 16 / Math.max(P.v, 1))) * dt;      // a más de ~60 km/h gira más suave (no se descontrola)      // también gira detenida, para salir de un talud
  const hx = Math.cos(F.a), hz = Math.sin(F.a), nx = F.x + hx * P.v * dt, nz = F.z + hz * P.v * dt;
  let gateMsg = false;
  if (M.GATE && !F.gate && !G.TEST && G.modo !== 'sim') {      // solo se llega a la Rampa Sur pasando entre los postes pasacables
    const near = (x, z) => { let b = null; for (let s = START_S; s < START_S + 260; s += 2) { const f = frame(s), d = Math.hypot(f.x - x, f.z - z); if (!b || d < b.d) b = { s, d }; } return b; };
    const hiA = H(F.x, F.z) > f7h(F.x, F.z) + 3, hiN = H(nx, nz) > f7h(nx, nz) + 3;      // arriba de la rampa o en la cancha de perforación (sobre el piso de la bahía) no rige el portón
    if (!hiN) { const a = near(F.x, F.z), b = near(nx, nz);
      if (a.d >= M.GATE.d && b.d < M.GATE.d) { if (b.s > M.GATE.s0 + 1.5 && b.s < M.GATE.s1 - 1.5) F.gate = true; else gateMsg = true; }
      else if (hiA && b.d < M.GATE.d) gateMsg = true; }      // bajar de la cancha hacia el camino tampoco vale: al camino se entra por el portón
  }
  if (G.modo === 'sim' && cableBajo(nx, nz) && !(G.bannerT > 0)) { setBanner('¡Ojo! Pasaste sobre un cable eléctrico.', 'warn'); G.bannerT = 2; }      // simulador: solo el aviso
  if (!G.TEST && G.modo !== 'sim' && cableBajo(nx, nz)) { F.x = nx; F.z = nz; P.v = 0; return endGame(false, 'Pasaste sobre el cable eléctrico.'); }      // federicovega (modo prueba) pasa sin consecuencias
  if (gateMsg) { P.v = 0; setBanner('Entra a la Rampa Sur por entre los postes pasacables.', 'warn'); G.bannerT = 2; }
  else if (freeBlocked(nx, nz, hx, hz)) { if (P.v > 3) { beep(90, 0.18, 'sawtooth', 0.06); G.shake = Math.max(G.shake, 0.3); } P.v = 0; }
  else { F.x = nx; F.z = nz; }
  if (G.TEST || G.modo === 'sim') return;      // modo prueba y simulador: recorrido libre por toda la mina (no se amarra a la Rampa Sur)
  // ¿llegó a la Rampa Sur? (tramo junto a la fase 7)
  const s0 = F.sHint !== undefined ? Math.max(START_S, F.sHint - 300) : START_S, s1 = F.sHint !== undefined ? Math.min(L - 2, F.sHint + 300) : START_S + 260;      // cerca de donde salió del camino (o la Rampa Sur al comienzo)
  let bs = null; for (let s = s0; s < s1; s += 2) { const f = frame(s), d = (f.x - F.x) ** 2 + (f.z - F.z) ** 2; if (!bs || d < bs.d) bs = { s, d, f }; }
  const f = bs.f, u = (F.x - f.x) * f.rx + (F.z - f.z) * f.rz;
  if ((F.gate || !M.GATE) && Math.abs(u) < CRASH_U - 2.5 && Math.abs((F.x - f.x) * f.tx + (F.z - f.z) * f.tz) < 3) {
    const along = hx * f.tx + hz * f.tz, side = hx * f.rx + hz * f.rz;
    Object.assign(P, { s: bs.s, u, v: P.v * Math.max(0.4, along), vu: P.v * side * 0.5 }); G.free = null; G.camSnap = false;
    setBanner(F.sHint !== undefined ? 'Volviste al camino.' : 'Tomaste la Rampa Sur. ¡Circula por la izquierda!', 'ok'); G.bannerT = 2.5;
  }
}

export { buscarPartidaLibre, stepFree };
