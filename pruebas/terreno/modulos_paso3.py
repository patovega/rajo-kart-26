# Paso 3 de la modularización: operaciones mineras a js/operaciones (malla, carguio, cables), objeto `mundo` compartido (js/mundo.js)
# y limpieza del código muerto de la antigua explanada de la pala 3 (P3_MOVED siempre true): loaders, merge, drillAbove3, pattern, zpt.
import re, os
ROOT = r"c:/Users/Usuario/Documents/juegos/rajo-kart"
M = ROOT + "/js/main.js"
L = open(M, encoding="utf8").read().split("\n")
ln = lambda i: L[i - 1]
def chk(i, first): assert ln(i).startswith(first), (i, ln(i)[:80], first)
def rng(a, b, first=None, last=None):
    if first is not None: chk(a, first)
    if last is not None: assert ln(b).rstrip() == last or ln(b).startswith(last), (b, ln(b)[:80], last)
    return list(range(a, b + 1))

# ── verificación de anclas ──
chk(42, "function inPoly"); chk(132, "const P3_MOVED = true;"); chk(390, "  if (PLAT && !P3_MOVED) {"); assert ln(410) == "  }" and ln(411).startswith("  if (RAD) {")
chk(979, "let free = null, GATE = null, CABLE = null, CABLE2 = null, DRILL3B = null;")
chk(1013, "/* ───────────── Explanada"); chk(1014, "const SHOV_T"); chk(1015, "const plat"); chk(1016, "let capNum"); chk(1017, "const nextCaexId"); chk(1018, "const _pl")
chk(1019, "function setWorldPose"); chk(1024, "function bezAt"); chk(1028, "function worldToSU"); chk(1033, "function mkLoaderTruck"); chk(1039, "const zpt")
chk(1040, "function addHoles"); chk(1049, "function placeDrill"); chk(1050, "function pattern"); chk(1058, "function buildDrills"); chk(1076, "const LZ = [], DOZ = [];"); chk(1077, "const TOLVA_C")
chk(1078, "function mkLoadZone"); chk(1106, "let HYD = null;"); chk(1107, "function animOps(dt) {"); chk(1130, "    if (D.p3) {"); assert ln(1135) == "    }" and ln(1136).startswith("    setWorldPose(D.g")
chk(1139, "function floorPath"); chk(1158, "function drawTracks"); chk(1165, "function buildOps"); chk(1183, "  if (!P3_MOVED) {"); assert ln(1190) == "  }" and ln(1191).startswith("  {      // apoyo al carguío")
assert ln(1202) == "}"; chk(1203, "function mkPlatform"); assert ln(1227) == "}"; chk(1228, "// Cables de las palas"); chk(1230, "const CTOP"); chk(1259, "}"); chk(1260, "const gdAt"); chk(1261, "const onRoadC"); chk(1262, "function cableRoute"); assert ln(1284) == "}"
chk(1285, "function layCable"); chk(1310, "function buildPowerLine"); chk(1311, "  const s0 = _pl(SHOV_AL, SHOV_LA), info = { ground: [], posts: [] };"); chk(1325, "  const toe = "); chk(1326, "  if (P3_MOVED) {"); chk(1334, "  else groundCable("); chk(1335, "  CABLE = Object.assign(info, { src: A });")
chk(1357, "function buildCable2"); assert ln(1359) == "}"; chk(1360, "let DRILL3 = null;"); chk(1450, "}"); chk(1451, "mkPlatform();"); chk(1452, "buildSem6();"); chk(1595, "  resetPlatform();")
chk(2176, "    const t = trucks[i], lead = trucks[i + 1]; if (t.merge) { t.v = t.merge.sp; t.vInit = false; continue; }"); assert "updatePlatform(dt); " in ln(2206); assert "if (t.merge) poseMerge(t); else place(" in ln(2388); chk(2391, "  animPlatform(dt);")

body = lambda rs: [ln(i) for i in rs]
def edit(lines, old, new, n=1):
    s = "\n".join(lines); assert s.count(old) == n, (old[:60], s.count(old)); return s.replace(old, new).split("\n")

# ── lo que se va de main ──
DEL = set([42, 132] + list(range(390, 411)) + list(range(1013, 1040)) + list(range(1050, 1058)) + list(range(1040, 1050)) + list(range(1058, 1076)) + list(range(1076, 1139)) + list(range(1139, 1203)) + list(range(1203, 1228)) + list(range(1228, 1360)) + list(range(1360, 1451)) + [1451, 1452, 1595])

