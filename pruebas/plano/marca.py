# Marcadores de prueba (postes de colores) en puntos candidatos, con la misma vista que la captura del usuario (cancha 381, 148).
import asyncio, sys, json
from playwright.async_api import async_playwright
OUT = r"C:\Users\Usuario\AppData\Local\Temp\claude\0d8fb4b68261d687\0185a7f9-9f4b-4f28-ac0b-cded994cf449\scratchpad"
PTS = json.loads(sys.argv[1]) if len(sys.argv) > 1 else [[430, 40, "red"], [380, 60, "blue"], [470, 0, "lime"], [420, 100, "magenta"], [330, 40, "cyan"]]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"]); pg = await b.new_page(viewport={"width": 1100, "height": 620})
        await pg.goto("http://127.0.0.1:8001/index.html"); await pg.wait_for_function("window.__d !== undefined", timeout=120000)
        await pg.fill("#pname", "juan perez"); await pg.click("#goBtn"); await pg.wait_for_function("window.__d.mode === 'play'", timeout=120000)
        await pg.evaluate("() => { window.requestAnimationFrame = () => 0; }"); await pg.wait_for_timeout(800)
        info = await pg.evaluate("""(pts) => { const d = window.__d, out = [];
            for (const [x, z, c] of pts) { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 40, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, d.H(x, z) + 20, z); d.scene.add(m);
              const ix = Math.round((x - d.GX0) / d.CELL), iz = Math.round((z - d.GZ0) / d.CELL); out.push([c, x, z, +d.H(x, z).toFixed(1), d.GD[iz * d.GNX + ix]]); }
            const x = 381, z = 148, H = d.H(x, z), ax = 0.7, az = 1, n = Math.hypot(ax, az);
            d.camera.position.set(x - ax / n * 220, H + 160, z - az / n * 220); d.camera.lookAt(x, H + 4, z); d.renderer.render(d.scene, d.camera); return out; }""", PTS)
        for r in info: print(r)
        await pg.screenshot(path=OUT + r"\marca.png"); await b.close()
asyncio.run(main())
