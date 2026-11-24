// Superficie: domo mirador con letrero y bandera, camiones CAEX, aljibe y camionetas estacionados al final de la ruta (frente al domo se estaciona la camioneta), y el carril solo CAEX (desactivado). Se arma con buildSuperficie() desde main.js, ya lleno el mundo compartido.
import { addPlates, box, cyl, lam } from '../modelos/materiales.js';
import { ALJ_PLATE, CAEX_PLATE, buildPickup, protoAlj, protoOnc } from '../modelos/camiones.js';
import { mundo as M, setWorldPose } from '../mundo.js';

function buildSuperficie() {      // domo mirador con bandera, aljibe y camiones estacionados al final de la ruta, y el carril solo CAEX si está activo
  const { scene, H, frame, L, CAEX_LANE } = M;      // del mundo compartido
  const protoPick = buildPickup(0xc9141c, true);      // camioneta roja doble cabina estacionada
  const at = (s, u) => { const f = frame(s); return { x: f.x + f.rx * u, z: f.z + f.rz * u, f }; };
  const dark = lam(0x222426), conc = lam(0x8d8a84);
  // domo (cúpula geodésica con cinta de ventanales, entrada, letrero y bandera)
  const dc = at(L + 4, -44), dome = new THREE.Group();      // domo en el punto final del plano
  const base = new THREE.Mesh(new THREE.CylinderGeometry(15.5, 16, 1.4, 36), conc); base.position.y = 0.7; dome.add(base);
  const hemi = new THREE.SphereGeometry(14, 30, 15, 0, Math.PI * 2, 0, Math.PI / 2);
  const shell = new THREE.Mesh(hemi, new THREE.MeshPhongMaterial({ color: 0xf1f1ee, flatShading: true, shininess: 40 })); shell.position.y = 1.4; dome.add(shell);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(hemi), new THREE.LineBasicMaterial({ color: 0x9a9a96 })); wire.position.y = 1.4; dome.add(wire);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(14.2, 14.2, 2.6, 36, 1, true), new THREE.MeshBasicMaterial({ color: 0x1d2c3a, side: THREE.DoubleSide })); glass.position.y = 4.2; dome.add(glass);
  box(dome, 4.8, 4.2, 1.4, dark, 0, 3.5, 13.9); box(dome, 9, 0.5, 4.5, lam(0xc9141c), 0, 6.0, 15.6);
  box(dome, 6, 0.12, 22, conc, 0, 0.1, 26);                                     // vereda de acceso
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 512, 160); x.fillStyle = '#0b5a9c'; x.fillRect(0, 0, 512, 46); x.fillStyle = '#fff'; x.font = '700 30px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SIERRA GORDA', 256, 25);
  x.fillStyle = '#1b1b18'; x.font = '800 62px Arial Narrow, Arial'; x.fillText('DOMO MIRADOR', 256, 108);
  box(dome, 0.3, 4.5, 0.3, dark, -4.2, 2.25, 27); box(dome, 0.3, 4.5, 0.3, dark, 4.2, 2.25, 27);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 2.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide })); sg.position.set(0, 4.3, 27); dome.add(sg);
  const fc = document.createElement('canvas'); fc.width = 120; fc.height = 80; const fx = fc.getContext('2d');       // bandera de Chile
  fx.fillStyle = '#fff'; fx.fillRect(0, 0, 120, 40); fx.fillStyle = '#d52b1e'; fx.fillRect(0, 40, 120, 40); fx.fillStyle = '#0039a6'; fx.fillRect(0, 0, 40, 40);
  fx.fillStyle = '#fff'; fx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 11, a = -Math.PI / 2 + i * Math.PI / 5; fx.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); } fx.fill();
  cyl(dome, 0.18, 0.18, 15, conc, 15, 7.5, 20);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), side: THREE.DoubleSide })); flag.position.set(17.2, 13.4, 20); dome.add(flag);
  dome.position.set(dc.x, H(dc.x, dc.z), dc.z); dome.rotation.y = Math.atan2(dc.f.rx, dc.f.rz); scene.add(dome);
  // camiones estacionados (nariz hacia afuera), un aljibe y camionetas
  const freeze = m => { m.updateMatrixWorld(true); m.traverse(o => { o.matrixAutoUpdate = false; }); };
  const park = (proto, s, u, face, num, plates) => {
    const p = at(s, u), m = proto.clone(true); if (plates) addPlates(m, num, plates.f, plates.r, plates.s);
    scene.add(m); setWorldPose(m, p.x, p.z, p.f.rx * face, p.f.rz * face); freeze(m); return m;
  };
  const B = { s0: 28, paso: 14, n: 10, u0: -21, u1: -41 };      // estacionamiento frente al domo: 10 bahías de 14 m entre pretiles en U (abiertas hacia el camino); los camiones entran de cola
  { const sec = new THREE.Shape([[-2.3, 0], [2.3, 0], [0.55, 2.2], [-0.55, 2.2]].map(([a, b]) => new THREE.Vector2(a, b))), mat = lam(0xa98b66, { flatShading: true });      // pretil: sección trapezoidal de 4,6 m de base y 2,2 m de alto
    const pretil = (s1, u1, s2, u2) => { const a = at(s1, u1), b = at(s2, u2), l = Math.hypot(b.x - a.x, b.z - a.z), ge = new THREE.ExtrudeGeometry(sec, { depth: l + 2, bevelEnabled: false }); ge.translate(0, -0.4, -(l + 2) / 2);
      const m = new THREE.Mesh(ge, mat), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; m.position.set(mx, H(mx, mz), mz); m.lookAt(mx + (b.x - a.x), H(mx, mz), mz + (b.z - a.z)); scene.add(m); };
    for (let k = 0; k <= B.n; k++) { const s = L + B.s0 + k * B.paso; pretil(s, B.u0, s, B.u1); }      // pretiles entre bahías
    for (let k = 0; k < B.n; k++) pretil(L + B.s0 + k * B.paso, B.u1, L + B.s0 + (k + 1) * B.paso, B.u1);      // pretil del fondo
  }
  const enBahia = k => L + B.s0 + (k + 0.5) * B.paso, uC = B.u1 + 1.6 + 7.8;      // en cada bahía, de cola contra el pretil del fondo y con la nariz hacia el camino
  for (let k = 0; k < 9; k++) park(protoOnc, enBahia(k), uC, 1, k < 5 ? 140 + k : 150 + k - 5, CAEX_PLATE);
  const aj = park(protoAlj, enBahia(9), uC + 1.5, 1, 703, ALJ_PLATE); const sp = aj.getObjectByName('spray'); if (sp) sp.visible = false;
  park(protoPick, L + 178, -24, 1, 0, null); park(protoPick, L + 190, -24, 1, 0, null);
