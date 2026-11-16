// Pasos de armado del mundo: paso('nombre', fn) ejecuta fn y anota nombre y tiempo (ms) en PASOS, en orden. Es la lista de qué se ejecuta y cuánto cuesta (window.__d.PASOS en el arnés).
export const PASOS = [];      // pasos de armado del mundo, en orden y con su tiempo (ms): para saber qué se ejecuta y cuánto cuesta
export function paso(nombre, fn) { const t0 = performance.now(); fn(); PASOS.push([nombre, Math.round(performance.now() - t0)]); }
