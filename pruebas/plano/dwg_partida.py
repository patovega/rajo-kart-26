# Partidas completas sobre el terreno real, aceleradas con step(dt):
#  1) modo prueba (sin tráfico): desde la ruta s=0 hasta el domo → debe terminar en 'win'.
#  2) modo normal (con tráfico, rocas y aljibe): 150 s de juego pidiendo autorización con la tecla 0 cada tanto → sin errores, y se informa cómo terminó.
import asyncio
from playwright.async_api import async_playwright
OUT = r"C:\Users\Usuario\AppData\Local\Temp\claude\0d8fb4b68261d687\0185a7f9-9f4b-4f28-ac0b-cded994cf449\scratchpad"
EST = "() => { const d = window.__d; return [d.mode, Math.round(d.P.s), Math.round(d.P.v * 3.6) + ' km/h', d.tGame.toFixed(1) + ' s', !!d.free, d.G.arrive ? 'llegando' : '', d.trucks.length, d.oncs.length]; }"
async def partida(p, nombre, max_s, auth, foto):
    b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"]); pg = await b.new_page(viewport={"width": 960, "height": 540})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto("http://127.0.0.1:8001/index.html"); await pg.wait_for_function("window.__d !== undefined", timeout=120000)
    await pg.fill("#pname", nombre); await pg.click("#goBtn"); await pg.wait_for_function("window.__d.mode === 'play'", timeout=120000); await pg.wait_for_timeout(800)
    await pg.evaluate("() => { const d = window.__d; Object.assign(d.P, { s: 0, u: -8.6, v: 8, vu: 0 }); d.G.free = null; d.G.camSnap = true; }")
    await pg.evaluate("(a) => { window.__auto = a; window.__req = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true })); }", auth)
    t = 0; ultimo = None
    while t < 400000:
        await pg.evaluate("""() => { const d = window.__d, P = d.P; if (d.mode !== 'play') return;
            for (let i = 0; i < 10; i++) {
              if (window.__auto) {      // piloto: pide autorización y pasa por la derecha al CAEX de adelante; esquiva las rocas
                let tu = -8.6; const t = d.trucks.filter(t => t.s > P.s - 12 && t.s - P.s < 70).sort((a, b) => a.s - b.s)[0];
                if (t) { if (!t.auth && t.s - P.s < 54) window.__req(); if (t.auth || t.s - P.s < 30) tu = Math.max(t.u + 7, 2); }
                const r = d.rocasPista.filter(r => r.s > P.s && r.s - P.s < 45).sort((a, b) => a.s - b.s)[0]; if (r && Math.abs(r.u - tu) < 4) tu = r.u < -7 ? -1.5 : -13.5;
                P.u += Math.max(-0.25, Math.min(0.25, tu - P.u));
              }
              d.step(0.05);
            } }""")
        await pg.wait_for_timeout(100); t += 100
        st = await pg.evaluate(EST)
        if t % 10000 == 0: print("   ", st)
        if st[0] != "play" or float(st[3][:-2]) > max_s: ultimo = st; break
        if foto and st[1] > foto and not getattr(partida, "f", None): partida.f = 1; await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + r"\dwg_trafico.png")
    print("FIN", nombre, ":", ultimo, "| banner:", repr(await pg.evaluate("() => document.getElementById('banner') ? document.getElementById('banner').innerText : ''"))[:120], "| errs:", errs[:3])
    await pg.screenshot(path=OUT + r"\dwg_fin_" + nombre.split()[0] + ".png"); await b.close()
async def main():
    async with async_playwright() as p:
        await partida(p, "federico vega", 900, False, None)
        await partida(p, "juan perez", 150, True, 300)
asyncio.run(main())
