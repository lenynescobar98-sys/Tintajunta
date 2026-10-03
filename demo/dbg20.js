const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 390, height: 844 },
    hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  await page.fill('#nameInput', 'KingDbgT2');
  await page.click('#joinBtn');
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    window.__mdbg = [];
    document.addEventListener('touchmove', (e) => {
      window.__mdbg.push({ t: e.touches.length, x: Math.round(e.touches[0].clientX), y: Math.round(e.touches[0].clientY) });
    }, { passive: true });
    window.__modedbg = [];
    const orig = window.__origStartMarking;
  });
  const cdp = await ctx.newCDPSession(page);
  await page.locator('.w').nth(30).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const a = await page.locator('.w').nth(30).boundingBox();
  const b = await page.locator('.w').nth(42).boundingBox();
  const x1 = a.x + a.width/2, y1 = a.y + a.height/2;
  const x2 = b.x + b.width/2, y2 = b.y + b.height/2;
  console.log('de', Math.round(x1), Math.round(y1), 'a', Math.round(x2), Math.round(y2));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1, id: 1 }] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (x1+x2)/2, y: (y1+y2)/2, id: 1 }] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x2, y: y2, id: 1 }] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(800);
  const moves = await page.evaluate(() => window.__mdbg);
  console.log('touchmove recibidos:', moves.length, JSON.stringify(moves.slice(0, 4)));
  console.log('modo táctil ahora:', await page.evaluate(() => typeof touchMode !== 'undefined' ? 'n/a' : 'n/a'));
  await browser.close();
})();
