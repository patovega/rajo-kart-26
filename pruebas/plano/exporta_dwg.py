# Exporta el mundo real al juego: js/datos/terreno_dwg.bin (grilla de alturas, Uint16 en decímetros sobre 1000 m) y js/datos/terreno_dwg.js
# (constantes de la grilla, ruta, piso de la fase 7, zonas de riesgo, cuñas, radares y estaciones) en coordenadas del juego: x = E − EC, z = NC − N (z = sur), y = cota − YC.
import json, numpy as np
from scipy.ndimage import label, binary_opening, binary_closing
from matplotlib.path import Path as MPath
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
OUT = r"c:\Users\Usuario\Documents\juegos\rajo-kart\plano\derivados"; JS = r"c:\Users\Usuario\Documents\juegos\rajo-kart\js\datos"
EC, NC, YC = 165400.0, 4471200.0, 1700.0
d = np.load(OUT + r"\terreno_dwg.npz"); Z = d["Z"].astype(float); CELL = float(d["CELL"]); E0 = float(d["E0"]); N0 = float(d["N0"]); ny, nx = Z.shape
g = lambda E, N: (round(E - EC, 1), round(NC - N, 1))
ruta = json.load(open(OUT + r"\ruta_dwg.json")); R = json.load(open(OUT + r"\riesgos.json", encoding="utf8")); inf = json.load(open(OUT + r"\informe_calce.json", encoding="utf8"))
# --- cambios de diseño pedidos por el usuario (21-11-2026): se saca el camino del banco norte sobre el piso de la pala (ex camino 46, puntos 0–17) y la pared de abajo
# se corre hacia el norte el ancho del camino (la fase 7 «empuja» al espacio libre): Z(p) = Z(p − D·n) con n hacia abajo de la ladera, solo excavando (mín.), D
# disminuye a 0 en los 60 m de cada extremo y no se toca nada a menos de 60 m de la ruta. Coordenadas del juego [x, z].
EMPUJES = [dict(eje=[(564.6, -573.7), (551.2, -585.3), (537.4, -609.9), (520.0, -632.0), (452.0, -693.0), (396.0, -725.0), (364.0, -734.0), (328.0, -740.0), (300.0, -737.0),
                     (276.0, -744.0), (230.0, -745.0), (208.0, -740.0), (180.0, -737.0), (24.0, -696.0), (-12.0, -679.0), (-40.0, -671.0), (-68.0, -653.0), (-80.0, -649.0)], D=40.0)]
def empujar(Z):
    from scipy.ndimage import map_coordinates
    Z0 = Z.copy(); Pr = np.array(ruta["pts"])[:, :2]
    from scipy.spatial import cKDTree as _KD
    kr = _KD(Pr)
    for E_ in EMPUJES:
        W = np.array([[x + EC, NC - z] for x, z in E_["eje"]], float); D = E_["D"]
        seg = W[1:] - W[:-1]; Ls = np.hypot(*seg.T); cum = np.concatenate([[0], np.cumsum(Ls)]); Lt = cum[-1]
        e0, e1 = W.min(0) - 260, W.max(0) + 260
        j0, j1 = int(max(0, (e0[0] - E0) / CELL)), int(min(nx - 1, (e1[0] - E0) / CELL)); i0, i1 = int(max(0, (e0[1] - N0) / CELL)), int(min(ny - 1, (e1[1] - N0) / CELL))
        II, JJ = np.mgrid[i0:i1 + 1, j0:j1 + 1]; PE = E0 + JJ * CELL; PN = N0 + II * CELL
        best = np.full(PE.shape, 1e9); ss = np.zeros(PE.shape); sg = np.zeros(PE.shape, int); al = np.zeros(PE.shape)
        nrm = []
        for k in range(len(seg)):
            t = seg[k] / Ls[k]; n = np.array([-t[1], t[0]]); m = (W[k] + W[k + 1]) / 2
            zz = lambda q: map_coordinates(Z0, [[(q[1] - N0) / CELL], [(q[0] - E0) / CELL]], order=1)[0]
            if zz(m + 40 * n) > zz(m - 40 * n): n = -n      # n hacia abajo de la ladera
            nrm.append(n)
            u = np.clip(((PE - W[k, 0]) * t[0] + (PN - W[k, 1]) * t[1]) / Ls[k], 0, 1); qx = W[k, 0] + seg[k, 0] * u; qy = W[k, 1] + seg[k, 1] * u
            dd = np.hypot(PE - qx, PN - qy); w = dd < best
            best[w] = dd[w]; sg[w] = k; ss[w] = ((PE - qx) * n[0] + (PN - qy) * n[1])[w]; al[w] = (cum[k] + u * Ls[k])[w]
        N_ = np.array(nrm)[sg]      # normal (abajo) del segmento más cercano
        taper = np.clip(np.minimum(al, Lt - al) / 60.0, 0, 1); taper = taper * taper * (3 - 2 * taper)
        dr, _ = kr.query(np.column_stack([PE.ravel(), PN.ravel()])); dr = dr.reshape(PE.shape); lejos = np.clip((dr - 60) / 30, 0, 1)
        Dk = D * taper * lejos
        zona = (ss > -19) & (ss < 220)      # desde el borde de arriba del camino hacia abajo (la pared de arriba no se toca)
        SE = PE - Dk * N_[..., 0]; SN = PN - Dk * N_[..., 1]      # punto de muestreo: más arriba de la ladera (la pared se corre hacia abajo/afuera = el piso crece)
        # se corre la pared de abajo hacia el norte: Z(p) = Z0(p + D·n) toma la cota de más abajo (la ladera bajo el camino) en el espacio del camino
        SE = PE + Dk * N_[..., 0]; SN = PN + Dk * N_[..., 1]
        zs = map_coordinates(Z0, [(SN - N0) / CELL, (SE - E0) / CELL], order=1)
        Zn = np.where(zona, np.minimum(Z0[II, JJ], zs), Z0[II, JJ]); Z[II, JJ] = Zn
        print("empuje: celdas cambiadas", int((Zn < Z0[II, JJ] - 0.3).sum()), "· excavación máx", round(float((Z0[II, JJ] - Zn).max()), 1), "m · largo del eje", round(Lt), "m")
    return Z
Z = empujar(Z)
# --- grilla: filas de norte a sur (z creciente)
# dentro del rajo = depresión: relleno por inundación desde el borde de la grilla (priority flood); el bit 15 de la grilla marca «dentro del rajo»
import heapq
Zf = Z.copy(); hecho = np.zeros(Z.shape, bool); cola = []
for i in range(ny):
    for j in (0, nx - 1): cola.append((Z[i, j], i, j)); hecho[i, j] = True
for j in range(nx):
    for i in (0, ny - 1):
        if not hecho[i, j]: cola.append((Z[i, j], i, j)); hecho[i, j] = True
heapq.heapify(cola)
while cola:
    h, i, j = heapq.heappop(cola)
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b2 = i + di, j + dj
        if 0 <= a < ny and 0 <= b2 < nx and not hecho[a, b2]:
            hecho[a, b2] = True; Zf[a, b2] = max(Z[a, b2], h); heapq.heappush(cola, (Zf[a, b2], a, b2))
