import json, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
class Estado:
    filas = []; cors = True; posts = []
E = Estado
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _h(self, ctype, body):
        self.send_response(200); self.send_header('Content-Type', ctype)
        if E.cors: self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers(); self.wfile.write(body.encode('utf-8'))
    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        if q.get('action') == ['list']:
            data = json.dumps({'ok': True, 'filas': E.filas})
            cb = (q.get('callback') or [None])[0]
            if cb: return self._h('application/javascript', cb + '(' + data + ')')
            return self._h('application/json', data)
        self._h('application/json', '{"ok":true}')
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); raw = self.rfile.read(n).decode('utf-8')
        try:
            d = json.loads(raw); E.posts.append(d)
            if not any(f['id'] == d['id'] for f in E.filas):
                E.filas.append({'id': d['id'], 'f': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()), 'n': d['n'], 'r': 'LLEGÓ' if d['o'] == 'D' else 'PERDIÓ', 't': d['t'], 'd': d['d'], 'w': d['w'], 'dev': d['dev']})
            self._h('text/plain', 'ok')
        except Exception as e:
            self._h('text/plain', 'error')
def serve(port):
    srv = ThreadingHTTPServer(('127.0.0.1', port), H); threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv
