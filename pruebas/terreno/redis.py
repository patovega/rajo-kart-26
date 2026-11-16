# Rediseño de cotas: fondo más bajo, fase 7 más baja y pareja, celeste con pendiente real; el resto de caminos igual. Revisa pendientes y separación entre caminos.
import json, math, re, sys
F = r"c:/Users/Usuario/Documents/juegos/rajo-kart/index.html"; h = open(F, encoding="utf8").read()
i = h.index("const SEC = ["); j = h.index("];      // caminos interiores", i); S = json.loads(h[i+12:j+1].replace("\n", ""))
names = h[j:h.index("\n", j)].split(":")[1].strip().split(", ")
i = h.index("const ROUTE = ["); R = json.loads(h[i+14:h.index(";", i)])
BASE = sys.argv[1]=='base'; FLOOR = -192 if BASE else float(sys.argv[1]); F7HN = float(sys.argv[2]); HJ = float(sys.argv[3]); WRITE = len(sys.argv) > 4
cumR = [0]
for k in range(1, len(R)): cumR.append(cumR[-1] + math.hypot(R[k][0]-R[k-1][0], R[k][1]-R[k-1][1]))
SRIM = cumR[-1]; hr = lambda s: -80 + 256 * min(1, max(0, s / SRIM))
def routeS(x, z):
    k = min(range(len(R)), key=lambda m: math.hypot(R[m][0]-x, R[m][1]-z)); return cumR[k], math.hypot(R[k][0]-x, R[k][1]-z)
F7A = (-202.5, -580.5); R0 = R[0]
def f7h(x, z):
    bx, bz = R0[0]-F7A[0], R0[1]-F7A[1]; t = max(0, min(1, ((x-F7A[0])*bx + (z-F7A[1])*bz) / (bx*bx+bz*bz))); return -80 + (F7HN - -80) * (1 - t)
def cum(P):
    c = [0]
    for k in range(1, len(P)): c.append(c[-1] + math.hypot(P[k][0]-P[k-1][0], P[k][1]-P[k-1][1]))
    return c
N = {n: k for k, n in enumerate(names)}
if BASE: HJ=-73; F7HN=32
# zigzag: baja al 10 % hasta el empalme con el celeste (k=346) a cota HJ, luego parejo hasta el fondo
z = S[N['zigzag']]; cz = cum(z); J = 346
for k in (range(len(z)) if not BASE else []):
    if k <= J: z[k][2] = min(z[k][2], HJ + 0.1 * (cz[J] - cz[k]))
    else: z[k][2] = HJ + (FLOOR - HJ) * (cz[k] - cz[J]) / (cz[-1] - cz[J])
# celeste: de la fase 7 al empalme, parejo
c = S[N['celeste']]; cc = cum(c); hA = f7h(c[-1][0], c[-1][1])
for k in (range(len(c)) if not BASE else []): c[k][2] = HJ + (hA - HJ) * cc[k] / cc[-1]
# rojo_f7: sigue el piso de la fase 7
for p in (S[N['rojo_f7']] if not BASE else []): p[2] = f7h(p[0], p[1])
# rosado y naranjo: el extremo empalma a la cota de la ruta
for n in ('rosado', 'naranjo'):
    P = S[N[n]]; s, d = routeS(P[-1][0], P[-1][1]); P[-1][2] = hr(s); cp = cum(P)
    for k in range(len(P)-2, -1, -1): P[k][2] = min(P[k][2], P[k+1][2] + 0.1 * (cp[k+1] - cp[k]))
    print(n, 'fin a ruta s=%d d=%.0f cota %.1f' % (s, d, P[-1][2]))
# entrada_f7 se elimina (quedaba colgando: 18 m contra 59 m del zigzag)
del S[N['entrada_f7']]; names.remove('entrada_f7')
# revisión: pendientes y separación entre caminos (pared ≤ ~48° entre bordes de calzada)
WR = 19; allp = []
for k, P in enumerate(S):
    cp = cum(P)
    for m, p in enumerate(P): allp.append((p[0], p[1], p[2], k, cp[m]))
for k in range(0, len(R), 2): allp.append((R[k][0], R[k][1], hr(cumR[k]), 99, cumR[k]))
bad = []
for a in range(len(allp)):
    xa, za, ha, ka, sa = allp[a]
    for b in range(a+1, len(allp)):
        xb, zb, hb, kb, sb = allp[b]
        d = math.hypot(xa-xb, za-zb)
        if d > 220 or (ka == kb and abs(sa-sb) < 200): continue
        room = max(0, d - 2*WR); need = abs(ha-hb) / 1.0
        if need > room + 3 and d > 2*WR + 2: bad.append((round(need-room), names[ka] if ka < 99 else 'ruta', round(sa), names[kb] if kb < 99 else 'ruta', round(sb), round(d), round(ha), round(hb)))
agg={}
for b in bad:
    key=(b[1],b[3]); a=agg.get(key,[0,0,None]); a[0]=max(a[0],b[0]); a[1]+=1; a[2]=b if a[0]==b[0] else a[2]; agg[key]=a
print('conflictos', len(bad))
for key,a in sorted(agg.items(), key=lambda t:-t[1][0]): print('  %-8s %-8s exceso máx %3d m  n=%4d  ej: s=%d/%d d=%d h=%d/%d' % (key[0],key[1],a[0],a[1],a[2][2],a[2][4],a[2][5],a[2][6],a[2][7]))
for k, P in enumerate(S):
    cp = cum(P); g = max(abs(P[m+1][2]-P[m][2]) / max(1e-6, cp[m+1]-cp[m]) for m in range(len(P)-1)); print('%-11s %7.1f -> %7.1f  pend máx %.1f%%' % (names[k], P[0][2], P[-1][2], g*100))
if WRITE:
    c3 = lambda a: ", ".join("[%.1f, %.1f, %.1f]" % tuple(p) for p in a)
    js = "const SEC = [\n" + ",\n".join("  [%s]" % c3(P) for P in S) + "\n];      // caminos interiores [x, z, cota]: " + ", ".join(names) + "\n"
    h = h[:i0] + js + h[j1:] if False else h
    a = h.index("const SEC = [\n"); b = h.index("\n", h.index("];      // caminos interiores", a)) + 1; h = h[:a] + js + h[b:]
    h = re.sub(r"const FLOOR = -?\d+, FRAD = 0;", "const FLOOR = %d, FRAD = 0;" % FLOOR, h)
    h = re.sub(r"F7HN = -?\d+;", "F7HN = %d;" % F7HN, h)
    # CELQ: tramos rectos bajo el celeste, con la cota nueva del celeste en cada vértice
    m = re.search(r"const CELQ = (\[\[.*?\]\]);", h); Q = json.loads(m.group(1))
    for q in Q:
        p = min(c, key=lambda p: math.hypot(p[0]-q[0], p[1]-q[1])); q[2] = round(p[2], 1)
    h = h[:m.start(1)] + json.dumps(Q).replace(" ", "") + h[m.end(1):]
    open(F, "w", encoding="utf8", newline="").write(h); print("escrito")
