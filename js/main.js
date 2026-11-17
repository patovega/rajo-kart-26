// Rajo Kart 26 — orquestador: llena el mundo compartido, corre los pasos de operaciones, cables y superficie, busca la partida libre y corre el bucle.
// El terreno se arma al importar js/terreno/construir.js; el juego está en js/juego (estado, tráfico, rocas, libre, llegada, reglas, cámara, animación) y la interfaz en js/ui (dom, sonido, avisos, hud, ranking, nombres, controles, pantallas, teclado).
import { paso } from './comun/pasos.js';
import { camera, renderer, scene } from './escena.js';
import { CAEX_LANE, CELL, F7EQ, GD, GNX, GNZ, GX0, GZ0, H, L, PAD_UP, PIT, PITC, PLAT, PLAT7, RED52, START_S, START_U0, f7h, frame } from './terreno/construir.js';
import { buildDrills, buildOps } from './operaciones/carguio.js';
import { buildCable2, buildPowerLine, buildSem6 } from './operaciones/cables.js';
import { buildSuperficie } from './operaciones/superficie.js';
import { G, OBST, P } from './juego/estado.js';
import { buscarPartidaLibre } from './juego/libre.js';
import { updateVisuals } from './juego/animacion.js';
import { resetGame, step } from './juego/reglas.js';
import { liveTick } from './ui/ranking.js';
import { drawRadar, updateHud } from './ui/hud.js';
import { cal, calTick, pollInput } from './ui/controles.js';
import { capturaPendiente, pantalla } from './ui/pantallas.js';
import { mundo as M } from './mundo.js';
import './ui/teclado.js';      // solo registra los oyentes del teclado y los botones táctiles

/* ───────────── Mundo: operaciones mineras, cables y superficie (js/operaciones). Aquí solo se llena el mundo compartido y se corren los pasos ───────────── */
Object.assign(M, { scene, H, frame, L, CAEX_LANE, OBST, GD, GX0, GZ0, GNX, GNZ, CELL, PLAT7, PLAT, PITC, F7EQ, RED52, PIT, f7h, PAD_UP });      // lo que las operaciones necesitan del mundo
paso('operaciones: canchas de perforación, palas cargando, dozers y huellas', () => { buildDrills(); buildOps(); });
paso('cables: subestaciones, postes pasacables y SEM 6', () => { buildPowerLine(); buildCable2(); buildSem6(); });
paso('superficie: domo mirador y camiones estacionados', buildSuperficie);
paso('partida libre: punto de salida en el piso de la fase 7', () => { G.FREE0 = buscarPartidaLibre(); });      // necesita los equipos (OBST) y el portón (M.GATE)

/* ───────────── Bucle ───────────── */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; G.tAnim += dt;
  pollInput(); if (cal.open) calTick();
  if (G.mode === 'play' && !pantalla.rotBlocked) step(dt);      // en vertical (celular) el juego queda en pausa
  if (G.mode === 'menu') { P.s = START_S; P.u = START_U0; if (G.FREE0 && G.free) Object.assign(G.free, G.FREE0); }
  if (G.mode === 'play') liveTick(dt);
  updateVisuals(dt); updateHud();
  if (G.mode === 'play') drawRadar();
  renderer.render(scene, camera);
  capturaPendiente();
}
resetGame(); G.camSnap = true;
requestAnimationFrame(loop);
