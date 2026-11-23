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
    const dmin = new Float32Array(N).fill(1e9), hc = new Float32Array(N), R = WR + 14, R2 = WR + 50, R3 = WR + 80, nR = Math.ceil(R3 / CELL);      // R3: alcance del lado que mira al fondo (ahí el terreno nunca sube sobre el camino)
         // R2: alcance de los bancos contra pisos más altos
    const d2 = new Float32Array(N).fill(1e9), h2 = new Float32Array(N), id1 = new Int32Array(N).fill(-1), dr = new Float32Array(N).fill(1e9), hr_ = new Float32Array(N), toc = [];
    const fr_ = new Float32Array(N * 2), f1 = new Float32Array(N * 2), G0 = Float32Array.from(GH);      // dirección hacia el fondo (0, 0 = ninguna) si la celda queda del lado cuesta abajo de su camino más cercano
    const Hc = (x, z) => { const ix = Math.min(GNX - 1, Math.max(0, Math.round((x - GX0) / CELL))), iz = Math.min(GNZ - 1, Math.max(0, Math.round((z - GZ0) / CELL))); return GH[iz * GNX + ix]; };      // segundo camino más cercano (para mezclar donde se pisan dos calzadas)
    CAMINOS_DWG.forEach((C, r) => {
      toc.length = 0;
      for (let k = 0; k < C.length - 1; k++) {
      const [ax, az, ay] = C[k], [bx, bz, by] = C[k + 1], vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
      let ndx = 0, ndz = 0; { const ln = Math.sqrt(L2), nx = -vz / ln, nz = vx / ln, mx = (ax + bx) / 2, mz = (az + bz) / 2, hm0 = (ay + by) / 2; let hp = 0, hm = 0;      // lado del fondo del tramo: el lado cuyo terreno a 50–90 m queda bajo el camino (si los dos suben, va en trinchera y no hay lado del fondo)
        for (const e of [50, 70, 90]) { hp += Hc(mx + nx * e, mz + nz * e) / 3; hm += Hc(mx - nx * e, mz - nz * e) / 3; }
        if (Math.min(hp, hm) < hm0 - 3) { const sg = hp < hm ? 1 : -1; ndx = nx * sg; ndz = nz * sg; } }
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - GX0) / CELL) - nR), i1 = Math.min(GNX - 1, Math.ceil((Math.max(ax, bx) - GX0) / CELL) + nR), j0 = Math.max(0, Math.floor((Math.min(az, bz) - GZ0) / CELL) - nR), j1 = Math.min(GNZ - 1, Math.ceil((Math.max(az, bz) - GZ0) / CELL) + nR);
      for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
        const x = GX0 + ix * CELL, z = GZ0 + iz * CELL, tt = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)), d = Math.hypot(x - ax - vx * tt, z - az - vz * tt), i = iz * GNX + ix;
        if (d < dr[i]) { if (dr[i] === 1e9) toc.push(i); dr[i] = d; hr_[i] = ay + (by - ay) * tt; const lado = (x - ax - vx * tt) * ndx + (z - az - vz * tt) * ndz > 0.8 * d; fr_[2 * i] = lado ? ndx : 0; fr_[2 * i + 1] = lado ? ndz : 0; }      // de costado al tramo (no más allá de la punta del camino)
      }
      }
      for (const i of toc) { const d = dr[i], h = hr_[i]; dr[i] = 1e9;      // top-2 por camino distinto
        if (d < dmin[i]) { if (id1[i] !== r) { d2[i] = dmin[i]; h2[i] = hc[i]; } dmin[i] = d; hc[i] = h; id1[i] = r; f1[2 * i] = fr_[2 * i]; f1[2 * i + 1] = fr_[2 * i + 1]; }
        else if (d < d2[i]) { d2[i] = d; h2[i] = h; } }
    });
    const haciaFondo = i => {      // la celda queda del lado del camino que mira al fondo del rajo y es una loma: 40 m más allá el terreno ya está bajo el camino (si sigue subiendo es una pared, no se toca)
      const ux = f1[2 * i], uz = f1[2 * i + 1]; if (!ux && !uz) return false;
      const ix = i % GNX, iz = (i - ix) / GNX, jx = Math.round(ix + ux * 40 / CELL), jz = Math.round(iz + uz * 40 / CELL);
      return jx >= 0 && jz >= 0 && jx < GNX && jz < GNZ && G0[jz * GNX + jx] < hc[i]; };
    for (let i = 0; i < N; i++) if (d2[i] < R && dmin[i] < R) {      // dos calzadas que se pisan: cota mezclada según la distancia a cada eje (sin costura con escalón)
      const w1 = 1 / (dmin[i] + 2) ** 2, w2 = 1 / (d2[i] + 2) ** 2; hc[i] = (hc[i] * w1 + h2[i] * w2) / (w1 + w2); }
    for (let i = 0; i < N; i++) { const d = dmin[i]; if (GD[i] === -1 && d <= WR) { GR[i] = 1; GCP[i] = 1; }      // camino que cruza un piso: la calzada se marca como camino (se pinta y tiene huellas) sin tocar la cota del piso; GCP = esa calzada (el mapa la dibuja blanca)
      if (d >= R || GD[i] <= WR + 14) continue;      // la ruta principal manda donde se cruzan
      if (d > WR && GH[i] - hc[i] >= 8) { const dd = d - WR, k = Math.floor(dd / 14), r = dd - 14 * k; GH[i] = Math.min(GH[i], hc[i] + 16 * k + 16 * Math.min(1, r / 6)); continue; }      // pared que sube desde el camino: bancos limpios (cara de 6 m, berma de 8 m), sin transición suave
      GH[i] = d <= WR ? hc[i] : hc[i] * (1 - sm((d - WR) / 14)) + GH[i] * sm((d - WR) / 14); if (d <= WR) GR[i] = 1; }
    for (let i = 0; i < N; i++) if (GD[i] === -1 && dmin[i] <= WR && GH[i] - hc[i] >= 3) GH[i] = hc[i];      // camino que va muy por debajo de un piso: la calzada se excava a través del piso (en corte)
    for (let i = 0; i < N; i++) { const d = dmin[i]; if (d <= WR || d >= R3 || GH[i] - hc[i] < 8 || (GD[i] >= 0 && GD[i] <= WR + 14)) continue;
      if (d >= R2 || GH[i] - hc[i] < 8) continue;      // toda pared que sube desde un camino (no solo pisos): bancos      // camino que pasa bajo el borde de un piso más alto: la pared se talla en bancos de 16 m con berma de 8 m (no un corte vertical)
      const dd = d - WR, k = Math.floor(dd / 14), r = dd - 14 * k; GH[i] = Math.min(GH[i], hc[i] + 16 * k + 16 * Math.min(1, r / 6)); }
    {      // lado que mira al fondo del rajo: desde la orilla de la calzada el terreno solo baja (lomas, pretiles de tierra y bermas más altas que el camino quedan a su cota); donde eso dejaría un paredón contra terreno sin cortar, la celda vuelve a su altura
      const cut = new Uint8Array(N), H1 = Float32Array.from(GH);
      for (let i = 0; i < N; i++) { const d = dmin[i]; if (d > WR && d < R3 && GH[i] > hc[i] + 0.5 && GD[i] !== -1 && !(GD[i] >= 0 && GD[i] <= WR + 14) && haciaFondo(i)) { GH[i] = hc[i]; cut[i] = 1; } }
      for (let it = 0, cambio = 1; it < 40 && cambio; it++) { cambio = 0;
        for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) { const i = iz * GNX + ix; if (!cut[i]) continue;
          for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const j = i + b * GNX + a; if (!cut[j] && GH[j] > GH[i] + 12) { GH[i] = H1[i]; cut[i] = 0; cambio = 1; a = b = 2; } } } }
    }
    {      // empalme con los pisos: el piso no se toca (ahí están los equipos), así que el camino junto a él baja o sube a su cota en 20 m; sin esto quedaba un escalón vertical en el borde del piso
      const RP = 20, nP = Math.ceil(RP / CELL), H0 = Float32Array.from(GH);
      for (let i = 0; i < N; i++) { if (dmin[i] >= R || GD[i] <= WR + 14) continue;
        const ix = i % GNX, iz = (i - ix) / GNX; let best = RP, hp = 0;
        for (let dz = -nP; dz <= nP; dz++) for (let dx = -nP; dx <= nP; dx++) { const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= GNX || jz >= GNZ) continue; const j = jz * GNX + jx; if (GD[j] !== -1) continue; const dd = Math.hypot(dx, dz) * CELL; if (dd < best) { best = dd; hp = H0[j]; } }
        if (best < RP) { const w = sm(best / RP); GH[i] = hp * (1 - w) + H0[i] * w; } }
    }
    for (let it = 0; it < 3; it++) for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) {      // puntas sueltas (una celda más alta que todas sus vecinas, restos de los tallados): a la altura de la vecina más alta
      const i = iz * GNX + ix; let mx = -1e9; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (a || b) mx = Math.max(mx, GH[i + b * GNX + a]);
      if (GH[i] > mx + 2.5) GH[i] = mx; }
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
