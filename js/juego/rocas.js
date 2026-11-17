// Rocas: las grandes caídas en la pista (mkRoca), las de la zona de caída de rocas que caen del cerro al acercarte (ROCK_ZIG, updateFallRocks) y las chicas que caen de los camiones cargados (updateRocks); nearestRoca para el aviso del HUD.
import { LANE } from '../config/diseno.js';
import { blob, lam, rockGeo } from '../modelos/materiales.js';
import { scene } from '../escena.js';
import { H, ZONE_S, frame } from '../terreno/construir.js';
import { G, P, pickup, place, rocasPista, rocks, trucks } from './estado.js';
import { beep } from '../ui/sonido.js';

/* ───────────── Rocas que caen de los camiones cargados ───────────── */
const rockMat = lam(0x6e5c49);
const ROCK_ZIG = [[22, -8.2], [54, -2.6], [86, -8.2]];     // [metros desde el inicio de la zona, posición lateral]: zigzag entre tu pista y el centro
const fallRocks = [];
function resetFallRocks() {
  for (const r of fallRocks) scene.remove(r.mesh);
  fallRocks.length = 0;
  if (G.TEST) return;      // modo prueba: sin caída de rocas
  for (const [ds, u] of ROCK_ZIG) { const c = mkRoca(ZONE_S + ds, u); c.mesh.visible = false; c.state = 'wait'; c.t = 0; fallRocks.push(c); }
}
function updateFallRocks(dt) {
  for (const r of fallRocks) {
    if (r.state === 'wait') {
      if (r.s - P.s < 42 + 1.4 * P.v && r.s > P.s - 6) {      // se suelta cuando te acercas: cae del cerro y llega al camino antes que tú
        const f = frame(r.s - 4), sg = H(f.x + f.rx * 20, f.z + f.rz * 20) > H(f.x - f.rx * 20, f.z - f.rz * 20) ? 1 : -1;
        const sx = f.x + f.rx * sg * 24, sz = f.z + f.rz * sg * 24;
        r.from = { x: sx, y: H(sx, sz) + 16, z: sz }; r.state = 'fall'; r.t = 0; r.mesh.visible = true;
      }
    } else if (r.state === 'fall') {
      r.t += dt; const k = Math.min(1, r.t / 1.3), f = frame(r.s);
      const lx = f.x + f.rx * r.u, lz = f.z + f.rz * r.u, ly = H(lx, lz) + 0.1;
      r.mesh.position.set(r.from.x + (lx - r.from.x) * k, r.from.y + (ly - r.from.y) * k * k, r.from.z + (lz - r.from.z) * k);
      r.mesh.rotation.x += 6 * dt; r.mesh.rotation.z += 4 * dt;
      if (k >= 1) { place(r.mesh, r.s, r.u, 1, 0); r.state = 'done'; rocasPista.push(r); beep(70, 0.3, 'triangle', 0.1); if (Math.abs(r.s - P.s) < 90) G.shake = Math.max(G.shake, 0.4); }
    }
  }
}
function mkRoca(s, uFix) {      // roca grande caída en la pista (se esquiva por derecha o izquierda)
  const g = new THREE.Group(), mats = [lam(0x5d4c3b), lam(0x6f5b47), lam(0x4e3f31)];
  const part = (x, z, sx, sy, sz, k) => { const r = new THREE.Mesh(rockGeo, mats[k]); r.scale.set(sx, sy, sz); r.position.set(x, sy * 0.8, z); r.rotation.set(Math.random() * 0.6, Math.random() * 6, Math.random() * 0.6); g.add(r); };
  part(0, 0, 1.55, 1.05, 1.45, 0); part(1.1, -0.7, 0.8, 0.6, 0.75, 1); part(-1.0, 0.8, 0.7, 0.55, 0.7, 2); part(0.2, 1.2, 0.5, 0.4, 0.5, 1);
  blob(g, 6, 6); g.scale.set(1.15, 1.15, 1.15);
  const u = uFix != null ? uFix : -LANE + (Math.random() - 0.4) * 1.4;
  scene.add(g); place(g, s, u, 1, 0);
  return { s, u, r: 1.8, mesh: g };
}
function dropRock(t) {
  const m = new THREE.Mesh(rockGeo, rockMat), sc = 0.28 + Math.random() * 0.3, f = frame(t.s);
  m.scale.set(sc, sc * 0.8, sc);
  m.position.copy(t.mesh.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 4.4, 7.4, -6.3))); scene.add(m);
  const lat = (Math.random() - 0.5) * 2.5;
  rocks.push({ mesh: m, sc, vx: f.tx * t.v * 0.6 + f.rx * lat, vy: 1 + Math.random() * 1.2, vz: f.tz * t.v * 0.6 + f.rz * lat,
    sx: (Math.random() - 0.5) * 6, sz: (Math.random() - 0.5) * 6, bounces: 0, resting: false, age: 0 });
}
function updateRocks(dt) {
  G.rockT -= dt;
  if (G.rockT <= 0) {
    G.rockT = 5 + Math.random() * 7;
    const cand = trucks.filter(t => { const d = t.s - P.s; return d > 14 && d < 120; });
    if (cand.length && rocks.length < 6) dropRock(cand[Math.floor(Math.random() * cand.length)]);
  }
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i], p = r.mesh.position;
    if (r.resting) { r.age += dt; if (r.age > 14) { scene.remove(r.mesh); rocks.splice(i, 1); } continue; }
    r.vy -= 24 * dt; p.x += r.vx * dt; p.y += r.vy * dt; p.z += r.vz * dt;
    r.mesh.rotation.x += r.sx * dt; r.mesh.rotation.z += r.sz * dt;
    const ground = H(p.x, p.z) + 0.12 + r.sc * 0.5;
    if (p.y < ground) {
      p.y = ground;
      if (Math.hypot(p.x - pickup.position.x, p.z - pickup.position.z) < 40) beep(95, 0.12, 'triangle', 0.05);
      if (r.vy < -2.5 && r.bounces < 3) { r.vy = -r.vy * 0.35; r.vx *= 0.6; r.vz *= 0.6; r.sx *= 0.6; r.sz *= 0.6; r.bounces++; }
      else { r.resting = true; r.vx = r.vy = r.vz = 0; }
    }
  }
}
function nearestRoca() {
  let best = null;
  for (const c of rocasPista) { const d = c.s - P.s - 2.4; if (d > -2 && d < 55 && Math.abs(c.u - P.u) < c.r + 3.2 && (!best || d < best.d)) best = { c, d }; }
  return best;
}

export { ROCK_ZIG, resetFallRocks, updateFallRocks, mkRoca, updateRocks, nearestRoca };
