import asyncio, sys, subprocess, time, json, urllib.request
sys.path.insert(0, '/tmp/gh')
import mock
from playwright.async_api import async_playwright
def post(d): urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8765/exec', data=json.dumps(d).encode(), method='POST', headers={'Content-Type': 'text/plain'}))
def rec(i, n, o, t, d, w='', dev='celular'): return {'id': 'id%07d' % i, 'n': n, 'o': o, 't': t, 'd': d, 'w': w, 'dev': dev}
async def panel(pg):
    return await pg.evaluate("""() => ({ vivo: document.getElementById('live').textContent, stats: [...document.querySelectorAll('.stat')].map(s => s.innerText.replace(/\\n/g, ' ')),
      primero: (document.querySelector('section.card tbody tr') || {innerText: '-'}).innerText.replace(/\\s+/g, ' '), motivos: [...document.querySelectorAll('.bar')].map(x => x.innerText.replace(/\\n+/g, ' ')), feed: [...document.querySelectorAll('.feed div')].slice(0, 2).map(x => x.innerText.replace(/\\n+/g, ' ')) })""")
async def main():
    web = subprocess.Popen(['python3', '-m', 'http.server', '8000', '--bind', '127.0.0.1'], cwd='/tmp/gh_test', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    api = mock.serve(8765); await asyncio.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); errs = []
            pg = await b.new_page(viewport={'width':900,'height':1000}); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://127.0.0.1:8000/ranking.html'); await pg.wait_for_timeout(1500)
            print('vacío     →', await panel(pg))
            for i, a in enumerate([('Pedro', 'D', 95.7, 1120), ('María', 'D', 102.3, 1120), ('Luis', 'P', 48.2, 540, 'roca'), ('Ana', 'P', 30.5, 300, 'pretil')]): post(rec(i + 1, *a))
            await pg.wait_for_timeout(5500)
            print('con datos →', await panel(pg))
            post(rec(9, 'Camila', 'D', 88.1, 1120, '', 'volante-mando')); await pg.wait_for_timeout(5500)
            print('llega uno nuevo, sin recargar →', (await panel(pg))['primero'])
            # plan B: sin CORS el navegador no puede leer con fetch → usa JSONP
            mock.E.cors = False; post(rec(10, 'Jorge', 'P', 20, 150, 'caex')); await pg.wait_for_timeout(5500)
            print('sin CORS (JSONP)   →', (await panel(pg))['stats'], '| ¿sigue en vivo?:', (await panel(pg))['vivo'])
            await pg.screenshot(path='/tmp/gh/ranking_pc.png', full_page=True)
            mock.E.cors = True
            # servidor caído → «sin conexión» pero conserva lo último
            api.shutdown(); api.server_close(); await pg.wait_for_timeout(15000)
            print('servidor caído     →', (await panel(pg))['vivo'], '| sigue mostrando:', (await panel(pg))['stats'][1])
            api = mock.serve(8765); await pg.wait_for_timeout(6000); print('servidor vuelve    →', (await panel(pg))['vivo'])
            # pantalla grande
            await pg.goto('http://127.0.0.1:8000/ranking.html?tv=1'); await pg.wait_for_timeout(2500)
            await pg.set_viewport_size({'width':1600,'height':900}); await pg.wait_for_timeout(500); await pg.screenshot(path='/tmp/gh/ranking_tv.png')
            print('modo pantalla grande →', await pg.evaluate("() => document.body.classList.contains('tv')"))
            # sin configurar
            open('/tmp/gh_test/config.js', 'w').write("window.RR_CONFIG = { endpoint: '', token: '', refrescarCadaSeg: 8 };")
            await pg.goto('http://127.0.0.1:8000/ranking.html'); await pg.wait_for_timeout(1200)
            print('sin endpoint →', (await pg.inner_text('.err'))[:90], errs or '')
            await b.close()
    finally:
        web.terminate()
asyncio.run(main())
