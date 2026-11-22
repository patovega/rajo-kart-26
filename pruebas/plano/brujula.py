# La brújula se ve con «federico vega» (modo prueba) y no con otro nombre.
import asyncio
from playwright.async_api import async_playwright
OUT = r"C:\Users\Usuario\AppData\Local\Temp\claude\0d8fb4b68261d687\0185a7f9-9f4b-4f28-ac0b-cded994cf449\scratchpad"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"])
        for nombre in ["federico vega", "juan perez"]:
            pg = await b.new_page(viewport={"width": 960, "height": 540}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto("http://127.0.0.1:8001/index.html"); await pg.wait_for_function("window.__d !== undefined", timeout=120000)
            await pg.fill("#pname", nombre); await pg.click("#goBtn"); await pg.wait_for_function("window.__d.mode === 'play'", timeout=120000); await pg.wait_for_timeout(2500)
            print(nombre, "brújula:", await pg.evaluate("() => getComputedStyle(document.getElementById('brujula')).display"), "errs", errs)
            await pg.screenshot(path=OUT + r"\brujula_" + nombre.split()[0] + ".png"); await pg.close()
        await b.close()
asyncio.run(main())