# ── módulos ──
mates_add = [ln(42)]
cam_add = [ln(1016), ln(1017), "const resetCaexIds = () => { capNum = 100; };      // al empezar una partida los CAEX se numeran de nuevo desde el 101"]
pl_line = ln(1018).replace("const _pl = ", "const pl = ")
swp = body(rng(1019, 1023))

carg = body(rng(1040, 1049)) + body(rng(1058, 1075)) + [ln(1077)] + body(rng(1078, 1105)) + body(list(range(1107, 1130)) + list(range(1136, 1139))) + body(rng(1158, 1164)) + body(list(range(1165, 1183)) + list(range(1191, 1203)))
carg = "\n".join(carg)
carg = re.sub(r"\bHYD\b", "OPS.HYD", carg); carg = re.sub(r"\bLZ\b", "OPS.LZ", carg); carg = re.sub(r"\bDOZ\b", "OPS.DOZ", carg)
assert carg.count("function animOps(dt) {") == 1; carg = carg.replace("function animOps(dt) {", "function animOps(dt, tAnim) {      // tAnim: reloj de animación (s)")
carg = "const SHOV_T = 7.2;      // ciclo de la pala de cables (s): cava, gira, descarga y vuelve
const OPS = { LZ: [], DOZ: [], HYD: null };      // estado de las operaciones: palas de cables cargando (LZ), dozers (DOZ) y pala hidráulica (HYD)\n" + carg

malla = "\n".join([ln(1260), ln(1261)] + body(rng(1139, 1157)) + body(rng(1262, 1284)))

cab = [ln(1228), ln(1229), "const SHOV_AL = -20, SPOT_AL = [SHOV_AL - 24, SHOV_AL + 24], ARR_LA = WR + 2, SPOT_LA = WR + 13;      // franja por donde circulaban los camiones de la antigua pala 3 junto a la Rampa Sur: sigue siendo zona a evitar para que el cable de la ruta no cambie de trazado",
       "const CABLES = { CABLE: null, CABLE2: null };      // cable de la ruta (PC9000) y primer cable dibujado (para el arnés de pruebas)", pl_line] + body(rng(1230, 1259)) + body(list(range(1285, 1325)) + list(range(1326, 1334)) + list(range(1335, 1360)))
cab = "\n".join(cab)
cab = re.sub(r"\b_pl\(", "pl(", cab)
cab = cab.replace("  const s0 = pl(SHOV_AL, SHOV_LA), info = { ground: [], posts: [] };", "  const info = { ground: [], posts: [] };")
assert cab.count("  if (P3_MOVED) { const Q = ") == 1; cab = cab.replace("  if (P3_MOVED) { const Q = ", "  { const Q = ")
assert cab.count("  CABLE = Object.assign(info, { src: A });") == 1; cab = cab.replace("  CABLE = Object.assign(info, { src: A });", "  CABLES.CABLE = Object.assign(info, { src: A });")
assert cab.count("if (!CABLE2) CABLE2 = info;") == 1; cab = cab.replace("if (!CABLE2) CABLE2 = info;", "if (!CABLES.CABLE2) CABLES.CABLE2 = info;")

# lo que viene del mundo se lee como M.<nombre>
MUNDO = ["scene", "H", "frame", "OBST", "GD", "GX0", "GZ0", "GNX", "GNZ", "CELL", "PLAT7", "PLAT", "PITC", "F7EQ", "RED52", "PIT", "f7h", "PAD_UP", "GATE"]
def mundify(t):
    for n in MUNDO: t = re.sub(r"(?<![.\w])" + n + r"\b", "M." + n, t)
    return t
carg, malla, cab = mundify(carg), mundify(malla), mundify(cab)
assert "M.GATE = {" in cab and "M.H(" in carg and "M.GD[" in malla

