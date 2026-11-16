// Malla de alturas del terreno (GH: cota, GD: tipo de celda, GI: punto de ruta más cercano, HB: base de la escalera de bancos) y la membrana que la arma; H(x, z) la lee.
import { BENCH, FLOOR, FRAD, WR, YTOP } from '../config/diseno.js';
import { FPOLY, PATIOS, RIMPOLY, SEC } from '../datos/caminos.js';
import { inPoly } from '../comun/mates.js';
import { paso } from '../comun/pasos.js';
import { F7, L, NS, PLAT, SEC_FIXH, f7h, floorD, hr, inF7, ptx, ptz, px, pz } from './ruta.js';

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
});
function H(x, z) {
  let fx = (x - GX0) / CELL, fz = (z - GZ0) / CELL;
  if (fx < 0) fx = 0; else if (fx > GNX - 1.001) fx = GNX - 1.001;
  if (fz < 0) fz = 0; else if (fz > GNZ - 1.001) fz = GNZ - 1.001;
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * GNX + ix;
  return (GH[i] * (1 - tx) + GH[i + 1] * tx) * (1 - tz) + (GH[i + GNX] * (1 - tx) + GH[i + GNX + 1] * tx) * tz;
}
function slopeAt(x, z) { const e = 1.5; return Math.hypot(H(x + e, z) - H(x - e, z), H(x, z + e) - H(x, z - e)) / (2 * e); }

export { CELL, GX0, GZ0, GNX, GNZ, GH, GD, GI, NOSE, HB, H, slopeAt };