(() => { // estacionamiento CAEX junto al poste pasacable (desactivado hasta ubicar la bahía)
  if (!CAEX_LANE.on) return;
  const freeze = m => { m.updateMatrixWorld(true); m.traverse(o => { o.matrixAutoUpdate = false; }); };
  const pt = (s, u) => { const f = frame(s); return { x: f.x + f.rx * u, z: f.z + f.rz * u, f }; };
  for (const [s, u, num] of [[CAEX_LANE.a + 46, 42, 161], [CAEX_LANE.a + 66, 42, 162]]) {
    const p = pt(s, u), m = protoOnc.clone(true); addPlates(m, num, CAEX_PLATE.f, CAEX_PLATE.r, CAEX_PLATE.s); scene.add(m);
    setWorldPose(m, p.x, p.z, -p.f.rx, -p.f.rz); freeze(m);
  }
  const q = pt(CAEX_LANE.a + 56, 34), g = new THREE.Group(), red = lam(0xe0401a), wh = lam(0xf4f4f4);      // poste pasacable: rojo y blanco con cruceta
  for (let y = 0; y < 9; y += 1.5) box(g, 0.35, 1.5, 0.35, (Math.floor(y / 1.5) % 2) ? wh : red, 0, y + 0.75, 0);
  box(g, 2.2, 0.3, 0.3, wh, 0, 9, 0);
  g.position.set(q.x, H(q.x, q.z), q.z); scene.add(g);
})();
}

export { buildSuperficie };
