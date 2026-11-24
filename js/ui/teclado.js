// Teclado y botones táctiles: flechas/WASD mueven (keys), 0/espacio pide autorización, R reinicia, Enter empieza; al perder el foco se sueltan las teclas.
import { G, keys } from '../juego/estado.js';
import { requestAuth } from '../juego/trafico.js';
import { startGame, tryStart } from './pantallas.js';

/* Entrada */
const keyMap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { if (e.key === 'Enter' && G.mode === 'menu') tryStart('kart'); return; }      // al escribir el nombre no se activan los controles
  const k = keyMap[e.key];
  if (k) { keys[k] = true; e.preventDefault(); return; }
  if (e.key === '0' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) requestAuth(); }
  else if (e.key === 'r' || e.key === 'R') { if (G.mode === 'over' || G.mode === 'win' || G.mode === 'play') startGame(); }
  else if (e.key === 'Enter' && G.mode === 'menu') tryStart('kart');
});
window.addEventListener('keyup', e => { const k = keyMap[e.key]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.querySelectorAll('[data-k]').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} keys[k] = true; b.classList.add('on'); });      // con captura: el dedo puede moverse un poco sin soltar el botón (antes se soltaba solo y no se aceleraba)
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, () => { keys[k] = false; b.classList.remove('on'); }));
});
