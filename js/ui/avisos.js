// Avisos: fichas compactas estilo Waze con voz (renderAlerts, speak), cartel (setBanner), radio (showRadio), cotillón y tarjeta de felicitación en la meta.
import { G } from '../juego/estado.js';
import { el } from './dom.js';
import { SND } from './sonido.js';

/* HUD helpers */
let alSig = '', alKeys = new Set(), alVoiceT = {};
const AL_VOICE = { roca: 'Roca adelante', caex: 'Mantén distancia con el camión', vel: 'Exceso de velocidad', mojado: 'Piso mojado, reduce la velocidad', pl: 'Cuidado con el pretil', pr: 'Cuidado con el pretil', pista: 'Vuelve a tu pista', contra: 'Tráfico en contra', zona: 'Zona de caída de rocas' };
function speak(txt) {      // aviso hablado, como en Waze (solo si el sonido está activo)
  try {
    if (SND.muted || !window.speechSynthesis || G.mode !== 'play') return;
    const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-CL'; u.rate = 1.12; u.volume = 1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}
function renderAlerts(list) {
  const sig = list.map(a => a.key + a.num + a.sev + a.ico).join('|');
  if (sig === alSig) return; alSig = sig;
  el.alerts.innerHTML = list.map(a => '<div class="al ' + a.sev + (a.sev === 'bad' ? ' pulse' : '') + '">' + (a.ico.startsWith('SIGN:') ? '<i class="sign">' + a.ico.slice(5) + '</i>' : '<i>' + a.ico + '</i>') +
    (a.num ? '<b>' + a.num + '</b>' : '') + '<span>' + a.label + '</span></div>').join('');
  const now = performance.now(), cur = new Set(list.map(a => a.key));
  for (const a of list) if (!alKeys.has(a.key) && AL_VOICE[a.key] && (!alVoiceT[a.key] || now - alVoiceT[a.key] > 9000)) { alVoiceT[a.key] = now; speak(AL_VOICE[a.key] + (a.key === 'roca' && a.num ? ', ' + a.num.replace(' m', ' metros') : '')); break; }
  alKeys = cur;
}
function setBanner(txt, kind) {
  if (!txt) { el.banner.style.display = 'none'; return; }
  el.banner.textContent = txt; el.banner.className = kind || ''; el.banner.style.display = 'block';
  el.banner.style.whiteSpace = 'pre-line'; el.banner.style.textAlign = 'center'; el.banner.style.maxWidth = '92vw';
}
function showRadio(html) {
  el.radio.innerHTML = html; el.radio.style.display = 'block';
  clearTimeout(radioTimer); radioTimer = setTimeout(() => { el.radio.style.display = 'none'; }, 4800);
}
function cotillon() {      // cotillón de colores sobre el juego (3 s)
  const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight;
  c.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:50';
  document.body.append(c); const x = c.getContext('2d');
  const cols = ['#c9141c', '#e3a008', '#1f9d55', '#2f80ed', '#e05cb8', '#ffffff'];
  const ps = Array.from({ length: 170 }, () => ({ x: c.width / 2 + (Math.random() - 0.5) * 220, y: c.height * 0.7, vx: (Math.random() - 0.5) * 16, vy: -(Math.random() * 18 + 6), r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3 }));
  const t0 = performance.now();
  (function cuadro(now) {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }
    if (now - t0 < 3200) requestAnimationFrame(cuadro); else c.remove();
  })(t0);
}
function metaMensaje() {      // tarjeta de felicitación bajo el aviso de meta; se quita sola
  const m = document.createElement('div'); m.id = 'metaMsg';
  m.textContent = 'La práctica te hace rápido, la disciplina te mantiene seguro. El simulador es el lugar para forjar el carácter y el respeto que la operación real exige. Mantente atento a las condiciones, no te arriesgues y regresa a casa con los tuyos.';
  document.body.append(m); setTimeout(() => m.remove(), 9000);
}

export { speak, renderAlerts, setBanner, showRadio, cotillon, metaMensaje };
