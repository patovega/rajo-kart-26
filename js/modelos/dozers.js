// Dozers: wheel dozer tipo 854K, bulldozer de orugas tipo D10 y el wheel dozer sencillo con roca de la zona de la superficie.
import { TRK, TRK2, bas, box, cyl, grimeTex, lam, rockGeo } from './materiales.js';

function buildWheelDozer() {      // wheel dozer tipo Cat 854K: bastidor articulado, 4 neumáticos de 3,2 m con tacos y llanta, capó atrás con escape y filtro, cabina ROPS al centro con baranda y escalera, hoja con brazos de empuje y cilindros de levante
  const g = new THREE.Group(), yel = lam(0xe8b80c, { map: grimeTex }), dk = lam(0x1e1f22), tire = lam(0x151515), rim = lam(0xd9c25a), glass = lam(0x22313d), steel = lam(0x55585c), blk = lam(0x0c0c0c);
  for (const z of [-2.7, 2.7]) for (const sx of [-1, 1]) { const x = sx * 2.0; cyl(g, 1.6, 1.6, 1.2, tire, x, 1.6, z, Math.PI / 2); cyl(g, 0.95, 0.95, 1.24, rim, x, 1.6, z, Math.PI / 2); cyl(g, 0.45, 0.45, 1.3, dk, x, 1.6, z, Math.PI / 2);
    for (let a = 0; a < 8; a++) { const t = box(g, 0.32, 0.22, 1.2, blk, x + Math.cos(a * Math.PI / 4) * 1.56, 1.6 + Math.sin(a * Math.PI / 4) * 1.56, z); t.rotation.z = a * Math.PI / 4; } }      // tacos
  box(g, 2.8, 1.5, 4.0, dk, 0, 1.8, -2.4); box(g, 3.2, 2.4, 3.2, yel, 0, 3.0, -3.3); box(g, 3.3, 1.3, 0.4, dk, 0, 2.9, -5.05);      // bastidor trasero, capó, parrilla
  cyl(g, 0.18, 0.18, 1.6, dk, 0.9, 4.9, -3.9); box(g, 1.6, 0.5, 0.6, dk, -0.4, 4.4, -2.4);      // escape y filtro de aire
  box(g, 1.2, 1.2, 1.2, dk, 0, 1.6, 0.1); box(g, 2.8, 1.3, 2.8, yel, 0, 1.9, 1.9);      // articulación y bastidor delantero
  box(g, 2.4, 0.35, 2.3, yel, 0, 3.3, -0.9); for (const sx of [-1, 1]) for (const z of [-2.0, 0.2]) box(g, 0.18, 2.1, 0.18, dk, sx * 1.15, 4.45, z);      // piso y pilares ROPS
  box(g, 2.2, 1.5, 0.06, glass, 0, 4.35, 0.25); box(g, 2.2, 1.5, 0.06, glass, 0, 4.35, -2.05); for (const sx of [-1, 1]) box(g, 0.06, 1.5, 2.1, glass, sx * 1.12, 4.35, -0.9);
  box(g, 2.6, 0.25, 2.6, yel, 0, 5.6, -0.9); cyl(g, 0.16, 0.16, 0.28, bas(0xffb000), 0.9, 5.85, -0.9); for (const sx of [-1, 1]) box(g, 0.08, 0.6, 0.5, dk, sx * 1.55, 4.6, 0.2);      // techo, baliza, espejos
  for (let y = 0.6; y < 3.2; y += 0.5) box(g, 0.5, 0.06, 0.06, steel, -1.7, y, -0.9); for (const sx of [-1, 1]) box(g, 0.05, 0.9, 2.8, steel, sx * 1.5, 4.3, -3.3);      // escalera y barandas
  for (const sx of [-1, 1]) { const a = box(g, 0.4, 0.45, 3.6, yel, sx * 1.5, 1.5, 4.0); a.rotation.x = 0.1; const c = cyl(g, 0.14, 0.14, 2.6, steel, sx * 1.0, 2.9, 3.6); c.rotation.x = 1.1; }      // brazos y cilindros
  box(g, 6.0, 2.4, 0.4, yel, 0, 1.75, 6.1); box(g, 6.0, 0.3, 0.55, steel, 0, 0.55, 6.15); for (const sx of [-1, 1]) box(g, 0.3, 2.3, 0.9, yel, sx * 2.9, 1.75, 5.85);      // hoja, cuchilla y aletas
  return g;
}
function buildTrackDozer() {      // bulldozer de orugas tipo Cat D10: orugas altas con rodillos y zapatas, capó largo, cabina ROPS atrás, hoja semi-U con brazos y cilindros, desgarrador (ripper) atrás
  const g = new THREE.Group(), yel = lam(0xe8b80c, { map: grimeTex }), dk = lam(0x1e1f22), glass = lam(0x22313d), steel = lam(0x55585c), blk = lam(0x0c0c0c);
  for (const sx of [-1, 1]) { const x = sx * 1.6;
    box(g, 0.95, 1.1, 4.6, TRK, x, 0.6, 0); box(g, 0.95, 0.9, 3.0, TRK, x, 2.0, -0.4);      // oruga: tramo bajo y tramo alto
    cyl(g, 0.78, 0.78, 1.0, TRK2, x, 1.3, -2.3, Math.PI / 2); cyl(g, 0.65, 0.65, 1.0, TRK2, x, 1.2, 2.3, Math.PI / 2); cyl(g, 0.62, 0.62, 1.0, TRK2, x, 2.45, -0.5, Math.PI / 2);      // rueda motriz, tensora y superior
    for (let z = -1.8; z <= 1.8; z += 0.6) cyl(g, 0.3, 0.3, 1.04, dk, x, 0.4, z, Math.PI / 2); for (let z = -2.2; z <= 2.2; z += 0.35) box(g, 1.0, 0.08, 0.14, blk, x, 1.17, z);      // rodillos y zapatas
  }
  box(g, 2.3, 1.0, 4.8, dk, 0, 1.4, 0); box(g, 2.6, 1.6, 3.0, yel, 0, 2.7, 1.3); box(g, 2.7, 1.2, 0.3, dk, 0, 2.6, 2.85);      // bastidor, capó, parrilla
  cyl(g, 0.17, 0.17, 1.5, dk, 0.7, 4.1, 1.7); box(g, 0.5, 0.5, 0.5, dk, -0.7, 3.75, 1.7);      // escape y filtro
  box(g, 2.4, 0.3, 2.2, yel, 0, 2.4, -1.3); for (const sx of [-1, 1]) for (const z of [-2.3, -0.3]) box(g, 0.18, 2.0, 0.18, dk, sx * 1.1, 3.5, z);      // piso y pilares ROPS
  box(g, 2.1, 1.5, 0.06, glass, 0, 3.5, -0.3); box(g, 2.1, 1.5, 0.06, glass, 0, 3.5, -2.3); for (const sx of [-1, 1]) box(g, 0.06, 1.5, 1.9, glass, sx * 1.08, 3.5, -1.3);
  box(g, 2.5, 0.25, 2.5, yel, 0, 4.6, -1.3); cyl(g, 0.16, 0.16, 0.28, bas(0xffb000), 0.8, 4.85, -1.3);      // techo y baliza
  for (const sx of [-1, 1]) { box(g, 0.45, 0.5, 3.4, yel, sx * 2.0, 1.2, 3.5); const c = cyl(g, 0.16, 0.16, 2.4, steel, sx * 1.0, 3.0, 3.5); c.rotation.x = 1.0; }      // brazos de empuje y cilindros
  box(g, 5.2, 2.3, 0.45, yel, 0, 1.6, 5.4); box(g, 5.2, 0.3, 0.6, steel, 0, 0.45, 5.45); for (const sx of [-1, 1]) { const w = box(g, 0.9, 2.3, 0.45, yel, sx * 2.85, 1.6, 5.05); w.rotation.y = sx * 0.5; }      // hoja semi-U con alas
  box(g, 2.4, 0.5, 0.6, yel, 0, 1.9, -3.2); for (const sx of [-1, 1]) { const c = cyl(g, 0.14, 0.14, 1.6, steel, sx * 0.9, 2.5, -2.8); c.rotation.x = 0.7; }      // ripper: viga y cilindros
  box(g, 0.35, 2.3, 0.5, dk, 0, 1.25, -3.8); box(g, 0.35, 0.5, 1.2, steel, 0, 0.3, -3.5);      // diente y punta
  return g;
}
function buildDozerConRoca() {      // wheel dozer sencillo con una roca empujada por la hoja (zona de la superficie, al autorizar)
  const g = new THREE.Group(), yel = lam(0xf2b400), dk = lam(0x1d1f22), glass = lam(0x2f4a5c), gris = lam(0x6b6f74);
  box(g, 2.8, 1.5, 3.6, yel, 0, 1.6, -1.0);                  // chasis trasero
  box(g, 2.6, 1.1, 1.8, yel, 0, 1.2, 1.8);                   // chasis delantero
  box(g, 2.2, 1.3, 2.2, glass, 0, 3.2, -1.3);                // cabina con vidrios
  box(g, 2.4, 0.12, 2.4, yel, 0, 3.92, -1.3);                // techo
  cyl(g, 0.14, 0.14, 1.8, dk, 1.0, 3.2, -2.8);               // escape
  box(g, 3.8, 1.3, 0.35, gris, 0, 0.9, 3.6);                 // hoja frontal
  box(g, 0.25, 0.25, 2.0, dk, -1.1, 1.8, 2.6); box(g, 0.25, 0.25, 2.0, dk, 1.1, 1.8, 2.6);   // brazos
  for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.7]) cyl(g, 1.2, 1.2, 0.9, dk, x, 1.2, z, Math.PI / 2);
  cyl(g, 0.2, 0.2, 0.3, bas(0xffb000), 0, 4.1, -1.3);        // baliza
  const roca = new THREE.Mesh(rockGeo, lam(0x7a6a58)); roca.scale.set(1.8, 1.4, 1.8); roca.position.set(0, 1.0, 5.6); g.add(roca);
  g.scale.set(0.85, 0.85, 0.6);      // más ancho y alto que antes; largo igual
  return g;
}

export { buildWheelDozer, buildTrackDozer, buildDozerConRoca };
