f = r"c:/Users/Usuario/Documents/juegos/rajo-kart/index.html"
h = open(f, encoding="utf8").read()
a = h.index("// Bancos bajo la fase 7, en la curva del celeste"); b = h.index("// Canchas de perforación: un banco")
js = r"""// Isla de bancos entre la celeste y la fase 7 (como se ve en Maps): pared pareja de bancos de 16 m con berma de 6 m que sube desde los caminos (los dos tramos de la celeste, la azul y la entrada a la fase 7) hasta el piso de la fase 7; los bancos corren paralelos al camino y doblan en recta en sus quiebres
(() => {
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
    const w = Math.min(1, -de / BL); GH[i] = GH[i] * (1 - w) + hb * w; HB[i] = -1;
  }
})();
"""
h = h[:a] + js + h[b:]
open(f, "w", encoding="utf8", newline="").write(h); print("ok")
