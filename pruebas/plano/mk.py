# Arma site/ con el código actual y el enganche del arnés (window.__d) del paso 5: el estado del juego vive en js/juego/estado.js (G, P, keys, trucks...).
import shutil, os
src=r"c:\Users\Usuario\Documents\juegos\rajo-kart"; dst=r"C:\Users\Usuario\AppData\Local\Temp\claude\0d8fb4b68261d687\0185a7f9-9f4b-4f28-ac0b-cded994cf449\scratchpad\site"
shutil.rmtree(dst+r"\js", ignore_errors=True); shutil.copytree(src+r"\js", dst+r"\js"); shutil.copy(src+r"\index.html", dst)
h=open(src+r"\js\main.js",encoding="utf8").read()
old="\n/* ───────────── Bucle"
assert h.count(old)==1
h=h.replace(old,"\nwindow.__d = { ...T, ...E, ...PS, ...DC, ...CF, OBSTr: () => EST.OBST, OBST: EST.OBST, onRoadC: MAL.onRoadC, HYDr: () => CG.OPS.HYD, hydPose: PAL.hydPose, PITr: () => T.PIT, GDa: T.GD, GHa: T.GH, HBa: T.HB, GNXv: T.GNX, GX0v: T.GX0, GZ0v: T.GZ0, CELLv: T.CELL, FREE0r: () => EST.G.FREE0, shovelPose: PAL.shovelPose, protoAlj: CAM.protoAlj, ALJ_PLATE: CAM.ALJ_PLATE, LZ: CG.OPS.LZ, addPlates: MAT.addPlates, CAEX_PLATE: CAM.CAEX_PLATE, buildTruck: CAM.buildTruck, buildDrill: PER.buildDrill, buildShovel: PAL.buildShovel, PLATR: () => T.PLAT, LL: () => T.L, SR: () => T.S_RIM, P: EST.P, G: EST.G, step: RG.step, rocasPista: EST.rocasPista, C: { GX0: T.GX0, GZ0: T.GZ0, CELL: T.CELL, GNX: T.GNX, NS: T.NS, SMIN: T.SMIN, DS: T.DS, WR: CF.WR }, get trucks() { return EST.trucks; }, get oncs() { return EST.oncs; }, get mode() { return EST.G.mode; }, get free() { return EST.G.free; }, get FREE0() { return EST.G.FREE0; }, get GATE() { return MU.mundo.GATE; }, get CABLE() { return CB.CABLES.CABLE; }, get CABLE2() { return CB.CABLES.CABLE2; }, get DOZ() { return CG.OPS.DOZ; }, keys: EST.keys, get tGame() { return EST.G.tGame; } };\n"+old,1)
old2="import { paso } from './comun/pasos.js';"; assert h.count(old2)==1
h=h.replace(old2, old2+"\nimport * as T from './terreno/construir.js'; import * as RG from './juego/reglas.js'; import * as E from './escena.js'; import * as PS from './comun/pasos.js'; import * as DC from './datos/caminos.js'; import * as CF from './config/diseno.js'; import * as EST from './juego/estado.js'; import * as MU from './mundo.js'; import * as CAM from './modelos/camiones.js'; import * as PAL from './modelos/palas.js'; import * as PER from './modelos/perforadoras.js'; import * as MAT from './modelos/materiales.js'; import * as MAL from './operaciones/malla.js'; import * as CG from './operaciones/carguio.js'; import * as CB from './operaciones/cables.js';      // solo para el arnés de pruebas",1)
open(dst+r"\js\main.js","w",encoding="utf8").write(h)
for f in ["three.min.js","config.js","nombres_prohibidos.json"]:
    if os.path.exists(src+"\\"+f): shutil.copy(src+"\\"+f, dst)
print("ok")
