# Calce juego→UTM con la convención del juego (x = este, z = sur → espejo), giro acotado a ±6° y escala 0,85–1,15.
# Ajusta con los caminos (contra los caminos levantados) y el borde del rajo del juego (contra la cresta exterior real).
# Salidas: fit.json, calce2.png y un informe: zonas de riesgo cerca de la ruta (por s), radares y estaciones en coordenadas del juego.
import re, json, math
import numpy as np
from scipy.spatial import cKDTree
from scipy.optimize import minimize
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.path import Path as MPath
OUT = r"c:\Users\Usuario\Documents\juegos\rajo-kart\plano\derivados"
t = open(r"c:\Users\Usuario\Documents\juegos\rajo-kart\js\datos\caminos.js", encoding="utf8").read()
def arr(nm):
    m = re.search(r"\b" + nm + r"\s*=\s*(\[.*?\]);", t, re.S); return json.loads(m.group(1))
ROUTE = np.array(arr("ROUTE")); RIM = np.array(arr("RIMPOLY")); F7 = np.array(arr("F7POLY")); FP = np.array(arr("FPOLY"))
SEC = json.loads(re.search(r"SEC = (\[\n.*?\n\]);", t, re.S).group(1))
juego = [ROUTE] + [np.array([p[:2] for p in s]) for s in SEC]
def densifica(P, paso=5.0):
    out = []
    for a, b in zip(P[:-1], P[1:]):
        n = max(1, int(np.hypot(*(b - a)) / paso))
        for k in range(n): out.append(a + (b - a) * k / n)
    out.append(P[-1]); return np.array(out)
gj = np.vstack([densifica(P) for P in juego]); grim = densifica(np.vstack([RIM, RIM[:1]]))
R = json.load(open(OUT + r"\riesgos.json", encoding="utf8"))
real = np.vstack([densifica(np.array([p[:2] for p in c])) for c in R["caminos"] if len(c) > 1]); tree = cKDTree(real)
# cresta exterior real: la línea de BORDE de mayor extensión dentro de la grilla
bordes = [np.array([p[:2] for p in c]) for c in R["borde"] if len(c) > 2]
def area_bb(P): return (P[:, 0].max() - P[:, 0].min()) * (P[:, 1].max() - P[:, 1].min())
cresta = max(bordes, key=area_bb); print("cresta exterior: vértices", len(cresta), "x", cresta[:, 0].min().round(), cresta[:, 0].max().round(), "y", cresta[:, 1].min().round(), cresta[:, 1].max().round())
tcresta = cKDTree(densifica(cresta))
CX, CY = 165500.0, 4471250.0
def tr(params, P):
    tx, ty, th, s = CX + params[0], CY + params[1], math.radians(params[2]), math.exp(params[3]); z = -P[:, 1]
    c, sn = math.cos(th), math.sin(th)
    return np.column_stack([tx + s * (P[:, 0] * c - z * sn), ty + s * (P[:, 0] * sn + z * c)])
def costo(params, tope):
    if abs(params[2]) > 6 or not (math.log(0.85) < params[3] < math.log(1.15)): return 1e9
    d, _ = tree.query(tr(params, gj)); d = np.minimum(d, tope)
    e, _ = tcresta.query(tr(params, grim)); e = np.minimum(e, 2 * tope)
    return float(np.mean(d)) + 0.5 * float(np.mean(e))
mejor = None
for dx in (-200, 0, 200):
    for dy in (-200, 0, 200):
        x = np.array([dx, dy, 0.0, 0.0])
        for tope in (300.0, 120.0, 50.0, 25.0):
            sim = np.array([x, x + [120, 0, 0, 0], x + [0, 120, 0, 0], x + [0, 0, 3, 0], x + [0, 0, 0, 0.06]])
            r = minimize(costo, x, args=(tope,), method="Nelder-Mead", options={"initial_simplex": sim, "xatol": 0.3, "fatol": 0.005, "maxiter": 2000}); x = r.x
        if mejor is None or r.fun < mejor[0]: mejor = (r.fun, x)
        print(f"inicio ({dx:4d},{dy:4d}): costo {r.fun:6.2f}  dx {x[0]:7.0f} dy {x[1]:7.0f} giro {x[2]:6.2f} escala {math.exp(x[3]):.3f}")
f, p = mejor
T = {"tx": CX + p[0], "ty": CY + p[1], "th": math.radians(p[2]), "s": math.exp(p[3]), "espejo": True, "costo": f}
print("MEJOR:", {k: (round(v, 4) if isinstance(v, float) else v) for k, v in T.items()})
d, _ = tree.query(tr(p, gj)); print("caminos del juego → camino real más cercano: mediana", round(float(np.median(d)), 1), "m, p90", round(float(np.percentile(d, 90)), 1), "m")
json.dump(T, open(OUT + r"\fit.json", "w"))
# ----- informe: ruta en UTM, zonas cerca de la ruta, radares/estaciones al juego
def inv(Q):      # UTM → juego
    c, sn = math.cos(T["th"]), math.sin(T["th"]); s = T["s"]
    X = (Q[:, 0] - T["tx"]) / s; Y = (Q[:, 1] - T["ty"]) / s
    x = X * c + Y * sn; z = -X * sn + Y * c
    return np.column_stack([x, -z])
