// Ruta y geometría del rajo: muestreo del camino por metro (px, pz, hr), frame(s), cota del rajo según el radio, ubicación de la explanada/portón (PLAT), cota de la fase 7 (f7h) y marcas del recorrido (START_S, ZONE_S).
import { BENCH, LANE, PA, PB, PCX, PCZ, PR, TAU, WR, YTOP } from '../config/diseno.js';
import { F7POLY, FPOLY, ROUTE, SEC } from '../datos/caminos.js';
import { inPoly } from '../comun/mates.js';
import { paso } from '../comun/pasos.js';

/* ───────────── Geometría del rajo: elipse con bancos y rampa con curvas en U ───────────── */

const ELL = (th, rho) => [PA * rho * Math.cos(th), PB * rho * Math.sin(th)];
function floorD(x, z) {      // distancia con signo al borde del fondo (negativa adentro)
  let d = 1e9; for (let i = 0, j = FPOLY.length - 1; i < FPOLY.length; j = i++) { const [ax, az] = FPOLY[j], [bx, bz] = FPOLY[i], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); }
  return inPoly(x, z, FPOLY) ? -d : d;
}
const qOf = (x, z) => Math.hypot(x - PCX, z - PCZ) / PR;
function legPts(th0, th1, r0, r1) {
  const n = Math.max(4, Math.ceil(Math.abs(th1 - th0) * 70)), a = [];
  for (let i = 0; i <= n; i++) { const t = i / n; a.push(ELL(th0 + (th1 - th0) * t, r0 + (r1 - r0) * t)); }
  return a;
}
const dirOf = (p, q) => { const dx = q[0] - p[0], dz = q[1] - p[1], n = Math.hypot(dx, dz); return [dx / n, dz / n]; };
function uTurn(P1, T1, P2, T2) {      // curva en U (Hermite) entre el final de un tramo y el inicio del siguiente
  const d = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]), m = 1.45 * d, out = [];
  for (let i = 1; i < 48; i++) {
    const t = i / 48, t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    out.push([h00 * P1[0] + h10 * m * T1[0] + h01 * P2[0] + h11 * m * T2[0], h00 * P1[1] + h10 * m * T1[1] + h01 * P2[1] + h11 * m * T2[1]]);
  }
  return out;
}
// Tramo A: sube por el fondo (barranco a la derecha). U en el poniente. Tramo B: vuelve con el barranco a la izquierda. U en el oriente. Tramo C: sale al borde.
// Ruta tomada del plano satelital (escala 0,44 m/px): sale de la pala en el fondo, sube por el borde y termina en el domo mirador
const SEC_FIXH = SEC.map(() => true);      // todos los caminos interiores llevan su cota calculada (10 % máx., con espacio para bancos y bermas entre ellos)
const RIMP = ROUTE[ROUTE.length - 1], F7 = F7POLY;
const PITC = { x: -14, z: -28 };      // centro aproximado del rajo
const inF7 = (x, z) => inPoly(x, z, F7);      // fase 7: la media luna del nororiente
const lastOf = a => a[a.length - 1], tanEnd = a => dirOf(a[a.length - 2], a[a.length - 1]);
const PRE = 0, POST = 205;          // 200 m de tramo previo a la pala (la partida empieza ahí); 205 m rectos tras el domo
const dirIni = dirOf(ROUTE[0], ROUTE[1]), EXT = [];
for (let d = PRE; d >= 6; d -= 6) EXT.push([ROUTE[0][0] - dirIni[0] * d, ROUTE[0][1] - dirIni[1] * d]);
const pathPts = EXT.concat(ROUTE), nPts = EXT.length + ROUTE.length - 1, tFin = tanEnd(pathPts);
pathPts.push([lastOf(pathPts)[0] + tFin[0] * POST, lastOf(pathPts)[1] + tFin[1] * POST]);
const cum = [0]; for (let i = 1; i < pathPts.length; i++) cum.push(cum[i - 1] + Math.hypot(pathPts[i][0] - pathPts[i - 1][0], pathPts[i][1] - pathPts[i - 1][1]));
const DS = 1, SMIN = -PRE, NS = Math.floor(cum[cum.length - 1] / DS), SMAX = SMIN + NS * DS;
const L = cum[nPts] - PRE;            // largo del camino hasta el domo
const S_U2 = 1000, S_U2e = 1100;     // referencias antiguas de la curva en U (la ruta del mapa no tiene esa curva)
let S_RIM = 0;      // donde la Rampa Sur llega a la superficie
const px = new Float32Array(NS + 1), pz = new Float32Array(NS + 1), ptx = new Float32Array(NS + 1), ptz = new Float32Array(NS + 1), hr = new Float32Array(NS + 1);
paso('ruta: muestreo del camino por metro (posición, tangente, cota)', () => {
  let j = 0;
  for (let k = 0; k <= NS; k++) {
    const d = k * DS; while (j < pathPts.length - 2 && cum[j + 1] < d) j++;
    const f = (d - cum[j]) / (cum[j + 1] - cum[j]);
    px[k] = pathPts[j][0] + f * (pathPts[j + 1][0] - pathPts[j][0]); pz[k] = pathPts[j][1] + f * (pathPts[j + 1][1] - pathPts[j][1]);
  }
  for (let k = 0; k <= NS; k++) {
    const a = Math.max(0, k - 1), b = Math.min(NS, k + 1), dx = px[b] - px[a], dz = pz[b] - pz[a], n = Math.hypot(dx, dz);
    ptx[k] = dx / n; ptz[k] = dz / n;
  }
  // altura del camino: sigue la pared del rajo (bancos) y nunca baja; el tramo previo queda a la altura de la partida
  // altura del camino: sube parejo (~4,9 %) desde 40 m en la partida hasta el borde del rajo al llegar; el terreno cercano se arma a partir del camino
  { let bd = 1e9, kr = NS; for (let k = 0; k <= NS; k++) { const d2 = (px[k] - RIMP[0]) ** 2 + (pz[k] - RIMP[1]) ** 2; if (d2 < bd) { bd = d2; kr = k; } } S_RIM = SMIN + kr * DS; }
  for (let k = 0; k <= NS; k++) { const s = SMIN + k * DS; hr[k] = -80 + (YTOP - -80) * Math.min(1, Math.max(0, s / S_RIM)); }

});
function frame(s) {
  let f = (s - SMIN) / DS; if (f < 0) f = 0; if (f > NS - 1e-6) f = NS - 1e-6;
  const i = f | 0, t = f - i;
  let tx = ptx[i] + (ptx[i + 1] - ptx[i]) * t, tz = ptz[i] + (ptz[i + 1] - ptz[i]) * t; const n = Math.hypot(tx, tz); tx /= n; tz /= n;
  return { x: px[i] + (px[i + 1] - px[i]) * t, z: pz[i] + (pz[i + 1] - pz[i]) * t, tx, tz, rx: -tz, rz: tx };
}
function hrAt(s) { let f = (s - SMIN) / DS; if (f < 0) f = 0; if (f > NS - 1e-6) f = NS - 1e-6; const i = f | 0; return hr[i] + (hr[i + 1] - hr[i]) * (f - i); }

// Cota del rajo en función del radio elíptico q: sale de la altura del camino a lo largo de su recorrido
const gq = [], gh = [];
paso('ruta: cota del rajo según el radio elíptico', () => {
  let qm = -1;
  for (let k = 0; k <= NS; k++) {
    const q = qOf(px[k], pz[k]);
    if (q > qm + 1e-5) { qm = q; gq.push(q); gh.push(hr[k]); } else if (gh.length) gh[gh.length - 1] = Math.max(gh[gh.length - 1], hr[k]);
  }
});
function Gq(q) {
  if (q <= gq[0]) return gh[0]; if (q >= gq[gq.length - 1]) return YTOP;
  let lo = 0, hi = gq.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (gq[m] <= q) lo = m; else hi = m; }
  return gh[lo] + (gh[hi] - gh[lo]) * (q - gq[lo]) / (gq[hi] - gq[lo]);
}
function stairs(g) {   // bancos de 16 m: caras empinadas entre bermas planas
  if (g >= YTOP) return YTOP; if (g <= 0) return 0;
  const t = g / BENCH, k = Math.floor(t), a = Math.min(1, Math.max(0, (t - k - 0.25) / 0.5));
  return BENCH * (k + a * a * (3 - 2 * a));
}
function bowlH(q) { const q0 = 60 / PR; return YTOP * Math.pow(Math.min(1, Math.max(0, (q - q0) / (1 - q0))), 1.3); }      // cuenca del rajo: fondo al centro, borde arriba (sin paredes planas)
function pit(x, z) { return stairs(bowlH(qOf(x, z))) + 0.3 * Math.sin(x * 0.17 + z * 0.09) * Math.sin(z * 0.13 - x * 0.06); }

