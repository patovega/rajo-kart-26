# Paso 5 de la modularización: el juego a js/juego (estado, tráfico, rocas, libre, llegada, reglas, cámara, animación), la interfaz a js/ui
# (dom, sonido, avisos, hud, ranking, nombres, controles, pantallas, teclado), el domo a js/operaciones/superficie.js y main.js como orquestador.
# Las variables globales sueltas del juego (mode, tGame, free, arrive...) pasan a propiedades del objeto G de js/juego/estado.js, porque un
# módulo ES no puede asignar una variable exportada por otro. Quita código muerto: spawnZona (nunca se llama), marker y camMarker (nunca visibles), t0 (Color sin uso).
import re, os
ROOT = r"c:/Users/Usuario/Documents/juegos/rajo-kart"
MAIN = ROOT + "/js/main.js"
L = open(MAIN, encoding="utf8").read().split("\n")
ln = lambda i: L[i - 1]
def chk(i, first): assert ln(i).startswith(first), (i, ln(i)[:80], first)
for i, s in [(17, "const _look"), (25, "}"), (27, "const pickup"), (28, "const marker"), (31, "const keys"), (33, "const OBST"), (34, "let free"), (35, "const trucks"), (36, "let mode"), (37, "let radioTimer"),
             (39, "const $"), (41, "  alerts:"), (42, "el.altmax"), (43, "const pad"), (44, "const fmt"), (46, "function mkSame"), (67, "}"), (68, "/* ───────────── Operaciones"), (69, "Object.assign(M"), (70, "paso('operaciones"), (71, "paso('cables"),
             (73, "/* ───────────── Final"), (74, "const END_S"), (75, "paso('domo mirador'"), (108, "});"), (109, "(() => { // estacionamiento CAEX"), (121, "})();"), (123, "const ROCK_ZIG"), (156, "}"), (157, "const FREE0 = (() => {"), (170, "})();"),
             (171, "const freeBlocked"), (205, "}"), (206, "function resetGame"), (224, "}"), (226, "/* Audio */"), (227, "let ac = null"), (246, "$('snd')"), (248, "/* HUD helpers */"), (249, "let alSig"), (275, "}"), (276, "function findTarget"), (285, "}"),
             (286, "/* Zona de la superficie"), (288, "let zonaDoz"), (289, "function spawnZona"), (297, "}"), (298, "function startDozer"), (324, "}"), (325, "el.auth.addEventListener"), (327, "function cotillon"), (339, "}"), (340, "function parkStep"), (345, "}"),
             (346, "function metaMensaje"), (350, "}"), (351, "function stepArrival"), (361, "}"), (362, "let playerName"), (363, "let TEST"), (364, "const cleanName"), (395, "};"), (396, "const reasonCode"), (398, "/* Registro automático"), (399, "const RRC"),
             (422, "window.addEventListener('online'"), (423, "// Partidas en vivo"), (424, "let liveId"), (438, "}"), (439, "function showResult"), (453, "}"), (454, "$('resCopy')"), (455, "$('resShare')"), (456, "const coarseMq"), (457, "let rotBlocked"), (458, "function orient"),
             (476, "$('chgName')"), (477, "let pendingShot"), (478, "function signOf"), (487, "function endGame"), (499, "}"), (500, "function startGame"), (501, "  if (!ac)"), (502, "  if (ac && ac.state"), (503, "  resetGame(); overT = 0;"), (504, "  liveId = 'v'"), (508, "}"),
             (509, "$('goBtn')"), (510, "$('retryBtn')"), (512, "/* Entrada */"), (513, "const keyMap"), (522, "window.addEventListener('keyup'"), (524, "/* ───────────── Volante"), (525, "const inp"), (526, "let wheelCfg"), (610, "  const pad = {"), (620, "    pad.axes = ax; pad.buttons = bt;"),
             (622, "  hidPads.push(pad);"), (725, "$('tiltCal')"), (726, "function launch"), (740, "}"), (741, "$('tiltInv')"), (742, "window.addEventListener('blur'"), (747, "});"), (749, "/* ───────────── Rocas que caen"), (750, "const rockMat"), (751, "function dropRock"), (779, "}"),
             (781, "/* ───────────── Simulación"), (782, "const clamp"), (783, "let overT"), (784, "function step"), (790, ""), (791, "  // Camiones en el mismo sentido"), (823, "  }"), (824, "  updateRoad(dt);"), (898, "}"), (900, "/* ───────────── Cámara"), (901, "const camPos"), (902, "let camSnap"),
             (903, "function updateCamera"), (917, "}"), (919, "/* ───────────── Radar"), (920, "const rc"), (939, "}"), (941, "/* ───────────── Render"), (942, "const t0"), (943, "function blink"), (976, "}"), (977, "function nearestRoca"), (981, "}"), (982, "const camMarker"), (983, "camMarker.rotation"),
             (984, "function updateVisuals"), (1010, "  camMarker.visible = false; marker.visible = false;"), (1012, "}"), (1014, "function updateHud"), (1055, "}"), (1057, "let last"), (1074, "requestAnimationFrame(loop);")]:
    chk(i, s)
