# Dibuja el modelo del DXF en planta, una imagen por capa y una general: plano_dxf_<capa>.png y plano_dxf_todo.png
import sys, collections, re
import ezdxf
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
OUT = r"c:\Users\Usuario\Documents\juegos\rajo-kart\plano\derivados"
doc = ezdxf.readfile(sys.argv[1]); msp = doc.modelspace()
COL = { "26-11-15_CAMINOS_LEVANTADOS": "#444", "26-11-15_BORDE": "#b06030", "26-11-15_PATA": "#d8a070", "C_A_CAMIONADAS_A_PISO": "#2060c0",
        "GRILLA": "#999", "Pretiles Seguridad y zonas": "#e01010", "Pretiles Seguridad": "#10a020", "Cuñas_actualizadas_170520": "#c010c0" }
lines = collections.defaultdict(list); hatches = collections.defaultdict(list); texts = []
for e in msp:
    cap = e.dxf.layer; t = e.dxftype()
    if t == "POLYLINE": lines[cap].append([(v.dxf.location.x, v.dxf.location.y) for v in e.vertices])
    elif t == "LWPOLYLINE": lines[cap].append([(p[0], p[1]) for p in e.get_points()])
    elif t == "LINE": lines[cap].append([(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)])
    elif t == "HATCH":
        for path in e.paths:
            if hasattr(path, "vertices"): hatches[cap].append([(p[0], p[1]) for p in path.vertices])
            else:
                pts = []
                for ed in path.edges:
                    if ed.type == "LineEdge": pts += [(ed.start[0], ed.start[1]), (ed.end[0], ed.end[1])]
                if pts: hatches[cap].append(pts)
    elif t == "TEXT": texts.append((e.dxf.text, e.dxf.insert.x, e.dxf.insert.y))
# recorte al rajo: extensión de BORDE
x0, x1, y0, y1 = 163950, 166550, 4469950, 4472500      # la grilla del plano (rajo Catabela)
print("recorte", round(x0), round(x1), round(y0), round(y1))
def fig(caps, nombre, lw=0.3):
    f, ax = plt.subplots(figsize=(14, 14 * (y1 - y0) / (x1 - x0)))
    for cap in caps:
        for l in lines.get(cap, []): ax.plot([p[0] for p in l], [p[1] for p in l], color=COL.get(cap, "#000"), lw=lw)
        for h in hatches.get(cap, []): ax.fill([p[0] for p in h], [p[1] for p in h], color=COL.get(cap, "#000"), alpha=0.35, lw=0)
    ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect("equal"); ax.set_title(nombre); ax.grid(True, lw=0.2)
    f.savefig(OUT + "\\plano_dxf_" + re.sub(r"[^A-Za-z0-9]+", "_", nombre) + ".png", dpi=110); plt.close(f)
fig(list(COL), "todo")
fig(["26-11-15_BORDE", "26-11-15_PATA", "26-11-15_CAMINOS_LEVANTADOS"], "topografia")
fig(["26-11-15_BORDE", "26-11-15_CAMINOS_LEVANTADOS", "Pretiles Seguridad y zonas", "Pretiles Seguridad", "Cuñas_actualizadas_170520"], "zonas y pretiles")
fig(["26-11-15_BORDE", "26-11-15_CAMINOS_LEVANTADOS", "C_A_CAMIONADAS_A_PISO"], "camionadas a piso")
print("ok")
