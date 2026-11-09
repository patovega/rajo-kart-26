# Rajo Rojo — contexto del proyecto (para Claude Code)

Juego web de conducción por el rajo de una mina (Sierra Gorda, Chile). Todo el texto va en **español de Chile**. Es para una competencia puntual en la empresa: cada partida, ganada o perdida, se registra y alimenta un ranking en vivo.

## Archivos
- `index.html` — el juego completo (un solo archivo, ~125 KB, sin build). Three.js r128 local (`three.min.js`), JS plano en un `<script>` grande.
- `ranking.html` — ranking en vivo (lee la hoja de Google; `?tv=1` = pantalla grande).
- `config.js` — `window.RR_CONFIG`: `endpoint` (URL `/exec` del Apps Script), `token`, `refrescarCadaSeg`.
- `Code.gs` — Google Apps Script: `doPost` guarda una fila por partida (dedup por `id`, valida y sanea el nombre), `doGet?action=list[&callback=]` entrega la lista (JSON o JSONP). Menú «Rajo Rojo > Empezar un evento nuevo».
- `pruebas/` — pruebas hechas con Playwright (Python) y Node; las rutas son de `/tmp`, hay que ajustarlas.
- `LEEME.md` — pasos para publicar (hoja + script + GitHub Pages).

## Cómo está armado `index.html`
Orden aproximado del script: geometría del rajo → terreno (malla de alturas) → camino/berma/postes → vehículos (CAEX Komatsu 930E amarillos, aljibe único, camionetas rojas doble cabina) → explanada con pala de cable → cartel y zona de rocas en zigzag → estado del juego → `step(dt)` (reglas) → HUD/avisos → entradas (teclado, táctil, volante/mando, WebHID) → bucle.
- Rajo: elipse (`PA=340, PB=230`), 3 tramos y 2 curvas en U; el camino sube con pendiente constante (`hr(s)`), cota del borde `YTOP=80`, bancos de `BENCH=10`. `H(x,z)` lee una malla de alturas. `frame(s)` da posición/tangente/derecha; `u>0` = derecha.
- Pista: carriles en `±LANE (6.5)`, se circula por la **izquierda**, pretiles en `±12.7`, choque en `|u|>CRASH_U (10.9)`. Si el terreno de ese lado cae al rajo → caída y rodado; si no → vuelco de lado.
- Ruta: `START_S` (antes de la curva en U previa a la pala) hasta `L` (portal «SUPERFICIE»), luego tramo automático hasta `END_S = L+205` (domo mirador + camiones estacionados). El tiempo corre hasta frenar frente al domo.
- Velocidad: crucero 50 km/h, hasta 80 con ↑/pedal; alarma sobre 60 (no es derrota). Distancia mínima al CAEX de adelante `FOLLOW_DIST=20` m (no aplica con autorización). Autorizar: tecla `0`/espacio, botón o botón del volante; el CAEX frena de a poco y arranca cuando lo pasas.
- Obstáculos: rocas en la pista (esquivar, cuidado con el pretil izquierdo), zona de caída de rocas a mitad de ruta (`ZONE_S`, 3 rocas en zigzag), piso mojado donde pasa el aljibe (menos agarre, derrapes), tráfico en contra (CAEX, aljibe uno a la vez, camionetas), aplastamiento si te pasa por encima un camión.
- Avisos estilo Waze: fichas compactas + voz (`speechSynthesis`); en celular horizontal el HUD es compacto.
- Entradas: en celular (`pointer:coarse`) **solo volante en pantalla** (el modo de inclinar el celular sigue en el código pero está oculto); en computador teclado, mando/volante USB con asistente de configuración (varios dispositivos a la vez; ejes y botones analógicos), y WebHID para pedalera USB (solo funciona en página `https` de nivel superior, p. ej. GitHub Pages).
- Nombre obligatorio al comenzar. Al terminar: código `[RR1:id|nombre|D o P|tiempo|metros|motivo]` (`showResult`), envío con `rrSend/rrFlush` (cola en `localStorage`, reintentos, `fetch` `no-cors` con `text/plain`).

## Variante en Claude (artefacto)
Existe `rajo-rojo.html` (mismo juego en un archivo, Three desde cdnjs, ranking como otro artefacto donde el organizador pega los códigos). Esa variante NO puede enviar datos a otros sitios ni usar WebHID dentro del marco de Claude; por eso este paquete es la versión para GitHub Pages. Enlaces vigentes en claude.ai: juego `https://claude.ai/artifact/D4sEVwpmTXgm2UdY5tJdpj`, ranking `https://claude.ai/artifact/7PnVxFTNVYNVySueuGZCmj`.

## Pruebas (sin hardware real)
Playwright headless con `--use-gl=angle --use-angle=swiftshader`. Para probar, copiar `index.html` y sustituir `resetGame(); camSnap = true;` por una línea que exponga `window.__d = {...}` y acelerar el bucle repitiendo `step(dt)`. Con `pruebas/mock_apps_script.py` (imita al script de Google) se probó: envío, reintento sin conexión, no duplicar, ranking en vivo, plan B JSONP, «sin conexión», modo `?tv=1`.

## Pendiente / sin verificar
- Desplegar de verdad: hoja de Google + Apps Script + GitHub Pages, y probar desde un celular en la red de la empresa (¿bloquean `script.google.com` o GitHub?).
- Volante y pedalera reales (solo se probaron dispositivos simulados), sensación del volante en pantalla con el pulgar, sonido (volumen general ×3,2 con compresor).
- Duración real con tráfico y adelantamientos (sin tráfico: ~1:25 a 40–50 km/h; objetivo: máximo ~2 min).
- Ideas sugeridas: límite de intentos por persona, QR de acceso, botón para vaciar ranking desde el propio ranking.
