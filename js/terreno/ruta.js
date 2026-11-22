// Ruta real del plano GEO-SG-716 (js/datos/terreno_dwg.js): muestreo del camino por metro (px, pz, hr), frame(s), hrAt, el piso de la fase 7 (inF7, f7h),
// la salida del piso al camino (PLAT), y las marcas del recorrido (START_S, GEO_ZONES: tramos de riesgo geotécnico).
import { LANE } from '../config/diseno.js';
import { F7_DWG, GEO_ZONES_DWG, ROUTE_DWG } from '../datos/terreno_dwg.js';
import { inPoly } from '../comun/mates.js';
import { paso } from '../comun/pasos.js';

const F7 = F7_DWG.poly, inF7 = (x, z) => inPoly(x, z, F7);      // piso de la fase 7 (pared este): ahí parte la camioneta
const f7h = (x, z) => F7_DWG.plano[0] * x + F7_DWG.plano[1] * z + F7_DWG.plano[2];      // cota del piso de la fase 7 (plano ajustado)
const PITC = { x: 50, z: -100 };      // centro aproximado del rajo (el fondo más hondo)
const dirOf = (p, q) => { const dx = q[0] - p[0], dz = q[1] - p[1], n = Math.hypot(dx, dz); return [dx / n, dz / n]; };
const lastOf = a => a[a.length - 1], tanEnd = a => dirOf(a[a.length - 2], a[a.length - 1]);
const PRE = 0, POST = 205;          // la partida empieza en el primer punto de la ruta; 205 m rectos tras el portal, hasta el domo
const pathPts = ROUTE_DWG.map(p => [p[0], p[1]]), nPts = pathPts.length - 1, tFin = tanEnd(pathPts);
pathPts.push([lastOf(pathPts)[0] + tFin[0] * POST, lastOf(pathPts)[1] + tFin[1] * POST]);
const cum = [0]; for (let i = 1; i < pathPts.length; i++) cum.push(cum[i - 1] + Math.hypot(pathPts[i][0] - pathPts[i - 1][0], pathPts[i][1] - pathPts[i - 1][1]));
const DS = 1, SMIN = -PRE, NS = Math.floor(cum[cum.length - 1] / DS), SMAX = SMIN + NS * DS;
const L = cum[nPts] - PRE;            // largo del camino hasta el portal «SUPERFICIE»
const px = new Float32Array(NS + 1), pz = new Float32Array(NS + 1), ptx = new Float32Array(NS + 1), ptz = new Float32Array(NS + 1), hr = new Float32Array(NS + 1);
paso('ruta: muestreo del camino real por metro (posición, tangente, cota)', () => {
  let j = 0;
  for (let k = 0; k <= NS; k++) {
    const d = k * DS; while (j < pathPts.length - 2 && cum[j + 1] < d) j++;
    const f = (d - cum[j]) / (cum[j + 1] - cum[j]);
    px[k] = pathPts[j][0] + f * (pathPts[j + 1][0] - pathPts[j][0]); pz[k] = pathPts[j][1] + f * (pathPts[j + 1][1] - pathPts[j][1]);
    const ya = ROUTE_DWG[Math.min(j, nPts)][2], yb = ROUTE_DWG[Math.min(j + 1, nPts)][2];      // cota del camino (ya suavizada, ≤ 11 %); tras el portal queda plana
    hr[k] = j >= nPts ? ROUTE_DWG[nPts][2] : ya + f * (yb - ya);
  }
  for (let k = 0; k <= NS; k++) {
    const a = Math.max(0, k - 1), b = Math.min(NS, k + 1), dx = px[b] - px[a], dz = pz[b] - pz[a], n = Math.hypot(dx, dz);
    ptx[k] = dx / n; ptz[k] = dz / n;
  }
});
function frame(s) {
  let f = (s - SMIN) / DS; if (f < 0) f = 0; if (f > NS - 1e-6) f = NS - 1e-6;
  const i = f | 0, t = f - i;
  let tx = ptx[i] + (ptx[i + 1] - ptx[i]) * t, tz = ptz[i] + (ptz[i + 1] - ptz[i]) * t; const n = Math.hypot(tx, tz); tx /= n; tz /= n;
  return { x: px[i] + (px[i + 1] - px[i]) * t, z: pz[i] + (pz[i + 1] - pz[i]) * t, tx, tz, rx: -tz, rz: tx };
}
function hrAt(s) { let f = (s - SMIN) / DS; if (f < 0) f = 0; if (f > NS - 1e-6) f = NS - 1e-6; const i = f | 0; return hr[i] + (hr[i + 1] - hr[i]) * (f - i); }

// Salida del piso de la fase 7 al camino: al comienzo de la ruta, del lado donde está el piso (ahí no va pretil y entran las camionetas)
const PLAT = (() => { const kk = Math.min(NS, 40), side = [1, -1].find(sd => inF7(px[kk] - ptz[kk] * sd * 45, pz[kk] + ptx[kk] * sd * 45)) || 1;
  return { se: -15, side, D: 30, HL: 60, k: 0, diff: 0, clear: 0, curv: 0 }; })();
const START_S = -PRE, START_U0 = -LANE, START_Y = hrAt(START_S);
const GEO_ZONES = GEO_ZONES_DWG.map(([a, b]) => ({ a, b }));      // tramos de la ruta [a, b] (m) junto a zonas de riesgo o cuñas del plano
const GEO_ZONE = GEO_ZONES[0] || { a: L * 0.5 - 70, b: L * 0.5 + 90 };
const CAEX_LANE = { a: 0, b: 0, u: 25, on: false };      // carril solo CAEX: desactivado

export { F7, inF7, f7h, PITC, dirOf, lastOf, tanEnd, PRE, POST, pathPts, nPts, cum, DS, SMIN, NS, SMAX, L, px, pz, ptx, ptz, hr, frame, hrAt, PLAT, START_S, START_U0, START_Y, GEO_ZONE, GEO_ZONES, CAEX_LANE };
