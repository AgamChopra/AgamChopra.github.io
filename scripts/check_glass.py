"""Browser regression checks. Requires playwright and its installed browsers.
Run: python scripts/check_glass.py --browser all --protocol file --output /tmp/glass-checks
"""
import argparse
import asyncio
import functools
import http.server
import json
from pathlib import Path
import threading

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


async def check_browser(engine, name, url, output):
    options = {"args": ["--no-sandbox", "--enable-unsafe-swiftshader"]} if name == "chromium" else {}
    browser = await engine.launch(**options)
    try:
        for software in [False, True]:
            mode = "software" if software else "native"
            page = await browser.new_page(viewport={"width": 1440, "height": 1000})
            errors = []
            requests = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append(request.url))
            if software:
                await page.add_init_script("""const original = HTMLCanvasElement.prototype.getContext;
                    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                        return type === 'webgl' ? null : original.call(this, type, ...args);
                    };""")
            await page.goto(url, wait_until="networkidle")
            await page.wait_for_function("['canvas','webgl'].includes(document.documentElement.dataset.glass)")
            await page.wait_for_timeout(1200)
            backend = await page.get_attribute("html", "data-glass")
            assert backend == ("canvas" if software else "webgl"), (name, mode, backend)
            assert await page.locator(".hero-copy.glass-ready").count() == 1
            local_scene_loaded = await page.evaluate("Boolean(window.PortfolioGlass.localScenes)")
            assert local_scene_loaded == url.startswith("file:"), (name, mode, local_scene_loaded)
            if url.startswith("file:"):
                assert await page.evaluate("[...document.querySelectorAll('.landscape-image')].every(image => image.src.startsWith('data:image/webp;base64,'))")
            else:
                assert not any("/local-scenes.js" in request for request in requests)
            await page.screenshot(path=str(output / f"{name}-{mode}-light.png"))
            heading = page.locator("#experience .section-intro")
            await heading.scroll_into_view_if_needed()
            await page.wait_for_timeout(1200)
            assert "glass-ready" in await heading.get_attribute("class")
            await heading.screenshot(path=str(output / f"{name}-{mode}-experience.png"))
            await page.evaluate("scrollTo({top:0,behavior:'instant'})")
            await page.wait_for_timeout(700)
            await page.locator("#theme-toggle").click()
            await page.wait_for_function("document.documentElement.dataset.theme === 'dark' && ['canvas','webgl'].includes(document.documentElement.dataset.glass)")
            await page.wait_for_timeout(700)
            await page.screenshot(path=str(output / f"{name}-{mode}-dark.png"))
            await page.reload(wait_until="networkidle")
            await page.wait_for_function("document.documentElement.dataset.theme === 'dark' && ['canvas','webgl'].includes(document.documentElement.dataset.glass)")
            await page.locator("#publications").scroll_into_view_if_needed()
            await page.wait_for_timeout(1200)
            assert await page.locator(".publication-list .glass-ready").count() > 0
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.evaluate("scrollTo({top:0,behavior:'instant'})")
            await page.wait_for_timeout(1200)
            assert await page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            await page.screenshot(path=str(output / f"{name}-{mode}-mobile.png"))
            # Verify real rendered pixels change at the lens edge, not just CSS settings.
            await page.set_viewport_size({"width": 1440, "height": 1000})
            await page.evaluate("""async () => {
                const c=document.createElement('canvas');c.width=1000;c.height=666;
                const context=c.getContext('2d');const d=context.createImageData(c.width,c.height);
                for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
                    const i=(y*c.width+x)*4;const gray=128+70*Math.sin(x*.15)+35*Math.sin(y*.12);
                    d.data[i]=d.data[i+1]=d.data[i+2]=gray;d.data[i+3]=255;
                }
                context.putImageData(d,0,0);
                await Promise.all([...document.querySelectorAll('.landscape-image')].map(async image=>{
                    image.srcset='';image.src=c.toDataURL();await image.decode();
                }));
            }""")
            await page.wait_for_function("['canvas','webgl'].includes(document.documentElement.dataset.glass) && document.querySelector('.hero-copy').classList.contains('glass-ready')")
            await page.wait_for_timeout(1800)
            read = """() => {
                const e=document.querySelector('.hero-copy'),c=e.querySelector('canvas');
                return {data:c.getContext('2d').getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height,
                    edge:parseFloat(getComputedStyle(e).getPropertyValue('--glass-thickness'))*c.width/e.clientWidth};
            }"""
            await page.evaluate(f"window.lensPixels=({read})()")
            await page.evaluate("document.querySelector('.hero-copy').style.setProperty('--glass-chromatic','0');dispatchEvent(new Event('resize'))")
            await page.wait_for_timeout(700)
            await page.evaluate(f"window.neutralPixels=({read})()")
            await page.evaluate("document.querySelector('.hero-copy').style.setProperty('--glass-refraction','0');dispatchEvent(new Event('resize'))")
            await page.wait_for_timeout(700)
            await page.evaluate(f"window.flatPixels=({read})()")
            optics = await page.evaluate("""() => {
                const a=lensPixels,b=neutralPixels,c=flatPixels;let color=0,bend=0,center=0,n=0;
                for(let y=Math.floor(a.h*.3);y<a.h*.7;y++)for(let x=2;x<a.w-2;x++){
                    const i=(y*a.w+x)*4;
                    if(x<a.edge || x>a.w-a.edge){n++;color+=Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+2]-b.data[i+2]);bend+=Math.abs(b.data[i+1]-c.data[i+1]);}
                    else if(x>a.edge+10 && x<a.w-a.edge-10)center=Math.max(center,Math.abs(a.data[i]-c.data[i]));
                }
                return {chromaticDifference:color/n,refractionDifference:bend/n,centerDifference:center};
            }""")
            assert optics["chromaticDifference"] > 1, (name, mode, optics)
            assert optics["refractionDifference"] > 5, (name, mode, optics)
            assert optics["centerDifference"] <= 1, (name, mode, optics)
            await page.emulate_media(forced_colors="active", reduced_motion="reduce")
            await page.wait_for_timeout(400)
            assert await page.get_attribute("html", "data-glass") == "fallback"
            assert await page.locator(".hero-copy .glass-texture").is_hidden()
            assert not errors, errors
            print(json.dumps({"browser": name, "version": browser.version, "protocol": "file" if url.startswith("file:") else "http", "mode": mode, "backend": backend, "optics": optics, "result": "PASS"}), flush=True)
            await page.close()
    finally:
        await browser.close()


async def run(args, url):
    async with async_playwright() as playwright:
        names = ["firefox", "chromium", "webkit"] if args.browser == "all" else [args.browser]
        for name in names:
            await check_browser(getattr(playwright, name), name, url, args.output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", choices=["all", "firefox", "chromium", "webkit"], default="all")
    parser.add_argument("--protocol", choices=["http", "file"], default="http")
    parser.add_argument("--output", type=Path, default=Path("/tmp/glass-checks"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if args.protocol == "file":
        asyncio.run(run(args, (ROOT / "index.html").as_uri()))
        return
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            asyncio.run(run(args, f"http://127.0.0.1:{server.server_port}"))
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
