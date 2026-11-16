// Carguío y apoyo: canchas de perforación con sus pozos y perforadoras (buildDrills), palas cargando camiones (mkLoadZone, pala hidráulica), dozers (addDozer, workSite), huellas (drawTracks) y su animación (animOps). Todo se arma en buildOps.
import { mundo as M, setWorldPose } from '../mundo.js';
import { FLOOR, TAU } from '../config/diseno.js';
import { SEC } from '../datos/caminos.js';
import { hash, sm01 } from '../comun/mates.js';
import { addPlates, lam, rockGeo } from '../modelos/materiales.js';
import { CAEX_PLATE, nextCaexId, protoOnc } from '../modelos/camiones.js';
import { buildHydShovel, buildShovel, dumpTune, hydPose, makePile, shovelPose } from '../modelos/palas.js';
import { buildCrawlerDrill, buildDrill, nextDrillNum } from '../modelos/perforadoras.js';
import { buildTrackDozer, buildWheelDozer } from '../modelos/dozers.js';
import { floorPath, gdAt } from './malla.js';

const SHOV_T = 7.2;      // ciclo de la pala de cables (s): cava, gira, descarga y vuelve
const OPS = { LZ: [], DOZ: [], HYD: null };      // estado de las operaciones: palas de cables cargando (LZ), dozers (DOZ) y pala hidráulica (HYD)
function addHoles(list) {      // pozos de tronadura (instanciados): boca negra con su montón de detritus
  const d = new THREE.Object3D(), hole = new THREE.InstancedMesh(new THREE.CircleGeometry(0.55, 12), lam(0x121212), list.length), cut = new THREE.InstancedMesh(new THREE.ConeGeometry(1.3, 0.45, 10), lam(0x9b9486), list.length);
  list.forEach((p, i) => {
    const y = M.H(p.x, p.z);
    d.position.set(p.x, y + 0.2, p.z); d.rotation.set(0, 0, 0); d.updateMatrix(); cut.setMatrixAt(i, d.matrix);
    d.position.set(p.x, y + 0.46, p.z); d.rotation.set(-Math.PI / 2, 0, 0); d.updateMatrix(); hole.setMatrixAt(i, d.matrix);
  });
  M.scene.add(cut); M.scene.add(hole);
}
function placeDrill(x, z, yaw, pre) { M.OBST.push({ x, z, r: 6 }); const dr = buildDrill(pre, nextDrillNum()); dr.position.set(x, M.H(x, z) + 0.1, z); dr.rotation.y = yaw; M.scene.add(dr); }
function buildDrills() {
  const gd = (x, z) => { const fx = Math.round((x - M.GX0) / M.CELL), fz = Math.round((z - M.GZ0) / M.CELL); return (fx < 0 || fz < 0 || fx >= M.GNX || fz >= M.GNZ) ? 99 : M.GD[fz * M.GNX + fx]; };
  const flat = (x, z) => { if (gd(x, z) !== -1 || M.OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 12)) return false; for (let a = 0; a < 8; a++) if (gd(x + Math.cos(a * 0.785) * 10, z + Math.sin(a * 0.785) * 10) !== -1) return false; return true; };
  const snap = (x, z) => { for (let r = 0; r <= 120; r += 3) for (let a = 0; a < 24; a++) { const q = { x: x + Math.cos(a * TAU / 24) * r, z: z + Math.sin(a * TAU / 24) * r }; if (flat(q.x, q.z)) return q; } return { x, z }; };      // piso plano más cercano (nunca en la cara de un banco)
  // fase 7: tres canchas de perforación (malla 9 × 9 m) con su perforadora en el borde; en la del centro también la de orugas
  { const holes = [], dr = M.F7EQ.canchas.flatMap(C => [C.dr, C.crawler].filter(Boolean)), B = 8, S = 9.2;      // malla tresbolillo 8 × 9,2 m (burden × espaciamiento, S ≈ 1,15 B, pozos de 10⅝–12¼" en banco de 16 m), filas paralelas al eje largo de la cancha y primera fila a un burden de la cresta
    for (const f of M.RED52) { const P = f.P, n = P.length, cx = P.reduce((s, p) => s + p[0], 0) / n, cz = P.reduce((s, p) => s + p[1], 0) / n;
      let sxx = 0, sxz = 0, szz = 0; for (const p of P) { const dx = p[0] - cx, dz = p[1] - cz; sxx += dx * dx; sxz += dx * dz; szz += dz * dz; }
      const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(th), uz = Math.sin(th), vx = -uz, vz = ux;      // eje principal de la cancha
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of P) { const a = (p[0] - cx) * ux + (p[1] - cz) * uz, b = (p[0] - cx) * vx + (p[1] - cz) * vz; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
      for (let b = b0, row = 0; b <= b1; b += B, row++) for (let a = a0 + (row % 2) * S / 2; a <= a1; a += S) { const px = cx + ux * a + vx * b + (hash(a, b) - 0.5) * 0.6, pz = cz + uz * a + vz * b + (hash(b, a) - 0.5) * 0.6;
        if (f(px, pz) > -B || gd(px, pz) !== -1 || Math.abs(M.H(px, pz) - M.f7h(px, pz) - M.PAD_UP) > 0.6 || dr.some(q => Math.hypot(q.x - px, q.z - pz) < 8)) continue; holes.push({ x: px, z: pz }); } }
    addHoles(holes); }
  for (const C of M.F7EQ.canchas) {
    placeDrill(C.dr.x, C.dr.z, hash(C.dr.x, C.dr.z) * 6.28, false);
    if (C.crawler) { const q = C.crawler; M.OBST.push({ x: q.x, z: q.z, r: 6 }); const cd = buildCrawlerDrill(nextDrillNum()); cd.position.set(q.x, M.H(q.x, q.z), q.z); cd.rotation.y = 0.6; M.scene.add(cd); }
  }
}
const TOLVA_C = 2.2;      // centro de la tolva: 2,2 m detrás del origen del camión (camión escalado)
function mkLoadZone(x, z, fx, fz, num, phOff) {      // pala de cables cargando en su pila con un camión a cada lado (alterna)
  M.OBST.push({ x, z, r: 10 }); const sv = buildShovel(num); sv.g.position.set(x, M.H(x, z), z); sv.g.rotation.y = Math.atan2(fx, fz); M.scene.add(sv.g); sv.swing = 1;
  const tx = fz, tz = -fx, L = { sv, trucks: [], last: 0, off: phOff };
  dumpTune(sv, M.H);
  for (const k of [0, 1]) {      // cada camión con el centro de su tolva bajo el balde (k = 0: lado al que gira con swing 1)
    sv.swing = k ? -1 : 1; shovelPose(sv, 4.0); sv.g.updateMatrixWorld(true); const bp = sv.bucket.getWorldPosition(new THREE.Vector3());
    const qx = bp.x - fx * TOLVA_C, qz = bp.z - fz * TOLVA_C, mesh = protoOnc.clone(true), pile = makePile(); mesh.add(pile);
    addPlates(mesh, nextCaexId(), CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s); M.scene.add(mesh); setWorldPose(mesh, qx, qz, -fx, -fz); M.OBST.push({ x: qx, z: qz, r: 8 });      // de cola a la pila
    const fill = k ? 0.6 : 0.2; pile.scale.y = 0.05 + 0.95 * fill; L.trucks.push({ pile, fill });
  }
  OPS.LZ.push(L);
}
function rockScatter(fn, n, seed) {
  const rm = [lam(0x6e5c49), lam(0x8a7660), lam(0x574a3b)];
  for (let i = 0; i < n; i++) { const q = fn(hash(i, seed), hash(i, seed + 1)); if (!q) continue; const sc = 0.5 + hash(i, seed + 2) * 1.1, m = new THREE.Mesh(rockGeo, rm[i % 3]);
    m.scale.set(sc, sc * 0.7, sc); m.position.set(q.x, M.H(q.x, q.z) + sc * 0.2, q.z); m.rotation.set(hash(i, 4) * 3, hash(i, 5) * 3, hash(i, 6) * 3); M.scene.add(m); }
}
function addDozer(x, z, fx, fz, ph, track) { M.OBST.push({ x: x + fx * 8, z: z + fz * 8, r: 15 }); const g = track ? buildTrackDozer() : buildWheelDozer(); M.scene.add(g); OPS.DOZ.push({ g, x, z, fx, fz, tx: -fz, tz: fx, ph }); }      // trabaja en un paño de ~16 × 26 m hacia adelante
function workSite(S, ux, uz, h0, sides) {      // lugar plano para el wheel dozer, fuera del radio de giro de la pala (≥ 36 m) y lejos de otros equipos
  const tx = -uz, tz = ux, ok = (x, z) => Math.abs(M.H(x, z) - h0) < 0.7 && !M.OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 3);
  for (const d of [42, 46, 38, 50, 54, 36, 58, 32, 28]) for (const sg of sides) for (const uo of [0, 4, -4, 8, -8, -14, -20, -28, -36, -44]) {      // también más atrás de la pala si al costado no hay piso
    if (Math.hypot(d, uo) < 36) continue;
    const bx = S.x + tx * sg * d + ux * uo, bz = S.z + tz * sg * d + uz * uo; let good = true;
    for (let al = -5; al <= 20 && good; al += 5) for (let la = -10; la <= 10 && good; la += 5) if (!ok(bx + ux * al + tx * la, bz + uz * al + tz * la)) good = false;
    if (good) return { x: bx, z: bz, sg };
  }
  return null;
}
function animOps(dt, tAnim) {      // tAnim: reloj de animación (s)
  if (OPS.HYD) {      // pala hidráulica frontal: cava en la pila, levanta, gira 90° al camión de su costado, descarga sobre la tolva y vuelve (ciclo ~22 s; 4 pases llenan el camión)
    const Q = OPS.HYD, T = 22, ph = (tAnim + 3) % T, was = Q.prev || 0; Q.prev = ph;
    const G = -Math.PI / 2, K = [[0, 0, 8.0, -5.0, 0], [4, 0, 10.0, -2.5, 0.5], [7, 0, 10.0, 3.5, 0.6], [11, G, 10.6, 3.3, 0.6], [12.5, G, 10.6, 3.3, -0.9], [15, G, 10.6, 3.3, -0.9], [19, 0, 9.0, 1.0, 0], [22, 0, 8.0, -5.0, 0]];
    let k = 0; while (k < K.length - 2 && ph >= K[k + 1][0]) k++; const A = K[k], B = K[k + 1], s = sm01((ph - A[0]) / (B[0] - A[0]));
    hydPose(Q.S, A[1] + (B[1] - A[1]) * s, A[2] + (B[2] - A[2]) * s, A[3] + (B[3] - A[3]) * s, A[4] + (B[4] - A[4]) * s);
    Q.S.load.visible = ph > 3 && ph < 14;
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
  for (const D of OPS.DOZ) {      // el dozer ordena el banco: empuja hacia la pila (o el frente), retrocede y se corre a la pasada siguiente
    const PER = 11, LN = [-6, 0, 6, 0], t = (tAnim + D.ph * 7) % (PER * 4), k = Math.floor(t / PER), q = (t % PER) / PER, l0 = LN[k], l1 = LN[(k + 1) % 4];
    let al, la, fx = D.fx, fz = D.fz;
    if (q < 0.55) { al = 14 * sm01(q / 0.55); la = l0; }
    else { const r = (q - 0.55) / 0.45, w = Math.sin(Math.PI * r) * (l1 - l0) * 0.12; al = 14 * (1 - sm01(r)); la = l0 + (l1 - l0) * sm01(r); fx = D.fx - D.tx * w; fz = D.fz - D.tz * w; const n = Math.hypot(fx, fz); fx /= n; fz /= n; }
    let X = D.x + D.fx * al + D.tx * la, Z = D.z + D.fz * al + D.tz * la;
    setWorldPose(D.g, X, Z, fx, fz);
  }
}
function drawTracks(pts) {      // huellas de camión: dos surcos oscuros (ruedas) siguiendo una curva suave por el piso
  if (!pts || pts.length < 2) return;
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, 0, p.z))); c.curveType = 'centripetal'; const N = Math.max(24, Math.round(c.getLength() / 3));
  for (const off of [-1.7, 1.7]) { const pos = []; for (let k = 0; k <= N; k++) { const p = c.getPoint(k / N), t = c.getTangent(k / N), nx = -t.z, nz = t.x, y = M.H(p.x, p.z) + 0.06; pos.push(p.x + nx * (off - 0.45), y, p.z + nz * (off - 0.45), p.x + nx * (off + 0.45), y, p.z + nz * (off + 0.45)); }
    const g = new THREE.BufferGeometry(), idx = []; for (let k = 0; k < N; k++) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    M.scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x2c2a27, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }))); }
}
function buildOps() {
  {      // fase 7: pala hidráulica PC9000 junto a la pala 6, cargando un camión a la vez a su costado
    const Q = M.F7EQ.pc, tx = -Q.fz, tz = Q.fx, S = buildHydShovel('4'); S.g.position.set(Q.x, M.H(Q.x, Q.z), Q.z); S.g.rotation.y = Math.atan2(Q.fx, Q.fz); M.scene.add(S.g); M.OBST.push({ x: Q.x, z: Q.z, r: 9 });
    const t = { x: Q.x - Q.fx * 2.2 + tx * 14, z: Q.z - Q.fz * 2.2 + tz * 14 }, mesh = protoOnc.clone(true), pile = makePile(); mesh.add(pile); addPlates(mesh, nextCaexId(), CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s); M.scene.add(mesh); setWorldPose(mesh, t.x, t.z, -Q.fx, -Q.fz); M.OBST.push({ x: t.x, z: t.z, r: 8 });
    OPS.HYD = { S, pile, fill: 0.3, prev: 0 }; hydPose(S, 0, 8.0, -5.0, 0);
  }
  {      // fondo mina (180 × 100 m): dos palas de cables cargando en sus pilas, dos canchas de perforación, un dozer y huellas de camiones
    const P = M.PIT, W = (a, b) => ({ x: P.x + P.ux * a * 1.5 + P.tx * b * 1.5, z: P.z + P.uz * a * 1.5 + P.tz * b * 1.5 }), inF = (a, b) => [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([da, db]) => { const q = W(a + da / 1.5, b + db / 1.5); return gdAt(q.x, q.z) === -1 && Math.abs(M.H(q.x, q.z) - FLOOR - M.PAD_UP) < 0.3; });      // sobre la cancha y a un burden de la cresta
    { const q = W(-112, 0); M.PIT.p1 = { x: q.x, z: q.z, fx: -P.ux, fz: -P.uz }; mkLoadZone(q.x, q.z, -P.ux, -P.uz, '1', 4.6); }
    { const q = W(40, 60); M.PIT.p5 = { x: q.x, z: q.z, fx: P.tx, fz: P.tz }; mkLoadZone(q.x, q.z, P.tx, P.tz, '5', 1.2); }      // pala 5 al pie de su pila (21 m del centro de la bahía)
    const cancha = (a0, a1, b0, b1, dr) => { const holes = []; for (let a = a0, row = 0; a <= a1; a += 8 / 1.5, row++) for (let b = b0 + (row % 2) * 4.6 / 1.5; b <= b1; b += 9.2 / 1.5) { if (!inF(a, b) || Math.hypot(a - dr[0], b - dr[1]) < 7) continue; holes.push(W(a + (hash(a, b) - 0.5) * 0.5, b + (hash(b, a) - 0.5) * 0.5)); } addHoles(holes); };      // malla tresbolillo 8 × 9,2 m (las coordenadas a, b van a escala 1,5)
    cancha(-40, 30, -100, -40, [0, -70]); { const q = W(0, -70); placeDrill(q.x, q.z, Math.atan2(P.ux, P.uz) + 0.4, false); }
    cancha(-95, -45, 40, 95, [-70, 70]); { const q = W(-70, 70); placeDrill(q.x, q.z, Math.atan2(-P.tx, -P.tz) - 0.3, false); }
    rockScatter((a, b) => { const an = a * 6.28, r = 0.8 + b * 0.3, ca = -140 + Math.cos(an) * 10 * r, cb = Math.sin(an) * 24 * r; return W(ca, cb); }, 50, 41);
    rockScatter((a, b) => { const an = a * 6.28, r = 0.8 + b * 0.3, ca = 40 + Math.sin(an) * 22 * r, cb = 78 + Math.cos(an) * 9 * r; return W(ca, cb); }, 40, 43);
  }
  for (const Q of M.F7EQ.palas) { mkLoadZone(Q.x, Q.z, Q.fx, Q.fz, Q.num, Q.off);      // fase 7: palas de cables en sus pilas
    rockScatter((a, b) => { const an = a * 6.28, r = 0.8 + b * 0.3, ca = 34 + Math.cos(an) * 17 * r, cb = Math.sin(an) * 40 * r; return { x: Q.x + Q.fx * ca - Q.fz * cb, z: Q.z + Q.fz * ca + Q.fx * cb }; }, 50, 61 + Q.num.charCodeAt(0)); }
  {      // apoyo al carguío: un wheel dozer por pala (en un paño plano al costado, fuera del giro y lejos de los camiones) que ordena el piso, y bulldozers de orugas sobre las pilas tronadas de la fase 7 empujando material hacia la pala
    const WD = M.F7EQ.palas.map(p => ({ x: p.x, z: p.z, fx: p.fx, fz: p.fz, h: M.f7h(p.x, p.z) })).concat([{ x: M.F7EQ.pc.x, z: M.F7EQ.pc.z, fx: M.F7EQ.pc.fx, fz: M.F7EQ.pc.fz, h: M.f7h(M.F7EQ.pc.x, M.F7EQ.pc.z) }, Object.assign({ h: FLOOR }, M.PIT.p5), Object.assign({ h: FLOOR }, M.PIT.p1)]);
    WD.forEach((p, k) => { const tmp = []; for (const o of M.OBST.filter(o => o.r === 8 && Math.hypot(o.x - p.x, o.z - p.z) < 40)) for (let t = 12; t <= 110; t += 12) tmp.push({ x: o.x - p.fx * t, z: o.z - p.fz * t, r: 12 }); M.OBST.push(...tmp);      // las salidas de los camiones quedan libres
      const q = workSite(p, p.fx, p.fz, p.h, [1, -1]); M.OBST.splice(M.OBST.length - tmp.length, tmp.length); if (q) addDozer(q.x, q.z, p.fx, p.fz, 2 + k * 1.7); });
    M.F7EQ.palas.forEach((p, k) => { const d = 46, la = 8 * (k % 2 ? 1 : -1); addDozer(p.x + p.fx * d - p.fz * la, p.z + p.fz * d + p.fx * la, -p.fx, -p.fz, 5 + k * 2.3, true); });      // sobre la pila, detras de la bahia, mirando a la pala
  }
  {      // huellas de los camiones desde cada pala hasta la salida: en la fase 7 al inicio del camino rojo (que lleva al portón), en el fondo a donde entra la azul
    const T7 = { x: SEC[0][SEC[0].length - 1][0], z: SEC[0][SEC[0].length - 1][1] }, TF = { x: SEC[6][SEC[6].length - 1][0], z: SEC[6][SEC[6].length - 1][1] };
    const palas = M.F7EQ.palas.map(p => ({ x: p.x, z: p.z, fx: p.fx, fz: p.fz, T: T7 })).concat([{ x: M.PIT.p5.x, z: M.PIT.p5.z, fx: M.PIT.p5.fx, fz: M.PIT.p5.fz, T: TF }, { x: M.PIT.x + M.PIT.ux * -112 * 1.5, z: M.PIT.z + M.PIT.uz * -112 * 1.5, fx: -M.PIT.ux, fz: -M.PIT.uz, T: TF }]);
    for (const p of palas) for (const o of M.OBST.filter(o => o.r === 8 && Math.hypot(o.x - p.x, o.z - p.z) < 40)) drawTracks(floorPath({ x: o.x - p.fx * 32, z: o.z - p.fz * 32 }, p.T));      // desde 32 m adelante de cada camión (ya fuera de la pala)
  }
}

export { OPS, buildDrills, buildOps, animOps };      // lo demás es interno; OPS se expone para el arnés de pruebas
