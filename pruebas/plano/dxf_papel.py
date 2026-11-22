# El layout PIT_SGSCM (espacio papel) trae las zonas de riesgo, radares, estaciones totales y líneas de exclusión dibujados encima de un viewport.
# Lista los viewports (centro en el modelo, alto de vista, tamaño en papel) y pasa a coordenadas del modelo los inserts, textos, hatches, elipses, círculos y polilíneas del papel.
import sys, re, collections, json, math
import ezdxf
doc = ezdxf.readfile(sys.argv[1])
lay = doc.layouts.get("PIT_SGSCM")
vps = [e for e in lay if e.dxftype() == "VIEWPORT"]
print("== VIEWPORTS")
for v in vps:
    d = v.dxf
    print(f"  id {d.id} centro papel ({d.center.x:.1f},{d.center.y:.1f}) ancho {d.width:.1f} alto {d.height:.1f}  vista: centro modelo ({d.view_center_point.x:.1f},{d.view_center_point.y:.1f}) alto vista {d.view_height:.1f} twist {d.view_twist_angle:.2f}  estado {d.status}  capas congeladas {len(v.frozen_layers)}")
# viewport principal: el de mayor alto de vista (el otro suele ser el de la hoja)
main = max((v for v in vps if v.dxf.id != 1), key=lambda v: v.dxf.view_height)
d = main.dxf; esc = d.view_height / d.height
print(f"viewport principal id {d.id}: escala papel→modelo {esc:.3f}; congeladas: {list(main.frozen_layers)[:20]}")
def a_modelo(px, py):
    return (d.view_target_point.x + d.view_center_point.x + (px - d.center.x) * esc, d.view_target_point.y + d.view_center_point.y + (py - d.center.y) * esc)      # DCS = WCS desplazado al punto objetivo
