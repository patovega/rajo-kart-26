// Rajo Kart 26 — módulo principal. Importa configuración (js/config), datos (js/datos), utilidades (js/comun) y modelos de equipos (js/modelos); el resto se irá repartiendo en js/terreno, js/operaciones, js/juego y js/ui.
import { TAU, PA, PB, YTOP, BENCH, WR, BLEND, PRET, LANE, CRASH_U, REQ_RANGE, SPEED_LIMIT, CRUISE, VTOP, FOLLOW_DIST, PCX, PCZ, PR, FLOOR, FRAD } from './config/diseno.js';
import { ROUTE, F7POLY, RIMPOLY, FPOLY, SEC, SEM6, PATIOS } from './datos/caminos.js';
import { D52 } from './datos/fase7.js';
import { hash, sm01 } from './comun/mates.js';
import { addPlates, bas, blob, box, brakeMat, cyl, lam, rockGeo } from './modelos/materiales.js';
import { ALJ_PLATE, CAEX_PLATE, buildPickup, protoAlj, protoOnc, protoSame, updateSpray } from './modelos/camiones.js';
import { buildHydShovel, buildShovel, dumpTune, hydPose, makePile, shovelPose } from './modelos/palas.js';
import { buildCrawlerDrill, buildDrill, nextDrillNum } from './modelos/perforadoras.js';
import { buildDozerConRoca, buildTrackDozer, buildWheelDozer } from './modelos/dozers.js';
const PASOS = [];      // pasos de armado del mundo, en orden y con su tiempo (ms): para saber qué se ejecuta y cuánto cuesta
function paso(nombre, fn) { const t0 = performance.now(); fn(); PASOS.push([nombre, Math.round(performance.now() - t0)]); }

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
function inPoly(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
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
const P3_MOVED = true;      // la pala 3 trabaja en el centro de la fase 7 (ya no junto a la Rampa Sur)
const H7 = BENCH * Math.round(hr[PLAT.k] / BENCH);      // cota del piso de la fase 7: la del camino junto a la pala 3 (la bahía sale a nivel)
const F7A = { x: -202.5, z: -580.5 }, F7HN = -80;      // la fase 7 baja de a poco desde su extremo norponiente (F7HN) hasta el portón (H7), como en la mina
function f7h(x, z) { const bx = ROUTE[0][0] - F7A.x, bz = ROUTE[0][1] - F7A.z, t = Math.max(0, Math.min(1, ((x - F7A.x) * bx + (z - F7A.z) * bz) / (bx * bx + bz * bz))); return H7 + (F7HN - H7) * (1 - t); }
// La camioneta parte de la explanada, junto a la pala, y sale sola hasta su pista
const START_S = -PRE, START_U0 = -LANE, START_Y = hrAt(START_S);      // la partida empieza 200 m antes de la pala
const ZONE_S = START_S + (L - START_S) * 0.5;      // zona de caída de rocas: a la mitad del recorrido
// Radar de monitoreo en la curva previa a la caída de rocas: bahía a la derecha (u>0) con hueco en el pretil
const RAD = null;      // radar, caseta y torre eliminados (se está armando una pista nueva)
const CAEX_LANE = { a: 0, b: 0, u: 25, on: false };      // desactivado: el rojo del plano es la bajada (carril contrario normal)      // carril solo para CAEX (rojo en el plano): paralelo, a la derecha, detrás del pretil
const RADG = { a: -1e9, b: -1e9 };      // sin hueco de pretil (no hay bahía de radar)

// Malla de alturas del terreno: rajo con bancos + camino excavado + explanada
const CELL = 5, GX0 = -1660, GZ0 = -1160;      // malla del terreno (rajo a escala real)
const GNX = Math.ceil(2940 / CELL) + 1, GNZ = Math.ceil(2180 / CELL) + 1;
const GH = new Float32Array(GNX * GNZ), GD = new Float32Array(GNX * GNZ), GI = new Int32Array(GNX * GNZ), NOSE = new Uint8Array(GNX * GNZ), HB = new Float32Array(GNX * GNZ).fill(-1);      // HB: cota base de la escalera de bancos de la celda (para pintar las franjas alineadas)      // GI: punto de la ruta más cercano
paso('terreno: membrana entre celdas fijas (caminos, pisos, superficie) y cuenca', () => {
  // ── Rajo coherente en tres pasos ──
  // 1) superficie suave de la pared (F): pasa exactamente por la cota del camino en cada tramo, por el piso (0) al centro y por la meseta (YTOP) en el borde;
  //    entre ellos se interpola como una membrana (ecuación de Laplace): nunca hace lomas ni valles que no estén en los caminos.
  // 2) bancos horizontales a cotas fijas cada 16 m sobre F: berma plana + cara de ~7 m en horizontal.
  // 3) el camino se excava cruzando los bancos: del lado alto queda un corte que sube al banco de arriba; del lado bajo, la caída al banco de abajo.
  const HS = 130, map = new Map();
  for (let k = 0; k <= NS; k++) { const key = Math.floor((px[k] - GX0) / HS) * 1024 + Math.floor((pz[k] - GZ0) / HS); let a = map.get(key); if (!a) { a = []; map.set(key, a); } a.push(k); }
  for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {      // tramo de camino más cercano a cada celda
    const x = GX0 + ix * CELL, z = GZ0 + iz * CELL; let best = 1e9, bi = -1;
    const cx = Math.floor((x - GX0) / HS), cz = Math.floor((z - GZ0) / HS);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = map.get((cx + a) * 1024 + (cz + b)); if (!arr) continue;
      for (let m = 0; m < arr.length; m++) { const k = arr[m], dx = px[k] - x, dz = pz[k] - z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bi = k; } }
    }
    const i = iz * GNX + ix; GD[i] = bi >= 0 ? Math.sqrt(best) : 999; GI[i] = Math.max(0, bi);
  }
  // camino de bajada (rojo del plano): también es un camino de la pared; su cota se toma de la membrana (primera pasada) y luego se fija
  const P2 = [], SG = [];
  SEC.forEach((R2, si) => { for (let i = 0; i < R2.length - 1; i++) { const a = R2[i], b = R2[i + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let j = 0; j < n; j++) { P2.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n, a[2] + (b[2] - a[2]) * j / n]); SG.push(si); } }
    P2.push(R2[R2.length - 1]); SG.push(si); });
  const near2 = P2.map(p => { let nd = 1e9, nk = 0; for (let j = 0; j <= NS; j += 2) { const dx = px[j] - p[0], dz = pz[j] - p[1], d2 = dx * dx + dz * dz; if (d2 < nd) { nd = d2; nk = j; } } return nd < (WR + 8) ** 2 ? nk : -1; });      // pegado a de la Rampa Sur: empalma a su cota
  const far2 = P2.map(() => true);
  const join2 = [];      // cruces y empalmes entre los otros caminos: deben quedar a la misma cota
  for (let a = 0; a < P2.length; a++) {      // solo en los extremos de cada camino: se une al punto más cercano de otro camino
    if (!(a === 0 || SG[a - 1] !== SG[a] || a === P2.length - 1 || SG[a + 1] !== SG[a])) continue;
    let bd = 225, bb = -1; for (let b = 0; b < P2.length; b++) { if (SG[b] === SG[a]) continue; const d2 = (P2[a][0] - P2[b][0]) ** 2 + (P2[a][1] - P2[b][1]) ** 2; if (d2 < bd) { bd = d2; bb = b; } }
    if (bb >= 0) join2.push(a, bb);
  }
  const F = new Float32Array(GNX * GNZ), fix = new Uint8Array(GNX * GNZ), red = new Uint8Array(GNX * GNZ), f7 = new Uint8Array(GNX * GNZ);
  const setFixed = (H2) => {
    fix.fill(0); red.fill(0); const rd = new Float32Array(GNX * GNZ).fill(1e9);      // rd: distancia al eje del camino que ya marcó la celda (manda el más cercano)
    for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {
      const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL;
      if (ix === 0 || iz === 0 || ix === GNX - 1 || iz === GNZ - 1) { F[i] = YTOP; fix[i] = 1; }      // borde de la malla: meseta
      if (!inPoly(x, z, RIMPOLY)) { F[i] = YTOP; fix[i] = 1; }      // fuera del rajo: superficie
      if (inF7(x, z) && GD[i] > WR + 18 + 1.3 * Math.abs(hr[GI[i]] - f7h(x, z))) { F[i] = f7h(x, z); fix[i] = 1; f7[i] = 1; }      // fase 7: piso de la bahía
      if (floorD(x, z) < FRAD) { F[i] = FLOOR; fix[i] = 1; }                        // piso del fondo mina
      if (GD[i] <= WR) { F[i] = hr[GI[i]]; fix[i] = 1; }                                               // camino de subida
    }
    if (H2) P2.forEach((p, k) => {
      if (!far2[k]) return;
      const ix0 = Math.round((p[0] - GX0) / CELL), iz0 = Math.round((p[1] - GZ0) / CELL);
      for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) {      // calzada de 38 m (como la ruta): dos CAEX, uno por pista, con espacio entre ellos
        const ix = ix0 + b, iz = iz0 + a; if (ix < 1 || iz < 1 || ix >= GNX - 1 || iz >= GNZ - 1) continue; const i = iz * GNX + ix;
        const dd = Math.hypot(GX0 + ix * CELL - p[0], GZ0 + iz * CELL - p[1]);
        if (GD[i] <= WR + 0.5 || dd > WR || dd >= rd[i]) continue;
        F[i] = H2[k]; fix[i] = 1; red[i] = 1; rd[i] = dd;
      }
    });
    if (H2) for (const [qx, qz, qh, qr] of PATIOS) {      // patio del empalme: plano a la cota del cruce, entre los caminos que se juntan
      const ix0 = Math.round((qx - GX0) / CELL), iz0 = Math.round((qz - GZ0) / CELL), n = Math.ceil(qr / CELL);
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const ix = ix0 + b, iz = iz0 + a; if (ix < 1 || iz < 1 || ix >= GNX - 1 || iz >= GNZ - 1) continue; const i = iz * GNX + ix;
        if (fix[i] || Math.hypot(GX0 + ix * CELL - qx, GZ0 + iz * CELL - qz) > qr) continue; F[i] = qh; fix[i] = 1; red[i] = 1; }
    }
  };
  const solve = (iters) => {      // membrana: primero en una malla gruesa (rápido), luego afinada
    const C = 4, CX = Math.ceil(GNX / C), CZ = Math.ceil(GNZ / C), cF = new Float32Array(CX * CZ), cS = new Float32Array(CX * CZ), cN = new Float32Array(CX * CZ), cfx = new Uint8Array(CX * CZ);
    for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) { const i = iz * GNX + ix; if (!fix[i]) continue; const j = Math.floor(iz / C) * CX + Math.floor(ix / C); cS[j] += F[i]; cN[j]++; }
    for (let j = 0; j < CX * CZ; j++) { if (cN[j]) { cF[j] = cS[j] / cN[j]; cfx[j] = 1; } else cF[j] = YTOP * 0.6; }
    for (let it = 0; it < iters; it++) for (let iz = 1; iz < CZ - 1; iz++) for (let ix = 1; ix < CX - 1; ix++) { const j = iz * CX + ix; if (cfx[j]) continue; cF[j] += 1.9 * ((cF[j - 1] + cF[j + 1] + cF[j - CX] + cF[j + CX]) * 0.25 - cF[j]); }
    for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {      // de la gruesa a la fina (bilineal)
      const i = iz * GNX + ix; if (fix[i]) continue;
      const fx = Math.min(CX - 1.001, Math.max(0, ix / C - 0.5)), fz = Math.min(CZ - 1.001, Math.max(0, iz / C - 0.5)), x0 = fx | 0, z0 = fz | 0, tx = fx - x0, tz = fz - z0, j = z0 * CX + x0;
      F[i] = (cF[j] * (1 - tx) + cF[j + 1] * tx) * (1 - tz) + (cF[j + CX] * (1 - tx) + cF[j + CX + 1] * tx) * tz;
    }
    for (let it = 0; it < 160; it++) for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) { const i = iz * GNX + ix; if (fix[i]) continue; F[i] += 1.8 * ((F[i - 1] + F[i + 1] + F[i - GNX] + F[i + GNX]) * 0.25 - F[i]); }
  };
  const FAt = (x, z) => {
    const fx = Math.min(GNX - 1.001, Math.max(0, (x - GX0) / CELL)), fz = Math.min(GNZ - 1.001, Math.max(0, (z - GZ0) / CELL)), x0 = fx | 0, z0 = fz | 0, tx = fx - x0, tz = fz - z0, i = z0 * GNX + x0;
    return (F[i] * (1 - tx) + F[i + 1] * tx) * (1 - tz) + (F[i + GNX] * (1 - tx) + F[i + GNX + 1] * tx) * tz;
  };
  setFixed(null); solve(1200);
  {      // cota del camino de bajada: la de la pared por donde pasa, pareja (pendiente máx. 10 %)
    const n2 = P2.length, H2 = new Float32Array(n2);
    for (let k = 0; k < n2; k++) H2[k] = FAt(P2[k][0], P2[k][1]);
    const tie = () => {      // empalmes con la Rampa Sur y cruces entre caminos
      for (let k = 0; k < n2; k++) if (near2[k] >= 0) H2[k] = hr[near2[k]];
      for (let q = 0; q < join2.length; q += 2) { const a = join2[q], b = join2[q + 1], m = (H2[a] + H2[b]) / 2; H2[a] = m; H2[b] = m; }
    };
    let S2 = H2;
    for (let it = 0; it < 40; it++) {
      tie();
      for (let k = 1; k < n2; k++) if (SG[k] === SG[k - 1]) H2[k] = Math.min(H2[k - 1] + 0.2, Math.max(H2[k - 1] - 0.2, H2[k]));      // pendiente máx. 10 %
      for (let k = n2 - 2; k >= 0; k--) if (SG[k] === SG[k + 1]) H2[k] = Math.min(H2[k + 1] + 0.2, Math.max(H2[k + 1] - 0.2, H2[k]));
      S2 = Float32Array.from(H2); for (let k = 0; k < n2; k++) { let a = 0, c = 0; for (let j = Math.max(0, k - 8); j <= Math.min(n2 - 1, k + 8); j++) if (SG[j] === SG[k]) { a += H2[j]; c++; } S2[k] = a / c; }
      H2.set(S2);
    }
    const pin = new Uint8Array(n2); for (let k = 0; k < n2; k++) if (near2[k] >= 0) pin[k] = 1; for (const k of join2) pin[k] = 1;
    tie();
    for (let r = 0; r < 4; r++) {      // al final mandan los empalmes: el resto del camino se acomoda con pendiente máx. 10 %
      for (let k = 1; k < n2; k++) if (!pin[k] && SG[k] === SG[k - 1]) H2[k] = Math.min(H2[k - 1] + 0.2, Math.max(H2[k - 1] - 0.2, H2[k]));
      for (let k = n2 - 2; k >= 0; k--) if (!pin[k] && SG[k] === SG[k + 1]) H2[k] = Math.min(H2[k + 1] + 0.2, Math.max(H2[k + 1] - 0.2, H2[k]));
    }
    for (let k = 0; k < n2; k++) if (SEC_FIXH[SG[k]]) H2[k] = P2[k][2];      // cota de diseño de cada camino interior
    S2 = H2;
    setFixed(S2); solve(600);
  }
  {      // ángulo entre rampas ≤ ~48° (1,12): cara de 70° + berma de ~8,5 m por cada banco de 16 m (criterio de Ritchie modificado: berma ≥ 0,2·H + 4,5 m); donde la membrana sube más empinado, la pared se corta hacia atrás
    const SM = 1.18, d1 = SM * CELL, d2 = SM * CELL * Math.SQRT2;
    for (let pass = 0; pass < 3; pass++) {
      for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) { const i = iz * GNX + ix; if (fix[i]) continue;
        F[i] = Math.min(F[i], F[i - 1] + d1, F[i - GNX] + d1, F[i - GNX - 1] + d2, F[i - GNX + 1] + d2); }
      for (let iz = GNZ - 2; iz >= 1; iz--) for (let ix = GNX - 2; ix >= 1; ix--) { const i = iz * GNX + ix; if (fix[i]) continue;
        F[i] = Math.min(F[i], F[i + 1] + d1, F[i + GNX] + d1, F[i + GNX + 1] + d2, F[i + GNX - 1] + d2); }
    }
    for (let pass = 0; pass < 3; pass++) {      // y desde arriba: bajo el borde del rajo (y bajo los caminos altos) la pared tampoco cae más empinada que eso; así no queda un acantilado liso arriba
      for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) { const i = iz * GNX + ix; if (fix[i]) continue;
        F[i] = Math.max(F[i], F[i - 1] - d1, F[i - GNX] - d1, F[i - GNX - 1] - d2, F[i - GNX + 1] - d2); }
      for (let iz = GNZ - 2; iz >= 1; iz--) for (let ix = GNX - 2; ix >= 1; ix--) { const i = iz * GNX + ix; if (fix[i]) continue;
        F[i] = Math.max(F[i], F[i + 1] - d1, F[i + GNX] - d1, F[i + GNX + 1] - d2, F[i + GNX - 1] - d2); }
    }
  }
  {      // bajo el camino celeste los bancos van paralelos al camino (en tramos rectos que giran con él) hasta el fondo, como en la mina
    const CEL = SEC[7].slice(0, 130), BS = 40, bins = new Map(), add = (x, z, h, id) => { const k = Math.floor((x - GX0) / BS) * 1000 + Math.floor((z - GZ0) / BS); let b = bins.get(k); if (!b) bins.set(k, b = []); b.push(x, z, h, id); };
    const CELQ = [[-64,-155,-173.3],[45,-147,-167.9],[170,-106,-161.8],[204,16,-155.3],[194,144,-149.1],[137,272,-142.2],[49,365,-136.1],[-75,427,-129.5],[-179,495,-123.4]];      // celeste en tramos rectos: los bancos de abajo doblan en ángulo en cada vértice (como en la foto)
    SEC.forEach((R2, si) => { const P = si === 7 ? CELQ : R2; for (let k = 0; k < P.length - 1; k++) { const a = P[k], b = P[k + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)); for (let j = 0; j < n; j++) add(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n, a[2] + (b[2] - a[2]) * j / n, si === 7 ? 1 : 0); } });
    for (let k = 0; k <= NS; k += 4) add(px[k], pz[k], hr[k], 0);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of CEL.concat(FPOLY)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const RB = 7;
    for (let iz = Math.max(0, Math.floor((z0 - 300 - GZ0) / CELL)); iz <= Math.min(GNZ - 1, Math.ceil((z1 + 300 - GZ0) / CELL)); iz++) for (let ix = Math.max(0, Math.floor((x0 - 300 - GX0) / CELL)); ix <= Math.min(GNX - 1, Math.ceil((x1 + 300 - GX0) / CELL)); ix++) {
      const i = iz * GNX + ix; if (fix[i]) continue;
      const x = GX0 + ix * CELL, z = GZ0 + iz * CELL, bx = Math.floor((x - GX0) / BS), bz = Math.floor((z - GZ0) / BS); let dc = 1e9, hc = 0, dn = 1e9;
      for (let a2 = -RB; a2 <= RB; a2++) for (let c2 = -RB; c2 <= RB; c2++) { const b = bins.get((bx + a2) * 1000 + bz + c2); if (!b) continue;
        for (let q = 0; q < b.length; q += 4) { const d = Math.hypot(b[q] - x, b[q + 1] - z); if (b[q + 3]) { if (d < dc) { dc = d; hc = b[q + 2]; } } else if (d < dn) dn = d; } }
      const df = floorD(x, z); if (dc > 280 || dn < dc || df <= 0 || F[i] >= hc) continue;      // solo entre el celeste y el fondo, y más cerca del celeste que de otro camino
      const u = Math.max(0, dc - WR), Fn = hc - (hc - FLOOR) * u / (u + df);
      const w = Math.min(1, (280 - dc) / 60); F[i] = F[i] * (1 - w) + Fn * w;
    }
  }
  {      // pared norte y oriente de la fase 7: pie y bancos rectos, paralelos a cada tramo del borde, que doblan en quiebres (no en curva)
    const smt = v => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); };
    const CH = F7.slice(0, 8), NS7 = CH.length - 1, SG7 = [];
    for (let k = 0; k < NS7; k++) { const [ax, az] = CH[k], [bx, bz] = CH[k + 1], L = Math.hypot(bx - ax, bz - az); let nx = (bz - az) / L, nz = -(bx - ax) / L; if (inF7((ax + bx) / 2 + nx * 5, (az + bz) / 2 + nz * 5)) { nx = -nx; nz = -nz; } SG7.push({ ax, az, dx: (bx - ax) / L, dz: (bz - az) / L, L, nx, nz, c: 0 }); }
    const N = GNX * GNZ, own = new Int8Array(N).fill(-1), pm = new Float32Array(N), ht = new Float32Array(N), Rr = new Float32Array(N), ew = new Float32Array(N), bdA = new Float32Array(N);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of CH) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const ia = Math.max(1, Math.floor((x0 - 300 - GX0) / CELL)), ib = Math.min(GNX - 2, Math.ceil((x1 + 300 - GX0) / CELL)), ja = Math.max(1, Math.floor((z0 - 300 - GZ0) / CELL)), jb = Math.min(GNZ - 2, Math.ceil((z1 + 300 - GZ0) / CELL));
    const plane = (s, x, z) => (x - s.ax) * s.nx + (z - s.az) * s.nz;
    for (let iz = ja; iz <= jb; iz++) for (let ix = ia; ix <= ib; ix++) {      // a qué tramo pertenece cada celda (el más cercano) y su distancia en ángulo recto
      const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL;
      let bk = -1, bd = 1e9, bt = 0;
      for (let k = 0; k < NS7; k++) { const s = SG7[k], t = Math.max(0, Math.min(s.L, (x - s.ax) * s.dx + (z - s.az) * s.dz)), d = Math.hypot(s.ax + s.dx * t - x, s.az + s.dz * t - z); if (d < bd) { bd = d; bk = k; bt = t; } }
      if (bd > 300) continue;
      { let od = 1e9; for (let k = 8; k < F7.length; k++) { const [ax, az] = F7[k], [bx, bz] = F7[(k + 1) % F7.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); od = Math.min(od, Math.hypot(ax + dx * t - x, az + dz * t - z)); } if (od < bd) continue; }      // más cerca de otro borde de la fase 7
      const s = SG7[bk]; own[i] = bk; bdA[i] = bd; ht[i] = f7h(s.ax + s.dx * bt, s.az + s.dz * bt);
      let e = 1; if (bk === 0 && bt <= 0) e = Math.max(0, 1 - bd / 60); if (bk === NS7 - 1 && bt >= s.L) e = Math.max(0, 1 - bd / 60); ew[i] = e;      // en los extremos se funde con lo que hay
      if (inF7(x, z) && !f7[i] && e >= 1) { const m = plane(s, x, z); if (m > -70) s.c = Math.max(s.c, -m + 4); }      // el piso no alcanza el borde (ahí pasa un camino): el pie recto se corre hacia adentro
    }
    for (const s of SG7) s.c = Math.min(60, s.c);
    const mit = (k, x, z) => { let m = -1e9; for (let j = Math.max(0, k - 1); j <= Math.min(NS7 - 1, k + 1); j++) m = Math.max(m, plane(SG7[j], x, z) + SG7[j].c); return m; };      // distancia "a escuadra": esquinas en quiebre
    for (let iz = ja; iz <= jb; iz++) for (let ix = ia; ix <= ib; ix++) { const i = iz * GNX + ix; if (own[i] < 0) continue; const x = GX0 + ix * CELL, z = GZ0 + iz * CELL;
      pm[i] = mit(own[i], x, z);
      if (f7[i] && pm[i] > 0 && ew[i] >= 1) { f7[i] = 0; fix[i] = 0; }      // piso que queda fuera del pie recto: pasa a ser pared
      Rr[i] = (F[i] - ht[i]) / Math.max(15, bdA[i]); }
    const fd = new Float32Array(N).fill(1e9), fh = new Float32Array(N); for (let i = 0; i < N; i++) if (fix[i] && !f7[i]) { fd[i] = 0; fh[i] = F[i]; }      // distancia al camino (o superficie) más cercano y su cota
    const rel = (i, j, c) => { if (fd[j] + c < fd[i]) { fd[i] = fd[j] + c; fh[i] = fh[j]; } }, C2 = CELL * 1.41;
    for (let pass = 0; pass < 2; pass++) { for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) { const i = iz * GNX + ix; rel(i, i - 1, CELL); rel(i, i - GNX, CELL); rel(i, i - GNX - 1, C2); rel(i, i - GNX + 1, C2); }
      for (let iz = GNZ - 2; iz >= 1; iz--) for (let ix = GNX - 2; ix >= 1; ix--) { const i = iz * GNX + ix; rel(i, i + 1, CELL); rel(i, i + GNX, CELL); rel(i, i + GNX + 1, C2); rel(i, i + GNX - 1, C2); } }
    const SL = new Float32Array(N), ok7 = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (own[i] >= 0 && !fix[i] && !f7[i] && F[i] <= fh[i] - 1 && pm[i] > 0) { ok7[i] = 1; SL[i] = Math.min(1.15, Math.max(0.3, (fh[i] - ht[i]) / Math.max(10, pm[i] + fd[i]))); }      // pendiente que lleva del pie al camino de arriba
    const SLs = new Float32Array(N), RW = 10;      // promediada en ~100 m: así cada banco sigue derecho a lo largo del tramo
    for (let iz = ja; iz <= jb; iz++) for (let ix = ia; ix <= ib; ix++) { const i = iz * GNX + ix; if (!ok7[i]) continue; let a = 0, c = 0;
      for (let p = -RW; p <= RW; p += 2) for (let q = -RW; q <= RW; q += 2) { const j = i + p * GNX + q; if (j >= 0 && j < N && ok7[j]) { a += SL[j]; c++; } } SLs[i] = a / c; }
    for (let i = 0; i < N; i++) { if (!ok7[i]) continue;      // solo la pared que queda bajo el camino más cercano (entre el piso y ese camino)
      const Fn = Math.min(ht[i] + SLs[i] * pm[i], fh[i]), w = ew[i] * smt(fd[i] / 12);
      F[i] = F[i] * (1 - w) + Fn * w; }
  }
  // bancos (estándar de rajo abierto): berma plana a cota fija (múltiplo de 16 m) y cara de ~70° (~5,8 m en horizontal); con la pendiente general ≤ 48° la berma queda de ~8,5 m
  const sm = v => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); };
  // bermas parejas en todo el rajo: el ancho de la berma es siempre ~8 m; donde la pared general es tendida, los bancos son más bajos (alto variable, entre 4 y 16 m) en vez de dejar bermas anchas
  const GS = new Float32Array(GNX * GNZ), HSa = new Float32Array(GNX * GNZ);
  for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) { const xa = Math.max(0, ix - 1), xb = Math.min(GNX - 1, ix + 1), za = Math.max(0, iz - 1), zb = Math.min(GNZ - 1, iz + 1);
    GS[iz * GNX + ix] = Math.hypot((F[iz * GNX + xb] - F[iz * GNX + xa]) / ((xb - xa) * CELL), (F[zb * GNX + ix] - F[za * GNX + ix]) / ((zb - za) * CELL)); }
  for (let pass = 0; pass < 3; pass++) {      // pendiente general suavizada (~35 m), para que el alto de los bancos cambie de a poco
    const T = Float32Array.from(GS), R = 3;
    for (let iz = 0; iz < GNZ; iz++) { let acc = 0, n = 0; for (let ix = -R; ix < GNX + R; ix++) { if (ix + R < GNX) { acc += T[iz * GNX + ix + R]; n++; } if (ix - R - 1 >= 0) { acc -= T[iz * GNX + ix - R - 1]; n--; } if (ix >= 0 && ix < GNX) GS[iz * GNX + ix] = acc / n; } }
    const U = Float32Array.from(GS);
    for (let ix = 0; ix < GNX; ix++) { let acc = 0, n = 0; for (let iz = -R; iz < GNZ + R; iz++) { if (iz + R < GNZ) { acc += U[(iz + R) * GNX + ix]; n++; } if (iz - R - 1 >= 0) { acc -= U[(iz - R - 1) * GNX + ix]; n--; } if (iz >= 0 && iz < GNZ) GS[iz * GNX + ix] = acc / n; } }
  }
  for (let i = 0; i < GS.length; i++) HSa[i] = BENCH;      // todas las paredes con bancos de 16 m (como la pared norte): donde la pared es tendida, la berma queda más ancha      // alto del banco = pendiente × (berma 8 m + cara 5,8 m)
  const BW = new Float32Array(GNX * GNZ).fill(8);      // ancho de berma (m): 8 m en general; 6 m bajo los caminos rosado y naranjo, entre el celeste y la fase 7 y en las 3 primeras curvas del zigzag (azul)
  {
    const N = GNX * GNZ, lab = new Int8Array(N).fill(-1), dst = new Float32Array(N).fill(1e9), hg = new Float32Array(N);
    const put = (x, z, l, hh) => { const ix = Math.round((x - GX0) / CELL), iz = Math.round((z - GZ0) / CELL); if (ix < 0 || iz < 0 || ix >= GNX || iz >= GNZ) return; const i = iz * GNX + ix; dst[i] = 0; lab[i] = l; hg[i] = hh; };
    SEC.forEach((R2, si) => R2.forEach(p => put(p[0], p[1], si, p[2]))); for (let k = 0; k <= NS; k += 2) put(px[k], pz[k], 99, hr[k]);
    const rel = (i, j, c) => { if (dst[j] + c < dst[i]) { dst[i] = dst[j] + c; lab[i] = lab[j]; hg[i] = hg[j]; } }, C2 = CELL * 1.41;
    for (let pass = 0; pass < 2; pass++) { for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) { const i = iz * GNX + ix; rel(i, i - 1, CELL); rel(i, i - GNX, CELL); rel(i, i - GNX - 1, C2); rel(i, i - GNX + 1, C2); }
      for (let iz = GNZ - 2; iz >= 1; iz--) for (let ix = GNX - 2; ix >= 1; ix--) { const i = iz * GNX + ix; rel(i, i + 1, CELL); rel(i, i + GNX, CELL); rel(i, i + GNX + 1, C2); rel(i, i + GNX - 1, C2); } }
    const CURV = [132, 256, 360].map(k => SEC[6][k]);      // las 3 primeras curvas en U del zigzag
    for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) { const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL;
      if (((lab[i] === 3 || lab[i] === 8) && F[i] < hg[i] - 1 && dst[i] < 260) || (lab[i] === 7 && F[i] > hg[i] - 1 && dst[i] < 300) || CURV.some(p => Math.hypot(p[0] - x, p[1] - z) < 180)) BW[i] = 6; }
  }
  for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {
    const i = iz * GNX + ix, f = F[i], d = GD[i];
    if (fix[i] && (d <= WR || red[i])) { GH[i] = f; if (red[i]) GD[i] = 0.1; continue; }      // calzada de la Rampa Sur o de los otros caminos
    if (f7[i]) { GH[i] = F[i]; GD[i] = -1; continue; }      // piso de la fase 7
    const xa = Math.max(0, ix - 1), xb = Math.min(GNX - 1, ix + 1), za = Math.max(0, iz - 1), zb = Math.min(GNZ - 1, iz + 1);
    const g = Math.hypot((F[iz * GNX + xb] - F[iz * GNX + xa]) / ((xb - xa) * CELL), (F[zb * GNX + ix] - F[za * GNX + ix]) / ((zb - za) * CELL));
    const Hs = HSa[i], a = Math.min(0.88, Math.max(0.12, 1 - BW[i] * Math.max(g, GS[i]) / BENCH))      /* berma pareja (BW, 8 o 6 m): donde la pared es tendida, la cara del banco se inclina más en vez de ensanchar la berma */, t = (f - FLOOR) / Hs, u = t - 0.5 + a / 2, m = Math.floor(u);      // donde la pared es más empinada que el estándar, la cara se para (hasta casi vertical) para que igual quede berma
    let h = FLOOR + Hs * (m + sm((u - m) / a));
    const r = hr[GI[i]];
    if (d < 60) h = f >= r ? Math.max(h, r) : Math.min(h, r);      // junto al camino: del lado alto nunca bajo el camino (corte), del lado bajo nunca sobre él (caída)
    if (d < WR + 3) { const w = sm((d - WR) / 3); h = r * (1 - w) + h * w; }
    GH[i] = Math.min(YTOP, Math.max(FLOOR, h)) + (d > 30 ? 0.3 * Math.sin(ix * 0.6 + iz * 0.3) * Math.sin(iz * 0.45 - ix * 0.2) : 0);
  }
  {      // caras de banco limpias (~62°, como en un rajo real): un suavizado solo sobre las caras quita los dientes de sierra de la malla sin tocar bermas ni caminos
    const src = Float32Array.from(GH);
    for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) {
      const i = iz * GNX + ix; if (GD[i] <= WR + 3) continue;
      const sl = Math.hypot(src[i + 1] - src[i - 1], src[i + GNX] - src[i - GNX]) / (2 * CELL); if (sl < 0.5) continue;
      { const Hs = HSa[i], q = (src[i] - FLOOR) / Hs; if (Math.abs(q - Math.round(q)) * Hs < 0.9) continue; }      // la berma no se toca
      GH[i] = (src[i - GNX - 1] + 2 * src[i - GNX] + src[i - GNX + 1] + 2 * src[i - 1] + 4 * src[i] + 2 * src[i + 1] + src[i + GNX - 1] + 2 * src[i + GNX] + src[i + GNX + 1]) / 16;
    }
  }
  for (let pass = 0; pass < 3; pass++) {      // sin picos sueltos cerca del camino: una celda que sobresale sobre todo su entorno baja al nivel del entorno
    const src = Float32Array.from(GH);
    for (let iz = 3; iz < GNZ - 3; iz++) for (let ix = 3; ix < GNX - 3; ix++) {
      const i = iz * GNX + ix; if (GD[i] <= WR || GD[i] > 120) continue;
      let mx = -1e9; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { if (Math.max(Math.abs(a), Math.abs(b)) < 2) continue; const v = src[(iz + a) * GNX + ix + b]; if (v > mx) mx = v; }
      if (src[i] > mx + 2) GH[i] = mx;
    }
  }
  if (PLAT) {            // explanada: plana a lo ancho, con la pendiente del camino a lo largo
    const k0 = Math.max(0, PLAT.k - PLAT.HL - 60), k1 = Math.min(NS, PLAT.k + PLAT.HL + 60);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let k = k0; k <= k1; k += 4) for (const b of [-30, WR + PLAT.D + 30]) {
      const x = px[k] - ptz[k] * PLAT.side * b, z = pz[k] + ptx[k] * PLAT.side * b;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    const i0 = Math.max(0, Math.floor((x0 - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((x1 - GX0) / CELL));
    const j0 = Math.max(0, Math.floor((z0 - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((z1 - GZ0) / CELL));
    for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
      const x = GX0 + ix * CELL, z = GZ0 + iz * CELL; let bi = k0, bd = 1e9;
      for (let k = k0; k <= k1; k++) { const dx = px[k] - x, dz = pz[k] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; bi = k; } }
      const la = ((x - px[bi]) * -ptz[bi] + (z - pz[bi]) * ptx[bi]) * PLAT.side, al = bi - PLAT.k;
      const dist = Math.max(Math.abs(al - 45) - 30, WR - 1 - la, la - (WR + PLAT.D));      // pala 3 en la fase 7: aquí queda solo el pasillo de acceso al portón
      if (dist < 14 && Math.sqrt(bd) < GD[iz * GNX + ix] + 6) {      // solo celdas cuyo tramo más cercano es el de la zona (no otro tramo del camino)
        const i = iz * GNX + ix;
        if (dist < 0) { GH[i] = hr[bi]; GD[i] = -1; } else { const w = dist / 14, sw = w * w * (3 - 2 * w); GH[i] = hr[bi] * (1 - sw) + GH[i] * sw; }
      }
    }
  }
  if (PLAT && !P3_MOVED) {            // banco del cerro detrás de la explanada: escarpe de 14 m donde la pala cava (no se saca mineral del camino)
    const k0 = Math.max(0, PLAT.k - PLAT.HL - 20), k1 = Math.min(NS, PLAT.k + PLAT.HL + 20);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let k = k0; k <= k1; k += 4) for (const b of [WR + PLAT.D + 2, WR + PLAT.D + 26]) {
      const x = px[k] - ptz[k] * PLAT.side * b, z = pz[k] + ptx[k] * PLAT.side * b;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    const i0 = Math.max(0, Math.floor((x0 - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((x1 - GX0) / CELL));
    const j0 = Math.max(0, Math.floor((z0 - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((z1 - GZ0) / CELL));
    for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
      const x = GX0 + ix * CELL, z = GZ0 + iz * CELL; let bi = k0, bd = 1e9;
      for (let k = k0; k <= k1; k++) { const dx = px[k] - x, dz = pz[k] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; bi = k; } }
      const la = ((x - px[bi]) * -ptz[bi] + (z - pz[bi]) * ptx[bi]) * PLAT.side, al = bi - PLAT.k;
      if (Math.abs(al) < PLAT.HL + 10 && la > WR + PLAT.D + 2 && Math.sqrt(bd) < GD[iz * GNX + ix] + 6) {      // no levanta otros tramos del camino
        const i = iz * GNX + ix, e = la - (WR + PLAT.D + 1);      // frente de trabajo: pie al nivel del piso, talud de material tronado (~40°, irregular) y arriba la pared alta de roca in situ hasta el banco de arriba
        const muck = Math.min(10, e * 0.85) + 1.1 * Math.sin(x * 0.9 + z * 0.4) * Math.sin(z * 0.7 - x * 0.3) * Math.min(1, e / 3) * Math.max(0, 1 - (e - 9) / 3);
        const wall = e > 11.5 ? 5 * Math.min(1, (e - 11.5) / 1.5) : 0;
        GH[i] = e > 13 ? Math.max(GH[i], hr[bi] + BENCH) : Math.max(hr[bi], hr[bi] + Math.max(0, muck) + wall); if (e < 12) GD[i] = -2;      // detrás de la pared alta sigue el cerro (si es más alto)
      }
    }
  }
  if (RAD) {             // bahía del radar: plana a la altura del camino, a la derecha, entre el camino y el talud
    const kc = Math.round((RAD.s - SMIN) / DS), HLR = RAD.hl + 14, k0 = kc - HLR - 10, k1 = kc + HLR + 10;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let k = k0; k <= k1; k += 4) for (const b of [WR - 3, WR + RAD.D + 3]) {
      const x = px[k] - ptz[k] * b * RAD.side, z = pz[k] + ptx[k] * b * RAD.side;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    const i0 = Math.max(0, Math.floor((x0 - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((x1 - GX0) / CELL));
    const j0 = Math.max(0, Math.floor((z0 - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((z1 - GZ0) / CELL));
    for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
      const x = GX0 + ix * CELL, z = GZ0 + iz * CELL; let bi = k0, bd = 1e9;
      for (let k = k0; k <= k1; k++) { const dx = px[k] - x, dz = pz[k] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; bi = k; } }
      const la = ((x - px[bi]) * -ptz[bi] + (z - pz[bi]) * ptx[bi]) * RAD.side, al = bi - kc;
      const dist = Math.max(Math.abs(al) - HLR, WR - 1 - la, la - (WR + RAD.D));
      if (dist < 14 && Math.sqrt(bd) < GD[iz * GNX + ix] + 6) {      // solo celdas cuyo tramo más cercano es el de la zona (no otro tramo del camino)
        const i = iz * GNX + ix;
        if (dist < 0) { GH[i] = hr[bi]; GD[i] = -1; } else { const w = dist / 14, sw = w * w * (3 - 2 * w); GH[i] = hr[bi] * (1 - sw) + GH[i] * sw; }
      }
    }
  }
});
function H(x, z) {
  let fx = (x - GX0) / CELL, fz = (z - GZ0) / CELL;
  if (fx < 0) fx = 0; else if (fx > GNX - 1.001) fx = GNX - 1.001;
  if (fz < 0) fz = 0; else if (fz > GNZ - 1.001) fz = GNZ - 1.001;
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * GNX + ix;
  return (GH[i] * (1 - tx) + GH[i + 1] * tx) * (1 - tz) + (GH[i + GNX] * (1 - tx) + GH[i + GNX + 1] * tx) * tz;
}
function slopeAt(x, z) { const e = 1.5; return Math.hypot(H(x + e, z) - H(x - e, z), H(x, z + e) - H(x, z - e)) / (2 * e); }

/* ───────────── Escena ───────────── */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
paso('cielo: textura degradada', () => {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2f78c0'); gr.addColorStop(.5, '#8ec1e6'); gr.addColorStop(1, '#e3d3b6');
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  scene.background = new THREE.CanvasTexture(c);
});
scene.fog = new THREE.FogExp2(0xdccdb0, 0.0011);
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 3200);
scene.add(new THREE.HemisphereLight(0xfff2dd, 0x7a5a3a, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.85); sun.position.set(-120, 200, 80); scene.add(sun);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 78 : 62; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();


const RAMPS = [];
// Fondo mina: piso plano donde parte la Rampa Oeste; pala 1 cargando en su pila tronada (al lado opuesto del camino) y cancha de perforación
const PITB = { a0: -70, a1: 30, b0: -72, b1: -39, r1: -29, ra1: 30, h: BENCH };      // banco de perforación del fondo (coordenadas a: hacia la pila, b: costado) y su rampa (entre b1 y r1)
const PIT = { x: -215, z: 165, r: 0, ux: 1, uz: 0, tx: 0, tz: 1 };      // fondo mina (u: a lo largo del piso)
function pileTerrain(cx, cz, ux, uz, base, ha, hb, hgt, dig) {      // pila de material tronado (loma irregular) con el corte cóncavo donde cava la pala
  const tx = -uz, tz = ux, R = Math.max(ha, hb) + 4;
  const i0 = Math.max(0, Math.floor((cx - R - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((cx + R - GX0) / CELL)), j0 = Math.max(0, Math.floor((cz - R - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((cz + R - GZ0) / CELL));
  for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
    const x = GX0 + ix * CELL, z = GZ0 + iz * CELL, i = iz * GNX + ix; if (GD[i] >= 0 && GD[i] <= WR + 2) continue;
    const a = (x - cx) * ux + (z - cz) * uz, b = (x - cx) * tx + (z - cz) * tz, pr = Math.hypot(a / ha, b / hb); if (pr >= 1) continue;
    let m = hgt * Math.pow(Math.cos(pr * Math.PI / 2), 0.7) + 1.1 * Math.sin(x * 0.8 + z * 0.35) * Math.sin(z * 0.6 - x * 0.25) * (1 - pr);
    const dg = Math.hypot(a + ha * 0.7, b); if (dg < dig) m = Math.min(m, hgt * Math.pow(dg / dig, 1.6));
    if (m > 0.3) { GH[i] = Math.max(GH[i], base + m); GD[i] = -2; }
  }
}
paso('fondo mina: piso y pilas de las palas 1 y 5', () => {
  for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {      // piso del fondo
    const x = GX0 + ix * CELL, z = GZ0 + iz * CELL, i = iz * GNX + ix, r = Math.hypot(x - PIT.x, z - PIT.z);
    if (floorD(x, z) < PIT.r && !(GD[i] >= 0 && GD[i] < 1)) { GH[i] = FLOOR; GD[i] = -1; }
  }
  { const W = (a, b) => ({ x: PIT.x + PIT.ux * a * 1.5 + PIT.tx * b * 1.5, z: PIT.z + PIT.uz * a * 1.5 + PIT.tz * b * 1.5 }), p1 = W(-140, 0), p5 = W(60, 78);      // pilas de material tronado contra las paredes: pala 1 (extremo norponiente) y pala 5 (costado)
    pileTerrain(p1.x + PIT.ux * 8, p1.z + PIT.uz * 8, -PIT.ux, -PIT.uz, FLOOR, 20, 46, 16, 15);
    const q5 = W(40, 78); pileTerrain(q5.x + PIT.tx * 8, q5.z + PIT.tz * 8, PIT.tx, PIT.tz, FLOOR, 20, 46, 16, 15); }      // pala 5: pila contra la pared sur, con su bahía hacia la pala
});
const sdPoly = P => { const xs = P.map(p => p[0]), zs = P.map(p => p[1]);      // distancia con signo al borde de un polígono (negativa adentro)
  const f = (x, z) => { let m = 1e9; for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length], vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1))); m = Math.min(m, Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t)); } return inPoly(x, z, P) ? -m : m; };
  f.bb = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; f.P = P; return f; };
const RED52 = D52.red.map(sdPoly), BLUE52 = D52.blue.map(sdPoly).filter(f => inF7((f.bb[0] + f.bb[1]) / 2, (f.bb[2] + f.bb[3]) / 2));      // sólo las pilas de la fase 7 (la del fondo se arma con pileTerrain)
const inBB = (f, x, z, m) => x > f.bb[0] - m && x < f.bb[1] + m && z > f.bb[2] - m && z < f.bb[3] + m;
const inBlue = (x, z, m = 0) => BLUE52.some(f => inBB(f, x, z, m + 1) && f(x, z) < m), inRed = (x, z, m = 0) => RED52.some(f => inBB(f, x, z, Math.max(0, m) + 1) && f(x, z) < m);
const faceSpot = (x, z, fx, fz, gap) => { for (let t = -20; t < 160; t += 2) if (inBlue(x + fx * t, z + fz * t)) { const s = t - gap; return { x: x + fx * s, z: z + fz * s }; } return { x, z }; };      // la pala frente al pie de su pila tronada
// Fase 7 (como en la foto aérea): palas de cables 2 (norponiente), 3 (centro) y 6 (suroriente), la PC9000 junto a la 6 y tres canchas de perforación; cada pala con su pila de material tronado
const F7EQ = (() => {
  const M = (px, py) => ({ x: (px - 620) * 2.7, z: (py - 430) * 2.7 });
  const palas = [Object.assign(M(680, 250), { fx: -1, fz: 0, num: '2', off: 2.3 }), Object.assign(M(760, 360), { fx: 0, fz: -1, num: '3', off: 3.1 }), Object.assign(M(840, 430), { fx: 1, fz: 0, num: '6', off: 0.7 })];
  for (const p of palas) Object.assign(p, faceSpot(p.x, p.z, p.fx, p.fz, 13));      // frente de carguío: el material tronado (azul del dibujo) se arma más abajo
  const pc = Object.assign(M(800, 470), { fx: -0.96, fz: 0.29 }); Object.assign(pc, faceSpot(pc.x, pc.z, pc.fx, pc.fz, 9));
  const canchas = [{ c: M(600, 245), ra: 45, rb: 28, dr: M(606, 270) }, { c: M(745, 300), ra: 48, rb: 28, dr: M(800, 292), crawler: M(712, 296) }, { c: M(818, 545), ra: 55, rb: 45, dr: M(830, 590) }];
  const inside = q => { if (inRed(q.x, q.z, -18)) return q; let b = null; for (let r = 5; r < 300 && !b; r += 5) for (let a = 0; a < 24; a++) { const p = { x: q.x + Math.cos(a * TAU / 24) * r, z: q.z + Math.sin(a * TAU / 24) * r }; if (inRed(p.x, p.z, -18)) { b = p; break; } } return b || q; };
  for (const C of canchas) { C.dr = inside({ x: C.c.x + 4, z: C.c.z }); if (C.crawler) C.crawler = inside({ x: C.c.x - C.ra * 0.55, z: C.c.z + 4 }); }      // perforadoras adentro de su área de perforación (rojo del dibujo)
  return { palas, pc, canchas };
})();
const P3N = F7EQ.palas[1];
const F7Z = { C: F7EQ.palas[0], Dr: F7EQ.canchas[1].c, ux: -1, uz: 0, tx: 0, tz: -1, shv: F7EQ.palas[1], dz: null };      // (referencias que usan otras partes)
// Camino antiguo en desuso en la pared bajo el celeste (una curva en U angosta que baja entre los bancos)
paso('camino antiguo en desuso bajo la celeste', () => {
  const W0 = [[112, -48], [134, -5], [122, 52], [82, 92], [50, 78], [72, 34], [92, -12]], HWo = 7;
  const P = []; for (let k = 0; k < W0.length - 1; k++) { const a = W0[k], b = W0[k + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2); for (let j = 0; j < n; j++) P.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
  P.push(W0[W0.length - 1]); const h0 = H(P[0][0], P[0][1]); let s = 0; const hs = P.map((p, k) => { if (k) s += Math.hypot(p[0] - P[k - 1][0], p[1] - P[k - 1][1]); return h0 - 0.1 * s; });
  for (let k = 0; k < P.length; k++) { const [x, z] = P[k], R = Math.ceil((HWo + 1) / CELL), cx = Math.round((x - GX0) / CELL), cz = Math.round((z - GZ0) / CELL);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const jx = cx + dx, jz = cz + dz; if (jx < 0 || jz < 0 || jx >= GNX || jz >= GNZ) continue; const j = jz * GNX + jx;
      if (Math.hypot(GX0 + jx * CELL - x, GZ0 + jz * CELL - z) > HWo || (GD[j] >= 0 && GD[j] <= WR + 2 && GD[j] !== 0.1)) continue; GH[j] = hs[k]; GD[j] = 0.1; HB[j] = -1; } }
});
// Revisión final: ninguna pared baja más de un banco sin berma. Donde una pared (cortes de caminos, rellenos, bordes de canchas) cae más de ~20 m seguidos,
// se escalona en bancos de 16 m: cara de ~70° y berma plana a cota de banco; junto a un camino nunca queda bajo él (corte) ni sobre él (caída)
paso('bancos: cuantización en bancos de 16 m con berma pareja', () => {
  {      // primero, el ángulo entre rampas (≤ ~48°) también en las paredes que dejaron los caminos, canchas y rellenos: se recortan hacia atrás (y se rellena al pie si hace falta)
    const W = i => !((GD[i] >= 0 && GD[i] <= WR + 2) || GD[i] === -1 || GD[i] === -2), d1 = 1.18 * CELL, d2 = d1 * Math.SQRT2, M = GNX;
    for (let pass = 0; pass < 3; pass++) for (const sgn of [-1, 1]) {
      for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < M - 1; ix++) { const i = iz * M + ix; if (!W(i)) continue;
        GH[i] = sgn < 0 ? Math.min(GH[i], GH[i - 1] + d1, GH[i - M] + d1, GH[i - M - 1] + d2, GH[i - M + 1] + d2) : Math.max(GH[i], GH[i - 1] - d1, GH[i - M] - d1, GH[i - M - 1] - d2, GH[i - M + 1] - d2); }
      for (let iz = GNZ - 2; iz >= 1; iz--) for (let ix = M - 2; ix >= 1; ix--) { const i = iz * M + ix; if (!W(i)) continue;
        GH[i] = sgn < 0 ? Math.min(GH[i], GH[i + 1] + d1, GH[i + M] + d1, GH[i + M + 1] + d2, GH[i + M - 1] + d2) : Math.max(GH[i], GH[i + 1] - d1, GH[i + M] - d1, GH[i + M + 1] - d2, GH[i + M - 1] - d2); }
    }
  }
  const N = GNX, src = Float32Array.from(GH), steep = (i, j, run) => (src[i] - src[j]) / run > 0.6, NB = [1, -1, N, -N, N + 1, N - 1, -N + 1, -N - 1];
  const runOf = o => (Math.abs(o) === 1 || Math.abs(o) === N) ? CELL : CELL * Math.SQRT2;
  const span = i => {      // caída continua (sin berma) que pasa por la celda: hacia abajo + hacia arriba por la máxima pendiente
    let a = i, dn = 0; for (let s = 0; s < 40; s++) { let b = -1, bh = src[a], bo = 0; for (const o of NB) { const j = a + o; if (j >= 0 && j < src.length && src[j] < bh) { bh = src[j]; b = j; bo = o; } } if (b < 0 || !steep(a, b, runOf(bo))) break; dn += src[a] - bh; a = b; }
    let c = i, up = 0; for (let s = 0; s < 40; s++) { let b = -1, bh = src[c], bo = 0; for (const o of NB) { const j = c + o; if (j >= 0 && j < src.length && src[j] > bh) { bh = src[j]; b = j; bo = o; } } if (b < 0 || !steep(b, c, runOf(bo))) break; up += bh - src[c]; c = b; }
    return dn + up;
  };
  const sm = v => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); };
  for (let iz = 2; iz < GNZ - 2; iz++) for (let ix = 2; ix < N - 2; ix++) {
    const i = iz * N + ix, g0 = GD[i]; if ((g0 >= 0 && g0 <= WR + 2) || g0 === -1 || g0 === -2) continue;      // caminos, pisos, canchas y pilas no se tocan
    if (src[i] > YTOP - 0.5 || span(i) < 20) continue;
    const g = Math.hypot((src[i + 1] - src[i - 1]) / (2 * CELL), (src[i + N] - src[i - N]) / (2 * CELL)), a = Math.min(0.4, Math.max(0.12, 5.8 * g / BENCH));
    const t = src[i] / BENCH, u = t - 0.5 + a / 2, m = Math.floor(u); let y = BENCH * (m + sm((u - m) / a));
    if (g0 < 60) { const r = hr[GI[i]]; y = src[i] >= r ? Math.max(y, r) : Math.min(y, r); }
    GH[i] = Math.min(YTOP, Math.max(FLOOR, y));
  }
});
const PLAT7 = new Uint8Array(GNX * GNZ);      // meseta a la cota de la fase 7 fuera de su polígono (la pisan los cables, no los camiones)
// Isla de bancos entre la celeste y la fase 7 (como se ve en Maps): pared pareja de bancos de 16 m con berma de 6 m que sube desde los caminos (los dos tramos de la celeste, la azul y la entrada a la fase 7) hasta el piso de la fase 7; los bancos corren paralelos al camino y doblan en recta en sus quiebres
paso('isla celeste–fase 7: cono mínimo y piso de la fase 7', () => {
  const S = 1.36 /* 16 m de banco: cara de ~5,8 m (70°) + berma de 6 m */, RW = WR + 2, BL = 20, A = 1 - 6 * S / BENCH, sm = t => t * t * (3 - 2 * t);
  const dp = (P, eps) => { const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; const st = [[0, P.length - 1]]; while (st.length) { const [a, b] = st.pop(), [ax, az] = P[a], [bx, bz] = P[b], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; let md = 0, mi = -1; for (let k = a + 1; k < b; k++) { const t = Math.max(0, Math.min(1, ((P[k][0] - ax) * dx + (P[k][1] - az) * dz) / L2)), d = Math.hypot(ax + dx * t - P[k][0], az + dz * t - P[k][1]); if (d > md) { md = d; mi = k; } } if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); } } return P.filter((_, k) => keep[k]); };      // Douglas–Peucker: deja solo los quiebres del camino
  const CEL = SEC[7], E0 = SEC[11][0], near = (P, q) => P.reduce((b, p, k) => Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(P[b][0] - q[0], P[b][1] - q[1]) ? k : b, 0);
  const iA = near(F7, CEL[CEL.length - 1]), iN = near(F7, E0), n = F7.length, fwd = (iN - iA + n) % n <= n / 2, edge = []; for (let k = iA; ; k = (k + (fwd ? 1 : n - 1)) % n) { edge.push(F7[k]); if (k === iN) break; }
  const ISLA = sdPoly([...CEL.map(p => [p[0], p[1]]), ...edge, [E0[0], E0[1]]]), F7S = sdPoly(F7);      // celeste (empalme con la azul → curva en U → entrada a la fase 7), borde poniente de la fase 7, curva de la azul donde nace la entrada, y de vuelta al empalme
  const SRC = SEC.map((r, k) => dp(r, k === 7 ? 10 : 6)).filter(r => r.length > 1);
  const i0 = Math.max(0, Math.floor((ISLA.bb[0] - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((ISLA.bb[1] - GX0) / CELL)), j0 = Math.max(0, Math.floor((ISLA.bb[2] - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((ISLA.bb[3] - GZ0) / CELL));
  for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
    const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL, de = ISLA(x, z); if (de >= 0) continue;
    if ((GD[i] >= 0 && GD[i] <= WR + 2) || GD[i] === -1 || GD[i] === -2 || inF7(x, z) || PATIOS.some(q => Math.hypot(q[0] - x, q[1] - z) < q[3] + 1)) continue;      // caminos, patios, pisos y pilas no se tocan
    let hc = 1e9, hb0 = 0;      // cono mínimo: la superficie más baja que sube con pendiente S desde cada tramo de camino (cota interpolada a lo largo del tramo)
    for (const R of SRC) for (let k = 0; k < R.length - 1; k++) { const [ax, az, ah] = R[k], [bx, bz, bh] = R[k + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))), d = Math.hypot(ax + dx * t - x, az + dz * t - z), h0 = ah + (bh - ah) * t, hh = h0 + S * Math.max(0, d - RW); if (hh < hc) { hc = hh; hb0 = h0; } }
    const hT = f7h(x, z); hc = Math.max(Math.min(hc, hT), hT - S * Math.max(0, F7S(x, z)));      // tope: el piso de la fase 7 (y desde su borde la pared baja con la misma pendiente)
    const u = (hc - FLOOR) / BENCH - 0.5 + A / 2, m = Math.floor(u), hb = Math.max(hb0, Math.min(hT, FLOOR + BENCH * (m + sm(Math.max(0, Math.min(1, (u - m) / A))))));      // bancos de 16 m con berma de 6 m, nunca bajo el camino del que nacen
    const w = Math.min(1, -de / BL); GH[i] = GH[i] * (1 - w) + hb * w; HB[i] = -1; if (w >= 1 && hb >= hT - 0.3) { GD[i] = -1; PLAT7[i] = 1; }      // lo que queda a la cota de la fase 7 es piso de ella
  }
});
// Canchas de perforación: un banco (16 m) más arriba que el piso donde cargan las palas, cara de ~69° (6 m), pretil de seguridad de 1,6 m en la cresta y rampa de acceso (≤ 12 %)
const PAD_UP = BENCH, pretil = d => d > -3 ? 1.6 * Math.sin(Math.PI * -d / 3) : 0;      // pretil: lomo de 3 m de ancho en la cresta de la cancha (d = distancia al borde, negativa adentro)
function padTerrain(cx, cz, RA, RB, fh, avoid, inside, ext) {
  const padH = fh(cx, cz) + PAD_UP, FACE = 6, ok = i => GD[i] === -1 || GD[i] === -2 || GD[i] > WR + 2;
  const cellAt = (x, z) => { const ix = Math.round((x - GX0) / CELL), iz = Math.round((z - GZ0) / CELL); return (ix < 0 || iz < 0 || ix >= GNX || iz >= GNZ) ? -1 : iz * GNX + ix; };
  let inExt = () => 1;
  if (ext) {      // prolongación de la cancha hacia ext (dirección), hasta topar con el banco del rajo de esa altura
    let T = 0; const a0 = Math.atan2(ext.z, ext.x);
    for (const da of [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1, -1, 1.25, -1.25]) { const ex = Math.cos(a0 + da), ez = Math.sin(a0 + da); let t1 = 0;      // la dirección más cercana a la del fondo que llega a la pared sin cruzar un camino
      for (let t = 0; t < 600; t += 5) { let hit = 0; for (const w of [-RB * 0.8, 0, RB * 0.8]) { const i = cellAt(cx + ex * t - ez * w, cz + ez * t + ex * w); if (i < 0 || (GD[i] >= 0 && GD[i] <= WR + 2)) { hit = -1; break; } if (GH[i] >= padH - 1) hit = 1; } if (hit < 0) break; if (hit > 0 && t > RA) { t1 = t + 6; break; } }
      if (t1) { ext = { x: ex, z: ez }; T = t1; break; } }
    if (T > 0) { const HW = RB * 0.8; inExt = (x, z) => { const t = (x - cx) * ext.x + (z - cz) * ext.z, w = Math.abs(-(x - cx) * ext.z + (z - cz) * ext.x); return Math.max(-t, t - T, w - HW); };
      for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) { const x = GX0 + ix * CELL, z = GZ0 + iz * CELL, d = inExt(x, z); if (d > FACE) continue; const i = iz * GNX + ix; if (!ok(i)) continue;
        if (d <= 0) { if (GH[i] < padH) { GH[i] = padH; GD[i] = -1; HB[i] = -1; } } else { const hh = fh(x, z) + (padH - fh(x, z)) * (1 - d / FACE); if (hh > GH[i]) { GH[i] = hh; GD[i] = 60; HB[i] = -1; } } }
      avoid = avoid.concat([0.25, 0.5, 0.75, 1].map(k => ({ x: cx + ext.x * T * k, z: cz + ext.z * T * k, r: RB + 12 }))); }
  }
  // rampa: la más corta hacia un piso libre (sin caminos, pilas ni equipos)
  let best = null;
  for (const gmax of [0.12, 0.15]) { for (let k = 0; k < 36; k++) {
    const th = k * TAU / 36, dx = Math.cos(th), dz = Math.sin(th), R = 1 / Math.hypot(dx / RA, dz / RB) + FACE * 0.3, ex = cx + dx * R, ez = cz + dz * R;
    let Lr = 60; for (let it = 0; it < 4; it++) Lr = Math.max(40, (padH - fh(ex + dx * Lr, ez + dz * Lr)) / gmax);
    let good = true;
    for (let t = 0; t <= Lr + 10 && good; t += 4) for (let w = -14; w <= 14 && good; w += 7) { const x = ex + dx * t - dz * w, z = ez + dz * t + dx * w, i = cellAt(x, z);
      if (i < 0 || GD[i] !== -1 || Math.abs(GH[i] - fh(x, z)) > 1.5 || !inside(x, z) || avoid.some(o => Math.hypot(o.x - x, o.z - z) < o.r)) good = false; }
    if (good && (!best || Lr < best.Lr)) best = { ex, ez, dx, dz, Lr, h1: fh(ex + dx * Lr, ez + dz * Lr) };
  } if (best) break; }
  const R0 = Math.max(RA, RB) + FACE + 2, i0 = Math.max(0, Math.floor((cx - R0 - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((cx + R0 - GX0) / CELL)), j0 = Math.max(0, Math.floor((cz - R0 - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((cz + R0 - GZ0) / CELL));
  for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {      // la cancha (plana) y su cara de banco
    const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL; if (!ok(i)) continue;
    const a = x - cx, b = z - cz, e = Math.hypot(a / RA, b / RB), d = (e - 1) / Math.hypot(a / RA / RA, b / RB / RB) * e;      // distancia aprox. al borde de la cancha
    if (d <= 0) { GH[i] = padH + pretil(d); GD[i] = -1; HB[i] = -1; }
    else if (d < FACE && !(ext && inExt(x, z) < 0)) { const hh = fh(x, z) + (padH - fh(x, z)) * (1 - d / FACE); if (hh > GH[i]) { GH[i] = hh; GD[i] = 60; HB[i] = -1; } }
  }
  if (!best) return null;
  const B = best, M2 = B.Lr + 2;
  const k0 = Math.max(0, Math.floor((Math.min(B.ex, B.ex + B.dx * M2) - 20 - GX0) / CELL)), k1 = Math.min(GNX - 1, Math.ceil((Math.max(B.ex, B.ex + B.dx * M2) + 20 - GX0) / CELL));
  const l0 = Math.max(0, Math.floor((Math.min(B.ez, B.ez + B.dz * M2) - 20 - GZ0) / CELL)), l1 = Math.min(GNZ - 1, Math.ceil((Math.max(B.ez, B.ez + B.dz * M2) + 20 - GZ0) / CELL));
  for (let iz = l0; iz <= l1; iz++) for (let ix = k0; ix <= k1; ix++) {      // rampa de 18 m de ancho (perforadoras y camionetas) con sus taludes
    const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL; if (!ok(i)) continue;
    const t = (x - B.ex) * B.dx + (z - B.ez) * B.dz, w = Math.abs(-(x - B.ex) * B.dz + (z - B.ez) * B.dx); if (t < -FACE - 3 || t > B.Lr || w > 9 + FACE) continue;
    const hr0 = Math.max(fh(x, z), padH + (B.h1 - padH) * Math.max(0, t) / B.Lr), hh = w <= 9 ? hr0 : fh(x, z) + (hr0 - fh(x, z)) * (1 - (w - 9) / FACE);
    if (w <= 9) { GH[i] = hr0; GD[i] = 0.1; HB[i] = -1; } else if (hh > GH[i]) { GH[i] = hh; GD[i] = 60; HB[i] = -1; }
  }
  return B;
}
paso('fase 7: canchas (rojo), material tronado (azul), bahías y rampas; canchas del fondo', () => {
  const av = F7EQ.palas.map(p => ({ x: p.x + p.fx * 20, z: p.z + p.fz * 20, r: 75 })).concat([{ x: F7EQ.pc.x, z: F7EQ.pc.z, r: 50 }]);
  const fd = (() => { const C = F7EQ.canchas[2], dx = PIT.x - C.c.x, dz = PIT.z - C.c.z, n = Math.hypot(dx, dz); return { x: dx / n, z: dz / n }; })();      // la cancha de la 409 llega al banco del rajo, hacia el fondo
  {      // fase 7 según el dibujo: rojo = cancha de perforación (un banco arriba del piso de las palas), azul = material tronado (frente de carguío)
    const FACE = 6, ok = i => GD[i] === -1 || GD[i] === -2 || GD[i] > WR + 2, base = (x, z) => inF7(x, z) ? f7h(x, z) : FLOOR;
    const cellAt = (x, z) => { const ix = Math.round((x - GX0) / CELL), iz = Math.round((z - GZ0) / CELL); return (ix < 0 || iz < 0 || ix >= GNX || iz >= GNZ) ? -1 : iz * GNX + ix; };
    const each = (f, m, fn) => { const i0 = Math.max(0, Math.floor((f.bb[0] - m - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((f.bb[1] + m - GX0) / CELL)), j0 = Math.max(0, Math.floor((f.bb[2] - m - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((f.bb[3] + m - GZ0) / CELL));
      for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) { const i = iz * GNX + ix; if (ok(i)) fn(i, GX0 + ix * CELL, GZ0 + iz * CELL); } };
    const RS = []; for (let s = START_S; s < 650; s += 4) { const q = frame(s); RS.push(q); }      // pasillo libre junto a la Rampa Sur hasta el portón
    const nearRoute = (x, z) => RS.some(q => Math.hypot(q.x - x, q.z - z) < WR + 50) || SEC[0].some(q => Math.hypot(q[0] - x, q[1] - z) < WR + 25);      // y junto al camino rojo de la fase 7
    const ramps = [];      // rampas de acceso a cada cancha (≤ 12 %), buscadas sobre el piso libre antes de levantar las canchas
    for (const f of RED52) { const cand = [], P = f.P;
      for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10);
        for (let q = 0; q < n; q++) { const bx = a[0] + (b[0] - a[0]) * q / n, bz = a[1] + (b[1] - a[1]) * q / n; let dx = f(bx + 3, bz) - f(bx - 3, bz), dz = f(bx, bz + 3) - f(bx, bz - 3); const nn = Math.hypot(dx, dz); if (nn < 1e-6) continue; dx /= nn; dz /= nn;
          const ex = bx + dx * (FACE + 2), ez = bz + dz * (FACE + 2), padH = base(bx, bz) + PAD_UP; let Lr = 60; for (let it = 0; it < 4; it++) Lr = Math.max(40, (padH - base(ex + dx * Lr, ez + dz * Lr)) / 0.12);
          let good = true; for (let t = 0; t <= Lr + 10 && good; t += 4) for (let w = -14; w <= 14 && good; w += 7) { const x = ex + dx * t - dz * w, z = ez + dz * t + dx * w, i = cellAt(x, z);
            if (i < 0 || GD[i] !== -1 || Math.abs(GH[i] - base(x, z)) > 1.5 || !inF7(x, z) || nearRoute(x, z) || inRed(x, z, 9) || inBlue(x, z, 12) || F7EQ.palas.concat([F7EQ.pc]).some(o => Math.hypot(o.x - x, o.z - z) < 45)) good = false; }
          if (good) cand.push({ ex: bx, ez: bz, dx, dz, Lr: Lr + FACE + 2, h1: base(ex + dx * Lr, ez + dz * Lr), padH }); } }
      cand.sort((p, q) => p.Lr - q.Lr); const pick = []; for (const c of cand) if (!pick.length || (Math.hypot(f.bb[1] - f.bb[0], f.bb[3] - f.bb[2]) > 400 && pick.length < 2 && Math.hypot(c.ex - pick[0].ex, c.ez - pick[0].ez) > 250)) pick.push(c);
      ramps.push(...pick); }
    for (const f of RED52) each(f, FACE + 1, (i, x, z) => { const d = nearRoute(x, z) ? Math.max(f(x, z), 8) : f(x, z), b = base(x, z), padH = b + PAD_UP;      // cancha: piso plano (sigue la pendiente de la fase 7) y su cara de banco
      if (d <= 0) { GH[i] = padH + pretil(d); GD[i] = -1; HB[i] = -1; } else if (d < FACE) { const hh = b + PAD_UP * (1 - d / FACE); if (hh > GH[i]) { GH[i] = hh; GD[i] = 60; HB[i] = -1; } } });
    const BAYS = F7EQ.palas.map(p => ({ x: p.x + p.fx * 22, z: p.z + p.fz * 22, R: 18 })).concat([{ x: F7EQ.pc.x + F7EQ.pc.fx * 18, z: F7EQ.pc.z + F7EQ.pc.fz * 18, R: 14 }]);      // bahías de carguío: el corte cóncavo que deja la pala al cavar su pila
    for (const f of BLUE52) each(f, 1, (i, x, z) => { const d = f(x, z); if (d >= 0) return; const b = base(x, z), n = 1.2 * Math.sin(x * 0.7 + z * 0.3) * Math.sin(z * 0.55 - x * 0.2) + 0.8 * hash(x * 0.37, z * 0.41);      // material tronado: esponjado sobre el nivel de la cancha, talud de ~37° hacia la pala
      let hh = Math.min(b + PAD_UP + 1 + n, b - d * 0.75 + 0.6 * n);      // pila: un banco más ~1 m de esponjamiento, talud de reposo 37°
      for (const B of BAYS) { const dg = Math.hypot(x - B.x, z - B.z); if (dg < B.R) hh = Math.min(hh, b + (PAD_UP + 1) * Math.pow(dg / B.R, 1.6)); }
      if (hh > GH[i] - 0.5) { GH[i] = Math.max(GH[i], hh); GD[i] = -2; HB[i] = -1; } });
    for (const B of ramps) {      // rampa de 18 m de ancho con sus taludes
      const M2 = B.Lr + 2, k0 = Math.max(0, Math.floor((Math.min(B.ex, B.ex + B.dx * M2) - 20 - GX0) / CELL)), k1 = Math.min(GNX - 1, Math.ceil((Math.max(B.ex, B.ex + B.dx * M2) + 20 - GX0) / CELL));
      const l0 = Math.max(0, Math.floor((Math.min(B.ez, B.ez + B.dz * M2) - 20 - GZ0) / CELL)), l1 = Math.min(GNZ - 1, Math.ceil((Math.max(B.ez, B.ez + B.dz * M2) + 20 - GZ0) / CELL));
      for (let iz = l0; iz <= l1; iz++) for (let ix = k0; ix <= k1; ix++) { const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL; if (!ok(i)) continue;
        const t = (x - B.ex) * B.dx + (z - B.ez) * B.dz, w = Math.abs(-(x - B.ex) * B.dz + (z - B.ez) * B.dx); if (t < -4 || t > B.Lr || w > 9 + FACE) continue;
        const hr0 = Math.max(base(x, z), B.padH + (B.h1 - B.padH) * Math.max(0, t) / B.Lr), hh = w <= 9 ? hr0 : base(x, z) + (hr0 - base(x, z)) * (1 - (w - 9) / FACE);
        if (w <= 9) { GH[i] = hr0; GD[i] = 0.1; HB[i] = -1; } else if (hh > GH[i]) { GH[i] = hh; GD[i] = 60; HB[i] = -1; } } }
    F7EQ.ramps = ramps;
  }
  const W = (a, b) => ({ x: PIT.x + PIT.ux * a * 1.5 + PIT.tx * b * 1.5, z: PIT.z + PIT.uz * a * 1.5 + PIT.tz * b * 1.5 });
  const fav = [W(-112, 0), W(60, 50)].map(q => ({ x: q.x, z: q.z, r: 60 })), c1 = W(-5, -70), c2 = W(-70, 67.5);
  PITB.pads = [padTerrain(c1.x, c1.z, 35 * 1.5 + 4, 30 * 1.5 + 4, () => FLOOR, fav.concat([{ x: c2.x, z: c2.z, r: 80 }]), () => true), padTerrain(c2.x, c2.z, 25 * 1.5 + 4, 27.5 * 1.5 + 4, () => FLOOR, fav.concat([{ x: c1.x, z: c1.z, r: 90 }]), () => true)];
});
/* Terreno: rajo con bancos, camino excavado y explanada */
paso('terreno: malla 3D con colores', () => {
  const vc = GNX * GNZ, pos = new Float32Array(vc * 3), col = new Float32Array(vc * 3), c = new THREE.Color(), c2 = new THREE.Color();
  for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {
    const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL, h = GH[i], d = GD[i], n = hash(ix, iz), n2 = hash(ix * 0.37 + 11, iz * 0.29 + 5);
    pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
    const xm = GH[iz * GNX + Math.max(0, ix - 1)], xp = GH[iz * GNX + Math.min(GNX - 1, ix + 1)], zm = GH[Math.max(0, iz - 1) * GNX + ix], zp = GH[Math.min(GNZ - 1, iz + 1) * GNX + ix];
    const sl = Math.hypot(xp - xm, zp - zm) / (2 * CELL), q = qOf(x, z);
    if (h >= YTOP - 0.6 && sl < 0.15 && !(d > 0 && d < 1)) c.setHex(0xc3ac84).multiplyScalar(0.94 + 0.12 * n);
    else if (d === -2) c.setHex(0x5e5245).multiplyScalar(0.8 + 0.35 * n);          // material tronado del frente: roca suelta, más oscura
    else if (d < 0) c.setHex(0x6f675c).multiplyScalar(0.88 + 0.22 * n);          // piso de la explanada: gris, distinto al camino
    else if (d < WR + 2) c.setHex(0x9a8566).multiplyScalar(0.93 + 0.14 * n);
    else if (sl > 0.4) {                                  // cara de banco
      c.setHex(0x6a4a36).lerp(c2.setHex(0x8f5c3a), 0.5 + 0.5 * Math.sin(h * 0.9 + n2 * 4));
      c.lerp(c2.setHex(0x2e2823), Math.max(0, Math.min(0.6, 0.35 + 0.55 * x / PA)));      // el lado oriente es más oscuro
      if (n2 > 0.965) c.lerp(c2.setHex(0x4f8d86), 0.5);
      c.multiplyScalar(0.82 + 0.3 * n);
    } else if (h < FLOOR + 0.7) c.setHex(0x6f675c).multiplyScalar(0.9 + 0.2 * n);     // fondo del rajo
    else c.setHex(0xa08c6a).multiplyScalar(0.92 + 0.16 * n);                               // berma
    if (HB[i] >= 0 && h - HB[i] > 4 && h < YTOP - 1) { const ph = (h % BENCH) / BENCH; c.multiplyScalar((ph < 0.06 || ph > 0.94) ? 1.3 : 0.62 + 0.5 * ph); c.lerp(c2.setHex(0x9a958a), 0.2); }      // escalera entre el fondo y la superficie: franjas alineadas con sus bancos
    else if (d >= WR + 16 && d < WR + 60 && h < YTOP - 1 && h - hr[GI[i]] > 4) {      // cerro junto al camino: mismas franjas banco-berma, medidas desde la cota del camino
      const ph = (h % BENCH) / BENCH, w = Math.min(1, (d - WR - 16) / 10);
      c.multiplyScalar(1 + w * (((ph < 0.06 || ph > 0.94) ? 1.3 : 0.62 + 0.5 * ph) - 1)); c.lerp(c2.setHex(0x9a958a), 0.2 * w);
    }
    else if (d >= WR + 60 && h > 1 && h < YTOP - 1) { const ph = (h % BENCH) / BENCH; c.multiplyScalar((ph < 0.04 || ph > 0.96) ? 1.3 : 0.6 + 0.5 * ph); c.lerp(c2.setHex(0x9a958a), 0.3); }      // paredes lejanas: franjas horizontales por banco (berma clara, cara oscura abajo y clara arriba), como en un rajo real
    if (d >= WR + 2 && h < YTOP - 0.6) { const lp = (xp + xm + zp + zm - 4 * h) / 8; c.multiplyScalar(1 - Math.max(-0.32, Math.min(0.32, lp * 0.5))); }      // labio de la berma más claro y base de la cara más oscura: se leen las bandas banco-berma-banco desde el camino
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const idx = new Uint32Array((GNX - 1) * (GNZ - 1) * 6); let o = 0;
  for (let iz = 0; iz < GNZ - 1; iz++) for (let ix = 0; ix < GNX - 1; ix++) {
    const a = iz * GNX + ix, b = a + 1, c3 = a + GNX, d = c3 + 1;
    idx[o++] = a; idx[o++] = c3; idx[o++] = b; idx[o++] = b; idx[o++] = c3; idx[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
  const gx1 = GX0 + (GNX - 1) * CELL, gz1 = GZ0 + (GNZ - 1) * CELL, BIG = 3000;     // meseta alrededor del rajo (4 paños)
  for (const [x0, z0, x1, z1] of [[GX0 - BIG, GZ0 - BIG, gx1 + BIG, GZ0], [GX0 - BIG, gz1, gx1 + BIG, gz1 + BIG], [GX0 - BIG, GZ0, GX0, gz1], [gx1, GZ0, gx1 + BIG, gz1]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), lam(0xc3ac84));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, YTOP, (z0 + z1) / 2); scene.add(m);
  }
});


/* Camino de tierra: tramos humectados donde pasó el aljibe, bermas, postes */
const RSTEP = 1.5, WET_T = 80;
const ROAD_U = [-12.1, -8.4, -7.2, -5.8, -4.6, 4.6, 5.8, 7.2, 8.4, 12.1];
const ROAD_TRACK = [0, 1, 0, 1, 0, 1, 0, 1, 0];      // 1 = huella de neumáticos
const ROAD_NC = ROAD_U.length - 1;
const NB = Math.floor((SMAX - SMIN) / RSTEP) - 1;
const wet = new Float32Array(NB), wetDirty = new Uint8Array(NB), roadNoise = new Float32Array(NB * ROAD_NC);
const binOf = s => Math.max(0, Math.min(NB - 1, Math.floor((s - SMIN) / RSTEP)));
const dryC = [new THREE.Color(0x85704f), new THREE.Color(0x6e5a40)];
const wetC = [new THREE.Color(0x3b2c1b), new THREE.Color(0x30230f)];
const _rc = new THREE.Color();
let roadMesh, roadCol;
paso('camino: malla de la calzada', () => {
  const nq = NB * ROAD_NC, pos = new Float32Array(nq * 12), nm = new Float32Array(nq * 12), idx = new Uint32Array(nq * 6);
  roadCol = new Float32Array(nq * 12);
  for (let i = 0; i < NB; i++) {
    const sA = SMIN + i * RSTEP, f1 = frame(sA), f2 = frame(sA + RSTEP);
    for (let c = 0; c < ROAD_NC; c++) {
      const q = i * ROAD_NC + c, o = q * 12, u0 = ROAD_U[c], u1 = ROAD_U[c + 1];
      const pts = [[f1, u0], [f1, u1], [f2, u1], [f2, u0]];
      for (let k = 0; k < 4; k++) {
        const f = pts[k][0], u = pts[k][1], x = f.x + f.rx * u, z = f.z + f.rz * u;
        pos[o + k * 3] = x; pos[o + k * 3 + 1] = H(x, z) + 0.12; pos[o + k * 3 + 2] = z; nm[o + k * 3 + 1] = 1;
      }
      const v = q * 4, t = q * 6; idx[t] = v; idx[t + 1] = v + 1; idx[t + 2] = v + 2; idx[t + 3] = v; idx[t + 4] = v + 2; idx[t + 5] = v + 3;
      roadNoise[q] = 0.93 + 0.14 * hash(i, c + 7);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(roadCol, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
  roadMesh = new THREE.Mesh(g, m); scene.add(roadMesh);
});
function paintBin(i) {
  const w = Math.min(1, wet[i] * 1.4);
  for (let c = 0; c < ROAD_NC; c++) {
    const tr = ROAD_TRACK[c], q = i * ROAD_NC + c, o = q * 12;
    _rc.copy(dryC[tr]).lerp(wetC[tr], w).multiplyScalar(1 + (roadNoise[q] - 1) * (1 - 0.5 * w));
    for (let k = 0; k < 4; k++) { roadCol[o + k * 3] = _rc.r; roadCol[o + k * 3 + 1] = _rc.g; roadCol[o + k * 3 + 2] = _rc.b; }
  }
}
for (let i = 0; i < NB; i++) paintBin(i);
function slickNow() { return Math.min(1, wet[binOf(P.s)] * 1.6); }      // 0 = piso seco, 1 = recién regado
function wetRange(sa, sb) { for (let k = binOf(Math.min(sa, sb)); k <= binOf(Math.max(sa, sb)); k++) wet[k] = 1; }
function seedWet(sFrom, v, cyc) {       // el aljibe bajó regando 10 s sí / 10 s no: tramos mojados y secos alternados
  wet.fill(0);
  for (let i = 0; i < NB; i++) {
    const d = SMIN + i * RSTEP - sFrom; if (d <= 0) continue;
    const age = d / v, ph = (((cyc - age) % 20) + 20) % 20;
    if (ph < 10) wet[i] = Math.max(0, 1 - age / WET_T);
    wetDirty[i] = 1;
  }
}
function updateRoad(dt) {
  let changed = false;
  for (let i = 0; i < NB; i++) {
    const was = wet[i] > 0;
    if (was) wet[i] = Math.max(0, wet[i] - dt / WET_T);
    if (was || wetDirty[i]) { paintBin(i); wetDirty[i] = 0; changed = true; }
  }
  if (changed) roadMesh.geometry.attributes.color.needsUpdate = true;
}

const GAP = PLAT ? { a: PLAT.se + 15, b: PLAT.se + 78, side: PLAT.side } : null;
const inGap = (s, u) => (s > L + 55 && u < 0) || GAP && s > GAP.a && s < GAP.b && (u > 0 ? 1 : -1) === GAP.side || (s > RADG.a && s < RADG.b && u * RAD.side > 0);      // sin pretil donde entra la explanada y la bahía del radar
const DROP = (() => {      // de qué lado del camino hay caída (cada 2 m): ahí van el pretil y los postes amarillos; del lado del cerro no
  const n = Math.ceil((SMAX - SMIN) / 2), out = { L: new Uint8Array(n), R: new Uint8Array(n) };
  for (const [key, sg] of [['L', -1], ['R', 1]]) {
    const a = out[key];
    for (let i = 0; i < n; i++) {
      const s = SMIN + i * 2, f = frame(s); let hi = -1e9;
      for (const u of [WR + 5.5, WR + 11.5, WR + 17.5]) { const x = f.x + f.rx * u * sg, z = f.z + f.rz * u * sg; hi = Math.max(hi, H(x, z)); }
      a[i] = hi < hrAt(s) - 4 ? 1 : 0;      // todo ese lado queda bajo el camino: es caída
    }
    for (const v of [0, 1]) {      // sin cortes ni trozos sueltos de menos de 12 m
      let i = 0; while (i < n) { let j = i; while (j < n && a[j] === a[i]) j++; if (a[i] === v && j - i < 6 && i > 0 && j < n) a.fill(1 - v, i, j); i = j; }
    }
  }
  return out;
})();
const isDrop = (s, u) => { const i = Math.round((s - SMIN) / 2); return i >= 0 && i < DROP.L.length && (u < 0 ? DROP.L : DROP.R)[i] === 1; };
function berm(u0) {
  const prof = [[-0.9, 0], [-0.45, 1.4], [0.45, 1.4], [0.9, 0]], pos = [], idx = [], valid = []; let rows = 0;
  for (let s = SMIN; s < SMAX; s += 2) {
    const f = frame(s);
    for (const [du, h] of prof) { const x = f.x + f.rx * (u0 + du), z = f.z + f.rz * (u0 + du); pos.push(x, H(x, z) + 0.1 + h, z); }
    valid.push(!inGap(s, u0) && isDrop(s, u0)); rows++;      // pretil solo al borde que da hacia abajo (protege de caídas); junto al banco/cerro no va
  }
  for (let r = 0; r < rows - 1; r++) {
    if (!valid[r] || !valid[r + 1]) continue;
    for (let c = 0; c < 3; c++) { const a = r * 4 + c, b = a + 1, c2 = a + 4, d = c2 + 1; idx.push(a, b, c2, b, d, c2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, lam(0x8e7757, { side: THREE.DoubleSide })));
}
berm(-PRET); berm(PRET);      // pretil a cada lado solo donde ese lado cae

(() => { // postes delineadores: sobre el pretil, en el borde que da hacia abajo
  const pts = []; for (let s = 6; s < L; s += 24) for (const u of [-PRET, PRET]) if (isDrop(s, u) && !inGap(s, u)) pts.push([s, u]);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 1.7, 0.25), bas(0xffc400), pts.length);
  const d = new THREE.Object3D();
  pts.forEach(([s, u], i) => { const f = frame(s), x = f.x + f.rx * u, z = f.z + f.rz * u; d.position.set(x, H(x, z) + 1.5, z); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
  scene.add(im);
})();


(() => { // dos postes rojos con franja blanca con franjas y base negra, cable en leve catenaria y banderas a cuadros
  const red = lam(0xe0401a), wh = lam(0xf4f4f4), dk = lam(0x1d1f22);
  const cc = document.createElement('canvas'); cc.width = 64; cc.height = 48; const cx = cc.getContext('2d');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { cx.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5'; cx.fillRect(i * 16, j * 16, 16, 16); }
  const flagMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), side: THREE.DoubleSide });
  const f = frame(L);
  for (const side of [-1, 1]) {
    const u = side * 14, x = f.x + f.rx * u, z = f.z + f.rz * u, g = new THREE.Group();
    cyl(g, 1.7, 1.7, 0.5, dk, 0, 0.25, 0);                      // base negra
    cyl(g, 1.4, 1.4, 0.08, lam(0xcfe6b8), 0, 0.54, 0);          // tapa clara
    for (let y = 1.8; y < 12.6; y += 1.2) box(g, 0.4, 1.2, 0.4, (Math.floor((y - 1.8) / 1.2) % 2) ? wh : red, 0, y + 0.6, 0);   // poste con franjas rojas y blancas
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), flagMat); fl.position.set(-side * 1.2, 9.6, 0.3); g.add(fl);
    g.position.set(x, H(x, z), z); g.rotation.y = Math.atan2(-f.rz, f.rx); scene.add(g);
  }
  // cable izquierdo: sale del piso y sube hasta la punta del poste; el derecho baja desde la punta hasta el piso del rajo
  const pt = (u, dd) => { const x = f.x + f.rx * u + f.tx * dd, z = f.z + f.rz * u + f.tz * dd; return { x, y: H(x, z), z }; };
  const V = (q, dy) => new THREE.Vector3(q.x, q.y + dy, q.z);
  const tL = pt(-14, 0), tR = pt(14, 0);
  const topL = V(tL, 12.0), topR = V(tR, 12.0);
  const gL = pt(-27, -6), gR = pt(27, -6);
  for (const dy of [0, -1.0]) {
    const left = [V(pt(-32, -10), 0.2 + dy), V(pt(-26, -7), 0.2 + dy), V(pt(-20, -3), 0.5 + dy), V(pt(-16, -1), 6 + dy), topL];      // viene por el piso y sube a la bandera
    for (const pts of [left]) scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.06, 6, false), red));
  }
  for (const dy of [0, -1.0]) {      // tramo entre las dos puntas, con leve catenaria como en la foto
    const span = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const q = topL.clone().lerp(topR, t); q.y += dy - 0.7 * (1 - Math.pow(2 * t - 1, 2)); span.push(q); }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(span), 48, 0.06, 6, false), red));
  }
})();

