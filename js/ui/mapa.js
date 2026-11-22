// Minimapa estilo GTA: terreno real visto desde arriba (sombreado por pendiente y cota), la ruta, los tramos de riesgo, los camiones y la camioneta. Gira con el rumbo (clic: norte arriba), el zoom sube con la velocidad y se ajusta con la rueda.
import { CELL, GCP, GD, GH, GNX, GNZ, GP, GR, GX0, GZ0 } from '../terreno/alturas.js';
import { GEO_ZONES, L, START_S, frame } from '../terreno/ruta.js';
import { WR } from '../config/diseno.js';
import { TAU } from '../config/diseno.js';
import { clamp } from '../comun/mates.js';
import { G, P, oncs, pickup, trucks } from '../juego/estado.js';
import { $ } from './dom.js';

const img = document.createElement('canvas'); img.width = GNX; img.height = GNZ;
{ const c = img.getContext('2d'), d = c.createImageData(GNX, GNZ), px = d.data;
  const via = new Uint8Array(GNX * GNZ); for (let k = 0; k < via.length; k++) via[k] = (GD[k] >= 0 && GD[k] <= WR) || GR[k] === 1 ? 1 : 0;      // GCP: calzada de un camino que cruza un piso (se dibuja blanca; los pisos enteros no)      // calzadas (ruta y caminos interiores)
  const vecino = (i, j, v) => (i > 0 && via[j * GNX + i - 1] === v) || (i < GNX - 1 && via[j * GNX + i + 1] === v) || (j > 0 && via[(j - 1) * GNX + i] === v) || (j < GNZ - 1 && via[(j + 1) * GNX + i] === v);      // terreno: tinte por cota + sombreado desde el noroeste; calzadas claras, pisos grises
  for (let j = 0; j < GNZ; j++) for (let i = 0; i < GNX; i++) {
    const k = j * GNX + i, h = GH[k], gx = GH[j * GNX + Math.min(GNX - 1, i + 1)] - GH[j * GNX + Math.max(0, i - 1)], gz = GH[Math.min(GNZ - 1, j + 1) * GNX + i] - GH[Math.max(0, j - 1) * GNX + i];
    const sh = clamp(0.62 + (-gx - gz) * 0.035, 0.28, 1.15), t = clamp((h + 600) / 700, 0, 1), pit = GP[k] === 1;
    let r = pit ? 150 + 70 * t : 208, g = pit ? 112 + 60 * t : 188, b = pit ? 82 + 45 * t : 150;
    if (GD[k] === -1 && !GCP[k]) { r = 168; g = 160; b = 146; } else if (via[k]) { r = g = b = vecino(i, j, 0) ? 12 : 255; }      // calzada blanca con línea negra en el borde
    else if (vecino(i, j, 1)) { r = g = b = 255; }      // y otra línea blanca por fuera
    const o = k * 4, s = (GD[k] === -1 || via[k] || vecino(i, j, 1)) ? 1 : sh; px[o] = r * s; px[o + 1] = g * s; px[o + 2] = b * s; px[o + 3] = 255;
  }
  c.putImageData(d, 0, 0);
  const pt = s => { const f = frame(s); return [(f.x - GX0) / CELL, (f.z - GZ0) / CELL]; };
  const trazo = (a, b, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = c.lineJoin = 'round'; c.beginPath(); for (let s = a; s <= b; s += 8) { const [x, y] = pt(Math.min(s, b)); s === a ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); };
  trazo(START_S, L, 'rgba(30,20,10,.85)', 6.5); trazo(START_S, L, '#ffc61a', 4);      // la ruta, como la línea del GPS
  for (const z of GEO_ZONES) trazo(Math.max(START_S, z.a), Math.min(L, z.b), '#e5262b', 4);      // tramos de riesgo geotécnico
}

const cv = $('mapa'), cx = cv ? cv.getContext('2d') : null;
let rotar = true, zoom = 1;
if (cv) {
  cv.addEventListener('click', () => { rotar = !rotar; });
  cv.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.5, 3); }, { passive: false });
  cv.title = 'Clic: rotar el mapa o dejar el norte arriba · Rueda: acercar o alejar';
}
const _f = new THREE.Vector3();
function dibujaMapa() {
  if (!cx) return;
  const W = cv.width, R = W / 2, ppm = R / ((250 + P.v * 6) / zoom);      // píxeles por metro: se aleja con la velocidad
  pickup.updateMatrixWorld(); _f.set(0, 0, 1).applyQuaternion(pickup.quaternion); const rum = Math.atan2(_f.x, -_f.z);      // rumbo: 0 = norte
  const ix = (pickup.position.x - GX0) / CELL, iy = (pickup.position.z - GZ0) / CELL, k = ppm * CELL, rot = rotar ? -rum : 0;
  cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, W, W); cx.fillStyle = '#7b6a55'; cx.fillRect(0, 0, W, W);
  cx.save(); cx.beginPath(); cx.arc(R, R, R - 3, 0, TAU); cx.clip();
  cx.translate(R, R); cx.rotate(rot); cx.scale(k, k); cx.translate(-ix, -iy); cx.imageSmoothingEnabled = true; cx.drawImage(img, 0, 0);
  const dot = (m, col, r) => { const x = (m.position.x - GX0) / CELL, y = (m.position.z - GZ0) / CELL; cx.fillStyle = col; cx.strokeStyle = '#1c150d'; cx.lineWidth = 1.2 / k * 1.6; cx.beginPath(); cx.arc(x, y, r / k, 0, TAU); cx.fill(); cx.stroke(); };
  for (const t of trucks) dot(t.mesh, t.auth ? '#35d27a' : '#f7c600', 5);
  for (const o of oncs) dot(o.mesh, o.kind === 'aljibe' ? '#3a8fe8' : (o.kind === 'pickup' ? '#f2f2f2' : '#f7c600'), o.kind === 'pickup' ? 3.5 : 5);
  { const f = frame(L), x = (f.x - GX0) / CELL, y = (f.z - GZ0) / CELL; cx.fillStyle = '#fff'; cx.strokeStyle = '#1c150d'; cx.lineWidth = 0.9; cx.beginPath(); cx.arc(x, y, 7 / k, 0, TAU); cx.fill(); cx.stroke(); cx.fillStyle = '#1c150d'; cx.fillRect(x - 3.5 / k, y - 3.5 / k, 3.5 / k, 3.5 / k); cx.fillRect(x, y, 3.5 / k, 3.5 / k); }      // meta: portal de la superficie
  cx.restore();
  cx.save(); cx.translate(R, R); cx.rotate(rotar ? 0 : rum);      // la camioneta: flecha blanca con borde, siempre al centro
  cx.fillStyle = '#ff2a2a'; cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(0, -15); cx.lineTo(10, 12); cx.lineTo(0, 6); cx.lineTo(-10, 12); cx.closePath(); cx.stroke(); cx.fill(); cx.restore();
  cx.save(); cx.translate(R, R); cx.rotate(rotar ? 0 : 0); const a = rotar ? rum : 0;      // N: marca el norte en el borde del círculo
  cx.rotate(a); cx.fillStyle = '#c9141c'; cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, -(R - 16), 12, 0, TAU); cx.fill(); cx.stroke(); cx.fillStyle = '#fff'; cx.font = '800 15px Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('N', 0, -(R - 15)); cx.restore();
  cv.style.display = G.mode === 'play' || G.mode === 'over' ? '' : 'none';
}
export { dibujaMapa };