# ── main ──
rest = []
for i in range(1, len(L) + 1):
    if i in DEL: continue
    s = ln(i)
    if i == 979: s = s.replace("let free = null, GATE = null, CABLE = null, CABLE2 = null, DRILL3B = null;      // GATE: entrada a la Rampa Sur desde la fase 7, entre dos postes pasacables (cable de la pala 3 por arriba)", "let free = null;")
    if s == "  capNum = 100;      // los CAEX se numeran desde el 101": s = "  resetCaexIds();"
    if i == 2176: s = s.replace(" if (t.merge) { t.v = t.merge.sp; t.vInit = false; continue; }", "")
    if i == 2206: s = s.replace("updatePlatform(dt); ", "")
    if i == 2388: s = s.replace("if (t.merge) poseMerge(t); else place(", "place(")
    if i == 2391: s = "  animOps(dt, tAnim);"
    if i == 1453:      # línea en blanco tras mkPlatform(); buildSem6();  → aquí van el mundo y los pasos de operaciones
        rest.append("/* ───────────── Operaciones mineras: en js/operaciones (carguio, malla, cables). Aquí solo se llena el mundo compartido y se llaman los pasos ───────────── */")
        rest.append("Object.assign(M, { scene, H, frame, OBST, GD, GX0, GZ0, GNX, GNZ, CELL, PLAT7, PLAT, PITC, F7EQ, RED52, PIT, f7h, PAD_UP });      // lo que las operaciones necesitan del mundo")
        rest.append("paso('operaciones: canchas de perforación, palas cargando, dozers y huellas', () => { buildDrills(); buildOps(); });")
        rest.append("paso('cables: subestaciones, postes pasacables y SEM 6', () => { buildPowerLine(); buildCable2(); buildSem6(); });")
    rest.append(s)
rest_t = "\n".join(rest)
rest_t = re.sub(r"(?<![.\w])GATE\b", "M.GATE", rest_t)
assert "P3_MOVED" not in rest_t and "plat." not in rest_t and "_pl(" not in rest_t and "resetPlatform" not in rest_t and "poseMerge" not in rest_t, "quedó código muerto"
rest = rest_t.split("\n")

# ── exportaciones e imports ──
DECL = re.compile(r"^(?:function (\w+)|const (\w+)|let (\w+))")
def decls(lines):
    out = []
    for l in lines:
        m = DECL.match(l)
        if not m: continue
        if l.startswith("function "): out.append(m.group(1)); continue
        head = l.split("=")[0]; names = re.findall(r"(?:const|let|,)\s+(\w+)\s*$", head)
        if names: out.append(names[0])
        pre = re.split(r"[\{\(]", l)[0]      # solo las declaraciones de nivel 0 (antes de cualquier llave o paréntesis)
        for mm in re.finditer(r",\s*(\w+)\s*=", pre): out.append(mm.group(1))
    return out
# exportaciones de los módulos ya existentes
def exports_of(path):
    t = open(ROOT + "/js/" + path, encoding="utf8").read(); m = re.search(r"^export \{ (.*) \};", t, re.M); return [x.strip() for x in m.group(1).split(",")]
E_MATES = exports_of("comun/mates.js") + ["inPoly"]; E_MATER = exports_of("modelos/materiales.js"); E_CAM = exports_of("modelos/camiones.js") + ["nextCaexId", "resetCaexIds"]
E_PAL = exports_of("modelos/palas.js"); E_PERF = exports_of("modelos/perforadoras.js"); E_DOZ = exports_of("modelos/dozers.js")
E_CONF = ["TAU", "PA", "PB", "YTOP", "BENCH", "WR", "BLEND", "PRET", "LANE", "CRASH_U", "REQ_RANGE", "SPEED_LIMIT", "CRUISE", "VTOP", "FOLLOW_DIST", "PCX", "PCZ", "PR", "FLOOR", "FRAD"]
E_CAMI = ["ROUTE", "F7POLY", "RIMPOLY", "FPOLY", "SEC", "SEM6", "PATIOS"]; E_F7 = ["D52"]
E_MUNDO = ["setWorldPose"]

def mod(text, header, imports_from, priv=()):
    lines = text.split("\n"); ex = [d for d in decls(lines) if d not in priv]
    ids = set(re.findall(r"\b[A-Za-z_]\w*\b", text)); imps = []
    mu = (["mundo as M"] if "M." in text else []) + sorted(n for n in E_MUNDO if n in ids)
    if mu: imps.append("import { %s } from '../mundo.js';" % ", ".join(mu))
    for path, names in imports_from:
        need = sorted(n for n in names if n in ids and n not in ex)
        if need: imps.append("import { %s } from '%s';" % (", ".join(need), path))
    return header + "\n" + "\n".join(imps) + "\n\n" + text + "\n\nexport { " + ", ".join(ex) + " };\n", ex

