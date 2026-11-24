// Camiones: camioneta doble cabina, chasis común (truckBase), CAEX de 300 t (buildTruck) y aljibe tipo HD785 (buildAljibe), con sus prototipos y placas.
import { GRILLE_MAT, TIRE_MATS, bas, blob, box, brakeGlowMat, brakeMat, cyl, finePile, grimeTex, lam, rimMats, rockGeo } from './materiales.js';
import { hash } from '../comun/mates.js';

function extrude(g, shape, ancho, bisel, mat, x0) {      // silueta lateral (x de la figura = largo del vehículo, y = alto) extruida a lo ancho, con bisel; x0 = centro en x
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, ancho - 2 * bisel), bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 16 });
  geo.translate(0, 0, -(ancho - 2 * bisel) / 2); geo.rotateY(-Math.PI / 2); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.position.x = x0 || 0; g.add(m); return m;
}
const decalTex = (txt, w, h, font, color, bg) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); } x.fillStyle = color; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 1); return new THREE.CanvasTexture(c); };
const TIRE_PROF = [[0.2, 0.15], [0.27, 0.16], [0.34, 0.165], [0.385, 0.135], [0.4, 0.1], [0.4, -0.1], [0.385, -0.135], [0.34, -0.165], [0.27, -0.16], [0.2, -0.15]];      // neumático torneado: hombros redondos
const RIM_PROF = [[0.0, 0.17], [0.09, 0.17], [0.11, 0.1], [0.21, 0.1], [0.235, 0.15], [0.26, 0.15], [0.26, -0.15], [0.235, -0.15], [0.235, -0.04], [0.0, -0.04]];      // llanta de acero: plato hundido con centro saliente
const tireGeo = new THREE.LatheGeometry(TIRE_PROF.map(([r, y]) => new THREE.Vector2(r, y)), 32), rimGeo = new THREE.LatheGeometry(RIM_PROF.map(([r, y]) => new THREE.Vector2(r, y)), 28);
function loft(g, secs, mat) {      // superficie curva continua: une secciones transversales (cada una: z y un anillo de puntos [x, y]) y tapa los extremos; normales suaves
  const n = secs[0].p.length, pos = [], idx = [];
  for (const s of secs) for (const [x, y] of s.p) pos.push(x, y, s.z);
  for (let k = 0; k < secs.length - 1; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n, c = a + n, d = b + n; idx.push(a, b, c, b, d, c); }
  for (const [k, flip] of [[0, false], [secs.length - 1, true]]) { const c = pos.length / 3; let cx = 0, cy = 0; for (const [x, y] of secs[k].p) { cx += x / n; cy += y / n; } pos.push(cx, cy, secs[k].z);
    for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n; if (flip) idx.push(c, a, b); else idx.push(c, b, a); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i + 2] * 0.35, pos[i + 1] * 0.6 + pos[i] * 0.2); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(geo, mat); g.add(m); return m;
}
function secRedonda(wb, wt, y0, y1, rt, rb) {      // sección transversal: trapecio (ancho wb abajo, wt arriba) con esquinas redondeadas (rt arriba, rb abajo); 28 puntos, en sentido antihorario visto desde adelante
  const p = [], K = 6, h = Math.max(1e-3, y1 - y0); rt = Math.min(rt, h / 2, wt); rb = Math.min(rb, h / 2, wb);
  const arc = (cx, cy, r, a0) => { for (let k = 0; k <= K; k++) { const a = a0 + k * Math.PI / 2 / K; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  arc(wb - rb, y0 + rb, rb, -Math.PI / 2); arc(wt - rt, y1 - rt, rt, 0); arc(-wt + rt, y1 - rt, rt, Math.PI / 2); arc(-wb + rb, y0 + rb, rb, Math.PI);
  return p;
}
function quad(g, a, b, c, d, mat) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); g.add(m); return m; }
function buildPickup(bodyC, other) {      // Toyota Hilux doble cabina 4×4 de faena a medidas reales (+z = adelante): 5,27 × 1,80 × 1,81 m, 3,09 m entre ejes, voladizo delantero 0,89 y trasero 1,29, cintura a 1,22 m, cabina de 2,2 m y tolva de 1,55 m
  const g = new THREE.Group();          // roja, franja reflectante amarilla por la cintura y sobre el capó, parrilla cromada, focos envolventes, toma de aire, snorkel, barra antivuelco, llantas de aleación y baliza
  const COL = bodyC === 0xc9141c || !bodyC ? 0x8c161c : bodyC;      // rojo burdeos de la Hilux de faena (foto de referencia)
  const red = lam(COL, { side: THREE.DoubleSide }), redD = lam(0x6e1217), glass = new THREE.MeshPhongMaterial({ color: 0x18222c, shininess: 90, specular: 0x667788, side: THREE.DoubleSide }), dark = lam(0x121314), plast = lam(0x222325), chrome = lam(0xd2d6da), steel = lam(0x7d8186), tire = lam(0x1b1b1c), reflex = bas(0xd8f02a);
  const orange = new THREE.MeshBasicMaterial({ color: 0xff6a00, side: THREE.DoubleSide });
  const ZF = 1.62, ZR = -1.48, WR0 = 0.42, AR = 0.55, SILL = 0.47, BELT = 1.22, ROOF = 1.8, W = 0.9, Z0 = 2.5, Z1 = -2.72, ZC = -1.15;      // ejes, radio de rueda y de arco, zócalo, cintura, techo, semiancho, frente, cola y fin de la cabina
  const AA = Math.asin((SILL - WR0) / AR), AZ = AR * Math.cos(AA), BV = 0.06;
  { const s = new THREE.Shape();      // frente y cabina hasta la cintura: paso de rueda delantero, parachoques, frente casi vertical, capó corto y alto que sube al parabrisas
    const aC = Math.atan2(Math.sqrt(AR * AR - (ZC - ZR) ** 2), ZC - ZR);      // el paso de la rueda trasera asoma por delante del fin de la cabina: la carrocería delantera también lo recorta
    s.moveTo(ZC, WR0 + Math.sin(aC) * AR); s.absarc(ZR, WR0, AR, aC, AA, true); s.lineTo(ZF - AZ, SILL); s.absarc(ZF, WR0, AR, Math.PI - AA, AA, true); s.lineTo(Z0 - 0.22, SILL); s.quadraticCurveTo(Z0 - 0.06, SILL + 0.02, Z0 - 0.06, 0.58); s.lineTo(Z0 - 0.06, 0.94);
    s.quadraticCurveTo(Z0 - 0.06, 1.05, Z0 - 0.24, 1.06); s.lineTo(1.1, 1.17); s.lineTo(1.02, BELT - BV); s.lineTo(ZC, BELT - BV); s.lineTo(ZC, WR0 + Math.sin(aC) * AR); extrude(g, s, 2 * W, BV, red); }
  { const s = new THREE.Shape();      // costados de la tolva con el paso de rueda trasero
    const zB = ZC - 0.02, aB = Math.atan2(Math.sqrt(AR * AR - (zB - ZR) ** 2), zB - ZR);      // el costado de la tolva termina en el arco (no vuelve por dentro: eso rellenaba el paso de rueda)
    s.moveTo(Z1 + 0.06, SILL + 0.06); s.lineTo(ZR - AZ, SILL); s.absarc(ZR, WR0, AR, Math.PI - AA, aB, true); s.lineTo(zB, BELT); s.lineTo(Z1 + 0.06, BELT); s.lineTo(Z1 + 0.06, SILL + 0.06);
    for (const sx of [-1, 1]) extrude(g, s, 0.1, 0.02, red, sx * (W - 0.05)); }
  box(g, 2 * W - 0.1, BELT - 0.6, 0.07, red, 0, (BELT + 0.6) / 2, Z1 + 0.07);      // portalón
  { const yb = WR0 + AR + 0.03; box(g, 2 * W - 0.1, BELT - yb, 0.07, red, 0, (BELT + yb) / 2, ZC - 0.06); }      // frente de la tolva: arranca sobre el arco de la rueda, no cae dentro del paso
  box(g, 2 * W - 0.16, 0.05, ZC - Z1 - 0.1, dark, 0, 0.72, (ZC + Z1) / 2);      // piso de la tolva
  for (const sx of [-1, 1]) box(g, 0.14, 0.04, ZC - Z1 - 0.08, plast, sx * (W - 0.05), BELT + 0.03, (ZC + Z1) / 2 + 0.02);      // protector negro del borde de la tolva
  box(g, 1.2, 0.2, 4.6, dark, 0, 0.4, -0.1);      // chasis bajo el piso: más angosto que la trocha y fuera de los pasos de rueda
  // cabina doble: más angosta arriba, parabrisas inclinado, techo levemente abombado, luneta casi vertical
  const GB = W - 0.03, GT = 0.71, lado = y => GB + (GT - GB) * Math.min(1, Math.max(0, (y - BELT) / (ROOF - BELT)));
  loft(g, [[1.04, BELT + 0.01, 0.01], [0.86, 1.42, 0.07], [0.64, 1.66, 0.1], [0.46, 1.77, 0.12], [0.22, ROOF, 0.13], [-0.8, ROOF, 0.13], [-1.02, 1.77, 0.12], [-1.1, 1.6, 0.09], [ZC + 0.02, BELT + 0.01, 0.01]]
    .map(([z, y1, r]) => ({ z, p: secRedonda(GB, lado(y1), BELT - 0.05, y1, r, 0.02) })), red);
  { const e = 0.014, x0 = lado(1.28) - 0.09, x1 = lado(1.7) - 0.1; quad(g, [-x0, 1.28, 0.975 + e], [x0, 1.28, 0.975 + e], [x1, 1.7, 0.6 + e], [-x1, 1.7, 0.6 + e], glass);      // parabrisas
    quad(g, [x0, 1.3, ZC + 0.035 - e], [-x0, 1.3, ZC + 0.035 - e], [-x1, 1.64, -1.085 - e], [x1, 1.64, -1.085 - e], glass); }      // luneta
  for (const sx of [-1, 1]) for (const [za, zb, zc, zd] of [[0.84, 0.11, 0.11, 0.5], [-0.01, -0.84, -0.7, -0.01]]) { const e = 0.01, ya = 1.28, yb = 1.7;      // vidrios de las dos puertas
    quad(g, [sx * (lado(ya) + e), ya, za], [sx * (lado(ya) + e), ya, zb], [sx * (lado(yb) + e), yb, zc], [sx * (lado(yb) + e), yb, zd], glass); }
  // líneas de carrocería: juntas de las puertas, pliegue lateral, manillas y espejos
  for (const sx of [-1, 1]) { for (const z of [0.97, 0.05, -0.87]) box(g, 0.012, BELT - SILL - 0.1, 0.02, redD, sx * (W + 0.004), (SILL + BELT) / 2 + 0.02, z);
    box(g, 0.012, 0.025, 2.2, redD, sx * (W + 0.004), 1.0, 0.0);      // pliegue lateral solo sobre las puertas (no cruza los pasos de rueda)
    box(g, 0.012, 0.05, 0.75, plast, sx * (W + 0.004), SILL + 0.03, (ZF + ZR) / 2 + 0.05);      // zócalo negro solo entre las ruedas
    box(g, 0.2, 0.22, 0.14, red, sx * (W + 0.14), 1.36, 0.86); box(g, 0.1, 0.05, 0.08, red, sx * (W + 0.03), 1.3, 0.88); }
  // frente: parrilla cromada de 3 barras con emblema entre los focos envolventes; parachoques del color de la carrocería con toma inferior, neblineros y placa
  const FZ = Z0 + 0.005;
  box(g, 0.8, 0.32, 0.05, GRILLE_MAT, 0, 0.93, FZ); for (const y of [0.84, 0.92, 1.0]) box(g, 0.76, 0.025, 0.06, dark, 0, y, FZ + 0.005);      // parrilla negra solo entre los focos, con barras
  box(g, 0.86, 0.04, 0.1, reflex, 0, 1.13, Z0 - 0.16).rotation.x = 0.06;      // cinta reflectante de foco a foco por el borde delantero del capó
  for (const sx of [-1, 1]) { const hs = new THREE.Shape(); [[0.42, 0.85], [0.42, 1.0], [0.64, 1.055], [0.88, 1.04], [0.89, 0.93], [0.7, 0.86]].forEach(([x, y], i) => i ? hs.lineTo(sx * x, y) : hs.moveTo(sx * x, y));      // foco: lente transparente alargada que se afina hacia la esquina
    const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.02, bevelSegments: 2 }); hg.translate(0, 0, Z0 - 0.14);
    const hm = new THREE.Mesh(hg, bas(0xaebcc6)); hm.material.side = THREE.DoubleSide; g.add(hm);
    box(g, 0.36, 0.1, 0.03, bas(0x39424a), sx * 0.66, 0.955, Z0 + 0.012); box(g, 0.3, 0.02, 0.03, bas(0xf4f4f0), sx * 0.69, 0.875, Z0 + 0.014);      // reflector interior y luz de día
    const bulb = cyl(g, 0.055, 0.055, 0.02, bas(0xdfe6ea), sx * 0.58, 0.955, Z0 + 0.02); bulb.rotation.x = Math.PI / 2;
  }
  box(g, 2 * W + 0.04, 0.16, 0.2, plast, 0, SILL + 0.06, Z0 - 0.1);      // faldón negro del parachoques
  box(g, 0.9, 0.17, 0.05, GRILLE_MAT, 0, 0.62, FZ); for (const sx of [-1, 1]) { box(g, 0.24, 0.12, 0.04, GRILLE_MAT, sx * 0.7, 0.6, FZ); const f = cyl(g, 0.045, 0.045, 0.03, bas(0xe9e4cf), sx * 0.7, 0.6, FZ + 0.02); f.rotation.x = Math.PI / 2; }
  // atrás: parachoques de acero, portalón liso, focos verticales (luces de freno) y placa
  box(g, 1.7, 0.14, 0.2, steel, 0, 0.52, Z1 - 0.02);
  for (const sx of [-1, 1]) {
    const LX = sx * (W - 0.14);      // farol trasero Hilux: carcasa roja alta con tres secciones: freno (rojo), intermitente (ámbar) y retroceso (blanco)
    box(g, 0.21, 0.5, 0.05, other ? bas(0x6a0d10) : lam(0x9a1218), LX, 0.935, Z1 + 0.02);
    box(g, 0.17, 0.2, 0.03, other ? bas(0x7a1010) : brakeMat, LX, 1.06, Z1 + 0.0); box(g, 0.17, 0.12, 0.03, bas(0xff9a1a), LX, 0.89, Z1 + 0.0); box(g, 0.17, 0.12, 0.03, bas(0xe8eef0), LX, 0.77, Z1 + 0.0);
    if (!other) { const gl = new THREE.Sprite(brakeGlowMat.clone()); gl.scale.set(1.5, 1.5, 1); gl.position.set(LX, 1.06, Z1 - 0.1); gl.name = 'brakeGlow'; g.add(gl); }
  }
  // franja reflectante amarilla: por ambos costados a la altura de las manillas (del foco al portalón) y cruzando el capó
  for (const sx of [-1, 1]) { box(g, 0.02, 0.05, 3.615, reflex, sx * (W + 0.006), BELT - 0.08, -0.7575); box(g, 0.02, 0.05, 1.354, reflex, sx * (W + 0.006), 1.09, 1.725).rotation.x = 0.0739; }      // tramo recto hasta el fin de la puerta y tramo inclinado que baja con el capó hasta la punta alta del foco      // cinta reflectante fina, al borde alto de las puertas, el capó y la tolva
  // ruedas dentro de sus pasos (trocha 1,54 m): neumático torneado 265/65 R17, llanta de acero roja con centro gris y 6 tuercas
  { const liner = lam(0x0d0e0f, { side: THREE.DoubleSide });      // revestimiento negro del paso de rueda: tapa el túnel rojo que deja el recorte de la carrocería
    for (const z of [ZF, ZR]) { const s = new THREE.Shape(); s.absarc(z, WR0, AR + 0.01, Math.PI - AA, AA, true); s.absarc(z, WR0, AR - 0.11, AA, Math.PI - AA, false); extrude(g, s, 2 * (W + 0.07), 0, liner, 0); } }      // cubre también el borde biselado de la carrocería
  const wg = new THREE.Group(); g.add(wg);      // ruedas: grupo aparte, no sube con la carrocería (la camioneta va más alta)
  for (const z of [ZF, ZR]) for (const sx of [-1, 1]) { const X = sx * 0.76;
    const tr = new THREE.Mesh(tireGeo, tire); tr.rotation.z = Math.PI / 2; tr.scale.set(1.05, 0.85, 1.05); tr.position.set(X, WR0, z); wg.add(tr);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(AR + 0.01, 0.035, 6, 22, Math.PI), plast); lip.rotation.y = Math.PI / 2; lip.position.set(sx * (W + 0.005), SILL, z); lip.scale.y = (WR0 + AR - SILL) / (AR + 0.01); g.add(lip);      // labio negro del paso de rueda
    const rm = new THREE.Mesh(rimGeo, lam(0x5b5f64)); rm.rotation.z = -sx * Math.PI / 2; rm.scale.set(0.8, 0.85, 0.8); rm.position.set(X, WR0, z); wg.add(rm);      // aro de aleación gris oscuro
    const XF = X + sx * 0.1;      // cara de la llanta
    cyl(wg, 0.05, 0.05, 0.06, lam(0x24262a), XF, WR0, z, Math.PI / 2);      // tapa central
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 + 0.3; const sp = box(wg, 0.035, 0.17, 0.055, lam(0x80858b), XF, WR0 + Math.cos(a) * 0.115, z + Math.sin(a) * 0.115); sp.rotation.x = a;      // 5 rayos
      cyl(wg, 0.014, 0.014, 0.05, bas(0xd8e02a), XF + sx * 0.01, WR0 + Math.cos(a + 0.62) * 0.07, z + Math.sin(a + 0.62) * 0.07, Math.PI / 2); }      // tuercas con indicador amarillo
  }
  for (const z of [ZF, ZR]) { const ax = new THREE.Group(); ax.name = 'eje'; ax.position.set(0, WR0, z);      // cada eje en su grupo, centrado en la rueda: así giran (updateVisuals)
    for (const c of [...wg.children]) if (!c.isGroup && Math.abs(c.position.z - z) < 0.6) { c.position.y -= WR0; c.position.z -= z; ax.add(c); } wg.add(ax); }
  // rack negro tras la cabina (protector de luneta): dos montantes hasta el techo, travesaños, tirantes inclinados hacia la tolva
  { const RZ = ZC - 0.16, RH = ROOF + 0.06 - BELT;
    for (const sx of [-1, 1]) { cyl(g, 0.04, 0.04, RH, plast, sx * 0.74, BELT + RH / 2, RZ); const br = cyl(g, 0.035, 0.035, 0.95, plast, sx * 0.74, BELT + 0.31, RZ - 0.36); br.rotation.x = 0.86; }
    for (const y of [BELT + RH, BELT + RH * 0.62, BELT + RH * 0.3]) cyl(g, 0.035, 0.035, 1.48, plast, 0, y, RZ, Math.PI / 2);
    for (const x of [-0.37, 0, 0.37]) cyl(g, 0.02, 0.02, RH * 0.7, plast, x, BELT + RH * 0.65, RZ);
  }
  box(g, 0.14, 0.04, 0.14, dark, 0.74, ROOF + 0.08, ZC - 0.16);      // base de la baliza, sobre el montante del antivuelco del lado del conductor (izquierda)
  { const PX = -0.82, PZ = ZC - 0.42, PH = 2.9, SPH = 0.17;      // pértiga de seguridad de 10 pies (3,05 m con banderín): resorte cromado en la base y látigo con espiral blanco y negro que se inclina (grupo 'pertiga', lo anima updateVisuals)
    const crom = new THREE.MeshPhongMaterial({ color: 0xdfe3e6, shininess: 120, specular: 0xffffff });
    cyl(g, 0.055, 0.055, 0.04, dark, PX, BELT + 0.02, PZ);      // soporte negro en la base
    cyl(g, 0.05, 0.05, 0.02, crom, PX, BELT + 0.05, PZ);      // base cromada del resorte
    for (let k = 0; k < 9; k++) { const t = k / 8, r = 0.026 + 0.016 * Math.sin(Math.PI * t); const tor = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0105, 6, 14), crom); tor.rotation.x = Math.PI / 2; tor.position.set(PX, BELT + 0.07 + t * (SPH - 0.04), PZ); g.add(tor); }      // espiras del resorte, más anchas al medio
    const top = BELT + 0.04 + SPH, pg = new THREE.Group(); pg.name = 'pertiga'; pg.position.set(PX, top, PZ); g.add(pg);
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 128; { const c = cv.getContext('2d'); c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, 16, 128); c.fillStyle = '#16171a'; for (let k = -2; k < 12; k++) { c.beginPath(); c.moveTo(0, k * 12 + 8); c.lineTo(16, k * 12 - 4); c.lineTo(16, k * 12 + 4); c.lineTo(0, k * 12 + 16); c.fill(); } }
    const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(1, 9);
    cyl(pg, 0.016, 0.016, 0.05, crom, 0, 0.025, 0);      // tuerca del resorte
    cyl(pg, 0.014, 0.014, PH, new THREE.MeshBasicMaterial({ map: tx }), 0, 0.05 + PH / 2, 0);
    cyl(pg, 0.011, 0.011, 0.1, steel, 0, 0.05 + PH + 0.05, 0);      // punta metálica
    const fc = document.createElement('canvas'); fc.width = fc.height = 128; { const c = fc.getContext('2d'); c.fillStyle = '#ff6a1a'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#ee2b2b'; c.fillRect(6, 6, 116, 116); c.strokeStyle = '#d4f03a'; c.lineWidth = 17; c.beginPath(); c.moveTo(22, 14); c.lineTo(106, 114); c.moveTo(106, 14); c.lineTo(22, 114); c.stroke(); }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), side: THREE.DoubleSide })); fl.rotation.y = Math.PI / 2; fl.position.set(0, 0.05 + PH - 0.2, -0.16); pg.add(fl); }
  const b = cyl(g, 0.11, 0.11, 0.14, new THREE.MeshBasicMaterial({ color: other ? 0xffb000 : 0x3d8bff }), 0.74, ROOF + 0.17, ZC - 0.16); b.name = 'beacon';
  for (const ch of g.children) if (ch !== wg) ch.position.y += 0.1;      // altura libre mayor: la carrocería sube 10 cm sobre las ruedas
  blob(g, 3.0, 6.4);
  return g;
}
/* Chasis, ruedas (delanteras simples, traseras duales) y cabina a la izquierda, como en los Komatsu 930E */
function truckBase(g, bodyC, ws = 1) {      // ws: el camión se escala 1,1 a lo ancho y largo; las ruedas se compensan para quedar redondas (Ø ~4 m)      // camión minero de 300 t: llantas amarillas, cubierta delantera con barandas, cabina a la izquierda, radiador al centro con escalera diagonal, estanque entre ruedas
  const body = lam(bodyC, { map: grimeTex }), dark = lam(0x222426), steel = lam(0x585c60), tire = lam(0x353330), glass = lam(0x1d2a36), lime = bas(0xc8e61a), rail = lam(0x1a1a1a), cabC = lam(0x2a2c2e);
  box(g, 2.8, 1.1, 11, body, 0, 3.3, 0);      // bastidor
  const WY = 1.8 * ws, ejes = {}, eje = z => { if (!ejes[z]) { const a = new THREE.Group(); a.name = 'eje'; a.position.set(0, WY, z); g.add(a); ejes[z] = a; } return ejes[z]; };      // cada eje en su grupo: las ruedas giran (updateVisuals)
  const wheel = (x, z, wd) => { const A = eje(z), t = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, wd, 24), TIRE_MATS); t.position.set(x, 0, 0); t.rotation.z = Math.PI / 2; t.scale.x = ws; A.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, wd + 0.06, 24), rimMats(bodyC)); r.position.set(x, 0, 0); r.rotation.z = Math.PI / 2; r.scale.x = ws; A.add(r); const hb = cyl(A, 0.2, 0.2, wd + 0.2, body, x, 0, 0, Math.PI / 2); hb.scale.x = ws; };      // llanta grande amarilla con dibujo y maza
  wheel(3.05, 3.6, 1.9); wheel(-3.05, 3.6, 1.9);
  for (const sx of [1, -1]) { wheel(sx * 1.9, -3.4, 1.45); wheel(sx * 3.5, -3.4, 1.45); }      // duales anchas con espacio entre ellas
  box(g, 3.4, 1.4, 1.4, body, 0, 1.8, -3.4);                           // puente trasero
  {      // cadenas expulsoras de piedras: cuelgan de la tolva entre las ruedas duales y botan las rocas que se meten entre los neumáticos
    const NL = 16, im = new THREE.InstancedMesh(new THREE.TorusGeometry(0.13, 0.04, 5, 10), lam(0x3a3c3f), NL * 2), o = new THREE.Object3D(); let n = 0;
    for (const sx of [1, -1]) for (let k = 0; k < NL; k++) { o.position.set(sx * 2.7, 4.55 - k * 0.2, -4.9 + k * 0.012); o.rotation.set(0, k % 2 ? Math.PI / 2 : 0, Math.PI / 2); o.updateMatrix(); im.setMatrixAt(n++, o.matrix); }
    for (const sx of [1, -1]) box(g, 0.3, 0.3, 0.3, dark, sx * 2.7, 4.7, -4.9);      // soporte bajo la tolva
    g.add(im);
  }
  box(g, 1.8, 1.6, 1.2, body, 0, 2.4, -4.3);                            // carcasa del diferencial (se ve por detrás)
  for (const sx of [1, -1]) { cyl(g, 0.32, 0.32, 2.2, lam(0xb8b8b0), sx * 0.95, 3.6, -4.6); cyl(g, 0.45, 0.45, 0.9, body, sx * 0.95, 2.6, -4.6); }      // cilindros de suspensión hacia la tolva
  for (const sx of [1, -1]) { const hc = cyl(g, 0.34, 0.34, 2.4, body, sx * 1.85, 3.3, -0.9); hc.rotation.x = -0.25; cyl(g, 0.2, 0.2, 1.2, lam(0xb8b8b0), sx * 1.85, 4.3, -1.15); }      // cilindros de levante de la tolva
  for (const z of [2.75, 3.15]) cyl(g, 0.18, 0.18, 0.9, lam(0xc0201c), 3.1, 5.5, z);      // extintores en la cubierta
  // lado derecho del conductor (x < 0): caja entre las ruedas delanteras y traseras, y equipo de aire acondicionado en la cubierta
  box(g, 1.0, 3.5, 1.5, body, -2.9, 2.35, 0.1); for (const y of [1.2, 3.4]) box(g, 0.05, 0.12, 1.3, dark, -3.42, y, 0.1);      // caja alta entre las ruedas delanteras y traseras
  box(g, 1.3, 1.5, 1.7, body, -2.55, 5.8, 2.95); box(g, 0.06, 0.9, 1.3, GRILLE_MAT, -3.21, 5.8, 2.95);      // aire acondicionado: gabinete atrás en la cubierta, con rejilla al costado
  { const fan = cyl(g, 0.42, 0.42, 0.08, lam(0x1b1c1e), -2.55, 6.58, 2.95); for (let k = 0; k < 3; k++) { const bl = box(g, 0.75, 0.03, 0.12, lam(0x55595d), -2.55, 6.63, 2.95); bl.rotation.y = k * 1.05; } }      // ventilador del condensador
  box(g, 0.06, 1.4, 0.06, rail, 3.45, 6.2, 6.0); box(g, 0.1, 0.8, 0.5, dark, 3.6, 6.6, 6.1);      // espejo
  for (const sx of [1, -1]) { box(g, 1.0, 1.5, 2.6, body, sx * 2.3, 3.1, 0.2); box(g, 0.5, 2.6, 0.5, body, sx * 1.6, 3.4, 2.3); }      // estanques y columnas de suspensión
  // cubierta delantera: plataforma ancha sobre las ruedas, con barandas
  box(g, 6.8, 0.22, 3.6, body, 0, 4.95, 4.3);
  box(g, 6.8, 0.06, 0.06, rail, 0, 6.05, 6.05); for (let x = -3.3; x <= 3.31; x += 1.1) box(g, 0.06, 1.1, 0.06, rail, x, 5.5, 6.05);
  for (const sx of [1, -1]) { box(g, 0.06, 0.06, 3.5, rail, sx * 3.35, 6.05, 4.3); for (let z = 2.7; z <= 6.0; z += 1.1) box(g, 0.06, 1.1, 0.06, rail, sx * 3.35, 5.5, z); }
  box(g, 2.4, 1.95, 2.4, cabC, 1.75, 6.03, 3.5);                          // cabina (lado izquierdo)
  box(g, 2.1, 1.0, 0.08, glass, 1.75, 6.3, 4.72); box(g, 0.08, 1.0, 1.9, glass, 2.96, 6.3, 3.5); box(g, 0.08, 1.0, 1.9, glass, 0.54, 6.3, 3.5);
  box(g, 1.6, 1.4, 1.6, body, -1.9, 5.8, 3.4);                          // gabinete de control (derecha)
  // frente robusto que baja casi al piso: bloque del radiador, parrilla alta, cilindros de suspensión delanteros a los lados y parachoques-plataforma abajo
  box(g, 4.3, 3.7, 2.0, body, 0, 3.05, 5.0);                            // bloque del frente
  box(g, 4.1, 3.4, 0.2, GRILLE_MAT, 0, 3.2, 6.05);                     // radiador: rejilla negra grande, del parachoques a la cubierta
  for (const [x, y] of [[-1.45, 3.0], [-1.15, 3.0], [1.15, 3.0], [1.45, 3.0]]) box(g, 0.22, 0.3, 0.06, bas(0xfff6d8), x, y, 6.22);      // focos chicos en la rejilla
  for (const sx of [1, -1]) { cyl(g, 0.55, 0.55, 2.4, body, sx * 2.0, 3.6, 4.6); cyl(g, 0.3, 0.3, 1.2, lam(0xb8b8b0), sx * 2.0, 2.0, 4.6);      // cilindros de suspensión delanteros
    for (const dy of [0, 0.75]) { const c = cyl(g, 0.34, 0.34, 0.25, body, sx * 2.0, 3.5 + dy, 5.25); c.rotation.x = Math.PI / 2; } }
  box(g, 6.6, 0.45, 1.6, body, 0, 1.25, 6.35);                          // parachoques-plataforma bajo
  for (const sx of [1, -1]) {      // frente robusto: bloques macizos a cada lado de la rejilla, sobre las ruedas, con las tapas redondas de los cilindros
    box(g, 1.35, 2.3, 1.0, body, sx * 2.8, 3.8, 5.75); box(g, 0.9, 1.4, 0.8, body, sx * 2.55, 1.9, 5.9);
    for (const x of [2.45, 3.15]) { const c = cyl(g, 0.33, 0.33, 0.35, body, sx * x, 3.75, 6.35); c.rotation.x = Math.PI / 2; }
    box(g, 1.3, 0.1, 0.05, lime, sx * 2.8, 3.2, 6.27);      // cinta reflectante
  }
  box(g, 6.8, 0.1, 0.05, lime, 0, 4.88, 6.12);      // cinta reflectante en el borde de la cubierta
  box(g, 6.6, 0.12, 0.12, rail, 0, 1.5, 7.15);
  for (const sx of [1, -1]) { for (const dz of [-0.25, 0.25]) box(g, 0.06, 1.15, 0.06, rail, sx * 3.42, 1.0, 6.5 + dz); for (const y of [0.65, 0.95, 1.3]) box(g, 0.06, 0.05, 0.5, steel, sx * 3.42, y, 6.5); }      // escalerillas cortas a cada costado de afuera del parachoques
  for (const x of [3.0, -3.0, 2.0]) { for (const xx of [x - 0.22, x + 0.22]) box(g, 0.07, 1.0, 0.07, rail, xx, 1.98, 7.0); box(g, 0.51, 0.07, 0.07, rail, x, 2.48, 7.0); }      // pasamanos para subirse en el parachoques
  for (const xx of [-2.95, -2.5]) box(g, 0.08, 4.4, 0.08, rail, xx, 3.7, 6.35);      // escalera vertical por la otra orilla, del parachoques a la cubierta
  for (let y = 1.75; y <= 4.9; y += 0.32) box(g, 0.45, 0.05, 0.06, rail, -2.725, y, 6.35);
  {      // escalera diagonal por el frente: sube desde el parachoques (un lado) hasta la cubierta junto a la escalera vertical (otro lado), con peldaños y pasamanos
    const x0 = 1.4, y0 = 1.55, x1 = -2.0, y1 = 4.95, n = 12, an = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    for (let k = 0; k <= n; k++) box(g, 0.34, 0.07, 0.62, steel, x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, 6.6);
    for (const dz of [-0.32, 0.32]) { const s = box(g, L + 0.4, 0.22, 0.08, dark, mx, my - 0.1, 6.6 + dz); s.rotation.z = an; const hr = box(g, L + 0.4, 0.07, 0.07, rail, mx, my + 1.0, 6.6 + dz); hr.rotation.z = an;
      for (const t of [0.05, 0.5, 0.95]) box(g, 0.06, 1.05, 0.06, rail, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 0.5, 6.6 + dz); }
  }
  for (const x of [-0.9, 0.9]) box(g, 0.3, 0.25, 0.08, bas(0xfff6d8), x, 5.25, 6.1);      // focos junto al número
  for (const sx of [1, -1]) { box(g, 1.5, 0.5, 0.1, dark, sx * 2.8, 4.55, 6.28); for (const x of [2.45, 3.15]) { const l = cyl(g, 0.27, 0.27, 0.14, bas(0xfff6d8), sx * x, 4.55, 6.36); l.rotation.x = Math.PI / 2; } }      // focos redondos bajo la cubierta
  for (const [x, y, c] of [[-0.85, 3.05, 0xd01818], [0.85, 3.05, 0xd01818], [-0.55, 3.4, 0xd01818], [0.55, 3.4, 0xd01818], [-0.2, 3.2, 0xfff4dc], [0.2, 3.2, 0xfff4dc], [-0.55, 2.95, 0xff7a10], [0.55, 2.95, 0xff7a10]]) { const l = cyl(g, 0.15, 0.15, 0.08, bas(c), x, y, -5.53); l.rotation.x = Math.PI / 2; }      // luces traseras redondas: freno, retroceso y viraje
  box(g, 0.35, 0.25, 0.1, dark, 0, 2.95, -5.53);      // caja de conexiones
  const b = cyl(g, 0.24, 0.24, 0.36, new THREE.MeshBasicMaterial({ color: 0xffb000 }), 1.75, 7.18, 3.4); b.name = 'beacon';
  return b;
}