pit = (Zf - Z) > 1.0
print("dentro del rajo:", int(pit.sum()), "celdas (", round(pit.sum() * CELL * CELL / 1e6, 2), "km²); nivel de rebalse", round(float(Zf[pit].max()), 1))
Zs = Z[::-1, :]; q = (np.clip(np.round((Zs - 1000.0) * 10), 0, 32767).astype("<u2") | (pit[::-1, :].astype("<u2") << 15)).astype("<u2")
open(JS + r"\terreno_dwg.bin", "wb").write(q.tobytes()); print("bin", q.shape, q.nbytes // 1000, "kB")
GX0, GZ0 = E0 - EC, NC - (N0 + (ny - 1) * CELL)
# --- ruta
P = np.array(ruta["pts"]); route = [[round(float(x - EC), 1), round(float(NC - y), 1), round(float(z - YC), 1)] for x, y, z in P]
# --- piso de la fase 7: celdas planas conectadas con el inicio de la ruta
gy, gx = np.gradient(Z, CELL); slope = np.hypot(gx, gy)
flat = binary_closing(binary_opening(slope < 0.09, iterations=1), iterations=1)
lab, n = label(flat); i0 = int(round((ruta["ini"][1] - N0) / CELL)); j0 = int(round((ruta["ini"][0] - E0) / CELL))
k = lab[i0, j0]
if k == 0:      # el inicio cayó en una celda no plana: el componente plano más cercano
    ii, jj = np.where(lab > 0); m = np.argmin((ii - i0) ** 2 + (jj - j0) ** 2); k = lab[ii[m], jj[m]]
piso = lab == k; ii, jj = np.where(piso); print("piso fase 7: celdas", piso.sum(), "cota media", round(Z[piso].mean(), 1), "min/max", round(Z[piso].min(), 1), round(Z[piso].max(), 1))
A = np.column_stack([jj * CELL + E0 - EC, NC - (ii * CELL + N0), np.ones(len(ii))]); coef = np.linalg.lstsq(A, Z[piso] - YC, rcond=None)[0]      # plano del piso: y = a·x + b·z + c
print("plano del piso: a", coef[0].round(5), "b", coef[1].round(5), "c", coef[2].round(2), "residuo máx", round(float(np.max(np.abs(A @ coef - (Z[piso] - YC)))), 1))
cs = plt.contour(np.arange(nx) * CELL + E0, np.arange(ny) * CELL + N0, piso.astype(float), levels=[0.5]); plt.close()
polys = []
for pth in cs.get_paths():      # cada path puede traer varios anillos (códigos MOVETO)
    cur = []
    for v, c in zip(pth.vertices, pth.codes if pth.codes is not None else [1] + [2] * (len(pth.vertices) - 1)):
        if c == 1 and cur: polys.append(np.array(cur)); cur = []
        cur.append(v)
    if cur: polys.append(np.array(cur))
poly = max(polys, key=len)
def simplifica(pts, tol):      # Douglas–Peucker
    pts = np.asarray(pts)
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; ab = b - a; L = np.hypot(*ab) or 1
    dd = np.abs((pts[:, 0] - a[0]) * ab[1] - (pts[:, 1] - a[1]) * ab[0]) / L; i = int(np.argmax(dd))
    if dd[i] > tol: return np.vstack([simplifica(pts[:i + 1], tol)[:-1], simplifica(pts[i:], tol)])
    return np.array([a, b])
if np.allclose(poly[0], poly[-1]): poly = poly[:-1]
m = int(np.argmax(np.hypot(poly[:, 0] - poly[0, 0], poly[:, 1] - poly[0, 1])))      # anillo: se parte en dos en el punto más lejano
poly = np.vstack([simplifica(poly[:m + 1], 6.0)[:-1], simplifica(np.vstack([poly[m:], poly[:1]]), 6.0)[:-1]])
f7poly = [list(g(x, y)) for x, y in poly]; print("polígono fase 7:", len(f7poly), "vértices")
# --- zonas de riesgo, cuñas, pretiles, radares, estaciones
zonas = [{"color": z["color"], "pts": [list(g(x, y)) for x, y in z["pts"]]} for z in R["zonas"]]
cunas = [{"tipo": c["tipo"], "pts": [list(g(x, y)) for x, y in c["pts"]]} for c in R["cunas"] if len(c["pts"]) > 2]
pretiles = [[list(g(x, y)) for x, y in p["pts"]] for p in R["pretiles"]]
radares = [{"nombre": r["nombre"], "x": g(r["x"], r["y"])[0], "z": g(r["x"], r["y"])[1]} for r in R["radares"]]
estaciones = [{"nombre": r["nombre"], "x": g(r["x"], r["y"])[0], "z": g(r["x"], r["y"])[1]} for r in R["estaciones"] if "LEICA" in r["nombre"]]
sectores = [{"n": s["n"], "x": g(s["x"], s["y"])[0], "z": g(s["x"], s["y"])[1]} for s in R.get("numeros", [])]
# --- tramos de la ruta cerca de riesgos (zonas, cuñas o sectores numerados a < 70 m): GEO_ZONES [s0, s1]
s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P[:, :2], axis=0).T))])
cerca = np.zeros(len(P), bool)
for z in R["zonas"] + [c for c in R["cunas"] if len(c["pts"]) > 2]:
    Q = np.array(z["pts"]); dd = np.sqrt(((P[:, None, :2] - Q[None, :, :]) ** 2).sum(-1)).min(1); cerca |= dd < 70
    if len(Q) > 2: cerca |= MPath(Q).contains_points(P[:, :2])
geo = []; k = 0
while k < len(P):
    if cerca[k]:
        j = k
        while j < len(P) and cerca[j]: j += 1
        geo.append([int(s[k]), int(s[j - 1])]); k = j
    else: k += 1
geo = [t for t in geo if t[1] - t[0] > 20]; print("tramos de riesgo en la ruta (s):", geo)
# --- pisos planos del rajo (≥ 0,8 ha, bajo la cota 1680) con sus frentes de carguío (puntos a 14–18 m de una pared que sube, lejos de la ruta)
from scipy.ndimage import distance_transform_edt
from scipy.spatial import cKDTree
def poligono(mask):
    cs = plt.contour(np.arange(nx) * CELL + E0, np.arange(ny) * CELL + N0, mask.astype(float), levels=[0.5]); plt.close()
    polys = []
    for pth in cs.get_paths():
        cur = []
        for v, c in zip(pth.vertices, pth.codes if pth.codes is not None else [1] + [2] * (len(pth.vertices) - 1)):
            if c == 1 and cur: polys.append(np.array(cur)); cur = []
            cur.append(v)
        if cur: polys.append(np.array(cur))
    q = max(polys, key=len)
    if np.allclose(q[0], q[-1]): q = q[:-1]
    m = int(np.argmax(np.hypot(q[:, 0] - q[0, 0], q[:, 1] - q[0, 1])))
    return np.vstack([simplifica(q[:m + 1], 5.0)[:-1], simplifica(np.vstack([q[m:], q[:1]]), 5.0)[:-1]])
kdr = cKDTree(P[:, :2])
kf = lab[i0, j0]      # componente plano del piso de la partida (k se reutilizó más arriba)
if kf == 0: ii_, jj_ = np.where(lab > 0); m_ = np.argmin((ii_ - i0) ** 2 + (jj_ - j0) ** 2); kf = lab[ii_[m_], jj_[m_]]
pisos = []
for k2 in range(1, n + 1):
    m = lab == k2
    if m.sum() * CELL * CELL < 8000: continue
    ii, jj = np.where(m); E = jj * CELL + E0; Nn = ii * CELL + N0
    if Z[m].mean() > 1680 or pit[m].mean() < 0.5: continue      # solo pisos dentro del rajo
    dt = distance_transform_edt(m) * CELL
    dr, _ = kdr.query(np.column_stack([E, Nn]))
    gyd, gxd = np.gradient(dt, CELL)      # dt crece hacia adentro: la pared está en −∇dt
    fr = []
    cand = np.where((dt[m] >= 14) & (dt[m] <= 18))[0]
    for c in cand[np.argsort(-dr[cand])]:
        i, j = ii[c], jj[c]; fx, fy = -gxd[i, j], -gyd[i, j]; nn = np.hypot(fx, fy)
        if nn < 1e-6: continue
        fx /= nn; fy /= nn
        i2, j2 = int(round(i + fy * 26 / CELL)), int(round(j + fx * 26 / CELL))
        if not (0 <= i2 < ny and 0 <= j2 < nx): continue
        if Z[i2, j2] - Z[i, j] < 12 or dr[c] < 70: continue      # la pared sube ≥ 12 m a 26 m (un banco entero: frente de carguío); lejos de la ruta
        if any(np.hypot(E[c] - f["E"], Nn[c] - f["N"]) < 90 for f in fr): continue
        fr.append({"E": float(E[c]), "N": float(Nn[c]), "fx": float(fx), "fy": float(fy), "dRuta": float(dr[c])})
        if len(fr) >= 3: break
    xs_ = E - EC; zs_ = NC - Nn; cx_, cz_ = xs_.mean(), zs_.mean()
    cov = np.cov(np.vstack([xs_ - cx_, zs_ - cz_])); w_, v_ = np.linalg.eigh(cov); ux_, uz_ = v_[:, 1]
    pisos.append({"cx": round(float(cx_), 1), "cz": round(float(cz_), 1), "y": round(float(Z[m].mean() - YC), 1), "area": int(m.sum() * CELL * CELL), "dRuta": int(dr.min()),
                  "ux": round(float(ux_), 3), "uz": round(float(uz_), 3), "poly": [list(g(x, y)) for x, y in poligono(m)],
                  "frentes": [{"x": g(f["E"], f["N"])[0], "z": g(f["E"], f["N"])[1], "fx": round(f["fx"], 3), "fz": round(-f["fy"], 3), "dRuta": int(f["dRuta"])} for f in fr],
                  "f7": bool(k2 == kf)})
