// Materiales, texturas dibujadas en canvas y ayudantes de geometría (box, cyl, blob, placas con número). Solo depende de THREE (global).
import { hash } from '../comun/mates.js';

const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const bas = c => new THREE.MeshBasicMaterial({ color: c });
function box(p, w, h, l, m, x, y, z) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m); me.position.set(x, y, z); p.add(me); return me; }
function cyl(p, rt, rb, h, m, x, y, z, rz) { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 18), m); me.position.set(x, y, z); if (rz) me.rotation.z = rz; p.add(me); return me; }
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
function blob(p, w, l) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.04; p.add(m);
}

const brakeMat = new THREE.MeshBasicMaterial({ color: 0x5a0d0d });       // luces de freno: apagadas = rojo oscuro
const brakeGlowMat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: 0xff2a1f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
})();
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
/* Placas con número (lima, como las de los equipos) */
const plateCache = new Map();
function plateMat(num) {
  let m = plateCache.get(num);
  if (!m) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#1b1b18'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#d6f01f'; g.fillRect(8, 8, 240, 112);
    g.fillStyle = '#111'; g.font = '700 92px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), 128, 68);
    m = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }); plateCache.set(num, m);
  }
  return m;
}
const truckPlateCache = new Map();
function truckPlateMat(num) {      // identificador de los camiones: letra amarilla sobre fondo negro
  let m = truckPlateCache.get(num);
  if (!m) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#d4ef1c'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#0d0d0d'; g.fillRect(9, 9, 238, 110);
    g.fillStyle = '#d4ef1c'; g.font = '700 96px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), 128, 68);
    m = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }); truckPlateCache.set(num, m);
  }
  return m;
}
function addPlates(mesh, num, f, r, s) {       // f / r = [y, z, ancho, alto] de la placa delantera / trasera; s = [y, z, ancho, alto, x] a cada costado (tolva)
  const a = new THREE.Mesh(new THREE.PlaneGeometry(f[2], f[3]), truckPlateMat(num)); a.position.set(f[4] || 0, f[0], f[1]); mesh.add(a);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(r[2], r[3]), truckPlateMat(num)); b.position.set(0, r[0], r[1]); b.rotation.y = Math.PI; mesh.add(b);
  if (s) for (const sx of [1, -1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(s[2], s[3]), truckPlateMat(num)); c.position.set(sx * s[4], s[0], s[1]); c.rotation.y = sx * Math.PI / 2; mesh.add(c); }
}