R = lambda a, b: list(range(a, b + 1))
body = lambda rs: "\n".join(ln(i) for i in rs)
def edit(s, old, new, n=1): assert s.count(old) == n, (old[:70], s.count(old)); return s.replace(old, new)

# ── variables globales del juego → G.x ──
GVARS = ["mode", "tGame", "tAnim", "overtakes", "spawnT", "wrongT", "beepT", "bannerT", "shake", "aljT", "rockT", "pickT", "skidT", "camBeepT", "gapBeepT", "crashSide", "crashT", "fall", "crashFall", "crush", "intro", "arrive", "free", "overT", "camSnap", "TEST", "playerName", "FREE0"]
def aG(text):
    for v in GVARS: text = re.sub(r"(?<![.\w'\"])\b" + v + r"\b(?!\s*:)", "G." + v, text)
    return text
G_DECL = """// Estado de la partida (G): lo que antes eran variables sueltas de main.js. Los módulos del juego y de la interfaz lo leen y escriben como G.mode, G.free, G.arrive...
const G = {
  mode: 'menu',                                   // 'menu' | 'play' | 'win' | 'over'
  tGame: 0, tAnim: 0, overtakes: 0,               // tiempo de la partida, tiempo de animación (no se detiene), adelantamientos
  spawnT: 8, aljT: 0, pickT: 20, rockT: 6,        // temporizadores: próximo CAEX en contra, aljibe, camioneta en contra, roca que cae de un camión
  wrongT: 0, overT: 0,                            // segundos en la pista contraria sin motivo / sobre el límite de velocidad
  beepT: 0, bannerT: 0, skidT: 0, camBeepT: 0, gapBeepT: 0,      // temporizadores de avisos y pitidos
  shake: 0, camSnap: true,                        // sacudida de cámara; la cámara salta a su sitio sin suavizar en el próximo cuadro
  crashSide: 0, crashT: 0, fall: null, crashFall: false, crush: null,      // choque contra el pretil (lado y tiempo), caída al rajo, aplastamiento
  intro: null, arrive: null, free: null,          // salida automática, tramo final hasta el domo, tránsito libre por la fase 7: { x, z, a, gate }
  FREE0: null,                                    // punto de partida del tránsito libre (lo calcula buscarPartidaLibre una vez armado el mundo)
  TEST: false, playerName: '',                    // modo prueba (nombre «federicovega»): sin tráfico, sin límite de velocidad, no se envía al ranking
};
const ganchos = { endGame: (win, msg) => {} };      // la pantalla de fin de partida la instala js/ui/pantallas.js (el juego no importa de la interfaz)
const endGame = (win, msg) => ganchos.endGame(win, msg);      // termina la partida: mode pasa a 'win' u 'over' y se muestra el resultado"""

