// Cables de las palas y energía sobre el terreno real: postes pasacables (cablePost), subestación de la pala de la fase 7 en la superficie con su cable y el portón de la rampa
// (buildPowerLine, deja M.GATE), y SEM 6 junto a la tercera curva del camino al fondo con los cables de las palas del fondo (buildCable2). Cada cable baja por las paredes del rajo (cableRoute) y, donde cruza un camino, sube a dos postes.
import { mundo as M } from '../mundo.js';
import { WR } from '../config/diseno.js';
import { SEM6_DWG } from '../datos/terreno_dwg.js';
import { hash } from '../comun/mates.js';
import { bas, box, cyl, lam } from '../modelos/materiales.js';
import { OPS } from './carguio.js';
import { cableRoute, gdAt, onRoadC } from './malla.js';

const CABLES = { CABLE: null, CABLE2: null };      // cable de la ruta (pala 2) y primer cable del fondo (para el arnés de pruebas)
const pl = (al, la) => { const f = M.frame(M.PLAT.se + al); return { x: f.x + f.rx * M.PLAT.side * la, z: f.z + f.rz * M.PLAT.side * la, tx: f.tx, tz: f.tz, nx: f.rx * M.PLAT.side, nz: f.rz * M.PLAT.side }; };
const CTOP = 18.2;      // altura del cable en los postes
function cablePost(x, z, ax, az) {      // poste pasacables rojo y blanco de 18 m (si ya hay uno en ese punto, se comparte)
  if (M.OBST.some(o => o.r === 1.6 && Math.hypot(o.x - x, o.z - z) < 3)) return;
  const red = lam(0xe0401a), wh = lam(0xf4f4f4), g = new THREE.Group();
  for (let y = 0; y < 18; y += 1.5) box(g, 0.55, 1.5, 0.55, (Math.floor(y / 1.5) % 2) ? wh : red, 0, y + 0.75, 0);
  box(g, 3.0, 0.35, 0.35, wh, 0, 18, 0); box(g, 1.6, 0.6, 1.6, lam(0x1d1f22), 0, 0.25, 0);
  g.position.set(x, M.H(x, z), z); g.rotation.y = Math.atan2(ax, az) + Math.PI / 2; M.scene.add(g); M.OBST.push({ x, z, r: 1.6 });
}
function cableSpan(out, a, b, n) { const ya = M.H(a.x, a.z) + CTOP, yb = M.H(b.x, b.z) + CTOP; for (let k = 1; k < n; k++) { const t = k / n; out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, ya + (yb - ya) * t - 5.6 * t * (1 - t), a.z + (b.z - a.z) * t)); } out.push(new THREE.Vector3(b.x, yb, b.z)); }
function sem6(p, rot) {      // SEM 6 como la real: sala eléctrica naranja sobre remolque (transformador con aletas y baranda adelante, sala alta con equipos de clima, escalera atrás) + carro solar con mástil de comunicaciones + letrero
  const g = new THREE.Group(), na = lam(0xe8701c), naO = lam(0xc75c12), dk = lam(0x2b2e33), gr = lam(0x9a9ea3), rj = lam(0xb8341c), ll = lam(0x1d1d1f), ac = lam(0xb9bcc0);
  box(g, 14.2, 0.35, 3.0, naO, 0, 1.25, 0); for (const z of [-1.1, 1.1]) box(g, 14.0, 0.45, 0.3, dk, 0, 0.85, z);      // cubierta y vigas del remolque
  for (const x of [-5.3, -4.0, 5.0]) for (const z of [-1.25, 1.25]) { cyl(g, 0.55, 0.55, 0.42, ll, x, 0.55, z * 1.08, Math.PI / 2); cyl(g, 0.3, 0.3, 0.44, ac, x, 0.55, z * 1.08, Math.PI / 2); }      // ruedas del remolque
  box(g, 9.4, 3.0, 2.9, na, -2.3, 2.95, 0); box(g, 9.6, 0.15, 3.1, naO, -2.3, 4.5, 0);      // sala eléctrica
  for (let x = -6.8; x <= 2.2; x += 0.6) for (const z of [-1.47, 1.47]) box(g, 0.08, 2.8, 0.04, naO, x, 2.95, z);      // costillas del contenedor
  for (const x of [-3.2, -0.8]) { box(g, 1.1, 1.0, 0.4, ac, x, 3.0, 1.65); box(g, 0.9, 0.8, 0.05, dk, x, 3.0, 1.86); }      // equipos de clima al costado
  box(g, 0.9, 2.1, 0.06, naO, -5.6, 2.55, 1.48); box(g, 0.9, 2.1, 0.06, naO, -5.6, 2.55, -1.48);      // puertas
  for (const x of [-6.2, -4.6, -2.0, 0.8]) box(g, 0.5, 0.4, 0.25, rj, x, 1.75, -1.58);      // cajas de conexión de los cables
  box(g, 4.0, 2.0, 2.4, na, 4.6, 2.45, 0);      // transformador
  for (let x = 2.9; x <= 6.4; x += 0.22) for (const z of [-1.0, 1.0]) box(g, 0.07, 1.7, 0.6, naO, x, 2.4, z * 1.45);      // aletas del radiador
  for (const x of [3.4, 4.6, 5.8]) cyl(g, 0.15, 0.15, 0.9, ac, x, 3.9, 0);      // bushings
  for (const z of [-1.45, 1.45]) { for (let x = 2.6; x <= 7.0; x += 1.1) cyl(g, 0.04, 0.04, 1.1, na, x, 4.0, z); cyl(g, 0.04, 0.04, 4.4, na, 4.8, 4.55, z, Math.PI / 2); }      // baranda arriba del transformador
  for (let k = 0; k < 5; k++) box(g, 0.32, 0.08, 1.2, na, -7.3 - k * 0.32, 1.2 - k * 0.26, 0.6);      // escalera atrás
  cyl(g, 0.04, 0.04, 2.2, na, -7.9, 1.9, 1.2, 0.9); cyl(g, 0.04, 0.04, 2.2, na, -7.9, 1.9, 0.0, 0.9);      // pasamanos
  g.position.set(p.x, M.H(p.x, p.z), p.z); g.rotation.y = -rot; M.scene.add(g); M.OBST.push({ x: p.x, z: p.z, r: 8 });
  {      // carro solar de comunicaciones: remolque chico con 6 paneles inclinados, gabinete de baterías y mástil con antenas y baliza
    const c = new THREE.Group(), pan = lam(0x3c4a63), mar = lam(0xd5d7da), mst = lam(0xb0b3b7);
    box(c, 3.2, 0.25, 1.9, dk, 0, 0.75, 0); for (const z of [-1.05, 1.05]) cyl(c, 0.4, 0.4, 0.25, ll, 0.4, 0.4, z, Math.PI / 2); box(c, 1.4, 0.12, 0.15, dk, 2.2, 0.7, 0);      // chasis, ruedas y lanza
    const arr = new THREE.Group(); arr.position.set(0, 1.6, 0); arr.rotation.z = 0.6; c.add(arr);      // arreglo de paneles inclinado ~35°
    box(arr, 3.5, 0.06, 2.3, mar, 0, 0, 0); for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) box(arr, 1.6, 0.05, 0.68, pan, (i - 0.5) * 1.68, 0.05, (j - 1) * 0.74);
    cyl(c, 0.05, 0.05, 1.2, mst, 0.9, 1.0, 0); box(c, 0.6, 1.0, 0.5, mar, -1.2, 1.4, 0.55);      // soporte y gabinete de baterías
    cyl(c, 0.09, 0.07, 8.0, mst, -1.2, 4.9, -0.5);      // mástil
    for (const y of [7.6, 8.4]) box(c, 0.08, 0.08, 1.6, mst, -1.2, y, -0.5);      // crucetas
    for (const [z, y] of [[-1.2, 7.9], [0.2, 7.9], [-1.0, 8.7], [0.0, 8.7]]) box(c, 0.14, 0.7, 0.3, mar, -1.2, y, z);      // antenas de panel
    for (const z of [-1.3, 0.3]) cyl(c, 0.03, 0.03, 1.2, mst, -1.2, 9.1, z);      // antenas de varilla
    cyl(c, 0.12, 0.12, 0.25, bas(0xff2a1a), -1.2, 9.05, -0.5);      // baliza
    const cx = p.x + Math.cos(rot) * 6 - Math.sin(rot) * 10, cz = p.z + Math.sin(rot) * 6 + Math.cos(rot) * 10;
    c.position.set(cx, M.H(cx, cz), cz); c.rotation.y = -rot + 0.4; M.scene.add(c); M.OBST.push({ x: cx, z: cz, r: 3 }); }
  const s = new THREE.Group(), post = lam(0x5a5a5a); cyl(s, 0.08, 0.08, 3.2, post, -1.2, 1.6, 0); cyl(s, 0.08, 0.08, 3.2, post, 1.2, 1.6, 0);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#1e3a73'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.fillText('SEM 6', 128, 66);
  const tx = new THREE.CanvasTexture(cv); const pm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.08), [lam(0xdddddd), lam(0xdddddd), lam(0xdddddd), lam(0xdddddd), new THREE.MeshLambertMaterial({ map: tx }), lam(0xdddddd)]); pm.position.set(0, 2.7, 0); s.add(pm);
  const lx = p.x + Math.sin(rot) * 20, lz = p.z - Math.cos(rot) * 20; s.position.set(lx, M.H(lx, lz), lz); s.rotation.y = -rot; M.scene.add(s);
}
function substation(p) {      // subestación móvil en la superficie, de donde sale el cable
  const g = new THREE.Group(), gr = lam(0x8d9196), dk = lam(0x2b2e33), ye = lam(0xe8b80c);
  box(g, 6, 0.5, 3.6, dk, 0, 0.25, 0); box(g, 5.4, 2.8, 3.0, gr, 0, 1.9, 0); box(g, 5.6, 0.25, 3.2, gr, 0, 3.4, 0); box(g, 5.42, 0.35, 3.02, ye, 0, 1.0, 0);
  for (const sx of [-1.6, 0, 1.6]) cyl(g, 0.18, 0.18, 1.0, lam(0xdedede), sx, 4.0, 0);
  g.position.set(p.x, M.H(p.x, p.z), p.z); g.rotation.y = hash(p.x, p.z) * 6.28; M.scene.add(g); M.OBST.push({ x: p.x, z: p.z, r: 4 });
}
function layCable(P, out, info, libre) {      // tiende el cable sobre P: por el suelo donde no circula nadie (caras, bermas y el piso junto a la pala; es obstáculo) y por arriba, entre un par de postes pasacables, donde lo cruzan equipos (ruta, caminos interiores y huellas de camiones), con postes intermedios cada ≤ 55 m
  const cruza = p => onRoadC(p.x, p.z) || OPS.HUELLAS.some(h => (h.x - p.x) ** 2 + (h.z - p.z) ** 2 < 64);      // un camino, o una huella de camiones en un piso: ahí va el par de postes pasacables
  const F = P.map(p => cruza(p) && !(libre && Math.hypot(p.x - libre.x, p.z - libre.z) < libre.r));      // libre: zona sin postes (explanada de la SEM 6: el cable va por el suelo)
  { let k = 0; while (k < F.length) { if (F[k]) { k++; continue; } let j = k, L = 0; while (j < F.length && !F[j]) { if (j > k) L += Math.hypot(P[j].x - P[j - 1].x, P[j].z - P[j - 1].z); j++; } if (k > 0 && j < F.length && L < 45) for (let q = k; q < j; q++) F[q] = true; k = j; } }      // cruces seguidos (huellas y caminos a < 45 m uno de otro): un solo tramo por arriba, no un par de postes por cada uno
  { let k = 0; while (k < F.length) { if (!F[k]) { k++; continue; } let j = k, L = 0; while (j < F.length && F[j]) { if (j > k) L += Math.hypot(P[j].x - P[j - 1].x, P[j].z - P[j - 1].z); j++; } if (L < 16) for (let q = k; q < j; q++) F[q] = false; k = j; } }      // roce de menos de 16 m con la orilla de un camino o piso: el cable sigue por el suelo (no un par de postes a 8 m)
  let i = 0, n = 0;
  while (i < P.length) {
    const p = P[i];
    if (!F[i]) { out.push(new THREE.Vector3(p.x, M.H(p.x, p.z) + 0.35, p.z)); if (n++ % 2 === 0) M.OBST.push({ x: p.x, z: p.z, r: 1.2 }); info.ground.push(p); i++; continue; }
    let j = i; while (j < P.length && F[j]) j++;
    const cerca = q => { const o = M.OBST.find(o => o.r === 1.6 && Math.hypot(o.x - q.x, o.z - q.z) < 32); return o ? { x: o.x, z: o.z } : q; };      // si ya hay un poste a < 32 m (p. ej. los del portón), el cable sube por ese: no un poste nuevo al lado
    const a = cerca(j - 1 > i ? P[i] : P[Math.max(0, i - 1)]), b = cerca(j - 1 > i ? P[j - 1] : P[Math.min(P.length - 1, j)]);      // postes justo en cada orilla del tramo
    const seg = [a]; let acc = 0; for (let k = i + 1; k < j - 1; k++) { acc += Math.hypot(P[k].x - P[k - 1].x, P[k].z - P[k - 1].z); if (acc >= 55 && Math.hypot(b.x - P[k].x, b.z - P[k].z) > 20) { seg.push(P[k]); acc = 0; } } seg.push(b);
    out.push(new THREE.Vector3(a.x, M.H(a.x, a.z) + 0.6, a.z), new THREE.Vector3(a.x, M.H(a.x, a.z) + CTOP, a.z));
    for (let k = 0; k < seg.length - 1; k++) { const s = seg[k], e = seg[k + 1]; cablePost(s.x, s.z, e.x - s.x, e.z - s.z); cablePost(e.x, e.z, e.x - s.x, e.z - s.z); info.posts.push(s, e); cableSpan(out, s, e, 12); }
    out.push(new THREE.Vector3(b.x, M.H(b.x, b.z) + 0.6, b.z));
    i = j;
  }
}
function groundCable(out, way, S, info) {      // último tramo por el piso junto a la pala (obstáculo: no se pisa) y entrada a la pala
  const pts = [];
  for (let s = 0; s < way.length - 1; s++) { const a = way[s], b = way[s + 1], m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.5)); for (let i = 1; i <= m; i++) pts.push({ x: a.x + (b.x - a.x) * i / m, z: a.z + (b.z - a.z) * i / m }); }
  pts.forEach((p, k) => { out.push(new THREE.Vector3(p.x, M.H(p.x, p.z) + 0.25, p.z)); if (k % 2 === 0 && k < pts.length - 3) M.OBST.push({ x: p.x, z: p.z, r: 1.2 }); info.ground.push(p); });
  const e = pts[pts.length - 1]; out.push(new THREE.Vector3(S.x + (e.x - S.x) * 0.6, M.H(S.x, S.z) + 1.4, S.z + (e.z - S.z) * 0.6));
  const curve = new THREE.CatmullRomCurve3(out); curve.curveType = 'centripetal';
  M.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(6000, out.length * 3), 0.16, 6, false), lam(0xc8161c)));
}
const rimPoint = S => {      // punto plano en la superficie, afuera del borde del rajo, en la dirección de S desde el centro (para la subestación)
  let dx = S.x - M.PITC.x, dz = S.z - M.PITC.z; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
  let r0 = 0;
  for (let r = n; r < 2600; r += 6) {
    const p = { x: M.PITC.x + dx * r, z: M.PITC.z + dz * r }, h = M.H(p.x, p.z);
    if (M.inPit(p.x, p.z)) continue;      // todavía dentro del rajo
    if (!r0) r0 = r;
    if (r - r0 < 30) continue;      // 30 m más allá del borde
    const flat = Math.abs(M.H(p.x + dx * 10, p.z + dz * 10) - h) < 2.5 && Math.abs(M.H(p.x - dz * 10, p.z + dx * 10) - h) < 2.5;
    if ((flat || r - r0 > 150) && !onRoadC(p.x, p.z) && !M.OBST.some(o => Math.hypot(o.x - p.x, o.z - p.z) < o.r + 6)) return p;      // lo más plano que haya cerca del borde
  }
  return { x: M.PITC.x + dx * (r0 || n), z: M.PITC.z + dz * (r0 || n) };
};
function buildPowerLine() {      // cable de la pala 2 (fase 7): de SEM 6 y su subestación en la superficie, por la pared, al portón de la rampa (cruza por arriba la entrada), y por el pie de la pared hasta la pala
  const Q = OPS.PALAS.find(p => p.cable === 'ruta'); if (!Q) return;
  const info = { ground: [], posts: [] };
  // portón: dos postes pasacables a 42 m (pasan dos CAEX a la vez, uno entrando y otro saliendo); el cable cruza por arriba a 18 m
  const gc = 48, gw = 21, G1 = pl(gc + gw, 30), G2 = pl(gc - gw, 30);
  M.GATE = { s0: M.PLAT.se + gc - gw, s1: M.PLAT.se + gc + gw, d: WR + 15.5, p: [G1, G2] };
  const avoid = [];      // por donde circulan: la entrada del portón y las salidas de los camiones de la pala
  for (let al = gc - gw + 3; al <= gc + gw - 3; al += 4) for (let la = 0; la <= 34; la += 6) { const q = pl(al, la); avoid.push({ x: q.x, z: q.z, r: 6 }); }
  for (const o of M.OBST.filter(o => o.r === 8 && Math.hypot(o.x - Q.x, o.z - Q.z) < 40)) for (let t = 12; t <= 110; t += 12) avoid.push({ x: o.x - Q.fx * t, z: o.z - Q.fz * t, r: 10 });
  cablePost(G1.x, G1.z, G2.x - G1.x, G2.z - G1.z); cablePost(G2.x, G2.z, G2.x - G1.x, G2.z - G1.z);      // los postes del portón primero: los cruces vecinos los comparten
  const B = rimPoint(G1); substation(B);      // subestación móvil en la superficie, sobre la fase 7
  const out = [new THREE.Vector3(B.x, M.H(B.x, B.z) + 1.2, B.z)];
  layCable(cableRoute(B, pl(gc + gw + 3, 26), avoid), out, info);
  out.push(new THREE.Vector3(G1.x, M.H(G1.x, G1.z) + 0.6, G1.z), new THREE.Vector3(G1.x, M.H(G1.x, G1.z) + CTOP, G1.z));
  cablePost(G1.x, G1.z, G2.x - G1.x, G2.z - G1.z); cablePost(G2.x, G2.z, G2.x - G1.x, G2.z - G1.z); info.posts.push(G1, G2);
  cableSpan(out, G1, G2, 14);
  out.push(new THREE.Vector3(G2.x, M.H(G2.x, G2.z) + 0.6, G2.z));      // baja por el poste del lado de la pala
  const back = { x: Q.x - Q.fx * 20, z: Q.z - Q.fz * 20 }, G3 = pl(gc - gw - 12, 32);      // se aleja del portón antes de seguir a la pala
  const seg = []; for (let t = 0.1; t < 1; t += 0.1) seg.push({ x: G2.x + (G3.x - G2.x) * t, z: G2.z + (G3.z - G2.z) * t });
  layCable(seg.concat(cableRoute(G3, back, avoid)), out, info);
  groundCable(out, [back, { x: Q.x - Q.fx * 12, z: Q.z - Q.fz * 12 }, { x: Q.x - Q.fx * 7 + Q.fz * 2, z: Q.z - Q.fz * 7 - Q.fx * 2 }], { x: Q.x, z: Q.z }, info);
  CABLES.CABLE = Object.assign(info, { src: B });
}
function buildCable2() {      // palas del fondo: SEM 6 junto a la tercera curva del camino que baja al fondo (SEM6_DWG) y, de su subestación, un cable por la pared hasta un costado de cada pala
  let S6 = null, sala = null;
  if (SEM6_DWG) { const A = { x: SEM6_DWG.x, z: SEM6_DWG.z }, rot = SEM6_DWG.rot, c = Math.cos(rot), sn = Math.sin(rot); sem6(A, rot); S6 = A;      // la SEM 6 es la subestación: los cables salen del mismo remolque
    sala = { A, w: (lx, lz) => ({ x: A.x + lx * c - lz * sn, z: A.z + lx * sn + lz * c }) }; }      // w: punto en coordenadas de la sala (x a lo largo, z a lo ancho)
  for (const Q of OPS.PALAS.filter(p => p.cable === 'fondo' || p.cable === 'borde')) {      // 'borde': pala de la fase 7 con su propia subestación móvil en el borde
    const info = { ground: [], posts: [] }, avoid = [];
    for (const o of M.OBST.filter(o => o.r === 8 && Math.hypot(o.x - Q.x, o.z - Q.z) < 40)) for (let t = 12; t <= 110; t += 12) avoid.push({ x: o.x - Q.fx * t, z: o.z - Q.fz * t, r: 10 });
    const S6q = Q.cable === 'fondo' ? S6 : null, A = S6q || rimPoint(Q); if (!S6q) substation(A);
    const out = [new THREE.Vector3(A.x, M.H(A.x, A.z) + 1.2, A.z)], back = { x: Q.x - Q.fx * 18 + Q.fz * 6, z: Q.z - Q.fz * 18 - Q.fx * 6 };
    let ini = A, libre = null;
    if (sala && S6q) {      // el cable sale del extremo del remolque de la SEM 6 que mira a la pala; en la explanada no hay postes
      const ends = [sala.w(7.6, 0), sala.w(-8.6, 0.9)], e2 = ends.sort((a, b) => Math.hypot(a.x - back.x, a.z - back.z) - Math.hypot(b.x - back.x, b.z - back.z))[0];
      out.length = 0; out.push(new THREE.Vector3(e2.x, M.H(e2.x, e2.z) + 1.4, e2.z), new THREE.Vector3(e2.x, M.H(e2.x, e2.z) + 0.3, e2.z));      // sale del extremo del remolque, por el suelo
      ini = e2; libre = { x: sala.A.x, z: sala.A.z, r: 35 }; }
    layCable(cableRoute(ini, back, avoid), out, info, libre);
    groundCable(out, [back, { x: Q.x - Q.fx * 9, z: Q.z - Q.fz * 9 }], { x: Q.x, z: Q.z }, info);
    if (!CABLES.CABLE2) CABLES.CABLE2 = Object.assign(info, { src: A });
  }
}

export { CABLES, buildPowerLine, buildCable2 };      // lo demás es interno; CABLES se expone para el arnés de pruebas
