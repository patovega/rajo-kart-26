// Palas: pala de cables tipo 4100XPC (buildShovel + shovelPose/dumpTune), pila en la tolva (makePile) y pala hidráulica frontal (buildHydShovel + hydPose).
import { GRILLE_MAT, TRK, TRK2, bas, box, cyl, finePile, grimeTex, lam, plateMat, rockGeo } from './materiales.js';
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
function makePile() {      // montón de material tronado fino con colpas gruesas en la tolva
  const g = new THREE.Group(); g.position.y = 4.75;
  const m = finePile(2.9, 2.1, 3.9); m.position.set(0, 0.35, -2.1); g.add(m);
  return g;
}
function buildHydShovel(num) {      // pala hidráulica Komatsu PC5500 en configuración retro (≈540 t, 2 × 940 kW, balde de 28 m3): orugas de 9,7 × 2,7 m y 7,5 m de ancho total, cabina a 8,6 m del suelo, cola de 7,55 m, pluma de 10 m y brazo de 5,1 m; cilindros que siguen la pose
  const yel = lam(0xf0b20e, { map: grimeTex }), dk = lam(0x1f2023), blk = lam(0x2b2c2f), glass = lam(0x2d4250), rail = lam(0x161616), chrome = lam(0xc8c8c0), grisM = lam(0x4a4943, { map: grimeTex, side: THREE.DoubleSide }), acero = lam(0x8a8d90), g = new THREE.Group();
  const rod = (grp, a, b, r, m) => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), m); me.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); grp.add(me); return me; };
  const ext = (grp, pts, w, m, x = 0, bev = 0.1) => { const s = new THREE.Shape(); pts.forEach(([z, y], i) => i ? s.lineTo(-z, y) : s.moveTo(-z, y));      // perfil lateral [z, y] extruido a lo ancho con bisel
    const d = Math.max(0.02, w - 2 * bev), ge = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2 }); ge.translate(0, 0, -d / 2); ge.rotateY(Math.PI / 2); const me = new THREE.Mesh(ge, m); me.position.x = x; grp.add(me); return me; };
  // orugas: perfil con extremos redondos (rueda motriz atrás, guía adelante), zapatas, rodillos
  for (const sx of [-1, 1]) { const x = sx * 3.1, s = new THREE.Shape();      // orugas (tabla Komatsu): zapata A = 1,35 m, ancho total C_A = 7,54 m, largo H = 9,72 m, alto D = 2,72 m
    s.moveTo(-3.5, 0); s.lineTo(3.5, 0); s.absarc(3.5, 1.35, 1.35, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-3.5, 2.7); s.absarc(-3.5, 1.35, 1.35, Math.PI / 2, 3 * Math.PI / 2, false);
    const tg = new THREE.ExtrudeGeometry(s, { depth: 1.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 20 }); tg.rotateY(-Math.PI / 2); tg.translate(0.625, 0, 0); const tm = new THREE.Mesh(tg, TRK); tm.position.x = x; g.add(tm);
    for (let a = 0; a < 46; a++) { const t = a / 46 * (14 + 2 * Math.PI * 1.35); let zz, yy, rot = 0; if (t < 7) { zz = -3.5 + t; yy = 0; } else if (t < 7 + Math.PI * 1.35) { const an = (t - 7) / 1.35; zz = 3.5 + Math.sin(an) * 1.38; yy = 1.35 - Math.cos(an) * 1.38; rot = -an; } else if (t < 14 + Math.PI * 1.35) { zz = 3.5 - (t - 7 - Math.PI * 1.35); yy = 2.7; rot = Math.PI; } else { const an = (t - 14 - Math.PI * 1.35) / 1.35; zz = -3.5 - Math.sin(an) * 1.38; yy = 1.35 + Math.cos(an) * 1.38; rot = Math.PI + an; }
      const sh = box(g, 1.35, 0.1, 0.3, TRK2, x, yy, zz); sh.rotation.x = rot; }      // zapatas alrededor de toda la oruga
    cyl(g, 0.95, 0.95, 1.5, lam(0x3a3b3e), x, 1.35, -3.5, Math.PI / 2); cyl(g, 1.05, 1.05, 1.4, lam(0x3a3b3e), x, 1.35, 3.5, Math.PI / 2); cyl(g, 0.35, 0.35, 1.6, dk, x, 1.35, -3.5, Math.PI / 2); cyl(g, 0.35, 0.35, 1.55, dk, x, 1.35, 3.5, Math.PI / 2);
    for (let k = 0; k < 7; k++) cyl(g, 0.3, 0.3, 1.5, lam(0x3a3b3e), x, 0.55, -2.8 + k * 0.95, Math.PI / 2);      // 7 rodillos inferiores
    for (const z of [-1.6, 0, 1.6]) cyl(g, 0.22, 0.22, 1.45, lam(0x3a3b3e), x, 2.35, z, Math.PI / 2);      // 3 rodillos superiores
  }
  box(g, 5.0, 1.1, 6.4, dk, 0, 1.55, 0); cyl(g, 3.3, 3.5, 0.6, dk, 0, 2.6, 0); cyl(g, 2.9, 2.9, 0.4, dk, 0, 3.1, 0);      // bastidor (despeje E ≈ 1 m) y corona de giro hasta la base de la superestructura
  const house = new THREE.Group(); house.position.y = 3.31; g.add(house);      // superestructura: bajo ella I = 3,31 m; alto J = 3,1 m; de -3,3 m (N) a +3,97 m (M_B) del eje, pasillo hasta 4,6 m (M_A); cola P = 7,26 m
  ext(house, [[-5.0, 0.15], [-5.0, 2.95], [-4.4, 3.1], [1.6, 3.1], [1.6, 0.15]], 7.1, yel, 0.33, 0.14);      // sala de máquinas
  ext(house, [[-7.15, 0.3], [-7.15, 2.4], [-6.8, 2.95], [-5.0, 3.0], [-5.0, 0.15], [-6.7, 0.15]], 7.1, yel, 0.33, 0.14);      // contrapeso (cola P = 7,26 m del eje)
  box(house, 5.8, 1.9, 0.08, GRILLE_MAT, 0.33, 1.3, -7.33); for (let x = -2.3; x <= 2.9; x += 0.45) box(house, 0.06, 1.8, 0.06, blk, x, 1.3, -7.38);      // rejilla del radiador atrás
  for (const sx of [-1, 1]) for (const [z, w] of [[-3.7, 2.2], [-1.0, 2.0]]) { const xs = sx > 0 ? 4.02 : -3.35; box(house, 0.05, 2.3, w, dk, xs, 1.6, z); for (let y = 0.55; y <= 2.7; y += 0.17) box(house, 0.07, 0.05, w - 0.15, blk, xs + sx * 0.04, y, z); }      // paneles de persianas de ventilación
  ext(house, [[1.4, 0.15], [1.4, 2.9], [2.4, 3.1], [3.9, 2.7], [3.9, 0.15]], 3.4, yel, 0, 0.12);      // soporte de la pluma al frente
  box(house, 2.7, 2.0, 3.0, dk, 2.8, 1.15, 2.6);      // consola bajo la cabina
  box(house, 2.6, 2.4, 2.9, yel, 2.8, 3.3, 2.5); box(house, 2.7, 0.2, 3.1, yel, 2.8, 4.5, 2.5);      // cabina: techo a K = 7,91 m del suelo
  box(house, 2.25, 1.6, 0.06, glass, 2.8, 3.55, 3.98); box(house, 0.06, 1.6, 2.4, glass, 4.13, 3.55, 2.5); box(house, 0.06, 1.6, 2.4, glass, 1.49, 3.55, 2.5); box(house, 2.2, 1.6, 0.06, glass, 2.8, 3.55, 1.02);
  for (const [x, z] of [[1.55, 3.95], [4.05, 3.95], [4.05, 1.05], [1.55, 1.05]]) box(house, 0.12, 1.7, 0.12, yel, x, 3.55, z);
  box(house, 1.2, 0.1, 0.5, acero, 2.8, 4.65, 3.0); for (let k = 0; k < 3; k++) cyl(house, 0.1, 0.1, 0.2, bas(0xffb000), 2.25 + k * 0.4, 4.7, 1.6);      // faros y baliza sobre la cabina
  box(house, 0.62, 0.1, 8.6, rail, 4.3, 2.4, -2.9);      // pasillo lateral (hasta M_A = 4,6 m)
  for (const x of [-3.3, 4.6]) { const y0 = x > 0 ? 2.45 : 3.1; for (let z = -7.0; z <= 1.4; z += 1.7) rod(house, [x, y0, z], [x, y0 + 1.1, z], 0.04, rail); rod(house, [x, y0 + 1.1, -7.0], [x, y0 + 1.1, 1.4], 0.04, rail); rod(house, [x, y0 + 0.55, -7.0], [x, y0 + 0.55, 1.4], 0.03, rail); }
  rod(house, [-3.3, 4.2, -7.0], [4.0, 4.2, -7.0], 0.04, rail);
  cyl(house, 0.3, 0.3, 2.2, dk, -1.4, 4.2, -5.6); cyl(house, 0.3, 0.3, 2.2, dk, 1.4, 4.2, -5.6);      // escapes: arriba a L = 8,61 m del suelo
  for (let k = 0; k < 9; k++) box(house, 1.0, 0.08, 0.35, rail, -3.85, 0.3 + k * 0.33, -2.2 + k * 0.1);      // escalera lateral a la cubierta
  if (num) for (const sx of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), plateMat(num)); p.position.set(sx > 0 ? 4.06 : -3.4, 2.0, -5.6); p.rotation.y = sx * Math.PI / 2; house.add(p); }
  const boom = new THREE.Group(); boom.position.set(0, 3.1, 2.7); house.add(boom);      // pluma de 6,3 m con el pie en la cubierta (dibujos de la PC5500: pie a 2,7 m del eje y ~6,4 m del suelo; el pasador de 3,8 m es de los cilindros de la pluma)
  ext(boom, [[-0.6, -0.8], [3.0, -0.95], [5.8, -0.9], [6.65, -0.4], [6.85, 0.6], [5.7, 1.95], [3.2, 1.75], [0.5, 1.0], [-0.6, 0.5]], 2.0, yel, 0, 0.14);      // pluma de pala frontal con la joroba arriba (perfil de la guía)
  { const hose = lam(0x0b0b0b);      // mangueras hidráulicas en arco sobre la pluma (base y unión con el brazo)
    for (const [z0, y0, hh] of [[0.3, 1.0, 1.1], [3.4, 1.8, 0.9]]) { for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 0.15, pts = [[x, y0, z0], [x, y0 + hh * 0.75, z0 + 0.45], [x, y0 + hh, z0 + 1.1], [x, y0 + hh * 0.75, z0 + 1.75], [x, y0, z0 + 2.2]].map(q => new THREE.Vector3(...q)); boom.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.085, 6, false), hose)); }
      box(boom, 1.0, 0.12, 0.2, dk, 0, y0, z0); box(boom, 1.0, 0.12, 0.2, dk, 0, y0, z0 + 2.2); } }
  for (const sx of [-1, 1]) box(boom, 0.4, 0.8, 0.8, yel, sx * 0.9, -1.0, 5.3); box(boom, 2.2, 0.6, 0.8, yel, 0, -1.0, 3.0);      // orejas de los cilindros del balde (abajo de la punta) y de la pluma (abajo al medio)
  const stick = new THREE.Group(); stick.position.set(0, 0, 6.3); boom.add(stick);      // brazo de 6,1 m, en C (con el pie alto calzan la pose baja del dibujo y la alta de la guía)
  ext(stick, [[-0.7, -0.6], [1.5, -0.3], [3.2, -0.15], [5.0, -0.55], [6.1, -0.8], [6.3, 0.3], [5.2, 1.3], [3.2, 2.05], [1.4, 2.0], [-0.7, 1.1]], 2.5, yel, 0, 0.16); for (const sx of [-1, 1]) box(stick, 0.35, 0.7, 0.9, yel, sx * 1.4, 1.2, 1.3);      // brazo más ancho que la pluma: la abraza por fuera      // orejas de los cilindros del brazo      // brazo colgante: ancho arriba y más angosto hacia el balde, curvo (como la referencia)      // cuerpo del brazo: corto, grueso y con el lomo alto (como el de la PC5500)
  const cuenco = lam(0x8f9293, { map: grimeTex }), dienteM = lam(0x6d7071), banda = lam(0x55595b), liner = lam(0x5b5d5e), os = lam(0x3a3935);      // balde de pala frontal tipo caja (render y guía de la PC5500): respaldo amarillo fijo al brazo; concha de acero gris (costados, piso, labio y 7 dientes) colgada de una bisagra arriba
  const bucket = new THREE.Group(); bucket.position.set(0, 0, 6.1); stick.add(bucket);      // origen = pasador del brazo; +z adelante, balde nivelado con tilt 0: dientes ~4,4 m adelante y ~1,8 m bajo el pasador; respaldo de +1,65 a -2,2 m, ancho 4,8 m
  const W = 4.8, HZ = 1.1, HY = 0.75;      // bisagra de la concha: arriba, delante del respaldo
  const gh = new THREE.Group(); gh.position.set(0, HY, HZ); bucket.add(gh);      // la concha gira en la bisagra: al abrir, el piso y el labio se apartan del respaldo hacia adelante (rendija en V por abajo)
  const aH = pts => pts.map(([z, y]) => [z - HZ, y - HY]);
  // respaldo (fijo): orejas a los costados del brazo con los pasadores y placa trasera curva
  for (const sx of [-1, 1]) ext(bucket, [[-0.4, 1.65], [0.3, 1.7], [0.75, 1.2], [1.15, 0.4], [0.95, -0.6], [1.2, -1.7], [1.5, -2.1], [1.05, -2.25], [0.3, -1.5], [-0.25, -0.6], [-0.55, 0.6]], 0.3, yel, sx * 1.6, 0.06);      // orejas del respaldo (de +1,65 a -2,2 m del pasador, como en la guía)
  ext(bucket, [[0.85, 0.95], [1.15, 0.95], [1.25, -0.4], [1.4, -1.3], [1.65, -1.85], [1.9, -2.05], [1.6, -2.2], [1.35, -1.95], [1.1, -1.3], [0.95, -0.4]], W - 0.55, yel, 0, 0.08);      // placa trasera (cierra la caja por atrás)
  box(bucket, W - 0.4, 0.55, 0.7, yel, 0, 0.85, 0.75);      // viga de arriba del respaldo
  cyl(bucket, 0.42, 0.42, 3.6, os, 0, 0, 0, Math.PI / 2); cyl(bucket, 0.3, 0.3, 3.6, os, 0, 1.3, 0.15, Math.PI / 2); cyl(bucket, 0.28, 0.28, 3.6, os, 0, -1.35, 0.6, Math.PI / 2);      // pasadores: brazo, cilindros del balde y uno abajo
  for (const sx of [-1, 1]) for (const [y, z] of [[0, 0], [1.3, 0.15], [-1.35, 0.6]]) cyl(bucket, 0.5, 0.5, 0.12, acero, sx * 1.8, y, z, Math.PI / 2);      // tapas de los pasadores
  // concha (móvil)
  const lado = [[1.0, 0.95], [1.7, 0.95], [3.95, -1.25], [4.0, -1.85], [3.1, -2.2], [1.65, -2.2], [1.2, -1.6], [1.0, -0.5]];      // costado trapezoidal: alto atrás (~3 m), bajo adelante; piso de ~2,8 m
  for (const sx of [-1, 1]) { ext(gh, aH(lado), 0.26, cuenco, sx * (W / 2 - 0.13), 0.05);
    for (let i = 0; i < 5; i++) { const b = box(gh, 0.07, 0.14, 1.3, banda, sx * (W / 2 + 0.03), -0.6 - i * 0.32 - HY + 0.6, 2.3 - HZ + i * 0.05); b.rotation.x = 0.55; }      // bandas de desgaste en el costado
    box(gh, 0.34, 0.5, 2.3, cuenco, sx * (W / 2 - 0.05), 0.55 - HY - 0.05, 2.4 - HZ).rotation.x = 0.96;      // canto grueso del costado (borde de la boca)
    box(gh, 0.5, 0.75, 0.6, yel, sx * 1.0, 0, 0); }      // eslabones de la bisagra
  cyl(gh, 0.3, 0.3, W - 0.6, os, 0, 0, 0, Math.PI / 2);      // pasador de la bisagra
  ext(gh, aH([[1.25, -1.85], [2.6, -1.95], [3.95, -1.6], [4.0, -1.95], [2.6, -2.25], [1.3, -2.15]]), W - 0.3, cuenco, 0, 0.06);      // piso
  for (let z = 1.6; z < 3.8; z += 0.3) box(gh, W - 0.7, 0.06, 0.16, liner, 0, -1.92 - HY + (z - 1.6) * 0.12 + 0.02, z - HZ);      // placas de desgaste del piso
  box(gh, W - 0.3, 0.55, 0.55, cuenco, 0, 0.75 - HY, 1.5 - HZ);      // viga de la boca arriba
  box(gh, W, 0.4, 0.75, dienteM, 0, -1.78 - HY, 3.85 - HZ);      // labio
  for (let k = 0; k < 7; k++) { const x = (k - 3) * ((W - 0.7) / 6), t = new THREE.Group(); t.position.set(x, -1.8 - HY, 4.1 - HZ); t.rotation.x = 0.12; gh.add(t);      // 7 dientes con adaptador, separados, apuntando adelante
    const ad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.75), dienteM); ad.position.set(0, 0, 0.2); t.add(ad);
    const tg = new THREE.CylinderGeometry(0.08, 0.22, 0.65, 4); tg.rotateY(Math.PI / 4); const di = new THREE.Mesh(tg, dienteM); di.rotation.x = Math.PI / 2; di.position.set(0, -0.02, 0.85); di.scale.set(1.0, 1, 0.6); t.add(di); }
  for (let k = 0; k < 6; k++) box(gh, 0.24, 0.3, 0.6, banda, (k - 2.5) * ((W - 0.7) / 6), -1.72 - HY, 4.15 - HZ);      // protectores del labio entre dientes
  const load = new THREE.Group(); load.position.set(0, -0.8, 2.4); bucket.add(load);
  for (let k = 0; k < 8; k++) { const r = new THREE.Mesh(rockGeo, lam(k % 2 ? 0x6e5c49 : 0x8a7660)); const sc = 0.6 + 0.22 * (k % 3); r.scale.set(sc, sc * 0.7, sc); r.position.set((k % 4 - 1.5) * 0.95, -0.5 + (k % 2) * 0.4, -0.4 + Math.floor(k / 4) * 1.0); load.add(r); }
  const rods = [];      // cilindros hidráulicos: se reubican en cada pose entre un punto fijo y uno móvil; cuerpo amarillo y vástago cromado
  const cil = (oa, pa, ob, pb, r) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), yel), p = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 1, 10), chrome); g.add(b); g.add(p); rods.push({ b, p, oa, pa: new THREE.Vector3(...pa), ob, pb: new THREE.Vector3(...pb) }); };
  for (const sx of [-1, 1]) cil(house, [sx * 0.8, 0.5, 2.75], boom, [sx * 0.8, -1.2, 3.0], 0.45);      // cilindros de la pluma: abajo, del frente de la máquina al medio de la pluma (guía)
  for (const sx of [-1, 1]) cil(house, [sx * 1.35, 2.7, 3.3], stick, [sx * 1.4, 1.2, 1.3], 0.3);      // cilindros del brazo: casi horizontales, del frente de la máquina (bajo la cabina) a lo alto del brazo
  for (const sx of [-1, 1]) cil(boom, [sx * 0.9, -1.2, 5.3], bucket, [sx * 1.2, 1.3, 0.15], 0.3);      // cilindros del balde: de la punta de la pluma al pasador alto del respaldo
  box(stick, 0.9, 0.5, 0.7, yel, 0, -1.05, 2.6); cyl(stick, 0.22, 0.22, 1.1, lam(0x3a3935), 0, -1.2, 2.6, Math.PI / 2);      // oreja bajo el brazo (pasador del cilindro de apertura)
  cil(stick, [0, -1.2, 2.6], bucket, [0, -1.35, 0.6], 0.36);      // cilindro: baja por el brazo hasta el pasador de abajo del respaldo (no a la concha de los dientes)
  return { g, house, boom, stick, bucket, gate: gh, load, rods };
}
function hydPose(S, psi, r, y, tilt, ab) {      // ab: apertura de la placa trasera (0 cerrada, 1 abierta; si falta, según tilt)      // r, y: punto del balde respecto del pie de la pluma (cinemática inversa de dos tramos)
  const L1 = 6.3, L2 = 6.1, D = Math.max(L1 - L2 + 0.2, Math.min(L1 + L2 - 0.05, Math.hypot(r, y))), p1 = Math.atan2(y, r) + Math.acos(Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)));
  const p2 = Math.atan2(y - L1 * Math.sin(p1), r - L1 * Math.cos(p1));
  S.house.rotation.y = psi; S.boom.rotation.x = -p1; S.stick.rotation.x = -(p2 - p1); S.bucket.rotation.x = p2 - tilt; { const k = ab !== undefined ? ab : Math.max(0, Math.min(1, (-tilt - 0.3) / 0.6)); S.gate.rotation.x = -1.1 * k; }      // la concha gira en su bisagra de arriba: el labio y el piso se apartan del respaldo      // bisagra arriba: el borde de abajo se aparta hacia el operador y abre la rendija inferior      // la compuerta se abre y se separa del casco      // la compuerta se abre al descargar
  S.g.updateMatrixWorld(true); const A = new THREE.Vector3(), B = new THREE.Vector3(), d = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const R of S.rods) { A.copy(R.pa); R.oa.localToWorld(A); S.g.worldToLocal(A); B.copy(R.pb); R.ob.localToWorld(B); S.g.worldToLocal(B); d.subVectors(B, A); const len = d.length(); d.normalize();
    R.b.quaternion.setFromUnitVectors(up, d); R.p.quaternion.copy(R.b.quaternion); R.b.scale.y = len * 0.55; R.b.position.copy(A).addScaledVector(d, len * 0.275); R.p.scale.y = len * 0.6; R.p.position.copy(B).addScaledVector(d, -len * 0.3); }
}
export { buildShovel, dumpTune, shovelPose, makePile, buildHydShovel, hydPose };
