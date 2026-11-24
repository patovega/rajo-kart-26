// Pantallas: comienzo con nombre obligatorio (tryStart, launch con cuenta 3-2-1), partida (startGame), fin de partida (terminarPartida, instalada en ganchos.endGame), orientación del celular y captura del choque.
import { renderer } from '../escena.js';
import { L, START_S } from '../terreno/construir.js';
import { fmt } from '../comun/texto.js';
import { G, P, ganchos } from '../juego/estado.js';
import { $, coarseMq, el } from './dom.js';
import { audioStart, beep, startEngine, stopEngine } from './sonido.js';
import { renderAlerts } from './avisos.js';
import { resetGame } from '../juego/reglas.js';
import { cleanName, nombreValido, norm } from './nombres.js';
import { liveStart, showResult } from './ranking.js';
import { tilt, tiltAviso, tiltCalibrar } from './controles.js';

const pantalla = { rotBlocked: false, pendingShot: false };      // celular en vertical (el juego se pausa); captura del choque pendiente para el cuadro siguiente
function orient() { pantalla.rotBlocked = coarseMq.matches && innerHeight > innerWidth; $('rot').hidden = !pantalla.rotBlocked; }
window.addEventListener('resize', orient); window.addEventListener('orientationchange', orient); orient();
function horizontal() {      // en el celular: pantalla completa y bloqueo en horizontal, si el navegador lo permite
  try { if (!coarseMq.matches) return; const d = document.documentElement; const bloquear = () => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
    if (d.requestFullscreen && !document.fullscreenElement) d.requestFullscreen().then(bloquear).catch(() => bloquear()); else bloquear(); } catch (e) {}
}
function tryStart(modo) {      // el nombre es obligatorio para jugar; modo: 'kart' (carrera) o 'sim' (simulador)
  if (modo === 'kart' || modo === 'sim') G.modo = modo;
  const n = cleanName($('pname').value);
  const test = norm(n).replace(/\s/g, '') === 'federicovega';
  if (!test && !nombreValido(n)) {
    const falta = norm(n).split(/[^a-z0-9ñ]+/).filter(Boolean).length < 2;
    const numero = /\d/.test(n);
    $('nameErr').textContent = numero ? '🤔 No hay nombres con números.' : falta ? 'Escribe tu nombre y apellido para poder jugar.' : '🤔 Esto no parece un nombre. Si es un error, contacta a pato vega.';
    $('nameErr').hidden = false; $('pname').focus(); return;
  }
  $('nameErr').hidden = true; G.playerName = n; G.TEST = test; horizontal(); launch();
}
$('pname').addEventListener('input', () => { if (nombreValido(cleanName($('pname').value))) $('nameErr').hidden = true; });
$('chgName').addEventListener('click', () => { resetGame(); G.mode = 'menu'; stopEngine(); el.ovEnd.hidden = true; el.ovStart.hidden = false; el.hud.hidden = true; $('pname').focus(); });
function signOf(m) {         // señal de la regla incumplida
  if (/límite de 60/.test(m)) return 'EXCESO DE VELOCIDAD';
  if (/pista contraria/.test(m)) return 'SENTIDO CONTRARIO';
  if (/por la derecha/.test(m)) return 'ADELANTAMIENTO POR LA IZQUIERDA';
  if (/sin solicitar autorización/.test(m)) return 'ADELANTAMIENTO SIN AUTORIZACIÓN';
  if (/menos de/.test(m)) return 'DISTANCIA DE SEGURIDAD';
  if (/pretil|volcaste/.test(m)) return 'SALIRSE DE LA PISTA';
  return '';      // los choques no llevan señal
}
const wasted = (() => {      // pantalla «FALLASTE» estilo GTA (WASTED): fondo en grises y una franja oscura con el letrero rojo
  const d = document.createElement('div'); d.id = 'wasted'; d.hidden = true; d.setAttribute('aria-hidden', 'true');
  d.innerHTML = '<div class="wb"><b>FALLASTE</b><span></span></div>';
  const st = document.createElement('style'); st.textContent = '#wasted{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;pointer-events:none;backdrop-filter:grayscale(1) brightness(.62) contrast(1.1);-webkit-backdrop-filter:grayscale(1) brightness(.62) contrast(1.1);animation:wIn .5s ease-out}#wasted[hidden]{display:none}#wasted .wb{width:100%;background:linear-gradient(transparent,rgba(0,0,0,.72) 22%,rgba(0,0,0,.72) 78%,transparent);padding:34px 0 30px;text-align:center}#wasted b{display:block;font:400 clamp(54px,12vw,150px)/1 Impact,"Arial Black",sans-serif;letter-spacing:.06em;color:#c8202a;text-shadow:0 3px 14px rgba(0,0,0,.8);animation:wZoom 2.6s ease-out forwards}#wasted span{display:block;margin-top:10px;font:600 clamp(16px,2.6vw,28px) Arial,sans-serif;color:#e8e3d8;letter-spacing:.04em}@keyframes wIn{from{opacity:0}to{opacity:1}}@keyframes wZoom{from{transform:scale(1.18)}to{transform:scale(1)}}';
  document.head.appendChild(st); document.body.appendChild(d); return d;
})();
function terminarPartida(win, msg) {      // fin de la partida: pantalla de resultado, señal de la regla incumplida, captura del choque y envío al ranking
  if (G.mode !== 'play') return;
  G.mode = win ? 'win' : 'over'; stopEngine(); renderAlerts([]);
  $('endTitle').textContent = win ? (G.modo === 'kart' ? '¡Llegaste a la meta!' : '¡Llegaste a la superficie!') : 'Fin del juego';
  $('endMsg').textContent = msg;
  const sg = win ? '' : signOf(msg); $('signBox').hidden = !sg; $('signTxt').textContent = sg;
  $('shotImg').hidden = true; pantalla.pendingShot = !win && (G.crashFall || G.crush || /roca|camión|Choque frontal|aplast/.test(msg));
  $('endAlt').textContent = Math.max(0, Math.min(Math.round(L - START_S), Math.round(P.s - START_S))); $('endOv').textContent = G.overtakes; $('endTm').textContent = fmt(G.tGame); showResult(win, msg);
  $('retryBtn').textContent = win ? 'Jugar de nuevo (R)' : 'Reintentar (R)';
  beep(win ? 880 : 140, win ? 0.4 : 0.6, win ? 'sine' : 'sawtooth', 0.08);
  if (!win) { wasted.querySelector('span').textContent = msg.replace(/\.$/, ''); wasted.hidden = false; }      // «FALLASTE» en toda derrota, con el motivo debajo
  setTimeout(() => { wasted.hidden = true; el.ovEnd.hidden = false; $('retryBtn').focus(); }, win ? 300 : (G.crashFall ? 4200 : ((G.crashSide || G.crush) ? 1900 : 700)) + 1800);
  el.spd.classList.remove('flash'); G.shake = win ? 0 : 0.7;
}
function startGame() {
  wasted.hidden = true;
  audioStart();
  resetGame(); G.overT = 0; G.mode = 'play'; stopEngine(); startEngine();
  if (G.modo !== 'sim') liveStart();      // el simulador no va al ranking
  $('simFin').hidden = G.modo !== 'sim';
  if (tilt.on && tilt.ang != null) { tilt.neutral = tilt.ang; tilt.sm = 0; }      // el celular se calibra con la posición con que empiezas
  el.ovStart.hidden = true; el.ovEnd.hidden = true; el.hud.hidden = false;
  el.radio.style.display = 'none'; G.camSnap = true;
}
$('goBtn').addEventListener('click', () => tryStart('kart'));
$('simBtn').addEventListener('click', () => tryStart('sim'));
$('simFin').addEventListener('click', () => { resetGame(); G.mode = 'menu'; stopEngine(); el.ovEnd.hidden = true; el.ovStart.hidden = false; el.hud.hidden = true; $('simFin').hidden = true; });      // terminar el recorrido libre: vuelve al inicio
$('retryBtn').addEventListener('click', () => { horizontal(); launch(); });