(() => { // señalética de distancia cada 200 m desde el inicio (0, 200, 400...), a ambos lados del camino, de cara a la pista
  const post = lam(0x2f2c29), endS = L + 205;      // mismo fin que END_S (esa constante se define más abajo)
  const mkTex = t => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#f5f5f5'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#1b1b18'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 118);
    x.fillStyle = '#1b1b18'; x.font = '800 74px Arial Narrow, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 128, 66);
    return new THREE.CanvasTexture(c); };
  for (let d = 0; START_S + d <= endS; d += 200) {
    const f = frame(START_S + d), tex = mkTex(d + ' m');
    for (const side of [-1, 1]) {
      const u = side * 13.8, x = f.x + f.rx * u, z = f.z + f.rz * u, g = new THREE.Group();      // en el hombro plano del camino (no dentro de la pared)
      box(g, 0.2, 3.2, 0.2, post, 0, 1.6, 0);                                                    // poste
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.0), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      plate.position.set(0, 3.9, 0.12); g.add(plate);
      g.position.set(x, H(x, z), z);
      g.rotation.y = side < 0 ? Math.atan2(f.rx, f.rz) : Math.atan2(-f.rx, -f.rz);            // cara hacia el centro del camino
      scene.add(g);
    }
  }
})();
(() => { // cartel: zona de caída de rocas (antes de la zona, a la izquierda del camino, mirando a quien sube)
  const g = new THREE.Group(), f = frame(ZONE_S - 55), post = lam(0x2f2c29);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#f2b800'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#1b1b18'; x.lineWidth = 14; x.strokeRect(7, 7, 498, 242);
  x.fillStyle = '#1b1b18'; x.beginPath(); x.moveTo(78, 52); x.lineTo(138, 160); x.lineTo(18, 160); x.closePath(); x.fill();           // triángulo de peligro
  x.fillStyle = '#f2b800'; x.beginPath(); x.moveTo(78, 76); x.lineTo(118, 148); x.lineTo(38, 148); x.closePath(); x.fill();
  x.fillStyle = '#1b1b18'; for (const [cx, cy, r] of [[66, 104, 9], [90, 120, 11], [74, 138, 8]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }   // rocas cayendo
  x.fillStyle = '#1b1b18'; x.font = '800 54px Arial Narrow, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('ZONA DE CAÍDA', 322, 96); x.fillText('DE ROCAS', 322, 160);
  x.font = '700 30px Arial, sans-serif'; x.fillText('ESQUIVA POR EL ZIGZAG', 322, 214);
  box(g, 0.35, 6.4, 0.35, post, -3.6, 3.2, 0); box(g, 0.35, 6.4, 0.35, post, 3.6, 3.2, 0);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
  sign.position.set(0, 7.4, 0); g.add(sign);
  const gx = f.x + f.rx * -21, gz = f.z + f.rz * -21; g.position.set(gx, H(gx, gz), gz);
  g.rotation.y = Math.atan2(-f.rz, f.rx); scene.add(g);
})();

let radarHead = null;   // cabeza giratoria del radar: se mueve de izquierda a derecha en el bucle
(() => { // radar de monitoreo tipo GroundProbe en la bahía de la derecha, antes de la caída de rocas, y 3 conos lima limón
  if (!RAD) return;      // eliminado: radar, caseta, torre de telecomunicaciones y conos
  const f = frame(RAD.s), white = lam(0xf1f3f4), grey = lam(0x8b939a), dark = lam(0x22272b), lime = lam(0xbfff00);
  // franja de grava de la bahía, desde el borde del camino hasta el talud
  const pos = [], idx = [], n = Math.floor((2 * RAD.hl) / 2) + 1;
  for (let r = 0; r < n; r++) {
    const g = frame(RADG.a + r * 2);
    for (const u0 of [WR - 2.7, WR + RAD.D - 1]) { const u = u0 * RAD.side, x = g.x + g.rx * u, z = g.z + g.rz * u; pos.push(x, H(x, z) + 0.15, z); }
  }
  for (let r = 0; r < n - 1; r++) { const a = r * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
  scene.add(new THREE.Mesh(gg, lam(0x9a8560, { side: THREE.DoubleSide })));
  // tres conos lima limón siguiendo la curva, a la entrada de la bahía
  const cone = (s, u) => {
    const g = frame(s), x = g.x + g.rx * u, z = g.z + g.rz * u, c = new THREE.Group();
    cyl(c, 0.32, 0.32, 0.06, dark, 0, 0.03, 0);
    cyl(c, 0.06, 0.24, 0.9, lime, 0, 0.51, 0);
    cyl(c, 0.176, 0.176, 0.12, white, 0, 0.42, 0);
    cyl(c, 0.12, 0.12, 0.12, white, 0, 0.7, 0);
    c.position.set(x, H(x, z) + 0.02, z); scene.add(c);
  };
  for (const s of [RAD.s - 17, RAD.s + 7, RAD.s + 31]) cone(s, PRET * RAD.side);      // en la línea de los postes amarillos, entre dos postes
  // radar: remolque con cabina, mástil y antena parabólica blanca
  const rg = new THREE.Group();
  box(rg, 2.0, 0.35, 3.6, grey, 0, 0.75, 0);
  box(rg, 1.8, 1.0, 2.2, white, 0, 1.75, -0.4);
  box(rg, 0.25, 0.25, 1.4, grey, 0, 0.9, 2.5);
  for (const x of [-1.05, 1.05]) for (const z of [-1.2, 0.9]) cyl(rg, 0.5, 0.5, 0.36, dark, x, 0.5, z, Math.PI / 2);
  cyl(rg, 0.12, 0.12, 1.1, grey, 0, 2.8, -0.2);
  radarHead = new THREE.Group(); radarHead.position.set(0, 3.3, -0.2); radarHead.rotation.x = 0.85; rg.add(radarHead);      // inclinada ~49° hacia abajo: mira las paredes del rajo que tiene al frente
  // la cara que mira al rajo (tapa superior, +z) es gris oscuro; la de atrás, blanca: así se ve hacia dónde apunta
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 36), [white, dark, white]); dish.rotation.x = Math.PI / 2; radarHead.add(dish);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 8, 40), grey); rim.position.z = 0.06; radarHead.add(rim);
  box(radarHead, 2.3, 0.05, 0.05, grey, 0, 0, 0.1); box(radarHead, 0.05, 2.3, 0.05, grey, 0, 0, 0.1);
  box(radarHead, 0.28, 0.28, 0.9, grey, 0, 0, 0.6);
  const rx = f.x + f.rx * RAD.u, rz = f.z + f.rz * RAD.u;
  rg.position.set(rx, H(rx, rz), rz); rg.rotation.y = Math.atan2(-rx, -rz) + Math.PI; scene.add(rg);
  // torre de telecomunicaciones de 54 m (celosía roja y blanca con plataforma y paneles), en la misma bahía, a un costado del radar
  const tw = new THREE.Group(), red = lam(0xd62828), wh = lam(0xf4f4f4), steel = lam(0x8d959c);
  const TH = 54, LV = 18, LH = TH / LV;      // 18 niveles de 3 m
  const wAt = y => 6 - 4.4 * (y / TH);       // ancho: 6 m en la base, 1,6 m en la cima
  const beam = (a, b, r, m) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
    me.position.copy(a).add(b).multiplyScalar(0.5);
    me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    tw.add(me);
  };
  const corners = y => { const h = wAt(y) / 2; return [[h, h], [-h, h], [-h, -h], [h, -h]].map(([x, z]) => new THREE.Vector3(x, y, z)); };
  for (let i = 0; i < LV; i++) {
    const y0 = i * LH, y1 = y0 + LH, m = i % 2 ? wh : red, c0 = corners(y0), c1 = corners(y1);
    for (let c = 0; c < 4; c++) {
      beam(c0[c], c1[c], 0.09, m);                 // patas
      beam(c0[c], c0[(c + 1) % 4], 0.05, steel);   // travesaños del nivel
      beam(c0[c], c1[(c + 1) % 4], 0.05, m);       // diagonal de cada cara
    }
  }
  const top = corners(TH);
  for (let c = 0; c < 4; c++) beam(top[c], top[(c + 1) % 4], 0.05, steel);
  box(tw, 2.4, 0.15, 2.4, steel, 0, TH + 0.1, 0);                          // plataforma de la cima
  cyl(tw, 0.04, 0.04, 1.5, steel, 0, TH + 0.85, 0);                        // mástil
  box(tw, 0.06, 2.2, 1.8, steel, 0, TH - 1.2, 0.95); box(tw, 0.06, 2.2, 1.8, steel, 0, TH - 1.2, -0.95);   // paneles
  const tf = frame(RAD.s + 10), tX = tf.x + tf.rx * (RAD.side * 26.5), tZ = tf.z + tf.rz * (RAD.side * 26.5);
  tw.position.set(tX, H(tX, tZ), tZ); tw.rotation.y = Math.atan2(-tf.rz, tf.rx); scene.add(tw);
  // caseta de control, valla amarilla, conos y letrero, como en el área de radar de la foto
  const cs = f, cux = f.x + f.tx * (-12) + f.rx * (-21.5), cuz = f.z + f.tz * (-12) + f.rz * (-21.5);      // 12 m detrás del radar, un poco más cerca del camino
  const caseta = new THREE.Group(), vidrio = lam(0x3c5a6e);
  box(caseta, 2.4, 2.2, 2.4, white, 0, 1.1, 0);
  box(caseta, 1.7, 0.9, 0.06, vidrio, 0, 1.4, 1.22);
  box(caseta, 2.6, 0.12, 2.6, grey, 0, 2.26, 0);
  caseta.position.set(cux, H(cux, cuz), cuz); caseta.rotation.y = Math.atan2(-cs.rz, cs.rx); scene.add(caseta);
  const vs = frame(RAD.s - 4), vx = vs.x + vs.rx * (-30.8), vz = vs.z + vs.rz * (-30.8);
  const valla = new THREE.Group(), yel = lam(0xf2b800);
  for (let z = -6; z <= 6; z += 2) box(valla, 0.1, 1.1, 0.1, yel, 0, 0.55, z);
  box(valla, 0.08, 0.08, 12, yel, 0, 0.6, 0); box(valla, 0.08, 0.08, 12, yel, 0, 1.0, 0);
  valla.position.set(vx, H(vx, vz), vz); valla.rotation.y = Math.atan2(-vs.rz, vs.rx); scene.add(valla);
  cone(RAD.s + 6, -26); cone(RAD.s - 6, -26.5); cone(RAD.s + 14, -17);
})();

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
let free = null, GATE = null, CABLE = null, CABLE2 = null, DRILL3B = null;      // GATE: entrada a la Rampa Sur desde la fase 7, entre dos postes pasacables (cable de la pala 3 por arriba)      // tránsito libre por la fase 7 antes de tomar la Rampa Sur: { x, z, a }
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
/* ───────────── Explanada: palas de cable cargando camiones; de vez en cuando uno sale al camino ───────────── */
const SHOV_T = 7.2, SHOV_AL = -20, SPOT_AL = [SHOV_AL - 24, SHOV_AL + 24], SHOV_LA = WR + 17, ARR_LA = WR + 2; let SPOT_LA = WR + 13;      // SPOT_AL / SPOT_LA se ajustan al alcance real del balde al armar la explanada      // la pala, metida en el frente de la derecha; los camiones cargan a su izquierda y a su derecha (llegan por la orilla del camino)
const plat = { shov: [], loaders: [], merging: false, nid: 220, cool: [0, 0] };
let capNum = 100;      // numeración de CAEX: siempre del 101 al 173
const nextCaexId = () => { capNum = capNum >= 173 ? 101 : capNum + 1; return capNum; };
const _pl = (al, la) => { const f = frame(PLAT.se + al); return { x: f.x + f.rx * PLAT.side * la, z: f.z + f.rz * PLAT.side * la, tx: f.tx, tz: f.tz, nx: f.rx * PLAT.side, nz: f.rz * PLAT.side }; };
function setWorldPose(mesh, x, z, dx, dz) {
  const y = H(x, z) + 0.1; mesh.position.set(x, y, z);
  const sl = (H(x + dx * 3, z + dz * 3) - H(x - dx * 3, z - dz * 3)) / 6;
  _look.set(x + dx, y + sl, z + dz); mesh.lookAt(_look);
}
function bezAt(b, t) {
  const m = 1 - t, a = m * m * m, c = 3 * m * m * t, d = 3 * m * t * t, e = t * t * t;
  return { x: a * b[0].x + c * b[1].x + d * b[2].x + e * b[3].x, z: a * b[0].z + c * b[1].z + d * b[2].z + e * b[3].z };
}
function worldToSU(x, z, sh) {
  let bs = sh, bd = 1e9;
  for (let s = sh - 25; s <= sh + 40; s += 1) { const f = frame(s), d = (f.x - x) ** 2 + (f.z - z) ** 2; if (d < bd) { bd = d; bs = s; } }
  const f = frame(bs); return { s: bs, u: (x - f.x) * f.rx + (z - f.z) * f.rz };
}
function mkLoaderTruck(al, spot) {
  const mesh = protoOnc.clone(true), b = mesh.getObjectByName('beacon'); b.material = b.material.clone();
  const pile = makePile(); pile.scale.y = 0.05; mesh.add(pile);
  const num = nextCaexId(); addPlates(mesh, num, CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s); scene.add(mesh);
  return { mesh, pile, beacon: b, al, la: ARR_LA, spot, num, state: 'arrive', fill: 0, wait: 0 };
}
const zpt = (s, u) => { const f = frame(s); return { x: f.x + f.rx * u, z: f.z + f.rz * u, f }; };
function addHoles(list) {      // pozos de tronadura (instanciados): boca negra con su montón de detritus
  const d = new THREE.Object3D(), hole = new THREE.InstancedMesh(new THREE.CircleGeometry(0.55, 12), lam(0x121212), list.length), cut = new THREE.InstancedMesh(new THREE.ConeGeometry(1.3, 0.45, 10), lam(0x9b9486), list.length);
  list.forEach((p, i) => {
    const y = H(p.x, p.z);
    d.position.set(p.x, y + 0.2, p.z); d.rotation.set(0, 0, 0); d.updateMatrix(); cut.setMatrixAt(i, d.matrix);
    d.position.set(p.x, y + 0.46, p.z); d.rotation.set(-Math.PI / 2, 0, 0); d.updateMatrix(); hole.setMatrixAt(i, d.matrix);
  });
  scene.add(cut); scene.add(hole);
}
function placeDrill(x, z, yaw, pre) { OBST.push({ x, z, r: 6 }); const dr = buildDrill(pre, nextDrillNum()); dr.position.set(x, H(x, z) + 0.1, z); dr.rotation.y = yaw; scene.add(dr); }
function pattern(pt, s0, s1, u0, u1, drills, skip) {      // malla escalonada 9 × 9 m (burden y espaciamiento típicos para bancos de 16 m)
  const out = [], st = u1 > u0 ? 9 : -9;
  for (let a = s0, row = 0; a <= s1; a += 9, row++) for (let b = u0 + (row % 2 ? st / 2 : 0); st > 0 ? b <= u1 : b >= u1; b += st) {
    if (drills.some(([da, db]) => Math.hypot(da - a, db - b) < 7) || (skip && skip(a, b))) continue;
    const p = pt(a + (hash(a, b) - 0.5) * 0.8, b + (hash(b, a) - 0.5) * 0.8); if (p) out.push(p);
  }
  return out;
}
function buildDrills() {
  const gd = (x, z) => { const fx = Math.round((x - GX0) / CELL), fz = Math.round((z - GZ0) / CELL); return (fx < 0 || fz < 0 || fx >= GNX || fz >= GNZ) ? 99 : GD[fz * GNX + fx]; };
  const flat = (x, z) => { if (gd(x, z) !== -1 || OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 12)) return false; for (let a = 0; a < 8; a++) if (gd(x + Math.cos(a * 0.785) * 10, z + Math.sin(a * 0.785) * 10) !== -1) return false; return true; };
  const snap = (x, z) => { for (let r = 0; r <= 120; r += 3) for (let a = 0; a < 24; a++) { const q = { x: x + Math.cos(a * TAU / 24) * r, z: z + Math.sin(a * TAU / 24) * r }; if (flat(q.x, q.z)) return q; } return { x, z }; };      // piso plano más cercano (nunca en la cara de un banco)
  // fase 7: tres canchas de perforación (malla 9 × 9 m) con su perforadora en el borde; en la del centro también la de orugas
  { const holes = [], dr = F7EQ.canchas.flatMap(C => [C.dr, C.crawler].filter(Boolean)), B = 8, S = 9.2;      // malla tresbolillo 8 × 9,2 m (burden × espaciamiento, S ≈ 1,15 B, pozos de 10⅝–12¼" en banco de 16 m), filas paralelas al eje largo de la cancha y primera fila a un burden de la cresta
    for (const f of RED52) { const P = f.P, n = P.length, cx = P.reduce((s, p) => s + p[0], 0) / n, cz = P.reduce((s, p) => s + p[1], 0) / n;
      let sxx = 0, sxz = 0, szz = 0; for (const p of P) { const dx = p[0] - cx, dz = p[1] - cz; sxx += dx * dx; sxz += dx * dz; szz += dz * dz; }
      const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(th), uz = Math.sin(th), vx = -uz, vz = ux;      // eje principal de la cancha
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of P) { const a = (p[0] - cx) * ux + (p[1] - cz) * uz, b = (p[0] - cx) * vx + (p[1] - cz) * vz; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
      for (let b = b0, row = 0; b <= b1; b += B, row++) for (let a = a0 + (row % 2) * S / 2; a <= a1; a += S) { const px = cx + ux * a + vx * b + (hash(a, b) - 0.5) * 0.6, pz = cz + uz * a + vz * b + (hash(b, a) - 0.5) * 0.6;
        if (f(px, pz) > -B || gd(px, pz) !== -1 || Math.abs(H(px, pz) - f7h(px, pz) - PAD_UP) > 0.6 || dr.some(q => Math.hypot(q.x - px, q.z - pz) < 8)) continue; holes.push({ x: px, z: pz }); } }
    addHoles(holes); }
  for (const C of F7EQ.canchas) {
    placeDrill(C.dr.x, C.dr.z, hash(C.dr.x, C.dr.z) * 6.28, false);
    if (C.crawler) { const q = C.crawler; OBST.push({ x: q.x, z: q.z, r: 6 }); const cd = buildCrawlerDrill(nextDrillNum()); cd.position.set(q.x, H(q.x, q.z), q.z); cd.rotation.y = 0.6; scene.add(cd); }
  }
}
const LZ = [], DOZ = [];
const TOLVA_C = 2.2;      // centro de la tolva: 2,2 m detrás del origen del camión (camión escalado)
function mkLoadZone(x, z, fx, fz, num, phOff) {      // pala de cables cargando en su pila con un camión a cada lado (alterna)
  OBST.push({ x, z, r: 10 }); const sv = buildShovel(num); sv.g.position.set(x, H(x, z), z); sv.g.rotation.y = Math.atan2(fx, fz); scene.add(sv.g); sv.swing = 1;
  const tx = fz, tz = -fx, L = { sv, trucks: [], last: 0, off: phOff };
  dumpTune(sv, H);
  for (const k of [0, 1]) {      // cada camión con el centro de su tolva bajo el balde (k = 0: lado al que gira con swing 1)
    sv.swing = k ? -1 : 1; shovelPose(sv, 4.0); sv.g.updateMatrixWorld(true); const bp = sv.bucket.getWorldPosition(new THREE.Vector3());
    const qx = bp.x - fx * TOLVA_C, qz = bp.z - fz * TOLVA_C, mesh = protoOnc.clone(true), pile = makePile(); mesh.add(pile);
    addPlates(mesh, nextCaexId(), CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s); scene.add(mesh); setWorldPose(mesh, qx, qz, -fx, -fz); OBST.push({ x: qx, z: qz, r: 8 });      // de cola a la pila
    const fill = k ? 0.6 : 0.2; pile.scale.y = 0.05 + 0.95 * fill; L.trucks.push({ pile, fill });
  }
  LZ.push(L);
}
function rockScatter(fn, n, seed) {
  const rm = [lam(0x6e5c49), lam(0x8a7660), lam(0x574a3b)];
  for (let i = 0; i < n; i++) { const q = fn(hash(i, seed), hash(i, seed + 1)); if (!q) continue; const sc = 0.5 + hash(i, seed + 2) * 1.1, m = new THREE.Mesh(rockGeo, rm[i % 3]);
    m.scale.set(sc, sc * 0.7, sc); m.position.set(q.x, H(q.x, q.z) + sc * 0.2, q.z); m.rotation.set(hash(i, 4) * 3, hash(i, 5) * 3, hash(i, 6) * 3); scene.add(m); }
}
function addDozer(x, z, fx, fz, ph, track) { OBST.push({ x: x + fx * 8, z: z + fz * 8, r: 15 }); const g = track ? buildTrackDozer() : buildWheelDozer(); scene.add(g); DOZ.push({ g, x, z, fx, fz, tx: -fz, tz: fx, ph }); }      // trabaja en un paño de ~16 × 26 m hacia adelante
function workSite(S, ux, uz, h0, sides) {      // lugar plano para el wheel dozer, fuera del radio de giro de la pala (≥ 36 m) y lejos de otros equipos
  const tx = -uz, tz = ux, ok = (x, z) => Math.abs(H(x, z) - h0) < 0.7 && !OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 3);
  for (const d of [42, 46, 38, 50, 54, 36, 58, 32, 28]) for (const sg of sides) for (const uo of [0, 4, -4, 8, -8, -14, -20, -28, -36, -44]) {      // también más atrás de la pala si al costado no hay piso
    if (Math.hypot(d, uo) < 36) continue;
    const bx = S.x + tx * sg * d + ux * uo, bz = S.z + tz * sg * d + uz * uo; let good = true;
    for (let al = -5; al <= 20 && good; al += 5) for (let la = -10; la <= 10 && good; la += 5) if (!ok(bx + ux * al + tx * la, bz + uz * al + tz * la)) good = false;
    if (good) return { x: bx, z: bz, sg };
  }
  return null;
}
let HYD = null;
function animOps(dt) {
  if (HYD) {      // pala hidráulica frontal: cava en la pila, levanta, gira 90° al camión de su costado, descarga sobre la tolva y vuelve (ciclo ~22 s; 4 pases llenan el camión)
    const Q = HYD, T = 22, ph = (tAnim + 3) % T, was = Q.prev || 0; Q.prev = ph;
    const G = -Math.PI / 2, K = [[0, 0, 8.0, -5.0, 0], [4, 0, 10.0, -2.5, 0.5], [7, 0, 10.0, 3.5, 0.6], [11, G, 10.6, 3.3, 0.6], [12.5, G, 10.6, 3.3, -0.9], [15, G, 10.6, 3.3, -0.9], [19, 0, 9.0, 1.0, 0], [22, 0, 8.0, -5.0, 0]];
    let k = 0; while (k < K.length - 2 && ph >= K[k + 1][0]) k++; const A = K[k], B = K[k + 1], s = sm01((ph - A[0]) / (B[0] - A[0]));
    hydPose(Q.S, A[1] + (B[1] - A[1]) * s, A[2] + (B[2] - A[2]) * s, A[3] + (B[3] - A[3]) * s, A[4] + (B[4] - A[4]) * s);
    Q.S.load.visible = ph > 3 && ph < 14;
    if (was < 14 && ph >= 14) { Q.fill += 0.25; if (Q.fill > 1.01) Q.fill = 0.05; }
    Q.pile.scale.y += ((0.05 + 0.95 * Math.min(1, Q.fill)) - Q.pile.scale.y) * Math.min(1, dt * 3);
  }
  for (const L of LZ) {
    const sv = L.sv, ph = (tAnim + L.off) % SHOV_T, was = sv.prev || 0; sv.prev = ph;
    if (was > ph) { L.last = 1 - L.last; sv.swing = L.last ? 1 : -1; }      // alterna entre los dos camiones
    if (was < 4.1 && ph >= 4.1) { const t = L.trucks[sv.swing > 0 ? 0 : 1]; t.fill += 0.2; if (t.fill > 1.01) t.fill = 0.05; }      // lleno: sale y llega otro vacío
    shovelPose(sv, ph);
    for (const t of L.trucks) t.pile.scale.y += ((0.05 + 0.95 * Math.min(1, t.fill)) - t.pile.scale.y) * Math.min(1, dt * 3);
  }
  for (const D of DOZ) {      // el dozer ordena el banco: empuja hacia la pila (o el frente), retrocede y se corre a la pasada siguiente
    const PER = 11, LN = [-6, 0, 6, 0], t = (tAnim + D.ph * 7) % (PER * 4), k = Math.floor(t / PER), q = (t % PER) / PER, l0 = LN[k], l1 = LN[(k + 1) % 4];
    let al, la, fx = D.fx, fz = D.fz;
    if (q < 0.55) { al = 14 * sm01(q / 0.55); la = l0; }
    else { const r = (q - 0.55) / 0.45, w = Math.sin(Math.PI * r) * (l1 - l0) * 0.12; al = 14 * (1 - sm01(r)); la = l0 + (l1 - l0) * sm01(r); fx = D.fx - D.tx * w; fz = D.fz - D.tz * w; const n = Math.hypot(fx, fz); fx /= n; fz /= n; }
    let X = D.x + D.fx * al + D.tx * la, Z = D.z + D.fz * al + D.tz * la;
    if (D.p3) {      // pala 3: si no hay camión a su derecha (o el que viene está lejos), empuja material hasta cerca del balde y vuelve antes que llegue el siguiente
      const C = D.p3, lt = plat.loaders.find(l => l.spot === 0), free = !lt || (lt.state === 'arrive' && lt.al < SPOT_AL[0] - 30), e0 = C.e;
      C.e = Math.max(0, Math.min(1, C.e + (free ? dt / 10 : -dt / 7)));
      if (C.e > 0) { const s = sm01(C.e), tx = C.T.x - X, tz = C.T.z - Z, tn = Math.hypot(tx, tz) || 1; X += tx * s; Z += tz * s; fx = fx * (1 - s) + tx / tn * s; fz = fz * (1 - s) + tz / tn * s; const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n; }
      C.load.visible = C.e > e0 && C.e < 0.98;      // con material en la hoja mientras va hacia la pala
    }
    setWorldPose(D.g, X, Z, fx, fz);
  }
}
function floorPath(S, T) {      // huellas: camino más corto por el piso (o calzada) entre S y T, manteniéndose ~15 m lejos de paredes, pilas, canchas y equipos
  const pad = 260, i0 = Math.max(1, Math.floor((Math.min(S.x, T.x) - pad - GX0) / CELL)), i1 = Math.min(GNX - 2, Math.ceil((Math.max(S.x, T.x) + pad - GX0) / CELL)), j0 = Math.max(1, Math.floor((Math.min(S.z, T.z) - pad - GZ0) / CELL)), j1 = Math.min(GNZ - 2, Math.ceil((Math.max(S.z, T.z) + pad - GZ0) / CELL));
  const W = i1 - i0 + 1, Hh = j1 - j0 + 1, N = W * Hh, pass = new Uint8Array(N), cost = new Float32Array(N);
  const blk = OBST.filter(o => o.r >= 6);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const g = GD[(j + j0) * GNX + i + i0]; pass[j * W + i] = (g === -1 || (g >= 0 && g <= WR + 2)) ? 1 : 0; }
  for (const o of blk) { const r = o.r + 6, ci = Math.round((o.x - GX0) / CELL) - i0, cj = Math.round((o.z - GZ0) / CELL) - j0, n = Math.ceil(r / CELL); for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= W || j >= Hh || Math.hypot(di, dj) * CELL > r) continue; pass[j * W + i] = 0; } }
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { if (!pass[j * W + i]) continue; let n = 0; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= Hh || !pass[b * W + a]) n++; } cost[j * W + i] = 1 + 0.5 * n; }
  const ci = p => (Math.max(0, Math.min(Hh - 1, Math.round((p.z - GZ0) / CELL) - j0))) * W + Math.max(0, Math.min(W - 1, Math.round((p.x - GX0) / CELL) - i0));
  const s = ci(S), t = ci(T); pass[s] = pass[t] = 1; if (!cost[s]) cost[s] = 1; if (!cost[t]) cost[t] = 1;
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), hp = [], hv = [];
  const push = (i, f) => { hp.push(i); hv.push(f); let k = hp.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (hv[q] <= hv[k]) break; [hp[q], hp[k]] = [hp[k], hp[q]]; [hv[q], hv[k]] = [hv[k], hv[q]]; k = q; } };
  const pop = () => { const top = hp[0], li = hp.pop(), lv = hv.pop(); if (hp.length) { hp[0] = li; hv[0] = lv; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hp.length && hv[l] < hv[m]) m = l; if (r < hp.length && hv[r] < hv[m]) m = r; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; [hv[m], hv[k]] = [hv[k], hv[m]]; k = m; } } return top; };
  g[s] = 0; push(s, 0);
  while (hp.length) { const i = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break; const x = i % W, z = (i / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const a = x + di, b = z + dj; if (a < 0 || b < 0 || a >= W || b >= Hh) continue; const k = b * W + a; if (!pass[k] || done[k]) continue; const nv = g[i] + cost[k] * Math.hypot(di, dj); if (nv < g[k]) { g[k] = nv; from[k] = i; push(k, nv); } } }
  if (from[t] < 0 && t !== s) return null;
  const out = []; for (let i = t; i >= 0; i = from[i]) { out.push({ x: GX0 + (i % W + i0) * CELL, z: GZ0 + ((i / W | 0) + j0) * CELL }); if (i === s) break; }
  out.reverse(); const keep = [out[0]]; for (let k = 1; k < out.length - 1; k += 3) keep.push(out[k]); keep.push(out[out.length - 1]); return keep;
}
function drawTracks(pts) {      // huellas de camión: dos surcos oscuros (ruedas) siguiendo una curva suave por el piso
  if (!pts || pts.length < 2) return;
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, 0, p.z))); c.curveType = 'centripetal'; const N = Math.max(24, Math.round(c.getLength() / 3));
  for (const off of [-1.7, 1.7]) { const pos = []; for (let k = 0; k <= N; k++) { const p = c.getPoint(k / N), t = c.getTangent(k / N), nx = -t.z, nz = t.x, y = H(p.x, p.z) + 0.06; pos.push(p.x + nx * (off - 0.45), y, p.z + nz * (off - 0.45), p.x + nx * (off + 0.45), y, p.z + nz * (off + 0.45)); }
    const g = new THREE.BufferGeometry(), idx = []; for (let k = 0; k < N; k++) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x2c2a27, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }))); }
}
function buildOps() {
  {      // fase 7: pala hidráulica PC9000 junto a la pala 6, cargando un camión a la vez a su costado
    const Q = F7EQ.pc, tx = -Q.fz, tz = Q.fx, S = buildHydShovel('4'); S.g.position.set(Q.x, H(Q.x, Q.z), Q.z); S.g.rotation.y = Math.atan2(Q.fx, Q.fz); scene.add(S.g); OBST.push({ x: Q.x, z: Q.z, r: 9 });
    const t = { x: Q.x - Q.fx * 2.2 + tx * 14, z: Q.z - Q.fz * 2.2 + tz * 14 }, mesh = protoOnc.clone(true), pile = makePile(); mesh.add(pile); addPlates(mesh, nextCaexId(), CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s); scene.add(mesh); setWorldPose(mesh, t.x, t.z, -Q.fx, -Q.fz); OBST.push({ x: t.x, z: t.z, r: 8 });
    HYD = { S, pile, fill: 0.3, prev: 0 }; hydPose(S, 0, 8.0, -5.0, 0);
  }
  {      // fondo mina (180 × 100 m): dos palas de cables cargando en sus pilas, dos canchas de perforación, un dozer y huellas de camiones
    const P = PIT, W = (a, b) => ({ x: P.x + P.ux * a * 1.5 + P.tx * b * 1.5, z: P.z + P.uz * a * 1.5 + P.tz * b * 1.5 }), inF = (a, b) => [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([da, db]) => { const q = W(a + da / 1.5, b + db / 1.5); return gdAt(q.x, q.z) === -1 && Math.abs(H(q.x, q.z) - FLOOR - PAD_UP) < 0.3; });      // sobre la cancha y a un burden de la cresta
    { const q = W(-112, 0); PIT.p1 = { x: q.x, z: q.z, fx: -P.ux, fz: -P.uz }; mkLoadZone(q.x, q.z, -P.ux, -P.uz, '1', 4.6); }
    { const q = W(40, 60); PIT.p5 = { x: q.x, z: q.z, fx: P.tx, fz: P.tz }; mkLoadZone(q.x, q.z, P.tx, P.tz, '5', 1.2); }      // pala 5 al pie de su pila (21 m del centro de la bahía)
    const cancha = (a0, a1, b0, b1, dr) => { const holes = []; for (let a = a0, row = 0; a <= a1; a += 8 / 1.5, row++) for (let b = b0 + (row % 2) * 4.6 / 1.5; b <= b1; b += 9.2 / 1.5) { if (!inF(a, b) || Math.hypot(a - dr[0], b - dr[1]) < 7) continue; holes.push(W(a + (hash(a, b) - 0.5) * 0.5, b + (hash(b, a) - 0.5) * 0.5)); } addHoles(holes); };      // malla tresbolillo 8 × 9,2 m (las coordenadas a, b van a escala 1,5)
    cancha(-40, 30, -100, -40, [0, -70]); { const q = W(0, -70); placeDrill(q.x, q.z, Math.atan2(P.ux, P.uz) + 0.4, false); }
    cancha(-95, -45, 40, 95, [-70, 70]); { const q = W(-70, 70); placeDrill(q.x, q.z, Math.atan2(-P.tx, -P.tz) - 0.3, false); }
    rockScatter((a, b) => { const an = a * 6.28, r = 0.8 + b * 0.3, ca = -140 + Math.cos(an) * 10 * r, cb = Math.sin(an) * 24 * r; return W(ca, cb); }, 50, 41);
    rockScatter((a, b) => { const an = a * 6.28, r = 0.8 + b * 0.3, ca = 40 + Math.sin(an) * 22 * r, cb = 78 + Math.cos(an) * 9 * r; return W(ca, cb); }, 40, 43);
  }
  for (const Q of F7EQ.palas) { mkLoadZone(Q.x, Q.z, Q.fx, Q.fz, Q.num, Q.off);      // fase 7: palas de cables en sus pilas
    rockScatter((a, b) => { const an = a * 6.28, r = 0.8 + b * 0.3, ca = 34 + Math.cos(an) * 17 * r, cb = Math.sin(an) * 40 * r; return { x: Q.x + Q.fx * ca - Q.fz * cb, z: Q.z + Q.fz * ca + Q.fx * cb }; }, 50, 61 + Q.num.charCodeAt(0)); }
  if (!P3_MOVED) {
  { const q = _pl(SHOV_AL, SPOT_LA + 2); addDozer(q.x - q.tx * 50, q.z - q.tz * 50, q.nx, q.nz, 5);
    const D = DOZ[DOZ.length - 1], T = _pl(SHOV_AL - 12, SHOV_LA + 5.5), rm = [lam(0x6e5c49), lam(0x8a7660)], ld = new THREE.Group();
    for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(rockGeo, rm[i % 2]), sc = 0.6 + hash(i, 31) * 0.6; r.scale.set(sc, sc * 0.7, sc); r.position.set((hash(i, 32) - 0.5) * 4.6, 0.6 + hash(i, 33) * 0.9, 7.0 + hash(i, 34) * 1.4); ld.add(r); }
    ld.visible = false; D.g.add(ld); D.p3 = { T: { x: T.x, z: T.z }, e: 0, load: ld };
    rockScatter((a, b) => { const an = a * 6.28, r = Math.sqrt(b) * 0.9, ca = 38 + Math.cos(an) * 13 * r, cb = -56 + Math.sin(an) * 22 * r; return { x: q.x + q.nx * (ca - SPOT_LA - 2) + q.tx * cb, z: q.z + q.nz * (ca - SPOT_LA - 2) + q.tz * cb }; }, 45, 57);
    rockScatter((a, b) => { const an = a * 6.28, r = Math.sqrt(b) * 0.9, ca = 47 + Math.cos(an) * 14 * r, cb = -86 + Math.sin(an) * 17 * r; return { x: q.x + q.nx * (ca - SPOT_LA - 2) + q.tx * cb, z: q.z + q.nz * (ca - SPOT_LA - 2) + q.tz * cb }; }, 40, 63); }      // fase 7: wheel dozer de la pala 3, más allá del camión de la izquierda (fuera del giro de la pala y al lado contrario del cable)
  }
  {      // apoyo al carguío: un wheel dozer por pala (en un paño plano al costado, fuera del giro y lejos de los camiones) que ordena el piso, y bulldozers de orugas sobre las pilas tronadas de la fase 7 empujando material hacia la pala
    const WD = F7EQ.palas.map(p => ({ x: p.x, z: p.z, fx: p.fx, fz: p.fz, h: f7h(p.x, p.z) })).concat([{ x: F7EQ.pc.x, z: F7EQ.pc.z, fx: F7EQ.pc.fx, fz: F7EQ.pc.fz, h: f7h(F7EQ.pc.x, F7EQ.pc.z) }, Object.assign({ h: FLOOR }, PIT.p5), Object.assign({ h: FLOOR }, PIT.p1)]);
    WD.forEach((p, k) => { const tmp = []; for (const o of OBST.filter(o => o.r === 8 && Math.hypot(o.x - p.x, o.z - p.z) < 40)) for (let t = 12; t <= 110; t += 12) tmp.push({ x: o.x - p.fx * t, z: o.z - p.fz * t, r: 12 }); OBST.push(...tmp);      // las salidas de los camiones quedan libres
      const q = workSite(p, p.fx, p.fz, p.h, [1, -1]); OBST.splice(OBST.length - tmp.length, tmp.length); if (q) addDozer(q.x, q.z, p.fx, p.fz, 2 + k * 1.7); });
    F7EQ.palas.forEach((p, k) => { const d = 46, la = 8 * (k % 2 ? 1 : -1); addDozer(p.x + p.fx * d - p.fz * la, p.z + p.fz * d + p.fx * la, -p.fx, -p.fz, 5 + k * 2.3, true); });      // sobre la pila, detras de la bahia, mirando a la pala
  }
  {      // huellas de los camiones desde cada pala hasta la salida: en la fase 7 al inicio del camino rojo (que lleva al portón), en el fondo a donde entra la azul
    const T7 = { x: SEC[0][SEC[0].length - 1][0], z: SEC[0][SEC[0].length - 1][1] }, TF = { x: SEC[6][SEC[6].length - 1][0], z: SEC[6][SEC[6].length - 1][1] };
    const palas = F7EQ.palas.map(p => ({ x: p.x, z: p.z, fx: p.fx, fz: p.fz, T: T7 })).concat([{ x: PIT.p5.x, z: PIT.p5.z, fx: PIT.p5.fx, fz: PIT.p5.fz, T: TF }, { x: PIT.x + PIT.ux * -112 * 1.5, z: PIT.z + PIT.uz * -112 * 1.5, fx: -PIT.ux, fz: -PIT.uz, T: TF }]);
    for (const p of palas) for (const o of OBST.filter(o => o.r === 8 && Math.hypot(o.x - p.x, o.z - p.z) < 40)) drawTracks(floorPath({ x: o.x - p.fx * 32, z: o.z - p.fz * 32 }, p.T));      // desde 32 m adelante de cada camión (ya fuera de la pala)
  }
}
function mkPlatform() {
  if (!PLAT) return;
  buildDrills(); buildOps();
  if (!P3_MOVED) { const sv = buildShovel(), p = _pl(SHOV_AL, SHOV_LA);
    sv.g.position.set(p.x, H(p.x, p.z), p.z); sv.g.rotation.y = Math.atan2(p.nx, p.nz); scene.add(sv.g); OBST.push({ x: p.x, z: p.z, r: 10 });
    dumpTune(sv, H);
    {      // cada camión se cuadra con el centro de su tolva justo bajo el balde (donde descarga la pala al girar a ese lado)
      const las = [], fits = [];
      for (const i of [0, 1]) {
        sv.swing = i ? 1 : -1; shovelPose(sv, 4.0); sv.g.updateMatrixWorld(true); const bp = sv.bucket.getWorldPosition(new THREE.Vector3()), tx = bp.x - p.nx * TOLVA_C, tz = bp.z - p.nz * TOLVA_C;
        let best = null; for (let al = SHOV_AL - 45; al <= SHOV_AL + 45; al += 0.5) for (let la = WR; la <= WR + 30; la += 0.5) { const q = _pl(al, la), d = (q.x - tx) ** 2 + (q.z - tz) ** 2; if (!best || d < best.d) best = { al, la, d }; }
        fits.push({ al: best.al, la: best.la, sw: sv.swing });
      }
      fits.sort((a, b) => a.al - b.al);      // el puesto 0 es el del lado del wheel dozer (al menor)
      fits.forEach((q, i) => { SPOT_AL[i] = q.al; });
      SPOT_LA = (fits[0].la + fits[1].la) / 2; sv.swingFor = fits.map(q => q.sw); sv.swing = 1; shovelPose(sv, 0);
    }
    for (const al of SPOT_AL) { const q = _pl(al, SPOT_LA); OBST.push({ x: q.x, z: q.z, r: 8 }); }
    plat.shov.push(Object.assign(sv, { al: SHOV_AL, off: 0, prev: 0, swing: 1, last: 0 })); }
  if (!P3_MOVED) { const rm = [lam(0x6e5c49), lam(0x8a7660), lam(0x574a3b)];      // roca tronada al pie del frente, delante de la pala
    for (let i = 0; i < 110; i++) { const al = SHOV_AL - 30 + hash(i, 7) * 60, la = WR + PLAT.D + 1.5 + hash(i, 8) * 9, p = _pl(al, la), sc = 0.4 + hash(i, 9) * 1.0;
      if (Math.abs(al - SHOV_AL) < 4 && la < WR + PLAT.D + 6) continue;      // donde entra el balde queda el corte fresco
      const r = new THREE.Mesh(rockGeo, rm[i % 3]); r.scale.set(sc, sc * 0.7, sc); r.position.set(p.x, H(p.x, p.z) + sc * 0.2, p.z); r.rotation.set(hash(i, 4) * 3, hash(i, 5) * 3, hash(i, 6) * 3); scene.add(r); } }
  buildPowerLine(); buildCable2(); drillAbove3();
}
// Cables de las palas (como en la mina): van tendidos por el suelo desde una subestación en el borde del rajo, por las caras y bermas de los bancos, donde no anda nadie.
// Solo donde un vehículo tiene que pasar (un camino o la entrada a la Rampa Sur) el cable sube a un par de postes pasacables de 18 m y cruza por arriba.
const CTOP = 18.2;
function cablePost(x, z, ax, az) {      // poste pasacables rojo y blanco de 18 m (si ya hay uno en ese punto, se comparte)
  if (OBST.some(o => o.r === 1.6 && Math.hypot(o.x - x, o.z - z) < 3)) return;
  const red = lam(0xe0401a), wh = lam(0xf4f4f4), g = new THREE.Group();
  for (let y = 0; y < 18; y += 1.5) box(g, 0.55, 1.5, 0.55, (Math.floor(y / 1.5) % 2) ? wh : red, 0, y + 0.75, 0);
  box(g, 3.0, 0.35, 0.35, wh, 0, 18, 0); box(g, 1.6, 0.6, 1.6, lam(0x1d1f22), 0, 0.25, 0);
  g.position.set(x, H(x, z), z); g.rotation.y = Math.atan2(ax, az) + Math.PI / 2; scene.add(g); OBST.push({ x, z, r: 1.6 });
}
function cableSpan(out, a, b, n) { const ya = H(a.x, a.z) + CTOP, yb = H(b.x, b.z) + CTOP; for (let k = 1; k < n; k++) { const t = k / n; out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, ya + (yb - ya) * t - 5.6 * t * (1 - t), a.z + (b.z - a.z) * t)); } out.push(new THREE.Vector3(b.x, yb, b.z)); }
function buildSem6() {      // SEM 6: dos contenedores unidos (sala eléctrica) + subestación + letrero, en su patio junto al verde
  const g = new THREE.Group(), wh = lam(0xe6e2d6), bl = lam(0x2f4f8f), dk = lam(0x2b2e33), gr = lam(0x8d9196);
  for (const dz of [-1.35, 1.35]) { box(g, 12.2, 2.9, 2.6, wh, 0, 1.45 + 0.3, dz); box(g, 12.3, 0.5, 2.7, bl, 0, 0.55, dz); box(g, 12.3, 0.3, 2.7, bl, 0, 3.05, dz); }
  box(g, 12.4, 0.3, 5.6, dk, 0, 0.15, 0);      // base
  box(g, 0.9, 2.0, 0.08, dk, -4.5, 1.3, 2.66); box(g, 0.9, 2.0, 0.08, dk, 4.5, 1.3, -2.66);      // puertas
  for (const sx of [-3, 0, 3]) box(g, 1.2, 0.8, 0.6, gr, sx, 3.5, 0);      // equipos de clima en el techo
  cyl(g, 0.08, 0.08, 9, gr, 7.5, 4.5, 2.2); box(g, 1.6, 1.0, 0.1, lam(0xd8d8d8), 7.5, 8.2, 2.2);      // mástil con antena
  g.position.set(SEM6.x, H(SEM6.x, SEM6.z), SEM6.z); g.rotation.y = -SEM6.rot; scene.add(g);
  OBST.push({ x: SEM6.x, z: SEM6.z, r: 8 });
  const sx = SEM6.x + Math.cos(SEM6.rot) * 2 - Math.sin(SEM6.rot) * 14, sz = SEM6.z + Math.sin(SEM6.rot) * 2 + Math.cos(SEM6.rot) * 14; substation({ x: sx, z: sz });
  const s = new THREE.Group(), post = lam(0x5a5a5a); cyl(s, 0.08, 0.08, 3.2, post, -1.2, 1.6, 0); cyl(s, 0.08, 0.08, 3.2, post, 1.2, 1.6, 0);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#1e3a73'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.fillText('SEM 6', 128, 66);
  const tx = new THREE.CanvasTexture(cv); const pl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.08), [lam(0xdddddd), lam(0xdddddd), lam(0xdddddd), lam(0xdddddd), new THREE.MeshLambertMaterial({ map: tx }), lam(0xdddddd)]); pl.position.set(0, 2.7, 0); s.add(pl);
  const lx = SEM6.x + Math.sin(SEM6.rot) * 20, lz = SEM6.z - Math.cos(SEM6.rot) * 20; s.position.set(lx, H(lx, lz), lz); s.rotation.y = -SEM6.rot; scene.add(s);
}
function substation(p) {      // subestación móvil en la superficie, de donde sale el cable
  const g = new THREE.Group(), gr = lam(0x8d9196), dk = lam(0x2b2e33), ye = lam(0xe8b80c);
  box(g, 6, 0.5, 3.6, dk, 0, 0.25, 0); box(g, 5.4, 2.8, 3.0, gr, 0, 1.9, 0); box(g, 5.6, 0.25, 3.2, gr, 0, 3.4, 0); box(g, 5.42, 0.35, 3.02, ye, 0, 1.0, 0);
  for (const sx of [-1.6, 0, 1.6]) cyl(g, 0.18, 0.18, 1.0, lam(0xdedede), sx, 4.0, 0);
  g.position.set(p.x, H(p.x, p.z), p.z); g.rotation.y = hash(p.x, p.z) * 6.28; scene.add(g); OBST.push({ x: p.x, z: p.z, r: 4 });
}
const gdAt = (x, z) => { const fx = Math.round((x - GX0) / CELL), fz = Math.round((z - GZ0) / CELL); return (fx < 0 || fz < 0 || fx >= GNX || fz >= GNZ) ? 99 : GD[fz * GNX + fx]; };
const onRoadC = (x, z) => { const g = gdAt(x, z); return g >= 0 && g <= WR + 1; };
function cableRoute(S, T, avoid) {      // recorrido más barato por la malla: caras y bermas de los bancos baratas; pisos donde se circula, pilas y caminos caros (un camino se cruza solo si hace falta)
  const N = GNX * GNZ, ci = (x, z) => Math.max(0, Math.min(GNZ - 1, Math.round((z - GZ0) / CELL))) * GNX + Math.max(0, Math.min(GNX - 1, Math.round((x - GX0) / CELL)));
  const extra = new Float32Array(N), mark = (x, z, r, c) => { for (let dz = -r; dz <= r; dz += CELL) for (let dx = -r; dx <= r; dx += CELL) if (dx * dx + dz * dz <= r * r) { const i = ci(x + dx, z + dz); extra[i] = Math.max(extra[i], c); } };
  OBST.forEach(o => { if (o.r >= 3) mark(o.x, o.z, o.r + 2, 1e4); });      // equipos: no pasa por debajo
  (avoid || []).forEach(p => mark(p.x, p.z, p.r, 80));      // donde circulan camiones o la camioneta
  const cost = i => { const d = GD[i]; let c = (d >= 0 && d <= WR + 1) ? 40 : d === -1 ? (PLAT7[i] ? 2 : 25) : d === -2 ? 30 : 1; return c + extra[i]; };
  const s = ci(S.x, S.z), t = ci(T.x, T.z), tx = t % GNX, tz = Math.floor(t / GNX);
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const hp = [], hv = [], push = (i, f) => { hp.push(i); hv.push(f); let k = hp.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (hv[q] <= hv[k]) break; [hp[q], hp[k]] = [hp[k], hp[q]]; [hv[q], hv[k]] = [hv[k], hv[q]]; k = q; } };
  const pop = () => { const top = hp[0], li = hp.pop(), lv = hv.pop(); if (hp.length) { hp[0] = li; hv[0] = lv; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hp.length && hv[l] < hv[m]) m = l; if (r < hp.length && hv[r] < hv[m]) m = r; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; [hv[m], hv[k]] = [hv[k], hv[m]]; k = m; } } return top; };
  g[s] = 0; push(s, 0);
  while (hp.length) {
    const i = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break;
    const ix = i % GNX, iz = Math.floor(i / GNX), ci0 = cost(i);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= GNX || jz >= GNZ) continue;
      const j = jz * GNX + jx; if (done[j]) continue; const ng = g[i] + (ci0 + cost(j)) * 0.5 * (dx && dz ? 1.414 : 1);
      if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + Math.hypot(jx - tx, jz - tz)); } }
  }
  const P = []; for (let i = t; i >= 0; i = from[i]) { P.push({ x: GX0 + (i % GNX) * CELL, z: GZ0 + Math.floor(i / GNX) * CELL }); if (i === s) break; }
  P.reverse(); P[0] = { x: S.x, z: S.z }; P[P.length - 1] = { x: T.x, z: T.z };
  for (let it = 0; it < 2; it++) for (let k = 1; k < P.length - 1; k++) { const a = P[k - 1], b = P[k + 1], q = { x: (a.x + b.x + P[k].x * 2) / 4, z: (a.z + b.z + P[k].z * 2) / 4 }; if (onRoadC(q.x, q.z) === onRoadC(P[k].x, P[k].z)) P[k] = q; }      // suaviza sin mover los cruces
  return P;
}
function layCable(P, out, info) {      // tiende el cable sobre P: por el suelo (no se pisa: obstáculo) y, donde cruza un camino, por arriba entre dos postes
  let i = 0, n = 0;
  while (i < P.length) {
    const p = P[i];
    if (!onRoadC(p.x, p.z)) { out.push(new THREE.Vector3(p.x, H(p.x, p.z) + 0.35, p.z)); if (n++ % 2 === 0) OBST.push({ x: p.x, z: p.z, r: 1.2 }); info.ground.push(p); i++; continue; }
    let j = i; while (j < P.length && onRoadC(P[j].x, P[j].z)) j++;
    const a = j - 1 > i ? P[i] : P[Math.max(0, i - 1)], b = j - 1 > i ? P[j - 1] : P[Math.min(P.length - 1, j)];      // postes en el camino, justo en cada orilla
    cablePost(a.x, a.z, b.x - a.x, b.z - a.z); cablePost(b.x, b.z, b.x - a.x, b.z - a.z); info.posts.push(a, b);
    out.push(new THREE.Vector3(a.x, H(a.x, a.z) + 0.6, a.z), new THREE.Vector3(a.x, H(a.x, a.z) + CTOP, a.z)); cableSpan(out, a, b, 12); out.push(new THREE.Vector3(b.x, H(b.x, b.z) + 0.6, b.z));
    i = j;
  }
}
function groundCable(out, way, S, info) {      // último tramo por el piso junto a la pala (obstáculo: no se pisa) y entrada a la pala
  const pts = [];
  for (let s = 0; s < way.length - 1; s++) { const a = way[s], b = way[s + 1], m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.5)); for (let i = 1; i <= m; i++) pts.push({ x: a.x + (b.x - a.x) * i / m, z: a.z + (b.z - a.z) * i / m }); }
  pts.forEach((p, k) => { out.push(new THREE.Vector3(p.x, H(p.x, p.z) + 0.25, p.z)); if (k % 2 === 0 && k < pts.length - 3) OBST.push({ x: p.x, z: p.z, r: 1.2 }); info.ground.push(p); });
  const e = pts[pts.length - 1]; out.push(new THREE.Vector3(S.x + (e.x - S.x) * 0.6, H(S.x, S.z) + 1.4, S.z + (e.z - S.z) * 0.6));
  const curve = new THREE.CatmullRomCurve3(out); curve.curveType = 'centripetal';
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(6000, out.length * 3), 0.16, 6, false), lam(0x1a1a1a)));
}
const rimPoint = S => {      // punto en la superficie, afuera del borde del rajo, en la dirección de S desde el centro (para la subestación)
  let dx = S.x - PITC.x, dz = S.z - PITC.z; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n; let r = n; while (inPoly(PITC.x + dx * r, PITC.z + dz * r, RIMPOLY) && r < 2000) r += 4;
  for (let k = 0; k < 20; k++) { const p = { x: PITC.x + dx * (r + 14 + k * 4), z: PITC.z + dz * (r + 14 + k * 4) }; if (!onRoadC(p.x, p.z) && !OBST.some(o => Math.hypot(o.x - p.x, o.z - p.z) < o.r + 6)) return p; }
  return { x: PITC.x + dx * (r + 14), z: PITC.z + dz * (r + 14) };
};
function buildPowerLine() {      // cable de la pala 3: de la subestación, por el suelo, hasta el poste del portón; cruza por arriba la entrada a la Rampa Sur y sigue por el pie del frente hasta un costado de la pala
  const s0 = _pl(SHOV_AL, SHOV_LA), info = { ground: [], posts: [] };
  // portón: dos postes pasacables a 42 m (pasan dos CAEX a la vez, uno entrando y otro saliendo); el cable cruza por arriba a 18 m
  const gc = 48, gw = 21, G1 = _pl(gc + gw, 30), G2 = _pl(gc - gw, 30);
  GATE = { s0: PLAT.se + gc - gw, s1: PLAT.se + gc + gw, d: WR + 15.5, p: [G1, G2] };
  const avoid = [];      // por donde circulan: la entrada del portón, los camiones de la pala 3 y el piso de la fase 7 entre la partida y el portón
  for (let al = gc - gw + 3; al <= gc + gw - 3; al += 4) for (let la = 0; la <= 34; la += 6) { const q = _pl(al, la); avoid.push({ x: q.x, z: q.z, r: 6 }); }
  for (const sp of SPOT_AL) for (let al = sp - 60; al <= sp + 70; al += 5) { const q = _pl(al, sp - al > 0 ? ARR_LA + (SPOT_LA - ARR_LA) * sm01(1 - (sp - al) / 30) : SPOT_LA - (al - sp) * 0.35); avoid.push({ x: q.x, z: q.z, r: 9 }); }
  const A = rimPoint(G1); substation(A);
  const out = [new THREE.Vector3(A.x, H(A.x, A.z) + 1.2, A.z)];
  layCable(cableRoute(A, _pl(gc + gw + 3, 26), avoid), out, info);
  out.push(new THREE.Vector3(G1.x, H(G1.x, G1.z) + 0.6, G1.z), new THREE.Vector3(G1.x, H(G1.x, G1.z) + CTOP, G1.z));
  cablePost(G1.x, G1.z, G2.x - G1.x, G2.z - G1.z); cablePost(G2.x, G2.z, G2.x - G1.x, G2.z - G1.z); info.posts.push(G1, G2);
  cableSpan(out, G1, G2, 14);
  out.push(new THREE.Vector3(G2.x, H(G2.x, G2.z) + 0.6, G2.z));      // baja por el poste del lado de la pala
  const toe = WR + PLAT.D - 4;      // entre la cola de los camiones y la pila tronada
  if (P3_MOVED) { const Q = F7EQ.pc, back = { x: Q.x - Q.fx * 20, z: Q.z - Q.fz * 20 }, G3 = _pl(gc - gw - 12, 32);      // baja del poste y se aleja del portón antes de seguir a la pala
    const seg = []; for (let t = 0.1; t < 1; t += 0.1) seg.push({ x: G2.x + (G3.x - G2.x) * t, z: G2.z + (G3.z - G2.z) * t });
    const r5 = D52.cab.p5, i1 = r5.findIndex(p => p[2] === 1 && p[1] > 420); let i2 = i1; while (r5[i2 + 1][2] === 1) i2++;      // cruce de la celeste compartido con el cable de la pala 5: mismo par de postes
    const S1 = { x: r5[i2 + 1][0], z: r5[i2 + 1][1] }, S2 = { x: r5[i1 - 1][0], z: r5[i1 - 1][1] };
    layCable(seg.concat(cableRoute(G3, S1, avoid)), out, info);
    cablePost(S1.x, S1.z, S2.x - S1.x, S2.z - S1.z); cablePost(S2.x, S2.z, S2.x - S1.x, S2.z - S1.z); info.posts.push(S1, S2);
    out.push(new THREE.Vector3(S1.x, H(S1.x, S1.z) + 0.6, S1.z), new THREE.Vector3(S1.x, H(S1.x, S1.z) + CTOP, S1.z)); cableSpan(out, S1, S2, 14); out.push(new THREE.Vector3(S2.x, H(S2.x, S2.z) + 0.6, S2.z));
    layCable(cableRoute(S2, back, avoid), out, info); groundCable(out, [back, { x: Q.x - Q.fx * 12, z: Q.z - Q.fz * 12 }, { x: Q.x - Q.fx * 7 + Q.fz * 2, z: Q.z - Q.fz * 7 - Q.fx * 2 }], { x: Q.x, z: Q.z }, info); }
  else groundCable(out, [G2, _pl(gc - gw - 5, toe), _pl(SHOV_AL + 11, toe), _pl(SHOV_AL + 7, SHOV_LA + 6), _pl(SHOV_AL + 4.5, SHOV_LA + 3.5)], s0, info);
  CABLE = Object.assign(info, { src: A });
}
function drawnCable(W, Q, local) {      // local: la subestación móvil va en el primer punto dibujado (dentro del rajo), no en el borde      // cable dibujado: de la subestación en el borde, por el suelo; en los pasacables (y donde cruza un camino) sube a dos postes y pasa por arriba
  const info = { ground: [], posts: [] }, P = W.map(p => ({ x: p[0], z: p[1], g: p[2] })).reverse();
  const lanes = OBST.filter(o => o.r === 8 && Math.hypot(o.x - Q.x, o.z - Q.z) < 40), inLane = p => lanes.some(o => { const t = -(p.x - o.x) * Q.fx - (p.z - o.z) * Q.fz, w = Math.abs(-(p.x - o.x) * Q.fz + (p.z - o.z) * Q.fx); return t > -6 && t < 120 && w < 10; });      // salida de los camiones: desde cada puesto de carga, hacia adelante (se alejan de la pila), 20 m de ancho
  { const e = { x: Q.x - Q.fx * 9, z: Q.z - Q.fz * 9 }, a = P[P.length - 1], L = Math.hypot(e.x - a.x, e.z - a.z), m = Math.ceil(L / 2); for (let i = 1; i < m - 1; i++) P.push({ x: a.x + (e.x - a.x) * i / m, z: a.z + (e.z - a.z) * i / m, g: 0 }); }      // el último tramo hasta la pala también puede cruzar una salida
  P.forEach(p => { if (onRoadC(p.x, p.z) || inLane(p)) p.g = 1; });
  for (let k = 1; k < P.length - 1; k++) if (!P[k].g && P[k - 1].g && (P[k + 1].g || (P[k + 2] && P[k + 2].g))) P[k].g = 1;      // dos tramos elevados casi seguidos se juntan en uno      // donde cruza un camino o una salida de camiones, el cable va por arriba entre dos postes
  const A = local ? { x: P[0].x, z: P[0].z } : rimPoint(P[0]); substation(A);
  const out = [new THREE.Vector3(A.x, H(A.x, A.z) + 1.2, A.z)]; if (!local) layCable(cableRoute(A, P[0], []), out, info);
  const last = P.length - 1; let k = 0;
  while (k < last) {
    if (P[k + 1].g) { let j = k + 1; while (j < last && P[j].g) j++; const a = P[k], b = P[j];
      cablePost(a.x, a.z, b.x - a.x, b.z - a.z); cablePost(b.x, b.z, b.x - a.x, b.z - a.z); info.posts.push(a, b);
      out.push(new THREE.Vector3(a.x, H(a.x, a.z) + 0.6, a.z), new THREE.Vector3(a.x, H(a.x, a.z) + CTOP, a.z)); cableSpan(out, a, b, 14); out.push(new THREE.Vector3(b.x, H(b.x, b.z) + 0.6, b.z)); k = j; continue; }
    const a = P[k], b = P[k + 1], m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
    for (let i = 1; i <= m; i++) { const p = { x: a.x + (b.x - a.x) * i / m, z: a.z + (b.z - a.z) * i / m }; out.push(new THREE.Vector3(p.x, H(p.x, p.z) + 0.3, p.z)); if (i % 2 === 0) OBST.push({ x: p.x, z: p.z, r: 1.2 }); info.ground.push(p); }
    k++;
  }
  groundCable(out, [P[last], { x: Q.x - Q.fx * 9, z: Q.z - Q.fz * 9 }], { x: Q.x, z: Q.z }, info);
  return Object.assign(info, { src: A });
}
function buildCable2() {      // palas 2, 3 y 6 de la fase 7 y pala 5 del fondo: cables como en el dibujo
  for (const [k, Q] of [['p2', F7EQ.palas[0]], ['p3', F7EQ.palas[1]], ['p6', F7EQ.palas[2]], ['p5', PIT.p5]]) { if (!Q) continue; const info = drawnCable(D52.cab[k], Q); if (!CABLE2) CABLE2 = info; }
}
let DRILL3 = null;
function drillAbove3() { return;      // (la cancha de la 402 junto a la Rampa Sur ya no existe: la fase 7 tiene sus canchas propias)
}
function drillAbove3_old() {      // pala 3: cancha de perforación en el piso detrás de su frente (el material que viene); la perforadora trabaja en el extremo y la malla de pozos queda a su izquierda
  const s3 = _pl(SHOV_AL, 0), P = (ao, la) => ({ x: s3.x + s3.tx * ao + s3.nx * la, z: s3.z + s3.tz * ao + s3.nz * la });
  const ok = (p, m) => { for (let j = 0; j < 8; j++) { const x = p.x + Math.cos(j * 0.785) * m, z = p.z + Math.sin(j * 0.785) * m; if (Math.abs(H(x, z) - H7) > 0.6 || gdAt(x, z) === -2 || onRoadC(x, z)) return false; } return true; };
  let D = null; for (const [ao, la] of [[-8, 74], [-8, 80], [-14, 74], [-2, 78], [-8, 68], [-14, 84]]) { const p = P(ao, la); if (ok(p, 5) && !OBST.some(o => Math.hypot(o.x - p.x, o.z - p.z) < o.r + 4)) { D = Object.assign(p, { ao, la }); break; } }
  if (!D) D = Object.assign(P(-8, 74), { ao: -8, la: 74 });
  placeDrill(D.x, D.z, Math.atan2(s3.tx, s3.tz), false);
  { let q = null; for (const ao of [D.ao - 32, D.ao - 41, D.ao - 50, D.ao - 23]) { const p = P(ao, 63); if (ok(p, 4) && !OBST.some(o => Math.hypot(o.x - p.x, o.z - p.z) < o.r + 3)) { q = p; break; } }      // 408: dentro de la cancha, en la primera fila (burden de 9 m desde el banco)
    if (q) { OBST.push({ x: q.x, z: q.z, r: 6 }); const cd = buildCrawlerDrill(nextDrillNum()); cd.position.set(q.x, H(q.x, q.z), q.z); cd.rotation.y = Math.atan2(-s3.nx, -s3.nz); scene.add(cd); DRILL3B = q; } }
  const holes = [];
  for (let la = 63, row = 0; la <= 90; la += 9, row++) for (let ao = -105 + (row % 2) * 4.5; ao <= D.ao - 7; ao += 9) {
    const p = P(ao + (hash(ao, la) - 0.5) * 0.8, la + (hash(la, ao) - 0.5) * 0.8);
    if (Math.hypot(p.x - D.x, p.z - D.z) < 8 || !ok(p, 1.5) || OBST.some(o => Math.hypot(o.x - p.x, o.z - p.z) < Math.max(3, o.r + 1))) continue;
    holes.push(p);
  }
  if (holes.length) addHoles(holes);
  // conos naranjos cerrando la cancha por el lado de la perforadora: una línea que cruza el piso desde la pila hasta la pared
  const cm = lam(0xff6a00), cw = lam(0xf2f2f2), cd = lam(0x1b1b18), cones = [];
  for (let la = 56; la <= 104; la += 6) {
    let p = null; for (const ao of [D.ao + 11, D.ao + 13, D.ao + 9, D.ao + 15]) { const q = P(ao, la); if (ok(q, 1) && !OBST.some(o => Math.hypot(o.x - q.x, o.z - q.z) < o.r)) { p = q; break; } }
    if (!p) continue; const c = new THREE.Group();
    cyl(c, 0.34, 0.34, 0.08, cd, 0, 0.04, 0); cyl(c, 0.07, 0.3, 1.0, cm, 0, 0.58, 0); cyl(c, 0.2, 0.2, 0.14, cw, 0, 0.5, 0); cyl(c, 0.14, 0.14, 0.12, cw, 0, 0.78, 0);
    c.scale.setScalar(1.6); c.position.set(p.x, H(p.x, p.z) + 0.02, p.z); scene.add(c); cones.push(p);
  }
  DRILL3 = { x: D.x, z: D.z, holes: holes.length, cones: cones.length };
}
function resetPlatform() {
  if (!PLAT) return;
  for (const ld of plat.loaders) scene.remove(ld.mesh);
  plat.loaders.length = 0; plat.nid = 220; plat.merging = false; plat.cool = [0, 0];
  if (!TEST && !P3_MOVED) SPOT_AL.forEach((al, i) => { const ld = mkLoaderTruck(al, i); ld.la = SPOT_LA; ld.tau = 1; ld.state = i ? 'load' : 'ready'; ld.fill = 1; ld.pile.scale.y = 0.05 + 0.95 * ld.fill; plat.loaders.push(ld); });
}
function startMerge(ld, idx) {
  const lane = -LANE * PLAT.side, a0 = ld.al;
  const bz = [_pl(a0, ld.la), _pl(a0, ARR_LA + 2), _pl(a0 + 40, lane), _pl(a0 + 84, lane)];      // sale de frente (estaba de cola al banco)
  let len = 0, prev = bz[0]; for (let i = 1; i <= 30; i++) { const p = bezAt(bz, i / 30); len += Math.hypot(p.x - prev.x, p.z - prev.z); prev = p; }
  trucks.push({ id: ld.num, s: PLAT.se + a0, u: -LANE, v: 0, v0: 2.2 + Math.random() * 1.4, mesh: ld.mesh, beacon: ld.beacon, auth: false, passed: false,
    prevD: PLAT.se + a0 - P.s, off: 0, merge: { bz, len, tau: 0, sp: 3.8, x: bz[0].x, z: bz[0].z, dx: -bz[0].nx, dz: -bz[0].nz } });
  plat.merging = true; plat.loaders.splice(idx, 1); plat.cool[ld.spot] = 5 + Math.random() * 6;
}
function updatePlatform(dt) {
  if (!PLAT) return;
  plat.shov.forEach((sv, i) => {
    const ph = (tAnim + sv.off) % SHOV_T, was = sv.prev; sv.prev = ph;
    if (was > ph) {      // nuevo ciclo: gira hacia el camión que está cargando (alterna si hay dos)
      const ls = [0, 1].filter(k => plat.loaders.some(l => l.spot === k && l.state === 'load'));
      const k = ls.length === 2 ? 1 - sv.last : ls.length ? ls[0] : 1 - sv.last; sv.last = k; sv.swing = sv.swingFor ? sv.swingFor[k] : (k === 1 ? 1 : -1);
    }
    if (was < 4.1 && ph >= 4.1) { const ld = plat.loaders.find(l => l.spot === sv.last && l.state === 'load'); if (ld) ld.fill = Math.min(1, ld.fill + 0.2); }
  });
  const sm = PLAT.se + 70;
  for (let i = plat.loaders.length - 1; i >= 0; i--) {
    const ld = plat.loaders[i];
    if (ld.state === 'arrive') { const turn = SPOT_AL[ld.spot] + 18; ld.al = Math.min(turn, ld.al + 4.2 * dt); ld.la = ARR_LA; if (ld.al >= turn) { ld.state = 'back'; ld.tau = 0; } }      // pasa de largo por la orilla
    else if (ld.state === 'back') { ld.tau = Math.min(1, ld.tau + dt / 9); if (ld.tau >= 1) { ld.al = SPOT_AL[ld.spot]; ld.la = SPOT_LA; ld.state = 'load'; } }      // retrocede y se cuadra de cola al banco
    else if (ld.state === 'load') { if (ld.fill >= 1) ld.state = 'ready'; }
    else if (ld.state === 'ready') {
      ld.wait += dt;
      const okPlayer = P.s < sm - 300 || P.s > sm + 60, free = !plat.merging && !trucks.some(t => Math.abs(t.s - sm) < 50);
      if (ld.wait > 3 && okPlayer && free) startMerge(ld, i);
    }
  }
  if (!TEST && !P3_MOVED) for (let sp = 0; sp < SPOT_AL.length; sp++) if (!plat.loaders.some(l => l.spot === sp)) {      // en modo prueba no llegan camiones a la pala
    plat.cool[sp] -= dt;
    if (plat.cool[sp] <= 0) plat.loaders.push(mkLoaderTruck(SPOT_AL[sp] - 95, sp));
  }
  for (const t of trucks) if (t.merge) {
    const m = t.merge; m.tau = Math.min(1, m.tau + m.sp * dt / m.len);
    const p = bezAt(m.bz, m.tau), p2 = bezAt(m.bz, Math.min(1, m.tau + 0.02)), n = Math.hypot(p2.x - p.x, p2.z - p.z) || 1;
    m.x = p.x; m.z = p.z; m.dx = (p2.x - p.x) / n; m.dz = (p2.z - p.z) / n;
    const su = worldToSU(p.x, p.z, t.s); t.s = su.s; t.u = su.u;
    if (m.tau >= 1) { t.merge = null; t.u = -LANE; plat.merging = false; }
  }
}
function backAt(sp, t) {      // retroceso hasta el punto de carga: de la orilla (mirando hacia adelante) a quedar de cola al frente
  const B = [[sp + 18, ARR_LA], [sp + 4, ARR_LA], [sp, SPOT_LA - 12], [sp, SPOT_LA]], f = t => { const u = 1 - t; return [0, 1].map(k => u * u * u * B[0][k] + 3 * u * u * t * B[1][k] + 3 * u * t * t * B[2][k] + t * t * t * B[3][k]); };
  const t0 = Math.min(t, 0.99), a = f(t0), b = f(t0 + 0.01), p = f(t), pa = _pl(a[0], a[1]), pb = _pl(b[0], b[1]), q = _pl(p[0], p[1]), dx = pa.x - pb.x, dz = pa.z - pb.z, n = Math.hypot(dx, dz) || 1;
  return { x: q.x, z: q.z, dx: dx / n, dz: dz / n };
}
function poseMerge(t) { const m = t.merge; setWorldPose(t.mesh, m.x, m.z, m.dx, m.dz); }
function animPlatform(dt) {
  if (!PLAT) return;
  plat.shov.forEach(sv => shovelPose(sv, (tAnim + sv.off) % SHOV_T)); animOps(dt);
  for (const ld of plat.loaders) {
    if (ld.state === 'arrive') { const p = _pl(ld.al, ld.la); setWorldPose(ld.mesh, p.x, p.z, p.tx, p.tz); } else { const b = backAt(SPOT_AL[ld.spot], sm01(ld.tau == null ? 1 : ld.tau)); setWorldPose(ld.mesh, b.x, b.z, b.dx, b.dz); }
    ld.pile.scale.y += ((0.05 + 0.95 * ld.fill) - ld.pile.scale.y) * Math.min(1, dt * 3);
    blink(ld.beacon, false);
  }
}
mkPlatform();
buildSem6();

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
    const gm = GATE ? { x: (GATE.p[0].x + GATE.p[1].x) / 2, z: (GATE.p[0].z + GATE.p[1].z) / 2 } : f0; let clear = true;      // camino recto despejado hasta el portón
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
  if (GATE && !F.gate && !TEST) {      // solo se llega a la Rampa Sur pasando entre los postes pasacables
    const near = (x, z) => { let b = null; for (let s = START_S; s < START_S + 260; s += 2) { const f = frame(s), d = Math.hypot(f.x - x, f.z - z); if (!b || d < b.d) b = { s, d }; } return b; };
    const hiA = H(F.x, F.z) > f7h(F.x, F.z) + 3, hiN = H(nx, nz) > f7h(nx, nz) + 3;      // arriba de la rampa o en la cancha de perforación (sobre el piso de la bahía) no rige el portón
    if (!hiN) { const a = near(F.x, F.z), b = near(nx, nz);
      if (a.d >= GATE.d && b.d < GATE.d) { if (b.s > GATE.s0 + 1.5 && b.s < GATE.s1 - 1.5) F.gate = true; else gateMsg = true; }
      else if (hiA && b.d < GATE.d) gateMsg = true; }      // bajar de la cancha hacia el camino tampoco vale: al camino se entra por el portón
  }
  if (gateMsg) { P.v = 0; setBanner('Entra a la Rampa Sur por entre los postes pasacables.', 'warn'); bannerT = 2; }
  else if (freeBlocked(nx, nz, hx, hz)) { if (P.v > 3) { beep(90, 0.18, 'sawtooth', 0.06); shake = Math.max(shake, 0.3); } P.v = 0; }
  else { F.x = nx; F.z = nz; }
  if (TEST) return;      // modo prueba: recorrido libre por toda la mina (no se amarra a la Rampa Sur)
  // ¿llegó a la Rampa Sur? (tramo junto a la fase 7)
  let bs = null; for (let s = START_S; s < START_S + 260; s += 2) { const f = frame(s), d = (f.x - F.x) ** 2 + (f.z - F.z) ** 2; if (!bs || d < bs.d) bs = { s, d, f }; }
  const f = bs.f, u = (F.x - f.x) * f.rx + (F.z - f.z) * f.rz;
  if ((F.gate || !GATE) && Math.abs(u) < CRASH_U - 2.5 && Math.abs((F.x - f.x) * f.tx + (F.z - f.z) * f.tz) < 3) {
    const along = hx * f.tx + hz * f.tz, side = hx * f.rx + hz * f.rz;
    Object.assign(P, { s: bs.s, u, v: P.v * Math.max(0.4, along), vu: P.v * side * 0.5 }); free = null; camSnap = false;
    setBanner('Tomaste la Rampa Sur. ¡Circula por la izquierda!', 'ok'); bannerT = 2.5;
  }
}
function resetGame() {
  capNum = 100;      // los CAEX se numeran desde el 101
  for (const t of trucks.concat(oncs)) scene.remove(t.mesh);
  for (const r of rocks) scene.remove(r.mesh);
  for (const c of rocasPista) scene.remove(c.mesh);
  rocasPista.length = 0;
  if (!TEST) for (let cs = START_S + 130 + Math.random() * 40; cs < L - 70; cs += 150 + Math.random() * 130) if (!PLAT || Math.abs(cs - PLAT.se) > PLAT.HL + 60) rocasPista.push(mkRoca(cs));
  resetFallRocks();
  resetPlatform();
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
    const t = trucks[i], lead = trucks[i + 1]; if (t.merge) { t.v = t.merge.sp; t.vInit = false; continue; } let v = t.v0;
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
  updateRoad(dt); updateRocks(dt); updatePlatform(dt); updateFallRocks(dt);
  if (intro) {      // salida de la explanada: la camioneta sale sola de junto a la pala y se incorpora a su pista
    intro.t += dt; const k = Math.min(1, intro.t / 3.6), e = k * k * (3 - 2 * k), nu = intro.u0 + (-LANE - intro.u0) * e;
    P.vu = (nu - P.u) / Math.max(dt, 1e-3); P.u = nu; P.v = Math.min(CRUISE, intro.t * 3.6); P.s += P.v * dt;
    if (k >= 1) { intro = null; P.vu = 0; }
    return;
  }
  if (free) { stepFree(dt); return; }

  // Camioneta
  const slick = slickNow();             // piso mojado donde pasó el aljibe: menos agarre
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
  for (const t of trucks) { if (t.merge) poseMerge(t); else place(t.mesh, t.s, t.u + (t.off || 0), 1, 0); blink(t.beacon, t.auth); }
  for (const o of oncs) { place(o.mesh, o.s, o.u, -1, 0); blink(o.beacon, false); if (o.spray) { o.spray.visible = o.spraying; if (o.spraying) updateSpray(o.spray, tAnim); } }

  animPlatform(dt);
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
  if (slickNow() > 0.3) A('mojado', '💧', '', 'Piso mojado', 'warn');
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
  if (radarHead) radarHead.rotation.y = Math.sin(tAnim * 0.9) * 0.75;      // el radar barre de izquierda a derecha
  updateVisuals(dt); updateHud();
  if (mode === 'play') drawRadar();
  renderer.render(scene, camera);
  if (pendingShot) { pendingShot = false; const im = $('shotImg'); im.src = renderer.domElement.toDataURL('image/jpeg', 0.85); im.hidden = false; }
}
resetGame(); camSnap = true;
requestAnimationFrame(loop);


