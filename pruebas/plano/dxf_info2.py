# Segundo inventario: tabla completa de capas (color), layouts de papel y sus entidades/textos, bloques definidos, extensión y cotas por capa, hatches (patrón y color), polilíneas (vértices y rango z).
import sys, collections, re
import ezdxf
doc = ezdxf.readfile(sys.argv[1])
print("== TABLA DE CAPAS (nombre: color, on/off, frozen)")
for ly in doc.layers:
    print(f"  {ly.dxf.name:45s} color {ly.dxf.color:4d}  off={ly.is_off()} frozen={ly.is_frozen()}")
print("\n== BLOQUES definidos (no anónimos):", [b.name for b in doc.blocks if not b.name.startswith("*")][:40])
print("\n== LAYOUTS:", [l.name for l in doc.layouts])
for l in doc.layouts:
    if l.name == "Model": continue
    cnt = collections.Counter(e.dxftype() for e in l); print(f"-- layout {l.name}: {dict(cnt)}")
    for e in l:
        if e.dxftype() in ("TEXT", "MTEXT"):
            s = e.dxf.text if e.dxftype() == "TEXT" else e.text; s = re.sub(r"\\[A-Za-z][^;]*;|[{}]|\\P", " ", s).strip()
            if s: print("     texto:", repr(s[:160]))
        elif e.dxftype() == "INSERT": print("     insert:", e.dxf.name, e.dxf.layer)
print("\n== POR CAPA (modelo): extensión x, y, z y vértices")
msp = doc.modelspace()
ext = collections.defaultdict(lambda: [1e18, -1e18, 1e18, -1e18, 1e18, -1e18, 0, 0])
hatch = collections.defaultdict(collections.Counter)
for e in msp:
    cap = e.dxf.layer; t = e.dxftype(); a = ext[cap]; a[7] += 1
    pts = []
    if t == "POLYLINE": pts = [(v.dxf.location.x, v.dxf.location.y, v.dxf.location.z) for v in e.vertices]
    elif t == "LWPOLYLINE": z = e.dxf.elevation; pts = [(p[0], p[1], z) for p in e.get_points()]
    elif t == "LINE": pts = [(e.dxf.start.x, e.dxf.start.y, e.dxf.start.z), (e.dxf.end.x, e.dxf.end.y, e.dxf.end.z)]
    elif t == "HATCH":
        hatch[cap][(e.dxf.pattern_name, e.dxf.color, e.dxf.solid_fill)] += 1
        for path in e.paths:
            if hasattr(path, "vertices"): pts += [(p[0], p[1], 0) for p in path.vertices]
            else:
                for ed in path.edges:
                    if ed.type == "LineEdge": pts += [(ed.start[0], ed.start[1], 0), (ed.end[0], ed.end[1], 0)]
    for x, y, z in pts:
        a[0] = min(a[0], x); a[1] = max(a[1], x); a[2] = min(a[2], y); a[3] = max(a[3], y); a[4] = min(a[4], z); a[5] = max(a[5], z); a[6] += 1
for cap, a in ext.items():
    print(f"  {cap:40s} n={a[7]:5d} vért={a[6]:7d}  x {a[0]:.0f}..{a[1]:.0f}  y {a[2]:.0f}..{a[3]:.0f}  z {a[4]:.1f}..{a[5]:.1f}")
print("\n== HATCH por capa (patrón, color, sólido): cantidad")
for cap in hatch:
    for k, c in hatch[cap].most_common(): print(f"  {cap:40s} {k} {c}")
print("\n== POLILÍNEAS de las capas chicas (capa, tipo, color, nvért, cerrada, z)")
for e in msp:
    if e.dxf.layer in ("Pretiles Seguridad y zonas", "Pretiles Seguridad", "Cuñas_actualizadas_170520", "C_A_CAMIONADAS_A_PISO", "GRILLA") and e.dxftype() in ("POLYLINE", "LWPOLYLINE"):
        if e.dxftype() == "POLYLINE": pts = [(v.dxf.location.x, v.dxf.location.y, v.dxf.location.z) for v in e.vertices]; closed = e.is_closed
        else: pts = [(p[0], p[1], e.dxf.elevation) for p in e.get_points()]; closed = e.closed
        if e.dxf.layer == "C_A_CAMIONADAS_A_PISO" and len(pts) > 0 and hash(id(e)) % 7: continue
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; zs = [p[2] for p in pts]
        print(f"  {e.dxf.layer[:28]:28s} {e.dxftype():10s} col {e.dxf.color:3d} n={len(pts):4d} cerrada={closed} x {min(xs):.0f}..{max(xs):.0f} y {min(ys):.0f}..{max(ys):.0f} z {min(zs):.0f}..{max(zs):.0f}")
