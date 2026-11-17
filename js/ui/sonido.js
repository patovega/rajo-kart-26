// Sonido: pitidos (beep), motor (startEngine, stopEngine, motorRpm), volumen general con compresor, botón de silencio (SND.muted) y arranque del contexto de audio (audioStart).
import { $ } from './dom.js';

/* Audio */
let ac = null, eng = null, engG = null;
const SND = { muted: false };      // silencio general (botón «Sonido»)
let bus = null;
function getBus() {      // volumen general: sube todo el sonido (con compresor para que no distorsione)
  if (!bus && ac) { bus = ac.createGain(); bus.gain.value = 3.2; const cp = ac.createDynamicsCompressor(); cp.threshold.value = -14; cp.ratio.value = 6; bus.connect(cp); cp.connect(ac.destination); }
  return bus;
}
function beep(f, d, type, v, delay) {
  if (!ac || SND.muted) return;
  const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(getBus()); o.start(t); o.stop(t + d + 0.02);
}
function startEngine() {
  if (!ac || eng) return;
  eng = ac.createOscillator(); engG = ac.createGain(); const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 360; eng.type = 'sawtooth'; eng.frequency.value = 46; engG.gain.value = SND.muted ? 0 : 0.022;
  eng.connect(f); f.connect(engG); engG.connect(getBus()); eng.start();
}
function stopEngine() { if (eng) { try { eng.stop(); } catch (e) {} eng = null; engG = null; } }
$('snd').addEventListener('click', e => { SND.muted = !SND.muted; e.target.textContent = 'Sonido: ' + (SND.muted ? 'no' : 'sí'); if (engG) engG.gain.value = SND.muted ? 0 : 0.022; });
function audioStart() {      // el contexto de audio solo se puede crear tras un gesto del usuario (al empezar la partida)
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
}
function motorRpm(v) { if (eng) eng.frequency.value = 46 + v * 9; }      // el motor sube de tono con la velocidad (m/s)

export { SND, beep, startEngine, stopEngine, audioStart, motorRpm };