function buildTruck(bodyC, accC, loaded) {
  const g = new THREE.Group();
  const body = lam(bodyC, { map: grimeTex }), acc = body, liner = lam(0x4a4036, { map: grimeTex });      // sin bordes negros: todo del color de la tolva, con uso
  truckBase(g, bodyC, 1.1);
  // tolva con la cola curva: el piso es plano adelante y se levanta en curva hacia atrás; las paredes siguen esa curva por abajo
  const yb = z => z > -2.4 ? 4.15 : 4.15 + 1.2 * ((-2.4 - z) / 4.2) ** 2, Z0 = 2.2, Z1 = -6.6, ZS = [];
  for (let k = 0; k <= 16; k++) ZS.push(Z0 + (Z1 - Z0) * k / 16);
  // casco de la tolva: sección curva (fondo de canoa, como se ve por detrás), más ancha que las ruedas; se hace menos honda hacia la cola
  const W = 3.7, TOP = 6.75, dep = z => TOP - yb(z), NP = 18;
  const cs = (p, w, d) => { const ph = Math.PI * p, s = Math.sin(ph); return [-w * Math.cos(ph), TOP - d * Math.pow(s, 0.6)]; };      // p de 0 a 1 cruza de un lado al otro
  const shell = (w, dd, m) => {
    const pos = [], idx = [];
    ZS.forEach(z => { for (let k = 0; k <= NP; k++) { const [x, y] = cs(k / NP, w, dep(z) - dd); pos.push(x, y, z); } });
    for (let a = 0; a < ZS.length - 1; a++) for (let k = 0; k < NP; k++) { const i0 = a * (NP + 1) + k, i1 = i0 + NP + 1; idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const uv = []; ZS.forEach((z, a) => { for (let k = 0; k <= NP; k++) uv.push(k / NP * 3, a / (ZS.length - 1) * 2); }); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const me = new THREE.Mesh(geo, m); g.add(me); return me;
  };
  shell(W, 0, lam(bodyC, { side: THREE.DoubleSide, map: grimeTex }));                 // casco exterior
  shell(W - 0.3, 0.35, lam(0x5a4c3e, { side: THREE.DoubleSide, map: grimeTex }));     // revestimiento interior
  const ring = (z, r, m, tl = 0.3) => { const d = dep(z), pts = []; for (let k = 0; k <= 24; k++) { const [x, y] = cs(k / 24, W + 0.05, d + 0.05); pts.push(new THREE.Vector3(x, y, z - (y - (TOP - d)) * tl)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 6, false), m)); };
  for (const z of [1.2, -0.6, -2.6, -4.6]) ring(z, 0.16, body);         // costillas en arco
  ring(Z1, 0.24, acc, 0);                                                   // borde de la cola
  for (const sx of [1, -1]) box(g, 0.5, 0.2, 8.9, acc, sx * (W - 0.15), 6.8, -2.2);      // borde superior
  for (const sx of [1, -1]) { const v = box(g, 0.3, 0.3, 3.0, body, sx * 0.7, yb(-3.8) - 0.05, -3.8); v.rotation.y = sx * 0.25; }      // refuerzos en V bajo la cola
  box(g, 2 * W, 2.9, 0.5, body, 0, 5.55, 2.0);
  box(g, 2 * W - 0.6, 2.5, 0.08, liner, 0, 5.75, 1.7);
  {      // corona (visera) curva sobre la cabina: arco de lado a lado que cae en los costados, con borde delantero oscuro
    const R = 8, th = Math.asin(3.9 / R), mk = (r, len, m, z, y) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, true, -th, 2 * th), m); c.rotation.x = -Math.PI / 2; c.position.set(0, y - r, z); g.add(c); return c; };
    const bs = lam(bodyC, { side: THREE.DoubleSide, map: grimeTex });
    mk(R, 5.6, bs, 4.5, 7.95);      // una sola lámina
    mk(R + 0.02, 0.3, bs, 7.2, 7.97);      // borde delantero
    { const s = new THREE.Shape(), r = R; s.moveTo(-3.4, 6.8); for (let k = 0; k <= 16; k++) { const x = -3.4 + 6.8 * k / 16; s.lineTo(x, 7.95 - (r - Math.sqrt(r * r - x * x)) + 0.02); } s.lineTo(3.4, 6.8);
      const fw = new THREE.Mesh(new THREE.ShapeGeometry(s), bs); fw.position.z = 2.0; g.add(fw); const fl = new THREE.Mesh(new THREE.ShapeGeometry(s), lam(0x25282c, { side: THREE.DoubleSide })); fl.position.z = 1.72; g.add(fl); }      // pared delantera hasta la corona
  }
  if (loaded) {   // carga de material fino dentro de la tolva (los camiones que suben van cargados con fino): montón parejo que asoma sobre la corona
    const y0 = Math.max(4.75 + 0.35, TOP - (dep(-2.1) - 0.35) + 0.4), m = finePile(2.95, Math.max(0.9, 4.75 + 2.3 - y0), 3.9); m.position.set(0, y0, -2.1); g.add(m);
  }
  blob(g, 8.4, 14);
  g.scale.set(1.1, 1, 1.1);      // medidas reales de un camión de 300 t: ~15 m de largo, ~9 m de ancho, ~7,9 m hasta la corona, neumáticos de ~4 m
  return g;
}
const TRUCK_YEL = 0xdcae45, TRUCK_ACC = 0x2f2c29;
const protoSame = buildTruck(TRUCK_YEL, TRUCK_ACC, true);    // suben cargados
const protoOnc = buildTruck(TRUCK_YEL, TRUCK_ACC, false);    // bajan vacíos
const CAEX_PLATE = { f: [4.4, 6.24, 1.5, 0.75, 0.75], r: [4.15, -5.6, 1.5, 0.75], s: [6.0, -0.25, 1.5, 0.75, 3.8] };      // al frente en la rejilla, atrás bajo la tolva y a cada lado de la tolva
/* Aljibe (único): estanque amarillo desgastado, barra de riego trasera y placa 703 */
const SPR = { N: 80, sx: new Float32Array(80), vx: new Float32Array(80), vz: new Float32Array(80), ph: new Float32Array(80) };
for (let i = 0; i < SPR.N; i++) { SPR.sx[i] = (hash(i, 11) - 0.5) * 5.2; SPR.vx[i] = (hash(i, 12) - 0.5) * 3.6; SPR.vz[i] = hash(i, 13) * 2.0; SPR.ph[i] = hash(i, 14); }
function buildAljibe() {      // aljibe tipo HD785 con estanque de agua (como el 703 de la foto): estanque elíptico ancho y gastado con costillas y franjas de barro, nariz volada sobre la cubierta, pasarela y barandas arriba, escalera de acceso atrás, barra de riego con boquillas y cañones laterales, mástil de luces adelante
  const g = new THREE.Group();
  const tank = lam(0xc49d2a, { map: grimeTex }), tankD = lam(0x8f7a2e, { map: grimeTex }), dirt = lam(0x6e6245), dark = lam(0x222426), steel = lam(0x585c60), rail = lam(0x1a1a1a), grate = lam(0x2b2d30), white = lam(0xe8e4d8);
  truckBase(g, 0xdcb21a);
  const RX = 2.9, RY = 1.9, CY = 6.7, Z0 = 2.0, Z1 = -6.6, LEN = Z0 - Z1;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, LEN, 36), tank); body.rotation.x = Math.PI / 2; body.scale.set(RX, 1, RY); body.position.set(0, CY, (Z0 + Z1) / 2); g.add(body);      // cuerpo elíptico (más ancho que alto)
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, LEN - 0.2, 36, 1, true, Math.PI * 0.55, Math.PI * 0.9), tankD); lower.rotation.x = Math.PI / 2; lower.scale.set(RX + 0.02, 1, RY + 0.02); lower.position.set(0, CY, (Z0 + Z1) / 2); g.add(lower);      // mitad baja más sucia
  for (const [z, sz] of [[Z1, 0.45], [Z0, 0.3]]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), tank); cap.scale.set(RX, RY, sz * (z > 0 ? 1 : 1)); cap.position.set(0, CY, z); g.add(cap); }      // tapas abombadas
  for (const z of [-5.2, -3.4, -1.6, 0.2]) { const rb = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.22, 36), dirt); rb.rotation.x = Math.PI / 2; rb.scale.set(RX + 0.05, 1, RY + 0.05); rb.position.set(0, CY, z); g.add(rb); }      // costillas y franjas de barro
  for (const sx of [1, -1]) box(g, 0.08, 0.08, LEN, dark, sx * (RX - 0.35), CY + 0.95, (Z0 + Z1) / 2);      // cordones de soldadura superiores
  box(g, 4.6, 1.1, 2.0, tank, 0, CY + 1.15, Z0 + 0.9); cyl(g, 0.55, 0.55, 4.6, tank, 0, CY + 1.15, Z0 + 1.9, Math.PI / 2); box(g, 4.0, 0.9, 1.0, tankD, 0, CY + 0.35, Z0 + 1.3);      // nariz volada sobre la cubierta, redondeada adelante
  box(g, 1.3, 0.1, LEN + 2.2, grate, 0, CY + RY + 0.05, (Z0 + Z1) / 2 + 1.1);      // pasarela superior (parrilla)
  for (const sx of [1, -1]) { box(g, 0.05, 0.05, LEN + 2.4, rail, sx * 0.95, CY + RY + 1.05, (Z0 + Z1) / 2 + 1.1); for (let z = Z1 - 0.1; z <= Z0 + 2.2; z += 1.4) box(g, 0.05, 1.0, 0.05, rail, sx * 0.95, CY + RY + 0.55, z); }      // barandas
  box(g, 1.95, 0.05, 0.05, rail, 0, CY + RY + 1.05, Z1 - 0.1); box(g, 1.95, 0.05, 0.05, rail, 0, CY + RY + 1.05, Z0 + 2.3);      // cierres de la baranda
  for (const z of [-4.2, -0.6]) { cyl(g, 0.55, 0.55, 0.3, dark, 0, CY + RY + 0.2, z); cyl(g, 0.12, 0.12, 0.5, steel, 0.5, CY + RY + 0.4, z); }      // escotillas con bisagra
  { const mon = cyl(g, 0.14, 0.14, 1.0, steel, 0.6, CY + RY + 0.6, Z0 + 1.6); const mb = cyl(g, 0.1, 0.1, 1.2, steel, 0.6, CY + RY + 1.3, Z0 + 2.1); mb.rotation.x = 1.0; cyl(g, 0.25, 0.25, 0.2, dark, 0.6, CY + RY + 0.12, Z0 + 1.6); }      // cañón (monitor) de agua adelante
  for (let y = CY - RY + 0.3; y < CY + RY; y += 0.45) box(g, 0.6, 0.05, 0.05, steel, -(RX - 0.2), y, Z1 + 0.9); for (const x of [-(RX - 0.5), -(RX + 0.1)]) box(g, 0.05, 2 * RY - 0.2, 0.05, steel, x, CY, Z1 + 0.9);      // escalera de acceso atrás (lado derecho)
  box(g, 5.6, 0.5, 0.4, dark, 0, 3.6, Z1 - 0.5); for (const sx of [1, -1]) box(g, 0.3, 0.9, 0.3, dark, sx * 2.5, 3.2, Z1 - 0.4);      // parachoques trasero
  const pipe = cyl(g, 0.14, 0.14, 5.6, steel, 0, 3.6, -6.4, Math.PI / 2);               // barra de riego
  for (const x of [-2.4, 2.4]) cyl(g, 0.1, 0.1, 1.9, steel, x, 4.5, -6.3);
  for (let i = -2; i <= 2; i++) box(g, 0.2, 0.25, 0.3, steel, i * 1.1, 3.42, -6.5);
  for (const sx of [1, -1]) { const c = cyl(g, 0.12, 0.12, 0.9, steel, sx * 2.6, 4.9, -6.5); c.rotation.z = sx * 0.9; c.rotation.x = 0.4; box(g, 0.35, 0.35, 0.35, dark, sx * 2.45, 4.6, -6.3); }      // cañones laterales de riego
  box(g, 0.1, 0.1, 1.0, steel, 0, 3.2, Z1 + 0.3); for (const sx of [1, -1]) { const hs = cyl(g, 0.07, 0.07, 2.6, dark, sx * 1.6, 4.0, Z1 + 0.2); hs.rotation.z = sx * 0.4; }      // válvula y mangueras
  { const px = 3.2, pz = 5.6; cyl(g, 0.06, 0.06, 3.0, steel, px, 7.5, pz); for (const y of [7.6, 8.4]) box(g, 0.45, 0.35, 0.3, dark, px, y, pz + 0.2); box(g, 0.1, 0.05, 0.6, steel, px, 9.0, pz); }      // mástil con dos focos y antena (adelante a la izquierda)
  for (const sx of [1, -1]) box(g, 0.06, 0.06, 1.3, white, sx * 2.9, 5.95, 2.4);      // pasamanos blancos junto al estanque
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPR.N * 3), 3));
  const dc = document.createElement('canvas'); dc.width = dc.height = 32; const dg = dc.getContext('2d');
  const gr = dg.createRadialGradient(16, 16, 1, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); dg.fillStyle = gr; dg.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8ecff, size: 0.8, map: new THREE.CanvasTexture(dc), transparent: true, opacity: 0.8, depthWrite: false }));
  pts.name = 'spray'; pts.frustumCulled = false; g.add(pts);
  blob(g, 8.4, 14);
  g.scale.set(0.8, 0.8, 0.8);      // HD785 (clase 100 t): ~12 m de largo y ~5,5 m de ancho, claramente más chico que un CAEX de 300 t (15 × 9 m)
  return g;
}
const protoAlj = buildAljibe();
const ALJ_PLATE = { f: [5.6, 6.08, 1.3, 0.65], r: [6.7, -7.5, 1.3, 0.65], s: [6.9, -4.3, 1.3, 0.65, 2.93] };      // adelante en el panel de la cubierta, atrás en la tapa del estanque y a cada costado del estanque
function updateSpray(pts, t) {      // t: reloj de animación (segundos)
  const a = pts.geometry.attributes.position.array;
  for (let i = 0; i < SPR.N; i++) {
    const age = (t * 1.5 + SPR.ph[i]) % 1;
    a[i * 3] = SPR.sx[i] + SPR.vx[i] * age; a[i * 3 + 1] = Math.max(0.15, 3.7 + 1.2 * age - 6.5 * age * age); a[i * 3 + 2] = -6.7 - (2.5 + SPR.vz[i]) * age;
  }
  pts.geometry.attributes.position.needsUpdate = true;
}

let capNum = 100;      // numeración de CAEX: siempre del 101 al 173
const nextCaexId = () => { capNum = capNum >= 173 ? 101 : capNum + 1; return capNum; };
const resetCaexIds = () => { capNum = 100; };      // al empezar una partida los CAEX se numeran de nuevo desde el 101

export { buildPickup, truckBase, buildTruck, TRUCK_YEL, TRUCK_ACC, protoSame, protoOnc, CAEX_PLATE, buildAljibe, protoAlj, ALJ_PLATE, updateSpray, nextCaexId, resetCaexIds };
