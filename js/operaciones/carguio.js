// Carguío y apoyo sobre los pisos reales del plano (PISOS_DWG): palas de cables cargando camiones en los frentes (mkLoadZone), pala hidráulica PC9000, wheel dozers (addDozer, workSite),
// canchas de perforación con pozos y perforadoras (buildDrills), huellas de camiones (drawTracks) y su animación (animOps). Se arma con buildDrills y buildOps desde main.js.
import { mundo as M, setWorldPose } from '../mundo.js';
import { LANE, TAU } from '../config/diseno.js';
import { CAMINOS_DWG, PISOS_DWG } from '../datos/terreno_dwg.js';
import { hash, sdPoly, sm01 } from '../comun/mates.js';
import { addPlates, lam, rockGeo } from '../modelos/materiales.js';
import { CAEX_PLATE, nextCaexId, protoOnc } from '../modelos/camiones.js';
import { buildHydShovel, buildShovel, dumpTune, hydPose, makePile, shovelPose } from '../modelos/palas.js';
import { buildCrawlerDrill, buildDrill, nextDrillNum } from '../modelos/perforadoras.js';
import { buildWheelDozer } from '../modelos/dozers.js';
import { floorPath, gdAt, onRoadC } from './malla.js';

const SHOV_T = 7.2;      // ciclo de la pala de cables (s): cava, gira, descarga y vuelve
const OPS = { LZ: [], DOZ: [], HYD: null, PALAS: [], HUELLAS: [] };      // HUELLAS: puntos por donde pasan camiones (los cables los cruzan por postes)      // estado de las operaciones: palas de cables cargando (LZ), dozers (DOZ), pala hidráulica (HYD) y las palas con cable (PALAS: { x, z, fx, fz, num, cable })
const F7P = PISOS_DWG.find(p => p.f7), FONDO = PISOS_DWG.find(p => p.fondo), CANCHAS = PISOS_DWG.filter(p => p.cancha);      // piso de la partida, fondo mina y terrazas de perforación
function addHoles(list) {      // pozos de tronadura (instanciados): boca negra con su montón de detritus
  if (!list.length) return;
  const d = new THREE.Object3D(), hole = new THREE.InstancedMesh(new THREE.CircleGeometry(0.55, 12), lam(0x121212), list.length), cut = new THREE.InstancedMesh(new THREE.ConeGeometry(1.3, 0.45, 10), lam(0x9b9486), list.length);
  list.forEach((p, i) => {
    const y = M.H(p.x, p.z);
    d.position.set(p.x, y + 0.2, p.z); d.rotation.set(0, 0, 0); d.updateMatrix(); cut.setMatrixAt(i, d.matrix);
    d.position.set(p.x, y + 0.46, p.z); d.rotation.set(-Math.PI / 2, 0, 0); d.updateMatrix(); hole.setMatrixAt(i, d.matrix);
  });
  M.scene.add(cut); M.scene.add(hole);
}
function placeDrill(x, z, yaw, pre) { M.OBST.push({ x, z, r: 6 }); const dr = buildDrill(pre, nextDrillNum()); dr.position.set(x, M.H(x, z) + 0.1, z); dr.rotation.y = yaw; M.scene.add(dr); }
function buildDrills() {      // canchas de perforación en terrazas planas junto a la ruta: malla tresbolillo 8 × 9,2 m (burden × espaciamiento) alineada con el eje largo del piso, centrada en el punto del piso más cercano a la ruta (C.cerca), a ≥ 12 m del borde; perforadora en el extremo de la malla y, en la segunda cancha, también la de orugas en el otro extremo
  CANCHAS.forEach((C, k) => {
    const sd = sdPoly(C.poly), ux = C.ux, uz = C.uz, vx = -uz, vz = ux, B = 8, S = 9.2, holes = [], cx = C.cerca[0], cz = C.cerca[1], y0 = M.H(cx, cz);
    const MB = C.marca ? 5 : 12;      // margen al borde (la terraza marcada es angosta)
    const dentro = (x, z) => sd(x, z) <= -MB && gdAt(x, z) === -1 && !onRoadC(x, z) && Math.abs(M.H(x, z) - y0) < 2.5;
    const libre = (x, z) => sd(x, z) <= -6 && gdAt(x, z) === -1 && !onRoadC(x, z) && Math.abs(M.H(x, z) - y0) < 2.5 && !M.OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 6);      // lugar para una perforadora: sobre el banco, fuera de los caminos
    let aMax = 0, aMin = 0; for (let a = 0; a <= 64; a += 4) { if (dentro(cx + ux * a, cz + uz * a)) aMax = a; else break; } for (let a = 0; a >= -64; a -= 4) { if (dentro(cx - ux * -a, cz - uz * -a)) aMin = a; else break; }      // largo de la malla hasta donde hay piso
    const sitio = (cands) => cands.map(([a, b]) => ({ x: cx + ux * a + vx * b, z: cz + uz * a + vz * b })).find(p => libre(p.x, p.z));
    const q = sitio([[aMax + 7, 0], [aMax + 5, 10], [aMax + 5, -10], [aMin - 7, 0], [0, 40], [0, -40], [aMax, 0]]) || { x: cx, z: cz };      // perforadora en el extremo de la malla (sobre el banco, nunca en un camino)
    for (let b = -36, row = 0; b <= 36; b += B, row++) for (let a = aMin + (row % 2) * S / 2; a <= aMax; a += S) {
      const px = cx + ux * a + vx * b + (hash(a, b) - 0.5) * 0.6, pz = cz + uz * a + vz * b + (hash(b, a) - 0.5) * 0.6;
      if (!dentro(px, pz) || Math.hypot(q.x - px, q.z - pz) < 9) continue; holes.push({ x: px, z: pz });
    }
    addHoles(holes);
    placeDrill(q.x, q.z, Math.atan2(-ux, -uz) + 0.4, false);
    const c = (k === 1 || CANCHAS.length === 1) && sitio([[aMin - 9, 0], [aMin - 7, 10], [aMin - 7, -10], [0, -40], [0, 40]]);
    if (c) { const cd = buildCrawlerDrill(nextDrillNum()); M.OBST.push({ x: c.x, z: c.z, r: 6 }); cd.position.set(c.x, M.H(c.x, c.z), c.z); cd.rotation.y = Math.atan2(ux, uz) + 0.6; M.scene.add(cd); }
  });
}
const TOLVA_C = 2.2;      // centro de la tolva: 2,2 m detrás del origen del camión (camión escalado)
function mkLoadZone(x, z, fx, fz, num, phOff) {      // pala de cables cargando en su frente con un camión a cada lado (alterna)
  M.OBST.push({ x, z, r: 10 }); const sv = buildShovel(num); sv.g.position.set(x, M.H(x, z), z); sv.g.rotation.y = Math.atan2(fx, fz); M.scene.add(sv.g); sv.swing = 1;
  const L = { sv, trucks: [], last: 0, off: phOff };
  dumpTune(sv, M.H);
  for (const k of [0, 1]) {      // cada camión con el centro de su tolva bajo el balde (k = 0: lado al que gira con swing 1)
    sv.swing = k ? -1 : 1; shovelPose(sv, 4.0); sv.g.updateMatrixWorld(true); const bp = sv.bucket.getWorldPosition(new THREE.Vector3());
    const qx = bp.x - fx * TOLVA_C, qz = bp.z - fz * TOLVA_C, mesh = protoOnc.clone(true), pile = makePile(); mesh.add(pile);
    addPlates(mesh, nextCaexId(), CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s); M.scene.add(mesh); setWorldPose(mesh, qx, qz, -fx, -fz); M.OBST.push({ x: qx, z: qz, r: 8 });      // de cola al frente
    const fill = k ? 0.6 : 0.2; pile.scale.y = 0.05 + 0.95 * fill; L.trucks.push({ pile, fill });
  }
  OPS.LZ.push(L);
}
function rockScatter(fn, n, seed) {
  const rm = [lam(0x6e5c49), lam(0x8a7660), lam(0x574a3b)];
  for (let i = 0; i < n; i++) { const q = fn(hash(i, seed), hash(i, seed + 1)); if (!q) continue; const sc = 0.5 + hash(i, seed + 2) * 1.1, m = new THREE.Mesh(rockGeo, rm[i % 3]);
    m.scale.set(sc, sc * 0.7, sc); m.position.set(q.x, M.H(q.x, q.z) + sc * 0.2, q.z); m.rotation.set(hash(i, 4) * 3, hash(i, 5) * 3, hash(i, 6) * 3); M.scene.add(m); }
}
const frontRocks = (F, seed) => rockScatter((a, b) => { const an = a * TAU, r = 0.8 + b * 0.3, ca = 12 + Math.cos(an) * 7 * r, cb = Math.sin(an) * 24 * r; return { x: F.x + F.fx * ca - F.fz * cb, z: F.z + F.fz * ca + F.fx * cb }; }, 45, seed);      // material suelto al pie de la pared, frente a la pala
function addDozer(x, z, fx, fz, ph) { M.OBST.push({ x: x + fx * 8, z: z + fz * 8, r: 15 }); const g = buildWheelDozer(); M.scene.add(g); OPS.DOZ.push({ g, x, z, fx, fz, tx: -fz, tz: fx, ph }); }      // trabaja en un paño de ~16 × 26 m hacia adelante
function workSite(S, ux, uz, h0, sides) {      // lugar plano para el wheel dozer, fuera del radio de giro de la pala (≥ 36 m) y lejos de otros equipos
  const tx = -uz, tz = ux, ok = (x, z) => gdAt(x, z) === -1 && Math.abs(M.H(x, z) - h0) < 1.5 && !M.OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 3);
  for (const d of [42, 46, 38, 50, 54, 36, 58, 32, 28]) for (const sg of sides) for (const uo of [0, 4, -4, 8, -8, -14, -20, -28, -36, -44]) {      // también más atrás de la pala si al costado no hay piso
    if (Math.hypot(d, uo) < 36) continue;
    const bx = S.x + tx * sg * d + ux * uo, bz = S.z + tz * sg * d + uz * uo; let good = true;
    for (let al = -5; al <= 20 && good; al += 5) for (let la = -10; la <= 10 && good; la += 5) if (!ok(bx + ux * al + tx * la, bz + uz * al + tz * la)) good = false;
    if (good) return { x: bx, z: bz, sg };
  }
  return null;
}
const HUELLA_T = 45, MARCAS = [];      // huellas de neumático: duran HUELLA_T s y se desvanecen; se reciclan en anillo
let marcaK = 0, marcaGeo = null;
function dejaHuella(x, z, fx, fz, t) {
  if (!marcaGeo) { marcaGeo = new THREE.PlaneGeometry(1.15, 1.6); marcaGeo.rotateX(-Math.PI / 2); }
  let m = MARCAS[marcaK % 240]; if (!m) { m = new THREE.Mesh(marcaGeo, new THREE.MeshBasicMaterial({ color: 0x2c2a27, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); m.renderOrder = 2; M.scene.add(m); MARCAS[marcaK % 240] = m; }
  marcaK++; m.position.set(x, M.H(x, z) + 0.07, z); m.rotation.y = Math.atan2(fx, fz); m.userData.t0 = t; m.material.opacity = 0.5; m.visible = true;
}
function borraHuellas(t) { for (const m of MARCAS) if (m && m.visible) { const a = (t - m.userData.t0) / HUELLA_T; if (a >= 1 || a < 0) m.visible = false; else m.material.opacity = 0.5 * (1 - a); } }
function animOps(dt, tAnim) {
  borraHuellas(tAnim);      // tAnim: reloj de animación (s)
  if (OPS.HYD) {      // pala hidráulica frontal: cava en el frente, levanta, gira 90° al camión de su costado, descarga sobre la tolva y vuelve (ciclo ~22 s; 4 pases llenan el camión)
    const Q = OPS.HYD, T = 22, ph = (tAnim + 3) % T, was = Q.prev || 0; Q.prev = ph;
    const G = -1.72, K = [[0, 0, 5.3, -4.6, -0.2, 0], [4, 0, 6.8, -1.1, 0.3, 0], [7, 0, 6.8, 3.4, 0.6, 0], [11, G, 8.2, 2.2, 0.3, 0], [12.3, G, 8.2, 2.2, 0.1, 1], [15, G, 8.2, 2.2, 0.1, 1], [16.3, G, 8.2, 2.2, 0.3, 0], [19, 0, 5.8, -0.6, 0, 0], [22, 0, 5.3, -4.6, -0.2, 0]];      // [t, giro, alcance, altura, inclinación, apertura]: el balde llega derecho sobre la tolva, abre la placa trasera (V por abajo), descarga y cierra      // y +1,5 m: el balde cuelga bajo la bota
    let k = 0; while (k < K.length - 2 && ph >= K[k + 1][0]) k++; const A = K[k], B = K[k + 1], s = sm01((ph - A[0]) / (B[0] - A[0]));
    hydPose(Q.S, A[1] + (B[1] - A[1]) * s, A[2] + (B[2] - A[2]) * s, A[3] + (B[3] - A[3]) * s, A[4] + (B[4] - A[4]) * s, A[5] + (B[5] - A[5]) * s);
    Q.S.load.visible = ph > 3 && ph < 14;
    { const dump = ph > 12.0 && ph < 15.8; Q.chorro.visible = dump; if (dump) { const A = new THREE.Vector3(), B = new THREE.Vector3(); A.set(0, -2.7, 0.45); Q.S.gate.localToWorld(A);      // sale por la rendija entre la placa trasera y el cuenco
        Q.pile.getWorldPosition(B); B.y -= 0.3;
        Q.chorro.children.forEach((m, i) => { const u = ((tAnim * 1.3 + i / 70) % 1), sp = (hash(i, 3) - 0.5) * 1.8; m.position.set(A.x + (B.x - A.x) * u * 0.8 + sp, A.y + (B.y - A.y) * u * u, A.z + (B.z - A.z) * u * 0.8 + (hash(i, 5) - 0.5) * 1.8); m.rotation.set(u * 6 + i, u * 4, 0); }); } }
    if (was < 14 && ph >= 14) { Q.fill += 0.25; if (Q.fill > 1.01) Q.fill = 0.05; }
    Q.pile.scale.y += ((0.05 + 0.95 * Math.min(1, Q.fill)) - Q.pile.scale.y) * Math.min(1, dt * 3);
  }
  for (const L of OPS.LZ) {
    const sv = L.sv, ph = (tAnim + L.off) % SHOV_T, was = sv.prev || 0; sv.prev = ph;
    if (was > ph) { L.last = 1 - L.last; sv.swing = L.last ? 1 : -1; }      // alterna entre los dos camiones
    if (was < 4.1 && ph >= 4.1) { const t = L.trucks[sv.swing > 0 ? 0 : 1]; t.fill += 0.2; if (t.fill > 1.01) t.fill = 0.05; }      // lleno: sale y llega otro vacío
    shovelPose(sv, ph);
    for (const t of L.trucks) t.pile.scale.y += ((0.05 + 0.95 * Math.min(1, t.fill)) - t.pile.scale.y) * Math.min(1, dt * 3);
  }
  for (const D of OPS.DOZ) {      // el dozer ordena el piso: empuja hacia el frente, retrocede y se corre a la pasada siguiente
    const PER = 11, LN = [-6, 0, 6, 0], t = (tAnim + D.ph * 7) % (PER * 4), k = Math.floor(t / PER), q = (t % PER) / PER, l0 = LN[k], l1 = LN[(k + 1) % 4];
    let al, la, fx = D.fx, fz = D.fz;
    if (q < 0.55) { al = 14 * sm01(q / 0.55); la = l0; }
    else { const r = (q - 0.55) / 0.45, w = Math.sin(Math.PI * r) * (l1 - l0) * 0.12; al = 14 * (1 - sm01(r)); la = l0 + (l1 - l0) * sm01(r); fx = D.fx - D.tx * w; fz = D.fz - D.tz * w; const n = Math.hypot(fx, fz); fx /= n; fz /= n; }
    const nx = D.x + D.fx * al + D.tx * la, nz = D.z + D.fz * al + D.tz * la;
    setWorldPose(D.g, nx, nz, fx, fz);
    if (D.px !== undefined) {      // las ruedas giran con el avance y dejan huellas que se borran con el tiempo
      const mx = nx - D.px, mz = nz - D.pz, dist = Math.hypot(mx, mz), sg = mx * fx + mz * fz >= 0 ? 1 : -1;
      if (dist > 1e-4) { for (const w of D.g.userData.ruedas || []) w.rotation.x += sg * dist / 1.33; D.acc = (D.acc || 0) + dist; }
      if (D.acc > 1.3) { D.acc = 0; for (const [ox, oz] of [[1.75, 2.2], [-1.75, 2.2], [1.75, -2.3], [-1.75, -2.3]]) dejaHuella(nx + fz * ox + fx * oz, nz - fx * ox + fz * oz, fx, fz, tAnim); }
    }
    D.px = nx; D.pz = nz;
  }
}
function drawTracks(pts) {      // huellas de camión: dos surcos oscuros (ruedas) siguiendo una curva suave por el piso
  if (!pts || pts.length < 2) return;
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, 0, p.z))); c.curveType = 'centripetal'; const N = Math.max(24, Math.round(c.getLength() / 3));
  for (let k = 0; k <= N; k++) { const p = c.getPoint(k / N); OPS.HUELLAS.push({ x: p.x, z: p.z }); }
  for (const off of [-1.7, 1.7]) { const pos = []; for (let k = 0; k <= N; k++) { const p = c.getPoint(k / N), t = c.getTangent(k / N), nx = -t.z, nz = t.x, y = M.H(p.x, p.z) + 0.06; pos.push(p.x + nx * (off - 0.45), y, p.z + nz * (off - 0.45), p.x + nx * (off + 0.45), y, p.z + nz * (off + 0.45)); }
    const g = new THREE.BufferGeometry(), idx = []; for (let k = 0; k < N; k++) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    M.scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x2c2a27, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }))); }
}
function buildOps() {
  const front = (p, i) => (p && p.frentes[i]) || null;
  const pala = (F, num, off, cable) => { mkLoadZone(F.x, F.z, F.fx, F.fz, num, off); frontRocks(F, 40 + num.charCodeAt(0)); OPS.PALAS.push({ x: F.x, z: F.z, fx: F.fx, fz: F.fz, num, h: M.H(F.x, F.z), cable }); };
  { const F = front(F7P, 0); if (F) pala(F, '2', 2.3, 'ruta'); }      // fase 7 (piso de la partida): pala de cables 2 con su cable por el portón de la rampa
  { const F = front(FONDO, 0); if (F) pala(F, '1', 4.6, 'fondo'); }      // fondo mina: pala 1
  { const Q = front(FONDO, 1); if (Q) {      // fondo mina: pala hidráulica PC9000 cargando un camión a la vez a su costado
      const tx = -Q.fz, tz = Q.fx, S = buildHydShovel('4'), mx = Q.x - tx * 4.5, mz = Q.z - tz * 4.5;
      { const mg = new THREE.CylinderGeometry(10, 15, 2.5, 30, 3), pp = mg.attributes.position; for (let i = 0; i < pp.count; i++) { const a = Math.atan2(pp.getZ(i), pp.getX(i)), f = 1 + 0.07 * Math.sin(3 * a + 1) + 0.04 * Math.sin(7 * a + 2); pp.setX(i, pp.getX(i) * f); pp.setZ(i, pp.getZ(i) * f); if (pp.getY(i) > 0) pp.setY(i, pp.getY(i) + 0.15 * Math.sin(5 * a + pp.getX(i))); } mg.translate(0, 1.25, 0); mg.computeVertexNormals();
        const mound = new THREE.Mesh(mg, new THREE.MeshLambertMaterial({ color: 0x6d655a, flatShading: true })); mound.position.set(mx, M.H(Q.x, Q.z) - 0.5, mz); M.scene.add(mound);      // la pala hidráulica trabaja subida sobre una pila de material tronado
        for (let k = 0; k < 70; k++) { const a = k * 2.4, d = 3 + (k % 11) * 1.1, r = new THREE.Mesh(rockGeo, new THREE.MeshLambertMaterial({ color: k % 2 ? 0x6e5c49 : 0x9a8b78, flatShading: true })), sc = 0.45 + 0.3 * (k % 4); r.scale.set(sc, sc * 0.7, sc); r.position.set(mx + Math.cos(a) * d, M.H(Q.x, Q.z) + 1.9 - Math.max(0, d - 8) * 0.5, mz + Math.sin(a) * d); r.rotation.y = k; M.scene.add(r); } }
      { const hx = Q.x + Q.fx * 18, hz = Q.z + Q.fz * 18, hy = M.H(hx, hz) - 0.4, hg = new THREE.CylinderGeometry(4, 9.5, 5.5, 28, 4), hp = hg.attributes.position;      // el banco que cava la pala: pila de roca tronada (como en la foto de la PC8000 cargando un 830E)
        for (let i = 0; i < hp.count; i++) { const a = Math.atan2(hp.getZ(i), hp.getX(i)), f = 1 + 0.12 * Math.sin(3 * a + 0.5) + 0.07 * Math.sin(7 * a + 1.7) + 0.05 * Math.sin(11 * a); hp.setX(i, hp.getX(i) * f); hp.setZ(i, hp.getZ(i) * f); if (hp.getY(i) > 0) hp.setY(i, hp.getY(i) + 0.4 * Math.sin(5 * a + hp.getX(i) * 0.7)); }
        hg.translate(0, 2.75, 0); hg.computeVertexNormals();
        const heap = new THREE.Mesh(hg, new THREE.MeshLambertMaterial({ color: 0x6d655a, flatShading: true })); heap.position.set(hx, hy, hz); M.scene.add(heap); M.OBST.push({ x: hx, z: hz, r: 8 });
        for (let k = 0; k < 110; k++) { const a = k * 2.39, d = (k % 14) * 0.68, yd = d <= 4 ? 5.2 : Math.max(0, (9.5 - d) / 5.5) * 5.2, r = new THREE.Mesh(rockGeo, new THREE.MeshLambertMaterial({ color: [0x7a6f62, 0x8a7c6a, 0x5f584f, 0x9a8c78][k % 4], flatShading: true })), sc = 0.7 + 0.35 * (k % 5);
          r.scale.set(sc, sc * 0.75, sc); r.position.set(hx + Math.cos(a) * d, hy + yd + 0.2, hz + Math.sin(a) * d); r.rotation.set(k, k * 1.7, 0); M.scene.add(r); } }
      S.g.position.set(Q.x, M.H(Q.x, Q.z) + 2.0, Q.z); S.g.rotation.y = Math.atan2(Q.fx, Q.fz); M.scene.add(S.g); M.OBST.push({ x: Q.x, z: Q.z, r: 9 });
      const t = { x: Q.x - Q.fx * 2.2 + tx * 12.9, z: Q.z - Q.fz * 2.2 + tz * 12.9 }, mesh = protoOnc.clone(true), pile = makePile(); mesh.add(pile); addPlates(mesh, nextCaexId(), CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s); M.scene.add(mesh); setWorldPose(mesh, t.x, t.z, -Q.fx, -Q.fz); M.OBST.push({ x: t.x, z: t.z, r: 8 });
      const chorro = new THREE.Group(), cg = new THREE.BoxGeometry(0.35, 0.35, 0.35), cm = [new THREE.MeshLambertMaterial({ color: 0x6b5a45 }), new THREE.MeshLambertMaterial({ color: 0x8a7660 }), new THREE.MeshLambertMaterial({ color: 0x4f4439 })]; for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(cg, cm[i % 3]); m.scale.setScalar(0.6 + 0.9 * hash(i, 9)); chorro.add(m); } chorro.visible = false; M.scene.add(chorro);      // chorro de material que cae del balde al camión al descargar
      OPS.HYD = { S, pile, chorro, fill: 0.3, prev: 0 }; hydPose(S, 0, 5.3, -4.6, -0.2, 0); frontRocks(Q, 77); } }
  { const MK = PISOS_DWG.find(p => p.marca), F = front(MK, 0) || front(FONDO, 2); if (F) pala(F, '5', 1.2, 'fondo'); }      // pala 5: en el frente de carguío de la terraza marcada (junto a la perforadora 403); si no hay, en el fondo
  OPS.PALAS.forEach((p, k) => {      // apoyo al carguío: un wheel dozer por pala, en un paño plano al costado (fuera del giro y lejos de los camiones y de sus salidas)
    const tmp = []; for (const o of M.OBST.filter(o => o.r === 8 && Math.hypot(o.x - p.x, o.z - p.z) < 40)) for (let t = 12; t <= 110; t += 12) tmp.push({ x: o.x - p.fx * t, z: o.z - p.fz * t, r: 12 }); M.OBST.push(...tmp);
    const q = workSite(p, p.fx, p.fz, p.h, [1, -1]); M.OBST.splice(M.OBST.length - tmp.length, tmp.length); if (q) addDozer(q.x, q.z, p.fx, p.fz, 2 + k * 1.7);
  });
  for (const p of OPS.PALAS) {      // huellas de los camiones de cada pala hasta la salida de su piso (fase 7: la rampa; fondo: donde empieza su camino interior)
    const f = M.frame(80), T = p.cable === 'ruta' ? { x: f.x, z: f.z } : (FONDO && FONDO.salida ? { x: FONDO.salida[0], z: FONDO.salida[1] } : null); if (!T) continue;
    for (const o of M.OBST.filter(o => o.r === 8 && Math.hypot(o.x - p.x, o.z - p.z) < 40)) drawTracks(floorPath({ x: o.x - p.fx * 32, z: o.z - p.fz * 32 }, T));      // desde 32 m adelante de cada camión (ya fuera de la pala)
  }
  for (const C of CAMINOS_DWG) for (const off of [-LANE, LANE]) {      // huellas en todos los caminos interiores: una pista por sentido, a ±LANE como en la ruta
    const pts = []; for (let k = 0; k < C.length; k++) { const a = C[Math.max(0, k - 1)], b = C[Math.min(C.length - 1, k + 1)], tx = b[0] - a[0], tz = b[1] - a[1], n = Math.hypot(tx, tz) || 1; pts.push({ x: C[k][0] - tz / n * off, z: C[k][1] + tx / n * off }); }
    drawTracks(pts);
  }
}

export { OPS, buildDrills, buildOps, animOps };      // lo demás es interno; OPS se expone para los cables y el arnés de pruebas
