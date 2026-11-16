// Malla del terreno vista desde las operaciones: tipo de celda (gdAt, onRoadC) y caminos más baratos sobre ella (floorPath para huellas, cableRoute para cables).
import { mundo as M } from '../mundo.js';
import { WR } from '../config/diseno.js';

const gdAt = (x, z) => { const fx = Math.round((x - M.GX0) / M.CELL), fz = Math.round((z - M.GZ0) / M.CELL); return (fx < 0 || fz < 0 || fx >= M.GNX || fz >= M.GNZ) ? 99 : M.GD[fz * M.GNX + fx]; };
const onRoadC = (x, z) => { const g = gdAt(x, z); return g >= 0 && g <= WR + 1; };
function floorPath(S, T) {      // huellas: camino más corto por el piso (o calzada) entre S y T, manteniéndose ~15 m lejos de paredes, pilas, canchas y equipos
  const pad = 260, i0 = Math.max(1, Math.floor((Math.min(S.x, T.x) - pad - M.GX0) / M.CELL)), i1 = Math.min(M.GNX - 2, Math.ceil((Math.max(S.x, T.x) + pad - M.GX0) / M.CELL)), j0 = Math.max(1, Math.floor((Math.min(S.z, T.z) - pad - M.GZ0) / M.CELL)), j1 = Math.min(M.GNZ - 2, Math.ceil((Math.max(S.z, T.z) + pad - M.GZ0) / M.CELL));
  const W = i1 - i0 + 1, Hh = j1 - j0 + 1, N = W * Hh, pass = new Uint8Array(N), cost = new Float32Array(N);
  const blk = M.OBST.filter(o => o.r >= 6);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const g = M.GD[(j + j0) * M.GNX + i + i0]; pass[j * W + i] = (g === -1 || (g >= 0 && g <= WR + 2)) ? 1 : 0; }
  for (const o of blk) { const r = o.r + 6, ci = Math.round((o.x - M.GX0) / M.CELL) - i0, cj = Math.round((o.z - M.GZ0) / M.CELL) - j0, n = Math.ceil(r / M.CELL); for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= W || j >= Hh || Math.hypot(di, dj) * M.CELL > r) continue; pass[j * W + i] = 0; } }
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { if (!pass[j * W + i]) continue; let n = 0; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= Hh || !pass[b * W + a]) n++; } cost[j * W + i] = 1 + 0.5 * n; }
  const ci = p => (Math.max(0, Math.min(Hh - 1, Math.round((p.z - M.GZ0) / M.CELL) - j0))) * W + Math.max(0, Math.min(W - 1, Math.round((p.x - M.GX0) / M.CELL) - i0));
  const s = ci(S), t = ci(T); pass[s] = pass[t] = 1; if (!cost[s]) cost[s] = 1; if (!cost[t]) cost[t] = 1;
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), hp = [], hv = [];
  const push = (i, f) => { hp.push(i); hv.push(f); let k = hp.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (hv[q] <= hv[k]) break; [hp[q], hp[k]] = [hp[k], hp[q]]; [hv[q], hv[k]] = [hv[k], hv[q]]; k = q; } };
  const pop = () => { const top = hp[0], li = hp.pop(), lv = hv.pop(); if (hp.length) { hp[0] = li; hv[0] = lv; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hp.length && hv[l] < hv[m]) m = l; if (r < hp.length && hv[r] < hv[m]) m = r; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; [hv[m], hv[k]] = [hv[k], hv[m]]; k = m; } } return top; };
  g[s] = 0; push(s, 0);
  while (hp.length) { const i = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break; const x = i % W, z = (i / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const a = x + di, b = z + dj; if (a < 0 || b < 0 || a >= W || b >= Hh) continue; const k = b * W + a; if (!pass[k] || done[k]) continue; const nv = g[i] + cost[k] * Math.hypot(di, dj); if (nv < g[k]) { g[k] = nv; from[k] = i; push(k, nv); } } }
  if (from[t] < 0 && t !== s) return null;
  const out = []; for (let i = t; i >= 0; i = from[i]) { out.push({ x: M.GX0 + (i % W + i0) * M.CELL, z: M.GZ0 + ((i / W | 0) + j0) * M.CELL }); if (i === s) break; }
  out.reverse(); const keep = [out[0]]; for (let k = 1; k < out.length - 1; k += 3) keep.push(out[k]); keep.push(out[out.length - 1]); return keep;
}
function cableRoute(S, T, avoid) {      // recorrido más barato por la malla: caras y bermas de los bancos baratas; pisos donde se circula, pilas y caminos caros (un camino se cruza solo si hace falta)
  const N = M.GNX * M.GNZ, ci = (x, z) => Math.max(0, Math.min(M.GNZ - 1, Math.round((z - M.GZ0) / M.CELL))) * M.GNX + Math.max(0, Math.min(M.GNX - 1, Math.round((x - M.GX0) / M.CELL)));
  const extra = new Float32Array(N), mark = (x, z, r, c) => { for (let dz = -r; dz <= r; dz += M.CELL) for (let dx = -r; dx <= r; dx += M.CELL) if (dx * dx + dz * dz <= r * r) { const i = ci(x + dx, z + dz); extra[i] = Math.max(extra[i], c); } };
  M.OBST.forEach(o => { if (o.r >= 3) mark(o.x, o.z, o.r + 2, 1e4); });      // equipos: no pasa por debajo
  (avoid || []).forEach(p => mark(p.x, p.z, p.r, 80));      // donde circulan camiones o la camioneta
  const cost = i => { const d = M.GD[i]; let c = (d >= 0 && d <= WR + 1) ? 40 : d === -1 ? (M.PLAT7[i] ? 2 : 25) : d === -2 ? 30 : 1; return c + extra[i]; };
  const s = ci(S.x, S.z), t = ci(T.x, T.z), tx = t % M.GNX, tz = Math.floor(t / M.GNX);
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const hp = [], hv = [], push = (i, f) => { hp.push(i); hv.push(f); let k = hp.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (hv[q] <= hv[k]) break; [hp[q], hp[k]] = [hp[k], hp[q]]; [hv[q], hv[k]] = [hv[k], hv[q]]; k = q; } };
  const pop = () => { const top = hp[0], li = hp.pop(), lv = hv.pop(); if (hp.length) { hp[0] = li; hv[0] = lv; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hp.length && hv[l] < hv[m]) m = l; if (r < hp.length && hv[r] < hv[m]) m = r; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; [hv[m], hv[k]] = [hv[k], hv[m]]; k = m; } } return top; };
  g[s] = 0; push(s, 0);
  while (hp.length) {
    const i = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break;
    const ix = i % M.GNX, iz = Math.floor(i / M.GNX), ci0 = cost(i);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= M.GNX || jz >= M.GNZ) continue;
      const j = jz * M.GNX + jx; if (done[j]) continue; const ng = g[i] + (ci0 + cost(j)) * 0.5 * (dx && dz ? 1.414 : 1);
      if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + Math.hypot(jx - tx, jz - tz)); } }
  }
  const P = []; for (let i = t; i >= 0; i = from[i]) { P.push({ x: M.GX0 + (i % M.GNX) * M.CELL, z: M.GZ0 + Math.floor(i / M.GNX) * M.CELL }); if (i === s) break; }
  P.reverse(); P[0] = { x: S.x, z: S.z }; P[P.length - 1] = { x: T.x, z: T.z };
  for (let it = 0; it < 2; it++) for (let k = 1; k < P.length - 1; k++) { const a = P[k - 1], b = P[k + 1], q = { x: (a.x + b.x + P[k].x * 2) / 4, z: (a.z + b.z + P[k].z * 2) / 4 }; if (onRoadC(q.x, q.z) === onRoadC(P[k].x, P[k].z)) P[k] = q; }      // suaviza sin mover los cruces
  return P;
}

export { gdAt, onRoadC, floorPath, cableRoute };