T = {}
T["texto"] = body(R(43, 44))
T["estado"] = G_DECL + "\n\n" + body(R(17, 25)) + "\n" + ln(27) + "\n" + body(R(31, 33)) + "\n" + ln(35) + "\n" + ln(74) + "\n" + ln(525)
sup = "function buildSuperficie() {      // domo mirador con bandera, aljibe y camiones estacionados al final de la ruta, y el carril solo CAEX si está activo\n  const { scene, H, frame, L, CAEX_LANE } = M;      // del mundo compartido\n  const protoPick = buildPickup(0xc9141c, true);      // camioneta roja doble cabina estacionada\n" + body(R(76, 107)) + "\n" + body(R(109, 121)) + "\n}"
T["superficie"] = edit(sup, "protoPick[0]", "protoPick", 2)
traf = body(R(46, 67)) + "\n" + body(R(276, 288)) + "\n" + body(R(298, 324)) + "\n\nfunction stepTrafico(dt) {      // camiones en el mismo sentido, tráfico en contra (CAEX, aljibe, camionetas) y su aparición\n" + body(R(791, 823)) + "\n}"
T["trafico"] = traf
T["rocas"] = body(R(749, 750)) + "\n" + body(R(123, 156)) + "\n" + body(R(751, 779)) + "\n" + body(R(977, 981))
lib = body(R(157, 205))
lib = edit(lib, "const FREE0 = (() => {      // partida en el piso de la fase 7, en el extremo más alejado de la Rampa Sur", "function buscarPartidaLibre() {      // punto de partida del tránsito libre: en el piso de la fase 7, en el extremo más alejado de la Rampa Sur, con camino recto despejado hasta el portón")
lib = edit(lib, "\n})();\n", "\n}\n")
T["libre"] = lib
lleg = body(R(340, 345)) + "\n" + body(R(351, 361))
T["llegada"] = edit(lleg, "  if (eng) eng.frequency.value = 46 + P.v * 9;\n", "  motorRpm(P.v);\n")
T["reglas"] = ln(781) + "\n" + body(R(206, 224)) + "\n\n" + body(R(784, 790)) + "\n  stepTrafico(dt);\n" + body(R(824, 898))
T["camara"] = body(R(900, 901)) + "\n" + body(R(903, 917))
anim = ln(941) + "\n" + body(R(943, 976)) + "\n" + body(R(984, 1009)) + "\n" + body(R(1011, 1012))
T["animacion"] = anim
T["dom"] = body(R(39, 41)) + "\n" + ln(456)
snd = body(R(226, 246))
snd = edit(snd, "let ac = null, eng = null, engG = null, muted = false;", "let ac = null, eng = null, engG = null;\nconst SND = { muted: false };      // silencio general (botón «Sonido»)")
snd = re.sub(r"(?<![.\w])\bmuted\b(?!\s*:)", "SND.muted", snd)
snd += """
function audioStart() {      // el contexto de audio solo se puede crear tras un gesto del usuario (al empezar la partida)
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
}
function motorRpm(v) { if (eng) eng.frequency.value = 46 + v * 9; }      // el motor sube de tono con la velocidad (m/s)"""
T["sonido"] = snd
avi = body(R(248, 275)) + "\n" + body(R(327, 339)) + "\n" + body(R(346, 350))
avi = re.sub(r"(?<![.\w])\bmuted\b", "SND.muted", avi)
avi = edit(avi, "(function frame(now) {", "(function cuadro(now) {"); avi = edit(avi, "requestAnimationFrame(frame)", "requestAnimationFrame(cuadro)")
T["avisos"] = avi
hud = ln(919) + "\n" + ln(42) + "\n" + ln(325) + "\n" + body(R(920, 939)) + "\n\n" + body(R(1014, 1055))
T["hud"] = edit(hud, "  if (eng) eng.frequency.value = 46 + P.v * 9;\n", "  motorRpm(P.v);\n")
rk = ln(398) + "\n" + body(R(396, 397)) + "\n" + body(R(399, 438)) + """
function liveStart() { liveId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); liveT = 0; liveJoin(); }      // identificador de esta partida y plaza para enviar posiciones
function liveTick(dt) {      // latido cada 4 s para espectadores, solo si tiene plaza; si no, reintenta pedirla cada 20 s
  liveT -= dt; if (liveT <= 0) { liveT = 4; liveSend(); }
  if (!liveOn) { liveRetryT -= dt; if (liveRetryT <= 0) liveJoin(); }
}
""" + body(R(439, 455))
T["ranking"] = rk
nom = body(R(364, 395))
nom = edit(nom, "const L = LISTA_NOMBRES; if (!L) return true;", "const LN = LISTA_NOMBRES; if (!LN) return true;")
nom = edit(nom, "Object.values(L.nombres)", "Object.values(LN.nombres)"); nom = edit(nom, "enLista(L.localidades)", "enLista(LN.localidades)")
nom = edit(nom, "Object.entries(L.palabras_prohibidas)", "Object.entries(LN.palabras_prohibidas)"); nom = edit(nom, "(L.palabras_prohibidas.exactas", "(LN.palabras_prohibidas.exactas")
nom = edit(nom, "Object.entries(L.frases_prohibidas)", "Object.entries(LN.frases_prohibidas)"); nom = edit(nom, "(L.frases_prohibidas.regex_sugeridas", "(LN.frases_prohibidas.regex_sugeridas")
nom = edit(nom, "Object.entries(L.emoticones_prohibidos)", "Object.entries(LN.emoticones_prohibidos)")
assert not re.search(r"(?<![.\w])\bL\b", nom)
T["nombres"] = nom
ctl = ln(524) + "\n" + body(R(526, 725)) + "\n" + ln(741)
ctl = edit(ctl, "  const pad = {", "  const padHid = {"); ctl = edit(ctl, "    pad.axes = ax; pad.buttons = bt;", "    padHid.axes = ax; padHid.buttons = bt;"); ctl = edit(ctl, "  hidPads.push(pad);", "  hidPads.push(padHid);")
T["controles"] = ctl
lanz = body(R(726, 740)); assert lanz.count("box") == 6, lanz.count("box"); lanz = re.sub(r"\bbox\b", "caja", lanz)      # la caja de la cuenta regresiva no es box() de materiales
pan = "const pantalla = { rotBlocked: false, pendingShot: false };      // celular en vertical (el juego se pausa); captura del choque pendiente para el cuadro siguiente\n" + body(R(458, 476)) + "\n" + body(R(478, 511)) + "\n" + lanz
pan = re.sub(r"(?<![.\w])\brotBlocked\b(?!\s*:)", "pantalla.rotBlocked", pan); pan = re.sub(r"(?<![.\w])\bpendingShot\b(?!\s*:)", "pantalla.pendingShot", pan)
pan = edit(pan, "function endGame(win, msg) {", "function terminarPartida(win, msg) {      // fin de la partida: pantalla de resultado, señal de la regla incumplida, captura del choque y envío al ranking")
pan = edit(pan, "  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }\n  if (ac && ac.state === 'suspended') ac.resume();\n", "  audioStart();\n")
pan = edit(pan, "  liveId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); liveT = 0; liveJoin();      // identificador de esta partida y plaza para enviar posiciones\n", "  liveStart();\n")
pan += """
ganchos.endGame = terminarPartida;      // el juego (js/juego) termina la partida a través de este gancho
function capturaPendiente() {      // la captura del choque se toma en el cuadro siguiente al fin de la partida, ya con la camioneta chocada
  if (!pantalla.pendingShot) return; pantalla.pendingShot = false;
  const im = $('shotImg'); im.src = renderer.domElement.toDataURL('image/jpeg', 0.85); im.hidden = false;
}"""
T["pantallas"] = pan
T["teclado"] = ln(512) + "\n" + body(R(513, 522)) + "\n" + body(R(742, 747))
for k in T:
    if k != "estado": T[k] = aG(T[k])
    else: T[k] = G_DECL + aG(T[k][len(G_DECL):])
