# -*- coding: utf-8 -*-
# Recalcula las cotas de todos los caminos interiores + fondo + fase 7 con programación lineal.
# Fijos: ruta (Rampa Sur), borde del rajo (176). Variables: cota de cada punto de SEC, F7HN (fase 7 norponiente), FLOOR.
# Restricciones: pendiente ≤ 10 % y sin subidas en el sentido de bajada, empalmes a igual cota, pared entre caminos vecinos ≤ SLOPE (no peor que hoy).
import json, math, re, sys, numpy as np
from scipy.optimize import linprog
from scipy import sparse
F = r"c:/Users/Usuario/Documents/juegos/rajo-kart/index.html"; h = open(F, encoding="utf8").read()
i = h.index("const SEC = ["); j = h.index("];      // caminos interiores", i); S = json.loads(h[i+12:j+1].replace("\n", ""))
names = h[j:h.index("\n", j)].split(":")[1].strip().split(", ")
i = h.index("const ROUTE = ["); R = json.loads(h[i+14:h.index(";", i)])
RIM = json.loads(re.search(r"const RIMPOLY = (\[.*?\]);", h).group(1)); F7 = json.loads(re.search(r"const F7POLY = (\[.*?\]);", h).group(1)); FP = json.loads(re.search(r"const FPOLY = (\[.*?\]);", h).group(1))
SLOPE = float(sys.argv[1]) if len(sys.argv) > 1 else 1.6; GMIN = json.loads(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].startswith('{') else {}; WRITE = "write" in sys.argv; WR = 19; GR = 0.104
FLOOR_MIN = -330; F7_MIN = -84
def cum(P):
    c = [0]
    for k in range(1, len(P)): c.append(c[-1] + math.hypot(P[k][0]-P[k-1][0], P[k][1]-P[k-1][1]))
    return c
cumR = cum(R); hr = lambda s: -80 + 256 * min(1, max(0, s / cumR[-1]))
F7A = (-202.5, -580.5); R0 = R[0]
def f7t(x, z):  # f7h = -80*t + F7HN*(1-t)
    bx, bz = R0[0]-F7A[0], R0[1]-F7A[1]; return max(0, min(1, ((x-F7A[0])*bx + (z-F7A[1])*bz) / (bx*bx+bz*bz)))
def poly(P, step):
    out = []
    for a, b in zip(P, P[1:] + P[:1]):
        n = max(1, int(math.hypot(b[0]-a[0], b[1]-a[1]) / step))
        for q in range(n): out.append((a[0] + (b[0]-a[0]) * q / n, a[1] + (b[1]-a[1]) * q / n))
    return out
N = {n: k for k, n in enumerate(names)}

# variables
off = []; nv = 0
for P in S: off.append(nv); nv += len(P)
iF7, iFL = nv, nv + 1; nv += 2
# puntos "fijos" o dependientes: (x, z, kind, val) kind: 'c' constante, 'f7' (t), 'fl'
fixed = [(p[0], p[1], 'c', hr(cumR[k])) for k, p in enumerate(R)]
fixed += [(x, z, 'c', 176.0) for x, z in poly(RIM, 15)]
fixed += [(x, z, 'f7', f7t(x, z)) for x, z in poly(F7, 15)]
fixed += [(x, z, 'fl', 0) for x, z in poly(FP, 15)]
rows = []; rhs = []; eqrows = []; eqrhs = []; meta = []
def row(coefs, b, m=''): rows.append(coefs); rhs.append(b); meta.append(m)          # sum coefs ≤ b
def eq(coefs, b): eqrows.append(coefs); eqrhs.append(b)
def fixcoef(f):  # devuelve (coefs, const) tal que valor = sum coefs + const
    x, z, kind, v = f
    if kind == 'c': return {}, v
    if kind == 'f7': return {iF7: 1 - v}, -80 * v
    return {iFL: 1.0}, 0.0
# pendiente y sentido
dirn = {}
for k, P in enumerate(S):
    c = cum(P); d = P[-1][2] - P[0][2]; dirn[k] = 1 if d > 0.5 else (-1 if d < -0.5 else 0)
    for m in range(len(P) - 1):
        ds = max(4.0, c[m+1] - c[m]); a, b = off[k] + m, off[k] + m + 1
        row({b: 1, a: -1}, GR * ds, 'pend %s@%d' % (names[k], m)); row({a: 1, b: -1}, GR * ds, 'pend %s@%d' % (names[k], m))
        gmin = GMIN.get(names[k], 0.0) * ds      # sin tramos planos largos en la bajada
        if dirn[k] > 0: row({a: 1, b: -1}, -gmin, 'dir ' + names[k])      # sube con k: h[b] ≥ h[a] + gmin
        elif dirn[k] < 0: row({b: 1, a: -1}, -gmin, 'dir ' + names[k])    # baja con k
