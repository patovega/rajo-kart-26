import json, math, re
F = r"c:/Users/Usuario/Documents/juegos/rajo-kart/index.html"; h = open(F, encoding="utf8").read()
i = h.index("const SEC = ["); j = h.index("];      // caminos interiores", i); S = json.loads(h[i+12:j+1].replace("\n", ""))
names = h[j:h.index("\n", j)].split(":")[1].strip().split(", "); N = {n: k for k, n in enumerate(names)}
F7HN = float(re.search(r"F7HN = (-?\d+);", h).group(1)); F7A = (-202.5, -580.5); R0 = (650.0, 487.7)
def f7h(x, z):
    bx, bz = R0[0]-F7A[0], R0[1]-F7A[1]; t = max(0, min(1, ((x-F7A[0])*bx + (z-F7A[1])*bz) / (bx*bx+bz*bz))); return -80 + (F7HN + 80) * (1 - t)
def dens(P, step=8):
    out = []
    for a, b in zip(P, P[1:]):
        n = max(1, int(math.hypot(b[0]-a[0], b[1]-a[1]) / step))
        for q in range(n): out.append([a[0] + (b[0]-a[0]) * q / n, a[1] + (b[1]-a[1]) * q / n])
    out.append(list(P[-1])); return out
def cum(P):
    c = [0]
    for k in range(1, len(P)): c.append(c[-1] + math.hypot(P[k][0]-P[k-1][0], P[k][1]-P[k-1][1]))
    return c
# 1) bajada de la azul (zigzag) a la fase 7: sale del zigzag cerca de la punta norponiente y baja por dentro de la pared norte hasta el piso
z = S[N['zigzag']]; k0 = min(range(len(z)), key=lambda m: math.hypot(z[m][0] + 383, z[m][1] + 518)); P0 = z[k0]
ent = dens([[P0[0], P0[1]], [-300, -560], [-210, -583], [-194, -556], [8, -624], [216, -610], [370, -556], [400, -520]])
c = cum(ent); hA, hB = P0[2], f7h(400, -520)
for m, p in enumerate(ent): p.append(round(hA + (hB - hA) * c[m] / c[-1], 1))
print('entrada_f7: %d pts, %.0f m, %.1f -> %.1f (%.1f %%)' % (len(ent), c[-1], hA, hB, (hA - hB) / c[-1] * 100))
# 2) triángulo en el empalme rosado–naranjo (arriba del rajo, todo a 176): tercer lado entre el rosado_ext y el naranjo
re_ = S[N['rosado_ext']]; na = S[N['naranjo']]
def at(P, dist, from_end):
    c = cum(P); tgt = c[-1] - dist if from_end else dist; m = min(range(len(P)), key=lambda k: abs(c[k] - tgt)); return P[m]
a = at(re_, 130, True); b = at(na, 130, False)
tri = [[round(a[0], 1), round(a[1], 1), 176.0], [round((a[0] + b[0]) / 2 + 12, 1), round((a[1] + b[1]) / 2 + 12, 1), 176.0], [round(b[0], 1), round(b[1], 1), 176.0]]
print('triangulo', tri)
S.append([[round(p[0], 1), round(p[1], 1), p[2]] for p in ent]); names.append('entrada_f7'); S.append(tri); names.append('triangulo')
c3 = lambda a: ", ".join("[%.1f, %.1f, %.1f]" % tuple(p) for p in a)
js = "const SEC = [\n" + ",\n".join("  [%s]" % c3(P) for P in S) + "\n];      // caminos interiores [x, z, cota]: " + ", ".join(names) + "\n"
a0 = h.index("const SEC = [\n"); b0 = h.index("\n", h.index("];      // caminos interiores", a0)) + 1; h = h[:a0] + js + h[b0:]
# 3) patios planos en los empalmes (como en la mina): zigzag–entrada, azul1–rosado, zigzag–celeste, azul2–verde–zigzag
ce = S[N['celeste']]; az2 = S[N['azul2']]
pat = [[P0[0], P0[1], P0[2], 55], [-242.1, -752.8, 80, 55], [ce[0][0], ce[0][1], ce[0][2], 55], [az2[-1][0], az2[-1][1], az2[-1][2], 55]]
pj = "const PATIOS = [%s];      // patios planos en los empalmes [x, z, cota, radio]: zigzag–entrada fase 7, azul1–rosado, zigzag–celeste, azul2–verde–zigzag\n" % ", ".join("[%.1f, %.1f, %.1f, %d]" % tuple(p) for p in pat)
anchor = "const SEC_FIXH = "
assert h.count(anchor) == 1; h = h.replace(anchor, pj + anchor)
old = "        F[i] = H2[k]; fix[i] = 1; red[i] = 1; rd[i] = dd;\n      }\n    });\n"
assert h.count(old) == 1
new = old + """    if (H2) for (const [qx, qz, qh, qr] of PATIOS) {      // patio del empalme: plano a la cota del cruce, entre los caminos que se juntan
      const ix0 = Math.round((qx - GX0) / CELL), iz0 = Math.round((qz - GZ0) / CELL), n = Math.ceil(qr / CELL);
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const ix = ix0 + b, iz = iz0 + a; if (ix < 1 || iz < 1 || ix >= GNX - 1 || iz >= GNZ - 1) continue; const i = iz * GNX + ix;
        if (fix[i] || Math.hypot(GX0 + ix * CELL - qx, GZ0 + iz * CELL - qz) > qr) continue; F[i] = qh; fix[i] = 1; red[i] = 1; }
    }
"""
h = h.replace(old, new)
open(F, "w", encoding="utf8", newline="").write(h); print("ok")
