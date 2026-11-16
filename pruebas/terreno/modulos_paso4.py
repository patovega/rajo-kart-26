# Paso 4 de la modularización: terreno a js/terreno (ruta, alturas, fases, malla3d, camino) con orquestador construir.js, escena a js/escena.js,
# paso/PASOS a js/comun/pasos.js. Quita el radar (RAD = null desde hace tiempo), F7Z/P3N sin uso. Los pasos corren al cargar cada módulo:
# el orden de los imports de construir.js es el orden de armado.
import re, os
ROOT = r"c:/Users/Usuario/Documents/juegos/rajo-kart"
M = ROOT + "/js/main.js"
L = open(M, encoding="utf8").read().split("\n")
ln = lambda i: L[i - 1]
def chk(i, first): assert ln(i).startswith(first), (i, ln(i)[:80], first)
chk(13, "const PASOS"); chk(14, "function paso"); chk(16, "/* ───────────── Geometría del rajo"); chk(138, "const ZONE_S"); chk(139, "// Radar de monitoreo"); chk(140, "const RAD = null"); chk(141, "const CAEX_LANE"); chk(142, "const RADG")
chk(144, "// Malla de alturas"); chk(390, "  if (RAD) {"); assert ln(409) == "  }" and ln(410) == "});"; chk(411, "function H("); chk(418, "function slopeAt")
chk(420, "/* ───────────── Escena"); chk(442, "window.addEventListener('resize', resize); resize();"); chk(445, "const RAMPS = [];"); chk(487, "const P3N"); chk(488, "const F7Z"); chk(489, "// Camino antiguo")
assert ln(631) == "});"; chk(632, "/* Terreno: rajo con bancos"); chk(633, "paso('terreno: malla 3D"); assert ln(675) == "});"; chk(678, "/* Camino de tierra"); chk(724, "function slickNow() {"); chk(746, "const inGap")
assert ln(854) == "})();"; chk(856, "let radarHead = null;"); chk(857, "(() => { // radar"); assert ln(935) == "})();"; chk(937, "/* ───────────── Vehículos"); chk(1992, "  if (radarHead) radarHead.rotation.y")

R = lambda a, b: list(range(a, b + 1))
RANGOS = {      # en orden de armado
    "pasos": R(13, 14),
    "ruta": R(16, 138) + [141],
    "alturas": R(144, 389) + R(410, 418),
    "escena": R(420, 442),
    "fases": R(445, 486) + R(489, 631),
    "malla3d": R(632, 675),
    "camino": R(678, 854),
}
DEL = set(sum(RANGOS.values(), [])) | {139, 140, 142, 487, 488} | set(R(390, 409)) | set(R(856, 935)) | {1992}
body = lambda rs: "\n".join(ln(i) for i in rs)
def edit(s, old, new, n=1): assert s.count(old) == n, (old[:70], s.count(old)); return s.replace(old, new)

T = {k: body(v) for k, v in RANGOS.items()}
T["camino"] = edit(T["camino"], "function slickNow() { return Math.min(1, wet[binOf(P.s)] * 1.6); }", "function slickNow(s) { return Math.min(1, wet[binOf(s)] * 1.6); }")
T["camino"] = edit(T["camino"], " || (s > RADG.a && s < RADG.b && u * RAD.side > 0);      // sin pretil donde entra la explanada y la bahía del radar", ";      // sin pretil donde entra la explanada")
T["pasos"] = "export " + T["pasos"].replace("\nfunction paso", "\nexport function paso")

# ── main ──
rest = [ln(i) for i in range(1, len(L) + 1) if i not in DEL]
rest_t = "\n".join(rest)
rest_t = edit(rest_t, "slickNow()", "slickNow(P.s)", 2)
for bad in ["RAD", "RADG", "radarHead", "F7Z", "P3N"]: assert not re.search(r"\b" + bad + r"\b", rest_t), bad
rest = rest_t.split("\n")

# ── declaraciones y exportaciones ──
DECL = re.compile(r"^(?:export )?(?:function (\w+)|const (\w+)|let (\w+))")
def top_names(l):      # nombres declarados a nivel 0 en una línea 'const A = ..., B = ...;' (sigue la profundidad de paréntesis, corchetes y llaves)
    m = re.match(r"^(?:export )?(?:const|let) (\w+)", l); out = [m.group(1)]; depth = 0; i = m.end(); q = None
    while i < len(l):
        c = l[i]
        if q:
            if c == q: q = None
            i += 1; continue
        if c in "'\"`": q = c
        elif c in "([{": depth += 1
        elif c in ")]}": depth -= 1
        elif c == ";" and depth == 0: break
        elif c == "/" and l[i:i + 2] == "//" and depth == 0: break
        elif c == "," and depth == 0:
            mm = re.match(r",\s*(\w+)\s*=", l[i:])
            if mm: out.append(mm.group(1))
        i += 1
    return out
