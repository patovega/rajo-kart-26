// Dozers: wheel dozer tipo 854K, bulldozer de orugas tipo D10 y el wheel dozer sencillo con roca de la zona de la superficie.
import { TRK, TRK2, bas, box, cyl, grimeTex, lam, rockGeo } from './materiales.js';

function buildWheelDozer() {      // wheel dozer Komatsu WD600-6 (≈49 t, 502 HP, neumáticos 45/65 R45 de 2,6 m, hoja de ≈5,2 m): carrocería y hoja como superficies redondeadas (perfiles extruidos con bisel), neumáticos torneados, guardabarros en arco, cabina inclinada, articulación central
  const g = new THREE.Group(), yel = lam(0xf2c200, { map: grimeTex }), yel2 = lam(0xe0b000), dk = lam(0x1d1e21), tire = lam(0x151515, { side: THREE.DoubleSide }), glass = lam(0x2b3f4d, { side: THREE.DoubleSide }), steel = lam(0x6b6e72), blk = lam(0x0b0b0b), chrome = lam(0xb8bcc0), hyd = lam(0x8d9094), gris = lam(0x44474c), gris2 = lam(0x2f3236);
  const V = (x, y, z) => new THREE.Vector3(x, y, z), Y = V(0, 1, 0), Z = V(0, 0, 1);
  const rod = (a, b, r, m) => { const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 12), m); me.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); me.quaternion.setFromUnitVectors(Y, d.normalize()); g.add(me); return me; };      // tubo entre dos puntos
  const beam = (a, b, w, h, m) => { const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d.length()), m); me.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); me.quaternion.setFromUnitVectors(Z, d.normalize()); g.add(me); return me; };      // viga entre dos puntos
  const suave = (pts, w, m, x = 0, bev = 0.12) => { const s = new THREE.Shape(); pts.forEach(([z, y], i) => i ? s.lineTo(-z, y) : s.moveTo(-z, y));      // perfil lateral [z, y] extruido a lo ancho (w, centrado en x) con bisel redondeado
    const d = Math.max(0.02, w - 2 * bev), ge = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 3, curveSegments: 8 }); ge.translate(0, 0, -d / 2); ge.rotateY(Math.PI / 2);
    const me = new THREE.Mesh(ge, m); me.position.x = x; g.add(me); return me; };
  const R = 1.33, TX = 1.75, ZF = 2.2, ZR = -2.3;      // radio del neumático, trocha y ejes
  const tireG = new THREE.LatheGeometry([[0.6, -0.5], [0.9, -0.6], [1.15, -0.58], [1.28, -0.45], [1.32, -0.25], [1.33, 0], [1.32, 0.25], [1.28, 0.45], [1.15, 0.58], [0.9, 0.6], [0.6, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
  for (const z of [ZF, ZR]) for (const sx of [-1, 1]) { const x = sx * TX;      // neumático torneado con flancos redondos, tacos alternados, llanta amarilla con pernos
    const n0 = g.children.length;
    const t = new THREE.Mesh(tireG, tire); t.rotation.z = Math.PI / 2; t.position.set(x, R, z); g.add(t);
    for (let a = 0; a < 28; a++) { const aa = a * Math.PI / 14, s2 = a % 2 ? 1 : -1, l = box(g, 0.52, 0.2, 0.36, blk, x + s2 * 0.27, R + Math.cos(aa) * (R + 0.01), z + Math.sin(aa) * (R + 0.01)); l.rotation.x = aa; }
    cyl(g, 0.64, 0.64, 1.02, yel2, x, R, z, Math.PI / 2); cyl(g, 0.7, 0.7, 0.1, yel2, x - 0.5, R, z, Math.PI / 2); cyl(g, 0.7, 0.7, 0.1, yel2, x + 0.5, R, z, Math.PI / 2); cyl(g, 0.3, 0.3, 1.14, dk, x, R, z, Math.PI / 2); cyl(g, 0.4, 0.3, 0.08, steel, x + sx * 0.52, R, z, Math.PI / 2);
    for (let a = 0; a < 10; a++) { const aa = a * Math.PI / 5; cyl(g, 0.05, 0.05, 0.1, steel, x + sx * 0.54, R + Math.cos(aa) * 0.46, z + Math.sin(aa) * 0.46, Math.PI / 2); }
    { const wh = new THREE.Group(); wh.position.set(x, R, z); g.add(wh); for (const m of g.children.slice(n0, g.children.length - 1)) { m.position.sub(wh.position); wh.add(m); } (g.userData.ruedas = g.userData.ruedas || []).push(wh); }      // la rueda (neumático, tacos, llanta, pernos) gira como un grupo
    const s = new THREE.Shape(), ro = R + 0.2, ri = R + 0.1, a0 = 0.3, a1 = Math.PI - 0.3; s.moveTo(ro * Math.cos(a0), ro * Math.sin(a0)); s.absarc(0, 0, ro, a0, a1, false); s.lineTo(ri * Math.cos(a1), ri * Math.sin(a1)); s.absarc(0, 0, ri, a1, a0, true);      // guardabarros en arco
    const fg = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false, curveSegments: 18 }); fg.translate(0, 0, -0.7); fg.rotateY(Math.PI / 2); const fe = new THREE.Mesh(fg, yel); fe.position.set(x, R, z); g.add(fe); }
  for (const z of [ZF, ZR]) { cyl(g, 0.3, 0.3, 3.6, dk, 0, R, z, Math.PI / 2); box(g, 1.0, 0.9, 1.0, dk, 0, R + 0.15, z); }      // ejes y diferenciales
  // motor atrás: cuerpo bajo ancho, capó alto de perfil inclinado, contrapeso redondeado
  suave([[-0.9, 0.95], [-0.9, 2.5], [-1.2, 2.62], [-4.7, 2.62], [-5.1, 2.4], [-5.2, 1.5], [-4.9, 1.0]], 3.0, dk, 0, 0.14);
  suave([[-0.95, 2.5], [-0.95, 3.0], [-1.4, 3.4], [-2.4, 3.5], [-4.0, 3.3], [-4.8, 2.95], [-5.0, 2.5]], 2.2, yel, 0, 0.16);
  suave([[-5.05, 1.1], [-5.45, 1.2], [-5.5, 2.25], [-5.1, 2.3]], 3.1, dk, 0, 0.1); box(g, 0.5, 0.5, 0.6, steel, 0, 1.0, -5.7);      // contrapeso negro y enganche
  for (let y = 1.45; y <= 2.2; y += 0.2) box(g, 2.3, 0.07, 0.06, blk, 0, y, -5.56);      // rejilla trasera
  for (const sx of [-1, 1]) { box(g, 0.3, 0.2, 0.08, bas(0xc01010), sx * 1.3, 2.05, -5.55); box(g, 0.3, 0.14, 0.08, bas(0xff9a1a), sx * 1.3, 1.78, -5.55); for (let y = 2.8; y <= 3.3; y += 0.14) box(g, 0.05, 0.06, 1.8, blk, sx * 1.12, y, -2.8); }      // luces traseras y persianas del capó
  // articulación y bastidor delantero redondeado
  box(g, 1.6, 0.9, 1.1, dk, 0, 1.55, 0.2); for (const sx of [-1, 1]) { rod([sx * 0.8, 1.9, 0.9], [sx * 0.8, 1.9, -0.1], 0.1, hyd); box(g, 0.25, 0.25, 0.25, steel, sx * 0.8, 1.9, 1.0); }
  suave([[0.8, 1.1], [0.9, 2.3], [1.6, 2.5], [3.3, 2.35], [3.9, 1.9], [3.7, 1.1]], 1.4, yel, 0, 0.12);
  // cabina inclinada sobre la plataforma: base sólida, vidrio continuo, techo redondeado y pilares
  suave([[1.05, 2.5], [1.05, 3.5], [-0.9, 3.5], [-0.9, 2.5]], 2.05, yel, 0, 0.1);
  suave([[1.0, 3.3], [0.9, 4.6], [0.65, 4.82], [-0.75, 4.82], [-0.92, 4.6], [-0.92, 3.3]], 1.9, glass, 0, 0.03);
  suave([[1.1, 4.62], [1.1, 4.82], [0.7, 5.06], [-0.8, 5.06], [-1.05, 4.82], [-1.05, 4.62]], 2.15, yel, 0, 0.1);
  for (const sx of [-1, 1]) for (const z of [1.0, -0.92]) rod([sx * 0.96, 3.4, z], [sx * 0.96, 4.7, z - Math.sign(z) * 0.1], 0.07, yel);
  rod([-0.96, 3.4, 0.05], [-0.96, 4.7, 0.05], 0.05, yel); rod([0.96, 3.4, 0.05], [0.96, 4.7, 0.05], 0.05, yel);
  box(g, 0.9, 0.08, 0.5, steel, 0, 5.15, -0.4); cyl(g, 0.12, 0.12, 0.2, bas(0xffb000), 0.7, 5.15, -0.4);
  for (const sx of [-1, 1]) { rod([sx * 1.0, 4.5, 0.95], [sx * 1.45, 4.2, 1.15], 0.03, blk); box(g, 0.08, 0.5, 0.25, blk, sx * 1.45, 4.1, 1.15); }      // espejos
  // escape, prefiltro y barandas sobre la cubierta del motor
  cyl(g, 0.17, 0.14, 1.5, steel, -0.9, 4.15, -2.3); cyl(g, 0.22, 0.17, 0.12, blk, -0.9, 4.95, -2.3); cyl(g, 0.3, 0.3, 0.6, blk, -0.45, 3.7, -2.1); cyl(g, 0.2, 0.3, 0.15, blk, -0.45, 4.05, -2.1);
  for (const sx of [-1, 1]) { const x = sx * 1.52; for (let z = -4.7; z <= -1.0; z += 0.93) rod([x, 2.7, z], [x, 3.65, z], 0.035, dk); rod([x, 3.65, -4.7], [x, 3.65, -1.0], 0.035, dk); rod([x, 3.2, -4.7], [x, 3.2, -1.0], 0.03, dk); }
  rod([-1.52, 3.65, -4.7], [1.52, 3.65, -4.7], 0.035, dk);
  for (let i = 0; i < 6; i++) box(g, 0.7, 0.06, 0.3, steel, 1.5, 0.7 + i * 0.37, -0.75 + i * 0.28); rod([1.85, 0.7, -0.75], [1.85, 2.6, 0.7], 0.03, dk);      // escalera lateral entre las ruedas
  // hoja: brazos, cilindros y faroles
  for (const sx of [-1, 1]) { beam([sx * 1.0, 1.4, 1.3], [sx * 1.0, 1.0, 5.9], 0.34, 0.75, yel); rod([sx * 0.6, 2.6, 2.0], [sx * 0.9, 1.4, 3.9], 0.13, chrome); rod([sx * 0.6, 2.6, 2.0], [sx * 0.78, 2.0, 2.9], 0.18, hyd); box(g, 0.45, 0.7, 0.6, yel, sx * 0.98, 1.2, 5.9);
    rod([sx * 1.2, 2.5, 3.9], [sx * 1.2, 3.4, 3.9], 0.05, yel); suave([[3.75, 3.35], [3.75, 3.6], [4.1, 3.6], [4.1, 3.35]], 0.5, yel, sx * 1.2, 0.05); box(g, 0.34, 0.2, 0.05, bas(0xf4f4ee), sx * 1.2, 3.48, 4.12); box(g, 0.14, 0.2, 0.05, bas(0xff9a1a), sx * 1.2 + sx * 0.22, 3.48, 4.12); }
  rod([0, 2.5, 2.6], [0, 2.4, 6.0], 0.1, hyd);
  suave([[6.55, 0.28], [6.48, 0.6], [6.3, 1.1], [6.22, 1.65], [6.32, 2.15], [6.6, 2.5], [6.45, 2.62], [6.0, 2.4], [5.9, 1.6], [5.95, 0.9], [6.1, 0.3]], 4.0, gris, 0, 0.06);      // hoja gris semi-U con cara cóncava y labio enrollado
  for (const sx of [-1, 1]) { const w = box(g, 1.7, 2.3, 0.3, gris, sx * 2.5, 1.5, 6.15); w.rotation.y = -sx * 0.5; const l = box(g, 1.7, 0.22, 0.4, steel, sx * 2.5, 0.28, 6.25); l.rotation.y = -sx * 0.5; }
  for (let y = 0.55; y < 2.4; y += 0.22) box(g, 3.9, 0.07, 0.08, gris2, 0, y, 6.3 - 0.02 * Math.abs(y - 1.6));      // placas de desgaste (franjas horizontales)
  box(g, 4.1, 0.22, 0.4, steel, 0, 0.26, 6.45); for (const sx of [-1, 1]) { suave([[5.85, 0.2], [6.75, 0.2], [6.8, 2.6], [6.3, 2.95], [5.85, 2.6]], 0.28, yel, sx * 2.95, 0.05); box(g, 0.4, 0.3, 0.6, steel, sx * 2.9, 0.2, 6.4); }
  for (const x of [-2, -1, 0, 1, 2]) box(g, 0.25, 1.4, 0.35, yel, x, 1.4, 5.8);
  { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#1d4a9a'; x.fillRect(0, 8, 70, 12); x.fillStyle = '#f4f4f0'; x.fillRect(0, 22, 70, 6); x.fillStyle = '#1d4a9a'; x.fillRect(0, 30, 70, 12); x.fillStyle = '#111'; x.fillRect(80, 6, 168, 52); x.fillStyle = '#f4f4f0'; x.font = 'bold 40px Arial'; x.textAlign = 'center'; x.fillText('WD600', 164, 46);
    const m = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }); for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), m); p.position.set(sx * 1.66, 1.8, -2.9); p.rotation.y = sx * Math.PI / 2; g.add(p); } }      // rótulo WD600
  return g;
}
function buildTrackDozer() {      // bulldozer de orugas Komatsu D475A-8R (≈108 t, ≈970 HP, trocha 2,77 m, hoja semi-U oscura de ≈5,6 m): orugas con rueda motriz alta, capó largo con escapes y prefiltros, cabina atrás con baranda, brazos de empuje y cilindros de levante, desgarrador
  const g = new THREE.Group(), yel = lam(0xf2c200, { map: grimeTex }), dk = lam(0x1d1e21), glass = lam(0x2b3f4d, { side: THREE.DoubleSide }), steel = lam(0x7b7e82), blk = lam(0x0b0b0b), gris = lam(0x3b3e43), hyd = lam(0x8d9094), chrome = lam(0xb8bcc0);
  const V = (x, y, z) => new THREE.Vector3(x, y, z), Y = V(0, 1, 0), Z = V(0, 0, 1);
  const rod = (a, b, r, m) => { const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), m); me.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); me.quaternion.setFromUnitVectors(Y, d.normalize()); g.add(me); return me; };      // tubo entre dos puntos
  const beam = (a, b, w, h, m) => { const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d.length()), m); me.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); me.quaternion.setFromUnitVectors(Z, d.normalize()); g.add(me); return me; };      // viga entre dos puntos
  const TX = 1.385, SW = 0.9;      // trocha de 2,77 m y ancho de zapata
  const perfil = new THREE.Shape(); [[2.5, 0], [-1.6, 0], [-2.8, 0.8], [-2.8, 1.8], [-2.3, 2.3], [-1.2, 2.3], [1.5, 1.7], [2.7, 1.5], [3.0, 1.0], [2.9, 0.4]].forEach(([z, y], i) => i ? perfil.lineTo(z, y) : perfil.moveTo(z, y));      // perfil de la oruga: rueda motriz alta atrás, rueda guía baja adelante
  const og = new THREE.ExtrudeGeometry(perfil, { depth: SW, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.06, bevelSegments: 1 }); og.rotateY(-Math.PI / 2); og.translate(SW / 2, 0, 0);
  for (const sx of [-1, 1]) { const x = sx * TX;
    const oru = new THREE.Mesh(og, TRK); oru.position.set(x, 0, 0); g.add(oru);
    for (let z = -1.5; z <= 2.5; z += 0.28) box(g, SW + 0.12, 0.09, 0.2, blk, x, 0.03, z);      // garras de las zapatas
    for (let z = -1.3; z <= 1.9; z += 0.64) cyl(g, 0.27, 0.27, SW + 0.14, gris, x, 0.32, z, Math.PI / 2);      // rodillos inferiores
    cyl(g, 0.7, 0.7, SW + 0.16, yel, x, 1.55, -2.1, Math.PI / 2); cyl(g, 0.78, 0.78, SW + 0.16, yel, x, 0.85, 2.15, Math.PI / 2);      // rueda motriz y rueda guía
    cyl(g, 0.3, 0.3, SW + 0.28, dk, x, 1.55, -2.1, Math.PI / 2); cyl(g, 0.3, 0.3, SW + 0.28, dk, x, 0.85, 2.15, Math.PI / 2);
    for (const z of [-0.4, 0.8]) cyl(g, 0.22, 0.22, SW + 0.1, gris, x, 2.1, z, Math.PI / 2);      // rodillos superiores
    box(g, 0.5, 0.5, 4.8, yel, sx * 0.95, 1.2, 0.1);      // bastidor de la oruga
    box(g, 1.2, 0.14, 5.8, yel, sx * 1.5, 2.55, 0.1);      // guardabarros sobre la oruga
  }
  box(g, 1.7, 1.4, 4.9, dk, 0, 1.6, 0.1); box(g, 3.2, 1.2, 2.4, yel, 0, 3.0, 1.7); box(g, 3.4, 1.3, 2.4, yel, 0, 3.05, -1.3);      // bastidor, capó y caja trasera
  box(g, 3.0, 1.1, 0.25, dk, 0, 3.0, 2.98); for (let y = 2.6; y <= 3.4; y += 0.2) box(g, 2.8, 0.06, 0.06, blk, 0, y, 3.13);      // parrilla del radiador
  box(g, 3.0, 0.1, 2.0, yel, 0, 3.62, 1.8).rotation.x = -0.05;
  for (const sx of [-1, 1]) for (let y = 2.7; y <= 3.4; y += 0.17) box(g, 0.05, 0.06, 1.4, blk, sx * 1.62, y, 1.4);      // persianas laterales del capó
  cyl(g, 0.13, 0.13, 1.5, blk, 0.35, 4.4, 0.9); cyl(g, 0.13, 0.13, 1.5, blk, 0.8, 4.4, 0.9); cyl(g, 0.3, 0.3, 0.7, blk, -0.5, 4.0, 1.0); cyl(g, 0.3, 0.3, 0.7, blk, -1.1, 4.0, 1.0);      // escapes y prefiltros de aire
  // cabina atrás, con baranda sobre la caja trasera
  box(g, 2.1, 0.4, 1.9, yel, 0, 3.95, -0.8); for (const sx of [-1, 1]) for (const z of [-1.7, 0.1]) box(g, 0.1, 1.15, 0.1, dk, sx * 0.95, 4.55, z);
  box(g, 1.9, 1.0, 0.05, glass, 0, 4.55, 0.12); box(g, 1.9, 1.0, 0.05, glass, 0, 4.55, -1.72); for (const sx of [-1, 1]) box(g, 0.05, 1.0, 1.7, glass, sx * 0.96, 4.55, -0.8);
  box(g, 2.3, 0.14, 2.1, yel, 0, 5.18, -0.8); rod([0.8, 5.25, -1.5], [0.8, 5.9, -1.5], 0.02, blk); cyl(g, 0.12, 0.12, 0.2, bas(0xffb000), -0.7, 5.32, -1.3);
  for (const sx of [-1, 1]) { const x = sx * 1.6; for (const z of [-2.4, -1.5, -0.6]) rod([x, 3.7, z], [x, 4.5, z], 0.035, dk); rod([x, 4.5, -2.4], [x, 4.5, -0.6], 0.035, dk); rod([x, 4.1, -2.4], [x, 4.1, -0.6], 0.03, dk); }
  rod([-1.6, 4.5, -2.4], [1.6, 4.5, -2.4], 0.035, dk);      // baranda trasera
  for (let i = 0; i < 5; i++) box(g, 0.7, 0.06, 0.3, steel, 1.95, 0.9 + i * 0.5, 1.2 + i * 0.22);      // escalera lateral
  // faroles en mástiles delante
  for (const sx of [-1, 1]) { rod([sx * 1.4, 3.6, 2.4], [sx * 1.4, 4.5, 2.4], 0.05, dk); box(g, 0.45, 0.28, 0.3, dk, sx * 1.4, 4.6, 2.4); box(g, 0.34, 0.18, 0.05, bas(0xfff6d8), sx * 1.4, 4.6, 2.56); }
  // hoja semi-U oscura con brazos de empuje, cilindros de levante e inclinación
  for (const sx of [-1, 1]) { beam([sx * 2.05, 1.0, 0.0], [sx * 2.1, 0.95, 5.0], 0.5, 0.7, gris); rod([sx * 1.5, 3.4, 2.6], [sx * 1.95, 1.9, 4.2], 0.2, gris); rod([sx * 1.5, 3.4, 2.6], [sx * 1.7, 2.9, 3.1], 0.24, hyd); rod([sx * 1.95, 1.9, 4.2], [sx * 1.7, 2.9, 3.1], 0.1, chrome); box(g, 0.6, 0.9, 0.7, gris, sx * 2.1, 1.0, 4.9); }
  rod([1.2, 2.9, 2.9], [1.0, 2.6, 5.0], 0.12, hyd);      // cilindro de inclinación
  box(g, 3.6, 2.5, 0.35, gris, 0, 1.6, 5.35); for (const sx of [-1, 1]) { const w = box(g, 1.5, 2.5, 0.35, gris, sx * 2.4, 1.6, 5.05); w.rotation.y = -sx * 0.55; }      // hoja y alas (semi-U)
  box(g, 5.6, 0.2, 0.7, gris, 0, 2.95, 5.3).rotation.x = 0.5; box(g, 3.7, 0.3, 0.45, steel, 0, 0.32, 5.5); for (const sx of [-1, 1]) { const b = box(g, 1.4, 0.3, 0.45, steel, sx * 2.5, 0.32, 5.2); b.rotation.y = -sx * 0.55; }      // labio curvo y cuchillas
  for (let y = 0.7; y < 2.7; y += 0.22) { box(g, 3.6, 0.07, 0.06, blk, 0, y, 5.55); for (const sx of [-1, 1]) { const b = box(g, 1.5, 0.07, 0.06, blk, sx * 2.4, y, 5.28); b.rotation.y = -sx * 0.55; } }      // placas de desgaste
  for (const sx of [-1, 1]) { box(g, 0.28, 2.4, 1.0, yel, sx * 3.15, 1.6, 4.85).rotation.y = -sx * 0.55; }      // placas laterales amarillas
  for (const x of [-1.6, -0.8, 0, 0.8, 1.6]) box(g, 0.25, 1.9, 0.5, gris, x, 1.7, 5.05);      // refuerzos traseros
  // desgarrador atrás (paralelogramo de brazos gris oscuro, travesaño y una púa curva): bastidor trasero bajo la cabina, brazos superior e inferior, cilindros de levante, portapúa y púa
  const grisO = lam(0x2f3136);
  box(g, 3.1, 1.5, 1.3, grisO, 0, 2.3, -3.15); box(g, 3.3, 0.35, 1.6, grisO, 0, 3.15, -3.1);      // bastidor trasero oscuro bajo la cabina
  for (const sx of [-1, 1]) { const x = sx * 1.1;
    beam([x, 2.7, -3.3], [x, 1.75, -5.2], 0.32, 0.55, grisO); beam([x, 1.55, -3.3], [x, 0.95, -5.2], 0.3, 0.5, grisO);      // brazos superior e inferior (paralelogramo)
    beam([x, 1.75, -5.2], [x, 0.95, -5.2], 0.34, 0.5, grisO); cyl(g, 0.22, 0.22, 0.42, steel, x, 1.75, -5.2, Math.PI / 2); cyl(g, 0.2, 0.2, 0.42, steel, x, 0.95, -5.2, Math.PI / 2);      // articulaciones
    rod([sx * 0.7, 3.3, -3.0], [x - sx * 0.25, 1.95, -4.6], 0.15, hyd); rod([sx * 0.7, 3.3, -3.0], [x - sx * 0.25, 2.6, -3.8], 0.19, grisO); }      // cilindros de levante
  box(g, 3.1, 0.75, 0.8, grisO, 0, 1.3, -5.45); box(g, 0.7, 1.3, 0.9, grisO, 0, 1.0, -5.55);      // travesaño y portapúa
  { const K = [[1.5, -5.5], [0.95, -5.6], [0.45, -5.9], [0.1, -6.5]]; for (let k = 0; k < K.length - 1; k++) beam([0, K[k][0], K[k][1]], [0, K[k + 1][0], K[k + 1][1]], 0.42, 0.5 - k * 0.06, grisO);      // púa curva en tramos
    box(g, 0.36, 0.3, 0.55, steel, 0, 0.12, -6.62).rotation.x = 0.4; }
  { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 6, 256, 52); x.fillStyle = '#f4f4f0'; x.font = 'bold 38px Arial'; x.textAlign = 'center'; x.fillText('D475A', 128, 45);
    const m = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }); for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), m); p.position.set(sx * 1.72, 3.1, -1.3); p.rotation.y = sx * Math.PI / 2; g.add(p); } }      // rótulo D475A
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
