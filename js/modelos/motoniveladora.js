// Motoniveladora Komatsu GD955-7 (≈ 12 m de largo, hoja de 6,1 m, 6 neumáticos 23.5R25): bastidor de cuello de cisne, hoja curva bajo el bastidor en su círculo con barra de tiro
// y cilindros de levante, cabina sobre el tándem, motor atrás, tándem con guardabarros y escarificador trasero. +z = adelante; userData.ruedas (giran) y userData.hoja (sube y baja).
import { bas, box, cyl, grimeTex, lam } from './materiales.js';

function rotulo(txt, fg, w, h) {      // texto pintado en un plano transparente (rótulo GD955)
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = fg; x.font = 'bold 78px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 256, 52);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
}
function buildMotoniveladora() {
  const g = new THREE.Group(), yel = lam(0xf2c200, { map: grimeTex }), yel2 = lam(0xe0b000), dk = lam(0x1d1e21), tire = lam(0x151515, { side: THREE.DoubleSide }), blk = lam(0x0b0b0b), glass = lam(0x2b3f4d, { side: THREE.DoubleSide }), steel = lam(0x6b6e72), chrome = lam(0xb8bcc0), hyd = lam(0x8d9094), gris = lam(0x3b3e43, { side: THREE.DoubleSide });
  const V = (x, y, z) => new THREE.Vector3(x, y, z), Y = V(0, 1, 0), Z = V(0, 0, 1);
  const rod = (a, b, r, m) => { const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), m); me.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); me.quaternion.setFromUnitVectors(Y, d.normalize()); g.add(me); return me; };
  const beam = (a, b, w, h, m) => { const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d.length()), m); me.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); me.quaternion.setFromUnitVectors(Z, d.normalize()); g.add(me); return me; };
  const suave = (pts, w, m, x = 0, bev = 0.08) => { const s = new THREE.Shape(); pts.forEach(([z, y], i) => i ? s.lineTo(-z, y) : s.moveTo(-z, y));      // perfil lateral [z, y] extruido a lo ancho
    const d = Math.max(0.02, w - 2 * bev), ge = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 8 }); ge.translate(0, 0, -d / 2); ge.rotateY(Math.PI / 2);
    const me = new THREE.Mesh(ge, m); me.position.x = x; g.add(me); return me; };
  const R = 0.82, TX = 1.32, ZF = 5.0, ZT = [-1.05, -2.75];      // radio del neumático, trocha, eje delantero y ejes del tándem
  const tireG = new THREE.LatheGeometry([[0.42, -0.3], [0.62, -0.33], [0.75, -0.31], [0.81, -0.2], [0.82, 0], [0.81, 0.2], [0.75, 0.31], [0.62, 0.33], [0.42, 0.3]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  g.userData.ruedas = [];
  for (const z of [ZF, ...ZT]) for (const sx of [-1, 1]) {      // rueda: neumático torneado con tacos, llanta amarilla con maza y pernos
    const wh = new THREE.Group(); wh.position.set(sx * TX, R, z); g.add(wh); g.userData.ruedas.push(wh);
    const t = new THREE.Mesh(tireG, tire); t.rotation.z = Math.PI / 2; wh.add(t);
    for (let a = 0; a < 22; a++) { const aa = a * Math.PI / 11, s2 = a % 2 ? 1 : -1, l = box(wh, 0.3, 0.1, 0.2, blk, s2 * 0.14, Math.cos(aa) * (R + 0.005), Math.sin(aa) * (R + 0.005)); l.rotation.x = aa; }
    cyl(wh, 0.44, 0.44, 0.6, yel2, 0, 0, 0, Math.PI / 2); cyl(wh, 0.26, 0.26, 0.64, dk, 0, 0, 0, Math.PI / 2); cyl(wh, 0.16, 0.12, 0.06, steel, sx * 0.33, 0, 0, Math.PI / 2);
    for (let a = 0; a < 8; a++) { const aa = a * Math.PI / 4; cyl(wh, 0.03, 0.03, 0.06, steel, sx * 0.33, Math.cos(aa) * 0.21, Math.sin(aa) * 0.21, Math.PI / 2); }
  }
  // eje delantero oscilante, cilindros de dirección y placa de empuje adelante con faroles
  cyl(g, 0.11, 0.11, 2.3, dk, 0, R, ZF, Math.PI / 2); box(g, 0.55, 0.45, 0.6, dk, 0, R + 0.32, ZF);
  for (const sx of [-1, 1]) rod([sx * 0.25, R + 0.35, ZF + 0.25], [sx * 1.05, R + 0.05, ZF + 0.2], 0.05, hyd);
  box(g, 1.25, 0.95, 0.3, yel, 0, 1.62, 6.2); box(g, 1.2, 0.12, 0.35, dk, 0, 1.12, 6.22);
  for (const sx of [-1, 1]) { box(g, 0.26, 0.2, 0.08, bas(0xf4f4ee), sx * 0.38, 2.2, 6.1); box(g, 0.1, 0.18, 0.08, bas(0xff9a1a), sx * 0.58, 1.9, 6.36); }
  // bastidor de cuello de cisne: sube desde el eje delantero y corre alto sobre la hoja hasta la articulación
  suave([[6.1, 1.3], [6.1, 2.05], [5.3, 2.2], [4.5, 2.78], [1.5, 2.78], [0.9, 2.3], [0.9, 1.55], [1.5, 2.12], [4.3, 2.12], [5.0, 1.3]], 0.62, yel, 0, 0.07);
  // articulación y sus cilindros
  box(g, 0.85, 0.7, 0.9, dk, 0, 1.75, 0.9); for (const sx of [-1, 1]) rod([sx * 0.45, 1.9, 1.5], [sx * 0.6, 1.8, 0.2], 0.07, chrome);
  // barra de tiro (A desde el frente), círculo y cilindros de levante de la hoja
  for (const sx of [-1, 1]) beam([0, 1.55, 5.2], [sx * 0.95, 1.12, 2.55], 0.22, 0.22, yel);
  { const tor = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 8, 36), dk); tor.rotation.x = Math.PI / 2; tor.position.set(0, 1.12, 2.4); g.add(tor);
    for (let a = 0; a < 8; a++) { const aa = a * Math.PI / 4; box(g, 0.1, 0.12, 0.1, steel, Math.cos(aa) * 1.1, 1.2, 2.4 + Math.sin(aa) * 1.1); } }
  for (const sx of [-1, 1]) { rod([sx * 0.4, 2.7, 3.1], [sx * 0.85, 1.95, 2.8], 0.1, hyd); rod([sx * 0.85, 1.95, 2.8], [sx * 1.15, 1.2, 2.5], 0.06, chrome); }
  rod([0.3, 2.5, 1.9], [1.3, 1.0, 2.1], 0.06, hyd);      // cilindro de desplazamiento lateral
  // hoja (vertedera) curva, en diagonal, con cuchilla y cantoneras; sube y baja con userData.hoja
  { const H = new THREE.Group(); H.position.set(0, 0, 2.35); H.rotation.y = 0.5; g.add(H); g.userData.hoja = H;
    const mm = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 6.1, 18, 1, true, Math.PI * 0.62, Math.PI * 0.72), gris); mm.rotation.z = Math.PI / 2; mm.position.set(0, 0.56, 0.3); H.add(mm);
    box(H, 6.12, 0.1, 0.12, steel, 0, 0.07, 0.08); for (const sx of [-1, 1]) box(H, 0.14, 0.95, 0.5, dk, sx * 3.06, 0.5, 0.02);
    box(H, 5.8, 0.22, 0.16, yel, 0, 0.8, -0.32); box(H, 5.8, 0.18, 0.16, yel, 0, 0.35, -0.3); for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) box(H, 0.16, 0.6, 0.2, yel, x, 0.58, -0.32); }
  // plataforma y cabina (vidrio todo alrededor, pilares, techo con baliza, espejos, barandas y escalera)
  box(g, 2.5, 0.45, 2.3, yel, 0, 1.72, -0.35); box(g, 2.0, 0.55, 1.85, yel, 0, 2.22, -0.35);
  box(g, 1.9, 1.3, 1.75, glass, 0, 3.15, -0.35);
  for (const sx of [-1, 1]) for (const z of [0.52, -1.22]) rod([sx * 0.95, 2.5, z], [sx * 0.95, 3.85, z], 0.05, yel);
  box(g, 2.15, 0.18, 2.05, yel, 0, 3.92, -0.35); box(g, 1.6, 0.1, 1.5, yel2, 0, 4.05, -0.35); cyl(g, 0.11, 0.11, 0.18, bas(0xffb000), 0.6, 4.18, -0.9);
  for (const sx of [-1, 1]) { rod([sx * 1.0, 3.6, 0.5], [sx * 1.35, 3.4, 0.75], 0.025, blk); box(g, 0.06, 0.4, 0.22, blk, sx * 1.36, 3.3, 0.75);
    rod([sx * 1.2, 1.95, 0.75], [sx * 1.2, 2.95, 0.75], 0.03, dk); rod([sx * 1.2, 1.95, -1.45], [sx * 1.2, 2.95, -1.45], 0.03, dk); rod([sx * 1.2, 2.95, 0.75], [sx * 1.2, 2.95, -1.45], 0.03, dk); }
  for (let i = 0; i < 4; i++) box(g, 0.45, 0.05, 0.25, steel, 1.0, 0.55 + i * 0.32, -1.9 + i * 0.1);
  // tándem: cajas de cadena y guardabarros sobre las dos ruedas de cada lado
  for (const sx of [-1, 1]) { box(g, 0.32, 0.55, 2.5, dk, sx * 0.88, R, -1.9); box(g, 0.75, 0.07, 3.1, yel, sx * TX, 1.82, -1.9); box(g, 0.75, 0.35, 0.07, yel, sx * TX, 1.66, -0.37); box(g, 0.75, 0.35, 0.07, yel, sx * TX, 1.66, -3.43); }
  // motor atrás: bastidor bajo, capó con persianas, rejilla trasera, escape y prefiltro
  box(g, 1.3, 0.5, 4.3, dk, 0, 1.15, -3.0);
  suave([[-1.5, 1.3], [-1.5, 2.85], [-4.55, 2.72], [-5.0, 2.45], [-5.0, 1.3]], 2.1, yel, 0, 0.1);
  box(g, 1.5, 0.04, 1.6, blk, 0, 2.86, -2.7);
  for (const sx of [-1, 1]) { for (let y = 1.65; y <= 2.45; y += 0.16) box(g, 0.04, 0.06, 1.1, blk, sx * 1.06, y, -4.2); const p = rotulo('GD955', '#111', 1.1, 0.24); p.position.set(sx * 1.07, 2.15, -2.6); p.rotation.y = sx * Math.PI / 2; g.add(p); }
  box(g, 1.7, 0.95, 0.06, blk, 0, 1.95, -5.04); for (const sx of [-1, 1]) { box(g, 0.22, 0.14, 0.06, bas(0xc01010), sx * 0.85, 1.45, -5.06); box(g, 0.22, 0.1, 0.06, bas(0xff9a1a), sx * 0.85, 1.3, -5.06); }
  cyl(g, 0.1, 0.09, 0.9, steel, 0.55, 3.25, -2.2); cyl(g, 0.13, 0.1, 0.08, blk, 0.55, 3.72, -2.2); cyl(g, 0.17, 0.17, 0.35, blk, -0.5, 3.03, -1.9);
  // escarificador trasero: barra con cinco dientes y su paralelogramo
  box(g, 0.9, 0.6, 0.5, dk, 0, 1.25, -5.25);
  for (const sx of [-1, 1]) { beam([sx * 0.55, 1.45, -5.3], [sx * 0.6, 0.85, -5.85], 0.18, 0.2, yel); beam([sx * 0.55, 0.95, -5.3], [sx * 0.6, 0.55, -5.85], 0.16, 0.18, yel); }
  rod([0, 1.6, -5.2], [0, 0.9, -5.75], 0.07, chrome);
  box(g, 2.0, 0.32, 0.3, yel, 0, 0.75, -5.95); for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) { box(g, 0.11, 0.7, 0.22, steel, x, 0.4, -6.0); box(g, 0.1, 0.16, 0.3, dk, x, 0.08, -5.92); }
  return g;
}

export { buildMotoniveladora };