print("componente del piso de la partida:", int(kf), "celdas", int((lab == kf).sum()), "cota media", round(float(Z[lab == kf].mean()), 1), "| pisos con f7:", sum(1 for q in pisos if q["f7"]))
pisos.sort(key=lambda q: q["y"])
pisos[0]["fondo"] = True
cand_c = [q for q in pisos if not q.get("f7") and not q.get("fondo") and 25 <= q["dRuta"] < 300 and q["area"] >= 8000 and -450 < q["y"] < -40]      # terrazas junto a la ruta (sin que la cruce)
cand_c.sort(key=lambda q: q["dRuta"])
for q in cand_c[:3]: q["cancha"] = True
print("pisos:", len(pisos))
for q in pisos: print("  ", {kk: vv for kk, vv in q.items() if kk not in ("poly", "frentes")}, "frentes", len(q["frentes"]))
# --- red de caminos interiores: camino conducible desde cada piso hasta la rampa principal (Dijkstra con un nodo virtual unido a todas las celdas de la ruta)
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.ndimage import uniform_filter1d
pared = slope > 0.35; dpared = distance_transform_edt(~pared) * CELL
idx = np.arange(ny * nx).reshape(ny, nx); rows, cols, w = [], [], []
for dy, dx in [(0, 1), (1, 0), (1, 1), (1, -1)]:
    Lc = CELL * np.hypot(dy, dx)
    if dx >= 0: A = idx[:ny - dy, :nx - dx]; B = idx[dy:, dx:]
    else: A = idx[:ny - dy, -dx:]; B = idx[dy:, :nx + dx]
    za = Z.ravel()[A.ravel()]; zb = Z.ravel()[B.ravel()]; gg = np.abs(zb - za) / Lc
    pen = 1 + 6 * gg + 3.0 * np.exp(-np.minimum(dpared.ravel()[A.ravel()], dpared.ravel()[B.ravel()]) / 8.0)
    c = np.where(gg <= 0.12, Lc * pen, np.inf); ok = np.isfinite(c)
    rows += [A.ravel()[ok], B.ravel()[ok]]; cols += [B.ravel()[ok], A.ravel()[ok]]; w += [c[ok], c[ok]]
NV = ny * nx      # nodo virtual: la ruta entera
celda = lambda E, N: int(round((N - N0) / CELL)) * nx + int(round((E - E0) / CELL))
rcells = sorted(set(celda(x, y) for x, y in P[:, :2]))
rows.append(np.full(len(rcells), NV)); cols.append(np.array(rcells)); w.append(np.full(len(rcells), 0.001))
rows.append(np.array(rcells)); cols.append(np.full(len(rcells), NV)); w.append(np.full(len(rcells), 0.001))
Gm = coo_matrix((np.concatenate(w), (np.concatenate(rows), np.concatenate(cols))), shape=(NV + 1, NV + 1)).tocsr()
dist, pred = dijkstra(Gm, indices=NV, return_predecessors=True)
en_red = np.zeros(NV, bool); en_red[rcells] = True
caminos = []
def ruta_desde(c0):      # celdas desde c0 hasta la red ya dibujada (o la ruta)
    path = []; k = c0
    while k != NV and k >= 0 and not en_red[k]: path.append(k); k = pred[k]
    return path