const GRILLE_MAT = (() => {      // malla de la rejilla del radiador (una textura: liviano aunque haya muchos camiones)
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#121314'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#4a4e52'; g.lineWidth = 2; for (let k = 0; k <= 256; k += 12.8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
  return new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) });
})();
const TIRE_MATS = (() => {      // neumático: banda de rodado con tacos en diagonal y flanco liso
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#1c1c1b'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#080808'; for (let k = 0; k < 32; k++) { const x = k * 16; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, 0); g.lineTo(x + 14, 30); g.lineTo(x + 8, 30); g.fill(); g.beginPath(); g.moveTo(x + 8, 34); g.lineTo(x + 14, 34); g.lineTo(x + 6, 64); g.lineTo(x, 64); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
  const wall = new THREE.MeshLambertMaterial({ color: 0x1a1a19 }); return [new THREE.MeshLambertMaterial({ map: t }), wall, wall];
})();
const rimMats = (() => {      // llanta amarilla con uso: aro exterior, disco rebajado con anillo de pernos y maza (dibujada en la cara)
  const cache = new Map();
  return col => { let m = cache.get(col); if (m) return m;
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), base = '#' + new THREE.Color(col).getHexString(), dk = '#' + new THREE.Color(col).multiplyScalar(0.62).getHexString(), md = '#' + new THREE.Color(col).multiplyScalar(0.82).getHexString();
    const disc = (r, s) => { g.fillStyle = s; g.beginPath(); g.arc(128, 128, r, 0, 6.3); g.fill(); };
    disc(128, base); disc(112, dk); disc(104, md); disc(70, dk); disc(62, base); disc(34, md);
    g.fillStyle = '#2a2622'; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; g.beginPath(); g.arc(128 + Math.cos(a) * 48, 128 + Math.sin(a) * 48, 5, 0, 6.3); g.fill(); }      // pernos
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; g.beginPath(); g.arc(128 + Math.cos(a) * 86, 128 + Math.sin(a) * 86, 7, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(200,185,160,0.35)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(hash(i, 91) * 256, hash(i, 92) * 256, 6 + hash(i, 93) * 18, 0, 6.3); g.fill(); }      // polvo
    const face = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) }), side = new THREE.MeshLambertMaterial({ color: col });
    m = [side, face, face]; cache.set(col, m); return m; };
})();
const grimeTex = (() => {      // camión con uso: polvo pegado, manchas de barro y chorreos oscuros (se multiplica por el color de la pieza)
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { const x = hash(i, 71) * 256, y = hash(i, 72) * 256, r = 4 + hash(i, 73) * 26, t = hash(i, 74);
    g.fillStyle = t < 0.6 ? 'rgba(225,215,195,0.16)' : t < 0.88 ? 'rgba(170,155,135,0.12)' : 'rgba(110,98,85,0.12)'; g.beginPath(); g.ellipse(x, y, r, r * (0.4 + hash(i, 75) * 0.8), hash(i, 76) * 3, 0, 6.3); g.fill(); }
  for (let i = 0; i < 70; i++) { const x = hash(i, 81) * 256, y = hash(i, 82) * 120, l = 30 + hash(i, 83) * 110; g.fillStyle = 'rgba(100,90,80,0.10)'; g.fillRect(x, y, 1.5 + hash(i, 84) * 3, l); }      // chorreos
  const gr = g.createLinearGradient(0, 140, 0, 256); gr.addColorStop(0, 'rgba(210,190,160,0)'); gr.addColorStop(1, 'rgba(215,205,190,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);      // polvo abajo
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
const TRK = lam(0x585b5f), TRK2 = lam(0x3d4043);      // orugas gris oscuro (palas, bulldozers y perforadoras); zapatas más oscuras

// Carga de los camiones: material tronado fino y grueso en gris roca — un montón parejo de fino con textura granulada y colpas gruesas encima
const fineMat = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#7a7770'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) { const v = 85 + ((i * 2654435761) >>> 0) % 80; x.fillStyle = `rgb(${v + 6},${v + 3},${v - 2})`; x.fillRect(((i * 97) % 128), ((i * 61 + (i >> 3)) % 128), 1 + (i % 3 === 0), 1 + (i % 5 === 0)); }
  const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 3); return lam(0xffffff, { map: tx }); })();
const fineGeo = (() => { const gm = new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), p = gm.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 + 0.05 * Math.sin(p.getX(i) * 9.1 + p.getZ(i) * 6.3) * Math.sin(p.getZ(i) * 7.7 - p.getX(i) * 3.1) * (y > 0.05 ? 1 : 0); p.setXYZ(i, p.getX(i) * k, y * k, p.getZ(i) * k); }
  gm.computeVertexNormals(); return gm; })();
const coarseMats = [lam(0x7b7975), lam(0x908d87), lam(0x5f5d59), lam(0x6f6a62)];
function finePile(sx, sy, sz) {      // montón de fino (semielipsoide sx × sy × sz) con ~26 colpas gruesas apoyadas en su superficie
  const g = new THREE.Group(), m = new THREE.Mesh(fineGeo, fineMat); m.scale.set(sx, sy, sz); g.add(m);
  for (let i = 0; i < 26; i++) {
    const a = ((i * 0.618034) % 1) * Math.PI * 2, r = Math.sqrt(((i * 0.381966 + 0.13) % 1)) * 0.85, x = Math.cos(a) * r * sx, z = Math.sin(a) * r * sz;
    const y = sy * Math.sqrt(Math.max(0, 1 - (x / sx) ** 2 - (z / sz) ** 2)), sc = 0.3 + ((i * 0.7548) % 1) * 0.6;
    const rk = new THREE.Mesh(rockGeo, coarseMats[i % 4]); rk.scale.set(sc, sc * 0.7, sc); rk.position.set(x, y + sc * 0.12, z); rk.rotation.set(i * 1.3, i * 2.1, i * 0.7); g.add(rk);
  }
  return g;
}
export { fineMat, finePile };
export { lam, bas, box, cyl, blob, brakeMat, brakeGlowMat, rockGeo, plateMat, truckPlateMat, addPlates, GRILLE_MAT, TIRE_MATS, rimMats, grimeTex, TRK, TRK2 };
