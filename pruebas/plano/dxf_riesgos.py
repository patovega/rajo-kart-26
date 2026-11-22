# Mapa de riesgos geotécnicos: capas del modelo (zonas, cuñas, pretiles de contención, caminos y borde) + del papel (círculos numerados, etiquetas de radares y estaciones).
# Guarda plano_riesgos.png y riesgos.json (polígonos de zonas, cuñas, pretiles, radares) en coordenadas UTM.
import sys, json, re, collections
import ezdxf
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from ezdxf.colors import aci2rgb
OUT = r"c:\Users\Usuario\Documents\juegos\rajo-kart\plano\derivados"
doc = ezdxf.readfile(sys.argv[1]); msp = doc.modelspace()
x0, x1, y0, y1 = 164300, 166600, 4470300, 4472400
def rgb(c): c = c if 0 < c < 256 else 7; return tuple(v / 255 for v in aci2rgb(c))
res = {"zonas": [], "cunas": [], "pretiles": [], "hatch_zonas": [], "caminos": [], "borde": []}
f, ax = plt.subplots(figsize=(18, 18 * (y1 - y0) / (x1 - x0)))
def pts_of(e):
    if e.dxftype() == "POLYLINE": return [(v.dxf.location.x, v.dxf.location.y, v.dxf.location.z) for v in e.vertices]
    if e.dxftype() == "LWPOLYLINE": return [(p[0], p[1], e.dxf.elevation) for p in e.get_points()]
    return []
def hatch_paths(e):
    out = []
    for path in e.paths:
        if hasattr(path, "vertices"): out.append([(p[0], p[1]) for p in path.vertices])
        else:
            pts = []
            for ed in path.edges:
                if ed.type == "LineEdge": pts += [(ed.start[0], ed.start[1]), (ed.end[0], ed.end[1])]
                elif ed.type == "SplineEdge": pts += [(p[0], p[1]) for p in ed.control_points]
            if pts: out.append(pts)
    return out
for e in msp:
    cap = e.dxf.layer; t = e.dxftype()
    if t == "POLYLINE" and cap in ("26-11-15_CAMINOS_LEVANTADOS", "26-11-15_BORDE"):
        pts = pts_of(e)
        if pts and x0 - 100 < pts[0][0] < x1 + 100 and y0 - 100 < pts[0][1] < y1 + 100:
            ax.plot([p[0] for p in pts], [p[1] for p in pts], color="#444" if "CAMINOS" in cap else "#c09070", lw=0.6 if "CAMINOS" in cap else 0.25)
            res["caminos" if "CAMINOS" in cap else "borde"].append([(round(p[0], 1), round(p[1], 1), round(p[2], 1)) for p in pts])
    elif cap == "Pretiles Seguridad y zonas":
        if t in ("LWPOLYLINE", "POLYLINE"):
            pts = pts_of(e); cerr = e.closed if t == "LWPOLYLINE" else e.is_closed
            ax.plot([p[0] for p in pts] + ([pts[0][0]] if cerr else []), [p[1] for p in pts] + ([pts[0][1]] if cerr else []), color="red" if cerr else "orange", lw=1.6 if cerr else 1.0)
            res["zonas" if cerr else "pretiles"].append({"color": e.dxf.color, "z": round(pts[0][2]), "pts": [(round(p[0], 1), round(p[1], 1)) for p in pts]})
        elif t == "HATCH":
            for pp in hatch_paths(e):
                ax.fill([p[0] for p in pp], [p[1] for p in pp], color=rgb(e.dxf.color), alpha=0.3, lw=0)
                res["hatch_zonas"].append({"patron": e.dxf.pattern_name, "color": e.dxf.color, "pts": [(round(p[0], 1), round(p[1], 1)) for p in pp]})
    elif cap == "Cuñas_actualizadas_170520":
        if t in ("LWPOLYLINE", "POLYLINE"):
            pts = pts_of(e); ax.plot([p[0] for p in pts], [p[1] for p in pts], color="magenta", lw=1.0)
            res["cunas"].append({"tipo": "poli", "color": e.dxf.color, "pts": [(round(p[0], 1), round(p[1], 1)) for p in pts]})
        elif t == "HATCH":
            for pp in hatch_paths(e):
                ax.fill([p[0] for p in pp], [p[1] for p in pp], color="magenta", alpha=0.35, lw=0)
                res["cunas"].append({"tipo": "hatch", "color": e.dxf.color, "pts": [(round(p[0], 1), round(p[1], 1)) for p in pp]})
    elif cap == "Pretiles Seguridad" and t in ("LWPOLYLINE", "POLYLINE"):
        pts = pts_of(e); ax.plot([p[0] for p in pts], [p[1] for p in pts], color="green", lw=1.4)
        res["pretiles"].append({"color": e.dxf.color, "z": round(pts[0][2]), "pts": [(round(p[0], 1), round(p[1], 1)) for p in pts]})
papel = json.load(open(OUT + r"\papel.json", encoding="utf8"))
res["radares"] = []; res["estaciones"] = []; res["numeros"] = []
for r in papel["texto"]:
    s = r[1]
    if re.match(r"RADAR ", s): res["radares"].append({"nombre": s, "x": r[2], "y": r[3]}); ax.plot(r[2], r[3], marker="^", ms=12, color="blue"); ax.annotate(s, (r[2], r[3]), fontsize=9, color="blue", fontweight="bold")
    elif re.match(r"ESTACI", s): res["estaciones"].append({"nombre": s, "x": r[2], "y": r[3]}); ax.plot(r[2], r[3], marker="s", ms=9, color="purple"); ax.annotate(s, (r[2], r[3]), fontsize=8, color="purple")
    elif re.fullmatch(r"[1-4]", s) and x0 < r[2] < x1 and y0 < r[3] < y1: res["numeros"].append({"n": int(s), "x": r[2], "y": r[3]}); ax.annotate(s, (r[2], r[3]), fontsize=11, fontweight="bold", color="black")
for r in papel["circulo"]:
    if x0 < r[1] < x1 and y0 < r[2] < y1: ax.add_patch(plt.Circle((r[1], r[2]), r[3], fill=False, color="black", lw=0.8))
ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect("equal"); ax.grid(True, lw=0.2)
ax.set_title("GEO-SG-716: zonas (rojo), hatch zonas (color plano), cuñas (magenta), pretiles de contención (verde/naranjo), radares (azul), estaciones (morado), tipo de riesgo 1-4")
f.savefig(OUT + r"\plano_riesgos.png", dpi=100)
json.dump(res, open(OUT + r"\riesgos.json", "w", encoding="utf8"))
print({k: len(v) for k, v in res.items()})
