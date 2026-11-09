/**
 * RAJO ROJO · registro de partidas en una Hoja de Google
 *
 * Cómo se usa (resumen; los pasos completos están en LEEME.md):
 *   1. Crea una Hoja de cálculo de Google nueva en tu Drive.
 *   2. Extensiones > Apps Script. Borra lo que haya y pega TODO este archivo. Guarda.
 *   3. Implementar > Nueva implementación > tipo "Aplicación web":
 *        Ejecutar como: Yo      Quién tiene acceso: Cualquier persona
 *   4. Autoriza los permisos y copia la URL que termina en /exec: va en config.js (endpoint).
 *
 * Cada partida (ganada o perdida) agrega una fila en la pestaña "Resultados".
 * El mismo enlace entrega la lista al ranking en vivo (action=list).
 */

const TOKEN = '';        // Opcional: una clave cualquiera. Si la pones aquí, ponla igual en config.js (token).
const SHEET_ID = '1JaTjb190q0b-pPDJ5CCfB_fNfenPjcvDqsTB3EfAclY';     // Opcional: si el script NO está dentro de la hoja, pega aquí el ID de la hoja.
const HOJA = 'Resultados';
const COLS = ['id', 'fecha', 'nombre', 'resultado', 'tiempo_s', 'metros', 'motivo', 'dispositivo', 'version'];
const MOTIVOS = ['roca', 'camote', // 'camote' se mantiene para filas ya guardadas
  'caex', 'choqueCaex', 'frontal', 'pretil', 'rajo', 'sinAut', 'lado', 'pista', 'otro'];
const DISPOSITIVOS = ['celular', 'teclado', 'volante-mando'];
const MAX_FILAS_LISTA = 5000;

function libro_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }
function hoja_() {
  const ss = libro_();
  let sh = ss.getSheetByName(HOJA);
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLS.length).setFontWeight('bold');
  }
  return sh;
}