function launch() {      // cuenta 3-2-1-¡YA! como en Mario Kart; la camioneta no se mueve hasta el ¡YA!
  if (tilt.on && tilt.ang == null) tiltAviso();
  const caja = $('cdown'), num = $('cdNum'), seq = ['3', '2', '1', '¡YA!'], cols = ['#1f9d55', '#2f80ed', '#f2c200', '#c9141c'];
  $('cdMsg').textContent = tilt.on ? 'Sostén el celular como un volante, derecho' : '¡Prepárate!';
  caja.querySelector('.sub').hidden = !tilt.on;
  caja.classList.add('transp'); el.ovStart.hidden = true;      // el menú se oculta para ver el rajo y la pista
  let i = 0; caja.hidden = false; num.textContent = seq[0]; num.style.setProperty('--c', cols[0]); beep(523, 0.15, 'square', 0.06);
  const iv = setInterval(() => {
    i++;
    if (i < seq.length) { num.textContent = seq[i]; num.style.setProperty('--c', cols[i]); beep(i === seq.length - 1 ? 880 : 523, 0.15, 'square', 0.06); return; }
    clearInterval(iv); caja.hidden = true; caja.classList.remove('transp');
    if (tilt.on && tilt.ang != null) tiltCalibrar(false);
    startGame();
  }, 1000);
}
ganchos.endGame = terminarPartida;      // el juego (js/juego) termina la partida a través de este gancho
function capturaPendiente() {      // la captura del choque se toma en el cuadro siguiente al fin de la partida, ya con la camioneta chocada
  if (!pantalla.pendingShot) return; pantalla.pendingShot = false;
  const im = $('shotImg'); im.src = renderer.domElement.toDataURL('image/jpeg', 0.85); im.hidden = false;
}

export { pantalla, tryStart, startGame, launch, capturaPendiente };