# ninguna G. dentro de una cadena
for k, t in T.items():
    for s in re.findall(r"'[^'\n]*'", sin := re.sub(r"(^|\s)//.*$", " ", t, flags=re.M)):
        assert "G." not in s, (k, s)
for k, t in T.items():
    for v in ["TEST", "playerName", "mode"]: assert not re.search(r"^\s*let .*\b" + v + r"\b", t, re.M), (k, v)

# ── módulos: ruta, encabezado, exportaciones ──
PATH = {"texto": "comun/texto.js", "estado": "juego/estado.js", "superficie": "operaciones/superficie.js", "trafico": "juego/trafico.js", "rocas": "juego/rocas.js", "libre": "juego/libre.js", "llegada": "juego/llegada.js",
        "reglas": "juego/reglas.js", "camara": "juego/camara.js", "animacion": "juego/animacion.js", "dom": "ui/dom.js", "sonido": "ui/sonido.js", "avisos": "ui/avisos.js", "hud": "ui/hud.js", "ranking": "ui/ranking.js",
        "nombres": "ui/nombres.js", "controles": "ui/controles.js", "pantallas": "ui/pantallas.js", "teclado": "ui/teclado.js"}
ORDEN = ["texto", "superficie", "estado", "dom", "sonido", "avisos", "rocas", "trafico", "libre", "llegada", "camara", "animacion", "reglas", "nombres", "ranking", "hud", "controles", "pantallas", "teclado"]      # un módulo solo importa de los anteriores
EXP = {"texto": ["pad", "fmt"], "estado": ["G", "P", "keys", "inp", "OBST", "trucks", "oncs", "rocks", "rocasPista", "pickup", "place", "END_S", "ganchos", "endGame"], "superficie": ["buildSuperficie"],
       "trafico": ["mkSame", "mkOncPickup", "mkOnc", "mkAlj", "findTarget", "nearAuth", "requestAuth", "stepDozer", "stepTrafico"], "rocas": ["ROCK_ZIG", "resetFallRocks", "updateFallRocks", "mkRoca", "updateRocks", "nearestRoca"],
       "libre": ["buscarPartidaLibre", "stepFree"], "llegada": ["stepArrival"], "reglas": ["resetGame", "step"], "camara": ["updateCamera"], "animacion": ["updateVisuals"], "dom": ["$", "el", "coarseMq"],
       "sonido": ["SND", "beep", "startEngine", "stopEngine", "audioStart", "motorRpm"], "avisos": ["speak", "renderAlerts", "setBanner", "showRadio", "cotillon", "metaMensaje"], "hud": ["updateHud", "drawRadar"],
       "ranking": ["showResult", "liveStart", "liveTick"], "nombres": ["cleanName", "norm", "nombreValido"], "controles": ["pollInput", "cal", "calTick", "tilt", "tiltAviso", "tiltCalibrar"],
       "pantallas": ["pantalla", "tryStart", "startGame", "launch", "capturaPendiente"], "teclado": []}
