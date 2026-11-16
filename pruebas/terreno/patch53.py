f = r"c:/Users/Usuario/Documents/juegos/rajo-kart/index.html"
h = open(f, encoding="utf8").read()
S = 0.6732
W = lambda pts: [[round(-262.5 + (x + 61) * S, 1), round(-708 + (y + 140) * S, 1)] for x, y in pts]
CR = [   # crestas dibujadas (imagen 53), de abajo (junto al celeste interior) hacia arriba (fase 7)
  (1, [(700,750),(660,825),(660,1000),(662,1200),(640,1260),(615,1320),(600,1395),(440,1515),(275,1640)]),
  (2, [(700,755),(693,830),(697,920),(712,1000),(716,1060),(705,1150),(685,1250),(665,1330)]),
  (2, [(565,1490),(680,1400),(735,1355)]),
  (3, [(705,760),(735,860),(760,980),(767,1080),(752,1200),(737,1305)]),
  (4, [(722,715),(772,850),(815,990),(822,1075),(805,1200),(787,1315)]),
  (5, [(742,712),(800,860),(843,1035),(845,1200),(838,1360)]),
  (6, [(790,712),(845,860),(888,960),(893,1100),(893,1330)]),
  (7, [(850,690),(930,895),(975,1165)]),
]
ENV = [(600,760),(700,690),(780,600),(900,690),(960,900),(1000,1170),(920,1330),(820,1380),(700,1430),(570,1510),(430,1580),(300,1660),(240,1640),(420,1490),(585,1385),(625,1250),(640,1000),(630,820)]
crs = "[" + ", ".join("[%d, %s]" % (k, str(W(p)).replace(" ", "")) for k, p in CR) + "]"
js = r"""// Bancos bajo la fase 7, en la curva del celeste que baja de ella: crestas como en el dibujo (paralelas, con su quiebre), del celeste interior (nivel 0) al piso de la fase 7 (nivel 8)
(() => {
  const ENV = sdPoly(%s), F7S = sdPoly(F7), CEL = SEC[7].slice(0, 140), NL = 8, A = 0.45, BL = 15;
  const CR = %s;
  const segD = (P, x, z) => { let b = 1e9; for (let k = 0; k < P.length - 1; k++) { const [ax, az] = P[k], [bx, bz] = P[k + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); b = Math.min(b, Math.hypot(ax + dx * t - x, az + dz * t - z)); } return b; };
  const sm = t => t * t * (3 - 2 * t);
  const i0 = Math.max(0, Math.floor((ENV.bb[0] - GX0) / CELL)), i1 = Math.min(GNX - 1, Math.ceil((ENV.bb[1] - GX0) / CELL)), j0 = Math.max(0, Math.floor((ENV.bb[2] - GZ0) / CELL)), j1 = Math.min(GNZ - 1, Math.ceil((ENV.bb[3] - GZ0) / CELL));
  for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
    const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL, de = ENV(x, z); if (de >= 0) continue;
    if ((GD[i] >= 0 && GD[i] <= WR + 2) || GD[i] === -1 || GD[i] === -2 || inF7(x, z)) continue;      // caminos, pisos y pilas no se tocan
    let d0 = 1e9, h0 = -70; for (const p of CEL) { const dd = Math.hypot(p[0] - x, p[1] - z); if (dd < d0) { d0 = dd; h0 = p[2]; } }
    const hT = f7h(x, z); if (hT < h0 + 8) continue;
    const L = [[0, Math.max(0, d0 - WR)], [NL, Math.max(0, F7S(x, z))]]; for (const [k, P] of CR) L.push([k, segD(P, x, z)]);
    L.sort((a, b) => a[1] - b[1]); const a = L[0], b = L.find(q => q[0] !== a[0]);
    const t = a[0] + (b[0] - a[0]) * a[1] / Math.max(0.5, a[1] + b[1]), m = Math.min(NL - 1, Math.floor(t)), fr = t - m, HS = (hT - h0) / NL;
    const hb = h0 + HS * (m + sm(Math.max(0, Math.min(1, (fr - (1 - A)) / A))));
    const w = Math.min(1, -de / BL); GH[i] = GH[i] * (1 - w) + hb * w; HB[i] = -1;
  }
})();
""" % (str(W(ENV)).replace(" ", ""), crs)
s = h.index("// Bancos bajo la fase 7 (entre su piso y el camino celeste)")
e = h.index("})();\n", s) + 6
assert h[e:].startswith("// Canchas de perforación"), h[e:e+60]
h = h[:s] + js + h[e:]
open(f, "w", encoding="utf8", newline="").write(h); print("ok")