/** El juego manda cada resultado aquí (POST). */
function doPost(e) {
  let pre = {};
  try { pre = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return texto_('error: ' + err); }
  if (pre.action === 'live') { vivo_(pre); return texto_('ok'); }      // latido de una partida en curso (no pasa a la hoja)
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = pre;
    if (TOKEN && d.token !== TOKEN) return texto_('token incorrecto');
    const id = String(d.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
    // nombre: solo letras, números y signos simples; sin "=", "+", "-" o "@" al comienzo (evita fórmulas en la hoja)
    const nombre = String(d.n || '').replace(/[^\p{L}\p{N} .,'_()-]/gu, '').replace(/^[\s=+\-@]+/, '').trim().slice(0, 20);
    const o = d.o === 'D' ? 'D' : (d.o === 'P' ? 'P' : '');
    const t = Number(d.t), m = Math.round(Number(d.d));
    if (id.length < 6 || nombre.length < 2 || !o || !(t >= 1 && t <= 7200) || !(m >= 0 && m <= 3000)) return texto_('datos inválidos');
    const sh = hoja_();
    const n = sh.getLastRow();
    if (n >= 2 && sh.getRange(2, 1, n - 1, 1).createTextFinder(id).matchEntireCell(true).findNext()) return texto_('repetido');   // un reintento no duplica
    const motivo = o === 'D' ? '' : (MOTIVOS.indexOf(d.w) >= 0 ? d.w : 'otro');
    const dev = DISPOSITIVOS.indexOf(d.dev) >= 0 ? d.dev : 'otro';
    sh.appendRow([id, new Date(), nombre, o === 'D' ? 'LLEGÓ' : 'PERDIÓ', Math.round(t * 10) / 10, m, motivo, dev, String(d.v || '1').slice(0, 6)]);
    return texto_('ok');
  } catch (err) {
    return texto_('error: ' + err);
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/** El ranking en vivo pide la lista aquí (GET ?action=list). */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'list') return salida_({ ok: true, ahora: new Date().toISOString(), filas: listar_() }, p.callback);
  if (p.action === 'live') return salida_({ ok: true, ahora: Date.now(), partidas: vivas_() }, p.callback);
  return salida_({ ok: true, mensaje: 'Rajo Rojo: el registro está activo.' }, p.callback);
}
function listar_() {
  const sh = hoja_(), n = sh.getLastRow();
  if (n < 2) return [];
  const desde = Math.max(2, n - MAX_FILAS_LISTA + 1);
  return sh.getRange(desde, 1, n - desde + 1, COLS.length).getValues().map(function (r) {
    return { id: String(r[0]), f: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), n: String(r[2]), r: String(r[3]), t: Number(r[4]), d: Number(r[5]), w: String(r[6]), dev: String(r[7]) };
  });
}
/* Partidas en vivo: cada partida manda un latido cada ~2,5 s. Se guardan en la caché del script (no en la hoja).
   Se guardan hasta 12 partidas activas; la página elige 4 al azar. Una partida sin latidos 15 s se considera terminada. */
const VIVO_MAX = 12, VIVO_VIGENTE_MS = 15000, VIVO_IDX_MS = 30000;
function vivo_(d) {
  if (TOKEN && d.token !== TOKEN) return;
  const id = String(d.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
  const nombre = String(d.n || '').replace(/[^\p{L}\p{N} .,'_()-]/gu, '').replace(/^[\s=+\-@]+/, '').trim().slice(0, 20);
  if (id.length < 6 || nombre.length < 2) return;
  const v = Math.max(0, Math.min(200, Math.round(Number(d.v) || 0)));
  const m = Math.max(0, Math.min(3000, Math.round(Number(d.d) || 0)));
  const t = Math.max(0, Math.min(7200, Number(d.t) || 0));
  const r = Math.max(1, Math.min(3000, Math.round(Number(d.r) || 1100)));
  const cache = CacheService.getScriptCache(), ahora = Date.now();
  cache.put('v_' + id, JSON.stringify({ id: id, n: nombre, v: v, d: m, t: t, r: r, ts: ahora }), 60);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) return;      // si está ocupado, el siguiente latido vuelve a anotar la partida
  try {
    let idx = JSON.parse(cache.get('v_idx') || '[]').filter(function (x) { return x.id !== id && ahora - x.ts < VIVO_IDX_MS; });
    idx.push({ id: id, ts: ahora });
    idx.sort(function (a, b) { return b.ts - a.ts; });
    cache.put('v_idx', JSON.stringify(idx.slice(0, VIVO_MAX)), 60);
  } finally { lock.releaseLock(); }
}
function vivas_() {
  const cache = CacheService.getScriptCache(), ahora = Date.now(), out = [];
  JSON.parse(cache.get('v_idx') || '[]').forEach(function (x) {
    const raw = cache.get('v_' + x.id);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (ahora - p.ts < VIVO_VIGENTE_MS) out.push(p);
  });
  return out.slice(0, VIVO_MAX);
}
function texto_(s) { return ContentService.createTextOutput(s); }
function salida_(obj, cb) {
  const json = JSON.stringify(obj);
  if (cb && /^[A-Za-z_][A-Za-z0-9_.]{0,40}$/.test(cb)) return ContentService.createTextOutput(cb + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/** Menú dentro de la hoja: dejar el ranking en cero antes de un evento (guarda una copia de lo anterior). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Rajo Rojo')
    .addItem('Empezar un evento nuevo (vaciar resultados)', 'nuevoEvento')
    .addToUi();
}
function nuevoEvento() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Empezar un evento nuevo', 'Se guarda una copia de los resultados actuales en otra pestaña y se vacía la lista. ¿Seguro?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  const sh = hoja_(), n = sh.getLastRow();
  if (n >= 2) {
    const copia = sh.copyTo(libro_());
    copia.setName('Copia ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH.mm'));
    sh.deleteRows(2, n - 1);
  }
  ui.alert('Listo: el ranking quedó en cero.');
}
