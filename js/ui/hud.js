// HUD: velocímetro, metros, tiempo, adelantamientos, botón de autorización, fichas de aviso y pitidos (updateHud), y el radar de la pista (drawRadar).
import { CRASH_U, FOLLOW_DIST, REQ_RANGE, TAU } from '../config/diseno.js';
import { L, START_S, ZONE_S, slickNow } from '../terreno/construir.js';
import { fmt, pad } from '../comun/texto.js';
import { G, P, oncs, rocasPista, trucks } from '../juego/estado.js';
import { $, el } from './dom.js';
import { beep, motorRpm } from './sonido.js';
import { renderAlerts, setBanner } from './avisos.js';
import { ROCK_ZIG, nearestRoca } from '../juego/rocas.js';
import { findTarget, nearAuth, requestAuth } from '../juego/trafico.js';

/* ───────────── Radar ───────────── */
el.altmax.textContent = Math.round(L - START_S);
el.auth.addEventListener('click', requestAuth);
const rc = $('radar'), rx = rc.getContext('2d'); rx.scale(2, 2);
function drawRadar() {
  const W = 120, Hh = 240, sx = W / 28, sy = Hh / 170, behind = 35;
  const X = u => W / 2 + u * sx, Y = ds => Hh - (ds + behind) * sy;
  rx.clearRect(0, 0, W, Hh);
  rx.fillStyle = '#2e2a26'; rx.fillRect(0, 0, W, Hh);
  rx.fillStyle = '#6f5f48'; rx.fillRect(X(-12.1), 0, 24.2 * sx, Hh);
  rx.strokeStyle = '#f2efe6'; rx.lineWidth = 1.5; rx.beginPath(); rx.moveTo(X(-12.1), 0); rx.lineTo(X(-12.1), Hh); rx.moveTo(X(12.1), 0); rx.lineTo(X(12.1), Hh); rx.stroke();
  rx.strokeStyle = '#f2b705'; rx.setLineDash([6, 6]); rx.beginPath(); rx.moveTo(X(0), 0); rx.lineTo(X(0), Hh); rx.stroke(); rx.setLineDash([]);
  const veh = (s, u, w, l, fill, stroke) => {
    const ds = s - P.s; if (ds < -behind - l || ds > 135 + l) return;
    rx.fillStyle = fill; rx.fillRect(X(u) - w * sx / 2, Y(ds) - l * sy / 2, w * sx, l * sy);
    if (stroke) { rx.strokeStyle = stroke; rx.lineWidth = 2; rx.strokeRect(X(u) - w * sx / 2, Y(ds) - l * sy / 2, w * sx, l * sy); }
  };
  for (const c of rocasPista) { const ds = c.s - P.s; if (ds < -behind - 4 || ds > 140) continue; rx.fillStyle = '#b3a592'; rx.strokeStyle = '#2a2018'; rx.lineWidth = 1.5; rx.beginPath(); rx.arc(X(c.u), Y(ds), c.r * sx, 0, TAU); rx.fill(); rx.stroke(); }
  for (const t of trucks) veh(t.s, t.u, 7.2, 12, '#f7c600', t.auth ? '#35d27a' : '#241a10');
  for (const o of oncs) veh(o.s, o.u, o.kind === 'pickup' ? 2.6 : 7.2, o.kind === 'pickup' ? 5.5 : 12, o.kind === 'aljibe' ? '#3a8fe8' : (o.kind === 'pickup' ? '#f2f2f2' : '#f7c600'), (o.s - P.s) < 110 && (o.s - P.s) > 0 ? '#ff3b3b' : '#9a948a');
  veh(P.s, P.u, 2.4, 5, '#ff2a2a', '#fff');
  rx.fillStyle = 'rgba(255,255,255,.7)'; rx.font = '10px sans-serif'; rx.fillText('IZQ', 6, Hh - 6); rx.fillText('DER', W - 24, Hh - 6);
}

