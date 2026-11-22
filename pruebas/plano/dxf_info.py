# Inventario del DXF del plano GEO-SG-716: capas (entidades por tipo), textos, bloques insertados y extensión. Uso: python dxf_info.py archivo.dxf
import sys, collections, re
import ezdxf
from ezdxf.math import BoundingBox
doc = ezdxf.readfile(sys.argv[1])
msp = doc.modelspace()
print("versión", doc.dxfversion, "unidades (INSUNITS)", doc.header.get("$INSUNITS"), "EXTMIN", doc.header.get("$EXTMIN"), "EXTMAX", doc.header.get("$EXTMAX"))
por_capa = collections.defaultdict(collections.Counter)
textos = collections.defaultdict(list)
bloques = collections.Counter()
n = 0
for e in msp:
    n += 1
    cap = e.dxf.layer; por_capa[cap][e.dxftype()] += 1
    t = e.dxftype()
    if t in ("TEXT", "MTEXT"):
        s = e.dxf.text if t == "TEXT" else e.text
        s = re.sub(r"\\[A-Za-z][^;]*;|[{}]", "", s).strip()
        if s: textos[cap].append((s, tuple(round(v, 1) for v in (e.dxf.insert.x, e.dxf.insert.y))))
    elif t == "INSERT":
        bloques[(cap, e.dxf.name)] += 1
print("entidades en modelo:", n, "capas usadas:", len(por_capa))
print("\n== CAPAS (entidades por tipo)")
for cap in sorted(por_capa, key=lambda c: -sum(por_capa[c].values())):
    print(f"{cap:45s} {sum(por_capa[cap].values()):7d}  " + ", ".join(f"{k} {v}" for k, v in por_capa[cap].most_common()))
print("\n== BLOQUES insertados (capa, nombre): cantidad")
for (cap, nm), c in bloques.most_common(60): print(f"  {cap:40s} {nm:40s} {c}")
print("\n== TEXTOS por capa (hasta 25 por capa)")
for cap in sorted(textos):
    print(f"-- {cap} ({len(textos[cap])})")
    for s, p in textos[cap][:25]: print("    ", repr(s[:70]), p)
print("\n== TEXTOS que mencionan radar / riesgo / geot / grieta / falla / zona")
for cap in textos:
    for s, p in textos[cap]:
        if re.search(r"radar|riesgo|geot|grieta|falla|zona|inestab|deform|peligro|alerta", s, re.I): print(f"  [{cap}] {s[:90]!r} {p}")
