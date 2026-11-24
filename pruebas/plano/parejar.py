# Empareja los perfiles de los caminos interiores (pedido del usuario, 24-11-2026: «revisa todos los caminos y ve que estén parejos»).
# 1) Donde un camino corre a < D m de otro (o de la ruta), su calzada se pisa con la del otro: toma la cota del otro (se ajusta el más corto; la ruta y los trazos
#    a mano no se tocan). 2) Entre esos puntos fijos y sus extremos, la pendiente se limita a G (envolventes desde cada punto fijo), así no quedan escalones ni lomos.
import numpy as np

def _largo(A):
    return float(np.hypot(*np.diff(A[:, :2], axis=0).T).sum()) if len(A) > 1 else 0.0

def _densificar(A, paso=8.0):
    out = [A[0]]
    for k in range(len(A) - 1):
        a, b = A[k], A[k + 1]; m = max(1, int(np.ceil(np.hypot(*(b[:2] - a[:2])) / paso)))
        for q in range(1, m + 1): out.append(a + (b - a) * q / m)
    return np.array(out)

def _proy(P, A):      # distancia de cada punto P (n, 2) al eje A (m, 3) y cota del eje en la proyección
    best = np.full(len(P), 1e9); yb = np.zeros(len(P))
    for k in range(len(A) - 1):
        a, b = A[k, :2], A[k + 1, :2]; v = b - a; L2 = max(float(v @ v), 1e-9)
        t = np.clip(((P[:, 0] - a[0]) * v[0] + (P[:, 1] - a[1]) * v[1]) / L2, 0, 1); d = np.hypot(P[:, 0] - a[0] - v[0] * t, P[:, 1] - a[1] - v[1] * t)
        w = d < best; best[w] = d[w]; yb[w] = (A[k, 2] + (A[k + 1, 2] - A[k, 2]) * t)[w]
    return best, yb

def _limitar(A, fijo, G):      # pendiente ≤ G entre puntos fijos: cada punto libre queda entre las envolventes; si no caben, al medio
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(A[:, :2], axis=0).T))]); idx = np.where(fijo)[0]
    if len(idx) == 0: return A
    y = A[:, 2].copy(); up = np.full(len(A), np.inf); lo = np.full(len(A), -np.inf)
    for j in idx: dd = np.abs(s - s[j]) * G; up = np.minimum(up, y[j] + dd); lo = np.maximum(lo, y[j] - dd)
    ok = lo <= up; y2 = np.where(ok, np.clip(y, lo, up), (lo + up) / 2); y2[fijo] = y[fijo]
    for a, b in zip(idx[:-1], idx[1:]):      # dos puntos fijos que no se alcanzan al G %: entre ellos, línea recta (sin escalón)
        if b > a + 1 and abs(y[b] - y[a]) > G * (s[b] - s[a]): y2[a:b + 1] = y[a] + (y[b] - y[a]) * (s[a:b + 1] - s[a]) / max(s[b] - s[a], 1e-6)
    B = A.copy(); B[:, 2] = y2; return B

