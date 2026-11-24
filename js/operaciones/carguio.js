// Carguío y apoyo sobre los pisos reales del plano (PISOS_DWG): palas de cables cargando camiones en los frentes (mkLoadZone), pala hidráulica PC9000, wheel dozers (addDozer, workSite),
// canchas de perforación con pozos y perforadoras (buildDrills), huellas de camiones (drawTracks) y su animación (animOps). Se arma con buildDrills y buildOps desde main.js.
import { mundo as M, setWorldPose } from '../mundo.js';
import { LANE, TAU, WR } from '../config/diseno.js';
import { CAMINOS_DWG, PISOS_DWG } from '../datos/terreno_dwg.js';
import { hash, sdPoly, sm01 } from '../comun/mates.js';
import { addPlates, lam, rockGeo } from '../modelos/materiales.js';
import { CAEX_PLATE, nextCaexId, protoOnc } from '../modelos/camiones.js';
import { buildHydShovel, buildShovel, dumpTune, hydPose, makePile, shovelPose } from '../modelos/palas.js';
import { buildCrawlerDrill, buildDrill, nextDrillNum } from '../modelos/perforadoras.js';
import { buildWheelDozer } from '../modelos/dozers.js';
import { motoniveladora } from '../modelos/motoniveladora.js';
import { RAMPAS } from '../comun/rampas.js';
import { floorPath, gdAt, onRoadC } from './malla.js';