rd = densifica(ROUTE, 2.0); sr = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(rd, axis=0).T))])      # s desde ROUTE[0] (START_S = 0 ≈ inicio de ROUTE)
ru = tr(p, rd)
print("\n== ZONAS DE RIESGO (polígonos cerrados del plano) respecto de la ruta: s en metros de ruta")
inf = {"zonas": [], "radares": [], "estaciones": []}
for i, z in enumerate(R["zonas"]):
    P = np.array(z["pts"]); path = MPath(P); dentro = path.contains_points(ru)
    dmin = np.min(np.hypot(*(ru[:, None, :] - P[None, :, :]).transpose(2, 0, 1)).min(axis=1))
    cerca = np.where(np.hypot(*(ru[:, None, :] - P[None, :, :]).transpose(2, 0, 1)).min(axis=1) < 80)[0]
    item = {"i": i, "color": z["color"], "z": z["z"], "cx": round(float(P[:, 0].mean())), "cy": round(float(P[:, 1].mean())), "dmin": round(float(dmin)), "s_cerca": [int(sr[cerca[0]]), int(sr[cerca[-1]])] if len(cerca) else None, "s_dentro": [int(sr[np.where(dentro)[0][0]]), int(sr[np.where(dentro)[0][-1]])] if dentro.any() else None}
    inf["zonas"].append(item); print("  ", item)
print("\n== CUÑAS cerca de la ruta (< 80 m)")
for i, c in enumerate(R["cunas"]):
    P = np.array(c["pts"]); dd = np.hypot(*(ru[:, None, :] - P[None, :, :]).transpose(2, 0, 1)).min(axis=1); k = np.where(dd < 80)[0]
    if len(k): print("   cuña", i, c["tipo"], "color", c["color"], "s", int(sr[k[0]]), "..", int(sr[k[-1]]), "dmin", round(float(dd.min())))
print("\n== RADARES y ESTACIONES en coordenadas del juego (x, z) y s de ruta más cercano")
for k in ("radares", "estaciones"):
    for r in R[k]:
        g = inv(np.array([[r["x"], r["y"]]]))[0]; dd = np.hypot(ru[:, 0] - r["x"], ru[:, 1] - r["y"]); j = int(np.argmin(dd))
        item = {"nombre": r["nombre"], "x": round(float(g[0]), 1), "z": round(float(g[1]), 1), "utm": [r["x"], r["y"]], "s_ruta": int(sr[j]), "d_ruta": int(dd[j])}
        inf[k].append(item); print("  ", item)
json.dump(inf, open(OUT + r"\informe_calce.json", "w", encoding="utf8"), ensure_ascii=False, indent=1)
# ----- dibujo
x0, x1, y0, y1 = 164100, 166800, 4470100, 4472500
fig, ax = plt.subplots(figsize=(18, 18 * (y1 - y0) / (x1 - x0)))
for c in R["caminos"]: P = np.array([q[:2] for q in c]); ax.plot(P[:, 0], P[:, 1], color="#333", lw=0.5)
for c in R["borde"]: P = np.array([q[:2] for q in c]); ax.plot(P[:, 0], P[:, 1], color="#d0b090", lw=0.2)
ax.plot(cresta[:, 0], cresta[:, 1], color="#806040", lw=1.0)
for i, P in enumerate(juego): Q = tr(p, P); ax.plot(Q[:, 0], Q[:, 1], color="red" if i == 0 else "orange", lw=1.8 if i == 0 else 1.1)
for k in range(0, len(sr), 100): ax.annotate(str(int(sr[k])), (ru[k, 0], ru[k, 1]), fontsize=7, color="darkred")
for nm, P, col in (("RIM", RIM, "blue"), ("F7", F7, "green"), ("FONDO", FP, "cyan")):
    Q = tr(p, np.vstack([P, P[:1]])); ax.plot(Q[:, 0], Q[:, 1], color=col, lw=1.2, ls="--")
for z in R["zonas"]: P = np.array(z["pts"] + [z["pts"][0]]); ax.plot(P[:, 0], P[:, 1], color="magenta", lw=1.5)
for c in R["cunas"]: P = np.array(c["pts"]); ax.plot(P[:, 0], P[:, 1], color="violet", lw=0.8)
for r in R["radares"]: ax.plot(r["x"], r["y"], marker="^", ms=10, color="blue"); ax.annotate(r["nombre"], (r["x"], r["y"]), color="blue", fontsize=8)
ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect("equal"); ax.grid(True, lw=0.2)
ax.set_title(f"Calce juego→UTM (z = sur): giro {p[2]:.2f}°, escala {math.exp(p[3]):.3f}. Rojo: ruta (con s); naranjo: caminos interiores; azul: borde del juego; verde: fase 7; cian: fondo; magenta: zonas de riesgo; violeta: cuñas")
fig.savefig(OUT + r"\calce2.png", dpi=100); print("calce2.png ok")
