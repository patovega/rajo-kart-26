# Paso 1 de la modularización: saca del index.html las constantes de diseño y los datos dibujados/calculados,
# convierte el script en un módulo ES (js/main.js) y nombra los pasos de armado del mundo.
import re, os
ROOT = r"c:/Users/Usuario/Documents/juegos/rajo-kart"
src = ROOT + "/index.html"; h = open(src, encoding="utf8").read()
S0 = "<script>\n(() => {\n'use strict';\n"; S1 = "})();\n</script>"
i0 = h.index(S0); i1 = h.index(S1, i0)
head, body, tail = h[:i0], h[i0 + len(S0):i1], h[i1 + len(S1):]
lines = body.split("\n")

CONF = re.compile(r"^const (TAU|PA|YTOP|BENCH|WR|PRET|LANE|CRASH_U|REQ_RANGE|SPEED_LIMIT|CRUISE|VTOP|FOLLOW_DIST|PCX|FLOOR) ")
DATA1 = re.compile(r"^const (ROUTE|F7POLY|RIMPOLY|FPOLY|SEM6|PATIOS) = ")
conf, cam, f7, out = [], [], [], []
k = 0
while k < len(lines):
    ln = lines[k]
    if CONF.match(ln): conf.append("export " + ln); k += 1; continue
    if DATA1.match(ln): cam.append("export " + ln); k += 1; continue
    if ln.startswith("const SEC = ["):
        j = k
        while not lines[j].startswith("];      // caminos interiores"): j += 1
        cam.append("export " + ln); cam.extend(lines[k + 1:j + 1]); k = j + 1; continue
    if ln.startswith("const D52 = "): f7.append("export " + ln); k += 1; continue
    out.append(ln); k += 1

def names(decls):
    ns = []
    for d in decls:
        if not d.startswith("export const "): continue
        first = d[len("export const "):]
        # nombres separados por comas hasta el ';' de nivel 0 (solo declaraciones de una línea o la primera línea de SEC)
        for m in re.finditer(r"(?:^|, )([A-Za-z_]\w*) =", first.split("//")[0] if first.startswith(("TAU", "PA", "YTOP", "BENCH", "WR", "PRET", "LANE", "CRASH", "REQ", "SPEED", "CRUISE", "VTOP", "FOLLOW", "PCX", "FLOOR")) else first[:40]):
            ns.append(m.group(1))
    return ns
nconf = names(conf); ncam = names(cam); nf7 = names(f7)
assert "SEC" in ncam and "FLOOR" in nconf and "D52" in nf7, (nconf, ncam, nf7)

# pasos con nombre: cada IIFE de nivel 0 pasa a paso('nombre', () => { ... });
res, k, npasos = [], 0, 0
while k < len(out):
    ln = out[k]
    if ln == "(() => {":
        j = k + 1
        while not out[j].startswith("})();"): j += 1
        name = None
        if k > 0 and out[k - 1].startswith("//"): name = out[k - 1][2:].strip()
        else:
            for q in range(k + 1, min(j, k + 4)):
                m = re.search(r"//\s*(.+)$", out[q])
                if m: name = m.group(1).strip(); break
        if not name: name = "paso %d" % (npasos + 1)
        name = name[:70].replace("\\", "/").replace("'", "\u2019")
        res.append("paso('%s', () => {" % name); res.extend(out[k + 1:j]); res.append("});" + out[j][5:]); npasos += 1; k = j + 1; continue
    res.append(ln); k += 1

hdr = ("// Rajo Kart 26 — módulo principal. Importa la configuración (js/config) y los datos (js/datos); el resto se irá repartiendo en js/terreno, js/modelos, js/operaciones, js/juego y js/ui.\n"
       "import { %s } from './config/diseno.js';\n" % ", ".join(nconf) +
       "import { %s } from './datos/caminos.js';\n" % ", ".join(ncam) +
       "import { %s } from './datos/fase7.js';\n" % ", ".join(nf7) +
       "const PASOS = [];      // pasos de armado del mundo, en orden y con su tiempo (ms): para saber qué se ejecuta y cuánto cuesta\n"
       "function paso(nombre, fn) { const t0 = performance.now(); fn(); PASOS.push([nombre, Math.round(performance.now() - t0)]); }\n")
os.makedirs(ROOT + "/js/config", exist_ok=True); os.makedirs(ROOT + "/js/datos", exist_ok=True)
W = lambda p, s: open(p, "w", encoding="utf8", newline="\n").write(s)
W(ROOT + "/js/config/diseno.js", "// Constantes de diseño de la mina y del juego (ver mine-readme.md). Nada de aquí depende de otro módulo.\n" + "\n".join(conf) + "\n")
W(ROOT + "/js/datos/caminos.js", "// Geometría del rajo y caminos: lo escriben las herramientas de pruebas/terreno (build59.py, empalmes.py, lp.py). No editar a mano las cotas: correr lp.py.\n" + "\n".join(cam) + "\n")
W(ROOT + "/js/datos/fase7.js", "// Fase 7 dibujada sobre la foto aérea: rojo = canchas de perforación, azul = material tronado, cab = cables de las palas (1 = pasacables).\n" + "\n".join(f7) + "\n")
W(ROOT + "/js/main.js", hdr + "\n".join(res) + "\n")
W(src, head + '<script type="module" src="js/main.js"></script>' + tail)
print("ok: config", len(conf), "caminos", len(cam), "fase7", len(f7), "pasos", npasos, "main", len(res))
print("conf:", nconf); print("cam:", ncam); print("f7:", nf7)
