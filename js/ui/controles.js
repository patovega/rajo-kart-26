// Controles: volante y mando USB (gamepad), volante en pantalla, celular inclinado, pedalera por WebHID y asistente de configuración (cal). pollInput() deja el resultado en inp cada cuadro.
import { clamp } from '../comun/mates.js';
import { G, inp } from '../juego/estado.js';
import { $, coarseMq } from './dom.js';
import { setBanner } from './avisos.js';
import { requestAuth } from '../juego/trafico.js';

/* ───────────── Volante, mando y celular como volante ───────────── */
let wheelCfg = {}; try { wheelCfg = JSON.parse(localStorage.getItem('rajoRojo.wheel.v2') || '{}'); } catch (e) {}
const saveCfg = () => { try { localStorage.setItem('rajoRojo.wheel.v2', JSON.stringify(wheelCfg)); } catch (e) {} };
const tilt = { on: false, inv: false, neutral: 0, ang: null, sm: 0 };
try { const t = JSON.parse(localStorage.getItem('rajoRojo.tilt.v1') || '{}'); tilt.inv = !!t.inv; } catch (e) {}
const saveTilt = () => { try { localStorage.setItem('rajoRojo.tilt.v1', JSON.stringify({ inv: tilt.inv })); } catch (e) {} };
const hidPads = [];
const pads = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : []), ...hidPads].filter(g => g && g.connected); } catch (e) { return []; } };
const wrap180 = a => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
const dzone = (v, d) => Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d);
let authPrev = false, ctlTxt = '';
function setCtl(t) { if (t !== ctlTxt) { ctlTxt = t; $('ctlInfo').textContent = t; } }
const devKey = (g, all) => { const same = all.filter(x => x.id === g.id); return same.length > 1 ? g.id + '#' + same.indexOf(g) : g.id; };
function padMap() { const all = pads(), m = {}; all.forEach(g => { m[devKey(g, all)] = g; }); return { all, m }; }
const shortName = id => id.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 34);
function pollInput() {
  inp.analog = false; inp.steer = 0; inp.thr = 0; inp.brk = 0; inp.src = '';
  const { all, m } = padMap();
  if (all.length) {
    const rd = c => { const g = c && m[c.dev]; if (!g) return null; return (c.t === 'b' ? (g.buttons[c.i] ? g.buttons[c.i].value : 0) : g.axes[c.i]) || 0; };
    const rel = c => { const v = rd(c); return v == null || Math.abs(c.f - c.r) < 0.02 ? 0 : clamp((v - c.r) / (c.f - c.r), -1, 1); };
    // El volante siempre funciona solo: si falta lo configurado (por ejemplo la pedalera) se usa el primer mando real:
    // giro = eje 0, y en un mando estándar los gatillos aceleran y frenan. Lo que no encuentre queda en automático / teclado.
    const base = all.find(g => !g.dev) || all[0], std = base.mapping === 'standard', ok = c => !!(c && m[c.dev]);
    const trig = n => (std && base.buttons[n] ? base.buttons[n].value : 0);
    const st = ok(wheelCfg.steer) ? rel(wheelCfg.steer) : (base.axes[0] || 0);
    const th = ok(wheelCfg.thr) ? Math.max(0, rel(wheelCfg.thr)) : trig(7);
    const br = ok(wheelCfg.brk) ? Math.max(0, rel(wheelCfg.brk)) : trig(6);
    let au = false;
    if (ok(wheelCfg.auth)) { const g = m[wheelCfg.auth.dev]; au = !!(g.buttons[wheelCfg.auth.i] && g.buttons[wheelCfg.auth.i].pressed); }
    else au = !!(std && base.buttons[0] && base.buttons[0].pressed);
    const faltan = ['steer', 'thr', 'brk'].filter(k => wheelCfg[k] && !m[wheelCfg[k].dev]).length;
    const label = faltan ? 'falta conectar parte de lo configurado: giras con el volante y aceleras con ↑ o en automático' : (wheelCfg.steer || wheelCfg.thr || wheelCfg.brk ? 'configurado' : 'gira con el volante; acelera sola, frena con ↓');
    inp.analog = true; inp.src = 'pad'; inp.steer = Math.sign(st) * Math.pow(Math.abs(dzone(st, 0.03)), 1.25); inp.thr = clamp(th, 0, 1); inp.brk = clamp(br, 0, 1);
    if (au && !authPrev && G.mode === 'play') requestAuth(); authPrev = au;
    setCtl('Dispositivos detectados (' + all.length + '): ' + all.map(g => shortName(g.id)).join(' + ') + ' · ' + label);
  } else if (vw.on) {
    if (vw.id == null) vw.steer += (0 - vw.steer) * 0.22;      // al soltar, el volante vuelve al centro
    inp.analog = true; inp.src = 'vw'; inp.steer = Math.abs(vw.steer) < 0.05 ? 0 : vw.steer;
    $('vwG').setAttribute('transform', 'rotate(' + (vw.steer * 90).toFixed(1) + ' 50 50)');
    setCtl('Volante en pantalla: gíralo con el pulgar. ▲ acelera y ▼ frena.');
  } else if (tilt.on) {
    if (tilt.ang != null) {
      const d = wrap180(tilt.ang - tilt.neutral); tilt.sm += (d - tilt.sm) * 0.35;
      inp.analog = true; inp.src = 'tilt'; inp.steer = clamp((-tilt.sm / 32) * (tilt.inv ? -1 : 1), -1, 1);
      if (Math.abs(inp.steer) < 0.06) inp.steer = 0;
    }
    setCtl('Celular como volante: sostenlo en horizontal como un volante y gíralo.' + (tilt.ang == null ? ' (esperando el sensor…)' : ''));
  } else setCtl('Control: teclado o pantalla táctil. Si conectas un volante o una pedalera, muévelos o presiona un botón para que el navegador los detecte.');
  document.body.classList.toggle('wheel-on', inp.analog);
  if (inp.analog) $('wheelG').setAttribute('transform', 'rotate(' + (inp.steer * 110).toFixed(1) + ' 50 50)');
}
window.addEventListener('gamepadconnected', e => setCtl('Control detectado: ' + e.gamepad.id.slice(0, 44)));