HEAD = {
    "texto": "// Formato de texto: pad (dos dígitos) y fmt (tiempo m:ss).",
    "estado": "// Estado de la partida: G (modo, tiempos, choque, llegada, tránsito libre), P (la camioneta sobre la ruta: s, u, v, vu, y), keys e inp (entradas), tráfico (trucks, oncs), rocas, OBST (equipos detenidos), la camioneta (pickup) y place() para poner una malla sobre la ruta.",
    "superficie": "// Superficie: domo mirador con letrero y bandera, camiones CAEX, aljibe y camionetas estacionados al final de la ruta (frente al domo se estaciona la camioneta), y el carril solo CAEX (desactivado). Se arma con buildSuperficie() desde main.js, ya lleno el mundo compartido.",
    "trafico": "// Tráfico: CAEX en el mismo sentido (mkSame), tráfico en contra (CAEX, aljibe, camionetas), su movimiento y aparición (stepTrafico), autorización para adelantar (requestAuth, findTarget, nearAuth) y la zona de la superficie con el wheel dozer que cruza empujando una roca (stepDozer).",
    "rocas": "// Rocas: las grandes caídas en la pista (mkRoca), las de la zona de caída de rocas que caen del cerro al acercarte (ROCK_ZIG, updateFallRocks) y las chicas que caen de los camiones cargados (updateRocks); nearestRoca para el aviso del HUD.",
    "libre": "// Tránsito libre por el piso de la fase 7 antes de tomar la Rampa Sur: punto de partida (buscarPartidaLibre), obstáculos (taludes, pilas, equipos) y el portón entre los postes pasacables (stepFree).",
    "llegada": "// Llegada: tramo automático por la superficie hasta el domo (stepArrival) y estacionamiento en reversa entre las camionetas, con cotillón y resultado (parkStep).",
    "reglas": "// Reglas del juego: resetGame arma una partida (tráfico, rocas, aljibe y camino mojado) y step(dt) la simula: tráfico, rocas, salida automática, tránsito libre, la camioneta (velocidad, dirección, piso mojado) y las reglas (pretil, carril CAEX, choques, distancia al CAEX, adelantamientos, pista contraria, meta).",
    "camara": "// Cámara: sigue a la camioneta desde atrás (también en el tránsito libre y en la caída al rajo), con suavizado y sacudida (G.shake).",
    "animacion": "// Animación por cuadro: pose de la camioneta (en la ruta, en el tránsito libre, aplastada, volcada o cayendo al rajo), luces de freno y balizas, camiones y riego del aljibe, equipos de las operaciones y la cámara.",
    "dom": "// Acceso al DOM: $(id) y el mapa el de los elementos del HUD; coarseMq dice si es pantalla táctil (celular).",
    "sonido": "// Sonido: pitidos (beep), motor (startEngine, stopEngine, motorRpm), volumen general con compresor, botón de silencio (SND.muted) y arranque del contexto de audio (audioStart).",
    "avisos": "// Avisos: fichas compactas estilo Waze con voz (renderAlerts, speak), cartel (setBanner), radio (showRadio), cotillón y tarjeta de felicitación en la meta.",
    "hud": "// HUD: velocímetro, metros, tiempo, adelantamientos, botón de autorización, fichas de aviso y pitidos (updateHud), y el radar de la pista (drawRadar).",
    "ranking": "// Registro de cada partida en la hoja de Google (rrSend/rrFlush: cola en localStorage, reintentos, fetch no-cors), código del resultado (showResult), copiar/compartir, y partidas en vivo para los espectadores (liveStart, liveTick).",
    "nombres": "// Nombre del jugador: limpieza (cleanName), normalización (norm) y filtro (nombreValido): nombre y apellido, sin números, animales, emojis ni lo que diga nombres_prohibidos.json.",
    "controles": "// Controles: volante y mando USB (gamepad), volante en pantalla, celular inclinado, pedalera por WebHID y asistente de configuración (cal). pollInput() deja el resultado en inp cada cuadro.",
    "pantallas": "// Pantallas: comienzo con nombre obligatorio (tryStart, launch con cuenta 3-2-1), partida (startGame), fin de partida (terminarPartida, instalada en ganchos.endGame), orientación del celular y captura del choque.",
    "teclado": "// Teclado y botones táctiles: flechas/WASD mueven (keys), 0/espacio pide autorización, R reinicia, Enter empieza; al perder el foco se sueltan las teclas.",
}

