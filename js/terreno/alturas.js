// Malla de alturas del terreno real (GH: cota, GD: tipo de celda / distancia a la ruta, GI: punto de ruta más cercano) leída de la grilla del plano (js/datos/grilla_dwg.js),
// con la calzada de la ruta excavada a su cota, el piso de la fase 7 aplanado y un patio plano para el domo mirador; H(x, z) la lee.
import { WR } from '../config/diseno.js';
import { inPoly } from '../comun/mates.js';
import { CAMINOS_DWG, DWG, PISOS_DWG } from '../datos/terreno_dwg.js';
import { GRID16 } from '../datos/grilla_dwg.js';
import { paso } from '../comun/pasos.js';
import { L, NS, f7h, frame, hr, inF7, px, pz } from './ruta.js';

const CELL = DWG.CELL, GX0 = DWG.GX0, GZ0 = DWG.GZ0, GNX = DWG.GNX, GNZ = DWG.GNZ;
const N = GNX * GNZ;
const GH = new Float32Array(N), GD = new Float32Array(N), GI = new Int32Array(N), GP = new Uint8Array(N), GR = new Uint8Array(N), GCP = new Uint8Array(N), NOSE = new Uint8Array(N), HB = new Float32Array(N).fill(-1);      // GP: 1 = dentro del rajo (depresión), 0 = superficie; GR: 1 = camino interior
const sm = v => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); };
paso('terreno: grilla de alturas del plano', () => {
  for (let i = 0; i < N; i++) { GH[i] = (GRID16[i] & 0x7fff) * 0.1 + 1000 - DWG.YC; GP[i] = GRID16[i] >> 15; }
});
function inPit(x, z) { const ix = Math.round((x - GX0) / CELL), iz = Math.round((z - GZ0) / CELL); return ix >= 0 && iz >= 0 && ix < GNX && iz < GNZ && GP[iz * GNX + ix] === 1; }      // ¿está dentro del rajo?
paso('terreno: distancia a la ruta, calzada excavada, piso de la fase 7 y patio del domo', () => {
  const HS = 130, map = new Map();      // tramo de ruta más cercano a cada celda (por cuadrantes de 130 m)
  for (let k = 0; k <= NS; k++) { const key = Math.floor((px[k] - GX0) / HS) * 1024 + Math.floor((pz[k] - GZ0) / HS); let a = map.get(key); if (!a) { a = []; map.set(key, a); } a.push(k); }
  for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {
    const x = GX0 + ix * CELL, z = GZ0 + iz * CELL; let best = 1e9, bi = -1;
    const cx = Math.floor((x - GX0) / HS), cz = Math.floor((z - GZ0) / HS);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = map.get((cx + a) * 1024 + (cz + b)); if (!arr) continue;
      for (let m = 0; m < arr.length; m++) { const k = arr[m], dx = px[k] - x, dz = pz[k] - z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bi = k; } }
    }
    const i = iz * GNX + ix; GD[i] = bi >= 0 ? Math.sqrt(best) : 999; GI[i] = Math.max(0, bi);
  }
  const fd = frame(L + 40), dcx = fd.x + fd.rx * -44, dcz = fd.z + fd.rz * -44, hL = hr[Math.min(NS, Math.round(L))];      // patio del domo mirador (frente al final de la ruta)
  for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {
    const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL, d = GD[i];
    if (d < WR + 14) { const r = hr[GI[i]]; GH[i] = d <= WR ? r : r * (1 - sm((d - WR) / 14)) + GH[i] * sm((d - WR) / 14); }      // calzada de 38 m a la cota del camino, con transición de 14 m al terreno real
    else if (inF7(x, z) && Math.abs(GH[i] - f7h(x, z)) < 2.5) { GH[i] = f7h(x, z); GD[i] = -1; }      // piso de la fase 7: plano (ahí se circula libre)
    const dd = Math.hypot(x - dcx, z - dcz); if (d > WR + 2 && dd < 75) GH[i] = hL * (1 - sm((dd - 50) / 25)) + GH[i] * sm((dd - 50) / 25);      // explanada del domo
  }
  for (const Pz of PISOS_DWG) {      // los demás pisos planos del rajo (fondo, terrazas): celdas de piso (ahí van las palas, dozers y canchas; no se tocan las cotas)
    const xs = Pz.poly.map(p => p[0]), zs = Pz.poly.map(p => p[1]), i0 = Math.max(0, Math.floor((Math.min(...xs) - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((Math.max(...xs) - GX0) / CELL)), j0 = Math.max(0, Math.floor((Math.min(...zs) - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((Math.max(...zs) - GZ0) / CELL));
    const via = !Pz.f7 && !Pz.fondo && !Pz.cancha;      // piso sin carguío ni perforación: es camino (se pinta y se trata como tal)
    for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) { const i = iz * GNX + ix; if (GD[i] > WR + 2 && inPoly(GX0 + ix * CELL, GZ0 + iz * CELL, Pz.poly)) { GD[i] = -1; if (via) GR[i] = 1; } }
  }
  {      // caminos interiores: calzada de 38 m (dos CAEX) excavada a la cota del camino, con transición de 14 m al terreno, como la ruta; GR = 1 en la calzada (ahí circulan camiones: los cables cruzan por postes, hay huellas y se pinta como camino)
    const dmin = new Float32Array(N).fill(1e9), hc = new Float32Array(N), R = WR + 14, nR = Math.ceil(R / CELL);
    const d2 = new Float32Array(N).fill(1e9), h2 = new Float32Array(N), id1 = new Int32Array(N).fill(-1), dr = new Float32Array(N).fill(1e9), hr_ = new Float32Array(N), toc = [];      // segundo camino más cercano (para mezclar donde se pisan dos calzadas)
    CAMINOS_DWG.forEach((C, r) => {
      toc.length = 0;
      for (let k = 0; k < C.length - 1; k++) {
      const [ax, az, ay] = C[k], [bx, bz, by] = C[k + 1], vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - GX0) / CELL) - nR), i1 = Math.min(GNX - 1, Math.ceil((Math.max(ax, bx) - GX0) / CELL) + nR), j0 = Math.max(0, Math.floor((Math.min(az, bz) - GZ0) / CELL) - nR), j1 = Math.min(GNZ - 1, Math.ceil((Math.max(az, bz) - GZ0) / CELL) + nR);
      for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
        const x = GX0 + ix * CELL, z = GZ0 + iz * CELL, tt = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)), d = Math.hypot(x - ax - vx * tt, z - az - vz * tt), i = iz * GNX + ix;
        if (d < dr[i]) { if (dr[i] === 1e9) toc.push(i); dr[i] = d; hr_[i] = ay + (by - ay) * tt; }
      }
      }
      for (const i of toc) { const d = dr[i], h = hr_[i]; dr[i] = 1e9;      // top-2 por camino distinto
        if (d < dmin[i]) { if (id1[i] !== r) { d2[i] = dmin[i]; h2[i] = hc[i]; } dmin[i] = d; hc[i] = h; id1[i] = r; }
        else if (d < d2[i]) { d2[i] = d; h2[i] = h; } }
    });
    for (let i = 0; i < N; i++) if (d2[i] < R && dmin[i] < R) {      // dos calzadas que se pisan: cota mezclada según la distancia a cada eje (sin costura con escalón)
      const w1 = 1 / (dmin[i] + 2) ** 2, w2 = 1 / (d2[i] + 2) ** 2; hc[i] = (hc[i] * w1 + h2[i] * w2) / (w1 + w2); }
    for (let i = 0; i < N; i++) { const d = dmin[i]; if (GD[i] === -1 && d <= WR) { GR[i] = 1; GCP[i] = 1; }      // camino que cruza un piso: la calzada se marca como camino (se pinta y tiene huellas) sin tocar la cota del piso; GCP = esa calzada (el mapa la dibuja blanca)
      if (d >= R || GD[i] <= WR + 14) continue;      // la ruta principal manda donde se cruzan
      GH[i] = d <= WR ? hc[i] : hc[i] * (1 - sm((d - WR) / 14)) + GH[i] * sm((d - WR) / 14); if (d <= WR) GR[i] = 1; }
    {      // empalme con los pisos: el piso no se toca (ahí están los equipos), así que el camino junto a él baja o sube a su cota en 20 m; sin esto quedaba un escalón vertical en el borde del piso
      const RP = 20, nP = Math.ceil(RP / CELL), H0 = Float32Array.from(GH);
      for (let i = 0; i < N; i++) { if (dmin[i] >= R || GD[i] <= WR + 14) continue;
        const ix = i % GNX, iz = (i - ix) / GNX; let best = RP, hp = 0;
        for (let dz = -nP; dz <= nP; dz++) for (let dx = -nP; dx <= nP; dx++) { const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= GNX || jz >= GNZ) continue; const j = jz * GNX + jx; if (GD[j] !== -1) continue; const dd = Math.hypot(dx, dz) * CELL; if (dd < best) { best = dd; hp = H0[j]; } }
        if (best < RP) { const w = sm(best / RP); GH[i] = hp * (1 - w) + H0[i] * w; } }
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

export { CELL, GX0, GZ0, GNX, GNZ, GH, GD, GI, GP, GR, GCP, NOSE, HB, H, slopeAt, inPit };
