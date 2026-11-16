// Camino de tierra: calzada con tramos mojados por el aljibe (seedWet, updateRoad, slickNow), de qué lado hay caída (isDrop, inGap), pretiles, postes delineadores, postes del portal con banderas y señalética de distancia.
import { PRET, WR } from '../config/diseno.js';
import { hash } from '../comun/mates.js';
import { bas, box, cyl, lam } from '../modelos/materiales.js';
import { paso } from '../comun/pasos.js';
import { L, PLAT, SMAX, SMIN, START_S, ZONE_S, frame, hrAt } from './ruta.js';
import { H } from './alturas.js';
import { scene } from '../escena.js';

/* Camino de tierra: tramos humectados donde pasó el aljibe, bermas, postes */
const RSTEP = 1.5, WET_T = 80;
const ROAD_U = [-12.1, -8.4, -7.2, -5.8, -4.6, 4.6, 5.8, 7.2, 8.4, 12.1];
const ROAD_TRACK = [0, 1, 0, 1, 0, 1, 0, 1, 0];      // 1 = huella de neumáticos
const ROAD_NC = ROAD_U.length - 1;
const NB = Math.floor((SMAX - SMIN) / RSTEP) - 1;
const wet = new Float32Array(NB), wetDirty = new Uint8Array(NB), roadNoise = new Float32Array(NB * ROAD_NC);
const binOf = s => Math.max(0, Math.min(NB - 1, Math.floor((s - SMIN) / RSTEP)));
const dryC = [new THREE.Color(0x85704f), new THREE.Color(0x6e5a40)];
const wetC = [new THREE.Color(0x3b2c1b), new THREE.Color(0x30230f)];
const _rc = new THREE.Color();
let roadMesh, roadCol;
paso('camino: malla de la calzada', () => {
  const nq = NB * ROAD_NC, pos = new Float32Array(nq * 12), nm = new Float32Array(nq * 12), idx = new Uint32Array(nq * 6);
  roadCol = new Float32Array(nq * 12);
  for (let i = 0; i < NB; i++) {
    const sA = SMIN + i * RSTEP, f1 = frame(sA), f2 = frame(sA + RSTEP);
    for (let c = 0; c < ROAD_NC; c++) {
      const q = i * ROAD_NC + c, o = q * 12, u0 = ROAD_U[c], u1 = ROAD_U[c + 1];
      const pts = [[f1, u0], [f1, u1], [f2, u1], [f2, u0]];
      for (let k = 0; k < 4; k++) {
        const f = pts[k][0], u = pts[k][1], x = f.x + f.rx * u, z = f.z + f.rz * u;
        pos[o + k * 3] = x; pos[o + k * 3 + 1] = H(x, z) + 0.12; pos[o + k * 3 + 2] = z; nm[o + k * 3 + 1] = 1;
      }
      const v = q * 4, t = q * 6; idx[t] = v; idx[t + 1] = v + 1; idx[t + 2] = v + 2; idx[t + 3] = v; idx[t + 4] = v + 2; idx[t + 5] = v + 3;
      roadNoise[q] = 0.93 + 0.14 * hash(i, c + 7);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(roadCol, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
  roadMesh = new THREE.Mesh(g, m); scene.add(roadMesh);
});
function paintBin(i) {
  const w = Math.min(1, wet[i] * 1.4);
  for (let c = 0; c < ROAD_NC; c++) {
    const tr = ROAD_TRACK[c], q = i * ROAD_NC + c, o = q * 12;
    _rc.copy(dryC[tr]).lerp(wetC[tr], w).multiplyScalar(1 + (roadNoise[q] - 1) * (1 - 0.5 * w));
    for (let k = 0; k < 4; k++) { roadCol[o + k * 3] = _rc.r; roadCol[o + k * 3 + 1] = _rc.g; roadCol[o + k * 3 + 2] = _rc.b; }
  }
}
for (let i = 0; i < NB; i++) paintBin(i);
function slickNow(s) { return Math.min(1, wet[binOf(s)] * 1.6); }      // 0 = piso seco, 1 = recién regado
function wetRange(sa, sb) { for (let k = binOf(Math.min(sa, sb)); k <= binOf(Math.max(sa, sb)); k++) wet[k] = 1; }
function seedWet(sFrom, v, cyc) {       // el aljibe bajó regando 10 s sí / 10 s no: tramos mojados y secos alternados
  wet.fill(0);
  for (let i = 0; i < NB; i++) {
    const d = SMIN + i * RSTEP - sFrom; if (d <= 0) continue;
    const age = d / v, ph = (((cyc - age) % 20) + 20) % 20;
    if (ph < 10) wet[i] = Math.max(0, 1 - age / WET_T);
    wetDirty[i] = 1;
  }
}
function updateRoad(dt) {
  let changed = false;
  for (let i = 0; i < NB; i++) {
    const was = wet[i] > 0;
    if (was) wet[i] = Math.max(0, wet[i] - dt / WET_T);
    if (was || wetDirty[i]) { paintBin(i); wetDirty[i] = 0; changed = true; }
  }
  if (changed) roadMesh.geometry.attributes.color.needsUpdate = true;
}

const GAP = PLAT ? { a: PLAT.se + 15, b: PLAT.se + 78, side: PLAT.side } : null;
const inGap = (s, u) => (s > L + 55 && u < 0) || GAP && s > GAP.a && s < GAP.b && (u > 0 ? 1 : -1) === GAP.side;      // sin pretil donde entra la explanada
const DROP = (() => {      // de qué lado del camino hay caída (cada 2 m): ahí van el pretil y los postes amarillos; del lado del cerro no
  const n = Math.ceil((SMAX - SMIN) / 2), out = { L: new Uint8Array(n), R: new Uint8Array(n) };
  for (const [key, sg] of [['L', -1], ['R', 1]]) {
    const a = out[key];
    for (let i = 0; i < n; i++) {
      const s = SMIN + i * 2, f = frame(s); let hi = -1e9;
      for (const u of [WR + 5.5, WR + 11.5, WR + 17.5]) { const x = f.x + f.rx * u * sg, z = f.z + f.rz * u * sg; hi = Math.max(hi, H(x, z)); }
      a[i] = hi < hrAt(s) - 4 ? 1 : 0;      // todo ese lado queda bajo el camino: es caída
    }
    for (const v of [0, 1]) {      // sin cortes ni trozos sueltos de menos de 12 m
      let i = 0; while (i < n) { let j = i; while (j < n && a[j] === a[i]) j++; if (a[i] === v && j - i < 6 && i > 0 && j < n) a.fill(1 - v, i, j); i = j; }
    }
  }
  return out;
})();
const isDrop = (s, u) => { const i = Math.round((s - SMIN) / 2); return i >= 0 && i < DROP.L.length && (u < 0 ? DROP.L : DROP.R)[i] === 1; };
function berm(u0) {
  const prof = [[-0.9, 0], [-0.45, 1.4], [0.45, 1.4], [0.9, 0]], pos = [], idx = [], valid = []; let rows = 0;
  for (let s = SMIN; s < SMAX; s += 2) {
    const f = frame(s);
    for (const [du, h] of prof) { const x = f.x + f.rx * (u0 + du), z = f.z + f.rz * (u0 + du); pos.push(x, H(x, z) + 0.1 + h, z); }
    valid.push(!inGap(s, u0) && isDrop(s, u0)); rows++;      // pretil solo al borde que da hacia abajo (protege de caídas); junto al banco/cerro no va
  }
  for (let r = 0; r < rows - 1; r++) {
    if (!valid[r] || !valid[r + 1]) continue;
    for (let c = 0; c < 3; c++) { const a = r * 4 + c, b = a + 1, c2 = a + 4, d = c2 + 1; idx.push(a, b, c2, b, d, c2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, lam(0x8e7757, { side: THREE.DoubleSide })));
}
berm(-PRET); berm(PRET);      // pretil a cada lado solo donde ese lado cae

(() => { // postes delineadores: sobre el pretil, en el borde que da hacia abajo
  const pts = []; for (let s = 6; s < L; s += 24) for (const u of [-PRET, PRET]) if (isDrop(s, u) && !inGap(s, u)) pts.push([s, u]);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 1.7, 0.25), bas(0xffc400), pts.length);
  const d = new THREE.Object3D();
  pts.forEach(([s, u], i) => { const f = frame(s), x = f.x + f.rx * u, z = f.z + f.rz * u; d.position.set(x, H(x, z) + 1.5, z); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
  scene.add(im);
})();


(() => { // dos postes rojos con franja blanca con franjas y base negra, cable en leve catenaria y banderas a cuadros
  const red = lam(0xe0401a), wh = lam(0xf4f4f4), dk = lam(0x1d1f22);
  const cc = document.createElement('canvas'); cc.width = 64; cc.height = 48; const cx = cc.getContext('2d');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { cx.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5'; cx.fillRect(i * 16, j * 16, 16, 16); }
  const flagMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), side: THREE.DoubleSide });
  const f = frame(L);
  for (const side of [-1, 1]) {
    const u = side * 14, x = f.x + f.rx * u, z = f.z + f.rz * u, g = new THREE.Group();
    cyl(g, 1.7, 1.7, 0.5, dk, 0, 0.25, 0);                      // base negra
    cyl(g, 1.4, 1.4, 0.08, lam(0xcfe6b8), 0, 0.54, 0);          // tapa clara
    for (let y = 1.8; y < 12.6; y += 1.2) box(g, 0.4, 1.2, 0.4, (Math.floor((y - 1.8) / 1.2) % 2) ? wh : red, 0, y + 0.6, 0);   // poste con franjas rojas y blancas
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), flagMat); fl.position.set(-side * 1.2, 9.6, 0.3); g.add(fl);
    g.position.set(x, H(x, z), z); g.rotation.y = Math.atan2(-f.rz, f.rx); scene.add(g);
  }
  // cable izquierdo: sale del piso y sube hasta la punta del poste; el derecho baja desde la punta hasta el piso del rajo
  const pt = (u, dd) => { const x = f.x + f.rx * u + f.tx * dd, z = f.z + f.rz * u + f.tz * dd; return { x, y: H(x, z), z }; };
  const V = (q, dy) => new THREE.Vector3(q.x, q.y + dy, q.z);
  const tL = pt(-14, 0), tR = pt(14, 0);
  const topL = V(tL, 12.0), topR = V(tR, 12.0);
  const gL = pt(-27, -6), gR = pt(27, -6);
  for (const dy of [0, -1.0]) {
    const left = [V(pt(-32, -10), 0.2 + dy), V(pt(-26, -7), 0.2 + dy), V(pt(-20, -3), 0.5 + dy), V(pt(-16, -1), 6 + dy), topL];      // viene por el piso y sube a la bandera
    for (const pts of [left]) scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.06, 6, false), red));
  }
  for (const dy of [0, -1.0]) {      // tramo entre las dos puntas, con leve catenaria como en la foto
    const span = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const q = topL.clone().lerp(topR, t); q.y += dy - 0.7 * (1 - Math.pow(2 * t - 1, 2)); span.push(q); }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(span), 48, 0.06, 6, false), red));
  }
})();