def parejar(caminos, fijos, ruta, D=32.0, G=0.12, minimo=2.0, DF=14.0):
    """caminos: lista de [[x, z, y]…] (se modifica en su lugar); fijos: índices que no se tocan (trazos a mano); ruta: [[x, z, y]…] (nunca se toca)."""
    Rx = np.array(ruta, float); t0 = Rx[-1, :2] - Rx[-2, :2]; t0 /= np.hypot(*t0); Rx = np.vstack([Rx, [Rx[-1, 0] + t0[0] * 205, Rx[-1, 1] + t0[1] * 205, Rx[-1, 2]]])
    cortar_duplicados(caminos, fijos, D, ruta=Rx)
    A = [np.array(c, float) for c in caminos]; R = np.array(ruta, float); n = len(A); Ls = [_largo(a) for a in A]
    t_ = R[-1, :2] - R[-2, :2]; t_ /= np.hypot(*t_); R = np.vstack([R, [R[-1, 0] + t_[0] * 205, R[-1, 1] + t_[1] * 205, R[-1, 2]]])      # tras el portal la ruta sigue 205 m recta y plana hasta el domo (ruta.js, POST)
    tocados = set(); ancla = {}
    for it in range(2):
        for q in range(n):
            if q in fijos or len(A[q]) < 2: continue
            refs = [R] + [A[r] for r in range(n) if r != q and (r in fijos or Ls[r] > Ls[q] or (Ls[r] == Ls[q] and r < q)) and len(A[r]) > 1]
            P = _densificar(A[q]) if q not in tocados else A[q]
            fijo = np.zeros(len(P), bool); fijo[0] = fijo[-1] = True; y = P[:, 2].copy(); cambio = False
            for Rf in refs:
                d, yr = _proy(P[:, :2], Rf); m = (d < D) & (np.abs(yr - y) > 0.3)      # a < DF los carriles se pisan: misma cota (fijo); entre DF y D se mezcla de a poco
                m = (d < DF) & (np.abs(yr - y) > 0.3)      # solo donde los carriles se pisan: misma cota (punto fijo); el resto lo ajusta el límite de pendiente
                if m.any(): y[m] = yr[m]; cambio = True
                fijo |= d < DF
            P = P.copy(); P[:, 2] = y
            if cambio or q not in tocados:
                B = _limitar(P, fijo, G)
                if cambio or np.abs(B[:, 2] - A[q][:, 2] if len(B) == len(A[q]) else 1).max() > 0.3: A[q] = B; tocados.add(q)
    k = 0
    for q in sorted(tocados):
        if len(caminos[q]) < 2: continue
        c = [[round(float(p[0]), 1), round(float(p[1]), 1), round(float(p[2]), 1)] for p in A[q]]
        if max(abs(a[2] - b[2]) for a, b in zip(c, _remuestreo(caminos[q], A[q]))) > minimo: k += 1
        caminos[q][:] = c
    return k

def cortar_duplicados(caminos, fijos, D=32.0, DY=4.0, LMIN=30.0, LQUEDA=60.0, ruta=None):
    """Tramo de un camino automático que corre > LMIN m pegado (< D) a otro más largo con > DY m de diferencia de cota: no caben dos calzadas, se quita ese tramo
    (quedan las partes de ≥ LQUEDA m como caminos aparte, al final de la lista). Devuelve cuántos tramos se quitaron."""
    n0 = len(caminos); Ls = [_largo(np.array(c, float)) for c in caminos]; quitados = 0
    for q in range(n0):
        if q in fijos or len(caminos[q]) < 2: continue
        P = _densificar(np.array(caminos[q], float)); malo = np.zeros(len(P), bool)
        for r in range(n0):
            if r == q or Ls[r] <= Ls[q] or len(caminos[r]) < 2: continue
            d, yr = _proy(P[:, :2], np.array(caminos[r], float)); malo |= (d < D) & (np.abs(yr - P[:, 2]) > DY)
        if ruta is not None: d, yr = _proy(P[:, :2], ruta); malo |= (d < D) & (np.abs(yr - P[:, 2]) > DY)      # también junto a la ruta (con su tramo final hasta el domo)
        if not malo.any(): continue
        s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P[:, :2], axis=0).T))]); quitar = np.zeros(len(P), bool); k = 0
        while k < len(P):
            if not malo[k]: k += 1; continue
            j = k
            while j < len(P) and malo[j]: j += 1
            if s[j - 1] - s[k] > LMIN: quitar[k:j] = True; quitados += 1
            k = j
        if not quitar.any(): continue
        piezas, k = [], 0
        while k < len(P):
            if quitar[k]: k += 1; continue
            j = k
            while j < len(P) and not quitar[j]: j += 1
            if s[j - 1] - s[k] >= LQUEDA: piezas.append([[round(float(p[0]), 1), round(float(p[1]), 1), round(float(p[2]), 1)] for p in P[k:j]])
            k = j
        print("camino", q, "tramo duplicado quitado; quedan", len(piezas), "partes")
        caminos[q][:] = piezas[0] if piezas else []
        caminos.extend(piezas[1:])
      # (los que quedan vacíos los quita el exportador después de parejar: así no se mueven los índices de los trazos a mano)
    return quitados

def _remuestreo(orig, B):      # cotas del camino original en los puntos de B (para contar cuántos cambiaron de verdad)
    O = np.array(orig, float); _, y = _proy(B[:, :2], O); return [[0, 0, v] for v in y]
