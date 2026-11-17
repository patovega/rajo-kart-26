// Cámara: sigue a la camioneta desde atrás (también en el tránsito libre y en la caída al rajo), con suavizado y sacudida (G.shake).
import { camera } from '../escena.js';
import { H, frame } from '../terreno/construir.js';
import { G, P } from './estado.js';

/* ───────────── Cámara ───────────── */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tp = new THREE.Vector3(), tl = new THREE.Vector3();
function updateCamera(dt) {
  const fb = frame(P.s - 14), ff = frame(P.s + 20), cu = P.u * 0.55, lu = P.u * 0.35;
  const cx = fb.x + fb.rx * cu, cz = fb.z + fb.rz * cu, lx = ff.x + ff.rx * lu, lz = ff.z + ff.rz * lu;
  tp.set(cx, H(cx, cz) + 5.6, cz); tl.set(lx, H(lx, lz) + 1.8, lz);
  if (G.free) { const hx = Math.cos(G.free.a), hz = Math.sin(G.free.a), bx = G.free.x - hx * 14, bz = G.free.z - hz * 14, ax = G.free.x + hx * 20, az = G.free.z + hz * 20; tp.set(bx, Math.max(H(bx, bz), H(G.free.x, G.free.z)) + 5.6, bz); tl.set(ax, H(ax, az) + 1.8, az); }
  if (G.fall && G.crashFall) {      // sigue la caída desde el lado del camino
    const ff = G.fall.f; tl.copy(G.fall.p);
    tp.set(G.fall.p.x - ff.tx * 10 - ff.rx * 8 * G.crashSide, 0, G.fall.p.z - ff.tz * 10 - ff.rz * 8 * G.crashSide); tp.y = Math.max(G.fall.p.y + 7, H(tp.x, tp.z) + 3);
  }
  const k = G.camSnap ? 1 : 1 - Math.exp(-dt * 8); G.camSnap = false;
  camPos.lerp(tp, k); camLook.lerp(tl, k);
  camera.position.copy(camPos);
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt * 1.2); }
  camera.lookAt(camLook);
}

export { updateCamera };
