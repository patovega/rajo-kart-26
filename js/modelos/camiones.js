// Camiones: camioneta doble cabina, chasis común (truckBase), CAEX de 300 t (buildTruck) y aljibe tipo HD785 (buildAljibe), con sus prototipos y placas.
import { GRILLE_MAT, TIRE_MATS, bas, blob, box, brakeGlowMat, brakeMat, cyl, grimeTex, lam, rimMats, rockGeo } from './materiales.js';
import { hash } from '../comun/mates.js';

function buildPickup(bodyC, other) {
  const g = new THREE.Group();
  const red = lam(bodyC || 0xc9141c), dark = lam(0x18191b), glass = lam(0x1b2733), chrome = lam(0xb9bec4), orange = new THREE.MeshBasicMaterial({ color: 0xff6a00, side: THREE.DoubleSide });
  box(g, 2.0, 0.7, 5.0, red, 0, 0.95, 0);
  box(g, 1.9, 0.95, 2.7, red, 0, 1.775, 0.1);
  box(g, 1.94, 0.45, 2.45, glass, 0, 1.85, 0.1); box(g, 1.96, 0.47, 0.12, red, 0, 1.85, 0.1);
  box(g, 1.9, 0.14, 2.7, red, 0, 2.3, 0.1);
  box(g, 0.1, 0.5, 1.15, red, 0.95, 1.55, -1.875); box(g, 0.1, 0.5, 1.15, red, -0.95, 1.55, -1.875);
  box(g, 1.9, 0.5, 0.1, red, 0, 1.55, -2.45);
  box(g, 1.8, 0.04, 1.15, dark, 0, 1.31, -1.875);
  box(g, 2.06, 0.3, 0.25, dark, 0, 0.6, 2.55); box(g, 2.06, 0.3, 0.25, dark, 0, 0.6, -2.55);
  box(g, 1.5, 0.3, 0.05, dark, 0, 1.0, 2.51);
  for (const x of [-0.7, 0.7]) { box(g, 0.4, 0.2, 0.05, bas(0xfff3c4), x, 1.1, 2.52); box(g, 0.4, 0.2, 0.05, other ? bas(0x7a1010) : brakeMat, x, 1.1, -2.52); if (!other) { const gl = new THREE.Sprite(brakeGlowMat.clone()); gl.scale.set(1.7, 1.7, 1); gl.position.set(x, 1.1, -2.65); gl.name = 'brakeGlow'; g.add(gl); } }
  for (const x of [-1.0, 1.0]) for (const z of [-1.6, 1.6]) { cyl(g, 0.45, 0.45, 0.32, lam(0x0f0f10), x, 0.45, z, Math.PI / 2); cyl(g, 0.24, 0.24, 0.34, chrome, x, 0.45, z, Math.PI / 2); }
  cyl(g, 0.27, 0.27, 0.1, dark, 0, 2.42, 0.1);
  const b = cyl(g, 0.21, 0.21, 0.3, new THREE.MeshBasicMaterial({ color: other ? 0xffb000 : 0x3d8bff }), 0, 2.62, 0.1); b.name = 'beacon';
  // Pértiga: soporte en la tolva, mástil rayado naranja/blanco, bandera y remate
  box(g, 0.22, 0.34, 0.22, dark, 0.88, 1.47, -2.3);
  const pm = [new THREE.MeshBasicMaterial({ color: 0xff6a00 }), new THREE.MeshBasicMaterial({ color: 0xffffff })];
  for (let i = 0; i < 3; i++) cyl(g, 0.06, 0.06, 1.2, pm[i % 2], 0.88, 2.5 + i * 1.2, -2.3);
  cyl(g, 0.11, 0.11, 0.1, pm[0], 0.88, 5.55, -2.3);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), orange); flag.position.set(0.88 + 0.5, 5.15, -2.3); g.add(flag);
  blob(g, 3.0, 6.4);
  return g;
}
/* Chasis, ruedas (delanteras simples, traseras duales) y cabina a la izquierda, como en los Komatsu 930E */
function truckBase(g, bodyC, ws = 1) {      // ws: el camión se escala 1,1 a lo ancho y largo; las ruedas se compensan para quedar redondas (Ø ~4 m)      // camión minero de 300 t: llantas amarillas, cubierta delantera con barandas, cabina a la izquierda, radiador al centro con escalera diagonal, estanque entre ruedas
  const body = lam(bodyC, { map: grimeTex }), dark = lam(0x222426), steel = lam(0x585c60), tire = lam(0x353330), glass = lam(0x1d2a36), lime = bas(0xc8e61a), rail = lam(0x1a1a1a), cabC = lam(0x2a2c2e);
  box(g, 2.8, 1.1, 11, body, 0, 3.3, 0);      // bastidor
  const WY = 1.8 * ws, wheel = (x, z, wd) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, wd, 24), TIRE_MATS); t.position.set(x, WY, z); t.rotation.z = Math.PI / 2; t.scale.x = ws; g.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, wd + 0.06, 24), rimMats(bodyC)); r.position.set(x, WY, z); r.rotation.z = Math.PI / 2; r.scale.x = ws; g.add(r); const hb = cyl(g, 0.2, 0.2, wd + 0.2, body, x, WY, z, Math.PI / 2); hb.scale.x = ws; };      // llanta grande amarilla con dibujo y maza
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
  if (loaded) {   // carga de roca dentro de la tolva
    const rm = [lam(0x6e5c49), lam(0x8a7660), lam(0x574a3b)];
    for (let i = 0; i < 36; i++) {
      const x = (hash(i, 1) - 0.5) * 5.0, z = -2.1 + (hash(i, 2) - 0.5) * 7.2, sc = 0.55 + hash(i, 3) * 0.7;
      const h = 0.4 + 1.9 * Math.max(0, 1 - (x / 2.9) ** 2) * Math.max(0, 1 - ((z + 2.1) / 3.9) ** 2);
      const r = new THREE.Mesh(rockGeo, rm[i % 3]); r.scale.set(sc, sc * 0.75, sc);
      r.position.set(x, Math.max(4.75 + h, TOP - (dep(z) - 0.35) * Math.pow(Math.max(0, 1 - (x / (W - 0.3)) ** 2), 0.3) + 0.4) + sc * 0.3, z); r.rotation.set(hash(i, 4) * 3, hash(i, 5) * 3, hash(i, 6) * 3); g.add(r);
    }
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
