// Geotecnia del plano GEO-SG-716: radares de estabilidad de taludes y estaciones totales en su sitio, y las zonas de riesgo, cuñas y pretiles de contención
// dibujados sobre el terreno (cintas que siguen el relieve). Se arma con buildGeotecnia() desde main.js, ya lleno el mundo compartido.
import { CUNAS_DWG, ESTACIONES_DWG, PRETILES_DWG, RADARES_DWG, ZONAS_DWG } from '../datos/terreno_dwg.js';
import { box, cyl, lam } from '../modelos/materiales.js';
import { mundo as M } from '../mundo.js';

const RADARES = [];      // { nombre, x, z, mesh }
function cinta(pts, cerrada, w, color, alto) {      // cinta de ancho w pegada al terreno a lo largo de una polilínea
  const H = M.H, P = cerrada ? pts.concat([pts[0]]) : pts, pos = [], idx = [], c = new THREE.Color(color), col = [];
  let n = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
    const tx = (bx - ax) / L, tz = (bz - az) / L, rx = -tz, rz = tx, m = Math.max(1, Math.ceil(L / 4));
    for (let k = 0; k <= m; k++) {
      const x = ax + tx * L * k / m, z = az + tz * L * k / m;
      for (const s of [-w / 2, w / 2]) { const qx = x + rx * s, qz = z + rz * s; pos.push(qx, H(qx, qz) + alto, qz); col.push(c.r, c.g, c.b); }
      if (k > 0) { const v = n + k * 2; idx.push(v - 2, v - 1, v, v - 1, v + 1, v); }
    }
    n += (m + 1) * 2;
  }
  if (!idx.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }); mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
  M.scene.add(new THREE.Mesh(g, mat));
}
function buildRadar(fx) {      // radar de estabilidad de taludes: remolque con panel (XT) o antena parabólica (FX), paneles solares y mástil
  const g = new THREE.Group(), blanco = lam(0xf2f2ee), gris = lam(0x5a5a58), negro = lam(0x1f1f1f), amarillo = lam(0xf2b800);
  box(g, 4.6, 0.5, 2.1, blanco, 0, 0.95, 0);                                              // chasis del remolque
  for (const sx of [-1.15, 1.15]) { const r = cyl(g, 0.5, 0.5, 0.3, negro, sx, 0.5, 0.2); if (r) r.rotation.z = Math.PI / 2; }
  box(g, 0.2, 0.2, 2.2, gris, 0, 0.75, -2.0); box(g, 0.25, 0.7, 0.25, gris, 0, 0.35, -3.0);   // lanza y pata
  box(g, 1.8, 1.3, 1.4, blanco, -1.1, 1.85, 0.3);                                             // cabina de equipos
  box(g, 0.35, 1.6, 0.35, gris, 1.3, 2.0, 0);                                                 // pedestal
  if (fx) { const d = cyl(g, 1.0, 1.0, 0.12, blanco, 1.3, 3.2, 0.1); if (d) { d.rotation.x = -Math.PI / 2 + 0.35; } box(g, 0.1, 0.1, 0.9, gris, 1.3, 3.2, 0.5); }
  else { const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.14), lam(0xdedad0)); p.position.set(1.3, 3.5, 0.15); p.rotation.x = -0.3; g.add(p); }   // panel del XT, inclinado hacia la pared
  const sol = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.2), lam(0x1d3a6b)); sol.position.set(-1.1, 2.6, 0.3); sol.rotation.x = -0.25; g.add(sol);   // panel solar
  cyl(g, 0.05, 0.05, 4.5, gris, -2.0, 3.2, -0.8); box(g, 0.3, 0.3, 0.3, amarillo, -2.0, 5.5, -0.8);   // mástil con baliza
  return g;
}
function buildEstacion() {      // estación total sobre trípode con caseta
  const g = new THREE.Group(), gris = lam(0x5a5a58), amarillo = lam(0xf2b800);
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3, p = cyl(g, 0.04, 0.04, 1.7, gris, Math.cos(a) * 0.5, 0.85, Math.sin(a) * 0.5); if (p) { p.rotation.z = Math.cos(a) * 0.3; p.rotation.x = -Math.sin(a) * 0.3; } }
  box(g, 0.3, 0.35, 0.3, amarillo, 0, 1.85, 0); box(g, 1.8, 2.1, 1.8, lam(0xd8d4c8), 2.2, 1.05, 0);
  return g;
}
function buildGeotecnia() {
  const H = M.H, pit = { x: 50, z: -100 };
  for (const r of RADARES_DWG) {
    const m = buildRadar(/FX/.test(r.nombre)); m.position.set(r.x, H(r.x, r.z), r.z);
    m.rotation.y = Math.atan2(pit.x - r.x, pit.z - r.z) + Math.PI / 2;      // el panel (eje +x del grupo) mira al rajo
    M.scene.add(m); M.OBST.push({ x: r.x, z: r.z, r: 5 }); RADARES.push({ nombre: r.nombre, x: r.x, z: r.z, mesh: m });
  }
  for (const e of ESTACIONES_DWG) { const m = buildEstacion(); m.position.set(e.x, H(e.x, e.z), e.z); m.rotation.y = Math.atan2(pit.x - e.x, pit.z - e.z); M.scene.add(m); M.OBST.push({ x: e.x, z: e.z, r: 3 }); }
  for (const z of ZONAS_DWG) cinta(z.pts, true, 3.0, 0xd81b1b, 0.5);          // zonas de riesgo geotécnico: borde rojo
  for (const c of CUNAS_DWG) cinta(c.pts, c.tipo === 'hatch', 2.0, 0xc316c3, 0.45);      // cuñas: magenta
  for (const p of PRETILES_DWG) cinta(p, false, 2.5, 0xf28a00, 0.4);          // pretiles de contención: naranjo
}

export { RADARES, buildGeotecnia };
