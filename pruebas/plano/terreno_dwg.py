# Modelo de alturas real desde el DXF del plano: triangula (TIN) los vértices 3D de crestas (BORDE), patas (PATA) y caminos levantados,
# muestrea una grilla regular y la guarda en plano/derivados/terreno_dwg.npz (más una vista con sombreado, curvas y caminos: terreno_dwg.png).
# Uso: python terreno_dwg.py plano/derivados/GEO-SG-716_Rajo_Catabela.dxf [celda]
import sys, json, numpy as np
import ezdxf
from scipy.spatial import Delaunay
from scipy.interpolate import LinearNDInterpolator
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
OUT = r"c:\Users\Usuario\Documents\juegos\rajo-kart\plano\derivados"
E0, E1, N0, N1 = 164000.0, 166800.0, 4469900.0, 4472500.0      # recorte: la grilla del plano con margen
CELL = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0
import os
if len(sys.argv) > 3 and sys.argv[3] == "vista":
    d = np.load(OUT + r"	erreno_dwg.npz"); Z = d["Z"]; xs = d["xs"]; ys = d["ys"]; X, Y = np.meshgrid(xs, ys)
    import pickle; lineas = pickle.load(open(OUT + r"\caminos_dwg.pkl", "rb"))
else:
  doc = ezdxf.readfile(sys.argv[1]); msp = doc.modelspace()
  pts = {"BORDE": [], "PATA": [], "CAMINOS": []}; lineas = {"BORDE": [], "PATA": [], "CAMINOS": []}
  for e in msp:
      cap = e.dxf.layer
      k = "BORDE" if cap == "26-11-15_BORDE" else "PATA" if cap == "26-11-15_PATA" else "CAMINOS" if cap == "26-11-15_CAMINOS_LEVANTADOS" else None
      if k is None or e.dxftype() != "POLYLINE": continue
      P = np.array([(v.dxf.location.x, v.dxf.location.y, v.dxf.location.z) for v in e.vertices])
      if len(P) < 2: continue
      m = (P[:, 0] > E0 - 50) & (P[:, 0] < E1 + 50) & (P[:, 1] > N0 - 50) & (P[:, 1] < N1 + 50) & (P[:, 2] > 1000)
      if m.sum() < 2: continue
      pts[k].append(P[m]); lineas[k].append(P[m])
  for k in pts: pts[k] = np.vstack(pts[k]) if pts[k] else np.zeros((0, 3)); print(k, "vértices", len(pts[k]), "polilíneas", len(lineas[k]))
  # densificar los tramos largos para que la TIN no salte entre líneas lejanas (cada 6 m)
  def densifica(L, paso=6.0):
      out = []
      for P in L:
          d = np.hypot(np.diff(P[:, 0]), np.diff(P[:, 1])); n = np.maximum(1, np.ceil(d / paso).astype(int))
          for i in range(len(P) - 1):
              for t in np.arange(n[i]) / n[i]: out.append(P[i] + (P[i + 1] - P[i]) * t)
          out.append(P[-1])
      return np.array(out)
  allp = np.vstack([densifica(lineas["BORDE"]), densifica(lineas["PATA"]), densifica(lineas["CAMINOS"])])
  print("puntos para la TIN:", len(allp))
  tri = Delaunay(allp[:, :2]); print("triángulos", len(tri.simplices))
  f = LinearNDInterpolator(tri, allp[:, 2])
  xs = np.arange(E0, E1 + CELL / 2, CELL); ys = np.arange(N0, N1 + CELL / 2, CELL); X, Y = np.meshgrid(xs, ys)
  Z = f(X, Y); nan = np.isnan(Z); print("grilla", Z.shape, "nan", int(nan.sum()))
  if nan.any():      # fuera de la nube: el valor más cercano
      from scipy.interpolate import NearestNDInterpolator
      Z[nan] = NearestNDInterpolator(allp[:, :2], allp[:, 2])(X[nan], Y[nan])
  np.savez_compressed(OUT + r"\terreno_dwg.npz", Z=Z.astype(np.float32), xs=xs, ys=ys, E0=E0, N0=N0, CELL=CELL)
  json.dump({"E0": E0, "E1": E1, "N0": N0, "N1": N1, "CELL": CELL, "nx": len(xs), "ny": len(ys), "zmin": float(Z.min()), "zmax": float(Z.max())}, open(OUT + r"\terreno_dwg.json", "w"))
  print("cotas", Z.min().round(1), Z.max().round(1))
  import pickle; pickle.dump({"CAMINOS": lineas["CAMINOS"]}, open(OUT + r"\caminos_dwg.pkl", "wb"))
# vista
ls = LightSource(azdeg=315, altdeg=45); rgb = ls.shade(Z, cmap=plt.cm.gist_earth, vert_exag=1.5, blend_mode="overlay", dx=CELL, dy=CELL)
fig, ax = plt.subplots(figsize=(20, 20 * (N1 - N0) / (E1 - E0)))
ax.imshow(rgb, extent=(E0, E1, N0, N1), origin="lower")
cs = ax.contour(X, Y, Z, levels=np.arange(1050, 1850, 16), colors="k", linewidths=0.15); ax.clabel(cs, levels=cs.levels[::4], fontsize=6, fmt="%d")
for P in lineas["CAMINOS"]: ax.plot(P[:, 0], P[:, 1], color="white", lw=0.4)
ax.set_xlim(E0, E1); ax.set_ylim(N0, N1); ax.set_aspect("equal"); ax.grid(True, lw=0.2); ax.set_title("Terreno real (TIN de crestas, patas y caminos); caminos levantados en blanco")
fig.savefig(OUT + r"\terreno_dwg.png", dpi=100); print("terreno_dwg.png ok")
