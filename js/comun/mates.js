// Funciones matemáticas chicas sin dependencias: hash determinista (ruido), suavizado y punto en polígono.

function hash(a, b) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
const sm01 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

function inPoly(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }      // punto dentro de un polígono [[x, z], ...]

export { hash, sm01, inPoly };