function updateHud() {
  const kmh = P.v * 3.6;
  el.kmh.textContent = Math.round(kmh);
  el.bar.style.width = Math.min(100, kmh / 90 * 100) + '%';
  el.bar.className = kmh > 60 ? 'bad' : (kmh >= 56 ? 'warn' : '');
  el.spd.classList.toggle('flash', kmh > 60 && G.mode === 'play');
  el.alt.textContent = Math.max(0, Math.min(Math.round(L - START_S), Math.round(P.s - START_S))); el.tm.textContent = fmt(G.tGame); el.ovk.textContent = G.overtakes;

  if (G.mode !== 'play') return;
  const tg = findTarget(), na = nearAuth();
  if (tg) { el.auth.disabled = false; el.auth.className = ''; el.auth.innerHTML = 'Solicitar autorización<span class="kbk"> (0 / Espacio)</span><small>CAEX-' + pad(tg.t.id) + ' · a ' + Math.max(0, Math.round(tg.d - 8.5)) + ' m</small>'; }
  else if (na) { el.auth.disabled = true; el.auth.className = 'done'; el.auth.innerHTML = 'Autorizado<small>Adelanta por la derecha</small>'; }
  else { el.auth.disabled = true; el.auth.className = ''; el.auth.innerHTML = 'Solicitar autorización<span class="kbk"> (0 / Espacio)</span><small>Acércate a un camión (hasta ' + REQ_RANGE + ' m)</small>'; }

  // avisos
  let oncNear = false;
  for (const o of oncs) { const d = o.s - P.s; if (d > 0 && d < 120 && P.u > -2.5) oncNear = true; }
  let gapMin = 99;
  for (const t of trucks) { const d = t.s - P.s; if (!t.auth && d > 0 && Math.abs(t.u - P.u) < 3.2) gapMin = Math.min(gapMin, d - 9.8); }
  const cn = nearestRoca(), camNear = cn ? cn.d : null;
  const al = [], A = (key, ico, num, label, sev) => al.push({ key, ico, num, label, sev });
  if (!G.intro && !G.arrive && !G.free && P.u < -(CRASH_U - 1.9)) A('pl', '⚠', '', 'Pretil izq.', 'bad');
  else if (!G.intro && !G.arrive && !G.free && P.u > CRASH_U - 1.9) A('pr', '⚠', '', 'Pretil der.', 'bad');
  if (camNear !== null) A('roca', '🚧', Math.max(0, Math.round(camNear)) + ' m', 'Roca', camNear < 25 ? 'bad' : 'warn');
  if (gapMin < FOLLOW_DIST + 12) A('caex', '🚛', Math.max(0, Math.round(gapMin)) + ' m', 'Mín. ' + FOLLOW_DIST + ' m', gapMin < FOLLOW_DIST + 5 ? 'bad' : 'warn');
  if (kmh > 60 && !G.TEST) A('vel', 'SIGN:' + Math.round(kmh), '', 'Límite 60', 'bad');
  else if (kmh >= 56) A('vel', 'SIGN:60', '', 'Cerca del límite', 'warn');
  if (slickNow(P.s) > 0.3) A('mojado', '💧', '', 'Piso mojado', 'warn');
  if (!G.TEST && P.s > ZONE_S - 110 && P.s < ZONE_S + ROCK_ZIG[2][0] + 12) A('zona', '⛰', '', 'Caída de rocas', 'warn');
  if (G.wrongT > 1.5) A('pista', '↩', '', 'Tu pista', 'bad');
  else if (oncNear) A('contra', '🚗', '', 'En contra', 'bad');
  al.sort((a, b) => (b.sev === 'bad') - (a.sev === 'bad'));
  renderAlerts(al.slice(0, 4));
  if (G.bannerT > 0) G.bannerT -= 1 / 60; else setBanner('');

  // sonido de aviso
  G.beepT -= 1 / 60;
  if (kmh > 60 && !G.TEST && G.beepT <= 0) { beep(880, 0.1, 'square', 0.05); G.beepT = 0.28; }
  G.camBeepT -= 1 / 60; G.gapBeepT -= 1 / 60;
  if (gapMin < FOLLOW_DIST + 12 && G.gapBeepT <= 0) { beep(520, 0.12, 'sawtooth', 0.04); G.gapBeepT = 0.25 + Math.max(0, gapMin - FOLLOW_DIST) / 12 * 0.6; }   // CAEX muy cerca: pitido grave
  motorRpm(P.v);
}

export { updateHud, drawRadar };