DECL = re.compile(r"^(?:export )?(?:async function ([\w$]+)|function ([\w$]+)|const ([\w$]+)|let ([\w$]+))")
def top_names(l):
    m = re.match(r"^(?:export )?(?:const|let) ([\w$]+)", l); out = [m.group(1)]; depth = 0; i = m.end(); q = None
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
        if m.group(1) or m.group(2): out.append(m.group(1) or m.group(2)); continue
        out.extend(top_names(l))
    return out
def sin_comentarios(t): return re.sub(r"/\*.*?\*/", " ", re.sub(r"(^|\s)//.*$", " ", t, flags=re.M), flags=re.S)
def solo_codigo(t):      # sin comentarios, sin el contenido de las cadenas y sin claves de objeto ({ a: 1, b: 2 }): lo que queda son identificadores de verdad
    t = sin_comentarios(t)
    t = re.sub(r"'(?:\\.|[^'\\\n])*'", "''", t); t = re.sub(r'"(?:\\.|[^"\\\n])*"', '""', t); t = re.sub(r"`(?:\\.|[^`\\])*`", "``", t, flags=re.S)
    return re.sub(r"([{,]\s*)[\w$]+\s*:(?!:)", r"\1", t)
IDENT = re.compile(r"(?<![.\w$])([A-Za-z_$][\w$]*)")
IGN = {"superficie": {"scene", "H", "frame", "L", "CAEX_LANE"}, "ranking": {"pretil"}, "pantallas": {"pretil"}, "nombres": {"$"}}      # nombres que aparecen pero no vienen de fuera: destructurados de M o dentro de expresiones regulares
def exports_of(path):
    t = open(ROOT + "/js/" + path, encoding="utf8").read(); out = []
    m = re.search(r"^export \{ ?(.*?) ?\};", t, re.M)
    if m: out += [x.strip() for x in m.group(1).split(",") if x.strip()]
    for l in t.split("\n"):
        if l.startswith("export const") or l.startswith("export let") or l.startswith("export function"):
            out += [top_names(l)[0]] if not l.startswith("export function") else [re.match(r"export function (\w+)", l).group(1)]
            if l.startswith("export const") or l.startswith("export let"): out += top_names(l)[1:]
    return out
for k in ORDEN:      # exportaciones declaradas de verdad
    d = decls(T[k])
    for e in EXP[k]: assert e in d, (k, e, d)
alln = sum(EXP.values(), []); dup = {n for n in alln if alln.count(n) > 1}; assert not dup, dup
TERR = sum((exports_of("terreno/" + f) for f in ["ruta.js", "alturas.js", "fases.js", "camino.js"]), [])
BASE = [("config/diseno.js", exports_of("config/diseno.js")), ("datos/caminos.js", exports_of("datos/caminos.js")), ("datos/fase7.js", exports_of("datos/fase7.js")), ("comun/mates.js", exports_of("comun/mates.js") + ["clamp"]),
        ("comun/pasos.js", ["PASOS", "paso"]), ("modelos/materiales.js", exports_of("modelos/materiales.js")), ("modelos/camiones.js", exports_of("modelos/camiones.js")), ("modelos/palas.js", exports_of("modelos/palas.js")),
        ("modelos/perforadoras.js", exports_of("modelos/perforadoras.js")), ("modelos/dozers.js", exports_of("modelos/dozers.js")), ("escena.js", exports_of("escena.js")), ("terreno/construir.js", TERR),
        ("mundo.js", ["setWorldPose"]), ("operaciones/malla.js", exports_of("operaciones/malla.js")), ("operaciones/carguio.js", exports_of("operaciones/carguio.js")), ("operaciones/cables.js", exports_of("operaciones/cables.js"))]
for p, ns in BASE: assert ns, p
def rel(frm, to):      # ruta relativa desde el archivo frm hacia to (ambos bajo js/)
    r = os.path.relpath(to, os.path.dirname(frm) or ".").replace("\\", "/")
    return r if r.startswith(".") else "./" + r
def imports(frm, text, own, allowed):      # allowed: lista de (ruta, nombres) en orden
    ids = set(IDENT.findall(solo_codigo(text))) - IGN.get(frm.split("/")[-1][:-3], set()); imps = []
    for path, names in allowed:
        need = sorted(n for n in names if n in ids and n not in own)
        if need: imps.append("import { %s } from '%s';" % (", ".join(need), rel(frm, path)))
    if "M" in ids and "M" not in own:
        mu = "import { setWorldPose } from '%s';" % rel(frm, "mundo.js")
        if mu in imps: imps[imps.index(mu)] = "import { mundo as M, setWorldPose } from '%s';" % rel(frm, "mundo.js")
        else: imps.append("import { mundo as M } from '%s';" % rel(frm, "mundo.js"))
    return imps
OUT = {}
for k in ORDEN:
    own = set(decls(T[k])); prev = [(PATH[p], EXP[p]) for p in ORDEN[:ORDEN.index(k)]]
    imps = imports(PATH[k], T[k], own, BASE + prev)
    ids = set(IDENT.findall(solo_codigo(T[k]))) - IGN.get(k, set())
    for later in ORDEN[ORDEN.index(k) + 1:]:
        bad = sorted(n for n in EXP[later] if n in ids and n not in own)
        if bad: print("OJO", k, "usa de un módulo posterior", later, bad)
    OUT[k] = HEAD[k] + "\n" + "\n".join(imps) + "\n\n" + T[k] + "\n" + ("\nexport { " + ", ".join(EXP[k]) + " };\n" if EXP[k] else "")
    print(k, len(OUT[k].split("\n")), "líneas"); [print("   ", i) for i in imps]