# empalmes: cada extremo se amarra al punto más cercano de otro camino / fijo (≤ 45 m)
ties = []
for k, P in enumerate(S):
    for e in (0, len(P) - 1):
        x, z = P[e][0], P[e][1]; best = (45, None)
        for k2, P2 in enumerate(S):
            if k2 == k: continue
            for m, q in enumerate(P2):
                d = math.hypot(q[0]-x, q[1]-z)
                if d < best[0]: best = (d, ('v', off[k2] + m, names[k2]))
        for f in fixed:
            d = math.hypot(f[0]-x, f[1]-z)
            if d < best[0]: best = (d, ('f', f, f[2]))
        if best[1] and best[1][0] == 'f' and best[1][1][2] == 'f7' and names[k] in ('celeste', 'entrada_f7'): best = (0, None)      # estos extremos se amarran al piso de la fase 7 con su propia ecuación
        if best[1] and 'noties' not in sys.argv:
            if best[1][0] == 'v': eq({off[k] + e: 1, best[1][1]: -1}, 0)
            else: cf, c0 = fixcoef(best[1][1]); cf = dict(cf); cf[off[k] + e] = 1; eq(cf, -c0) if False else eq({**{kk: -vv for kk, vv in cf.items() if kk != off[k] + e}, off[k] + e: 1}, c0)
            ties.append((names[k], e, best[1][2], round(best[0])))
print('empalmes:', ties)
# celeste: extremo en fase 7 = piso; rojo_f7 = piso
for m, p in enumerate(S[N['rojo_f7']]): t = f7t(p[0], p[1]); eq({off[N['rojo_f7']] + m: 1, iF7: -(1 - t)}, -80 * t)
for nm in ('celeste', 'entrada_f7'): P_ = S[N[nm]]; t = f7t(P_[-1][0], P_[-1][1]); eq({off[N[nm]] + len(P_) - 1: 1, iF7: -(1 - t)}, -80 * t)

# pares: pared entre caminos vecinos
pts = []
for k, P in enumerate(S):
    c = cum(P)
    for m in range(0, len(P), 2): pts.append((P[m][0], P[m][1], ('v', off[k] + m), k, c[m], P[m][2]))
for f in fixed[::2]:
    cf, c0 = fixcoef(f); cur = c0 + (cf.get(iF7, 0) * 32) + (cf.get(iFL, 0) * -192); pts.append((f[0], f[1], ('f', f), 99, 0, cur))
npair = 0
for a in range(len(pts)):
    xa, za, va, ka, sa, ha = pts[a]
    for b in range(a + 1, len(pts)):
        xb, zb, vb, kb, sb, hb = pts[b]
        if ka == 99 and kb == 99: continue
        d = math.hypot(xa-xb, za-zb)
        if d > 260 or d < 2 * WR - 4 or (ka == kb and abs(sa-sb) < 250): continue
        ent = lambda p, q: q[3] == 99 and q[2][1][2] == 'f7' and p[3] < 99 and (names[p[3]] == 'rojo_f7' or names[p[3]] == 'entrada_f7' or (names[p[3]] == 'celeste' and p[4] > 1500) or (names[p[3]] == 'rosado' and p[4] > 1400))      # entradas a la fase 7: el camino llega a nivel del piso
        if ent(pts[a], pts[b]) or ent(pts[b], pts[a]): continue
        lim = max(SLOPE * max(0, d - 2 * WR), abs(ha - hb)) + 2
        ca, c0a = ({va[1]: 1.0}, 0.0) if va[0] == 'v' else fixcoef(va[1]); cb, c0b = ({vb[1]: 1.0}, 0.0) if vb[0] == 'v' else fixcoef(vb[1])
        co = dict(ca)
        for kk, vv in cb.items(): co[kk] = co.get(kk, 0) - vv
        if not co: continue
        nm = lambda p: (names[p[3]] + '@%d' % p[4]) if p[3] < 99 else p[2][1][2] + '(%.0f,%.0f)' % (p[0], p[1])
        md = '%s - %s d=%.0f lim=%.0f' % (nm(pts[a]), nm(pts[b]), d, lim)
        if 'nopairs' in sys.argv: continue
        row(co, lim - (c0a - c0b), md); row({kk: -vv for kk, vv in co.items()}, lim + (c0a - c0b), md); npair += 1
