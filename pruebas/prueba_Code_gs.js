// Prueba de Code.gs con una hoja simulada en memoria
const fs = require('fs'), vm = require('vm');
const rows = []; let hojaCreada = false;
const sheet = {
  appendRow(r) { rows.push(r); }, getLastRow() { return rows.length; }, setFrozenRows() {},
  getRange(r, c, nr, nc) {
    return { setFontWeight() {}, getValues: () => rows.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc)),
      createTextFinder: (txt) => ({ matchEntireCell() { return this; }, findNext: () => rows.slice(r - 1, r - 1 + nr).some(x => String(x[c - 1]) === txt) ? {} : null }) };
  }
};
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (rows.length || hojaCreada) ? sheet : null, insertSheet: () => { hojaCreada = true; return sheet; } }), getUi: () => ({}) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { createTextOutput: s => ({ s, setMimeType(m) { this.m = m; return this; } }), MimeType: { JSON: 'JSON', JAVASCRIPT: 'JS' } },
  Session: {}, Utilities: {}, console
};
vm.createContext(ctx); vm.runInContext(fs.readFileSync('/mnt/user-data/outputs/rajo-rojo-github/Code.gs', 'utf8'), ctx);
const post = o => ctx.doPost({ postData: { contents: typeof o === 'string' ? o : JSON.stringify(o) } }).s;
const base = { id: 'abc123xyz9', n: 'María Pérez', o: 'D', t: 102.3, d: 1120, w: '', dev: 'celular', v: '1' };
const T = [];
const ok = (nombre, cond) => { T.push((cond ? '✔ ' : '✘ ') + nombre); };
ok('guarda una llegada', post(base) === 'ok' && rows.length === 2 && rows[1][3] === 'LLEGÓ' && rows[1][7] === 'celular');
ok('un reintento del mismo id no duplica', post(base) === 'repetido' && rows.length === 2);
ok('guarda una derrota con motivo', post(Object.assign({}, base, { id: 'def456uvw8', n: 'Luis', o: 'P', t: 48.2, d: 540, w: 'roca', dev: 'teclado' })) === 'ok' && rows[2][6] === 'roca');
ok('motivo desconocido → otro', post(Object.assign({}, base, { id: 'ghi789rst7', n: 'Ana', o: 'P', w: 'hackeo' })) === 'ok' && rows[3][6] === 'otro');
ok('nombre con fórmula no queda como fórmula', post(Object.assign({}, base, { id: 'jkl012opq6', n: '=HYPERLINK("x")' })) === 'ok' && !/^[=+\-@]/.test(rows[4][2]));
ok('rechaza tiempo absurdo', post(Object.assign({}, base, { id: 'mno345lmn5', t: 99999 })) === 'datos inválidos');
ok('rechaza metros absurdos', post(Object.assign({}, base, { id: 'pqr678ijk4', d: 90000 })) === 'datos inválidos');
ok('rechaza nombre vacío', post(Object.assign({}, base, { id: 'stu901fgh3', n: '  ' })) === 'datos inválidos');
ok('rechaza resultado desconocido', post(Object.assign({}, base, { id: 'vwx234cde2', o: 'X' })) === 'datos inválidos');
ok('rechaza JSON roto sin caerse', /^error/.test(post('{no es json')));
ok('lista: JSON válido con las filas guardadas', (() => { const r = ctx.doGet({ parameter: { action: 'list' } }); const j = JSON.parse(r.s); return r.m === 'JSON' && j.ok && j.filas.length === rows.length - 1 && j.filas[0].n === 'María Pérez'; })());
ok('lista con callback (JSONP) válida', (() => { const r = ctx.doGet({ parameter: { action: 'list', callback: 'rrCb' } }); return r.m === 'JS' && /^rrCb\(\{/.test(r.s); })());
ok('callback malicioso se ignora', (() => { const r = ctx.doGet({ parameter: { action: 'list', callback: 'alert(1);//' } }); return r.m === 'JSON'; })());
console.log(T.join('\n') + '\n\nfilas guardadas:', rows.length - 1);
