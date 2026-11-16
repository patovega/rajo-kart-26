// Malla 3D del terreno con colores por tipo de celda y franjas banco-berma, más la meseta alrededor del rajo.
import { BENCH, FLOOR, PA, WR, YTOP } from '../config/diseno.js';
import { hash } from '../comun/mates.js';
import { lam } from '../modelos/materiales.js';
import { paso } from '../comun/pasos.js';
import { hr, qOf } from './ruta.js';
import { CELL, GD, GH, GI, GNX, GNZ, GX0, GZ0, HB } from './alturas.js';
import { scene } from '../escena.js';

/* Terreno: rajo con bancos, camino excavado y explanada */
paso('terreno: malla 3D con colores', () => {
  const vc = GNX * GNZ, pos = new Float32Array(vc * 3), col = new Float32Array(vc * 3), c = new THREE.Color(), c2 = new THREE.Color();
  for (let iz = 0; iz < GNZ; iz++) for (let ix = 0; ix < GNX; ix++) {
    const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL, h = GH[i], d = GD[i], n = hash(ix, iz), n2 = hash(ix * 0.37 + 11, iz * 0.29 + 5);
    pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
    const xm = GH[iz * GNX + Math.max(0, ix - 1)], xp = GH[iz * GNX + Math.min(GNX - 1, ix + 1)], zm = GH[Math.max(0, iz - 1) * GNX + ix], zp = GH[Math.min(GNZ - 1, iz + 1) * GNX + ix];
    const sl = Math.hypot(xp - xm, zp - zm) / (2 * CELL), q = qOf(x, z);
    if (h >= YTOP - 0.6 && sl < 0.15 && !(d > 0 && d < 1)) c.setHex(0xc3ac84).multiplyScalar(0.94 + 0.12 * n);
    else if (d === -2) c.setHex(0x5e5245).multiplyScalar(0.8 + 0.35 * n);          // material tronado del frente: roca suelta, más oscura
    else if (d < 0) c.setHex(0x6f675c).multiplyScalar(0.88 + 0.22 * n);          // piso de la explanada: gris, distinto al camino
    else if (d < WR + 2) c.setHex(0x9a8566).multiplyScalar(0.93 + 0.14 * n);
    else if (sl > 0.4) {                                  // cara de banco
      c.setHex(0x6a4a36).lerp(c2.setHex(0x8f5c3a), 0.5 + 0.5 * Math.sin(h * 0.9 + n2 * 4));
      c.lerp(c2.setHex(0x2e2823), Math.max(0, Math.min(0.6, 0.35 + 0.55 * x / PA)));      // el lado oriente es más oscuro
      if (n2 > 0.965) c.lerp(c2.setHex(0x4f8d86), 0.5);
      c.multiplyScalar(0.82 + 0.3 * n);
    } else if (h < FLOOR + 0.7) c.setHex(0x6f675c).multiplyScalar(0.9 + 0.2 * n);     // fondo del rajo
    else c.setHex(0xa08c6a).multiplyScalar(0.92 + 0.16 * n);                               // berma
    if (HB[i] >= 0 && h - HB[i] > 4 && h < YTOP - 1) { const ph = (h % BENCH) / BENCH; c.multiplyScalar((ph < 0.06 || ph > 0.94) ? 1.3 : 0.62 + 0.5 * ph); c.lerp(c2.setHex(0x9a958a), 0.2); }      // escalera entre el fondo y la superficie: franjas alineadas con sus bancos
    else if (d >= WR + 16 && d < WR + 60 && h < YTOP - 1 && h - hr[GI[i]] > 4) {      // cerro junto al camino: mismas franjas banco-berma, medidas desde la cota del camino
      const ph = (h % BENCH) / BENCH, w = Math.min(1, (d - WR - 16) / 10);
      c.multiplyScalar(1 + w * (((ph < 0.06 || ph > 0.94) ? 1.3 : 0.62 + 0.5 * ph) - 1)); c.lerp(c2.setHex(0x9a958a), 0.2 * w);
    }
    else if (d >= WR + 60 && h > 1 && h < YTOP - 1) { const ph = (h % BENCH) / BENCH; c.multiplyScalar((ph < 0.04 || ph > 0.96) ? 1.3 : 0.6 + 0.5 * ph); c.lerp(c2.setHex(0x9a958a), 0.3); }      // paredes lejanas: franjas horizontales por banco (berma clara, cara oscura abajo y clara arriba), como en un rajo real
    if (d >= WR + 2 && h < YTOP - 0.6) { const lp = (xp + xm + zp + zm - 4 * h) / 8; c.multiplyScalar(1 - Math.max(-0.32, Math.min(0.32, lp * 0.5))); }      // labio de la berma más claro y base de la cara más oscura: se leen las bandas banco-berma-banco desde el camino
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
  const gx1 = GX0 + (GNX - 1) * CELL, gz1 = GZ0 + (GNZ - 1) * CELL, BIG = 3000;     // meseta alrededor del rajo (4 paños)
  for (const [x0, z0, x1, z1] of [[GX0 - BIG, GZ0 - BIG, gx1 + BIG, GZ0], [GX0 - BIG, gz1, gx1 + BIG, gz1 + BIG], [GX0 - BIG, GZ0, GX0, gz1], [gx1, GZ0, gx1 + BIG, gz1]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), lam(0xc3ac84));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, YTOP, (z0 + z1) / 2); scene.add(m);
  }
});

export {  };
