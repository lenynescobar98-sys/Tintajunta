const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 390, height: 844 },
    hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  await page.fill('#nameInput', 'KingDbgT');
  await page.click('#joinBtn');
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForTimeout(2000);
  // instrumentar el touchstart
  await page.evaluate(() => {
    window.__touchdbg = [];
    document.getElementById('paras').addEventListener('touchstart', (e) => {
      window.__touchdbg.push({
        touches: e.touches.length,
        target: e.target.tagName + '.' + (e.target.className || '').toString().slice(0, 20),
        closestW: !!(e.target.closest && e.target.closest('.w')),
        x: e.touches[0] ? Math.round(e.touches[0].clientX) : null,
        y: e.touches[0] ? Math.round(e.touches[0].clientY) : null,
      });
    }, { passive: true });
  });
  const cdp = await ctx.newCDPSession(page);
  await page.locator('.w').nth(30).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const a = await page.locator('.w').nth(30).boundingBox();
  console.log('palabra 30 en:', Math.round(a.x), Math.round(a.y), 'tamaño:', Math.round(a.width), 'x', Math.round(a.height));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x + a.width/2, y: a.y + a.height/2, id: 1 }] });
  await page.waitForTimeout(300);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);
  console.log('eventos capturados:', JSON.stringify(await page.evaluate(() => window.__touchdbg)));
  await browser.close();
})();