const SHOV_T = 7.2;      // ciclo de la pala de cables (s): cava, gira, descarga y vuelve
const OPS = { LZ: [], DOZ: [], HYD: null, PALAS: [], HUELLAS: [], MOTO: [] };      // HUELLAS: puntos por donde pasan camiones (los cables los cruzan por postes)      // estado de las operaciones: palas de cables cargando (LZ), dozers (DOZ), pala hidráulica (HYD) y las palas con cable (PALAS: { x, z, fx, fz, num, cable })
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
const PERF_EN = [[78, -536]];      // perforadoras marcadas a mano: en la cancha que contiene el punto, la perforadora va ahí y la malla se centra en ella (pedido del usuario, 24-11-2026)
const PERF_PAR = [[[512, -47], [607, -87]]];      // pares de perforadoras marcadas a mano en un banco (pedido del usuario, 24-11-2026: banco de 1279 de la fase 7): una en cada punto y la malla entre las dos
function mallaPar([ax, az], [bx, bz]) {      // malla tresbolillo 8 × 9,2 m a lo largo del tramo entre las dos perforadoras, 5 filas, solo donde el banco está a la cota de los puntos
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, vx = -uz, vz = ux, y0 = (M.H(ax, az) + M.H(bx, bz)) / 2, holes = [];
  for (let r = -2; r <= 2; r++) for (let a = (r & 1) * 4.6; a <= L; a += 9.2) { const x = ax + ux * a + vx * r * 8 + (hash(a, r) - 0.5) * 0.6, z = az + uz * a + vz * r * 8 + (hash(r, a) - 0.5) * 0.6;
    if (Math.abs(M.H(x, z) - y0) < 2 && Math.hypot(x - ax, z - az) > 9 && Math.hypot(x - bx, z - bz) > 9) holes.push({ x, z }); }
  addHoles(holes); placeDrill(ax, az, Math.atan2(ux, uz) + 0.3, false); placeDrill(bx, bz, Math.atan2(-ux, -uz) + 0.3, false);
}
function buildDrills() {
  PERF_PAR.forEach(([a, b]) => mallaPar(a, b));      // canchas de perforación en terrazas planas junto a la ruta: malla tresbolillo 8 × 9,2 m (burden × espaciamiento) alineada con el eje largo del piso, centrada en el punto del piso más cercano a la ruta (C.cerca), a ≥ 12 m del borde; perforadora en el extremo de la malla y, en la segunda cancha, también la de orugas en el otro extremo
  CANCHAS.forEach((C, k) => {
    const sd = sdPoly(C.poly), ux = C.ux, uz = C.uz, vx = -uz, vz = ux, B = 8, S = 9.2, holes = [], mano = PERF_EN.find(([x, z]) => sd(x, z) < 0), cx = mano ? mano[0] : C.cerca[0], cz = mano ? mano[1] : C.cerca[1], y0 = M.H(cx, cz);
    const MB = C.marca ? 5 : 12;      // margen al borde (la terraza marcada es angosta)
    const dentro = (x, z) => sd(x, z) <= -MB && gdAt(x, z) === -1 && !onRoadC(x, z) && Math.abs(M.H(x, z) - y0) < 2.5;
    const libre = (x, z) => sd(x, z) <= -6 && gdAt(x, z) === -1 && !onRoadC(x, z) && Math.abs(M.H(x, z) - y0) < 2.5 && !M.OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 6);      // lugar para una perforadora: sobre el banco, fuera de los caminos
    let aMax = 0, aMin = 0; for (let a = 0; a <= 64; a += 4) { if (dentro(cx + ux * a, cz + uz * a)) aMax = a; else break; } for (let a = 0; a >= -64; a -= 4) { if (dentro(cx - ux * -a, cz - uz * -a)) aMin = a; else break; }      // largo de la malla hasta donde hay piso
    const sitio = (cands) => cands.map(([a, b]) => ({ x: cx + ux * a + vx * b, z: cz + uz * a + vz * b })).find(p => libre(p.x, p.z));
    const q = mano ? { x: cx, z: cz } : sitio([[aMax + 7, 0], [aMax + 5, 10], [aMax + 5, -10], [aMin - 7, 0], [0, 40], [0, -40], [aMax, 0]]) || { x: cx, z: cz };      // perforadora en el extremo de la malla (sobre el banco, nunca en un camino)
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
function bancoArriba(F, h0) {      // banco de arriba de un frente: cresta (t desde el frente hacia la pared, donde el terreno ya subió ≥ 12 m) y cota del banco
  let tc = 0; for (let t = 12; t <= 90; t += 2) { if (M.H(F.x + F.fx * t, F.z + F.fz * t) >= h0 + 12) { tc = t; break; } }
  if (!tc) return null; const y = M.H(F.x + F.fx * (tc + 14), F.z + F.fz * (tc + 14)); return { tc, y };
}
function mallaAvance(F, h0) {      // malla de tronadura sobre el banco de arriba, detrás de la cresta del frente que carga la pala (lo que se tronará después): filas paralelas a la cresta, la primera a un burden, tresbolillo 8 × 9,2 m; perforadora en un extremo
  const Bq = bancoArriba(F, h0); if (!Bq) return;
  const tx = -F.fz, tz = F.fx, B = 8, S = 9.2, holes = [];
  const ok = (x, z) => Math.abs(M.H(x, z) - Bq.y) < 2.0 && !onRoadC(x, z) && (gdAt(x, z) === -1 || gdAt(x, z) > WR + 16) && !M.OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 4);
  let bMin = 0, bMax = 0;
  for (let r = 0; r < 5; r++) { const d = Bq.tc + 6 + B + r * B; for (let b = -44 + (r % 2) * S / 2; b <= 44; b += S) {
    const x = F.x + F.fx * d + tx * b + (hash(r, b) - 0.5) * 0.6, z = F.z + F.fz * d + tz * b + (hash(b, r) - 0.5) * 0.6;
    if (ok(x, z)) { holes.push({ x, z }); bMin = Math.min(bMin, b); bMax = Math.max(bMax, b); } } }
  if (holes.length < 8) return;
  addHoles(holes);
  for (const [b, r] of [[bMax + 10, 1], [bMin - 10, 1], [bMax + 10, 3], [bMin - 10, 3], [0, 6]]) {      // perforadora en un extremo de la malla, sobre el banco
    const d = Bq.tc + 6 + B + r * B, x = F.x + F.fx * d + tx * b, z = F.z + F.fz * d + tz * b;
    if (ok(x, z)) { placeDrill(x, z, Math.atan2(tx, tz), false); return; } }
}
function frenteF7(otra) {      // otro frente de carguío en el piso de la fase 7: a 16 m del borde del piso contra una pared que sube un banco entero, lejos de la otra pala y de la ruta, con espacio atrás para los camiones
  if (!F7P) return null; const P = F7P.poly, sd = sdPoly(P), h0 = M.H(otra ? otra.x : F7P.cx, otra ? otra.z : F7P.cz); let best = null;
  for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
    for (let t = 4; t < L; t += 8) { const ex = ax + (bx - ax) * t / L, ez = az + (bz - az) * t / L;
      for (const sg of [1, -1]) { const nx = sg * (bz - az) / L, nz = -sg * (bx - ax) / L, x = ex - nx * 16, z = ez - nz * 16;      // n: hacia afuera del piso
        if (sd(x, z) > -8 || Math.abs(M.H(x, z) - h0) > 2 || onRoadC(x, z)) continue;
        const alto = M.H(ex + nx * 12, ez + nz * 12) - h0; if (alto < 12) continue;
        if (otra && Math.hypot(otra.x - x, otra.z - z) < 110) continue;
        let dr = 1e9; for (let s = 0; s <= 260; s += 10) { const f = M.frame(s); dr = Math.min(dr, Math.hypot(f.x - x, f.z - z)); } if (dr < 70) continue;
        let atras = true; for (let k = 20; k <= 50; k += 10) if (Math.abs(M.H(x - nx * k, z - nz * k) - h0) > 2.5) atras = false; if (!atras) continue;
        const sc = alto + 0.05 * Math.min(dr, 200); if (!best || sc > best.sc) best = { x, z, fx: nx, fz: nz, sc }; } } }
  return best;
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
  animMoto(tAnim);
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
const MOTO_LN = [5.5, 2, -1.5, -5], MOTO_CORD = -2.9;      // carriles de las pasadas (desplazamiento lateral, m) y dónde cae el cordón respecto del centro de la máquina: la hoja va en diagonal (punta trasera
      // al lado −), así cada pasada deja un cordón de tierra que la pasada siguiente (3,5 m más allá) recoge y vuelve a correr; el de la última queda en la orilla
const MOTO_EN = [[432.0, -95.0]];      // donde va la del camino de la celeste (se ve desde la partida); en los demás caminos va al medio      // motoniveladoras (GD955): perfilan el camino interior más cercano a cada punto (la celeste junto a la fase 7, se ve desde la partida)
function addMotoniveladora(C, sc, ph, terrones) {      // tramo de hasta 130 m del camino C centrado en sc (m desde su comienzo), muestreado cada 2 m (x, z, tangente)
  const cum = [0]; for (let k = 1; k < C.length; k++) cum.push(cum[k - 1] + Math.hypot(C[k][0] - C[k - 1][0], C[k][1] - C[k - 1][1]));
  const Lc = cum[cum.length - 1], La = Math.min(130, Lc - 10); if (La < 40) return;
  const s0 = Math.max(5, Math.min(Lc - 5 - La, sc - La / 2)), s1 = s0 + La, P = [];
  for (let s = s0, k = 0; s <= s1; s += 2) { while (k < C.length - 2 && cum[k + 1] < s) k++; const q = (s - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]); P.push({ x: C[k][0] + (C[k + 1][0] - C[k][0]) * q, z: C[k][1] + (C[k + 1][1] - C[k][1]) * q }); }
  if (P.length < 10) return;
  for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 3)], b = P[Math.min(P.length - 1, i + 3)], n = Math.hypot(b.x - a.x, b.z - a.z) || 1; P[i].tx = (b.x - a.x) / n; P[i].tz = (b.z - a.z) / n; }
  const g = motoniveladora(); M.scene.add(g);
  const mat = new THREE.MeshLambertMaterial({ color: 0x7f6648, flatShading: true, side: THREE.DoubleSide }), cord = MOTO_LN.map((off, k) => {      // cordón (camellón) de cada pasada: sección triangular irregular, ~1,8 m de ancho y 0,55–0,85 m de alto, tierra removida más oscura
    const o = off + MOTO_CORD, pos = [], idx = [];
    P.forEach((p, i) => { const nx = -p.tz, nz = p.tx, cx = p.x + nx * o, cz = p.z + nz * o, w = 0.8 + 0.3 * hash(i, k), h = 0.55 + 0.3 * hash(k, i), dl = (hash(i * 3, k) - 0.5) * 0.3;
      for (const [u, y] of [[-w, 0], [dl, h], [w, 0]]) { const x = cx + nx * u, z = cz + nz * u; pos.push(x, M.H(x, z) + 0.02 + y, z); } });
    for (let i = 0; i < P.length - 1; i++) { const a = 3 * i, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
    const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.setIndex(idx); ge.computeVertexNormals(); ge.setDrawRange(0, 0);
    const m = new THREE.Mesh(ge, mat); M.scene.add(m); return m; });
  const T2 = new THREE.Group();      // terrones que ruedan por la punta trasera de la hoja (malla compartida)
  if (terrones) { for (let k = 0; k < 10; k++) { const r = new THREE.Mesh(TERRON.g, TERRON.m); r.scale.setScalar(0.6 + 0.9 * hash(k, 7)); T2.add(r); } M.scene.add(T2); }
  OPS.MOTO.push({ g, P, ph, cord, terrones: T2 });
}
function animMoto(tAnim) {      // pasada hacia adelante con la hoja abajo (~7 km/h), levanta la hoja, retrocede (~13 km/h), la baja y se corre al carril siguiente
  for (const Q of OPS.MOTO) {
    const Lp = (Q.P.length - 1) * 2, tF = Lp / 2.0, tB = Lp / 3.6, T = tF + tB + 4, cyc = Math.floor((tAnim + Q.ph) / T), t = (((tAnim + Q.ph) % T) + T) % T, LN = MOTO_LN, kl = ((cyc % LN.length) + LN.length) % LN.length, off = LN[kl];      // tAnim es negativo durante la intro
    let s, alza;
    if (t < tF) { s = Lp * t / tF; alza = 0; } else if (t < tF + 2) { s = Lp; alza = (t - tF) / 2; } else if (t < tF + 2 + tB) { s = Lp * (1 - sm01((t - tF - 2) / tB)); alza = 1; } else { s = 0; alza = 1 - (t - tF - 2 - tB) / 2; }
    const f = s / 2, i = Math.min(Q.P.length - 2, Math.floor(f)), q = f - i, A = Q.P[i], B = Q.P[i + 1];
    let tx = A.tx + (B.tx - A.tx) * q, tz = A.tz + (B.tz - A.tz) * q; const n = Math.hypot(tx, tz) || 1; tx /= n; tz /= n;
    const x = A.x + (B.x - A.x) * q - tz * off, z = A.z + (B.z - A.z) * q + tx * off;
    setWorldPose(Q.g, x, z, tx, tz); Q.g.userData.hoja.position.y = 0.3 * alza;
    if (Q.px !== undefined) { const mx = x - Q.px, mz = z - Q.pz, dist = Math.hypot(mx, mz), sg = mx * tx + mz * tz >= 0 ? 1 : -1; if (dist < 5) for (const w of Q.g.userData.ruedas) w.rotation.x += sg * dist / 0.82; }
    Q.px = x; Q.pz = z;
    {      // cordones: el de esta pasada crece detrás de la punta de la hoja; el de la pasada anterior se recoge a medida que la hoja lo alcanza; el de la última pasada (orilla) queda siempre
      const n = Q.P.length - 1, ib = Math.max(0, Math.min(n, Math.round((s + 0.9) / 2))), adelante = t < tF;
      Q.cord.forEach((m, k) => { let a = 0, b = 0;
        if (k === LN.length - 1) { a = 0; b = n; }
        else if (k === kl) { a = 0; b = adelante ? ib : n; }
        else if (k === kl - 1 && adelante) { a = ib; b = n; }
        m.geometry.setDrawRange(12 * a, 12 * Math.max(0, b - a)); });
      const T2 = Q.terrones; T2.visible = adelante && s > 1;
      if (T2.visible) { const bx = x + tz * 2.7 + tx * 0.9, bz = z - tx * 2.7 + tz * 0.9;      // punta trasera de la hoja (lado −, un poco adelante del centro): la tierra rueda y cae hacia el cordón
        T2.children.forEach((r, k) => { const u = ((tAnim * (0.9 + 0.1 * (k % 3)) + k * 0.37) % 1 + 1) % 1, lx = bx + tz * (0.2 + u * 0.6) - tx * (u * 1.4 + 0.3 * hash(k, 3)), lz = bz - tx * (0.2 + u * 0.6) - tz * (u * 1.4 + 0.3 * hash(k, 3));
          r.position.set(lx, M.H(lx, lz) + 0.25 + 0.5 * (1 - u) * Math.abs(Math.sin(u * 6 + k)), lz); r.rotation.set(u * 9 + k, u * 7, k); }); }
    }
  }
}
const TERRON = { g: new THREE.DodecahedronGeometry(0.22, 0), m: new THREE.MeshLambertMaterial({ color: 0x8d7457, flatShading: true }) };
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
  const F7A = front(F7P, 0); if (F7A) pala(F7A, '2', 2.3, 'ruta');      // fase 7 (piso de la partida): pala de cables 2 con su cable por el portón de la rampa
  const F7B = frenteF7(F7A); if (F7B) pala(F7B, '5', 1.2, 'borde');      // fase 7: pala 5 en otro frente del mismo piso (cable desde una subestación en el borde)
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
  if (!F7B) { const MK = PISOS_DWG.find(p => p.marca), F = front(MK, 0) || front(FONDO, 2); if (F) pala(F, '5', 1.2, 'fondo'); }      // pala 5: en el frente de carguío de la terraza marcada (junto a la perforadora 403); si no hay, en el fondo
  for (const F of [F7A, F7B]) if (F) mallaAvance(F, M.H(F.x, F.z));      // fase 7: la malla que se tronará después, sobre el banco de arriba de cada frente
  OPS.PALAS.forEach((p, k) => {      // apoyo al carguío: un wheel dozer por pala, en un paño plano al costado (fuera del giro y lejos de los camiones y de sus salidas)
    const tmp = []; for (const o of M.OBST.filter(o => o.r === 8 && Math.hypot(o.x - p.x, o.z - p.z) < 40)) for (let t = 12; t <= 110; t += 12) tmp.push({ x: o.x - p.fx * t, z: o.z - p.fz * t, r: 12 }); M.OBST.push(...tmp);
    const q = workSite(p, p.fx, p.fz, p.h, [1, -1]); M.OBST.splice(M.OBST.length - tmp.length, tmp.length); if (q) addDozer(q.x, q.z, p.fx, p.fz, 2 + k * 1.7);
  });
  for (const p of OPS.PALAS) {      // huellas de los camiones de cada pala hasta la salida de su piso (fase 7: la rampa; fondo: donde empieza su camino interior)
    const f = M.frame(80), T = p.cable !== 'fondo' ? { x: f.x, z: f.z } : (FONDO && FONDO.salida ? { x: FONDO.salida[0], z: FONDO.salida[1] } : null); if (!T) continue;
    for (const o of M.OBST.filter(o => o.r === 8 && Math.hypot(o.x - p.x, o.z - p.z) < 40)) drawTracks(floorPath({ x: o.x - p.fx * 32, z: o.z - p.fz * 32 }, T));      // desde 32 m adelante de cada camión (ya fuera de la pala)
  }
  RAMPAS.forEach((R, k) => {      // una motoniveladora por rampa con nombre, en su tramo más largo (al medio, o junto al punto de MOTO_EN si el tramo pasa por ahí)
    const lg = C => { let l = 0; for (let i = 1; i < C.length; i++) l += Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]); return l; };
    const C = R.caminos.map(i => CAMINOS_DWG[i]).sort((a, b) => lg(b) - lg(a))[0]; if (!C || C.length < 2) return; let sc = null, cum = 0, Lc = 0; for (let i = 1; i < C.length; i++) Lc += Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]);
    for (const [x, z] of MOTO_EN) { cum = 0; for (let i = 0; i < C.length; i++) { if (i) cum += Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]); if (Math.hypot(C[i][0] - x, C[i][1] - z) < 40) { sc = cum; break; } } }
    addMotoniveladora(C, sc ?? Lc / 2, 7 + k * 37.3, sc !== null); });
  for (const C of CAMINOS_DWG) for (const off of [-LANE, LANE]) {      // huellas en todos los caminos interiores: una pista por sentido, a ±LANE como en la ruta
    const pts = []; for (let k = 0; k < C.length; k++) { const a = C[Math.max(0, k - 1)], b = C[Math.min(C.length - 1, k + 1)], tx = b[0] - a[0], tz = b[1] - a[1], n = Math.hypot(tx, tz) || 1; pts.push({ x: C[k][0] - tz / n * off, z: C[k][1] + tx / n * off }); }
    drawTracks(pts);
  }
}

export { OPS, buildDrills, buildOps, animOps };      // lo demás es interno; OPS se expone para los cables y el arnés de pruebas
