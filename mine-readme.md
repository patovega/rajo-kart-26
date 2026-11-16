# Rajo Kart 26 — criterios de diseño de la mina

Este documento explica **cómo está hecho el rajo del juego y por qué**: qué dice la literatura de minería a cielo abierto para cada parámetro, qué valor usa el juego y qué efecto tiene. Sirve para revisar el terreno con ojo minero y para saber qué tocar (y qué no) cuando se cambia algo en `index.html` o en los scripts de `pruebas/terreno/`.

El modelo es un rajo minero estándar de un pórfido cuprífero (gran tonelaje, CAEX de 300 t y palas eléctricas): elipse de ~700 × 460 m en la superficie, superficie a +176 m, fase 7 a −80 m y fondo a −235 m (411 m de profundidad total). Los caminos interiores se trazaron desde la foto satelital de Maps (surponiente) y desde fotos aéreas (nororiente); sus cotas las calcula el solver `lp.py` (programación lineal) para cumplir pendiente máxima, bajadas sin contrapendientes y paredes factibles entre caminos vecinos.

## Tabla resumen

| Tema | Literatura | Valor en el juego | Descripción |
|---|---|---|---|
| Altura de banco | 15–16 m en rajos chilenos de gran tonelaje (palas de 60–100 t de balde, altura de corte ~15–16 m de una P&H 4100 o PC9000). Hustrulid & Kuchta, *Open Pit Mine Planning & Design*. | `BENCH = 16` m en todo el rajo | Los bancos llevan la cota de múltiplos de 16 m desde el fondo (−235). Un banco más alto que la pala no se puede cargar con seguridad. |
| Cara del banco | 65–75° en roca competente tras tronadura (Hustrulid; Read & Stacey, *Guidelines for Open Pit Slope Design*). | ~70° (5,8 m en horizontal) | Donde la pared general es más empinada que el estándar, la cara se para hasta casi vertical para que igual quede berma. |
| Berma (ancho) | Criterio de Ritchie: `W = 0,2·H + 4,5 m` → 7,7 m para 16 m; Call recomienda ≥ 7 m para bancos de 15 m. | 8 m general; **6 m** bajo rosado/naranjo, entre celeste y fase 7 y en las 3 primeras curvas en U de la azul (`BW`) | La berma atrapa derrames y rodados. Los 6 m fueron decisión del usuario para esas zonas (quedan bajo Ritchie; en la mina real suele ir con doble banqueo). |
| Berma pareja (no ancha) | La berma es un ancho de diseño fijo; el ángulo interrampa se logra inclinando la cara, no ensanchando la berma. | `a = 1 − BW·pendiente/BENCH` (cara más parada donde la pared es tendida) | Antes las paredes tendidas mostraban bermas de 20–40 m; ahora son parejas (8 ó 6 m) y la cara absorbe la diferencia. |
| Ángulo interrampa / pared entre caminos | 40–55° en roca buena; entre dos rampas vecinas la pared no debe superar el interrampa de diseño. | ≤ ~48° general; entre caminos vecinos ≤ 1,6 (≈58°) sólo donde ya estaban apretados (`lp.py`, `SLOPE`) | `redis.py` lista los cruces apretados. Los tramos muy juntos vienen del trazo real (p. ej. inicio del zigzag contra su tramo de abajo, 40 m). |
| Curvas de bancos | En un rajo las curvas se forman con **tramos rectos** (se dobla por quiebres, no por arcos), como se ve en Maps. | Fase 7 norte: bancos facetados por líneas de quiebre; isla de la celeste: caminos simplificados con Douglas–Peucker (10 m) | Pendiente aplicar el mismo patrón en todas las curvas del rajo. |
| Isla de bancos celeste–fase 7 | La pared entre una rampa y el piso de la fase es la superficie más baja que sube con la pendiente de banco desde el camino («cono mínimo»), topada por el piso. | Pendiente 1,36 (16 m: cara 5,8 m + berma 6 m); lo que llega a −80 pasa a ser piso de la fase 7 | En Maps esa isla muestra ~9 bancos (≈140 m de desnivel); en el juego caben 4–6 porque la fase 7 está sólo 72–93 m sobre la celeste. |
| Ancho de camino (calzada) | 3–3,5 veces el ancho del camión más grande para dos pistas (Thompson, *Mine Haul Road Design*; Kaufman & Ault, USBM). Komatsu 930E: 9,1 m → 32 m + pretil. | 38 m (`WR = 19`, media calzada) | Dos CAEX cruzándose con espacio entre ellos. Las rampas de canchas (perforadoras y camionetas) son de 18 m. |
| Pendiente de rampas | 8–10 % máximo sostenido para CAEX (Thompson; práctica chilena 10 %). | ≤ 10,4 % (`GR = 0.104` en `lp.py`); ruta del jugador con pendiente constante | Se dejó 10,4 % porque el rosado subía exactamente al 10 % y la restricción no cerraba por 20 cm. Varios caminos quedaron en 11–13 % en tramos cortos (pendiente de revisar). |
| Bajadas sin contrapendiente | Un camino que baja no debe tener subidas intermedias (frenos y consumo). | Pendiente mínima por camino (`GMIN`: celeste 2 %, zigzag 0,8 %) | `prof.py` comprueba que no haya subidas al bajar en ningún camino. |
| Pretil de seguridad en caminos | ≥ ½ (ideal ⅔) del diámetro del neumático del equipo mayor; 930E: neumático ~4 m → pretil 2–2,7 m (DS 132, Art. 332; Thompson). | Pretil a ±17,2 m del eje (`PRET`); choque al pasarlo (`CRASH_U`) | Si el terreno del lado cae al rajo → caída y rodado; si no → vuelco de lado. |
| Circulación por la izquierda | Práctica chilena en rajos: se circula por la **izquierda** para que el operador del CAEX vea mejor el borde del camino y los cruces. | Carriles en ±8,6 m (`LANE`), mano izquierda | El juego penaliza invadir el carril contrario. |
| Velocidad | Límites típicos en rajo: 40–50 km/h cargado, 50–60 vacío; alarmas sobre 60. | Crucero 50 km/h, máximo 80, alarma sobre 60 | La alarma no es derrota. |
| Distancia de seguimiento | Tres largos de camión o ≥ 50 m en bajada según la mina; nunca menos de 20 m. | `FOLLOW_DIST = 20` m al CAEX de adelante | Con autorización de adelantamiento no aplica. |
| Patios de empalme | En cada cruce de rampas se deja un plano a la cota del cruce (visibilidad y maniobra). | Discos planos de 50–55 m de radio (`PATIOS`); 35 m en la SEM | `lp.py` iguala las cotas de los caminos que se juntan (≤ 45 m) y escribe los patios. |
| Curvas en U (switchbacks) | Radio interior mínimo según el camión (930E: ~15 m) y super-elevación; se ensancha la calzada en la curva. | 8 curvas en U en la azul (zigzag), trazadas desde Maps a 0,75 m/px | La escala se midió con los CAEX de la foto (≈20 px = 15,6 m). |
| Subestación SEM | Las palas eléctricas se alimentan a 7,2 kV por cable de arrastre desde subestaciones móviles (SEM, «skid») cerca del frente. | SEM 6: dos contenedores unidos en un patio junto a la 3.ª curva en U de la azul, a la cota de la curva | `buildSem6()`; `lp.py` le pone la cota. |
| Fase 7 | Una fase es un piso de explotación propio, con sus palas, canchas y entrada por rampa. | Piso plano a −80 m; entrada desde la curva en U de la azul (`entrada_f7`) y salida por el camino rojo (portón a la ruta) | El solver la dejó plana (antes bajaba de −46 a −80). |
| Cancha de perforación (altura) | La cancha es la cresta del banco que se va a tronar: un banco sobre el piso donde cargan las palas. | `PAD_UP = BENCH` (16 m), cara de 6 m (~69°) | Antes era de 15 m con cara de 7 m (65°). |
| Pretil en la cresta de la cancha | Obligatorio en plataformas donde trabajan equipos (DS 132); en canchas 1–1,5 m (perforadoras y camionetas). | Lomo de 1,6 m de alto y 3 m de ancho en todo el borde (`pretil(d)`) | La rampa de acceso lo corta en su boca. |
| Rampa de acceso a la cancha | ≤ 12 % para equipos sobre neumáticos; hasta 15 % para orugas. | ≤ 12 %, 18 m de ancho, buscada automáticamente sobre piso libre | En la fase 7 además evita el pasillo de la ruta del jugador (`nearRoute`). |
| Malla de perforación | Pozos de 10⅝–12¼" (270–311 mm) en banco de 16 m: burden `B ≈ 25–35·Ø` → 8 m; espaciamiento `S ≈ 1,15·B` → 9,2 m; **tresbolillo** (Konya & Walter, *Rock Blasting and Overbreak Control*; ISEE *Blasters' Handbook*; Hustrulid, *Blasting Principles for Open Pit Mining*). | 8 × 9,2 m tresbolillo en fase 7 y fondo | Antes 9 × 9 cuadrada escalonada (y 12 × 12 en el fondo por la escala 1,5). |
| Orientación de las filas | Filas paralelas a la cara libre (o al eje largo de la cancha). | Eje principal del polígono de la cancha (PCA) | Antes iban según el eje x del mundo. |
| Primera fila | A un burden de la cresta (≈ 8 m); nunca pozos sobre el pretil. | 8 m de la cresta | Antes 5 m. |
| Pasadura (subdrill) | 0,3·B ≈ 2–2,5 m bajo la cota del piso. | (no se modela) | El pozo se ve como boca negra con su cono de detritus de ~2,6 m de diámetro. |
| Tamaño de la tronadura | 150–300 pozos por disparo (50–150 kt), ~100 × 80 m. | Toda el área roja del dibujo lleva pozos (cientos) | Pendiente si se quiere: perforar sólo el bloque junto a la cara libre y dejar el resto nivelado. |
| Pila tronada (altura) | Esponjamiento 30–50 %; en tronadura amortiguada la pila queda a la altura del banco + 1–3 m de levante; la pala no debe cavar más alto que su altura de corte. | Banco + 1 m (17 m sobre el piso) | `BLUE52` en la fase 7; `pileTerrain` en el fondo (16 m). |
| Talud de la pila | Ángulo de reposo de roca tronada 35–40°. | 37° (0,75) | Igual en fase 7 y fondo. |
| Frente de carguío (bahía) | La pala cava una bahía cóncava en la pila; el frente queda más parado que el reposo mientras se carga. | Bahía de 18 m de radio por pala de cables (14 m la PC9000), con el piso a la cota del banco | `BAYS` en el bloque de pilas; el fondo ya la tenía (`dig`). |
| Carguío | Carguío a dos lados con giro de 90° (menor tiempo de aculatamiento); el camión se cuadra de cola al banco. | Dos puestos por pala (`SPOT_AL`), camiones alternando | Un camión carga mientras el otro llega y se cuadra. |
| Distancia pala–frente | La pala se ubica al pie de la pila, a una distancia que le permita cargar con el balde dentro del alcance (~20 m). | 13 m del pie de la pila (9 m la PC9000) (`faceSpot`) | |
| Paredes sin berma | Ninguna pared debería bajar más de un banco sin berma (control de rodados). | Revisión final: donde una pared cae > ~20 m seguidos se recorta y se rellena al pie | Cubre cortes de caminos, rellenos y bordes de canchas. |
| Zona de caída de rocas | Las zonas de riesgo de rodados se señalizan y se pasa sin detenerse. | `ZONE_S` a mitad de ruta, 3 rocas en zigzag | Obstáculo del juego, con aviso. |
| Piso mojado | El riego de caminos (aljibe) reduce polvo pero baja el agarre. | Aljibe único; derrapes en su huella | Obstáculo del juego. |

## Cómo se calculan las cotas (resumen)

1. Trazas en planta: `trace59.py` sigue el trazo dibujado sobre la foto de Maps; `build59.py` lo lleva al mundo (0,75 m/px, anclado en el empalme azul/azul1 en (−380, −700)).
2. `lp.py` resuelve las cotas de todos los puntos de `SEC`, más `FLOOR` y `F7HN`, minimizando el fondo y la fase 7 con: pendiente ≤ 10,4 %, sin contrapendientes (pendiente mínima por camino), empalmes a igual cota, pared entre caminos vecinos ≤ 1,6, extremos amarrados a la fase 7. Luego suaviza los perfiles.
3. `empalmes.py` agrega enlaces y patios; `mapa.py` dibuja caminos y cotas sobre la foto aérea (`imagenes/mapa_caminos.png`).
4. En `index.html` el terreno se arma con una membrana entre celdas fijas (caminos, pisos, superficie), se cuantiza en bancos de 16 m con berma `BW`, y después vienen los bloques especiales: pared norte de la fase 7 (facetada), isla celeste–fase 7 (cono mínimo), canchas, pilas, patios y revisión final.

## Fuentes

- Hustrulid, W. & Kuchta, M., *Open Pit Mine Planning & Design* (bancos, bermas, rampas, ángulos).
- Read, J. & Stacey, P., *Guidelines for Open Pit Slope Design* (CSIRO, 2009): caras de banco, interrampa, criterio de Ritchie/Call para bermas.
- Thompson, R., *Mine Haul Road Design and Management*; Kaufman & Ault, *Design of Surface Mine Haulage Roads* (USBM IC 8758): ancho de calzada, pendiente, pretiles.
- Konya, C. & Walter, E., *Rock Blasting and Overbreak Control*; ISEE, *Blasters' Handbook*; Hustrulid, *Blasting Principles for Open Pit Mining*: burden, espaciamiento, tresbolillo, pasadura, pilas.
- Decreto Supremo 132 (Reglamento de Seguridad Minera, Chile): pretiles, plataformas de trabajo, circulación.
- Fotos satelitales y aéreas de un rajo real aportadas por el usuario (trazas, empalmes, SEM, canchas y frentes).

## Pendiente / sin verificar

- Pendientes de 11–13 % en tramos cortos de azul1, rosado_ext, rosado, azul2, verde y zigzag (objetivo ≤ 10,4 %).
- Fase 7 plana a −80 (si se quiere con pendiente, fijar `F7HN` a mano).
- Curvas con tramos rectos en todo el rajo (hoy sólo fase 7 norte e isla celeste).
- Perforar sólo un bloque de tronadura por cancha; tubos de iniciación entre pozos.
- Isla celeste–fase 7 con 8–9 bancos requeriría subir la fase 7 unos 40–50 m.