for q in pisos:
    if q.get("f7"): continue
    Eq, Nq = q["cx"] + EC, NC - q["cz"]; c0 = celda(Eq, Nq)
    if not np.isfinite(dist[c0]): q["salida"] = None; continue
    path = ruta_desde(c0)
    if len(path) < 4: q["salida"] = None; continue
    pts = np.array([(E0 + (k % nx) * CELL, N0 + (k // nx) * CELL) for k in path], float)
    # salida del piso: primera celda del camino fuera del polígono del piso (ahí llegan las huellas de los camiones)
    mpath = MPath(np.array([[x + EC, NC - z] for x, z in q["poly"]])); fuera = np.where(~mpath.contains_points(pts))[0]
    s_i = int(fuera[0]) if len(fuera) else 0; q["salida"] = list(g(pts[s_i, 0], pts[s_i, 1]))
    if q.get("fondo"): ruta_fondo = pts.copy()      # del centro del fondo hacia arriba (para ubicar SEM 6)
    if q.get("cancha"): path = path[s_i:]; pts = pts[s_i:]      # la cancha de perforación no la cruza ningún camino
    if len(path) < 4: continue
    for k in path: en_red[k] = True
    Ps = np.column_stack([uniform_filter1d(pts[:, 0], 7, mode="nearest"), uniform_filter1d(pts[:, 1], 7, mode="nearest")])
    caminos.append([list(g(x, y)) for x, y in simplifica(Ps, 1.5)])
# caminos marcados a mano (botón «Punto» del juego, coordenadas del juego): del punto al piso del fondo por el camino conducible (mismo costo que los demás, sin pasar por la ruta)
MARCAS_CAMINO = [(426.6, -295.1)]      # fase 7, lado poniente → fondo mina (pedido del usuario, 21-11-2026)
qf = [q for q in pisos if q.get("fondo")][0]; mfondo = MPath(np.array([[x + EC, NC - z] for x, z in qf["poly"]]))
Gs = Gm[:NV, :NV]
for (mx_, mz_) in MARCAS_CAMINO:
    c0 = celda(mx_ + EC, NC - mz_); cf = celda(qf["cx"] + EC, NC - qf["cz"])
    d1, p1 = dijkstra(Gs, indices=c0, return_predecessors=True)
    if not np.isfinite(d1[cf]): print("camino marcado sin salida conducible:", mx_, mz_); continue
    path = []; k = cf
    while k != c0 and k >= 0: path.append(int(k)); k = p1[k]
    path.append(c0); path.reverse()
    pts = np.array([(E0 + (k % nx) * CELL, N0 + (k // nx) * CELL) for k in path], float)
    dentro = np.where(mfondo.contains_points(pts))[0]; fin = int(dentro[0]) + 1 if len(dentro) else len(pts)      # termina al entrar al piso del fondo
    path = path[:fin]; pts = pts[:fin]
    for k in path: en_red[k] = True
    Ps = np.column_stack([uniform_filter1d(pts[:, 0], 7, mode="nearest"), uniform_filter1d(pts[:, 1], 7, mode="nearest")])
    caminos.append([list(g(x, y)) for x, y in simplifica(Ps, 1.5)])
    print("camino marcado", (mx_, mz_), "→ fondo:", round(len(pts) * CELL), "m aprox,", "de", round(float(Z.ravel()[c0] - YC), 1), "a", round(float(Z.ravel()[path[-1]] - YC), 1))
# rampas que no salen de ningún piso: semillas cada ~48 m en celdas de rampa (pendiente 3–13 %, ≥ 11 m de una cara, dentro del rajo, fuera de los pisos y del fondo), unidas a la red por el camino conducible
enpiso = np.zeros(Z.shape, bool)
for q in pisos: enpiso |= lab == [kk for kk in range(1, n + 1) if abs(float(Z[lab == kk].mean() - YC) - q["y"]) < 0.05 and int((lab == kk).sum() * CELL * CELL) == q["area"]][0]
fondo_y = [q for q in pisos if q.get("fondo")][0]["y"] + YC
rampa = pit & (slope > 0.03) & (slope < 0.13) & (dpared >= 10) & ~enpiso & (Z > fondo_y + 5)
print("celdas de rampa:", int(rampa.sum()), "| pendiente ok", int((pit & (slope > 0.03) & (slope < 0.13)).sum()), "| lejos de caras", int((pit & (dpared >= 10)).sum()))
semillas = [(i, j) for i in range(0, ny, 12) for j in range(0, nx, 12) if rampa[i, j]]
print("semillas de rampa:", len(semillas))
nuevos = 0
for i, j in semillas:
    c0 = i * nx + j
    if en_red[c0] or not np.isfinite(dist[c0]): continue
    path = ruta_desde(c0)
    if len(path) < 8: continue
    pts = np.array([(E0 + (k % nx) * CELL, N0 + (k // nx) * CELL) for k in path], float)
    for k in path: en_red[k] = True
    Ps = np.column_stack([uniform_filter1d(pts[:, 0], 7, mode="nearest"), uniform_filter1d(pts[:, 1], 7, mode="nearest")])
    caminos.append([list(g(x, y)) for x, y in simplifica(Ps, 1.5)]); nuevos += 1
print("rampas sueltas agregadas:", nuevos)
# cota de cada camino (muestreada del terreno y suavizada, pendiente ≤ 12 %): [x, z, y] por vértice
def monotona(y, w):      # regresión isotónica (pool adjacent violators) creciente, con pesos
    bl = [[y[0] * w[0], w[0], 1]]
    for k in range(1, len(y)):
        bl.append([y[k] * w[k], w[k], 1])
        while len(bl) > 1 and bl[-2][0] / bl[-2][1] > bl[-1][0] / bl[-1][1]: s2, w2, n2 = bl.pop(); bl[-1][0] += s2; bl[-1][1] += w2; bl[-1][2] += n2
    return np.concatenate([np.full(n, s_ / w_) for s_, w_, n in bl])
def cota_camino(c):
    pts = np.array(c, float); zs = np.array([Z[int(round((NC - z - N0) / CELL)), int(round((x + EC - E0) / CELL))] for x, z in pts]) - YC
    if len(zs) > 2:
        zs = uniform_filter1d(zs, 5, mode="nearest"); ds = np.maximum(np.hypot(*np.diff(pts, axis=0).T), 0.1)
        dentro = np.mean([pit[int(round((NC - z - N0) / CELL)), int(round((x + EC - E0) / CELL))] for x, z in pts]) > 0.5
        if dentro:      # dentro del rajo los caminos van siempre en un sentido (sin sube y baja) y con la pendiente cambiando de a poco
            cum = np.concatenate([[0], np.cumsum(ds)]); w = np.gradient(cum) + 0.1; sg = 1.0 if zs[-1] >= zs[0] else -1.0; za, zb = zs[0], zs[-1]
            z_t = zs.copy(); zs = sg * monotona(sg * zs, w); zs[0], zs[-1] = za, zb; zs = np.clip(zs, min(za, zb), max(za, zb)); zs = z_t + np.clip(zs - z_t, -8.0, 8.0)      # los extremos conservan su cota (empalman con lo vecino)
            for _ in range(2):      # suavizado gaussiano por distancia (σ ≈ 40 m), sin mover los extremos
                K = np.exp(-0.5 * ((cum[:, None] - cum[None, :]) / 40.0) ** 2) * w[None, :]; zz = (K @ zs) / K.sum(1); zz[0], zz[-1] = zs[0], zs[-1]; zs = zz
        for it in range(20):
            for k in range(1, len(zs)): zs[k] = min(zs[k - 1] + 0.12 * ds[k - 1], max(zs[k - 1] - 0.12 * ds[k - 1], zs[k]))
            for k in range(len(zs) - 2, -1, -1): zs[k] = min(zs[k + 1] + 0.12 * ds[k], max(zs[k + 1] - 0.12 * ds[k], zs[k]))
    return [[round(float(x), 1), round(float(z), 1), round(float(y), 1)] for (x, z), y in zip(pts, zs)]
caminos = [cota_camino(c) for c in caminos]
print("caminos interiores:", len(caminos), "tramos,", sum(len(c) for c in caminos), "vértices")
# --- SEM 6: junto a la tercera curva del camino que baja al fondo, contando desde el fondo (muy por debajo de la interrampa), en un sitio plano fuera de los caminos
sem6 = None
Pf = np.column_stack([uniform_filter1d(ruta_fondo[:, 0], 9, mode="nearest"), uniform_filter1d(ruta_fondo[:, 1], 9, mode="nearest")])
hd = np.unwrap(np.arctan2(np.gradient(Pf[:, 1]), np.gradient(Pf[:, 0]))); W8 = 10
giro = np.array([hd[min(len(hd) - 1, k + W8)] - hd[max(0, k - W8)] for k in range(len(hd))])      # giro en ~80 m
curvas = []; k = 0
while k < len(giro):
    zk = Z[int(round((Pf[k, 1] - N0) / CELL)), int(round((Pf[k, 0] - E0) / CELL))]
    if abs(giro[k]) > 1.25 and zk > fondo_y + 12:      # curva del camino (no dentro del piso del fondo)
        j = k
        while j < len(giro) and abs(giro[j]) > 1.25: j += 1
        a = k + int(np.argmax(np.abs(giro[k:j]))); curvas.append(a); k = j + W8
    else: k += 1
print("curvas del camino al fondo (desde el fondo):", [(int(a), round(float(np.degrees(giro[a]))), round(float(Z[int(round((Pf[a, 1] - N0) / CELL)), int(round((Pf[a, 0] - E0) / CELL))]), 1)) for a in curvas])
if curvas:
    a = curvas[min(2, len(curvas) - 1)]; Ea, Na = Pf[a]
    roadm = np.zeros(ny * nx, bool); roadm[en_red] = True; roadm = roadm.reshape(ny, nx)
    droad = distance_transform_edt(~roadm) * CELL; dtf = distance_transform_edt(flat) * CELL
    XX, YY = np.meshgrid(np.arange(nx) * CELL + E0, np.arange(ny) * CELL + N0); dap = np.hypot(XX - Ea, YY - Na)
    nin = np.sign(giro[a]) * np.array([-np.sin(hd[a]), np.cos(hd[a])])      # normal hacia el interior de la curva
    fuera = ((XX - Ea) * nin[0] + (YY - Na) * nin[1]) < 0      # rincón: el lado exterior de la curva, contra la pared (como la SEM 6 real)
    ok = pit & fuera & (dtf >= 8) & (dtf <= 20) & (droad >= 22) & (droad <= 45) & (dap < 90)
    if not ok.any(): ok = pit & (dtf >= 10) & (droad >= 18) & (droad <= 70) & (dap < 160)
    if ok.any():
        ii, jj = np.where(ok); c = int(np.argmin(dap[ok] + 0.5 * dtf[ok])); E_, N_ = XX[ii[c], jj[c]], YY[ii[c], jj[c]]
        gN, gE = np.gradient(dtf, CELL); rot6 = float(np.arctan2(-gE[ii[c], jj[c]], -gN[ii[c], jj[c]]))      # remolque paralelo a la pared
        sem6 = {"x": g(E_, N_)[0], "z": g(E_, N_)[1], "rot": round(rot6, 3), "cota": round(float(Z[ii[c], jj[c]]), 1), "curva": round(float(Z[int(round((Na - N0) / CELL)), int(round((Ea - E0) / CELL))]), 1)}
print("SEM 6:", sem6)
# --- canchas marcadas a mano por el usuario (coordenadas del juego): la terraza plana que contiene el punto reemplaza a la cancha detectada más cercana
MARCAS_CANCHA = [(470.0, 0.0)]      # banco bajo la terraza grande de la cancha 381,148 (marcado en la captura del usuario)
for mx, mz in MARCAS_CANCHA:
    Em, Nm = mx + EC, NC - mz; im, jm = int(round((Nm - N0) / CELL)), int(round((Em - E0) / CELL))
    k3 = lab[im, jm]
    if k3 == 0:
        ii_, jj_ = np.where(lab > 0); d2 = (ii_ - im) ** 2 + (jj_ - jm) ** 2; c_ = int(np.argmin(d2)); k3 = lab[ii_[c_], jj_[c_]]
    m3 = lab == k3; ii3, jj3 = np.where(m3); E3 = jj3 * CELL + E0; N3 = ii3 * CELL + N0; xs3 = E3 - EC; zs3 = NC - N3
    w3, v3 = np.linalg.eigh(np.cov(np.vstack([xs3 - xs3.mean(), zs3 - zs3.mean()])))
    nueva = {"cx": round(float(xs3.mean()), 1), "cz": round(float(zs3.mean()), 1), "y": round(float(Z[m3].mean() - YC), 1), "area": int(m3.sum() * CELL * CELL), "dRuta": int(kdr.query(np.column_stack([E3, N3]))[0].min()),
             "ux": round(float(v3[0, 1]), 3), "uz": round(float(v3[1, 1]), 3), "poly": [list(g(x, y)) for x, y in poligono(m3)], "frentes": [], "f7": False, "cancha": True, "marca": True}
    dt3 = distance_transform_edt(m3) * CELL; dr3, _ = kdr.query(np.column_stack([E3, N3])); gy3, gx3 = np.gradient(dt3, CELL); fr3 = []
    for c in np.where((dt3[m3] >= 14) & (dt3[m3] <= 18))[0][np.argsort(-dr3[np.where((dt3[m3] >= 14) & (dt3[m3] <= 18))[0]])]:
        i, j = ii3[c], jj3[c]; fx, fy = -gx3[i, j], -gy3[i, j]; nn = np.hypot(fx, fy)
        if nn < 1e-6: continue
        fx /= nn; fy /= nn; i2, j2 = int(round(i + fy * 26 / CELL)), int(round(j + fx * 26 / CELL))
        if not (0 <= i2 < ny and 0 <= j2 < nx) or Z[i2, j2] - Z[i, j] < 12 or dr3[c] < 50: continue
        if any(np.hypot(E3[c] - f["E"], N3[c] - f["N"]) < 90 for f in fr3): continue
        fr3.append({"E": float(E3[c]), "N": float(N3[c]), "fx": float(fx), "fy": float(fy), "dRuta": float(dr3[c]), "alto": float(Z[i2, j2] - Z[i, j])})
        if len(fr3) >= 3: break
    fr3.sort(key=lambda f: -f["alto"])      # primero el frente contra la pared más alta (ahí trabaja la pala)
    nueva["frentes"] = [{"x": g(f["E"], f["N"])[0], "z": g(f["E"], f["N"])[1], "fx": round(f["fx"], 3), "fz": round(-f["fy"], 3), "dRuta": int(f["dRuta"]), "alto": round(f["alto"], 1)} for f in fr3]
    print("frentes de la cancha marcada (alto de pared):", [(f["x"], f["z"], f["alto"]) for f in nueva["frentes"]])
    print("frentes de la cancha marcada:", len(nueva["frentes"]))
    vieja = min([q for q in pisos if q.get("cancha")], key=lambda q: (q["cx"] - mx) ** 2 + (q["cz"] - mz) ** 2)
    vieja["cancha"] = False; pisos.insert(0, nueva)      # primera: su perforadora es la 403
    print("cancha marcada: terraza", nueva["area"], "m² a cota", round(nueva["y"] + YC, 1), "(reemplaza a la de", round(vieja["cx"]), round(vieja["cz"]), ")")
# --- pisos sin equipos (ni carguío ni perforación): son tramos casi planos de camino (p. ej. el antiguo «celeste»); se les traza un camino por el eje, de la salida al
# extremo más lejano, y desde ese extremo el camino conducible hasta la red más cercana sin volver por el piso (empalme): huellas, calzada pintada, cables por postes
def ejes_pisos():
    from scipy.sparse.csgraph import dijkstra as dj
    nuevos_ = []
    Gs_ = Gm[:NV, :NV].tolil(copy=True) if False else None
    red = en_red.copy()
    for q in pisos:
        if q.get("f7") or q.get("fondo") or q.get("cancha") or not q.get("salida"): continue
        mp = MPath(np.array([[x + EC, NC - z] for x, z in q["poly"]]))
        xe = [p_[0] + EC for p_ in q["poly"]]; ne = [NC - p_[1] for p_ in q["poly"]]
        j0, j1 = int(max(0, (min(xe) - E0) / CELL - 1)), int(min(nx - 1, (max(xe) - E0) / CELL + 1)); i0, i1 = int(max(0, (min(ne) - N0) / CELL - 1)), int(min(ny - 1, (max(ne) - N0) / CELL + 1))
        II, JJ = np.mgrid[i0:i1 + 1, j0:j1 + 1]; sub = np.zeros((ny, nx), bool)
        sub[II, JJ] = mp.contains_points(np.column_stack([E0 + JJ.ravel() * CELL, N0 + II.ravel() * CELL])).reshape(II.shape)
        if sub.sum() < 20: continue
        dtp = distance_transform_edt(sub) * CELL; cells = np.argwhere(sub); idx = -np.ones((ny, nx), int); idx[sub] = np.arange(len(cells))
        rr, cc, ww, w1 = [], [], [], []
        for di, dj_ in ((0, 1), (1, 0), (1, 1), (1, -1)):
            A_ = cells; B_ = cells + [di, dj_]; ok_ = (B_[:, 0] < ny) & (B_[:, 1] >= 0) & (B_[:, 1] < nx); A_ = A_[ok_]; B_ = B_[ok_]; ok_ = sub[B_[:, 0], B_[:, 1]]; A_ = A_[ok_]; B_ = B_[ok_]
            L_ = CELL * (1.414 if di and dj_ else 1.0); w_ = L_ * (1 + 12 * np.exp(-np.minimum(dtp[A_[:, 0], A_[:, 1]], dtp[B_[:, 0], B_[:, 1]]) / 6))
            ia, ib = idx[A_[:, 0], A_[:, 1]], idx[B_[:, 0], B_[:, 1]]; rr += [ia, ib]; cc += [ib, ia]; ww += [w_, w_]; w1 += [np.full(len(ia), L_)] * 2
        R_, C_ = np.concatenate(rr), np.concatenate(cc)
        Gp = coo_matrix((np.concatenate(ww), (R_, C_)), shape=(len(cells),) * 2).tocsr(); G1 = coo_matrix((np.concatenate(w1), (R_, C_)), shape=(len(cells),) * 2).tocsr()
        Es, Ns = q["salida"][0] + EC, NC - q["salida"][1]; s0 = int(np.argmin((E0 + cells[:, 1] * CELL - Es) ** 2 + (N0 + cells[:, 0] * CELL - Ns) ** 2))
        geo = dj(G1, indices=s0); t0 = int(np.argmax(np.where(np.isfinite(geo), geo, -1)))
        _, pr = dj(Gp, indices=s0, return_predecessors=True)
        path = []; k = t0
        while k >= 0 and k != s0: path.append(k); k = pr[k]
        path.append(s0); path.reverse()
        if len(path) < 6: continue
        pts = np.array([(E0 + cells[k, 1] * CELL, N0 + cells[k, 0] * CELL) for k in path], float)
        # empalme: del extremo lejano a la red más cercana por el camino conducible, sin pasar por el piso (salvo sus primeras celdas)
        fin = int(cells[t0, 0]) * nx + int(cells[t0, 1]); flat_sub = sub.ravel().copy()
        cerca = np.hypot(XXg.ravel() - XXg.ravel()[fin], YYg.ravel() - YYg.ravel()[fin]) < 30; bloq = flat_sub & ~cerca
        Gq = Gm[:NV, :NV].tocsr(copy=True); Gq = Gq.multiply(1); 
        dq, pq = dj(Gq, indices=fin, return_predecessors=True, limit=8000)
        cand = np.where(red & ~flat_sub & np.isfinite(dq))[0]
        emp = None
        if len(cand):
            # ruta por fuera del piso: descarta destinos cuyo camino vuelve a entrar al piso
            for tgt in cand[np.argsort(dq[cand])][:40]:
                pp = []; k = tgt
                while k >= 0 and k != fin: pp.append(int(k)); k = pq[k]
                if k != fin or any(bloq[c_] for c_ in pp): continue
                emp = pp[::-1]; break
        if emp:
            pe = np.array([(E0 + (k % nx) * CELL, N0 + (k // nx) * CELL) for k in emp], float); pts = np.vstack([pts, pe])
        Ps = np.column_stack([uniform_filter1d(pts[:, 0], 9, mode="nearest"), uniform_filter1d(pts[:, 1], 9, mode="nearest")])
        nuevos_.append(cota_camino([list(g(x, y)) for x, y in simplifica(Ps, 2.0)]))
        print("piso sin equipos", (q["cx"], q["cz"]), "-> eje", round(len(path) * CELL), "m", ("+ empalme %d m" % round(len(emp) * CELL)) if emp else "(sin empalme)")
    return nuevos_
XXg, YYg = np.meshgrid(np.arange(nx) * CELL + E0, np.arange(ny) * CELL + N0)
caminos += ejes_pisos()
# --- empalmes en pendiente marcados a mano: del punto (coordenadas del juego) a un camino ya trazado, bajo la cota dada, por el terreno (se acepta terreno hasta ~22 %:
# el camino se excava a su cota) con pendiente pareja ≤ 11 %. Pedido del usuario (21-11-2026): el antiguo «celeste» baja del extremo poniente del piso largo y se empalma bajo la fase 7
MARCAS_EMPALME = [((-27.6, 311.6), (426.6, -295.1), -440.0),      # (desde, camino al que se empalma = el que empieza cerca de este punto, empalme bajo esta cota)
                  ((500.0, -0.4), (150.0, -348.0), None)]      # el usuario lo dibujó en azul en el mapa: del final del empalme anterior al camino 13 (al poniente de la fase 7); None = llega a ese punto
def grafo_empalme(gmax, kpen):
    rows_, cols_, w_ = [], [], []
    for di, dj_ in ((0, 1), (1, 0), (1, 1), (1, -1)):
        A_ = np.arange(ny * nx).reshape(ny, nx); i_a = A_[max(0, -di):ny - max(0, di), max(0, -dj_):nx - max(0, dj_)]; i_b = A_[max(0, di):ny - max(0, -di) + (0 if di >= 0 else 0), max(0, dj_):nx - max(0, -dj_)]
        i_a = i_a.ravel(); i_b = i_b.ravel(); L_ = CELL * (1.414 if di and dj_ else 1.0)
        gg_ = np.abs(Z.ravel()[i_b] - Z.ravel()[i_a]) / L_; dp_ = np.minimum(dpared.ravel()[i_a], dpared.ravel()[i_b])
        c_ = np.where((gg_ <= gmax) & pit.ravel()[i_a] & pit.ravel()[i_b], L_ * (1 + kpen * gg_ ** 2 + 1.5 * np.exp(-dp_ / 8.0)), np.inf); ok_ = np.isfinite(c_)
        rows_ += [i_a[ok_], i_b[ok_]]; cols_ += [i_b[ok_], i_a[ok_]]; w_ += [c_[ok_], c_[ok_]]
    return coo_matrix((np.concatenate(w_), (np.concatenate(rows_), np.concatenate(cols_))), shape=(ny * nx, ny * nx)).tocsr()
def empalmes():
    from scipy.sparse.csgraph import dijkstra as dj
    out = []
    grafos = [(0.22, 40.0), (3.0, 400.0)]      # primero por terreno conducible (≤ 22 %); si no hay, se construye la rampa cortando bancos (lo empinado muy caro)
    for (sx_, sz_), (cx_, cz_), ymax in MARCAS_EMPALME:
        dest = min(caminos, key=lambda c: np.hypot(c[0][0] - cx_, c[0][1] - cz_))
        for gmax, kpen in grafos:
            Gr = grafo_empalme(gmax, kpen)
            s0 = celda(sx_ + EC, NC - sz_); y0 = float(Z.ravel()[s0] - YC)
            q_ = next((q for q in pisos if MPath(np.array([[x + EC, NC - z] for x, z in q["poly"]])).contains_point((sx_ + EC, NC - sz_)) or np.hypot(q["cx"] - sx_, q["cz"] - sz_) < 1), None)
            Gx = Gr
            if q_ is not None and ymax is not None:      # no vuelve por el piso de donde sale (salvo sus primeros 40 m); no rige si el empalme va a un punto dado
                mq = MPath(np.array([[x + EC, NC - z] for x, z in q_["poly"]])).contains_points(np.column_stack([XXg.ravel(), YYg.ravel()])) & (np.hypot(XXg.ravel() - (sx_ + EC), YYg.ravel() - (NC - sz_)) > 40)
                keep = np.where(~mq, 1.0, 0.0); from scipy.sparse import diags; Dk = diags(keep); Gx = (Dk @ Gr @ Dk).tocsr(); Gx.eliminate_zeros()
                print("empalme: se bloquean", int(mq.sum()), "celdas del piso de salida")
            dd, pr = dj(Gx, indices=s0, return_predecessors=True)
            cand = []
            if ymax is None: c0_ = celda(cx_ + EC, NC - cz_); cand = [(dd[c0_], c0_, float(Z.ravel()[c0_] - YC))] if np.isfinite(dd[c0_]) else []
            for k_ in range(len(dest) - 1 if ymax is not None else 0):      # puntos del camino destino cada ~8 m bajo la cota pedida
                (ax, az, ay), (bx, bz, by) = dest[k_], dest[k_ + 1]; nn = max(1, int(np.hypot(bx - ax, bz - az) / 8))
                for t in np.linspace(0, 1, nn, endpoint=False):
                    x_, z_, y_ = ax + (bx - ax) * t, az + (bz - az) * t, ay + (by - ay) * t
                    if y_ > ymax: continue
                    c0_ = celda(x_ + EC, NC - z_)
                    if np.isfinite(dd[c0_]): cand.append((dd[c0_], c0_, y_))
            cand.sort(); best = None
            for _, c0_, y_ in cand:
                path = []; k = c0_
                while k >= 0 and k != s0: path.append(int(k)); k = pr[k]
                if k != s0: continue
                path.append(s0); path.reverse(); pts = np.array([(E0 + (k % nx) * CELL, N0 + (k // nx) * CELL) for k in path], float)
                Lp = float(np.hypot(*np.diff(pts, axis=0).T).sum())
                if abs(y0 - y_) <= 0.11 * Lp: best = (pts, Lp, y_); break
            if not best: print("empalme sin trazado con terreno ≤", gmax, "desde", (sx_, sz_)); continue
            pts, Lp, y1 = best
            Ps = np.column_stack([uniform_filter1d(pts[:, 0], 9, mode="nearest"), uniform_filter1d(pts[:, 1], 9, mode="nearest")]); Ps[0] = pts[0]; Ps[-1] = pts[-1]
            S_ = simplifica(Ps, 2.0); S_ = np.array(S_, float); ds = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(S_, axis=0).T))]); Lt = ds[-1] or 1
            Sg = [list(g(x, y)) for x, y in S_]
            def dseg_(p, c):
                bb = 1e9
                for a1, b1 in zip(c[:-1], c[1:]):
                    a1 = np.array(a1[:2], float); b1 = np.array(b1[:2], float); v = b1 - a1; t = np.clip(np.dot(p - a1, v) / (np.dot(v, v) or 1), 0, 1); bb = min(bb, float(np.linalg.norm(p - a1 - v * t)))
                return bb
            otros = [c for c in caminos if not (q_ is not None and np.hypot(c[-1][0] - sx_, c[-1][1] - sz_) < 8)]      # sin el eje del piso de salida
            Lc, corte = 0.0, len(Sg)
            for k_ in range(1, len(Sg)):
                Lc += float(np.hypot(Sg[k_][0] - Sg[k_ - 1][0], Sg[k_][1] - Sg[k_ - 1][1]))
                if ymax is not None and Lc > 150 and min(dseg_(np.array(Sg[k_], float), c) for c in otros) < 3: corte = k_ + 1; break
            Sg = Sg[:corte]
            out.append(cota_camino(Sg))      # cota siguiendo el terreno, suavizada y ≤ 12 % (como los demás caminos); termina en el primer camino que encuentra
            print("empalme cortado en el primer camino existente:", Sg[-1], "a", round(Lc), "m")
            print("empalme", (sx_, sz_), "->", round(Lp), "m, de", round(y0, 1), "a", round(y1, 1), "(pendiente media", round(abs(y1 - y0) / Lp * 100, 1), "%, terreno ≤", gmax, ")"); break
    return out
caminos += empalmes()
# --- uniones dibujadas por el usuario sobre el mapa con los extremos marcados (mapa_puntos_uniones.png, 21-11-2026): cada camino sigue los puntos de su dibujo;
# entre puntos va por el corredor más suave aunque cruce bancos (se excava a su cota, como las rampas); cota siguiendo el terreno, suavizada y ≤ 12 %
MARCAS_TRAZO = [
    [(-1166.7, -108.4), (-1140.0, 10.0), (-1112.0, 75.0), (-1085.0, 92.0), (-1058.0, 70.0), (-1045.0, 15.0), (-1034.2, -44.4), 'directo'],      # curva en U del 70 al 69 (por el sur): sigue el dibujo tal cual y corta los montículos
    [(-779.4, -472.6), (-700.0, -560.0), (-640.0, -615.0), (-532.6, -719.4)],      # 41 con 51
    [(-436.6, -524.0), (-550.0, -400.0), (-635.4, -280.6)],      # 44 con 34
    [(-114.0, -488.0), (50.0, -430.0), (228.6, -388.6)],      # 31 baja a la 42 (a su curva)
    [(100.6, -504.0), (114.3, -515.4)],      # 31 con la 48 (sus extremos quedaban a 18 m)
    [(-456.0, -380.0), (-448.0, -392.0), (-408.0, -428.0), (-368.0, -456.0), (-328.0, -468.0), (-288.0, -488.0), (-248.0, -496.0), (-208.0, -492.0), (-168.0, -472.0), (-132.0, -484.0), 'directo'],      # franja plana del plano sin camino (botón «Punto» del usuario, x −410, z −430): rampa de 1337 a 1310 que empalma al oriente
]
def trazos():
    from scipy.sparse.csgraph import dijkstra as dj
    G = grafo_empalme(3.0, 15.0); Gc = None; out = []
    for wps in MARCAS_TRAZO:
        cortar = wps[-1] == 'cortar'; directo = wps[-1] == 'directo'; wps = [w for w in wps if w not in ('cortar', 'directo')]; cel = []
        if cortar and Gc is None: Gc = grafo_empalme(3.0, 2.0)
        if directo:      # curva suave (Catmull-Rom) por los puntos del dibujo, muestreada cada 4 m
            W_ = np.array(wps, float); Wp = np.vstack([2 * W_[0] - W_[1], W_, 2 * W_[-1] - W_[-2]]); seq = []
            for i in range(1, len(Wp) - 2):
                p0, p1_, p2_, p3 = Wp[i - 1], Wp[i], Wp[i + 1], Wp[i + 2]; nn = max(2, int(np.hypot(*(p2_ - p1_)) / 4))
                for t in np.linspace(0, 1, nn, endpoint=False): seq.append(0.5 * ((2 * p1_) + (-p0 + p2_) * t + (2 * p0 - 5 * p1_ + 4 * p2_ - p3) * t * t + (-p0 + 3 * p1_ - 3 * p2_ + p3) * t ** 3))
            seq.append(W_[-1]); cel = [celda(x + EC, NC - z) for x, z in seq]; cel = [c for k, c in enumerate(cel) if k == 0 or c != cel[k - 1]]
        for (ax, az), (bx, bz) in (zip(wps[:-1], wps[1:]) if not directo else []):
            a0, b0 = celda(ax + EC, NC - az), celda(bx + EC, NC - bz)
            d1, p1 = dj(Gc if cortar else G, indices=a0, return_predecessors=True, limit=8000)
            leg = []; k = b0
            while k >= 0 and k != a0: leg.append(int(k)); k = p1[k]
            leg.append(a0); leg.reverse(); cel += leg if not cel else leg[1:]
        pts = np.array([(E0 + (k % nx) * CELL, N0 + (k // nx) * CELL) for k in cel], float)
        Ps = np.column_stack([uniform_filter1d(pts[:, 0], 7, mode="nearest"), uniform_filter1d(pts[:, 1], 7, mode="nearest")]) if len(pts) > 8 else pts.copy(); Ps[0] = pts[0]; Ps[-1] = pts[-1]
        Sg = [list(g(x, y)) for x, y in (simplifica(Ps, 1.5) if len(Ps) > 2 else Ps)]
        c_ = cota_camino(Sg)
        def cota_red(x, z):      # cota del camino ya trazado más cercano a (x, z), si hay uno a < 30 m
            bb = (30.0, None)
            for c in caminos:
                for (a1, b1) in zip(c[:-1], c[1:]):
                    A1 = np.array(a1, float); B1 = np.array(b1, float); v = B1[:2] - A1[:2]; t = float(np.clip(np.dot(np.array([x, z]) - A1[:2], v) / (np.dot(v, v) or 1), 0, 1)); q = A1 + (B1 - A1) * t
                    dq = float(np.hypot(q[0] - x, q[1] - z))
                    if dq < bb[0]: bb = (dq, float(q[2]))
            return bb[1]
        y_a, y_b = cota_red(*c_[0][:2]), cota_red(*c_[-1][:2])      # empalme a la misma cota que el camino al que llega (sin escalón)
        dsv = np.concatenate([[0], np.cumsum([np.hypot(c_[k][0] - c_[k - 1][0], c_[k][1] - c_[k - 1][1]) for k in range(1, len(c_))])]); Lc_ = dsv[-1] or 1
        da = (y_a - c_[0][2]) if y_a is not None else 0.0; db = (y_b - c_[-1][2]) if y_b is not None else 0.0
        zs = np.array([p_[2] for p_ in c_]) + da * (1 - dsv / Lc_) + db * (dsv / Lc_); ds_ = np.maximum(np.diff(dsv), 0.1)
        def red_cerca(x, z, R0):      # cota del camino existente más cercano a < R0 m (las calzadas de 38 m se pisarían: comparten cota)
            bb = (R0, None)
            for c in caminos:
                for (a1, b1) in zip(c[:-1], c[1:]):
                    A1 = np.array(a1, float); B1 = np.array(b1, float); v = B1[:2] - A1[:2]; t = float(np.clip(np.dot(np.array([x, z]) - A1[:2], v) / (np.dot(v, v) or 1), 0, 1)); q = A1 + (B1 - A1) * t
                    dq = float(np.hypot(q[0] - x, q[1] - z))
                    if dq < bb[0]: bb = (dq, float(q[2]))
            return bb[1]
        fija = [red_cerca(p_[0], p_[1], 40.0) for p_ in c_]
        fija = [f if (f is not None and abs(f - z0) <= 6.0) else None for f, z0 in zip(fija, zs)]      # solo si el otro camino va a una cota parecida (si no, está en otro banco)
        for k in range(len(zs)):
            if fija[k] is not None: zs[k] = fija[k]
        if y_a is not None: zs[0] = y_a
        if y_b is not None: zs[-1] = y_b
        cum_ = np.concatenate([[0], np.cumsum(ds_)])
        for k in range(1, len(zs) - 1):      # límite de 12 % con los extremos fijos: cada punto queda dentro del cono que permiten ambos extremos (las cotas compartidas son una guía)
            lo = max(zs[0] - 0.12 * cum_[k], zs[-1] - 0.12 * (cum_[-1] - cum_[k])); hi = min(zs[0] + 0.12 * cum_[k], zs[-1] + 0.12 * (cum_[-1] - cum_[k]))
            if lo <= hi: zs[k] = min(hi, max(lo, zs[k]))
        for it in range(30):
            for k in range(1, len(zs) - 1): zs[k] = min(zs[k - 1] + 0.12 * ds_[k - 1], max(zs[k - 1] - 0.12 * ds_[k - 1], zs[k]))
            for k in range(len(zs) - 2, 0, -1): zs[k] = min(zs[k + 1] + 0.12 * ds_[k], max(zs[k + 1] - 0.12 * ds_[k], zs[k]))
        if y_a is not None: zs[0] = y_a
        if y_b is not None: zs[-1] = y_b
        sg_ = 1.0 if zs[-1] >= zs[0] else -1.0; w_ = np.gradient(cum_) + 0.1; zs = sg_ * monotona(sg_ * zs, w_); zs[0] = y_a if y_a is not None else zs[0]; zs[-1] = y_b if y_b is not None else zs[-1]      # sin sube y baja
        zs = np.clip(zs, min(zs[0], zs[-1]), max(zs[0], zs[-1]))
        for _ in range(2):
            K = np.exp(-0.5 * ((cum_[:, None] - cum_[None, :]) / 40.0) ** 2) * w_[None, :]; zz = (K @ zs) / K.sum(1); zz[0], zz[-1] = zs[0], zs[-1]; zs = zz
        c_ = [[p_[0], p_[1], round(float(y), 1)] for p_, y in zip(c_, zs)]; out.append(c_)
        Lt = float(np.hypot(*np.diff(pts, axis=0).T).sum()); print("trazo", wps[0], "->", wps[-1], ":", round(Lt), "m, cotas", c_[0][2], "->", c_[-1][2], "(%.1f %%)" % (abs(c_[-1][2] - c_[0][2]) / max(Lt, 1) * 100))
    return out
caminos += trazos()
# --- canchas: centro de la malla de pozos = celda del piso más cercana a la ruta con ≥ 24 m de piso alrededor
for q in pisos:
    if not q.get("cancha"): continue
    m = lab == [kk for kk in range(1, n + 1) if abs(float(Z[lab == kk].mean() - YC) - q["y"]) < 0.05 and int((lab == kk).sum() * CELL * CELL) == q["area"]][0]
    ii, jj = np.where(m); E = jj * CELL + E0; Nn = ii * CELL + N0; dt = distance_transform_edt(m) * CELL
    roadm = np.zeros(ny * nx, bool); roadm[en_red] = True; droad = distance_transform_edt(~roadm.reshape(ny, nx)) * CELL      # distancia a la ruta y a los caminos interiores
    cand = np.where(dt[m] >= (8 if q.get("marca") else 20))[0]
    c = cand[np.argmax(droad[m][cand])] if len(cand) else int(np.argmax(dt[m]))      # el sector del banco más alejado de los caminos (la perforadora no trabaja junto a un camino)
    q["cerca"] = list(g(E[c], Nn[c]))
    print("cancha", round(q["cx"]), round(q["cz"]), "→ malla en", q["cerca"], "a", int(droad[m][c]), "m del camino más cercano")
# --- empalmes de todos los caminos: cada extremo que cae sobre otro camino (a < 25 m) toma su cota; la diferencia se reparte a lo largo del tramo (≤ 12 %)
def cota_en(c, x, z):
    bb = (1e9, None)
    for a1, b1 in zip(c[:-1], c[1:]):
        A1 = np.array(a1, float); B1 = np.array(b1, float); v = B1[:2] - A1[:2]; t = float(np.clip(np.dot(np.array([x, z]) - A1[:2], v) / (np.dot(v, v) or 1), 0, 1)); q = A1 + (B1 - A1) * t; dq = float(np.hypot(q[0] - x, q[1] - z))
        if dq < bb[0]: bb = (dq, float(q[2]))
    return bb
ajustes = 0
for i, c in enumerate(caminos):
    if len(c) < 2: continue
    zs = np.array([p_[2] for p_ in c], float); d_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(np.array([p_[:2] for p_ in c], float), axis=0).T))]); Lc = d_[-1] or 1
    fin = []
    for e in (0, -1):
        best = (25.0, None)
        for o in caminos[:i]:      # se empalma con los caminos anteriores (ya ajustados)
            dq, yq = cota_en(o, c[e][0], c[e][1])
            if dq < best[0]: best = (dq, yq)
        fin.append(best[1])
    da = (fin[0] - zs[0]) if fin[0] is not None else 0.0; db = (fin[1] - zs[-1]) if fin[1] is not None else 0.0
    if abs(da) < 0.3 and abs(db) < 0.3: continue
    zs = zs + da * (1 - d_ / Lc) + db * (d_ / Lc)
    for k in range(1, len(zs) - 1):
        lo = max(zs[0] - 0.12 * d_[k], zs[-1] - 0.12 * (Lc - d_[k])); hi = min(zs[0] + 0.12 * d_[k], zs[-1] + 0.12 * (Lc - d_[k]))
        if lo <= hi: zs[k] = min(hi, max(lo, zs[k]))
    caminos[i] = [[p_[0], p_[1], round(float(y), 1)] for p_, y in zip(c, zs)]; ajustes += 1
print("empalmes ajustados:", ajustes)
with open(JS + r"\terreno_dwg.js", "w", encoding="utf8") as f:
    f.write("// Mundo real del rajo Catabela, exportado del plano GEO-SG-716 por pruebas/plano/exporta_dwg.py (no editar a mano).\n")
    f.write(f"// Coordenadas del juego: x = E − {EC:.0f}, z = {NC:.0f} − N (z = sur), y = cota − {YC:.0f}. La grilla de alturas está en terreno_dwg.bin (Uint16, decímetros sobre 1000 m, filas de norte a sur).\n")
    f.write(f"export const DWG = {{ EC: {EC}, NC: {NC}, YC: {YC}, CELL: {CELL}, GX0: {GX0}, GZ0: {GZ0}, GNX: {nx}, GNZ: {ny}, ZMIN: {round(float(Z.min() - YC), 1)}, ZMAX: {round(float(Z.max() - YC), 1)} }};\n")
    f.write("export const ROUTE_DWG = " + json.dumps(route, separators=(",", ":")) + ";      // ruta [x, z, y] desde el piso de la fase 7 (pared este) hasta la superficie\n")
    f.write("export const F7_DWG = { poly: " + json.dumps(f7poly, separators=(",", ":")) + f", plano: [{coef[0]:.6f}, {coef[1]:.6f}, {coef[2]:.3f}] }};      // piso de la fase 7: polígono y plano y = a·x + b·z + c\n")
    f.write("export const ZONAS_DWG = " + json.dumps(zonas, separators=(",", ":"), ensure_ascii=False) + ";      // zonas de riesgo geotécnico (polígonos)\n")
    f.write("export const CUNAS_DWG = " + json.dumps(cunas, separators=(",", ":"), ensure_ascii=False) + ";      // cuñas\n")
    f.write("export const PRETILES_DWG = " + json.dumps(pretiles, separators=(",", ":")) + ";      // pretiles de contención (líneas)\n")
    f.write("export const RADARES_DWG = " + json.dumps(radares, separators=(",", ":"), ensure_ascii=False) + ";\n")
    f.write("export const ESTACIONES_DWG = " + json.dumps(estaciones, separators=(",", ":"), ensure_ascii=False) + ";\n")
    f.write("export const PISOS_DWG = " + json.dumps(pisos, separators=(",", ":"), ensure_ascii=False) + ";      // pisos planos del rajo: centro, cota, área, eje largo, polígono y frentes de carguío (punto y dirección hacia la pared); f7 = piso de la partida, fondo = el más hondo, cancha = canchas de perforación\n")
    f.write("export const CAMINOS_DWG = " + json.dumps(caminos, separators=(",", ":")) + ";      // caminos interiores [[x, z, y]…] (todas las rampas del rajo, calculadas sobre el terreno) con su cota de calzada\n")
    f.write("export const SEM6_DWG = " + json.dumps(sem6) + ";      // SEM 6: explanada junto a la rampa a media subida (rot: mirando a la rampa); null = en el borde del rajo\n")
    f.write("export const GEO_ZONES_DWG = " + json.dumps(geo) + ";      // tramos de la ruta [s0, s1] (m) a menos de 70 m de una zona de riesgo o cuña\n")
print("js ok; ruta", len(route), "puntos, largo", round(float(s[-1])), "m; grilla", nx, "x", ny, "GX0", GX0, "GZ0", GZ0)

fig, ax = plt.subplots(figsize=(14, 12)); e0, e1, n0, n1 = 165650, 166450, 4470950, 4471750
from matplotlib.colors import LightSource
ls = LightSource(azdeg=315, altdeg=45); rgb = ls.shade(Z, cmap=plt.cm.gist_earth, vert_exag=1.5, blend_mode="overlay", dx=CELL, dy=CELL)
ax.imshow(rgb, extent=(E0, E0 + (nx - 1) * CELL, N0, N0 + (ny - 1) * CELL), origin="lower")
ax.contour(np.arange(nx) * CELL + E0, np.arange(ny) * CELL + N0, Z, levels=np.arange(1200, 1500, 4), colors="k", linewidths=0.2)
ax.imshow(np.ma.masked_where(~piso, piso), extent=(E0, E0 + (nx - 1) * CELL, N0, N0 + (ny - 1) * CELL), origin="lower", cmap="cool", alpha=0.5)
ax.imshow(np.ma.masked_where(~flat, flat), extent=(E0, E0 + (nx - 1) * CELL, N0, N0 + (ny - 1) * CELL), origin="lower", cmap="Wistia", alpha=0.25)
ax.plot(P[:, 0], P[:, 1], color="red", lw=1.5); ax.plot(ruta["ini"][0], ruta["ini"][1], "ro", ms=8)
for k in range(0, len(P), 25): ax.annotate(str(int(s[k])), (P[k, 0], P[k, 1]), fontsize=7, color="white")
ax.plot(poly[:, 0], poly[:, 1], color="cyan", lw=2)
ax.set_xlim(e0, e1); ax.set_ylim(n0, n1); ax.set_aspect("equal"); ax.set_title("Partida: piso de la fase 7 (celeste = piso elegido, amarillo = celdas planas), ruta en rojo")
fig.savefig(OUT + r"\partida_dwg.png", dpi=100); print("partida_dwg.png ok")
