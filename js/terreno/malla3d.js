// Malla 3D del terreno real con colores por tipo de celda (superficie, calzada, piso de la fase 7, caras de banco, bermas) y franjas banco-berma, más la meseta alrededor de la grilla.
import { BENCH, WR } from '../config/diseno.js';
import { DWG } from '../datos/terreno_dwg.js';
import { hash } from '../comun/mates.js';
import { lam } from '../modelos/materiales.js';
import { paso } from '../comun/pasos.js';
import { CELL, GD, GH, GNX, GNZ, GP, GR, GX0, GZ0 } from './alturas.js';
import { scene } from '../escena.js';
const sm = v => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); };

paso('terreno: malla 3D con colores', () => {
  const vc = GNX * GNZ, pos = new Float32Array(vc * 3), col = new Float32Array(vc * 3), c = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color();
  for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {
    const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL, h = GH[i], d = GD[i], n = hash(ix, iz), n2 = hash(ix * 0.37 + 11, iz * 0.29 + 5), fuera = GP[i] === 0;
    pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
    const xm = GH[iz * GNX + Math.max(0, ix - 1)], xp = GH[iz * GNX + Math.min(GNX - 1, ix + 1)], zm = GH[Math.max(0, iz - 1) * GNX + ix], zp = GH[Math.min(GNZ - 1, iz + 1) * GNX + ix];
    const sl = Math.hypot(xp - xm, zp - zm) / (2 * CELL);
    if (d === -1 && !GR[i]) c.setHex(0x6f675c).multiplyScalar(0.88 + 0.22 * n);          // pisos del rajo: gris, distinto al camino
    else if ((d >= 0 && d < WR + 2) || GR[i]) c.setHex(0x9a8566).multiplyScalar(0.93 + 0.14 * n);      // calzada: la rampa principal y todos los caminos interiores, del mismo color
    else if (fuera && sl < 0.45) c.setHex(0xc3ac84).multiplyScalar(0.94 + 0.12 * n);      // superficie (fuera del rajo)
    else if (sl > 0.45) {                                  // cara de banco
      c.setHex(0x6a4a36).lerp(c2.setHex(0x8f5c3a), 0.5 + 0.5 * Math.sin(h * 0.9 + n2 * 4));
      c.lerp(c2.setHex(0x2e2823), Math.max(0, Math.min(0.5, 0.3 + 0.3 * x / 1000)));      // el lado oriente es más oscuro
      if (n2 > 0.965) c.lerp(c2.setHex(0x4f8d86), 0.5);
      c.multiplyScalar(0.82 + 0.3 * n);
      {      // roca fresca en profundidad (fotos desde la SEM 6): desde la fase 7 (cota ~1260) hacia abajo las caras pasan del café a gris verdoso; el contacto sube y baja con manchas; bermas y caminos siguen café (polvo)
        const hc = -440 + 35 * Math.sin(x * 0.0042 + 1.0) * Math.cos(z * 0.0036 - 0.7) + 15 * Math.sin(x * 0.019 + z * 0.013), fr = Math.min(0.85, sm((hc - h) / 120));
        if (fr > 0) { c3.setHex(0x5f6762).lerp(c2.setHex(0x7a7f74), 0.5 + 0.5 * Math.sin(h * 0.9 + n2 * 4)); if (n2 < 0.06) c3.lerp(c2.setHex(0x3f4a44), 0.5);      // gris verdoso con vetas oscuras
          c3.lerp(c2.setHex(0x8a7a66), 0.25).multiplyScalar(0.74 + 0.22 * n); c.lerp(c3, fr); } }
    } else if (h < DWG.ZMIN + 3) c.setHex(0x6f675c).multiplyScalar(0.9 + 0.2 * n);     // fondo del rajo
    else c.setHex(0xa08c6a).multiplyScalar(0.92 + 0.16 * n);                               // berma
    if (d >= WR + 2 && !fuera && !GR[i]) {      // franjas banco-berma (bancos de 16 m a cotas múltiplos de 16): berma clara, cara oscura abajo y clara arriba
      const ph = ((((h + DWG.YC) % BENCH) + BENCH) % BENCH) / BENCH; c.multiplyScalar((ph < 0.05 || ph > 0.95) ? 1.25 : 0.65 + 0.45 * ph); c.lerp(c2.setHex(0x9a958a), 0.2);
      const lp = (xp + xm + zp + zm - 4 * h) / 8; c.multiplyScalar(1 - Math.max(-0.3, Math.min(0.3, lp * 0.5)));      // labio de la berma más claro y base de la cara más oscura
    }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const idx = new Uint32Array((GNX - 1) * (GNZ - 1) * 6); let o = 0;
  for (let iz = 0; iz < GNZ - 1; iz++) for (let ix = 0; ix < GNX - 1; ix++) {
    const a = iz * GNX + ix, b = a + 1, c3 = a + GNX, d = c3 + 1;
    idx[o++] = a; idx[o++] = c3; idx[o++] = b; idx[o++] = b; idx[o++] = c3; idx[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
  let hb = 0, nb = 0;      // meseta alrededor de la grilla (4 paños) a la cota media de su borde
  for (let ix = 0; ix < GNX; ix++) { hb += GH[ix] + GH[(GNZ - 1) * GNX + ix]; nb += 2; }
  for (let iz = 0; iz < GNZ; iz++) { hb += GH[iz * GNX] + GH[iz * GNX + GNX - 1]; nb += 2; }
  const YB = hb / nb, gx1 = GX0 + (GNX - 1) * CELL, gz1 = GZ0 + (GNZ - 1) * CELL, BIG = 3000;
  for (const [x0, z0, x1, z1] of [[GX0 - BIG, GZ0 - BIG, gx1 + BIG, GZ0], [GX0 - BIG, gz1, gx1 + BIG, gz1 + BIG], [GX0 - BIG, GZ0, GX0, gz1], [gx1, GZ0, gx1 + BIG, gz1]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), lam(0xc3ac84));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, YB, (z0 + z1) / 2); scene.add(m);
  }
});

export {  };
