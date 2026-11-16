// Palas: pala de cables tipo 4100XPC (buildShovel + shovelPose/dumpTune), pila en la tolva (makePile) y pala hidráulica frontal (buildHydShovel + hydPose).
import { GRILLE_MAT, TRK, TRK2, box, cyl, grimeTex, lam, plateMat, rockGeo } from './materiales.js';
import { hash, sm01 } from '../comun/mates.js';

function buildShovel(num) {      // pala de cables tipo P&H 4100XPC: orugas, sala de máquinas amarilla con franjas negras, cabina adelante a la izquierda, pórtico, pluma negra con roldana, mango y balde negros
  const g = new THREE.Group(), yel = lam(0xe8b80c), dk = lam(0x1e1f22), blk = lam(0x2a2b2e), gray = lam(0x585c60), glass = lam(0x22313d), rail = lam(0x111111), red = lam(0xc0281e), ropeY = lam(0xd8b020);
  // orugas: cadena negra con zapatas, ruedas motrices atrás y adelante
  for (const sx of [-1, 1]) {
    const tr = new THREE.Group(); tr.position.set(sx * 5.2, 0, 0); g.add(tr);      // medidas tipo 4100XPC: orugas de ~12,8 m de largo y ~13 m de ancho total
    box(tr, 2.8, 2.1, 12.4, TRK, 0, 1.15, 0);      // oruga gris oscuro
    for (const z of [-6.2, 6.2]) { const w = cyl(tr, 1.15, 1.15, 2.8, TRK, 0, 1.15, z); w.rotation.z = Math.PI / 2; }
    for (let z = -5.8; z <= 5.8; z += 1.0) box(tr, 2.9, 0.18, 0.5, TRK2, 0, 2.25, z);      // zapatas
    for (let z = -4.5; z <= 4.5; z += 1.5) { const r = cyl(tr, 0.45, 0.45, 2.86, gray, 0, 0.95, z); r.rotation.z = Math.PI / 2; }      // rodillos
  }
  box(g, 7.8, 1.6, 8.0, blk, 0, 1.7, 0);      // chasis inferior entre las orugas (por atrás entra el cable)
  cyl(g, 4.2, 4.4, 0.9, dk, 0, 2.95, 0);       // corona de giro
  const house = new THREE.Group(); house.position.y = 3.4; g.add(house);
  // sala de máquinas
  box(house, 11.0, 1.0, 13.0, dk, 0, 0.5, -1.0);      // sala de ~10,7 m de ancho                 // base negra
  box(house, 10.6, 5.8, 10.8, yel, 0, 3.9, -2.0);                 // cuerpo amarillo
  box(house, 10.7, 0.5, 10.9, dk, 0, 2.2, -2.0);                  // franja negra baja
  box(house, 10.7, 0.4, 10.9, dk, 0, 6.6, -2.0);                  // borde superior negro
  box(house, 7.0, 1.8, 4.0, yel, -1.4, 7.6, -5.0);              // caseta trasera superior (equipos)
  box(house, 11.0, 3.2, 2.6, blk, 0, 2.7, -8.6);      // contrapeso (radio de cola ~11 m)                 // contrapeso negro atrás
  box(house, 2.4, 3.4, 2.4, yel, 4.1, 3.8, 4.3);                // caja de equipos adelante a la derecha
  // cabina del operador: adelante a la izquierda, elevada, con techo y vidrios
  box(house, 3.4, 2.8, 3.6, yel, -3.4, 7.8, 2.6);
  box(house, 3.7, 0.35, 3.9, yel, -3.4, 9.35, 2.7);
  box(house, 3.0, 1.5, 0.1, glass, -3.4, 8.2, 4.42); box(house, 0.1, 1.5, 2.6, glass, -5.12, 8.2, 2.6);
  // barandas y escalera
  for (const z of [-7.0, -4.2, -1.4, 1.4]) for (const sx of [-1, 1]) box(house, 0.08, 1.1, 0.08, rail, sx * 5.4, 7.4, z);
  for (const sx of [-1, 1]) box(house, 0.08, 0.08, 8.6, rail, sx * 5.4, 7.95, -2.8);
  for (let k = 0; k < 7; k++) box(house, 1.2, 0.1, 0.4, rail, -5.5, 1.2 + k * 0.9, -5.2 + k * 0.6);
  // número 3: atrás (contrapeso) y en los dos costados
  const nc = document.createElement('canvas'); nc.width = 256; nc.height = 256; const nx = nc.getContext('2d');
  nx.fillStyle = '#111'; nx.font = '900 220px Arial, sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle'; nx.fillText(num || '3', 128, 140);
  const n3m = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc), transparent: true, side: THREE.DoubleSide });
  const ncw = document.createElement('canvas'); ncw.width = 256; ncw.height = 256; const nw = ncw.getContext('2d');
  nw.fillStyle = '#f2c20e'; nw.font = '900 220px Arial, sans-serif'; nw.textAlign = 'center'; nw.textBaseline = 'middle'; nw.fillText(num || '3', 128, 140);
  const back3 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ncw), transparent: true, side: THREE.DoubleSide }));
  back3.position.set(0, 2.7, -9.95); back3.rotation.y = Math.PI; house.add(back3);
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), n3m); m.position.set(sx * 5.36, 4.3, -1.4); m.rotation.y = sx * Math.PI / 2; house.add(m); }
  // pórtico (A) sobre la sala, con poleas rojas
  const gtop = { y: 13.2, z: -3.0 };
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * 1.6, 6.6, -0.6); house.add(leg);
    const l1 = box(leg, 0.5, 6.8, 0.5, blk, 0, 3.2, 0); l1.rotation.x = -0.36;
  }
  box(house, 3.8, 0.6, 0.8, blk, 0, gtop.y, gtop.z); cyl(house, 0.5, 0.5, 3.2, red, 0, gtop.y + 0.5, gtop.z).rotation.z = Math.PI / 2;
  // pluma negra con roldana en la punta
  const boom = new THREE.Group(); boom.position.set(0, 4.2, 4.6); boom.rotation.x = -0.72; house.add(boom);
  box(boom, 2.6, 1.8, 21, blk, 0, 0, 10.4);      // pluma de ~21 m
  const sheave = cyl(boom, 1.7, 1.7, 1.0, blk, 0, 0.6, 20.6); sheave.rotation.z = Math.PI / 2;
  cyl(boom, 0.6, 0.6, 1.1, yel, 0, 0.6, 20.6).rotation.z = Math.PI / 2;
  const tip = { y: 4.2 + 21 * Math.sin(0.72) + 0.6, z: 4.6 + 21 * Math.cos(0.72) };
  // cables de suspensión de la pluma (del pórtico a la punta)
  for (const sx of [-0.5, 0.5]) {
    const a = new THREE.Vector3(sx, gtop.y + 0.3, gtop.z), b = new THREE.Vector3(sx, tip.y - 0.8, tip.z - 0.6), v = b.clone().sub(a);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), dk); c.scale.y = v.length(); c.position.copy(a).add(b).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); house.add(c);
  }
  // mango (negro) y balde (negro, con dientes)
  const arm = new THREE.Group(); arm.position.set(0, 8.6, 10.0); house.add(arm);
  box(arm, 2.2, 1.4, 2.4, blk, 0, 0, 0);      // silla del mango sobre la pluma
  const stick = new THREE.Group(); arm.add(stick); box(stick, 1.4, 1.4, 14.5, blk, 0, 0, 6.2);
  const bucket = new THREE.Group(); bucket.position.set(0, -0.6, 13.6); bucket.scale.setScalar(1.25); stick.add(bucket);      // balde de ~5,5 m de ancho
  for (const sx of [-1, 1]) box(bucket, 0.3, 3.4, 3.8, blk, sx * 2.05, -1.3, 0);      // balde abierto: costados, frente y espalda; el piso es la compuerta
  box(bucket, 4.4, 3.4, 0.3, blk, 0, -1.3, 1.75); box(bucket, 4.4, 3.4, 0.3, blk, 0, -1.3, -1.75);
  box(bucket, 4.6, 0.5, 0.9, gray, 0, 0.35, 1.6);
  for (let k = -2; k <= 2; k++) box(bucket, 0.35, 0.35, 0.8, gray, k * 0.95, 0.35, 2.3);      // labio y dientes arriba, en el borde de la boca (la compuerta es el fondo)
  const door = new THREE.Group(); door.position.set(0, -2.95, -1.75); bucket.add(door);      // compuerta inferior: bisagra atrás, se abre hacia abajo para descargar
  box(door, 4.1, 0.3, 3.5, blk, 0, 0, 1.75); box(door, 0.5, 0.5, 0.6, gray, 0, -0.2, 3.3);      // con su pestillo
  const load = new THREE.Group(); load.position.set(0, -1.4, 0); bucket.add(load);      // material dentro del balde (cae al abrir)
  for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(rockGeo, lam(k % 2 ? 0x6e5c49 : 0x8a7660)); const sc = 0.7 + 0.3 * (k % 3); r.scale.set(sc, sc * 0.7, sc); r.position.set((k % 3 - 1) * 1.2, (k % 2) * 0.5, (Math.floor(k / 3) - 1) * 1.1); load.add(r); }
  box(bucket, 0.5, 2.2, 0.5, blk, -1.6, 1.0, -0.4); box(bucket, 0.5, 2.2, 0.5, blk, 1.6, 1.0, -0.4); box(bucket, 3.7, 0.4, 0.5, blk, 0, 2.1, -0.4);      // asa
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 6), ropeY); house.add(rope);      // cables de levante (se ajustan con la pose)
  return { g, house, arm, stick, bucket, door, load, rope, tip };
}
function dumpTune(sv, H) {      // H(x, z): cota del terreno      // para cada lado, el ángulo de descarga que deja el fondo del balde ~1,5 m sobre el borde de la tolva (según la cota del piso donde se cuadra el camión)
  sv.thD = {};
  for (const sw of [1, -1]) {
    let lo = -0.6, hi = 0.6; sv.swing = sw;
    for (let it = 0; it < 18; it++) { const th = (lo + hi) / 2; sv.thD[sw] = th; shovelPose(sv, 4.0); sv.g.updateMatrixWorld(true); const bp = sv.bucket.getWorldPosition(new THREE.Vector3());
      const gap = bp.y - 3.75 - (H(bp.x, bp.z) + 6.75); if (gap > 1.5) lo = th; else hi = th; }      // th mayor = balde más abajo
  }
}
function shovelPose(sv, ph) {      // cava en el banco → gira → descarga en el camión → vuelve
  const S = (sv.swing || 1) * Math.PI / 2, TH_DUMP = sv.thD ? sv.thD[sv.swing || 1] : -0.05;      // cava abajo en el frente, gira 90° al camión de la izquierda o de la derecha, descarga y vuelve
  let psi = 0, th = 1.15 - 0.35 * Math.min(1, ph / 2.0), ext = 0.2 + 1.0 * Math.min(1, ph / 2.0), tilt = 0;
  if (ph >= 2.0 && ph < 3.6) { const k = sm01((ph - 2.0) / 1.6); psi = S * k; th = 0.8 - (0.8 - TH_DUMP) * k; ext = 1.2 - 0.7 * k; }
  else if (ph >= 3.6 && ph < 4.6) { psi = S; th = TH_DUMP; ext = 0.5; tilt = Math.sin(Math.PI * (ph - 3.6)) * 0.9; }
  else if (ph >= 4.6 && ph < 6.2) { const k = sm01((ph - 4.6) / 1.6); psi = S * (1 - k); th = TH_DUMP + (1.15 - TH_DUMP) * k; ext = 0.5 - 0.3 * k; }
  else if (ph >= 6.2) { th = 1.15; ext = 0.2; }
  sv.house.rotation.y = psi; sv.arm.rotation.x = th; sv.stick.position.z = ext; sv.bucket.rotation.x = 0;
  if (sv.door) {      // descarga: la compuerta de abajo se abre y el material cae; al volver se cierra y el balde se llena en el frente
    sv.door.rotation.x = 1.25 * Math.min(1, tilt / 0.6);
    const fall = ph >= 3.6 && ph < 4.6 ? (ph - 3.6) : ph >= 4.6 && ph < 5.0 ? 1 : 0;
    sv.load.visible = !(ph >= 4.0 && ph < 6.4); sv.load.position.y = -1.4 - 6 * fall * fall;
  }
  if (sv.rope) {      // cables de levante (amarillos): de la punta de la pluma al balde
    const c = Math.cos(th), s = Math.sin(th), bz = 13.6 + ext, by = 0.4, ap = sv.arm.position;
    const bx = { y: ap.y + by * c - bz * s, z: ap.z + by * s + bz * c }, tp = sv.tip;
    _rv.set(0, bx.y - tp.y, bx.z - tp.z); const len = _rv.length();
    sv.rope.position.set(0, (tp.y + bx.y) / 2, (tp.z + bx.z) / 2); sv.rope.scale.set(1, len, 1); sv.rope.quaternion.setFromUnitVectors(_ry, _rv.normalize());
  }
}
const _rv = new THREE.Vector3(), _ry = new THREE.Vector3(0, 1, 0);
function makePile() {
  const g = new THREE.Group(); g.position.y = 4.75;
  const rm = [lam(0x6e5c49), lam(0x8a7660), lam(0x574a3b)];
  for (let i = 0; i < 36; i++) {
    const x = (hash(i, 1) - 0.5) * 5.0, z = -2.1 + (hash(i, 2) - 0.5) * 7.2, sc = 0.55 + hash(i, 3) * 0.7;
    const h = 0.4 + 1.9 * Math.max(0, 1 - (x / 2.9) ** 2) * Math.max(0, 1 - ((z + 2.1) / 3.9) ** 2);
    const r = new THREE.Mesh(rockGeo, rm[i % 3]); r.scale.set(sc, sc * 0.75, sc);
    r.position.set(x, h + sc * 0.3, z); r.rotation.set(hash(i, 4) * 3, hash(i, 5) * 3, hash(i, 6) * 3); g.add(r);
  }
  return g;
}
function buildHydShovel(num) {      // pala hidráulica grande tipo PC9000 (pala frontal): orugas grises, superestructura amarilla con cabina adelante a la izquierda, pluma y brazo con cilindros, balde frontal
  const yel = lam(0xf0b90e, { map: grimeTex }), dk = lam(0x1f2023), blk = lam(0x2b2c2f), glass = lam(0x2d4250), rail = lam(0x161616), chrome = lam(0xc8c8c0), g = new THREE.Group();
  for (const sx of [-1, 1]) { box(g, 2.0, 2.0, 10.6, TRK, sx * 3.6, 1.0, 0); for (const z of [-5.0, 5.0]) { const w = cyl(g, 1.0, 1.0, 2.05, TRK, sx * 3.6, 1.0, z); w.rotation.z = Math.PI / 2; }
    for (let z = -4.8; z <= 4.8; z += 0.8) box(g, 2.1, 0.12, 0.42, TRK2, sx * 3.6, 2.03, z); box(g, 0.3, 1.0, 7.5, blk, sx * 4.62, 1.0, 0); }
  box(g, 5.2, 1.6, 6.0, blk, 0, 1.9, 0); cyl(g, 3.0, 3.2, 0.6, dk, 0, 2.9, 0);
  const house = new THREE.Group(); house.position.y = 3.2; g.add(house);
  box(house, 8.6, 4.0, 9.6, yel, 0, 2.0, -1.4);                 // sala de máquinas (~8,6 m de ancho)
  box(house, 8.7, 2.6, 2.0, yel, 0, 1.5, -6.9);                  // contrapeso
  box(house, 8.0, 2.6, 0.1, GRILLE_MAT, 0, 2.6, -7.95);          // rejillas de los radiadores atrás
  box(house, 2.8, 2.8, 3.0, yel, 2.7, 5.4, 2.0); box(house, 2.4, 1.5, 0.08, glass, 2.7, 5.7, 3.52); box(house, 0.08, 1.5, 2.4, glass, 4.12, 5.7, 2.0);      // cabina adelante a la izquierda (~9 m de alto)
  box(house, 3.0, 2.2, 3.4, yel, -2.4, 5.1, -4.5);               // caseta de equipos arriba atrás
  for (const z of [-6.0, -3.0, 0, 3.0]) for (const sx of [-1, 1]) box(house, 0.06, 1.1, 0.06, rail, sx * 4.25, 4.55, z);
  for (const sx of [-1, 1]) box(house, 0.06, 0.06, 9.2, rail, sx * 4.25, 5.1, -1.5);
  for (let k = 0; k < 7; k++) box(house, 1.0, 0.08, 0.35, rail, -4.7, 0.3 + k * 0.6, -6.0 + k * 0.45);      // escalera
  if (num) for (const sx of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), plateMat(num)); p.position.set(sx * 4.32, 2.6, -2.5); p.rotation.y = sx * Math.PI / 2; house.add(p); }
  const boom = new THREE.Group(); boom.position.set(0, 3.4, 3.4); house.add(boom);      // pluma de 10 m
  box(boom, 2.2, 2.0, 10.4, yel, 0, 0, 5.0);
  for (const sx of [-1, 1]) { const c = cyl(boom, 0.32, 0.32, 6.0, chrome, sx * 1.3, -1.0, 3.5); c.rotation.x = Math.PI / 2; }      // cilindros de la pluma
  const stick = new THREE.Group(); stick.position.set(0, 0, 10); boom.add(stick);      // brazo de 6,5 m
  box(stick, 1.7, 1.7, 6.9, yel, 0, 0, 3.1); { const c = cyl(stick, 0.28, 0.28, 5.0, chrome, 0, 1.2, 2.5); c.rotation.x = Math.PI / 2; }
  const bucket = new THREE.Group(); bucket.position.set(0, 0, 6.5); stick.add(bucket);      // balde frontal (~5 m de ancho)
  box(bucket, 5.0, 0.3, 3.8, yel, 0, -2.0, 1.4); for (const sx of [-1, 1]) box(bucket, 0.3, 3.6, 3.8, yel, sx * 2.5, -0.4, 1.4); box(bucket, 5.0, 3.6, 0.3, yel, 0, -0.4, -0.4);
  for (let k = -2; k <= 2; k++) box(bucket, 0.4, 0.4, 0.8, lam(0x8a8d90), k * 1.0, -2.0, 3.6);      // dientes
  const load = new THREE.Group(); bucket.add(load);
  for (let k = 0; k < 8; k++) { const r = new THREE.Mesh(rockGeo, lam(k % 2 ? 0x6e5c49 : 0x8a7660)); const sc = 0.7 + 0.25 * (k % 3); r.scale.set(sc, sc * 0.7, sc); r.position.set((k % 4 - 1.5) * 1.1, -0.8 + (k % 2) * 0.5, 0.6 + Math.floor(k / 4) * 1.4); load.add(r); }
  return { g, house, boom, stick, bucket, load };
}
function hydPose(S, psi, r, y, tilt) {      // r, y: punto del balde respecto del pie de la pluma (cinemática inversa de dos tramos)
  const L1 = 10, L2 = 6.5, D = Math.min(L1 + L2 - 0.05, Math.hypot(r, y)), p1 = Math.atan2(y, r) + Math.acos(Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)));
  const p2 = Math.atan2(y - L1 * Math.sin(p1), r - L1 * Math.cos(p1));
  S.house.rotation.y = psi; S.boom.rotation.x = -p1; S.stick.rotation.x = -(p2 - p1); S.bucket.rotation.x = p2 - tilt;
}

export { buildShovel, dumpTune, shovelPose, makePile, buildHydShovel, hydPose };