# ── main ──
main_body = """
/* ───────────── Mundo: operaciones mineras, cables y superficie (js/operaciones). Aquí solo se llena el mundo compartido y se corren los pasos ───────────── */
Object.assign(M, { scene, H, frame, L, CAEX_LANE, OBST, GD, GX0, GZ0, GNX, GNZ, CELL, PLAT7, PLAT, PITC, F7EQ, RED52, PIT, f7h, PAD_UP });      // lo que las operaciones necesitan del mundo
paso('operaciones: canchas de perforación, palas cargando, dozers y huellas', () => { buildDrills(); buildOps(); });
paso('cables: subestaciones, postes pasacables y SEM 6', () => { buildPowerLine(); buildCable2(); buildSem6(); });
paso('superficie: domo mirador y camiones estacionados', buildSuperficie);
paso('partida libre: punto de salida en el piso de la fase 7', () => { G.FREE0 = buscarPartidaLibre(); });      // necesita los equipos (OBST) y el portón (M.GATE)

/* ───────────── Bucle ───────────── */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; G.tAnim += dt;
  pollInput(); if (cal.open) calTick();
  if (G.mode === 'play' && !pantalla.rotBlocked) step(dt);      // en vertical (celular) el juego queda en pausa
  if (G.mode === 'menu') { P.s = START_S; P.u = START_U0; if (G.FREE0 && G.free) Object.assign(G.free, G.FREE0); }
  if (G.mode === 'play') liveTick(dt);
  updateVisuals(dt); updateHud();
  if (G.mode === 'play') drawRadar();
  renderer.render(scene, camera);
  capturaPendiente();
}
resetGame(); G.camSnap = true;
requestAnimationFrame(loop);
"""
main_head = ("// Rajo Kart 26 — orquestador: llena el mundo compartido, corre los pasos de operaciones, cables y superficie, busca la partida libre y corre el bucle.\n"
             "// El terreno se arma al importar js/terreno/construir.js; el juego está en js/juego (estado, tráfico, rocas, libre, llegada, reglas, cámara, animación) y la interfaz en js/ui (dom, sonido, avisos, hud, ranking, nombres, controles, pantallas, teclado).")
main_imps = imports("main.js", main_body, set(), BASE + [(PATH[p], EXP[p]) for p in ORDEN]) + ["import './ui/teclado.js';      // solo registra los oyentes del teclado y los botones táctiles"]
main_out = main_head + "\n" + "\n".join(main_imps) + "\n" + main_body
print("main", len(main_out.split("\n")), "líneas"); [print("   ", i) for i in main_imps]

W = lambda p, s: open(p, "w", encoding="utf8", newline="\n").write(s)
os.makedirs(ROOT + "/js/juego", exist_ok=True); os.makedirs(ROOT + "/js/ui", exist_ok=True)
for k in ORDEN: W(ROOT + "/js/" + PATH[k], OUT[k])
W(MAIN, main_out)
# clamp a comun/mates.js, L y CAEX_LANE al mundo
mt = open(ROOT + "/js/comun/mates.js", encoding="utf8").read()
mt = edit(mt, "export { hash, sm01, inPoly };", "const clamp = (v, a, b) => Math.max(a, Math.min(b, v));\n\nexport { hash, sm01, inPoly, clamp };")
W(ROOT + "/js/comun/mates.js", mt)
mu = open(ROOT + "/js/mundo.js", encoding="utf8").read()
mu = edit(mu, "  frame: null,       // frame(s): posición, tangente y derecha de la ruta\n", "  frame: null,       // frame(s): posición, tangente y derecha de la ruta\n  L: 0,              // largo de la ruta (m): el portal «SUPERFICIE»\n  CAEX_LANE: null,   // carril solo CAEX: { on, a, b, u }\n")
W(ROOT + "/js/mundo.js", mu)
print("listo")