// Explanada a media pista: franja paralela al camino (sigue su curva), en un tramo abierto y con holgura al resto del camino
let PLAT = null;
paso('explanada: ubicación a media pista', () => {
  const angd = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
  let best = null; const HL = 100;
  for (const D of [48, 40, 34]) {
    for (let sc = Math.max(S_U2e + 140, L - 420); sc <= L - 110; sc += 10) {
      const k = Math.round((sc - SMIN) / DS); let curv = 0;
      for (let a = -HL - 30; a <= HL + 100; a += 10) { const k1 = k + a, k2 = k + a + 10; curv = Math.max(curv, Math.abs(angd(Math.atan2(ptz[k2], ptx[k2]), Math.atan2(ptz[k1], ptx[k1]))) / 10); }
      if (curv > 1 / 110) continue;                      // sin curvas cerradas dentro ni a la salida de la explanada
      for (const side of [1, -1]) {
        let clear = 1e9, diff = 0, cnt = 0, sg = 0;
        for (let a = -HL; a <= HL; a += 20) for (let b = WR; b <= WR + D; b += D / 3) {
          const kk = k + a, x = px[kk] - ptz[kk] * side * b, z = pz[kk] + ptx[kk] * side * b;
          for (let j = 0; j <= NS; j += 2) { if (Math.abs(j - k) < HL + 30) continue; const d = Math.hypot(px[j] - x, pz[j] - z); if (d < clear) clear = d; }
          diff += Math.abs(pit(x, z) - hr[kk]); sg += pit(x, z) - hr[kk]; cnt++;
        }
        diff /= cnt;
        if (sg / cnt < 2) continue;                       // la explanada va cortada en el cerro: queda un banco detrás de las palas
        if (clear < WR + 4) continue;
        const score = Math.min(clear, 60) - 0.2 * diff - 300 * curv - 0.2 * Math.abs(L - (SMIN + k * DS) - 230) + 0.4 * D;
        if (!best || score > best.score) best = { score, se: SMIN + k * DS, side, D, HL, k, diff, clear, curv };
      }
    }
  }
  PLAT = best;
});
{ const kk = 40, side = [1, -1].find(sd => inF7(px[kk] - ptz[kk] * sd * 45, pz[kk] + ptx[kk] * sd * 45)) || 1;      // portón al comienzo de la ruta, del lado de la fase 7
  PLAT = { se: -15, side, D: 30, HL: 60, k: 0, diff: 0, clear: 0, curv: 0 }; }
const H7 = BENCH * Math.round(hr[PLAT.k] / BENCH);      // cota del piso de la fase 7: la del camino junto a la pala 3 (la bahía sale a nivel)
const F7A = { x: -202.5, z: -580.5 }, F7HN = -80;      // la fase 7 baja de a poco desde su extremo norponiente (F7HN) hasta el portón (H7), como en la mina
function f7h(x, z) { const bx = ROUTE[0][0] - F7A.x, bz = ROUTE[0][1] - F7A.z, t = Math.max(0, Math.min(1, ((x - F7A.x) * bx + (z - F7A.z) * bz) / (bx * bx + bz * bz))); return H7 + (F7HN - H7) * (1 - t); }
// La camioneta parte de la explanada, junto a la pala, y sale sola hasta su pista
const START_S = -PRE, START_U0 = -LANE, START_Y = hrAt(START_S);      // la partida empieza 200 m antes de la pala
const ZONE_S = START_S + (L - START_S) * 0.5;      // zona de caída de rocas: a la mitad del recorrido
const CAEX_LANE = { a: 0, b: 0, u: 25, on: false };      // desactivado: el rojo del plano es la bajada (carril contrario normal)      // carril solo para CAEX (rojo en el plano): paralelo, a la derecha, detrás del pretil

export { ELL, floorD, qOf, legPts, dirOf, uTurn, SEC_FIXH, RIMP, F7, PITC, inF7, lastOf, tanEnd, PRE, POST, dirIni, EXT, pathPts, nPts, tFin, cum, DS, SMIN, NS, SMAX, L, S_U2, S_U2e, S_RIM, px, pz, ptx, ptz, hr, frame, hrAt, gq, gh, Gq, stairs, bowlH, pit, PLAT, H7, F7A, F7HN, f7h, START_S, START_U0, START_Y, ZONE_S, CAEX_LANE };
