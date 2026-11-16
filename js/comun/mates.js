// Funciones matemáticas chicas sin dependencias: hash determinista (ruido) y suavizado.

function hash(a, b) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
const sm01 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export { hash, sm01 };
