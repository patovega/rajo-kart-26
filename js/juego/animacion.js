// Animación por cuadro: pose de la camioneta (en la ruta, en el tránsito libre, aplastada, volcada o cayendo al rajo), luces de freno y balizas, camiones y riego del aljibe, equipos de las operaciones y la cámara.
import { brakeMat } from '../modelos/materiales.js';
import { updateSpray } from '../modelos/camiones.js';
import { H, frame } from '../terreno/construir.js';
import { setWorldPose } from '../mundo.js';
import { animOps } from '../operaciones/carguio.js';
import { G, P, inp, keys, oncs, pickup, place, trucks } from './estado.js';
import { beep } from '../ui/sonido.js';
import { updateCamera } from './camara.js';

/* ───────────── Render por frame ───────────── */
function blink(b, auth) {
  const on = Math.sin(G.tAnim * 7) > 0;
  b.material.color.setHex(auth ? (on ? 0x2dff6a : 0x0f4a22) : (on ? 0xffb000 : 0x4a3300));
}
const _fq = new THREE.Quaternion(), _fa = new THREE.Vector3(), _fo = new THREE.Vector3();
function updateFall(dt) {       // se pasó el pretil del lado del rajo: rueda por la pendiente y cae
  if (!G.fall) {
    const f = frame(P.s);
    G.fall = { f, p: new THREE.Vector3(pickup.position.x, pickup.position.y + 1.2, pickup.position.z), q: pickup.quaternion.clone(),
      v: new THREE.Vector3(f.tx * P.v * 0.6 + f.rx * 4.5 * G.crashSide, 2.2, f.tz * P.v * 0.6 + f.rz * 4.5 * G.crashSide),
      w: new THREE.Vector3((f.tx * 6 + f.rx * 1.2) * G.crashSide, 0, (f.tz * 6 + f.rz * 1.2) * G.crashSide), t: 0, bounces: 0, rest: false };
  }
  const F = G.fall;
  if (!F.rest) {
    F.t += dt;
    const v = F.v, p = F.p;
    v.y -= 22 * dt; p.addScaledVector(v, dt);
    const gnd = H(p.x, p.z) + 1.1; let onG = false;
    if (p.y < gnd) {
      p.y = gnd; onG = true;
      if (v.y < -3 && F.bounces < 8) { v.y = -v.y * 0.35; F.bounces++; G.shake = Math.max(G.shake, 0.3); beep(85, 0.14, 'triangle', 0.06); } else v.y = 0;
      const e = 0.6, gx = (H(p.x + e, p.z) - H(p.x - e, p.z)) / (2 * e), gz = (H(p.x, p.z + e) - H(p.x, p.z - e)) / (2 * e);
      v.x += -gx * 14 * dt; v.z += -gz * 14 * dt;            // la pendiente lo arrastra hacia abajo
      v.x *= 1 - 0.9 * dt; v.z *= 1 - 0.9 * dt;
      F.w.multiplyScalar(Math.max(0, 1 - 0.7 * dt));
    }
    const wl = F.w.length();
    if (wl > 1e-4) { _fa.copy(F.w).divideScalar(wl); _fq.setFromAxisAngle(_fa, wl * dt); F.q.premultiply(_fq); }
    if (F.t > 7 || (F.t > 1 && onG && Math.hypot(v.x, v.z) < 0.5 && wl < 0.6)) F.rest = true;
  }
  _fo.set(0, 1.2, 0).applyQuaternion(F.q);                    // gira alrededor de su centro
  pickup.quaternion.copy(F.q); pickup.position.copy(F.p).sub(_fo);
  P.y = Math.max(0, F.p.y - 1.1);
}
const PERT = { a: 0, w: 0, z: 0, wz: 0, v0: 0 };      // estado del resorte de la pértiga
function updateVisuals(dt) {
  if (G.free) { setWorldPose(pickup, G.free.x, G.free.z, Math.cos(G.free.a), Math.sin(G.free.a)); P.y = pickup.position.y; }
  else P.y = place(pickup, P.s, P.u, G.arrive && G.arrive.park ? -1 : 1, P.vu / Math.max(P.v, 3) * 0.6);      // en reversa al estacionar
  const braking = (keys.down || inp.brk > 0.15 || (G.arrive && G.arrive.brake)) && G.mode === 'play';      // luces de freno de la camioneta
  brakeMat.color.setHex(braking ? 0xff2a1f : 0x5a0d0d);
  for (const ch of pickup.children) if (ch.name === 'brakeGlow') ch.material.opacity = braking ? 0.95 : 0;
  if (G.mode === 'over' && G.crush) {      // el camión sigue su marcha por encima y la camioneta queda aplastada
    G.crush.t += dt;
    if (G.crush.dir && G.crush.t < 2.8) G.crush.by.s += G.crush.dir * Math.max(G.crush.by.v0 || 4, 4) * dt;
    const k = Math.min(1, Math.max(0, (G.crush.t - 0.12) / 0.4)), e = k * k * (3 - 2 * k);
    if (k > 0 && !G.crush.snd) { G.crush.snd = true; beep(70, 0.4, 'sawtooth', 0.1); G.shake = Math.max(G.shake, 0.9); }
    pickup.scale.set(1 + 0.3 * e, 1 - 0.9 * e, 1 + 0.12 * e);
  } else if (pickup.scale.y !== 1) pickup.scale.set(1, 1, 1);
  if (G.mode === 'over' && G.crashFall) updateFall(dt);
  else if (G.mode === 'over' && G.crashSide) {      // choque contra el pretil: se desliza y vuelca de lado
    G.crashT += dt; const k = Math.min(1, G.crashT / 0.9), e = 1 - (1 - k) * (1 - k);
    P.y = place(pickup, P.s + P.v * 0.8 * e, P.u + G.crashSide * 0.9 * e, 1, 0);
    const ang = G.crashSide * (Math.PI / 2) * e;
    pickup.rotateZ(ang);
    pickup.position.y += Math.abs(Math.sin(ang)) * 1.0 + Math.sin(Math.PI * k) * 0.8;
  }
  { const pe = pickup.getObjectByName('pertiga');      // la pértiga se echa hacia atrás con la velocidad y la aceleración, y cabecea hacia adelante al frenar (resorte amortiguado)
    if (pe) { const h = Math.min(dt, 0.05), acc = (P.v - PERT.v0) / Math.max(h, 1e-3); PERT.v0 = P.v;
      const tgt = -Math.min(0.3, P.v / 22 * 0.22) - Math.max(-0.35, Math.min(0.35, acc * 0.018)), tz = Math.max(-0.1, Math.min(0.1, -P.vu * 0.02));
      PERT.w += (70 * (tgt - PERT.a) - 7 * PERT.w) * h; PERT.a += PERT.w * h; PERT.wz += (70 * (tz - PERT.z) - 7 * PERT.wz) * h; PERT.z += PERT.wz * h;
      pe.rotation.x = PERT.a; pe.rotation.z = PERT.z; } }
  const pb = pickup.getObjectByName('beacon'); if (pb) pb.material.color.setHex(Math.sin(G.tAnim * 7) > 0 ? 0x3d8bff : 0x0a1c4d);
  const ejes = m => m.userData.ejes || (m.userData.ejes = (() => { const a = []; m.traverse(o => { if (o.name === 'eje') a.push(o); }); return a; })());      // ruedas que giran con la velocidad
  for (const e of ejes(pickup)) e.rotation.x += P.v * dt / 0.44;
  for (const t of trucks) if (t.kind !== 'moto') for (const e of ejes(t.mesh)) e.rotation.x += (t.v || 0) * dt / 1.8;
  for (const o of oncs) for (const e of ejes(o.mesh)) e.rotation.x += (o.v || 0) * dt / (o.kind === 'pickup' ? 0.44 : 1.8);
  for (const t of trucks) { place(t.mesh, t.s, t.u + (t.off || 0), 1, 0); if (t.beacon) blink(t.beacon, t.auth);
    if (t.kind === 'moto') {      // motoniveladora: ruedas, hoja abajo mientras nivela (arriba si se detuvo) y el cordón hasta la punta de la hoja
      const ds = t.s - (t.sv ?? t.s); t.sv = t.s; if (Math.abs(ds) < 5) for (const w of t.mesh.userData.ruedas) w.rotation.x += ds / 0.82;
      const hj = t.mesh.userData.hoja; hj.position.y += ((t.v > 0.3 ? 0 : 0.3) - hj.position.y) * Math.min(1, dt * 2);
      t.cord.geometry.setDrawRange(0, 12 * Math.max(0, Math.min(t.ncord, Math.floor((t.s + 0.9 - t.s0) / 2)))); } }
  for (const o of oncs) { place(o.mesh, o.s, o.u, -1, 0); blink(o.beacon, false); if (o.spray) { o.spray.visible = o.spraying; if (o.spraying) updateSpray(o.spray, G.tAnim); } }

  animOps(dt, G.tAnim);
  updateCamera(dt);
}

export { updateVisuals };
