// Fondo mina y fase 7 sobre la malla de alturas: pisos y pilas, equipos de la fase 7 (F7EQ), camino antiguo, bancos de 16 m con berma, isla celeste–fase 7 (PLAT7) y canchas de perforación (padTerrain). Solo modifica GH/GD; no toca la escena.
import { BENCH, FLOOR, TAU, WR, YTOP } from '../config/diseno.js';
import { PATIOS, SEC } from '../datos/caminos.js';
import { D52 } from '../datos/fase7.js';
import { hash, inPoly } from '../comun/mates.js';
import { paso } from '../comun/pasos.js';
import { F7, START_S, f7h, floorD, frame, hr, inF7, px } from './ruta.js';
import { CELL, GD, GH, GI, GNX, GNZ, GX0, GZ0, H, HB } from './alturas.js';

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

export { RAMPS, PITB, PIT, pileTerrain, sdPoly, RED52, BLUE52, inBB, inBlue, inRed, faceSpot, F7EQ, PLAT7, PAD_UP, pretil, padTerrain };
