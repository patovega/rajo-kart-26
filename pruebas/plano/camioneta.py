# Vistas de cerca de la camioneta (3/4 adelante, costado, atrás) y de un CAEX cargado con material fino.
import asyncio
from playwright.async_api import async_playwright
OUT = r"C:\Users\Usuario\AppData\Local\Temp\claude\0d8fb4b68261d687\0185a7f9-9f4b-4f28-ac0b-cded994cf449\scratchpad"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"]); pg = await b.new_page(viewport={"width": 900, "height": 560})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://127.0.0.1:8001/index.html"); await pg.wait_for_function("window.__d !== undefined", timeout=120000)
        await pg.fill("#pname", "juan perez"); await pg.click("#goBtn"); await pg.wait_for_function("window.__d.mode === 'play'", timeout=120000)
        await pg.evaluate("async () => { window.__E = await import('./js/juego/estado.js'); window.requestAnimationFrame = () => 0; }"); await pg.wait_for_timeout(800)
        for nombre, ang, dist, alt in [("adelante", 0.65, 7.5, 2.2), ("costado", 1.5708, 8, 1.6), ("atras", 3.5, 8, 2.6)]:
            await pg.evaluate("""([ang, dist, alt]) => { const d = window.__d, pk = window.__E.pickup, q = pk.position, f = new THREE.Vector3(0, 0, 1).applyQuaternion(pk.quaternion);
                const a = Math.atan2(f.x, f.z) + ang; d.camera.position.set(q.x + Math.sin(a) * dist, q.y + alt, q.z + Math.cos(a) * dist); d.camera.lookAt(q.x, q.y + 1.0, q.z); d.renderer.render(d.scene, d.camera); }""", [ang, dist, alt])
            await pg.screenshot(path=OUT + r"\pk_" + nombre + ".png")
        await pg.evaluate("""() => { const d = window.__d, t = window.__E.trucks[0]; if (!t) return; const q = t.mesh.position, f = new THREE.Vector3(0, 0, 1).applyQuaternion(t.mesh.quaternion);
            d.camera.position.set(q.x - f.x * 16 + f.z * 10, q.y + 13, q.z - f.z * 16 - f.x * 10); d.camera.lookAt(q.x, q.y + 6, q.z); d.renderer.render(d.scene, d.camera); }""")
        await pg.screenshot(path=OUT + r"\pk_caex_fino.png")
        print("errs", errs); await b.close()
asyncio.run(main())
