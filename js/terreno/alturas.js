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
const MORROS = [      // morros que quedan en el lado del fondo de un camino, marcados por el usuario (polígono en coordenadas del juego, cota en m)
  { poly: [[36, -358], [90, -340], [195, -338], [200, -356], [235, -356], [240, -338], [334, -338], [342, -246], [250, -254], [96, -272], [36, -312]], cota: 1238 },      // lomo al poniente de la fase 7, entre el camino de la cota 1237 y la bajada al fondo (23-11-2026)
  { poly: [[472, -86], [628, -86], [642, -62], [628, -50], [556, -38], [516, -20], [472, -12]], cota: 1279, parejo: true },      // banco de la malla de la perforadora de la fase 7: todo a 1279, desde la cresta del frente de la pala 2 hasta la orilla del camino de 1296 (pedido del usuario, 23-11-2026)
  { poly: [[648, -40], [690, -88], [730, -120], [744, -100], [740, -30], [726, 2], [690, -2], [650, -8]], cota: 0, aCamino: true },      // cuña entre las dos rampas que bajan de 1296 a la explanada de la malla: a la cota de la rampa más cercana (pedido del usuario, 23-11-2026)
  { poly: [[633, -8], [700, -20], [722, 24], [745, 50], [712, 118], [630, 128], [519, 128], [525, 64], [578, 21]], cota: 1279, parejo: true },      // extremo oriente de la explanada de la malla, entre el camino del sur y la pared (pedido del usuario, 23-11-2026)
  { poly: [[715, -56], [706, -5], [698, 15], [691, 27], [672, 48], [665, 52], [650, 55], [630, 55], [601, 51], [571, 53], [534, 66], [490, 60], [477, 61], [480, 2], [560, -4], [660, -8], [700, -20]], cota: 1279, parejo: true },      // isla con puntas entre el camino de 1279 y el que baja a la celeste: a 1279, una sola explanada (pedido del usuario, 23-11-2026)
  { poly: [[165, -538], [203, -562], [287, -561], [347, -544], [383, -525], [369, -483], [320, -467], [249, -474], [197, -490], [170, -510]], cota: 1295.6, parejo: true },      // explanada rota al oriente de la cancha de la perforadora: plana a la cota de la explanada donde termina la bajada norte (pedido del usuario, 24-11-2026)
  { poly: [[165, -628], [200, -646], [345, -650], [345, -594], [264, -604], [212, -608], [176, -614]], cota: 0, entre: true },      // adentro de la curva en U de la bajada norte: bancos limpios del tramo de abajo al de arriba (antes una zanja y después un paredón liso; pedido del usuario, 24-11-2026)
  { poly: [[-70, -512], [40, -506], [150, -516], [150, -452], [64, -452], [-43, -463], [-70, -470]], cota: 1311, banco: true },      // talud entre la cancha de la perforadora (1311) y la celeste: bancos limpios desde la orilla del camino (pedido del usuario, 24-11-2026)
  { poly: [[150, -516], [250, -514], [250, -436], [205, -437], [179, -446], [150, -452]], cota: 1296, banco: true },      // lo mismo entre la explanada de 1296 y la celeste
  { poly: [[354, -288], [392, -292], [392, -215], [410, -200], [436, -172], [452, -160], [452, -100], [430, -100], [415, -131], [381, -184], [363, -216]], cota: 1264, banco: true },      // orilla poniente del piso de la fase 7 contra el camino de 1250–1261: banco desde la orilla del camino hasta el piso (había una zanja de 14 m por donde se metía la camioneta; pedido del usuario, 24-11-2026)
  { poly: [[160, -680], [345, -668], [470, -668], [520, -690], [470, -730], [304, -742], [150, -735], [130, -705]], cota: 0, entre: true },      // zanja al pie de la pared norte, entre el tramo de arriba de la U (1320–1350) y el camino de 1370–1410: bancos limpios de uno al otro (pedido del usuario, 24-11-2026)
  { poly: [[345, -652], [480, -650], [520, -640], [520, -622], [345, -622]], cota: 0, bajan: true },      // entre el tramo de arriba de la U y la explanada de 1296: bancos que bajan desde la orilla del camino (antes un paredón liso)
  { poly: [[20, -766], [180, -767], [304, -765], [380, -752], [440, -735], [452, -790], [452, -862], [170, -864], [20, -850]], cota: 0, terraza: true, berma: 6, cara: 3, rango: 100 },      // pared alta del norte (1410–1520) sobre el camino de 1370–1410: cortada en bancos de 16 m (berma 6 m, cara 3 m ≈ 79°); la cresta se corre hacia atrás (pedido del usuario, 24-11-2026)
];
const PRETILES = [      // pretiles de tierra marcados a mano (eje de a a b, cota de la cresta, ancho arriba y talud: alto/horizontal); solo suben el terreno
  { a: [278, -409], b: [273, -449], cota: 1286, ancho: 3, talud: 2 },      // orilla poniente de la terraza de 1280 junto a la partida (cae 16 m al piso de la fase 7), entre el morro del cable y la loma del norte (pedido del usuario, 24-11-2026)
  { a: [392, -215], b: [435, -142], cota: 1270, ancho: 3, talud: 2 },      // entre el camino de 1255–1261 y el piso de la fase 7 (quedan casi a la misma cota): pretil para que no se pase del camino al piso (pedido del usuario, 24-11-2026)
  { a: [435, -142], b: [456, -86], cota: 1270, ancho: 3, talud: 2 },
];
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
  const EQ = new Uint8Array(N);      // 1 = piso con equipos (fase 7, fondo, canchas): los caminos no cambian su cota
  for (const Pz of PISOS_DWG) {      // los demás pisos planos del rajo (fondo, terrazas): celdas de piso (ahí van las palas, dozers y canchas; no se tocan las cotas)
    const xs = Pz.poly.map(p => p[0]), zs = Pz.poly.map(p => p[1]), i0 = Math.max(0, Math.floor((Math.min(...xs) - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((Math.max(...xs) - GX0) / CELL)), j0 = Math.max(0, Math.floor((Math.min(...zs) - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((Math.max(...zs) - GZ0) / CELL));
    const via = !Pz.f7 && !Pz.fondo && !Pz.cancha;      // piso sin carguío ni perforación: es camino (se pinta y se trata como tal)
    for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) { const i = iz * GNX + ix; if (GD[i] > WR + 2 && inPoly(GX0 + ix * CELL, GZ0 + iz * CELL, Pz.poly)) { GD[i] = -1; if (via) GR[i] = 1; else EQ[i] = 1; } }
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
    const h1r = Float32Array.from(hc);      // cota del camino más cercano antes de mezclar (el repavimentado la compara con la del segundo)
    for (let i = 0; i < N; i++) if (d2[i] < R && dmin[i] < R) {      // dos calzadas que se pisan: cota mezclada según la distancia a cada eje (sin costura con escalón)
      const w1 = 1 / (dmin[i] + 2) ** 2, w2 = 1 / (d2[i] + 2) ** 2; hc[i] = (hc[i] * w1 + h2[i] * w2) / (w1 + w2); }
    for (let i = 0; i < N; i++) { const d = dmin[i]; if (GD[i] === -1 && d <= WR) { GR[i] = 1; GCP[i] = 1; }      // camino que cruza un piso: la calzada se marca como camino (se pinta y tiene huellas) sin tocar la cota del piso; GCP = esa calzada (el mapa la dibuja blanca)
      if (d >= R || GD[i] <= WR) continue;      // la ruta principal manda en su calzada
      if (GD[i] <= WR + 14) { const wr = sm((GD[i] - WR) / 14), rs = d <= WR ? hc[i] : hc[i] * (1 - sm((d - WR) / 14)) + GH[i] * sm((d - WR) / 14); GH[i] = hr[GI[i]] * (1 - wr) + rs * wr; if (d <= WR) GR[i] = 1; continue; }      // franja de transición de la ruta con un camino interior al lado: la ruta se funde con el camino (no con el terreno natural, que dejaba un lomo de 10–25 m)
      if (d > WR && GH[i] - hc[i] >= 8) { const dd = d - WR, k = Math.floor(dd / 14), r = dd - 14 * k; GH[i] = Math.min(GH[i], hc[i] + 16 * k + 16 * Math.min(1, r / 6)); continue; }      // pared que sube desde el camino: bancos limpios (cara de 6 m, berma de 8 m), sin transición suave
      GH[i] = d <= WR ? hc[i] : hc[i] * (1 - sm((d - WR) / 14)) + GH[i] * sm((d - WR) / 14); if (d <= WR) GR[i] = 1; }
    for (let i = 0; i < N; i++) if (GD[i] === -1 && dmin[i] <= WR && GH[i] - hc[i] >= 3) GH[i] = hc[i];
    { const H0 = Float32Array.from(GH);      // camino que va muy por encima de un piso: terraplén (calzada a su cota y talud de 14 m hasta el piso)
      for (let i = 0; i < N; i++) { const d = dmin[i]; if (GD[i] !== -1 || d >= R || hc[i] - H0[i] < 3) continue; GH[i] = d <= WR ? hc[i] : Math.max(H0[i], hc[i] * (1 - sm((d - WR) / 14)) + H0[i] * sm((d - WR) / 14)); } }      // camino que va muy por debajo de un piso: la calzada se excava a través del piso (en corte)
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
    const ENT = [];      // celdas rellenadas «entre» dos caminos: se suavizan al final (los tramos más cercanos cambian de celda en celda)
    for (const { poly, cota, parejo, aCamino, banco, entre, terraza, bajan, berma = 8, cara = 6, rango = WR + 45 } of MORROS) {      // aCamino: cada celda a la cota del camino más cercano (cuña entre dos rampas)      // morros marcados a mano en el lado del fondo de un camino: se rebajan a la cota dada (solo baja)
      const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]), y = cota - DWG.YC;
      for (let iz = Math.floor((Math.min(...zs) - GZ0) / CELL); iz <= Math.ceil((Math.max(...zs) - GZ0) / CELL); iz++) for (let ix = Math.floor((Math.min(...xs) - GX0) / CELL); ix <= Math.ceil((Math.max(...xs) - GX0) / CELL); ix++) {
        const i = iz * GNX + ix, bq = e => { const k = Math.floor(e / 14); return 16 * k + 16 * Math.min(1, (e - 14 * k) / 6); };      // perfil de bancos desde la orilla de un camino: cara de 16 m en 6 m, berma de 8 m
        if (entre) { const x = GX0 + ix * CELL, z = GZ0 + iz * CELL; if (inPoly(x, z, poly)) {      // entre dos caminos: bancos desde la orilla del de abajo hasta la cota del de arriba
            let lo = null, up = null;
            for (const C of CAMINOS_DWG) for (let k = 0; k < C.length - 1; k++) {      // por tramo (los dos lados de una curva en U son el mismo camino)
              const [ax, az, ay] = C[k], [bx, bz, byy] = C[k + 1], vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)), d = Math.hypot(x - ax - vx * t, z - az - vz * t);
              if (d > rango) continue; const yy = ay + (byy - ay) * t; if (!lo || yy < lo.y) lo = { y: yy, d }; if (!up || yy > up.y) up = { y: yy, d }; }
            if (lo && up && up.y - lo.y > 2 && lo.d > WR && up.d > WR) { const e = lo.d - WR, P_ = berma + cara, k = Math.floor(e / P_); GH[i] = Math.min(up.y, lo.y + 16 * k + 16 * Math.min(1, (e - k * P_) / cara)); ENT.push(i); } } continue; }
        if (bajan) { if (dmin[i] > WR && dmin[i] < R3 && GH[i] < hc[i] && inPoly(GX0 + ix * CELL, GZ0 + iz * CELL, poly)) GH[i] = Math.max(GH[i], hc[i] - bq(dmin[i] - WR)); continue; }      // bajo un camino: bancos que bajan desde la orilla (rellena el pie de un paredón)
        if (terraza) { const x = GX0 + ix * CELL, z = GZ0 + iz * CELL; if (inPoly(x, z, poly)) {      // pared sobre un camino: se corta en bancos desde la orilla del camino más bajo cercano (solo baja: la cresta se corre hacia atrás)
            let lo = null; for (const C of CAMINOS_DWG) for (let k = 0; k < C.length - 1; k++) { const [ax, az, ay] = C[k], [bx, bz, byy] = C[k + 1], vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)), d = Math.hypot(x - ax - vx * t, z - az - vz * t);
              if (d > rango) continue; const yy = ay + (byy - ay) * t; if (!lo || yy < lo.y) lo = { y: yy, d }; }
            if (lo && lo.d > WR) { const e = lo.d - WR, P_ = berma + cara, k = Math.floor(e / P_); GH[i] = Math.min(GH[i], lo.y + 16 * k + 16 * Math.min(1, (e - k * P_) / cara)); } } continue; }      // pared sobre un camino: se corta en bancos limpios desde la orilla (solo baja: la cresta queda más atrás)      // banco: desde la orilla del camino, cara de 16 m en 6 m y berma de 8 m, hasta la cota dada
        const yi = aCamino ? hc[i] : y; if ((GH[i] > yi || parejo) && inPoly(GX0 + ix * CELL, GZ0 + iz * CELL, poly)) GH[i] = yi; } }
    { const es = new Uint8Array(N); for (const i of ENT) es[i] = 1;
      for (let it = 0; it < 3; it++) { const T = Float32Array.from(GH); for (const i of ENT) { let a = 0, n = 0; for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const j = i + b * GNX + c; if (es[j]) { a += T[j]; n++; } } GH[i] = a / n; } } }
    for (let it = 0; it < 3; it++) for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) {      // puntas sueltas (una celda más alta que todas sus vecinas, restos de los tallados): a la altura de la vecina más alta
      const i = iz * GNX + ix; let mx = -1e9; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (a || b) mx = Math.max(mx, GH[i + b * GNX + a]);
      if (GH[i] > mx + 2.5) GH[i] = mx; }
    {      // repavimentado (pedido del usuario, 24-11-2026: «revisa todos los caminos y ve que estén parejos»): cada camino interior queda a la cota de su diseño (pendiente pareja, sin escalones,
           // lomos ni hoyos de los tallados de arriba: pisos, morros, empalmes), con la calzada plana de lado a lado; donde manda otra cosa (la ruta, un piso con equipos, el cruce con otro camino)
           // la cota se empalma suave con lo que hay ahí, en ≥ 30 m y sin más de 5 % de pendiente extra
      const G1 = Float32Array.from(GH), cellAt = (x, z) => Math.min(GNZ - 1, Math.max(0, Math.round((z - GZ0) / CELL))) * GNX + Math.min(GNX - 1, Math.max(0, Math.round((x - GX0) / CELL)));
      const Hg = (x, z) => { let fx = Math.min(GNX - 1.001, Math.max(0, (x - GX0) / CELL)), fz = Math.min(GNZ - 1.001, Math.max(0, (z - GZ0) / CELL)); const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * GNX + ix;
        return (G1[i] * (1 - tx) + G1[i + 1] * tx) * (1 - tz) + (G1[i + GNX] * (1 - tx) + G1[i + GNX + 1] * tx) * tz; };
      const manda = i => (GD[i] >= 0 && GD[i] <= WR) || EQ[i] === 1 || (d2[i] < WR + 6 && Math.abs(h1r[i] - h2[i]) > 1);      // celda donde el camino no decide su cota (en la franja de transición de la ruta se funde con ella, abajo)
      const bd = new Float32Array(N).fill(1e9), by = new Float32Array(N), toc2 = [], RB = WR + 8, nB = Math.ceil(RB / CELL);
      CAMINOS_DWG.forEach((C, r) => {
        const S = []; let acc = 0;
        for (let k = 0; k < C.length - 1; k++) { const [ax, az, ay] = C[k], [bx, bz, by_] = C[k + 1], l = Math.hypot(bx - ax, bz - az); if (l < 1e-6) continue; const m = Math.max(1, Math.round(l / 2));
          for (let q = 0; q < m; q++) { const t = q / m; S.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, y: ay + (by_ - ay) * t, s: acc + l * t }); } acc += l; }
        { const e = C[C.length - 1]; S.push({ x: e[0], z: e[1], y: e[2], s: acc }); }
        const n = S.length; if (n < 3) return;
        const fijo = S.map(p => { const i = cellAt(p.x, p.z); return manda(i) || id1[i] !== r; });
        const fa = new Int32Array(n), fb = new Int32Array(n);
        for (let i = 0, last = -1; i < n; i++) { if (fijo[i]) last = i; fa[i] = last; }
        for (let i = n - 1, last = -1; i >= 0; i--) { if (fijo[i]) last = i; fb[i] = last; }
        const Y = new Float32Array(n);
        for (let i = 0; i < n; i++) { const p = S[i]; if (fijo[i]) { Y[i] = Hg(p.x, p.z); continue; }
          let c = 0, w = 0; for (const j of [fa[i], fb[i]]) { if (j < 0) continue; const D = Hg(S[j].x, S[j].z) - S[j].y, Lt = Math.max(30, Math.abs(D) / 0.05), u = Math.abs(p.s - S[j].s) / Lt; if (u < 1) { const k = 1 - sm(u); c += D * k; w += k; } }
          Y[i] = p.y + (w > 1 ? c / w : c); }
        toc2.length = 0;
        for (let k = 0; k < n - 1; k++) { const a = S[k], b = S[k + 1], vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1;
          const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - GX0) / CELL) - nB), i1 = Math.min(GNX - 1, Math.ceil((Math.max(a.x, b.x) - GX0) / CELL) + nB), j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - GZ0) / CELL) - nB), j1 = Math.min(GNZ - 1, Math.ceil((Math.max(a.z, b.z) - GZ0) / CELL) + nB);
          for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) { const x = GX0 + ix * CELL, z = GZ0 + iz * CELL, tt = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / L2)), d = Math.hypot(x - a.x - vx * tt, z - a.z - vz * tt), i = iz * GNX + ix;
            if (d < RB && d < bd[i]) { if (bd[i] === 1e9) toc2.push(i); bd[i] = d; by[i] = Y[k] + (Y[k + 1] - Y[k]) * tt; } } }
        for (const i of toc2) { const d = bd[i], y = by[i]; bd[i] = 1e9; if (id1[i] !== r || manda(i)) continue;
          let yy = d <= WR ? y : y * (1 - sm((d - WR) / 8)) + GH[i] * sm((d - WR) / 8); if (GD[i] >= 0 && GD[i] <= WR + 14) { const wr = sm((GD[i] - WR) / 14); yy = hr[GI[i]] * (1 - wr) + yy * wr; } GH[i] = yy; }
      });
    }
    for (const { a: [ax, az], b: [bx, bz], cota, ancho, talud } of PRETILES) {      // pretiles a mano: al final, sobre todo lo demás
      const top = cota - 1700, R = ancho / 2 + 30 / talud, vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - R - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((Math.max(ax, bx) + R - GX0) / CELL)), j0 = Math.max(0, Math.floor((Math.min(az, bz) - R - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((Math.max(az, bz) + R - GZ0) / CELL));
      for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) { const x = GX0 + ix * CELL, z = GZ0 + iz * CELL, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)), d = Math.hypot(x - ax - vx * t, z - az - vz * t), i = iz * GNX + ix;
        GH[i] = Math.max(GH[i], top - Math.max(0, d - ancho / 2) * talud); }
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