def limpia(s): return re.sub(r"\\[A-Za-z][^;]*;|[{}]|\\P", " ", s).strip()
salida = collections.defaultdict(list)
for e in lay:
    t = e.dxftype(); cap = e.dxf.layer
    if t == "VIEWPORT": continue
    if t == "INSERT":
        x, y = a_modelo(e.dxf.insert.x, e.dxf.insert.y); salida["insert"].append((cap, e.dxf.name, round(x, 1), round(y, 1), round(e.dxf.rotation, 1), round(e.dxf.xscale, 2)))
    elif t in ("TEXT", "MTEXT"):
        s = limpia(e.dxf.text if t == "TEXT" else e.text); x, y = a_modelo(e.dxf.insert.x, e.dxf.insert.y)
        salida["texto"].append((cap, s[:80], round(x, 1), round(y, 1), round(e.dxf.height if t == "TEXT" else e.dxf.char_height, 2), e.dxf.color))
    elif t == "CIRCLE":
        x, y = a_modelo(e.dxf.center.x, e.dxf.center.y); salida["circulo"].append((cap, round(x, 1), round(y, 1), round(e.dxf.radius * esc, 1), e.dxf.color))
    elif t == "ELLIPSE":
        x, y = a_modelo(e.dxf.center.x, e.dxf.center.y); mj = e.dxf.major_axis
        salida["elipse"].append((cap, round(x, 1), round(y, 1), round(math.hypot(mj.x, mj.y) * esc, 1), round(e.dxf.ratio, 2), round(math.degrees(math.atan2(mj.y, mj.x)), 1), e.dxf.color))
    elif t == "HATCH":
        for path in e.paths:
            pts = []
            if hasattr(path, "vertices"): pts = [a_modelo(p[0], p[1]) for p in path.vertices]
            else:
                for ed in path.edges:
                    if ed.type == "LineEdge": pts += [a_modelo(*ed.start), a_modelo(*ed.end)]
                    elif ed.type == "ArcEdge": pts += [a_modelo(ed.center[0], ed.center[1])]
                    elif ed.type == "EllipseEdge": pts += [a_modelo(ed.center[0], ed.center[1])]
                    elif ed.type == "SplineEdge": pts += [a_modelo(p[0], p[1]) for p in ed.control_points]
            if pts:
                xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                salida["hatch"].append((cap, e.dxf.pattern_name, e.dxf.color, len(pts), round(min(xs)), round(max(xs)), round(min(ys)), round(max(ys)), [(round(p[0], 1), round(p[1], 1)) for p in pts]))
    elif t in ("LWPOLYLINE", "POLYLINE"):
        pts = [a_modelo(p[0], p[1]) for p in e.get_points()] if t == "LWPOLYLINE" else [a_modelo(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        salida["poli"].append((cap, e.dxf.color, e.dxf.linetype, len(pts), round(min(xs)), round(max(xs)), round(min(ys)), round(max(ys)), e.closed if t == "LWPOLYLINE" else e.is_closed, [(round(p[0], 1), round(p[1], 1)) for p in pts]))
    elif t == "LINE":
        a = a_modelo(e.dxf.start.x, e.dxf.start.y); b = a_modelo(e.dxf.end.x, e.dxf.end.y); salida["linea"].append((cap, e.dxf.color, (round(a[0], 1), round(a[1], 1)), (round(b[0], 1), round(b[1], 1))))
    elif t == "OLE2FRAME":
        salida["ole"].append((cap, ))
for k in ("insert", "texto", "circulo", "elipse", "linea"):
    print(f"\n== {k.upper()} ({len(salida[k])})")
    for r in salida[k]: print("  ", r)
print(f"\n== HATCH ({len(salida['hatch'])}) capa, patrón, color, nvért, x0, x1, y0, y1")
for r in salida["hatch"]: print("  ", r[:8])
print(f"\n== POLILÍNEAS ({len(salida['poli'])}) capa, color, tipo de línea, nvért, x0, x1, y0, y1, cerrada")
for r in salida["poli"]: print("  ", r[:9])
print("\nOLE2FRAME:", len(salida["ole"]))
json.dump({k: v for k, v in salida.items()}, open(r"c:\Users\Usuario\Documents\juegos\rajo-kart\plano\derivados\papel.json", "w", encoding="utf8"), ensure_ascii=False)

# Dibujo: topografía del modelo (borde y caminos) + elementos del papel llevados al modelo
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from ezdxf.colors import aci2rgb
msp = doc.modelspace(); x0, x1, y0, y1 = 164300, 166600, 4470300, 4472400
f, ax = plt.subplots(figsize=(16, 16 * (y1 - y0) / (x1 - x0)))
for e in msp:
    if e.dxf.layer in ("26-11-15_BORDE", "26-11-15_CAMINOS_LEVANTADOS") and e.dxftype() == "POLYLINE":
        pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
        if pts and x0 - 200 < pts[0][0] < x1 + 200 and y0 - 200 < pts[0][1] < y1 + 200:
            ax.plot([p[0] for p in pts], [p[1] for p in pts], color="#b08060" if "BORDE" in e.dxf.layer else "#555", lw=0.25)
def rgb(c): c = c if 0 < c < 256 else 7; return tuple(v / 255 for v in aci2rgb(c))
for r in salida["hatch"]:
    pts = r[8]
    if len(pts) > 2: ax.fill([p[0] for p in pts], [p[1] for p in pts], color=rgb(r[2]), alpha=0.45, lw=0)
for r in salida["poli"]:
    pts = r[9]; ax.plot([p[0] for p in pts], [p[1] for p in pts], color=rgb(r[1]), lw=0.8, ls="--" if "DASH" in str(r[2]).upper() else "-")
for r in salida["linea"]: ax.plot([r[2][0], r[3][0]], [r[2][1], r[3][1]], color=rgb(r[1]), lw=0.8)
for r in salida["circulo"]: ax.add_patch(plt.Circle((r[1], r[2]), r[3], fill=False, color=rgb(r[4]), lw=0.6))
import matplotlib.patches as mp
for r in salida["elipse"]: ax.add_patch(mp.Ellipse((r[1], r[2]), 2 * r[3], 2 * r[3] * r[4], angle=r[5], fill=False, color=rgb(r[6]), lw=0.6))
for r in salida["insert"]:
    ax.plot(r[2], r[3], marker="^" if "SSR" in r[1] else "s", ms=9, color="red" if "SSR" in r[1] else "blue"); ax.annotate(r[1][:7], (r[2], r[3]), fontsize=7)
for r in salida["texto"]:
    if x0 < r[2] < x1 and y0 < r[3] < y1: ax.annotate(r[1][:28], (r[2], r[3]), fontsize=6 if len(r[1]) > 2 else 9, color="k", fontweight="bold" if len(r[1]) <= 2 else "normal")
ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect("equal"); ax.grid(True, lw=0.2)
f.savefig(r"c:\Users\Usuario\Documents\juegos\rajo-kart\plano\derivados\plano_papel.png", dpi=100); print("dibujo ok")