/* volante en pantalla: se gira con el dedo (funciona en cualquier celular, sin sensores) */
const vw = { on: false, id: null, a0: 0, s0: 0, steer: 0 };
const vwEl = $('vwheel'), vwAng = e => { const r = vwEl.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
vwEl.addEventListener('pointerdown', e => { vw.id = e.pointerId; try { vwEl.setPointerCapture(e.pointerId); } catch (x) {} vw.a0 = vwAng(e); vw.s0 = vw.steer; e.preventDefault(); });
vwEl.addEventListener('pointermove', e => { if (e.pointerId !== vw.id) return; vw.steer = clamp(vw.s0 + wrap180(vwAng(e) - vw.a0) / 65, -1, 1); });
['pointerup', 'pointercancel'].forEach(t => vwEl.addEventListener(t, e => { if (e.pointerId === vw.id) vw.id = null; }));
function setVw(on) { vw.on = on; vw.steer = 0; vw.id = null; document.body.classList.toggle('vw-on', on); $('vwBtn').textContent = '🕹 Volante en pantalla: ' + (on ? 'sí' : 'no'); }
$('vwBtn').addEventListener('click', () => { if (!vw.on && tilt.on) tiltToggle(); setVw(!vw.on); try { localStorage.setItem('rajoRojo.ctl', vw.on ? 'vw' : 'btn'); } catch (e) {} });
// en el celular el volante en pantalla es el único control de giro
if (coarseMq.matches) setVw(true);      // en el celular el único control de giro es el volante en pantalla

/* WebHID: lectura directa de un dispositivo USB (útil si el navegador no entrega la pedalera como mando).
   Se interpreta el descriptor del dispositivo: cada campo de varios bits es un eje; cada campo de 1 bit, un botón. */
function hidBits(dv, bit, size, signed) {
  let v = 0;
  for (let i = 0; i < size; i++) { const b = bit + i, by = b >> 3; if (by < dv.byteLength && ((dv.getUint8(by) >> (b & 7)) & 1)) v += Math.pow(2, i); }
  if (signed && size > 1 && v >= Math.pow(2, size - 1)) v -= Math.pow(2, size);
  return v;
}
function hidAdd(d) {
  if (hidPads.some(v => v.dev === d)) return;
  const tabla = {};
  for (const col of d.collections || []) for (const rep of col.inputReports || []) {
    let bit = 0; const campos = [];
    for (const it of rep.items || []) {
      const n = it.reportCount || 1, sz = it.reportSize || 0;
      if (!it.isConstant) for (let k = 0; k < n; k++) campos.push({ bit: bit + k * sz, size: sz, min: it.logicalMinimum, max: it.logicalMaximum });
      bit += sz * n;
    }
    tabla[rep.reportId || 0] = (tabla[rep.reportId || 0] || []).concat(campos);
  }
  const padHid = { id: 'HID ' + (d.productName || 'dispositivo USB') + ' (' + (d.vendorId || 0).toString(16) + ':' + (d.productId || 0).toString(16) + ')', index: 100 + hidPads.length, connected: true, mapping: '', axes: [], buttons: [], dev: d };
  d.addEventListener('inputreport', e => {
    const campos = tabla[e.reportId || 0]; if (!campos) return;
    const ax = [], bt = [];
    for (const c of campos) {
      if (c.size <= 0 || c.size > 32) continue;
      const v = hidBits(e.data, c.bit, c.size, c.min < 0);
      if (c.size === 1) bt.push({ pressed: v > 0, value: v > 0 ? 1 : 0 });
      else ax.push(c.max === c.min ? 0 : clamp((v - c.min) / (c.max - c.min) * 2 - 1, -1, 1));
    }
    padHid.axes = ax; padHid.buttons = bt;
  });
  hidPads.push(padHid);
}
async function hidOpen(d) { try { if (!d.opened) await d.open(); hidAdd(d); return true; } catch (e) { return false; } }
const HID_BLOQUEADO = 'El navegador no permite el acceso USB directo en esta página. Usa Chrome o Edge en un computador, abriendo el juego desde su dirección https.';
async function hidConnect() {
  const msg = $('calHidMsg');
  if (!navigator.hid) { msg.textContent = 'Este navegador no permite WebHID. Usa Chrome o Edge en un computador.'; return; }
  try {
    const lista = await navigator.hid.requestDevice({ filters: [] });
    if (!lista.length) { msg.textContent = 'No elegiste ningún dispositivo.'; return; }
    let ok = 0; for (const d of lista) if (await hidOpen(d)) ok++;
    msg.textContent = ok ? 'Conectado. Pisa los pedales y mira abajo si cambian los valores.' : 'No pude abrir el dispositivo (puede estar en uso por otro programa).';
  } catch (e) { msg.textContent = /permissions policy|disallowed/i.test(String(e && e.message)) ? HID_BLOQUEADO : 'No se pudo conectar: ' + (e && e.message ? e.message : e); }
}
(function hidInit() {
  if (!navigator.hid) return;
  $('calHidBox').hidden = false; $('calHid').addEventListener('click', hidConnect);
  try { if (document.featurePolicy && document.featurePolicy.allowsFeature && !document.featurePolicy.allowsFeature('hid')) $('calHidMsg').textContent = HID_BLOQUEADO; } catch (e) {}
  try { navigator.hid.getDevices().then(ds => ds.forEach(hidOpen)).catch(() => {}); } catch (e) {}
})();

/* asistente de configuración: detecta solo qué dispositivo y qué eje o botón es el giro, el acelerador, el freno y la autorización
   (sirve con un volante, con una pedalera en otro USB, o con ambos en uno solo) */
const cal = { open: false, step: 0, base: null, t0: 0, det: null, cfg: {}, prev: null };
const CAL_STEPS = [['steer', 'Gira el volante a la DERECHA hasta donde quieras que sea el giro máximo y mantenlo.'], ['thr', 'Pisa el ACELERADOR a fondo y mantenlo.'], ['brk', 'Pisa el FRENO a fondo y mantenlo. Si no pasa nada, pisa el freno un par de veces seguidas.'], ['auth', 'Presiona el botón o la paleta para PEDIR AUTORIZACIÓN.']];
const CAL_NAMES = ['Giro del volante', 'Acelerador', 'Freno', 'Botón de autorización'];
function calRender(msg) {
  $('calMsg').textContent = msg || CAL_STEPS[cal.step][1];
  $('calSteps').innerHTML = CAL_STEPS.map((c, i) => (i < cal.step ? '✔ ' : (i === cal.step ? '▶ ' : '○ ')) + CAL_NAMES[i] + (cal.cfg[c[0]] != null && cal.cfg[c[0]].dev ? ' <small>(' + shortName(cal.cfg[c[0]].dev.replace(/#\d+$/, '')) + ')</small>' : '')).join('<br>');
}
function calStart() { cal.open = true; cal.step = 0; cal.base = null; cal.cfg = {}; cal.det = null; cal.prev = null; cal.t0 = performance.now(); $('calib').hidden = false; calRender('Mueve el volante y pisa los pedales (o presiona un botón de cada aparato) para que el navegador los detecte.'); }
function calNext() { cal.step++; cal.base = null; cal.det = null; cal.t0 = performance.now(); if (cal.step >= CAL_STEPS.length) calFinish(); else calRender(); }
function calFinish() { wheelCfg = Object.assign({}, cal.cfg); saveCfg(); cal.open = false; $('calib').hidden = true; }
const calRead = () => { const { all, m } = padMap(), o = {}; for (const k in m) o[k] = { a: m[k].axes.slice(), b: m[k].buttons.map(b => b.value), p: m[k].buttons.map(b => b.pressed) }; return { o, n: all.length }; };
const calVal = (snap, c) => { const d = snap.o[c.dev]; return d ? ((c.t === 'b' ? d.b[c.i] : d.a[c.i]) || 0) : 0; };
const sameSrc = (a, b) => a && b && a.dev === b.dev && a.t === b.t && a.i === b.i;
function calTick() {
  const snap = calRead();
  if (!snap.n) { calRender('No detecto nada. Mueve el volante, pisa los pedales o presiona un botón.'); $('calLive').textContent = ''; cal.step = 0; cal.base = null; cal.cfg = {}; return; }
  const live = [], mv = [];
  for (const k in snap.o) {
    live.push(shortName(k.replace(/#\d+$/, '')) + (k.includes('#') ? ' ' + k.split('#')[1] : '') + ': ' + snap.o[k].a.map((v, i) => i + '=' + v.toFixed(2)).join(' '));
    if (cal.base && cal.base.o[k]) { snap.o[k].a.forEach((v, i) => { if (Math.abs(v - cal.base.o[k].a[i]) > 0.15) mv.push('eje ' + i + ' = ' + v.toFixed(2)); }); snap.o[k].b.forEach((v, i) => { if (Math.abs(v - cal.base.o[k].b[i]) > 0.15) mv.push('botón ' + i + ' = ' + v.toFixed(2)); }); }
  }
  $('calLive').textContent = 'Dispositivos que ve el navegador: ' + snap.n + '\n' + live.join('\n') + '\nSe mueve: ' + (mv.length ? mv.join(', ') : '(nada)') + (snap.n < 2 && cal.step > 0 ? '\n⚠ Solo veo 1 dispositivo: si la pedalera es otro USB y no aparece, el navegador no la entrega como mando.' + (navigator.hid ? ' Usa «Conectar pedalera por USB (HID)».' : '') : '');
  if (!cal.base) {
    const held = Object.values(cal.cfg).some(c => c && typeof c === 'object' && c.f != null && Math.abs(calVal(snap, c) - c.r) > 0.2);
    if (held) { cal.t0 = performance.now(); calRender('Suelta el pedal o vuelve el volante al centro…'); return; }      // antes de medir el siguiente paso, todo vuelve al reposo
    if (performance.now() - cal.t0 < 600) return;
    cal.base = snap; cal.prev = snap; calRender(); return;
  }
  const key = CAL_STEPS[cal.step][0];
  if (key === 'auth') {
    for (const k in snap.o) snap.o[k].p.forEach((pr, i) => { if (pr && !(cal.prev.o[k] && cal.prev.o[k].p[i]) && !cal.cfg.auth) cal.cfg.auth = { dev: k, i }; });
    cal.prev = snap; if (cal.cfg.auth) calNext(); return;
  }
  let best = null, bd = 0;
  const consider = (c, v, r) => { const d = v - r; if (Math.abs(d) > Math.abs(bd)) { bd = d; best = c; } };
  for (const k in snap.o) {
    const b0 = cal.base.o[k]; if (!b0) continue;
    snap.o[k].a.forEach((v, i) => {
      const c = { dev: k, t: 'a', i };
      if (key !== 'steer' && sameSrc(c, cal.cfg.steer)) return;
      if (key === 'brk' && sameSrc(c, cal.cfg.thr) && (v - b0.a[i]) * (cal.cfg.thr.f - cal.cfg.thr.r) > 0) return;      // pedales en un solo eje: el freno va hacia el otro lado
      consider(c, v, b0.a[i]);
    });
    if (key !== 'steer') snap.o[k].b.forEach((v, i) => {                     // algunos aparatos entregan los pedales como botones analógicos
      const c = { dev: k, t: 'b', i };
      if (key === 'brk' && sameSrc(c, cal.cfg.thr)) return;
      consider(c, v, b0.b[i]);
    });
  }
  if (!cal.det) { if (best && Math.abs(bd) > (key === 'steer' ? 0.08 : 0.4)) cal.det = { c: best, t: performance.now(), ext: calVal(snap, best) }; }
  else {      // se mide durante ~1 s: el valor más lejano del reposo es el tope (giro máximo o pedal a fondo)
    const c = cal.det.c, v = calVal(snap, c), r = calVal(cal.base, c);
    if (Math.abs(v - r) > Math.abs(cal.det.ext - r)) cal.det.ext = v;
    if (performance.now() - cal.det.t > 1000) { cal.cfg[key] = { dev: c.dev, t: c.t, i: c.i, r, f: cal.det.ext }; calNext(); }
  }
}
$('wheelBtn').addEventListener('click', calStart);
$('calSkip').addEventListener('click', () => { if (cal.open) calNext(); });
$('calClose').addEventListener('click', () => { if (Object.keys(cal.cfg).length) { wheelCfg = Object.assign({}, wheelCfg, cal.cfg); saveCfg(); } cal.open = false; $('calib').hidden = true; });      // «Cerrar» guarda lo que alcanzó a detectar
$('calReset').addEventListener('click', () => { wheelCfg = {}; saveCfg(); cal.cfg = {}; cal.step = 0; cal.base = null; cal.det = null; calRender('Configuración borrada. Vuelve a empezar o cierra: el volante funciona igual por sí solo.'); });

/* celular como volante: se usa la rotación del celular alrededor de la normal de la pantalla (acelerómetro) */
let tiltWired = false;
function onMotion(e) { const a = e.accelerationIncludingGravity; if (!a || a.x == null || a.y == null || Math.hypot(a.x, a.y) < 3) return; tilt.ang = Math.atan2(a.x, a.y) * 180 / Math.PI; }
async function tiltToggle() {
  if (!tilt.on) {
    try { if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') { const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') { setCtl('No se dio permiso para usar el sensor de giro del celular.'); return; } } } catch (e) {}
    if (!tiltWired) { window.addEventListener('devicemotion', onMotion); tiltWired = true; }
    tilt.on = true; if (tilt.ang != null) tilt.neutral = tilt.ang;
    try { if (document.featurePolicy && document.featurePolicy.allowsFeature && !document.featurePolicy.allowsFeature('accelerometer')) tilt.ang = null; } catch (e) {}
    tiltAviso();
  } else tilt.on = false;
  document.body.classList.toggle('tilt-on', tilt.on); $('tiltBtn').textContent = '📱 Inclinar el celular como volante: ' + (tilt.on ? 'sí' : 'no');
}
$('tiltBtn').addEventListener('click', () => { if (vw.on) setVw(false); tiltToggle(); });
function tiltAviso() {      // si el navegador no entrega el sensor, se avisa y se ofrece el volante en pantalla
  setTimeout(() => { if (tilt.on && tilt.ang == null) { tilt.on = false; document.body.classList.remove('tilt-on'); $('tiltBtn').textContent = '📱 Inclinar el celular como volante: no'; setVw(true); setCtl('Este celular no entrega el sensor de giro dentro de Claude. Activé el volante en pantalla: gíralo con el pulgar.'); } }, 1600);
}
function tiltCalibrar(aviso) { if (tilt.ang != null) { tilt.neutral = tilt.ang; tilt.sm = 0; if (aviso) { setBanner('Volante calibrado', 'ok'); G.bannerT = 2; } return true; } return false; }
$('wheel').addEventListener('click', () => { if (tilt.on) tiltCalibrar(true); });      // en la partida: tocar el volante de la esquina recalibra
$('tiltCal').addEventListener('click', () => { if (!tiltCalibrar(false)) setCtl('Todavía no llega el sensor de giro. Mueve un poco el celular.'); else setCtl('Calibrado con esta posición.'); });
$('tiltInv').addEventListener('click', () => { tilt.inv = !tilt.inv; saveTilt(); $('tiltInv').textContent = tilt.inv ? 'Giro invertido ✔' : 'Invertir giro'; });

export { pollInput, cal, calTick, tilt, tiltAviso, tiltCalibrar };