def decls(text):
    out = []
    for l in text.split("\n"):
        m = DECL.match(l)
        if not m: continue
        if m.group(1): out.append(m.group(1)); continue
        out.extend(top_names(l))
    return out
def sin_comentarios(t): return re.sub(r"/\*.*?\*/", " ", re.sub(r"(^|\s)//.*$", " ", t, flags=re.M), flags=re.S)
def exports_of(path):
    t = open(ROOT + "/js/" + path, encoding="utf8").read(); m = re.search(r"^export \{ (.*) \};", t, re.M); return [x.strip() for x in m.group(1).split(",")]
E_CONF = ["TAU", "PA", "PB", "YTOP", "BENCH", "WR", "BLEND", "PRET", "LANE", "CRASH_U", "REQ_RANGE", "SPEED_LIMIT", "CRUISE", "VTOP", "FOLLOW_DIST", "PCX", "PCZ", "PR", "FLOOR", "FRAD"]
E_CAMI = ["ROUTE", "F7POLY", "RIMPOLY", "FPOLY", "SEC", "SEM6", "PATIOS"]; E_F7 = ["D52"]
E_MATES = exports_of("comun/mates.js"); E_MATER = exports_of("modelos/materiales.js")
BASE = [("config/diseno.js", E_CONF), ("datos/caminos.js", E_CAMI), ("datos/fase7.js", E_F7), ("comun/mates.js", E_MATES), ("modelos/materiales.js", E_MATER), ("comun/pasos.js", ["PASOS", "paso"])]
PRIV = {"ruta": set(), "alturas": set(), "escena": {"canvas"}, "fases": set(), "malla3d": set(), "camino": {"RSTEP", "WET_T", "ROAD_U", "ROAD_TRACK", "ROAD_NC", "NB", "wet", "wetDirty", "roadNoise", "binOf", "dryC", "wetC", "_rc", "roadMesh", "roadCol", "paintBin"}}
EXP = {}
for k in ["ruta", "alturas", "escena", "fases", "malla3d", "camino"]: EXP[k] = [d for d in decls(T[k]) if d not in PRIV[k]]
alln = sum(EXP.values(), []); dup = {n for n in alln if alln.count(n) > 1}; assert not dup, ("nombres repetidos entre módulos", dup)

ORDEN = ["ruta", "alturas", "escena", "fases", "malla3d", "camino"]      # un módulo solo importa de los anteriores
HEAD = {
    "ruta": "// Ruta y geometría del rajo: muestreo del camino por metro (px, pz, hr), frame(s), cota del rajo según el radio, ubicación de la explanada/portón (PLAT), cota de la fase 7 (f7h) y marcas del recorrido (START_S, ZONE_S).",
    "alturas": "// Malla de alturas del terreno (GH: cota, GD: tipo de celda, GI: punto de ruta más cercano, HB: base de la escalera de bancos) y la membrana que la arma; H(x, z) la lee.",
    "escena": "// Escena de THREE: canvas, renderer, cielo, cámara, luces y ajuste al tamaño de la ventana.",
    "fases": "// Fondo mina y fase 7 sobre la malla de alturas: pisos y pilas, equipos de la fase 7 (F7EQ), camino antiguo, bancos de 16 m con berma, isla celeste–fase 7 (PLAT7) y canchas de perforación (padTerrain). Solo modifica GH/GD; no toca la escena.",
    "malla3d": "// Malla 3D del terreno con colores por tipo de celda y franjas banco-berma, más la meseta alrededor del rajo.",
    "camino": "// Camino de tierra: calzada con tramos mojados por el aljibe (seedWet, updateRoad, slickNow), de qué lado hay caída (isDrop, inGap), pretiles, postes delineadores, postes del portal con banderas y señalética de distancia.",
}
PATH = {k: ("js/escena.js" if k == "escena" else "js/terreno/%s.js" % k) for k in ORDEN}
def rel(frm, to):      # ruta relativa de import desde el módulo frm hacia el archivo to (bajo js/)
    if frm == "escena": return "./" + to if "/" not in to else "./" + to
    return "../" + to if not to.startswith("terreno/") else "./" + to.split("/", 1)[1]