(() => { // señalética de distancia cada 200 m desde el inicio (0, 200, 400...), a ambos lados del camino, de cara a la pista
  const post = lam(0x2f2c29), endS = L + 205;      // mismo fin que END_S (esa constante se define más abajo)
  const mkTex = t => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#f5f5f5'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#1b1b18'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 118);
    x.fillStyle = '#1b1b18'; x.font = '800 74px Arial Narrow, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 128, 66);
    return new THREE.CanvasTexture(c); };
  for (let d = 0; START_S + d <= endS; d += 200) {
    const f = frame(START_S + d), tex = mkTex(d + ' m');
    for (const side of [-1, 1]) {
      const u = side * 13.8, x = f.x + f.rx * u, z = f.z + f.rz * u, g = new THREE.Group();      // en el hombro plano del camino (no dentro de la pared)
      box(g, 0.2, 3.2, 0.2, post, 0, 1.6, 0);                                                    // poste
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.0), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      plate.position.set(0, 3.9, 0.12); g.add(plate);
      g.position.set(x, H(x, z), z);
      g.rotation.y = side < 0 ? Math.atan2(f.rx, f.rz) : Math.atan2(-f.rx, -f.rz);            // cara hacia el centro del camino
      scene.add(g);
    }
  }
})();
(() => { // cartel: zona de caída de rocas (antes de la zona, a la izquierda del camino, mirando a quien sube)
  const g = new THREE.Group(), f = frame(ZONE_S - 55), post = lam(0x2f2c29);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#f2b800'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#1b1b18'; x.lineWidth = 14; x.strokeRect(7, 7, 498, 242);
  x.fillStyle = '#1b1b18'; x.beginPath(); x.moveTo(78, 52); x.lineTo(138, 160); x.lineTo(18, 160); x.closePath(); x.fill();           // triángulo de peligro
  x.fillStyle = '#f2b800'; x.beginPath(); x.moveTo(78, 76); x.lineTo(118, 148); x.lineTo(38, 148); x.closePath(); x.fill();
  x.fillStyle = '#1b1b18'; for (const [cx, cy, r] of [[66, 104, 9], [90, 120, 11], [74, 138, 8]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }   // rocas cayendo
  x.fillStyle = '#1b1b18'; x.font = '800 54px Arial Narrow, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('ZONA DE CAÍDA', 322, 96); x.fillText('DE ROCAS', 322, 160);
  x.font = '700 30px Arial, sans-serif'; x.fillText('ESQUIVA POR EL ZIGZAG', 322, 214);
  box(g, 0.35, 6.4, 0.35, post, -3.6, 3.2, 0); box(g, 0.35, 6.4, 0.35, post, 3.6, 3.2, 0);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
  sign.position.set(0, 7.4, 0); g.add(sign);
  const gx = f.x + f.rx * -21, gz = f.z + f.rz * -21; g.position.set(gx, H(gx, gz), gz);
  g.rotation.y = Math.atan2(-f.rz, f.rx); scene.add(g);
})();

export { slickNow, wetRange, seedWet, updateRoad, GAP, inGap, DROP, isDrop, berm };