t_malla, E_MALLA = mod(malla, "// Malla del terreno vista desde las operaciones: tipo de celda (gdAt, onRoadC) y caminos más baratos sobre ella (floorPath para huellas, cableRoute para cables).",
                       [("../config/diseno.js", E_CONF)])
UP = [("../config/diseno.js", E_CONF), ("../datos/caminos.js", E_CAMI), ("../datos/fase7.js", E_F7), ("../comun/mates.js", E_MATES), ("../modelos/materiales.js", E_MATER), ("../modelos/camiones.js", E_CAM), ("../modelos/palas.js", E_PAL), ("../modelos/perforadoras.js", E_PERF), ("../modelos/dozers.js", E_DOZ), ("./malla.js", E_MALLA)]
t_carg, E_CARG = mod(carg, "// Carguío y apoyo: canchas de perforación con sus pozos y perforadoras (buildDrills), palas cargando camiones (mkLoadZone, pala hidráulica), dozers (addDozer, workSite), huellas (drawTracks) y su animación (animOps). Todo se arma en buildOps.", UP, priv=("TOLVA_C", "SHOV_T"))
t_cab, E_CAB = mod(cab, "// Cables de las palas y energía: postes pasacables (cablePost), subestaciones, SEM 6, cable de la ruta hasta la PC9000 (buildPowerLine, deja M.GATE) y cables dibujados de las otras palas (buildCable2).", UP, priv=("SHOV_AL", "SPOT_AL", "ARR_LA", "SPOT_LA", "CTOP", "pl"))

# mundo.js
mundo_js = """// Mundo compartido: lo que los módulos de operaciones necesitan del terreno y la escena. Lo llena main.js (Object.assign) una vez armado el terreno;
// los módulos lo leen como M.H, M.scene, M.OBST... y solo escriben lo que es suyo (M.GATE). Nada de aquí se usa al cargar el módulo, solo dentro de funciones.
export const mundo = {
  scene: null,       // escena de THREE
  H: null,           // H(x, z): cota del terreno
  frame: null,       // frame(s): posición, tangente y derecha de la ruta
  OBST: null,        // equipos detenidos y cables por el piso: { x, z, r }
  GD: null, GX0: 0, GZ0: 0, GNX: 0, GNZ: 0, CELL: 5,      // malla del terreno: código de celda (-1 piso, -2 pila, 0..WR+2 camino, 60 cara) y su geometría
  PLAT7: null,       // meseta de la isla a la cota de la fase 7 (barata para los cables)
  PLAT: null,        // explanada / portón de la ruta: { se, side, D, HL, k }
  PITC: null,        // centro del rajo
  F7EQ: null,        // equipos de la fase 7: palas, pc (PC9000), canchas
  RED52: null,       // canchas de perforación dibujadas (funciones de distancia)
  PIT: null,         // fondo mina: marco y palas p1 / p5
  f7h: null,         // f7h(x, z): cota del piso de la fase 7
  PAD_UP: 16,        // altura de la cancha sobre su piso
  GATE: null,        // portón de la Rampa Sur entre dos postes pasacables (lo deja buildPowerLine)
};
const _look = new THREE.Vector3();
""" + "\n".join(swp).replace("H(", "mundo.H(") + "\n\nexport { setWorldPose };\n"
assert "mundo.H(x, z)" in mundo_js

# comun/mates.js y modelos/camiones.js: agregar inPoly y nextCaexId
def add_to(path, lines, newex, after_header_comment):
    t = open(ROOT + "/js/" + path, encoding="utf8").read()
    m = re.search(r"^export \{ (.*) \};\n", t, re.M); ex = m.group(1)
    t = t[:m.start()] + "\n".join(lines) + "\n\nexport { " + ex + ", " + ", ".join(newex) + " };\n"
    open(ROOT + "/js/" + path, "w", encoding="utf8", newline="\n").write(t)
add_to("comun/mates.js", [ln(42) + "      // punto dentro de un polígono [[x, z], ...]"], ["inPoly"], None)
add_to("modelos/camiones.js", cam_add, ["nextCaexId", "resetCaexIds"], None)
mt = open(ROOT + "/js/comun/mates.js", encoding="utf8").read().replace("// Funciones matemáticas chicas sin dependencias: hash determinista (ruido) y suavizado.", "// Funciones matemáticas chicas sin dependencias: hash determinista (ruido), suavizado y punto en polígono.")
open(ROOT + "/js/comun/mates.js", "w", encoding="utf8", newline="\n").write(mt)

