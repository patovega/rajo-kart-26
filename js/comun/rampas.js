// Rampas con nombre (caminos interiores principales del rajo): cada una es uno o más tramos de CAMINOS_DWG, reconocidos por un punto de su eje
// (así no dependen del orden en que el exportador escribe los caminos). Las usan el minimapa (color) y las motoniveladoras (una por rampa).
import { CAMINOS_DWG } from '../datos/terreno_dwg.js';

const DEF = [
  { nombre: 'azul', color: '#2f7fe0', pts: [[-347, -144]] },      // de la celeste (1237) al fondo
  { nombre: 'celeste', color: '#6fd3f5', pts: [[260, 144]] },      // por la orilla poniente de la fase 7
  { nombre: 'verde', color: '#33c24d', pts: [[-224, -652], [-520, -420], [-667, -201], [-252, -496], [219, -428]] },      // del 1469 por el poniente hasta la azul (1237)
  { nombre: 'rojo', color: '#d62828', pts: [[501, -661]] },      // bajada norte (1423 → explanada de 1296)
  { nombre: 'naranja', color: '#ff8a1f', pts: [[739, -156]] },      // camino de 1296 al oriente de la fase 7
  { nombre: 'rosado', color: '#ff5fa2', pts: [[672, 72]] },      // del 1296 a la explanada de la malla (1279)
];
const RAMPAS = DEF.map(R => ({ nombre: R.nombre, color: R.color, caminos: R.pts.map(([x, z]) => {
  let best = -1, bd = 25; CAMINOS_DWG.forEach((C, k) => { for (const p of C) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = k; } } }); return best; }).filter(k => k >= 0) }));

export { RAMPAS };
