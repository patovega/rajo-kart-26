# Rajo Kart 26 en GitHub Pages con registro en tu Drive

Cada partida (ganada o perdida) queda como una fila en una Hoja de Google, y `ranking.html` la muestra en vivo.

## Qué hay en esta carpeta
| Archivo | Para qué sirve |
|---|---|
| `index.html` | El juego |
| `ranking.html` | El ranking en vivo (`ranking.html?tv=1` = pantalla grande para proyector) |
| `config.js` | **Lo único que editas**: la URL del script de Google |
| `Code.gs` | El script que se pega en Google (recibe los resultados y entrega la lista) |
| `three.min.js` | Motor 3D (va incluido para no depender de otro sitio) |

## Paso 1 · La hoja y el script (≈ 5 min)
1. En tu Drive: **Nuevo > Hojas de cálculo de Google**. Ponle un nombre, por ejemplo «Rajo Kart 26 resultados».
2. En esa hoja: **Extensiones > Apps Script**.
3. Borra el código que aparece, pega **todo** el contenido de `Code.gs` y guarda (ícono del disquete).
4. **Implementar > Nueva implementación > ⚙ > Aplicación web**
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier persona**
   - Toca **Implementar**.
5. Google pide permisos: **Autorizar acceso** → elige tu cuenta → si dice «Google no verificó esta aplicación», toca **Configuración avanzada > Ir a (nombre del proyecto)** y acepta. Es tu propio script.
6. Copia la **URL de la aplicación web** (termina en `/exec`).

Si cambias algo en `Code.gs` más adelante: **Implementar > Administrar implementaciones > ✏ > Versión: Nueva versión > Implementar**. La URL no cambia.

## Paso 2 · Pegar la URL
Abre `config.js` y pega la URL entre las comillas de `endpoint`:
```js
endpoint: 'https://script.google.com/macros/s/XXXXXXXX/exec',
```

## Paso 3 · Subir a GitHub Pages
1. En github.com: **New repository** (por ejemplo `rajo-kart-26`), público.
2. **Add file > Upload files**: sube todos los archivos de esta carpeta (incluido `three.min.js`) y confirma (**Commit**).
3. **Settings > Pages > Build and deployment**: *Deploy from a branch*, rama `main`, carpeta `/ (root)`. Guarda.
4. En 1 o 2 minutos queda en `https://TU-USUARIO.github.io/rajo-kart-26/` (el juego) y `.../ranking.html` (el ranking).

## Paso 4 · Probar ANTES del evento (importante)
1. Abre el juego **desde un celular conectado a la red de la empresa**, escribe un nombre y pierde a propósito.
2. Revisa que aparezca una fila nueva en la pestaña **Resultados** de tu hoja, y que salga en `ranking.html`.
3. Si no aparece: revisa que `config.js` tenga la URL completa, que el script esté implementado con acceso «Cualquier persona», y que la red no bloquee `script.google.com`.
4. Cuando cambies `config.js` en GitHub, los navegadores pueden guardar la versión anterior unos minutos: recarga con Ctrl+F5.

## Para el día del evento
- **Vaciar el ranking antes de empezar:** en la hoja, menú **Rajo Kart 26 > Empezar un evento nuevo**. Guarda una copia de lo anterior en otra pestaña y deja la lista en cero.
- **Proyector:** abre `ranking.html?tv=1` a pantalla completa. Se actualiza sola cada pocos segundos.
- **Reparte** la dirección del juego (o un código QR de ella).
- Cada fila guarda: fecha y hora, nombre, LLEGÓ/PERDIÓ, tiempo, metros, motivo y dispositivo. El botón **CSV** del ranking baja todo como archivo.

## Cosas a tener presentes
- La URL del script es pública: alguien con conocimientos podría mandar resultados falsos. Para una competencia entre colegas no debería importar; no sirve para premios de valor.
- Los nombres quedan guardados en tu Drive.
- Si un jugador pierde la conexión, el juego guarda el resultado en su celular y lo envía solo cuando vuelve. El script ignora repetidos.
- Opcional: pon una clave en `TOKEN` (`Code.gs`) y la misma en `token` (`config.js`) para filtrar envíos al azar.