# imports de main (se regeneran todos menos config/datos)
hdr_end = next(i for i, l in enumerate(rest) if l.startswith("const PASOS"))
head = [l for l in rest[:hdr_end] if not (l.startswith("import {") and ("comun/" in l or "modelos/" in l))]
rest_body = rest[hdr_end:]
ids = set(re.findall(r"\b[A-Za-z_]\w*\b", "\n".join(rest_body)))
def imp(path, names):
    need = sorted(n for n in names if n in ids); return "import { %s } from '%s';" % (", ".join(need), path) if need else None
new_imps = [x for x in [imp("./comun/mates.js", E_MATES), imp("./modelos/materiales.js", E_MATER), imp("./modelos/camiones.js", E_CAM), imp("./modelos/palas.js", E_PAL), imp("./modelos/perforadoras.js", E_PERF), imp("./modelos/dozers.js", E_DOZ),
                              "import { mundo as M, setWorldPose } from './mundo.js';", imp("./operaciones/malla.js", E_MALLA), imp("./operaciones/carguio.js", E_CARG), imp("./operaciones/cables.js", E_CAB)] if x]
head[0] = "// Rajo Kart 26 — módulo principal: geometría del rajo, terreno, camino, estado del juego, reglas, HUD, entradas y bucle. Importa config, datos, comun, modelos y operaciones (que leen el mundo compartido de js/mundo.js)."
main_out = "\n".join(head + new_imps + rest_body) + "\n"

# chequeo: identificadores de main usados por los módulos sin importar
main_decls = set(decls(rest_body))
for nm, txt in [("malla", t_malla), ("carguio", t_carg), ("cables", t_cab)]:
    used = sorted(set(re.findall(r"(?<![.\w])\b([A-Za-z_]\w*)\b", txt)) & main_decls - {"P", "W", "L", "S", "T", "Q", "C", "D", "A", "B", "G", "K", "N", "R", "m", "o", "p", "q", "s", "t", "k", "i", "j", "n", "x", "z", "y", "a", "b", "c", "d", "e", "f", "g", "h", "r", "u", "v", "w", "el", "la", "al", "dz", "dx", "px", "pz", "tx", "tz", "fx", "fz", "nx", "nz", "ux", "uz", "vx", "vz", "cx", "cz", "sx", "sz", "lx", "lz", "hr", "tl", "tp", "fall", "tilt", "canvas", "pad", "free", "cost", "cut", "hole", "info", "out", "seg", "pts", "way", "back", "lanes", "last", "mark", "extra", "pass", "done", "from", "push", "pop", "hp", "hv", "ci", "cones", "holes", "palas", "cancha", "flat", "snap", "gd", "ok", "good", "best", "fits", "tmp", "WD", "T7", "TF", "lt", "sv", "ld", "bp", "qx", "qz", "rm", "sc", "an", "ca", "cb", "fill", "pile", "mesh", "num", "th", "ph", "was", "s0", "s1", "a0", "a1", "b0", "b1", "i0", "i1", "j0", "j1", "Hh", "blk", "nv", "keep", "ya", "yb", "gr", "wh", "bl", "dk", "red", "ye", "post", "cv", "pl", "A", "G1", "G2", "G3", "S1", "S2", "r5", "e", "curve", "gc", "gw", "avoid", "sp", "toe", "glass", "yel", "steel", "box", "cyl", "lam", "inF", "ng", "ix", "iz", "jx", "jz", "ci0", "it", "li", "lv", "top", "l0", "l1", "X", "Z", "PER", "LN", "E"})
    if used: print("OJO", nm, "usa de main:", used)

W = lambda p, s: open(p, "w", encoding="utf8", newline="\n").write(s)
os.makedirs(ROOT + "/js/operaciones", exist_ok=True)
W(ROOT + "/js/mundo.js", mundo_js); W(ROOT + "/js/operaciones/malla.js", t_malla); W(ROOT + "/js/operaciones/carguio.js", t_carg); W(ROOT + "/js/operaciones/cables.js", t_cab); W(M, main_out)
print("ok main", len(main_out.split("\n")), "líneas"); print("malla", E_MALLA); print("carguio", E_CARG); print("cables", E_CAB); print("\n".join(new_imps))
