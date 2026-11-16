// Cables de las palas y energía: postes pasacables (cablePost), subestaciones, SEM 6, cable de la ruta hasta la PC9000 (buildPowerLine, deja M.GATE) y cables dibujados de las otras palas (buildCable2).
import { mundo as M } from '../mundo.js';
import { WR } from '../config/diseno.js';
import { RIMPOLY, SEM6 } from '../datos/caminos.js';
import { D52 } from '../datos/fase7.js';
import { hash, inPoly, sm01 } from '../comun/mates.js';
import { box, cyl, lam } from '../modelos/materiales.js';
import { cableRoute, onRoadC } from './malla.js';

// Cables de las palas (como en la mina): van tendidos por el suelo desde una subestación en el borde del rajo, por las caras y bermas de los bancos, donde no anda nadie.
// Solo donde un vehículo tiene que pasar (un camino o la entrada a la Rampa Sur) el cable sube a un par de postes pasacables de 18 m y cruza por arriba.
const SHOV_AL = -20, SPOT_AL = [SHOV_AL - 24, SHOV_AL + 24], ARR_LA = WR + 2, SPOT_LA = WR + 13;      // franja por donde circulaban los camiones de la antigua pala 3 junto a la Rampa Sur: sigue siendo zona a evitar para que el cable de la ruta no cambie de trazado
const CABLES = { CABLE: null, CABLE2: null };      // cable de la ruta (PC9000) y primer cable dibujado (para el arnés de pruebas)
const pl = (al, la) => { const f = M.frame(M.PLAT.se + al); return { x: f.x + f.rx * M.PLAT.side * la, z: f.z + f.rz * M.PLAT.side * la, tx: f.tx, tz: f.tz, nx: f.rx * M.PLAT.side, nz: f.rz * M.PLAT.side }; };
const CTOP = 18.2;
function cablePost(x, z, ax, az) {      // poste pasacables rojo y blanco de 18 m (si ya hay uno en ese punto, se comparte)
  if (M.OBST.some(o => o.r === 1.6 && Math.hypot(o.x - x, o.z - z) < 3)) return;
  const red = lam(0xe0401a), wh = lam(0xf4f4f4), g = new THREE.Group();
  for (let y = 0; y < 18; y += 1.5) box(g, 0.55, 1.5, 0.55, (Math.floor(y / 1.5) % 2) ? wh : red, 0, y + 0.75, 0);
  box(g, 3.0, 0.35, 0.35, wh, 0, 18, 0); box(g, 1.6, 0.6, 1.6, lam(0x1d1f22), 0, 0.25, 0);
  g.position.set(x, M.H(x, z), z); g.rotation.y = Math.atan2(ax, az) + Math.PI / 2; M.scene.add(g); M.OBST.push({ x, z, r: 1.6 });
}
function cableSpan(out, a, b, n) { const ya = M.H(a.x, a.z) + CTOP, yb = M.H(b.x, b.z) + CTOP; for (let k = 1; k < n; k++) { const t = k / n; out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, ya + (yb - ya) * t - 5.6 * t * (1 - t), a.z + (b.z - a.z) * t)); } out.push(new THREE.Vector3(b.x, yb, b.z)); }
function buildSem6() {      // SEM 6: dos contenedores unidos (sala eléctrica) + subestación + letrero, en su patio junto al verde
  const g = new THREE.Group(), wh = lam(0xe6e2d6), bl = lam(0x2f4f8f), dk = lam(0x2b2e33), gr = lam(0x8d9196);
  for (const dz of [-1.35, 1.35]) { box(g, 12.2, 2.9, 2.6, wh, 0, 1.45 + 0.3, dz); box(g, 12.3, 0.5, 2.7, bl, 0, 0.55, dz); box(g, 12.3, 0.3, 2.7, bl, 0, 3.05, dz); }
  box(g, 12.4, 0.3, 5.6, dk, 0, 0.15, 0);      // base
  box(g, 0.9, 2.0, 0.08, dk, -4.5, 1.3, 2.66); box(g, 0.9, 2.0, 0.08, dk, 4.5, 1.3, -2.66);      // puertas
  for (const sx of [-3, 0, 3]) box(g, 1.2, 0.8, 0.6, gr, sx, 3.5, 0);      // equipos de clima en el techo
  cyl(g, 0.08, 0.08, 9, gr, 7.5, 4.5, 2.2); box(g, 1.6, 1.0, 0.1, lam(0xd8d8d8), 7.5, 8.2, 2.2);      // mástil con antena
  g.position.set(SEM6.x, M.H(SEM6.x, SEM6.z), SEM6.z); g.rotation.y = -SEM6.rot; M.scene.add(g);
  M.OBST.push({ x: SEM6.x, z: SEM6.z, r: 8 });
  const sx = SEM6.x + Math.cos(SEM6.rot) * 2 - Math.sin(SEM6.rot) * 14, sz = SEM6.z + Math.sin(SEM6.rot) * 2 + Math.cos(SEM6.rot) * 14; substation({ x: sx, z: sz });
  const s = new THREE.Group(), post = lam(0x5a5a5a); cyl(s, 0.08, 0.08, 3.2, post, -1.2, 1.6, 0); cyl(s, 0.08, 0.08, 3.2, post, 1.2, 1.6, 0);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#1e3a73'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.fillText('SEM 6', 128, 66);
  const tx = new THREE.CanvasTexture(cv); const pl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.08), [lam(0xdddddd), lam(0xdddddd), lam(0xdddddd), lam(0xdddddd), new THREE.MeshLambertMaterial({ map: tx }), lam(0xdddddd)]); pl.position.set(0, 2.7, 0); s.add(pl);
  const lx = SEM6.x + Math.sin(SEM6.rot) * 20, lz = SEM6.z - Math.cos(SEM6.rot) * 20; s.position.set(lx, M.H(lx, lz), lz); s.rotation.y = -SEM6.rot; M.scene.add(s);
}
function substation(p) {      // subestación móvil en la superficie, de donde sale el cable
  const g = new THREE.Group(), gr = lam(0x8d9196), dk = lam(0x2b2e33), ye = lam(0xe8b80c);
  box(g, 6, 0.5, 3.6, dk, 0, 0.25, 0); box(g, 5.4, 2.8, 3.0, gr, 0, 1.9, 0); box(g, 5.6, 0.25, 3.2, gr, 0, 3.4, 0); box(g, 5.42, 0.35, 3.02, ye, 0, 1.0, 0);
  for (const sx of [-1.6, 0, 1.6]) cyl(g, 0.18, 0.18, 1.0, lam(0xdedede), sx, 4.0, 0);
  g.position.set(p.x, M.H(p.x, p.z), p.z); g.rotation.y = hash(p.x, p.z) * 6.28; M.scene.add(g); M.OBST.push({ x: p.x, z: p.z, r: 4 });
}
function layCable(P, out, info) {      // tiende el cable sobre P: por el suelo (no se pisa: obstáculo) y, donde cruza un camino, por arriba entre dos postes
  let i = 0, n = 0;
  while (i < P.length) {
    const p = P[i];
    if (!onRoadC(p.x, p.z)) { out.push(new THREE.Vector3(p.x, M.H(p.x, p.z) + 0.35, p.z)); if (n++ % 2 === 0) M.OBST.push({ x: p.x, z: p.z, r: 1.2 }); info.ground.push(p); i++; continue; }
    let j = i; while (j < P.length && onRoadC(P[j].x, P[j].z)) j++;
    const a = j - 1 > i ? P[i] : P[Math.max(0, i - 1)], b = j - 1 > i ? P[j - 1] : P[Math.min(P.length - 1, j)];      // postes en el camino, justo en cada orilla
    cablePost(a.x, a.z, b.x - a.x, b.z - a.z); cablePost(b.x, b.z, b.x - a.x, b.z - a.z); info.posts.push(a, b);
    out.push(new THREE.Vector3(a.x, M.H(a.x, a.z) + 0.6, a.z), new THREE.Vector3(a.x, M.H(a.x, a.z) + CTOP, a.z)); cableSpan(out, a, b, 12); out.push(new THREE.Vector3(b.x, M.H(b.x, b.z) + 0.6, b.z));
    i = j;
  }
}
function groundCable(out, way, S, info) {      // último tramo por el piso junto a la pala (obstáculo: no se pisa) y entrada a la pala
  const pts = [];
  for (let s = 0; s < way.length - 1; s++) { const a = way[s], b = way[s + 1], m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.5)); for (let i = 1; i <= m; i++) pts.push({ x: a.x + (b.x - a.x) * i / m, z: a.z + (b.z - a.z) * i / m }); }
  pts.forEach((p, k) => { out.push(new THREE.Vector3(p.x, M.H(p.x, p.z) + 0.25, p.z)); if (k % 2 === 0 && k < pts.length - 3) M.OBST.push({ x: p.x, z: p.z, r: 1.2 }); info.ground.push(p); });
  const e = pts[pts.length - 1]; out.push(new THREE.Vector3(S.x + (e.x - S.x) * 0.6, M.H(S.x, S.z) + 1.4, S.z + (e.z - S.z) * 0.6));
  const curve = new THREE.CatmullRomCurve3(out); curve.curveType = 'centripetal';
  M.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(6000, out.length * 3), 0.16, 6, false), lam(0x1a1a1a)));
}
const rimPoint = S => {      // punto en la superficie, afuera del borde del rajo, en la dirección de S desde el centro (para la subestación)
  let dx = S.x - M.PITC.x, dz = S.z - M.PITC.z; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n; let r = n; while (inPoly(M.PITC.x + dx * r, M.PITC.z + dz * r, RIMPOLY) && r < 2000) r += 4;
  for (let k = 0; k < 20; k++) { const p = { x: M.PITC.x + dx * (r + 14 + k * 4), z: M.PITC.z + dz * (r + 14 + k * 4) }; if (!onRoadC(p.x, p.z) && !M.OBST.some(o => Math.hypot(o.x - p.x, o.z - p.z) < o.r + 6)) return p; }
  return { x: M.PITC.x + dx * (r + 14), z: M.PITC.z + dz * (r + 14) };
};
function buildPowerLine() {      // cable de la pala 3: de la subestación, por el suelo, hasta el poste del portón; cruza por arriba la entrada a la Rampa Sur y sigue por el pie del frente hasta un costado de la pala
  const info = { ground: [], posts: [] };
  // portón: dos postes pasacables a 42 m (pasan dos CAEX a la vez, uno entrando y otro saliendo); el cable cruza por arriba a 18 m
  const gc = 48, gw = 21, G1 = pl(gc + gw, 30), G2 = pl(gc - gw, 30);
  M.GATE = { s0: M.PLAT.se + gc - gw, s1: M.PLAT.se + gc + gw, d: WR + 15.5, p: [G1, G2] };
  const avoid = [];      // por donde circulan: la entrada del portón, los camiones de la pala 3 y el piso de la fase 7 entre la partida y el portón
  for (let al = gc - gw + 3; al <= gc + gw - 3; al += 4) for (let la = 0; la <= 34; la += 6) { const q = pl(al, la); avoid.push({ x: q.x, z: q.z, r: 6 }); }
  for (const sp of SPOT_AL) for (let al = sp - 60; al <= sp + 70; al += 5) { const q = pl(al, sp - al > 0 ? ARR_LA + (SPOT_LA - ARR_LA) * sm01(1 - (sp - al) / 30) : SPOT_LA - (al - sp) * 0.35); avoid.push({ x: q.x, z: q.z, r: 9 }); }
  const A = rimPoint(G1); substation(A);
  const out = [new THREE.Vector3(A.x, M.H(A.x, A.z) + 1.2, A.z)];
  layCable(cableRoute(A, pl(gc + gw + 3, 26), avoid), out, info);
  out.push(new THREE.Vector3(G1.x, M.H(G1.x, G1.z) + 0.6, G1.z), new THREE.Vector3(G1.x, M.H(G1.x, G1.z) + CTOP, G1.z));
  cablePost(G1.x, G1.z, G2.x - G1.x, G2.z - G1.z); cablePost(G2.x, G2.z, G2.x - G1.x, G2.z - G1.z); info.posts.push(G1, G2);
  cableSpan(out, G1, G2, 14);
  out.push(new THREE.Vector3(G2.x, M.H(G2.x, G2.z) + 0.6, G2.z));      // baja por el poste del lado de la pala
  { const Q = M.F7EQ.pc, back = { x: Q.x - Q.fx * 20, z: Q.z - Q.fz * 20 }, G3 = pl(gc - gw - 12, 32);      // baja del poste y se aleja del portón antes de seguir a la pala
    const seg = []; for (let t = 0.1; t < 1; t += 0.1) seg.push({ x: G2.x + (G3.x - G2.x) * t, z: G2.z + (G3.z - G2.z) * t });
    const r5 = D52.cab.p5, i1 = r5.findIndex(p => p[2] === 1 && p[1] > 420); let i2 = i1; while (r5[i2 + 1][2] === 1) i2++;      // cruce de la celeste compartido con el cable de la pala 5: mismo par de postes
    const S1 = { x: r5[i2 + 1][0], z: r5[i2 + 1][1] }, S2 = { x: r5[i1 - 1][0], z: r5[i1 - 1][1] };
    layCable(seg.concat(cableRoute(G3, S1, avoid)), out, info);
    cablePost(S1.x, S1.z, S2.x - S1.x, S2.z - S1.z); cablePost(S2.x, S2.z, S2.x - S1.x, S2.z - S1.z); info.posts.push(S1, S2);
    out.push(new THREE.Vector3(S1.x, M.H(S1.x, S1.z) + 0.6, S1.z), new THREE.Vector3(S1.x, M.H(S1.x, S1.z) + CTOP, S1.z)); cableSpan(out, S1, S2, 14); out.push(new THREE.Vector3(S2.x, M.H(S2.x, S2.z) + 0.6, S2.z));
    layCable(cableRoute(S2, back, avoid), out, info); groundCable(out, [back, { x: Q.x - Q.fx * 12, z: Q.z - Q.fz * 12 }, { x: Q.x - Q.fx * 7 + Q.fz * 2, z: Q.z - Q.fz * 7 - Q.fx * 2 }], { x: Q.x, z: Q.z }, info); }
  CABLES.CABLE = Object.assign(info, { src: A });
}
function drawnCable(W, Q, local) {      // local: la subestación móvil va en el primer punto dibujado (dentro del rajo), no en el borde      // cable dibujado: de la subestación en el borde, por el suelo; en los pasacables (y donde cruza un camino) sube a dos postes y pasa por arriba
  const info = { ground: [], posts: [] }, P = W.map(p => ({ x: p[0], z: p[1], g: p[2] })).reverse();
  const lanes = M.OBST.filter(o => o.r === 8 && Math.hypot(o.x - Q.x, o.z - Q.z) < 40), inLane = p => lanes.some(o => { const t = -(p.x - o.x) * Q.fx - (p.z - o.z) * Q.fz, w = Math.abs(-(p.x - o.x) * Q.fz + (p.z - o.z) * Q.fx); return t > -6 && t < 120 && w < 10; });      // salida de los camiones: desde cada puesto de carga, hacia adelante (se alejan de la pila), 20 m de ancho
  { const e = { x: Q.x - Q.fx * 9, z: Q.z - Q.fz * 9 }, a = P[P.length - 1], L = Math.hypot(e.x - a.x, e.z - a.z), m = Math.ceil(L / 2); for (let i = 1; i < m - 1; i++) P.push({ x: a.x + (e.x - a.x) * i / m, z: a.z + (e.z - a.z) * i / m, g: 0 }); }      // el último tramo hasta la pala también puede cruzar una salida
  P.forEach(p => { if (onRoadC(p.x, p.z) || inLane(p)) p.g = 1; });
  for (let k = 1; k < P.length - 1; k++) if (!P[k].g && P[k - 1].g && (P[k + 1].g || (P[k + 2] && P[k + 2].g))) P[k].g = 1;      // dos tramos elevados casi seguidos se juntan en uno      // donde cruza un camino o una salida de camiones, el cable va por arriba entre dos postes
  const A = local ? { x: P[0].x, z: P[0].z } : rimPoint(P[0]); substation(A);
  const out = [new THREE.Vector3(A.x, M.H(A.x, A.z) + 1.2, A.z)]; if (!local) layCable(cableRoute(A, P[0], []), out, info);
  const last = P.length - 1; let k = 0;
  while (k < last) {
    if (P[k + 1].g) { let j = k + 1; while (j < last && P[j].g) j++; const a = P[k], b = P[j];
      cablePost(a.x, a.z, b.x - a.x, b.z - a.z); cablePost(b.x, b.z, b.x - a.x, b.z - a.z); info.posts.push(a, b);
      out.push(new THREE.Vector3(a.x, M.H(a.x, a.z) + 0.6, a.z), new THREE.Vector3(a.x, M.H(a.x, a.z) + CTOP, a.z)); cableSpan(out, a, b, 14); out.push(new THREE.Vector3(b.x, M.H(b.x, b.z) + 0.6, b.z)); k = j; continue; }
    const a = P[k], b = P[k + 1], m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
    for (let i = 1; i <= m; i++) { const p = { x: a.x + (b.x - a.x) * i / m, z: a.z + (b.z - a.z) * i / m }; out.push(new THREE.Vector3(p.x, M.H(p.x, p.z) + 0.3, p.z)); if (i % 2 === 0) M.OBST.push({ x: p.x, z: p.z, r: 1.2 }); info.ground.push(p); }
    k++;
  }
  groundCable(out, [P[last], { x: Q.x - Q.fx * 9, z: Q.z - Q.fz * 9 }], { x: Q.x, z: Q.z }, info);
  return Object.assign(info, { src: A });
}
function buildCable2() {      // palas 2, 3 y 6 de la fase 7 y pala 5 del fondo: cables como en el dibujo
  for (const [k, Q] of [['p2', M.F7EQ.palas[0]], ['p3', M.F7EQ.palas[1]], ['p6', M.F7EQ.palas[2]], ['p5', M.PIT.p5]]) { if (!Q) continue; const info = drawnCable(D52.cab[k], Q); if (!CABLES.CABLE2) CABLES.CABLE2 = info; }
}

export { CABLES, buildSem6, buildPowerLine, buildCable2 };      // lo demás es interno; CABLES se expone para el arnés de pruebas
