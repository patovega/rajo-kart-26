# Ruta sobre el terreno real: camino más corto conducible (pendiente ≤ 12 %, lejos de caras de banco) desde el piso de la fase 7 (pared este)
# hasta la superficie, con Dijkstra sobre la grilla de alturas (terreno_dwg.npz). Guarda ruta_dwg.json (UTM + cota) y ruta_dwg.png.
# Uso: python ruta_dwg.py [E_inicio N_inicio] [E_fin N_fin]
import sys, json, numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.ndimage import distance_transform_edt, uniform_filter1d
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
OUT = r"c:\Users\Usuario\Documents\juegos\rajo-kart\plano\derivados"
d = np.load(OUT + r"\terreno_dwg.npz"); Z = d["Z"].astype(float); xs = d["xs"]; ys = d["ys"]; CELL = float(d["CELL"]); E0 = float(d["E0"]); N0 = float(d["N0"])
ny, nx = Z.shape
a = [float(v) for v in sys.argv[1:]]
ini = (a[0], a[1]) if len(a) >= 2 else (166050.0, 4471350.0)      # piso de la fase 7, pared este
fin = (a[2], a[3]) if len(a) >= 4 else None                          # None: cualquier celda de superficie (cota ≥ 1700)
gy, gx = np.gradient(Z, CELL); slope = np.hypot(gx, gy)
pared = slope > 0.35; dpared = distance_transform_edt(~pared) * CELL      # distancia a la cara de banco más cercana
# grafo 8-vecinos: costo = largo × (1 + 6·pendiente del tramo) × castigo por cercanía a paredes; prohibido si el tramo sube/baja más de 12 %
idx = np.arange(ny * nx).reshape(ny, nx)
rows, cols, w = [], [], []
for dy, dx in [(0, 1), (1, 0), (1, 1), (1, -1)]:
    L = CELL * np.hypot(dy, dx)
    if dx >= 0: A = idx[:ny - dy, :nx - dx]; B = idx[dy:, dx:]
    else: A = idx[:ny - dy, -dx:]; B = idx[dy:, :nx + dx]
    za = Z.ravel()[A.ravel()]; zb = Z.ravel()[B.ravel()]; g = np.abs(zb - za) / L
    pen = 1 + 6 * g + 3.0 * np.exp(-np.minimum(dpared.ravel()[A.ravel()], dpared.ravel()[B.ravel()]) / 8.0)
    c = np.where(g <= 0.12, L * pen, np.inf)
    ok = np.isfinite(c); rows += [A.ravel()[ok], B.ravel()[ok]]; cols += [B.ravel()[ok], A.ravel()[ok]]; w += [c[ok], c[ok]]
G = coo_matrix((np.concatenate(w), (np.concatenate(rows), np.concatenate(cols))), shape=(ny * nx, ny * nx)).tocsr()
cel = lambda E, N: int(round((N - N0) / CELL)) * nx + int(round((E - E0) / CELL))
src = cel(*ini); print("inicio", ini, "cota", round(Z.ravel()[src], 1), "pendiente", round(slope.ravel()[src], 3))
dist, pred = dijkstra(G, indices=src, return_predecessors=True)
if fin: dst = cel(*fin)
else:
    cand = np.where((Z.ravel() >= 1700) & np.isfinite(dist))[0]; dst = cand[np.argmin(dist[cand])]
print("fin", (E0 + (dst % nx) * CELL, N0 + (dst // nx) * CELL), "cota", round(Z.ravel()[dst], 1), "costo", round(dist[dst]))
path = []; k = dst
while k != src and k >= 0: path.append(k); k = pred[k]
path.append(src); path = path[::-1]
P = np.array([(E0 + (k % nx) * CELL, N0 + (k // nx) * CELL) for k in path], float)
Ps = np.column_stack([uniform_filter1d(P[:, 0], 9, mode="nearest"), uniform_filter1d(P[:, 1], 9, mode="nearest")])      # suavizado ~36 m
s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(Ps, axis=0).T))])
zr = np.array([Z[int(round((p[1] - N0) / CELL)), int(round((p[0] - E0) / CELL))] for p in P])      # cota de las celdas del camino (no de la línea suavizada, que corta esquinas)
zr = uniform_filter1d(zr, 15, mode="nearest")      # perfil suave (~60 m)
ds = np.maximum(np.diff(s), 0.1)
for it in range(60):      # pendiente máx. 11 % (rampas de mina: 8–10 %)
    for k in range(1, len(zr)): zr[k] = min(zr[k - 1] + 0.11 * ds[k - 1], max(zr[k - 1] - 0.11 * ds[k - 1], zr[k]))
    for k in range(len(zr) - 2, -1, -1): zr[k] = min(zr[k + 1] + 0.11 * ds[k], max(zr[k + 1] - 0.11 * ds[k], zr[k]))
    zr = uniform_filter1d(zr, 5, mode="nearest")
print("largo", round(s[-1]), "m; cota", round(zr[0], 1), "→", round(zr[-1], 1), "; pendiente media", round((zr[-1] - zr[0]) / s[-1] * 100, 1), "%; máx tramo", round(float(np.max(np.abs(np.diff(zr)) / np.maximum(np.diff(s), 0.1))) * 100, 1), "%")
json.dump({"ini": ini, "fin": [float(Ps[-1, 0]), float(Ps[-1, 1])], "pts": [[round(float(x), 2), round(float(y), 2), round(float(z), 2)] for x, y, z in zip(Ps[:, 0], Ps[:, 1], zr)]}, open(OUT + r"\ruta_dwg.json", "w"))
ls = LightSource(azdeg=315, altdeg=45); rgb = ls.shade(Z, cmap=plt.cm.gist_earth, vert_exag=1.5, blend_mode="overlay", dx=CELL, dy=CELL)
fig, ax = plt.subplots(figsize=(18, 18 * ny / nx)); ax.imshow(rgb, extent=(xs[0], xs[-1], ys[0], ys[-1]), origin="lower")
ax.plot(Ps[:, 0], Ps[:, 1], color="red", lw=2); ax.plot(P[:, 0], P[:, 1], color="yellow", lw=0.5)
for k in range(0, len(s), 50): ax.annotate(str(int(s[k])), (Ps[k, 0], Ps[k, 1]), fontsize=7, color="white")
ax.set_title(f"Ruta conducible: {s[-1]:.0f} m, {zr[0]:.0f} → {zr[-1]:.0f} m"); ax.set_aspect("equal")
fig.savefig(OUT + r"\ruta_dwg.png", dpi=100); print("ruta_dwg.png ok")
