// Registro de cada partida en la hoja de Google (rrSend/rrFlush: cola en localStorage, reintentos, fetch no-cors), código del resultado (showResult), copiar/compartir, y partidas en vivo para los espectadores (liveStart, liveTick).
import { START_S } from '../terreno/construir.js';
import { fmt } from '../comun/texto.js';
import { END_S, G, P, inp } from '../juego/estado.js';
import { $, coarseMq, el } from './dom.js';

/* Registro automático de cada partida (ganada o perdida) en la hoja de Google que configuraste en config.js */
const reasonCode = m => /dozer/i.test(m) ? 'frontal' : /roca/i.test(m) ? 'roca' : /menos de \d+ m del CAEX/.test(m) ? 'caex' : /rodaste y caíste/.test(m) ? 'rajo' : /pretil/i.test(m) ? 'pretil'
  : /Choque frontal/.test(m) ? 'frontal' : /Chocaste con el camión/.test(m) ? 'choqueCaex' : /sin solicitar autorización/.test(m) ? 'sinAut' : /derecha/.test(m) ? 'lado' : /pista contraria/i.test(m) ? 'pista' : 'otro';
const RRC = window.RR_CONFIG || {}, RR_Q = 'rajoRojo.pendientes';
const rrLoad = () => { try { return JSON.parse(localStorage.getItem(RR_Q) || '[]'); } catch (e) { return []; } };
const rrSave = q => { try { localStorage.setItem(RR_Q, JSON.stringify(q.slice(-50))); } catch (e) {} };
const rrStatus = t => { const e = document.getElementById('sendSt'); if (e) e.textContent = t; };
let rrBusy = false;
async function rrFlush() {      // envía lo pendiente; si no hay conexión, queda guardado en el celular y se reintenta solo
  if (!RRC.endpoint || rrBusy) return; rrBusy = true;
  try {
    let q = rrLoad();
    while (q.length) {
      const rec = q[0];
      await fetch(RRC.endpoint, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(rec) });
      q = rrLoad().filter(r => r.id !== rec.id); rrSave(q);
    }
    rrStatus('✔ Resultado registrado en el ranking.');
  } catch (e) { rrStatus('Sin conexión: el resultado queda guardado y se envía solo cuando vuelva.'); }
  rrBusy = false;
}
function rrSend(rec) {
  if (G.TEST) { rrStatus('Modo prueba: esta partida no se envía al ranking.'); return; }
  if (!RRC.endpoint) { rrStatus('El registro automático no está configurado: copia el texto y mándaselo al organizador.'); return; }
  const q = rrLoad(); q.push(rec); rrSave(q); rrStatus('Enviando resultado…'); rrFlush();
}
window.addEventListener('online', rrFlush); setInterval(rrFlush, 15000); setTimeout(rrFlush, 1500);
// Partidas en vivo: latido cada 2,5 s para la página de espectadores (no se guarda si no hay conexión)
let liveId = '', liveT = 0, liveOn = false, liveRetryT = 0;
// Pide una de las 10 plazas para enviar posiciones; si no hay plaza, reintenta cada 20 s
function liveJoin() {
  liveOn = false; liveRetryT = 20;
  if (G.TEST) return;      // modo prueba: no aparece en espectadores
  if (!RRC.endpoint || !liveId) return;
  const url = RRC.endpoint + (RRC.endpoint.includes('?') ? '&' : '?') + 'action=unirse&id=' + encodeURIComponent(liveId) + '&n=' + encodeURIComponent(G.playerName) + '&_=' + Date.now();
  fetch(url, { cache: 'no-store' }).then(r => r.json()).then(j => { liveOn = !!(j && j.track); }).catch(() => { liveOn = false; });
}
function liveSend() {
  if (!RRC.endpoint || !liveId || !liveOn) return;
  const metros = Math.max(0, Math.round(Math.min(P.s, END_S) - START_S));
  const rec = { action: 'live', token: RRC.token || '', id: liveId, n: G.playerName, v: Math.round(P.v * 3.6), d: metros, t: Math.round(G.tGame * 10) / 10, r: Math.round(END_S - START_S) };
  try { fetch(RRC.endpoint, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(rec) }).catch(() => {}); } catch (e) {}
}
function liveStart() { liveId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); liveT = 0; liveJoin(); }      // identificador de esta partida y plaza para enviar posiciones
function liveTick(dt) {      // latido cada 4 s para espectadores, solo si tiene plaza; si no, reintenta pedirla cada 20 s
  liveT -= dt; if (liveT <= 0) { liveT = 4; liveSend(); }
  if (!liveOn) { liveRetryT -= dt; if (liveRetryT <= 0) liveJoin(); }
}
function showResult(win, msg) {      // texto + código para el ranking (el ranking los lee de cualquier mensaje donde vayan pegados)
  const metros = Math.max(0, Math.round(Math.min(P.s, END_S) - START_S)), t = Math.round(G.tGame * 10) / 10;
  const id = Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
  const code = 'RR1:' + id + '|' + G.playerName + '|' + (win ? 'D' : 'P') + '|' + t.toFixed(1) + '|' + metros + '|' + (win ? '-' : reasonCode(msg));
  const human = win ? '🏁 Rajo Kart 26 · ' + G.playerName + ' llegó al domo en ' + fmt(G.tGame) + ' (' + metros + ' m)'
    : '💥 Rajo Kart 26 · ' + G.playerName + ' perdió a los ' + metros + ' m (' + fmt(G.tGame) + '): ' + msg.replace(/CAEX-\d+/g, 'un CAEX');
  $('resTxt').value = human + '\n[' + code + ']'; $('resBox').hidden = false; $('resCopy').textContent = '📋 Copiar resultado';
  $('resShare').hidden = !navigator.share;
  rrSend({ token: RRC.token || '', id, n: G.playerName, o: win ? 'D' : 'P', t, d: metros, w: win ? '' : reasonCode(msg), dev: coarseMq.matches ? 'celular' : (inp.src === 'pad' ? 'volante-mando' : 'teclado'), v: '1' });
}
async function copyResult() {
  const ta = $('resTxt'); let ok = false; ta.focus(); ta.select();
  try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) {} }
  $('resCopy').textContent = ok ? '✔ Copiado: pégalo en tu mensaje' : 'Selecciona el texto de arriba y cópialo';
}
$('resCopy').addEventListener('click', copyResult);
$('resShare').addEventListener('click', () => { try { navigator.share({ text: $('resTxt').value }).catch(() => {}); } catch (e) {} });

export { showResult, liveStart, liveTick };