print('pares', npair, 'filas', len(rows), 'eq', len(eqrows), 'vars', nv)
def mat(rr):
    I, J, V = [], [], []
    for r, co in enumerate(rr):
        for kk, vv in co.items(): I.append(r); J.append(kk); V.append(vv)
    return sparse.csr_matrix((V, (I, J)), shape=(len(rr), nv))
ELASTIC = True; base = nv      # siempre elástico: una holgura mínima (penalizada) evita infactibilidades de centímetros
if ELASTIC:
    for r in range(len(rows)): rows[r] = dict(rows[r]); rows[r][base + r] = -1.0
    nv += len(rows)
A = mat(rows); Ae = mat(eqrows)
# objetivo: fondo y fase 7 lo más bajos posible; el celeste y el zigzag también bajos (pendiente real); el resto apenas
cost = np.zeros(nv); cost[iFL] = 4.0; cost[iF7] = 2.0
for k, P in enumerate(S):
    w = 0.02 if names[k] in ('celeste', 'zigzag') else 0.002
    cost[off[k]:off[k] + len(P)] = w
bounds = [(-340, 180)] * nv; bounds[iFL] = (FLOOR_MIN, -150); bounds[iF7] = (F7_MIN, 40)
if ELASTIC:
    for r in range(base, nv): bounds[r] = (0, None); cost[r] = 100.0
for k, P in enumerate(S):
    if names[k] in ('union_so', 'union_ne'):
        for m in range(len(P)): bounds[off[k] + m] = (173, 176)
res = linprog(cost, A_ub=A, b_ub=np.array(rhs), A_eq=Ae, b_eq=np.array(eqrhs), bounds=bounds, method='highs')
print(res.status, res.message)
X = res.x; print('FLOOR %.1f  F7HN %.1f' % (X[iFL], X[iF7]))
if ELASTIC:
    used = [(X[base + r], meta[r]) for r in range(len(rows)) if X[base + r] > 1e-4]; used.sort(key=lambda t: -t[0])
    agg = {}
    for v, m in used: k = ' '.join(m.split()[:3]) if m.startswith('pend') or m.startswith('dir') else m.split(' d=')[0].split('@')[0] + ' - ' + m.split(' - ')[1].split('@')[0].split('(')[0]; a = agg.get(k, [0, 0]); a[0] = max(a[0], v); a[1] += 1; agg[k] = a
    print('holgura total', sum(v for v, m in used))
    for k, a in sorted(agg.items(), key=lambda t: -t[1][0])[:25]: print('  holgura %6.1f m  n=%3d  %s' % (a[0], a[1], k))
    for v, m in used[:8]: print('   ', round(v, 1), m)
    if 'elastic' in sys.argv: sys.exit(0)
for k, P in enumerate(S):
    c = cum(P); H = X[off[k]:off[k] + len(P)]; g = max(abs(H[m+1]-H[m]) / max(0.5, c[m+1]-c[m]) for m in range(len(P)-1))
    print('%-11s %7.1f -> %7.1f  pend máx %.1f%%   (antes %.1f -> %.1f)' % (names[k], H[0], H[-1], g * 100, P[0][2], P[-1][2]))
sl = A.dot(X) - np.array(rhs)
for nmv, iv in (('F7HN', iF7), ('FLOOR', iFL)):
    cand = [(sl[r], meta[r]) for r in range(len(rows)) if iv in rows[r] and meta[r]]; cand.sort(key=lambda t: -t[0])
    print('más apretadas para', nmv, [ (round(float(a), 1), b) for a, b in cand[:5] ])
# fase 2: mismos extremos, fondo y fase 7; perfil lo más parejo posible (pendiente constante por camino)
nv2 = nv + sum(len(P) - 1 for P in S); cost2 = np.zeros(nv2); cost2[base:base + len(rows)] = 100.0; rows2 = list(rows); rhs2 = list(rhs); eq2 = list(eqrows); eqr2 = list(eqrhs)
eq2.append({iF7: 1}); eqr2.append(float(X[iF7])); eq2.append({iFL: 1}); eqr2.append(float(X[iFL]))
ia = nv
for k, P in enumerate(S):
    c = cum(P); g = (X[off[k] + len(P) - 1] - X[off[k]]) / max(1, c[-1])
    for e in (0, len(P) - 1): eq2.append({off[k] + e: 1}); eqr2.append(float(X[off[k] + e]))
    for m in range(len(P) - 1):
        ds = c[m+1] - c[m]; a, b = off[k] + m, off[k] + m + 1
        rows2.append({b: 1, a: -1, ia: -1}); rhs2.append(g * ds); rows2.append({a: 1, b: -1, ia: -1}); rhs2.append(-g * ds); cost2[ia] = 1; ia += 1
