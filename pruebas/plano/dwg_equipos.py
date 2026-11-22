# Vistas de los equipos reubicados: detiene el bucle, pone la cámara sobre cada sitio (palas, PC9000, canchas, SEM 6, portón) y captura.
import asyncio
from playwright.async_api import async_playwright
OUT = r"C:\Users\Usuario\AppData\Local\Temp\claude\0d8fb4b68261d687\0185a7f9-9f4b-4f28-ac0b-cded994cf449\scratchpad"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"]); pg = await b.new_page(viewport={"width": 1100, "height": 620})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://127.0.0.1:8001/index.html"); await pg.wait_for_function("window.__d !== undefined", timeout=120000)
        print("PASOS:", await pg.evaluate("() => window.__d.PASOS.filter(p => p[1] > 5).map(p => p[0].slice(0, 32) + ': ' + p[1] + ' ms')"))
        info = await pg.evaluate("""async () => { const D = await import('./js/datos/terreno_dwg.js'), C = await import('./js/operaciones/carguio.js'), K = await import('./js/operaciones/cables.js'), d = window.__d;
            window.__OPS = C.OPS; window.__CAB = K.CABLES; window.__PISOS = D.PISOS_DWG;
            return { pisos: D.PISOS_DWG.filter(p => p.f7 || p.fondo || p.cancha).map(p => ({ f7: !!p.f7, fondo: !!p.fondo, cancha: !!p.cancha, cx: p.cx, cz: p.cz, y: p.y, area: p.area, dRuta: p.dRuta, frentes: p.frentes.length })),
                     palas: C.OPS.PALAS.map(p => ({ num: p.num, x: Math.round(p.x), z: Math.round(p.z), cable: p.cable })), hyd: !!C.OPS.HYD, dozers: C.OPS.DOZ.length, LZ: C.OPS.LZ.length,
                     gate: d.GATE ? [Math.round(d.GATE.s0), Math.round(d.GATE.s1)] : null, cable: K.CABLES.CABLE ? { posts: K.CABLES.CABLE.posts.length, ground: K.CABLES.CABLE.ground.length, src: K.CABLES.CABLE.src } : null,
                     cable2: K.CABLES.CABLE2 ? { posts: K.CABLES.CABLE2.posts.length, ground: K.CABLES.CABLE2.ground.length, src: K.CABLES.CABLE2.src } : null, obst: d.OBST.length, FREE0: d.FREE0 }; }""")
        for k, v in info.items(): print(k, v)
        await pg.fill("#pname", "federico vega"); await pg.click("#goBtn"); await pg.wait_for_function("window.__d.mode === 'play'", timeout=120000)      # sin la pantalla de inicio encima
        await pg.evaluate("() => { window.requestAnimationFrame = () => 0; }"); await pg.wait_for_timeout(1500)
        vistas = await pg.evaluate("""() => { const d = window.__d, out = [];
            for (const p of window.__OPS.PALAS) out.push(['pala' + p.num, p.x, p.z, p.fx, p.fz, 110, 55]);
            if (window.__OPS.HYD) { const q = window.__OPS.HYD.S.g.position; out.push(['pc9000', q.x, q.z, 0, 1, 90, 45]); }
            for (const P of window.__PISOS.filter(p => p.cancha)) out.push(['cancha_' + Math.round(P.cx), P.cx, P.cz, 0, 1, 220, 160]);
            if (window.__CAB.CABLE) out.push(['sem6', window.__CAB.CABLE.src.x, window.__CAB.CABLE.src.z, 0, 1, 80, 40]);
            if (d.GATE) { const g = d.GATE.p; out.push(['porton', (g[0].x + g[1].x) / 2, (g[0].z + g[1].z) / 2, 0, 1, 120, 50]); }
            const F = d.FREE0; if (F) out.push(['partida', F.x, F.z, 0, 1, 160, 90]);
            return out; }""")
        for nombre, x, z, fx, fz, dist, alt in vistas:
            await pg.evaluate("""([x, z, fx, fz, dist, alt]) => { const d = window.__d, H = d.H(x, z);
                const ax = fx || 0.7, az = fz || 0.7, n = Math.hypot(ax, az);
                d.camera.position.set(x - ax / n * dist, H + alt, z - az / n * dist); d.camera.lookAt(x, H + 4, z); d.camera.updateProjectionMatrix(); d.renderer.render(d.scene, d.camera); }""", [x, z, fx, fz, dist, alt])
            await pg.screenshot(path=OUT + r"\eq_" + nombre + ".png"); print("captura", nombre, round(x), round(z))
        print("errs", errs); await b.close()
asyncio.run(main())