def mod(k):
    text = T[k]; ex = set(EXP[k]); ids = set(re.findall(r"(?<![.\w])\b[A-Za-z_]\w*\b", sin_comentarios(text))); imps = []
    for path, names in BASE:
        need = sorted(n for n in names if n in ids and n not in ex)
        if need: imps.append("import { %s } from '%s';" % (", ".join(need), rel(k, path)))
    for prev in ORDEN[:ORDEN.index(k)]:
        need = sorted(n for n in EXP[prev] if n in ids and n not in ex)
        if need: imps.append("import { %s } from '%s';" % (", ".join(need), rel(k, PATH[prev][3:])))
    for later in ORDEN[ORDEN.index(k) + 1:]:
        bad = sorted(n for n in EXP[later] if n in ids and n not in ex)
        if bad: print("OJO", k, "usa de un módulo posterior", later, bad)
    return HEAD[k] + "\n" + "\n".join(imps) + "\n\n" + text + "\n\nexport { " + ", ".join(EXP[k]) + " };\n"
OUT = {k: mod(k) for k in ORDEN}

construir = ("// Arma el terreno en orden: cada módulo corre sus pasos (paso('…')) al cargarse, así que el orden de estas líneas es el orden de armado:\n"
             "// ruta → malla de alturas → fondo mina y fase 7 → malla 3D (necesita la escena) → camino. main.js importa de aquí lo que necesita del terreno.\n"
             "export * from './ruta.js';\nexport * from './alturas.js';\nexport * from './fases.js';\nexport * from './malla3d.js';\nexport * from './camino.js';\n")

# ── imports de main ──
hdr_end = next(i for i, l in enumerate(rest) if l.startswith("/* ───────────── Vehículos"))
head = [l for l in rest[:hdr_end] if l.startswith("import {") or l.startswith("// Rajo Kart")]
assert len(head) == len(rest[:hdr_end]) - sum(1 for l in rest[:hdr_end] if l.strip() == ""), [l[:40] for l in rest[:hdr_end] if not (l.startswith("import {") or l.startswith("// Rajo Kart") or l.strip() == "")]
rest_body = rest[hdr_end:]
ids = set(re.findall(r"(?<![.\w])\b[A-Za-z_]\w*\b", sin_comentarios("\n".join(rest_body))))
def imp(path, names):
    need = sorted(n for n in names if n in ids); return "import { %s } from '%s';" % (", ".join(need), path) if need else None
head = [l for l in head if not ("comun/mates.js" in l or "modelos/materiales.js" in l or "config/diseno.js" in l or "datos/" in l)]
terr = sum((EXP[k] for k in ["ruta", "alturas", "fases", "malla3d", "camino"]), [])
new_imps = [x for x in [imp("./config/diseno.js", E_CONF), imp("./datos/caminos.js", E_CAMI), imp("./datos/fase7.js", E_F7), imp("./comun/pasos.js", ["paso"]), imp("./comun/mates.js", E_MATES), imp("./modelos/materiales.js", E_MATER), imp("./escena.js", EXP["escena"]), imp("./terreno/construir.js", terr)] if x]
head[0] = "// Rajo Kart 26 — módulo principal: estado del juego, tráfico, reglas (step), HUD, avisos, entradas y bucle. El mundo lo arman js/terreno (al importarse) y js/operaciones (pasos de abajo)."
# los imports del encabezado existente que ya están (comun, modelos, mundo, operaciones) van después de los nuevos de config/datos/terreno
main_out = "\n".join([head[0]] + new_imps + head[1:] + rest_body) + "\n"
assert "const PASOS" not in main_out

W = lambda p, s: open(p, "w", encoding="utf8", newline="\n").write(s)
os.makedirs(ROOT + "/js/terreno", exist_ok=True)
W(ROOT + "/js/comun/pasos.js", "// Pasos de armado del mundo: paso('nombre', fn) ejecuta fn y anota nombre y tiempo (ms) en PASOS, en orden. Es la lista de qué se ejecuta y cuánto cuesta (window.__d.PASOS en el arnés).\n" + T["pasos"] + "\n")
for k in ORDEN: W(ROOT + "/" + PATH[k], OUT[k])
W(ROOT + "/js/terreno/construir.js", construir)
W(M, main_out)
print("ok main", len(main_out.split("\n")), "líneas")
for k in ORDEN: print(k, len(OUT[k].split("\n")), "líneas →", EXP[k])
print("\n".join(new_imps))
