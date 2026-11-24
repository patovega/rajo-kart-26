// HUD: velocímetro, metros, tiempo, adelantamientos, botón de autorización, fichas de aviso y pitidos (updateHud).
import { CRASH_U, FOLLOW_DIST, REQ_RANGE, TAU } from '../config/diseno.js';
import { GEO_ZONES, L, START_S, slickNow } from '../terreno/construir.js';
import { fmt, pad } from '../comun/texto.js';
import { G, P, oncs, pickup, rocasPista, trucks } from '../juego/estado.js';
import { $, el } from './dom.js';
import { beep, motorRpm } from './sonido.js';
import { renderAlerts, setBanner } from './avisos.js';
import { nearestRoca } from '../juego/rocas.js';
import { findTarget, nearAuth, requestAuth } from '../juego/trafico.js';
import { camera } from '../escena.js';
import { dibujaMapa } from './mapa.js';
import { KART } from '../juego/reglas.js';

/* ───────────── Brújula (solo en modo prueba: nombre «federicovega») ───────────── */
const brujula = (() => {      // canvas bajo el velocímetro: la flecha N apunta al norte real (−z del juego) según hacia dónde mira la cámara; abajo, el rumbo en grados
  const c = document.createElement('canvas'); c.width = c.height = 132; c.id = 'brujula';
  Object.assign(c.style, { position: 'fixed', left: '12px', top: '128px', width: '88px', height: '88px', zIndex: 20, pointerEvents: 'none', display: 'none' });
  document.body.appendChild(c); return c;
})();
/* Botón «Punto» (solo en modo prueba): copia la posición de la camioneta para pedir revisiones en el mapa */
const punto = (() => {
  const b = document.createElement('button'); b.id = 'punto'; b.type = 'button'; b.textContent = '📍 Punto';
  Object.assign(b.style, { position: 'fixed', left: '12px', top: '222px', width: '88px', padding: '6px 0', zIndex: 21, display: 'none', font: '800 13px Arial', color: '#2a2622', background: 'rgba(245,240,228,0.92)', border: '3px solid #2a2622', borderRadius: '10px', cursor: 'pointer' });
  const caja = document.createElement('div'); caja.id = 'puntoTxt';
  Object.assign(caja.style, { position: 'fixed', left: '108px', top: '222px', maxWidth: '60vw', padding: '6px 10px', zIndex: 21, display: 'none', font: '700 13px Arial', color: '#2a2622', background: 'rgba(245,240,228,0.95)', border: '2px solid #2a2622', borderRadius: '8px', userSelect: 'text' });
  let tCaja = 0;
  const texto = () => { const p = pickup.position, x = p.x, z = p.z, y = p.y; camera.getWorldDirection(_dir); const r = Math.round(((Math.atan2(_dir.x, -_dir.z) * 180 / Math.PI) % 360 + 360) % 360);
    const F = G.free, hx = F ? Math.cos(F.a) : Math.sin(pickup.rotation.y), hz = F ? Math.sin(F.a) : Math.cos(pickup.rotation.y), rc = Math.round(((Math.atan2(hx, -hz) * 180 / Math.PI) % 360 + 360) % 360);      // rumbo de la camioneta (0 = norte)
    return `Punto Rajo Kart: x ${x.toFixed(1)}, z ${z.toFixed(1)}, cota ${(y + 1700).toFixed(1)} m (y ${y.toFixed(1)}) · UTM E ${(x + 165400).toFixed(0)} N ${(4471200 - z).toFixed(0)} · ruta s ${P.s.toFixed(0)} m${G.free ? ' (en el piso, fuera de la ruta)' : ''} · mirando a ${r}° · camioneta hacia ${rc}°${P.v < 0.5 ? ' (detenida)' : ''}`; };
  const mostrar = (t, ok) => { caja.textContent = t + (ok ? '  ✔ copiado' : '  (selecciona y copia)'); caja.style.display = 'block'; clearTimeout(tCaja); tCaja = setTimeout(() => { caja.style.display = 'none'; }, 9000); };
  b.addEventListener('click', e => { e.preventDefault(); const t = texto(); console.log(t); b.blur();
    try { navigator.clipboard.writeText(t).then(() => mostrar(t, true), () => mostrar(t, false)); } catch (_) { mostrar(t, false); } });
  document.body.appendChild(b); document.body.appendChild(caja); return { b, caja };
})();
const _dir = new THREE.Vector3();
function drawBrujula() {
  if (!G.TEST || G.mode !== 'play') { brujula.style.display = 'none'; punto.b.style.display = 'none'; punto.caja.style.display = 'none'; return; }
  brujula.style.display = 'block'; punto.b.style.display = 'block';
  camera.getWorldDirection(_dir); const rumbo = Math.atan2(_dir.x, -_dir.z);      // 0 = norte, π/2 = este (x = este, z = sur)
  const x = brujula.getContext('2d'), R = 60; x.clearRect(0, 0, 132, 132); x.save(); x.translate(66, 66);
  x.fillStyle = 'rgba(245,240,228,0.92)'; x.strokeStyle = '#2a2622'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill(); x.stroke();
  x.rotate(-rumbo);      // la rosa gira: el norte queda donde corresponde respecto de la vista
  for (let k = 0; k < 36; k++) { const a = k * TAU / 36, l = k % 9 === 0 ? 10 : 5; x.strokeStyle = '#2a2622'; x.lineWidth = k % 9 === 0 ? 2.5 : 1; x.beginPath(); x.moveTo(Math.sin(a) * (R - 2), -Math.cos(a) * (R - 2)); x.lineTo(Math.sin(a) * (R - 2 - l), -Math.cos(a) * (R - 2 - l)); x.stroke(); }
  x.font = '800 17px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const [s, a] of [['N', 0], ['E', TAU / 4], ['S', TAU / 2], ['O', 3 * TAU / 4]]) { x.fillStyle = s === 'N' ? '#c9141c' : '#2a2622'; x.fillText(s, Math.sin(a) * (R - 22), -Math.cos(a) * (R - 22)); }
  x.fillStyle = '#c9141c'; x.beginPath(); x.moveTo(0, -30); x.lineTo(7, 0); x.lineTo(-7, 0); x.fill();      // aguja norte
  x.fillStyle = '#6b6560'; x.beginPath(); x.moveTo(0, 30); x.lineTo(7, 0); x.lineTo(-7, 0); x.fill();
  x.restore();
  x.fillStyle = '#2a2622'; x.beginPath(); x.moveTo(66, 2); x.lineTo(60, 12); x.lineTo(72, 12); x.fill();      // marca fija: hacia dónde miras
  x.font = '700 15px Arial'; x.textAlign = 'center'; x.fillStyle = '#2a2622'; x.fillText(Math.round(((rumbo * 180 / Math.PI) % 360 + 360) % 360) + '°', 66, 88);
}