def mat2(rr):
    I, J, V = [], [], []
    for r, co in enumerate(rr):
        for kk, vv in co.items(): I.append(r); J.append(kk); V.append(vv)
    return sparse.csr_matrix((V, (I, J)), shape=(len(rr), nv2))
b2 = list(bounds) + [(0, None)] * (nv2 - nv)
for r in range(len(rows)): b2[base + r] = (float(X[base + r]), float(X[base + r]))      # en la fase 2 las holguras quedan como en la fase 1
res2 = linprog(cost2, A_ub=mat2(rows2), b_ub=np.array(rhs2), A_eq=mat2(eq2), b_eq=np.array(eqr2), bounds=b2, method='highs')
print('fase 2:', res2.status, res2.message); X = res2.x[:nv]
for k, P in enumerate(S):
    c = cum(P); H = X[off[k]:off[k] + len(P)]; gs = [abs(H[m+1]-H[m]) / max(0.5, c[m+1]-c[m]) for m in range(len(P)-1)]
    ch = [round(float(H[min(len(P) - 1, int(len(P) * q / 8))]), 0) for q in range(9)]
    print('%-11s %7.1f -> %7.1f  pend %4.1f%% .. %4.1f%%  perfil %s' % (names[k], H[0], H[-1], min(gs) * 100, max(gs) * 100, ch))
if WRITE:
    for k, P in enumerate(S):
        for m in range(len(P)): P[m][2] = round(float(X[off[k] + m]), 1)
    c3 = lambda a: ", ".join("[%.1f, %.1f, %.1f]" % tuple(p) for p in a)
    js = "const SEC = [\n" + ",\n".join("  [%s]" % c3(P) for P in S) + "\n];      // caminos interiores [x, z, cota]: " + ", ".join(names) + "\n"
    a = h.index("const SEC = [\n"); b = h.index("\n", h.index("];      // caminos interiores", a)) + 1; h = h[:a] + js + h[b:]
    zg, az2, ce, en, ve = S[N['zigzag']], S[N['azul2']], S[N['celeste']], S[N['entrada_f7']], S[N['verde']]
    pat = "const PATIOS = [[SEM6.x, SEM6.z, SEM6.h, 42], [%.1f, %.1f, %.1f, 55], [%.1f, %.1f, %.1f, 55], [%.1f, %.1f, %.1f, 55], [%.1f, %.1f, %.1f, 55], [%.1f, %.1f, %.1f, 50]];" % (zg[0][0], zg[0][1], zg[0][2], az2[-1][0], az2[-1][1], az2[-1][2], ce[0][0], ce[0][1], ce[0][2], en[0][0], en[0][1], en[0][2], ve[0][0], ve[0][1], ve[0][2])
    h = re.sub(r"const PATIOS = \[.*?\];", pat, h)
    ms = re.search(r"const SEM6 = \{ x: ([^,]*), z: ([^,]*), h: ", h); sx_, sz_ = float(ms.group(1)), float(ms.group(2)); hs_ = min(zg, key=lambda p: math.hypot(p[0]-sx_, p[1]-sz_))[2]      # la SEM queda a la cota de la curva de la azul que tiene al lado
    h = re.sub(r"(const SEM6 = \{ x: [^,]*, z: [^,]*, h: )[^,]*,", lambda m_: m_.group(1) + "%.1f," % hs_, h)
    h = re.sub(r"const FLOOR = -?\d+, FRAD = 0;", "const FLOOR = %d, FRAD = 0;" % round(X[iFL]), h)
    h = re.sub(r"F7HN = -?\d+;", "F7HN = %d;" % round(X[iF7]), h)
    m = re.search(r"const CELQ = (\[\[.*?\]\]);", h); Q = json.loads(m.group(1)); ce = S[N['celeste']]
    for q in Q:
        p = min(ce, key=lambda p: math.hypot(p[0]-q[0], p[1]-q[1])); q[2] = p[2]
    h = h[:m.start(1)] + json.dumps(Q).replace(" ", "") + h[m.end(1):]
    open(F, "w", encoding="utf8", newline="").write(h); print("escrito")
