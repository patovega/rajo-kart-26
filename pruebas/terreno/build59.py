import json, math, re
F = r"c:/Users/Usuario/Documents/juegos/rajo-kart/index.html"; h = open(F, encoding="utf8").read()
i = h.index("const SEC = ["); j = h.index("];      // caminos interiores", i); S = json.loads(h[i+12:j+1].replace("\n", "")); names = h[j:h.index("\n", j)].split(":")[1].strip().split(", "); N = {n: k for k, n in enumerate(names)}
FP = json.loads(re.search(r"const FPOLY = (\[.*?\]);", h).group(1))
T = json.load(open('trace59.json')); pts = T['pts']; J = T['J']; VJ = T['V']
import sys
SC = float(sys.argv[1]) if len(sys.argv) > 1 else 0.75; JW = (-380.0, -700.0); X0 = JW[0] - pts[J][0] * SC; Z0 = JW[1] - pts[J][1] * SC
w = lambda p: (X0 + p[0] * SC, Z0 + p[1] * SC)
def resample(P, step=8.0):
    out = [P[0]]; acc = 0.0
    for a, b in zip(P, P[1:]):
        d = math.hypot(b[0]-a[0], b[1]-a[1])
        while acc + d >= step:
            t = (step - acc) / d; a = (a[0] + (b[0]-a[0]) * t, a[1] + (b[1]-a[1]) * t); out.append(a); d = math.hypot(b[0]-a[0], b[1]-a[1]); acc = 0.0
        acc += d
    out.append(P[-1]); return out
def smooth(P, n=2):
    for _ in range(n): P = [P[0]] + [((P[k-1][0] + 2*P[k][0] + P[k+1][0]) / 4, (P[k-1][1] + 2*P[k][1] + P[k+1][1]) / 4) for k in range(1, len(P)-1)] + [P[-1]]
    return P
def cum(P):
    c = [0]
    for k in range(1, len(P)): c.append(c[-1] + math.hypot(P[k][0]-P[k-1][0], P[k][1]-P[k-1][1]))
    return c
def withH(P, h0, h1):
    c = cum(P); return [[round(p[0], 1), round(p[1], 1), round(h0 + (h1 - h0) * c[k] / c[-1], 1)] for k, p in enumerate(P)]
A = smooth(resample([w(p) for p in pts[:J+1]])); Z = smooth(resample([w(p) for p in pts[J:]]))
cx, cz = sum(p[0] for p in FP) / len(FP), sum(p[1] for p in FP) / len(FP); e = Z[-1]; d = math.hypot(cx-e[0], cz-e[1]); Z.append((e[0] + (cx-e[0]) / d * 45, e[1] + (cz-e[1]) / d * 45))
print('J', JW, 'zig fin', [round(q) for q in Z[-1]], 'largo zig', round(cum(Z)[-1]), 'azul1 rama A inicio', [round(q) for q in A[0]])
A1 = withH(resample([(-1200.2, 234.9)] + A), 176, 80)      # azul1: de la superficie (unión SO) por la rama exterior hasta J
AZ = withH(resample([JW, (-242.1, -752.8)]), 80, 80)                      # enlace J - empalme rosado
ZG = withH(Z, 80, -240)
near = lambda P, x, z: min(range(len(P)), key=lambda k: math.hypot(P[k][0]-x, P[k][1]-z))
kv = near(ZG, *w(pts[VJ])); V0 = S[N['verde']]; vs = (ZG[kv][0], ZG[kv][1])
V = withH(resample([vs] + [w(p) for p in [(385, 1020), (400, 1100), (420, 1250), (440, 1460)]] + [(p[0], p[1]) for p in V0[90:]]), -200, V0[-1][2])
kc = near(ZG, *w((1560, 850))); ke = near(ZG, *w((1290, 485)))
C0 = S[N['celeste']]; cs = (ZG[kc][0], ZG[kc][1]); j0 = next(k for k in range(len(C0)) if C0[k][0] > cs[0] + 70); CE = withH(resample([cs] + [(p[0], p[1]) for p in C0[j0:]]), -140, C0[-1][2])
es = (ZG[ke][0], ZG[ke][1]); EN = withH(resample([es, (-250, -520), (-200, -585), (8, -624), (216, -610), (370, -556), (400, -520)]), -56, -56)
HP = [kv, ke, near(ZG, *w((500, 1080)))]; print('curvas en U', [(k, ZG[k][:2]) for k in HP], 'celeste en', kc, 'entrada en', ke)
S[N['azul1']] = A1; S[N['azul2']] = AZ; S[N['zigzag']] = ZG; S[N['verde']] = V; S[N['celeste']] = CE; S[N['entrada_f7']] = EN
c3 = lambda a: ", ".join("[%.1f, %.1f, %.1f]" % tuple(p) for p in a)
js = "const SEC = [\n" + ",\n".join("  [%s]" % c3(P) for P in S) + "\n];      // caminos interiores [x, z, cota]: " + ", ".join(names) + "\n"
a0 = h.index("const SEC = [\n"); b0 = h.index("\n", h.index("];      // caminos interiores", a0)) + 1; h = h[:a0] + js + h[b0:]
sx, sz = w((535, 1180)); rot = math.atan2(sz - vs[1], sx - vs[0]) + math.pi / 2
h = re.sub(r"const SEM6 = \{[^\n]*?\};", "const SEM6 = { x: %.1f, z: %.1f, h: 0, rot: %.3f };" % (sx, sz, rot), h)
h = re.sub(r"const PATIOS = \[.*?\];", "const PATIOS = [[SEM6.x, SEM6.z, SEM6.h, 42], [%.1f, %.1f, 80, 55], [-242.1, -752.8, 80, 55], [%.1f, %.1f, 0, 55], [%.1f, %.1f, 0, 55], [%.1f, %.1f, 0, 50]];" % (JW[0], JW[1], cs[0], cs[1], es[0], es[1], vs[0], vs[1]), h)
h = h.replace("const CURV = [108, 213, 336].map(k => SEC[6][k]);", "const CURV = [%d, %d, %d].map(k => SEC[6][k]);" % tuple(HP))
m = re.search(r"const CELQ = (\[\[.*?\]\]);", h); Q = json.loads(m.group(1)); Q[0] = [round(cs[0]), round(cs[1]), -140]; h = h[:m.start(1)] + json.dumps(Q).replace(" ", "") + h[m.end(1):]
mF = re.search(r"const FPOLY = (\[.*?\]);", h); FPo = json.loads(mF.group(1)); XL = -445.0; out = []      # fondo recortado por el poniente: ahí pasan las últimas curvas de la azul
for k in range(len(FPo)):
    a, b = FPo[k], FPo[(k+1) % len(FPo)]; ina, inb = a[0] >= XL, b[0] >= XL
    if ina: out.append(a)
    if ina != inb: t = (XL - a[0]) / (b[0] - a[0]); out.append([XL, round(a[1] + (b[1] - a[1]) * t, 1)])
h = h[:mF.start(1)] + "[" + ", ".join("[%.1f, %.1f]" % tuple(p) for p in out) + "]" + h[mF.end(1):]
h = h.replace("const PIT = { x: -308, z: 165,", "const PIT = { x: -215, z: 165,")
open(F, "w", encoding="utf8", newline="").write(h); print('SEM6', round(sx), round(sz), 'verde sale en zig', kv, 'escrito')