/* ───────────── Radar ───────────── */
el.auth.addEventListener('click', requestAuth);

function updateHud() {
  drawBrujula(); dibujaMapa();
  const kmh = P.v * 3.6;
  el.kmh.textContent = Math.round(kmh);
  const K = G.modo === 'kart', LM = Math.round((K ? KART.S : L) - START_S); el.altmax.textContent = LM; el.spd.classList.toggle('kart', K);      // kart: distancia hasta la meta, barra hasta 120 km/h y sin marca del límite
  el.bar.style.width = Math.min(100, kmh / (K ? 120 : 90) * 100) + '%';
  el.bar.className = G.modo === 'kart' ? '' : kmh > 60 ? 'bad' : (kmh >= 56 ? 'warn' : '');
  el.spd.classList.toggle('flash', kmh > 60 && G.mode === 'play' && G.modo !== 'kart');
  el.alt.textContent = Math.max(0, Math.min(LM, Math.round(P.s - START_S))); el.tm.textContent = fmt(G.tGame); el.ovk.textContent = G.overtakes;

  if (G.mode !== 'play') return;
  el.auth.hidden = G.modo !== 'route';      // ningún modo pide autorización
  { const vz = $('veloz'); if (vz) vz.style.opacity = G.modo === 'kart' ? Math.max(0, Math.min(0.85, (kmh - 55) / 55)) : 0; }      // líneas de velocidad en el kart
  const tg = findTarget(), na = nearAuth();
  if (tg) { el.auth.disabled = false; el.auth.className = ''; el.auth.innerHTML = 'Solicitar autorización<span class="kbk"> (0 / Espacio)</span><small>' + (tg.t.kind === 'moto' ? 'Motoniveladora' : 'CAEX-' + pad(tg.t.id)) + ' · a ' + Math.max(0, Math.round(tg.d - 8.5)) + ' m</small>'; }
  else if (na) { el.auth.disabled = true; el.auth.className = 'done'; el.auth.innerHTML = 'Autorizado<small>' + (na.t.kind === 'moto' ? 'Pasa por la derecha, lejos del cordón' : 'Adelanta por la derecha') + '</small>'; }
  else { el.auth.disabled = true; el.auth.className = ''; el.auth.innerHTML = 'Solicitar autorización<span class="kbk"> (0 / Espacio)</span><small>Acércate a un camión (hasta ' + REQ_RANGE + ' m)</small>'; }

  // avisos
  let oncNear = false;
  for (const o of oncs) { const d = o.s - P.s; if (d > 0 && d < 120 && P.u > -2.5) oncNear = true; }
  let gapMin = 99;
  if (G.modo !== 'kart') for (const t of trucks) { const d = t.s - P.s; if (!t.auth && d > 0 && Math.abs(t.u - P.u) < 3.2) gapMin = Math.min(gapMin, d - 9.8); }
  const cn = nearestRoca(), camNear = cn ? cn.d : null;
  const al = [], A = (key, ico, num, label, sev) => al.push({ key, ico, num, label, sev });
  if (!G.intro && !G.arrive && !G.free && P.u < -(CRASH_U - 1.9)) A('pl', '⚠', '', 'Pretil izq.', 'bad');
  else if (!G.intro && !G.arrive && !G.free && P.u > CRASH_U - 1.9) A('pr', '⚠', '', 'Pretil der.', 'bad');
  if (camNear !== null) A('roca', '🚧', Math.max(0, Math.round(camNear)) + ' m', 'Roca', camNear < 25 ? 'bad' : 'warn');
  if (gapMin < FOLLOW_DIST + 12) A('caex', '🚛', Math.max(0, Math.round(gapMin)) + ' m', 'Mín. ' + FOLLOW_DIST + ' m', gapMin < FOLLOW_DIST + 5 ? 'bad' : 'warn');
  if (G.modo === 'kart') {}      // en el karting no hay límite de velocidad
  else if (kmh > 60 && !G.TEST) A('vel', 'SIGN:' + Math.round(kmh), '', 'Límite 60', 'bad');
  else if (kmh >= 56) A('vel', 'SIGN:60', '', 'Cerca del límite', 'warn');
  { const mn = trucks.find(t => t.kind === 'moto' && t.s - P.s > -12 && t.s - P.s < 160); if (mn) A('moto', '🚜', Math.max(0, Math.round(mn.s - P.s - 9.8)) + ' m', mn.auth ? 'Pasa por la derecha' : 'Motoniveladora', 'warn'); }
  if (slickNow(P.s) > 0.3) A('mojado', '💧', '', 'Piso mojado', 'warn');
  { const zn = GEO_ZONES.find(z => P.s > z.a - 110 && P.s < z.b); if (zn) A('zona', '⛰', P.s < zn.a ? Math.round(zn.a - P.s) + ' m' : '', 'Riesgo geotécnico', 'warn'); }      // aviso 110 m antes y mientras dura cada tramo de riesgo
  if (G.wrongT > 1.5) A('pista', '↩', '', 'Tu pista', 'bad');
  else if (oncNear) A('contra', '🚗', '', 'En contra', 'bad');
  al.sort((a, b) => (b.sev === 'bad') - (a.sev === 'bad'));
  renderAlerts(al.slice(0, 4));
  if (G.bannerT > 0) G.bannerT -= 1 / 60; else setBanner('');

  // sonido de aviso
  G.beepT -= 1 / 60;
  if (kmh > 60 && !G.TEST && G.modo !== 'kart' && G.beepT <= 0) { beep(880, 0.1, 'square', 0.05); G.beepT = 0.28; }
  G.camBeepT -= 1 / 60; G.gapBeepT -= 1 / 60;
  if (gapMin < FOLLOW_DIST + 12 && G.gapBeepT <= 0) { beep(520, 0.12, 'sawtooth', 0.04); G.gapBeepT = 0.25 + Math.max(0, gapMin - FOLLOW_DIST) / 12 * 0.6; }   // CAEX muy cerca: pitido grave
  motorRpm(P.v);
}

export { updateHud };
