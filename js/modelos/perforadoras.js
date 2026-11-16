// Perforadoras: de pozos sobre orugas (buildDrill, grande o de precorte) y compacta de martillo en cabeza (buildCrawlerDrill); numeración 401–410 (nextDrillNum).
import { TRK, TRK2, bas, box, cyl, grimeTex, lam, plateMat } from './materiales.js';

/* Perforadoras de tronadura en la explanada (3 equipos; la del medio es de pre corte, más pequeña) y sus pozos */
function buildDrill(pre, num) {      // perforadora de pozos de orugas (estilo MD6380): chasis largo y bajo, cabina adelante con focos, torre reticulada alta justo detrás de la cabina con sus gatos de levante, compresor y sala de motor atrás, barandas y escalera diagonal al costado
  const s = pre ? 0.72 : 1, mh = pre ? 16 : 25, g = new THREE.Group(), yel = lam(0xe3ab1a), dk = lam(0x1f2023), blk = lam(0x2b2c2f), gray = lam(0x6f7377), cabC = lam(0x24302b), glass = lam(0x3a5260), rail = lam(0x161616), lite = bas(0xfff6d8);
  const B = (w, h, l, m, x, y, z) => box(g, w * s, h * s, l * s, m, x * s, y * s, z * s);
  for (const sx of [-1, 1]) {      // orugas largas en gris claro
    B(1.2, 1.4, 11.5, TRK, sx * 2.5, 0.7, -0.6);
    for (const z of [-6.2, 5.0]) { const w = cyl(g, 0.7 * s, 0.7 * s, 1.22 * s, TRK, sx * 2.5 * s, 0.7 * s, z * s); w.rotation.z = Math.PI / 2; }
    for (let z = -6; z <= 4.8; z += 0.75) B(1.26, 0.1, 0.36, TRK2, sx * 2.5, 1.42, z);
    for (let z = -4.5; z <= 3.5; z += 2) { const r = cyl(g, 0.3 * s, 0.3 * s, 1.26 * s, gray, sx * 2.5 * s, 0.45 * s, z * s); r.rotation.z = Math.PI / 2; }
  }
  B(3.4, 0.9, 10.5, blk, 0, 1.75, -0.6);                 // bastidor
  B(5.8, 0.4, 15.6, yel, 0, 2.4, -0.4);                  // cubierta larga
  B(5.9, 0.35, 15.7, blk, 0, 2.05, -0.4);                // faldón negro
  for (const [x, z] of [[-2.7, 6.9], [2.7, 6.9], [-2.7, -7.6], [2.7, -7.6]]) { B(0.5, 2.3, 0.5, dk, x, 1.3, z); B(1.0, 0.15, 1.0, dk, x, 0.08, z); }      // gatas niveladoras
  // cabina adelante (lado izquierdo), oscura con vidrios y focos
  B(2.4, 2.7, 2.4, cabC, -1.5, 3.95, 6.1);
  B(2.0, 1.4, 0.08, glass, -1.5, 4.25, 7.32); B(0.08, 1.4, 1.9, glass, -2.72, 4.25, 6.1); B(0.08, 1.4, 1.9, glass, -0.28, 4.25, 6.1);
  B(2.6, 0.18, 2.6, blk, -1.5, 5.4, 6.1);
  for (const x of [-2.3, -0.7]) B(0.4, 0.3, 0.12, lite, x, 5.65, 7.25);
  for (const x of [-2.3, -0.7]) B(0.35, 0.25, 0.1, lite, x, 3.0, 7.3);
  // torre reticulada justo detrás de la cabina
  const mx = 0.9, mz = 4.3, y0 = 2.6, w = 0.75;
  for (const [cx, cz] of [[-w, -w], [w, -w], [-w, w], [w, w]]) B(0.22, mh, 0.22, yel, mx + cx, y0 + mh / 2, mz + cz);
  for (let y = y0 + 1.0; y < y0 + mh; y += 1.5) {
    B(2 * w + 0.15, 0.13, 0.13, yel, mx, y, mz - w); B(2 * w + 0.15, 0.13, 0.13, yel, mx, y, mz + w);
    B(0.13, 0.13, 2 * w + 0.15, yel, mx - w, y + 0.75, mz); B(0.13, 0.13, 2 * w + 0.15, yel, mx + w, y + 0.75, mz);
    const d = B(0.1, 1.7, 0.1, yel, mx + w, y + 0.75, mz); d.rotation.x = 0.8;
    const d2 = B(0.1, 1.7, 0.1, yel, mx - w, y + 0.75, mz); d2.rotation.x = -0.8;
  }
  B(0.32, mh * 0.95, 0.32, dk, mx, y0 + mh * 0.48, mz);                  // barra
  B(1.1, 1.3, 1.1, dk, mx, y0 + mh * 0.66, mz);                          // cabezal rotatorio
  B(1.9, 0.9, 2.0, yel, mx, y0 + mh + 0.4, mz);                          // corona
  B(1.6, 1.0, 1.4, blk, mx, 1.2, mz);                                    // mesa al pie de la torre
  for (const sx of [-1, 1]) { const c = B(0.3, 7.4, 0.3, gray, mx + sx * 1.0, 5.8, mz - 2.65); c.rotation.x = 0.52; }      // gatos de levante de la torre
  B(0.18, mh * 0.5, 0.18, dk, mx + 1.1, y0 + mh * 0.3, mz + 0.7);       // manguera
  // compresor y sala de motor (atrás), con escapes
  B(4.6, 2.2, 3.2, yel, 0.2, 3.7, 0.4);                                  // compresor
  B(5.2, 3.0, 5.4, yel, 0, 4.1, -4.4);                                   // sala de motor
  B(5.3, 0.25, 5.5, dk, 0, 5.7, -4.4);
  for (let z = -6.6; z <= -2.4; z += 0.7) B(0.06, 2.2, 0.35, dk, 2.62, 4.0, z);      // rejillas
  B(5.0, 2.6, 0.6, blk, 0, 4.0, -7.4);                                   // radiador
  for (const x of [1.2, 1.9]) cyl(g, 0.18 * s, 0.18 * s, 3.4 * s, dk, x * s, 7.0 * s, -3.0 * s);      // escapes
  // barandas a todo el largo y escalera diagonal bajando por el costado izquierdo
  for (const [x0, z0, x1, z1] of [[-2.9, -7.9, -2.9, 4.8], [2.9, -7.9, 2.9, 7.3], [-2.9, -7.9, 2.9, -7.9]]) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    B(Math.abs(dx) + 0.05, 0.06, Math.abs(dz) + 0.05, rail, (x0 + x1) / 2, 3.65, (z0 + z1) / 2);
    B(Math.abs(dx) + 0.05, 0.05, Math.abs(dz) + 0.05, rail, (x0 + x1) / 2, 3.1, (z0 + z1) / 2);
    for (let t = 0; t <= L; t += 1.3) B(0.05, 1.1, 0.05, rail, x0 + dx * t / L, 3.1, z0 + dz * t / L);
  }
  const st = B(0.9, 0.12, 4.2, yel, -3.4, 1.35, 3.4); st.rotation.x = -0.55;
  for (let k = 0; k < 6; k++) B(0.9, 0.08, 0.3, dk, -3.4, 0.3 + k * 0.4, 1.8 + k * 0.62);
  if (num) {      // número del equipo (placa lima): a los dos costados de la sala de motor y atrás
    const P = (w, h, x, y, z, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w * s, h * s), plateMat(num)); p.position.set(x * s, y * s, z * s); p.rotation.y = ry; g.add(p); };
    P(2.4, 1.2, 2.64, 4.3, -4.4, Math.PI / 2); P(2.4, 1.2, -2.62, 4.3, -4.4, -Math.PI / 2); P(2.4, 1.2, 0, 4.6, -7.72, Math.PI);
  }
  return g;
}
const DRILL_NUMS = [403, 407, 401, 409, 405, 402, 408, 404, 406, 410]; let drillN = 0;      // perforadoras numeradas entre la 400 y la 410
function nextDrillNum() { return DRILL_NUMS[drillN++ % DRILL_NUMS.length]; }
function buildCrawlerDrill(num) {      // perforadora de orugas compacta (martillo en cabeza): orugas grises, chasis negro, carrocería amarilla, cabina adelante, brazo y viga de avance inclinada con colector de polvo abajo
  const g = new THREE.Group(), yel = lam(0xe8b20e, { map: grimeTex }), blk = lam(0x1e1f21), dk = lam(0x2c2d30), glass = lam(0x2d4250), gray = lam(0x8a8d90);
  for (const sx of [-1, 1]) { box(g, 0.7, 0.9, 4.6, TRK, sx * 1.2, 0.45, 0); for (const z of [-2.3, 2.3]) { const w = cyl(g, 0.45, 0.45, 0.72, TRK, sx * 1.2, 0.45, z); w.rotation.z = Math.PI / 2; } for (let z = -2.1; z <= 2.1; z += 0.4) box(g, 0.74, 0.07, 0.2, TRK2, sx * 1.2, 0.92, z); }
  box(g, 1.8, 0.5, 4.2, blk, 0, 1.05, 0);                                   // bastidor
  box(g, 2.6, 1.6, 3.4, yel, 0.1, 2.1, -0.9); box(g, 2.62, 0.35, 3.42, blk, 0.1, 1.45, -0.9);      // motor y compresor
  box(g, 2.0, 0.9, 1.0, blk, 0.3, 3.3, -1.9);                                // radiador arriba atrás
  box(g, 1.3, 1.7, 1.5, yel, 0.6, 2.25, 1.6); box(g, 1.15, 0.9, 0.06, glass, 0.6, 2.5, 2.36); box(g, 0.06, 0.9, 1.2, glass, 1.26, 2.5, 1.6); box(g, 1.4, 0.15, 1.6, blk, 0.6, 3.15, 1.6);      // cabina
  for (const z of [-2.3, 0.4]) box(g, 0.05, 0.8, 0.05, blk, -1.25, 3.3, z); box(g, 0.05, 0.05, 2.7, blk, -1.25, 3.7, -0.95);      // baranda
  const arm = box(g, 0.4, 0.4, 3.0, dk, -0.5, 1.9, 2.7); arm.rotation.x = 0.35;      // brazo hacia adelante
  const feed = new THREE.Group(); feed.position.set(-0.5, 1.2, 4.3); feed.rotation.x = -0.45; g.add(feed);      // viga de avance inclinada hacia adelante
  box(feed, 0.5, 9.0, 0.45, gray, 0, 4.0, 0); box(feed, 0.25, 8.6, 0.25, blk, 0, 4.1, -0.35);      // viga y barra
  for (const y of [1.5, 4.6, 8.3]) box(feed, 0.75, 0.45, 0.75, yel, 0, y, 0);      // centralizador, martillo y cabezal
  box(feed, 1.3, 1.2, 1.1, blk, 0, -0.1, 0.1);                                // colector de polvo abajo
  const hose = cyl(g, 0.09, 0.09, 4.5, blk, 0.2, 2.6, 2.6); hose.rotation.x = 0.8;
  if (num) for (const sx of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), plateMat(num)); p.position.set(sx * 1.42, 2.3, -0.9); p.rotation.y = sx * Math.PI / 2; g.add(p); }
  return g;
}

export { buildDrill, nextDrillNum, buildCrawlerDrill };
