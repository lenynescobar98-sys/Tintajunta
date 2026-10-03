const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 390, height: 844 },
    hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0,100)));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  await page.fill('#nameInput', 'KingTouch');
  await page.click('#joinBtn');
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForFunction(() => typeof netOnline !== 'undefined' && netOnline === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  console.log('1) dentro, lápiz:', await page.evaluate(() => document.getElementById('pencilBtn').classList.contains('on')));
  const cdp = await ctx.newCDPSession(page);
  await page.locator('.w').nth(30).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const a = await page.locator('.w').nth(30).boundingBox();
  const b = await page.locator('.w').nth(42).boundingBox();
  const x1 = a.x + a.width/2, y1 = a.y + a.height/2;
  const x2 = b.x + b.width/2, y2 = b.y + b.height/2;
  const t0 = Date.now();
  // Arrastre táctil RÁPIDO: sin los 450ms de espera de antes
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1, id: 1 }] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (x1+x2)/2, y: (y1+y2)/2, id: 1 }] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x2, y: y2, id: 1 }] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('2) gesto táctil completo en', Date.now() - t0, 'ms (antes exigía 450ms solo de espera)');
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => fetch('/api/rooms/SALA/state').then(r => r.json()));
  const mine = st.highlights.filter(h => h.name === 'KingTouch');
  console.log('3) subrayados guardados:', mine.length, mine.length ? `rango ${mine[0].start}-${mine[0].end}` : 'FALLO');
  // Verificar que un scroll vertical NO marca
  const n0 = st.highlights.length;
  const s1 = await page.locator('.w').nth(80).boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: s1.y, id: 2 }] });
  await page.waitForTimeout(50);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: s1.y - 120, id: 2 }] });
  await page.waitForTimeout(50);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(2000);
  const st2 = await page.evaluate(() => fetch('/api/rooms/SALA/state').then(r => r.json()));
  console.log('4) tras scroll vertical, subrayados:', st2.highlights.length, st2.highlights.length === n0 ? '(sin marcas falsas OK)' : 'FALLO');
  console.log('errores JS:', errs.length ? errs : 'ninguno');
  await browser.close();
})();
