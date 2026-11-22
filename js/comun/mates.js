// Funciones matemáticas chicas sin dependencias: hash determinista (ruido), suavizado y punto en polígono.

function hash(a, b) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
const sm01 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

function inPoly(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }      // punto dentro de un polígono [[x, z], ...]

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function sdPoly(P) {      // distancia con signo al borde de un polígono [[x, z]…] (negativa adentro); f.bb = caja, f.P = polígono
  const xs = P.map(p => p[0]), zs = P.map(p => p[1]);
  const f = (x, z) => { let m = 1e9; for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length], vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1))); m = Math.min(m, Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t)); } return inPoly(x, z, P) ? -m : m; };
  f.bb = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; f.P = P; return f;
}
export { hash, sm01, inPoly, clamp, sdPoly };
