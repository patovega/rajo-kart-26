# Terreno real: tiempos de armado, datos de la ruta y capturas en varios puntos (modo prueba, camioneta detenida).
import asyncio, sys
from playwright.async_api import async_playwright
OUT = r"C:\Users\Usuario\AppData\Local\Temp\claude\0d8fb4b68261d687\0185a7f9-9f4b-4f28-ac0b-cded994cf449\scratchpad"
PUNTOS = [int(v) for v in sys.argv[1:]] or [60, 400, 900, 1400, 2100, 3000, 4000, 4800]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"]); pg = await b.new_page(viewport={"width": 960, "height": 540})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://127.0.0.1:8001/index.html"); await pg.wait_for_function("window.__d !== undefined", timeout=120000)
        print("PASOS:", await pg.evaluate("() => window.__d.PASOS.map(p => p[0].slice(0, 40) + ': ' + p[1] + ' ms')"))
        print("L", await pg.evaluate("() => Math.round(window.__d.L)"), "GEO_ZONES", await pg.evaluate("() => window.__d.GEO_ZONES"), "FREE0", await pg.evaluate("() => window.__d.FREE0"), "PLAT", await pg.evaluate("() => window.__d.PLAT"))
        print("hr inicio/fin", await pg.evaluate("() => [window.__d.hrAt(0).toFixed(1), window.__d.hrAt(window.__d.L).toFixed(1)]"), "H en partida", await pg.evaluate("() => { const F = window.__d.FREE0; return F ? [window.__d.H(F.x, F.z).toFixed(1), window.__d.f7h(F.x, F.z).toFixed(1)] : null; }"))
        await pg.wait_for_timeout(2500); await pg.screenshot(path=OUT + r"\dwg_menu.png")
        await pg.fill("#pname", "federico vega"); await pg.click("#goBtn"); await pg.wait_for_function("window.__d.mode === 'play'", timeout=120000); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT + r"\dwg_libre.png")
        for s in PUNTOS:
            await pg.evaluate("(s) => { const d = window.__d; Object.assign(d.P, { s, u: -8.6, v: 0, vu: 0 }); d.G.free = null; d.G.camSnap = true; d.keys.down = true; }", s)
            await pg.evaluate("() => { const d = window.__d; for (let i = 0; i < 20; i++) d.step(0.05); }")
            await pg.wait_for_timeout(2500)
            print("s", s, await pg.evaluate("() => [window.__d.mode, Math.round(window.__d.P.s), window.__d.P.y.toFixed(1)]"))
            await pg.screenshot(path=OUT + r"\dwg_s%04d.png" % s)
        print("errs", errs); await b.close()
asyncio.run(main())
