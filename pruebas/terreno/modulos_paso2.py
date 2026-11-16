# Paso 2 de la modularización: saca de js/main.js los materiales/texturas y los constructores de equipos a js/modelos/*,
# y hash/sm01 a js/comun/mates.js. Los imports de cada módulo (y de main) se calculan por los identificadores que usa.
import re, os, sys
ROOT = r"c:/Users/Usuario/Documents/juegos/rajo-kart"
M = ROOT + "/js/main.js"
L = open(M, encoding="utf8").read().split("\n")
ln = lambda i: L[i - 1]      # 1-based

def rng(a, b, first=None):
    if first is not None: assert ln(a).startswith(first), (a, ln(a)[:60], first)
    return list(range(a, b + 1))

# ── rangos (1-based, inclusivos), verificados por su primera línea ──
R_MATES = rng(463, 463, "function hash") + rng(465, 465, "const sm01")
R_MATER = rng(459, 462, "const lam") + rng(959, 975, "const shadowTex") + rng(1002, 1063, "const rockGeo") + rng(1300, 1300, "const TRK")
R_CAM = rng(976, 1000, "function buildPickup") + rng(1064, 1179, "/* Chasis") + rng(1181, 1227, "/* Aljibe")
R_PAL = rng(1301, 1413, "function buildShovel") + rng(1595, 1626, "function buildHydShovel")
R_PERF = rng(1420, 1476, "/* Perforadoras") + rng(1487, 1504, "const DRILL_NUMS")
R_DOZ = rng(1551, 1583, "function buildWheelDozer") + rng(2192, 2206, "function buildDozer")
assert ln(1000) == "}" and ln(1179).startswith("const CAEX_PLATE") and ln(1227) == "}" and ln(1413) == "}" and ln(1626) == "}" and ln(1476) == "}" and ln(1504) == "}" and ln(1583) == "}" and ln(2206) == "}"

MOVED = set(R_MATES + R_MATER + R_CAM + R_PAL + R_PERF + R_DOZ)
assert len(MOVED) == len(R_MATES) + len(R_MATER) + len(R_CAM) + len(R_PAL) + len(R_PERF) + len(R_DOZ)

def body(rs): return [ln(i) for i in rs]

# ── retoques dentro de lo movido ──
def edit(lines, old, new, n=1):
    s = "\n".join(lines); assert s.count(old) == n, (old, s.count(old)); return s.replace(old, new).split("\n")

mates = body(R_MATES)
mater = body(R_MATER)
cam = body(R_CAM)
cam = edit(cam, "function updateSpray(pts) {", "function updateSpray(pts, t) {      // t: reloj de animación (segundos)")
cam = edit(cam, "const age = (tAnim * 1.5 + SPR.ph[i]) % 1;", "const age = (t * 1.5 + SPR.ph[i]) % 1;")
pal = body(R_PAL)
pal = edit(pal, "function dumpTune(sv) {", "function dumpTune(sv, H) {      // H(x, z): cota del terreno")
perf = body(R_PERF)
perf = edit(perf, "const DRILL_NUMS = [403, 407, 401, 409, 405, 402, 408, 404, 406, 410]; let drillN = 0;      // perforadoras numeradas entre la 400 y la 410",
            "const DRILL_NUMS = [403, 407, 401, 409, 405, 402, 408, 404, 406, 410]; let drillN = 0;      // perforadoras numeradas entre la 400 y la 410\nfunction nextDrillNum() { return DRILL_NUMS[drillN++ % DRILL_NUMS.length]; }")
doz = body(R_DOZ)
doz = edit(doz, "function buildDozer() {      // wheel dozer amarillo tipo CAT, con una roca empujada por la hoja", "function buildDozerConRoca() {      // wheel dozer sencillo con una roca empujada por la hoja (zona de la superficie, al autorizar)")

# ── main sin lo movido, con los llamados ajustados ──
rest = [ln(i) for i in range(1, len(L) + 1) if i not in MOVED]
rest = edit(rest, "dumpTune(sv);", "dumpTune(sv, H);", 2)
rest = edit(rest, "updateSpray(o.spray)", "updateSpray(o.spray, tAnim)")
rest = edit(rest, "DRILL_NUMS[drillN++ % DRILL_NUMS.length]", "nextDrillNum()", 3)
rest = edit(rest, "zonaDoz = { mesh: buildDozer(), ", "zonaDoz = { mesh: buildDozerConRoca(), ")
rest = edit(rest, "/* ───────────── Vehículos ───────────── */", "/* ───────────── Vehículos: los modelos están en js/modelos (camiones, palas, perforadoras, dozers) ───────────── */")

# ── exportaciones: todo lo declarado a nivel 0 en cada módulo ──
DECL = re.compile(r"^(?:function (\w+)|const (\w+)|let (\w+))")
def decls(lines):
    out = []
    for l in lines:
        m = DECL.match(l)
        if not m: continue
        if l.startswith("function "): out.append(m.group(1)); continue
        head = l.split("=")[0]      # 'const A = 1, B = 2' → A, B
        names = re.findall(r"(?:const|let|,)\s+(\w+)\s*$", head)
        if names: out.append(names[0])
        for mm in re.finditer(r",\s*(\w+)\s*=", l): out.append(mm.group(1))
    return out
PRIV = {"shadowTex", "plateCache", "truckPlateCache", "DRILL_NUMS", "drillN", "_rv", "_ry", "SPR"}

def mod(name, lines, header, imports_from):
    ex = [d for d in decls(lines) if d not in PRIV]
    text = "\n".join(lines)
    ids = set(re.findall(r"\b[A-Za-z_]\w*\b", text))
    imps = []
    for path, names in imports_from:
        need = sorted(n for n in names if n in ids and n not in ex)
        if need: imps.append("import { %s } from '%s';" % (", ".join(need), path))
    out = header + "\n" + "\n".join(imps) + ("\n" if imps else "") + "\n" + text + "\n\nexport { " + ", ".join(ex) + " };\n"
    return out, ex

os.makedirs(ROOT + "/js/comun", exist_ok=True); os.makedirs(ROOT + "/js/modelos", exist_ok=True)
W = lambda p, s: open(p, "w", encoding="utf8", newline="\n").write(s)

t_mates, E_MATES = mod("mates", mates, "// Funciones matemáticas chicas sin dependencias: hash determinista (ruido) y suavizado.", [])
t_mater, E_MATER = mod("materiales", mater, "// Materiales, texturas dibujadas en canvas y ayudantes de geometría (box, cyl, blob, placas con número). Solo depende de THREE (global).", [("../comun/mates.js", E_MATES)])
IM = [("./materiales.js", E_MATER), ("../comun/mates.js", E_MATES)]
t_cam, E_CAM = mod("camiones", cam, "// Camiones: camioneta doble cabina, chasis común (truckBase), CAEX de 300 t (buildTruck) y aljibe tipo HD785 (buildAljibe), con sus prototipos y placas.", IM)
t_pal, E_PAL = mod("palas", pal, "// Palas: pala de cables tipo 4100XPC (buildShovel + shovelPose/dumpTune), pila en la tolva (makePile) y pala hidráulica frontal (buildHydShovel + hydPose).", IM)
t_perf, E_PERF = mod("perforadoras", perf, "// Perforadoras: de pozos sobre orugas (buildDrill, grande o de precorte) y compacta de martillo en cabeza (buildCrawlerDrill); numeración 401–410 (nextDrillNum).", IM)
t_doz, E_DOZ = mod("dozers", doz, "// Dozers: wheel dozer tipo 854K, bulldozer de orugas tipo D10 y el wheel dozer sencillo con roca de la zona de la superficie.", IM)

# ── imports de main ──
rest_text = "\n".join(rest)
# quitar las líneas de import existentes para recomponer el encabezado
hdr_end = next(i for i, l in enumerate(rest) if l.startswith("const PASOS"))
head, rest_body = rest[:hdr_end], rest[hdr_end:]
ids = set(re.findall(r"\b[A-Za-z_]\w*\b", "\n".join(rest_body)))
def imp(path, names):
    need = sorted(n for n in names if n in ids)
    return "import { %s } from '%s';" % (", ".join(need), path) if need else None
new_imps = [x for x in [imp("./comun/mates.js", E_MATES), imp("./modelos/materiales.js", E_MATER), imp("./modelos/camiones.js", E_CAM), imp("./modelos/palas.js", E_PAL), imp("./modelos/perforadoras.js", E_PERF), imp("./modelos/dozers.js", E_DOZ)] if x]
head[0] = "// Rajo Kart 26 — módulo principal. Importa configuración (js/config), datos (js/datos), utilidades (js/comun) y modelos de equipos (js/modelos); el resto se irá repartiendo en js/terreno, js/operaciones, js/juego y js/ui."
main_out = "\n".join(head + new_imps + rest_body) + "\n"

# ── chequeo: ningún módulo usa identificadores que quedaron declarados solo en main ──
main_decls = set(decls(rest_body))
for nm, txt in [("mates", t_mates), ("materiales", t_mater), ("camiones", t_cam), ("palas", t_pal), ("perforadoras", t_perf), ("dozers", t_doz)]:
    used = set(re.findall(r"\b[A-Za-z_]\w*\b", txt)) & main_decls
    if used: print("OJO", nm, "usa de main:", sorted(used))

W(ROOT + "/js/comun/mates.js", t_mates); W(ROOT + "/js/modelos/materiales.js", t_mater); W(ROOT + "/js/modelos/camiones.js", t_cam)
W(ROOT + "/js/modelos/palas.js", t_pal); W(ROOT + "/js/modelos/perforadoras.js", t_perf); W(ROOT + "/js/modelos/dozers.js", t_doz)
W(M, main_out)
print("ok main", len(main_out.split("\n")), "líneas")
for nm, ex in [("mates", E_MATES), ("materiales", E_MATER), ("camiones", E_CAM), ("palas", E_PAL), ("perforadoras", E_PERF), ("dozers", E_DOZ)]: print(nm, ex)
print("\n".join(new_imps))
