import asyncio, sys, subprocess, time, threading, json
sys.path.insert(0, '/tmp/gh')
import mock
from playwright.async_api import async_playwright
async def jugar_hasta_el_final(pg, nombre, ganar):
    await pg.fill('#pname', nombre); await pg.evaluate("document.getElementById('goBtn').click()"); await pg.wait_for_timeout(500)
    if ganar: await pg.evaluate("() => { const d = window.__d; d.trucks.length = 0; d.rocasPista.length = 0; while (d.oncs.length) d.oncs.pop(); d.P.s = d.L - 30; d.P.v = 12; d.P.u = -6.5; }")
    else: await pg.evaluate("() => { const d = window.__d; d.trucks.length = 0; while (d.oncs.length) d.oncs.pop(); const c = d.rocasPista[0]; d.P.s = c.s - 40; d.P.u = c.u; d.P.v = 8; }")
    for _ in range(160):
        await pg.wait_for_timeout(400)
        if not await pg.is_hidden('#ovEnd'): break
async def main():
    web = subprocess.Popen(['python3', '-m', 'http.server', '8000', '--bind', '127.0.0.1'], cwd='/tmp/gh_test', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    api = mock.serve(8765); await asyncio.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            pg = await b.new_page(viewport={'width':800,'height':560}); errs=[]
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://127.0.0.1:8000/index.html'); await pg.wait_for_timeout(2000)
            # 1) derrota → llega al registro
            await jugar_hasta_el_final(pg, 'María Pérez', False); await pg.wait_for_timeout(1500)
            print('1) derrota → estado:', await pg.inner_text('#sendSt'), '| filas en la hoja:', len(mock.E.filas), '| enviado:', {k: mock.E.posts[-1][k] for k in ('n','o','t','d','w','dev')} if mock.E.posts else None)
            # 2) llegada al domo
            await pg.click('#chgName'); await pg.wait_for_timeout(300)
            await jugar_hasta_el_final(pg, 'Pedro Rojas', True); await pg.wait_for_timeout(1500)
            print('2) llegada → estado:', await pg.inner_text('#sendSt'), '| filas:', len(mock.E.filas), '| último:', {k: mock.E.posts[-1][k] for k in ('n','o','t','d','w')})
            # 3) sin conexión: se guarda y se reenvía solo
            api.shutdown(); api.server_close(); await asyncio.sleep(0.5)
            await pg.click('#chgName'); await pg.wait_for_timeout(300)
            await jugar_hasta_el_final(pg, 'Luis Soto', False); await pg.wait_for_timeout(2500)
            print('3) sin servidor → estado:', await pg.inner_text('#sendSt'), '| pendientes guardados:', await pg.evaluate("() => window.__d.rrLoad().length"), '| filas en la hoja:', len(mock.E.filas))
            api = mock.serve(8765); await asyncio.sleep(0.5)
            for _ in range(60):
                await pg.wait_for_timeout(1000)
                if len(mock.E.filas) == 3: break
            print('   vuelve el servidor → filas en la hoja:', len(mock.E.filas), '| pendientes:', await pg.evaluate("() => window.__d.rrLoad().length"), '| estado:', await pg.inner_text('#sendSt'))
            # 4) un reenvío del mismo id no duplica (lo hace el servidor)
            rec = mock.E.posts[-1]; import urllib.request
            urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8765/exec', data=json.dumps(rec).encode(), method='POST', headers={'Content-Type': 'text/plain'}))
            print('4) mismo id reenviado → filas:', len(mock.E.filas), '(debe seguir en 3)')
            print(errs or 'sin errores'); await b.close()
    finally:
        web.terminate()
asyncio.run(main())
