# Lectura del plano GEO-SG-716 (DWG) — scripts

El DWG (`plano/GEO-SG-716_Rajo_Catabela.dwg`, AutoCAD 2013, 128 MB; la carpeta `plano/` está en `.gitignore`) se convierte a DXF con ODA File Converter
(`"C:\Program Files\ODA\ODAFileConverter 27.10.0\ODAFileConverter.exe" plano plano\derivados ACAD2013 DXF 0 1 "*.dwg"`, ~450 MB) y se lee con `ezdxf`.
Los scripts escriben en `plano/derivados/` (también ignorada). Orden: `dxf_info.py` → `dxf_info2.py` → `dxf_papel.py` (genera `papel.json`) → `dxf_riesgos.py`
(genera `riesgos.json` y `plano_riesgos.png`) → `fit2.py` (calce juego→UTM: `fit.json`, `calce2.png`, `informe_calce.json`). `dxf_plot.py` dibuja las capas del modelo.

- Modelo (UTM 19S, metros, cotas reales 1090–1830): `26-11-15_BORDE` / `26-11-15_PATA` (crestas y patas de los bancos, polilíneas 3D), `26-11-15_CAMINOS_LEVANTADOS`
  (caminos levantados, 3D), `C_A_CAMIONADAS_A_PISO`, `Pretiles Seguridad y zonas` (zonas de riesgo: polilíneas cerradas color 8; hatch ANSI31), `Pretiles Seguridad`
  (pretiles de contención, color 36), `Cuñas_actualizadas_170520` (cuñas, hatch sólido 114), `GRILLA`.
- Layout `PIT_SGSCM` (espacio papel): simbología, radares (textos «RADAR XT 352/742/825/970», «RADAR FX 360/687»), estaciones totales Leica 01/02, círculos numerados
  1–4 (tipo de riesgo: 1 cuña, 2 volcamiento, 3 deslizamiento plano, 4 derrames) y las condiciones geotécnicas del período. Papel → modelo: `modelo = objetivo + centro_vista + (papel − centro_viewport) × (alto_vista / alto_viewport)` con el viewport id 2 (escala 5).

## Reconstrucción del rajo con el plano (terreno real en el juego)
- `terreno_dwg.py <dxf> [celda]`: TIN (Delaunay) de los vértices 3D de crestas, patas y caminos levantados → grilla `terreno_dwg.npz` (4 m, E 164000–166800, N 4469900–4472500) y `terreno_dwg.png` (sombreado + curvas). Con `vista` como tercer argumento solo redibuja.
- `ruta_dwg.py [E N] [E N]`: camino conducible más corto sobre la grilla (Dijkstra, pendiente ≤ 12 %, castigo cerca de caras de banco) desde el punto dado (piso de la fase 7, 165960 4471430) hasta la superficie (cota ≥ 1700) → `ruta_dwg.json` y `ruta_dwg.png`; perfil de cota suavizado con pendiente ≤ 11 %.
- `exporta_dwg.py`: escribe `js/datos/terreno_dwg.bin` y `js/datos/terreno_dwg.js` (grilla, ruta, piso de la fase 7 = celdas planas conectadas al inicio + plano ajustado, zonas, cuñas, pretiles, radares, estaciones, `GEO_ZONES_DWG`) y `partida_dwg.png`.
- Pruebas (Playwright, copian el sitio con `mk.py` al scratchpad y lo sirven en 8001): `dwg_vista.py` (tiempos de armado, datos de la ruta y capturas en varios `s`), `dwg_partida.py` (partida completa en modo prueba hasta el domo y partida con tráfico con un piloto automático simple).
- `exporta_dwg.py` además: marca «dentro del rajo» (relleno de depresiones por inundación desde el borde; bit 15 de `terreno_dwg.bin`) y exporta `PISOS_DWG` (pisos planos de ≥ 0,8 ha dentro del rajo, con eje largo, polígono y hasta 3 frentes de carguío: puntos a 14–18 m de una pared que sube ≥ 6 m, a ≥ 70 m de la ruta; `f7`, `fondo` y `cancha`). `dwg_equipos.py` captura cada equipo reubicado (palas, PC9000, canchas, SEM 6, portón, partida) con la cámara libre.
