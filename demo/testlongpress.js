const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0,100)));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.book-card', { timeout: 30000 });
  await page.fill('#libNameInput', 'KingHold');
  await page.dispatchEvent('#libNameInput', 'change');
  await page.locator('.book-card button').first().click();
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForFunction(() => typeof netOnline !== 'undefined' && netOnline === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const myRoom = await page.evaluate(() => myRoom);
  // crear una marca con lápiz (toque simulado)
  const r1 = await page.evaluate(() => {
    const words = [...document.querySelectorAll('.w')];
    const a = words[10].getBoundingClientRect(), b = words[16].getBoundingClientRect();
    return { ax: a.x + a.width/2, ay: a.y + a.height/2, bx: b.x + b.width/2, by: b.y + b.height/2 };
  });
  await page.touchscreen.tap(r1.ax, r1.ay); // asegurar scroll
  // marcar con CDP (arrastre)
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r1.ax, y: r1.ay, id: 1 }] });
  for (let i = 1; i <= 10; i++)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r1.ax + (r1.bx - r1.ax) * i/10, y: r1.ay + (r1.by - r1.ay) * i/10, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(2500);
  let st = await page.evaluate((rm) => fetch('https://tintajunta-sala.loca.lt/api/rooms/' + rm + '/state').then(r => r.json()), myRoom);
  console.log('1) marcas:', st.highlights.filter(h => h.name === 'KingHold').length);
  // pulsación larga sobre la marca (600ms sin mover)
  const hp = await page.evaluate(() => {
    const w = document.querySelectorAll('.w')[12].getBoundingClientRect();
    return { x: w.x + w.width/2, y: w.y + w.height/2 };
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hp.x, y: hp.y, id: 2 }] });
  await page.waitForTimeout(700); // mantener 700ms
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(2500);
  st = await page.evaluate((rm) => fetch('https://tintajunta-sala.loca.lt/api/rooms/' + rm + '/state').then(r => r.json()), myRoom);
  console.log('2) tras pulsación larga, marcas:', st.highlights.filter(h => h.name === 'KingHold').length, '(debe ser 0)');
  // tema: verificar que el botón existe y cambia
  const themeBtn = await page.evaluate(() => !!document.getElementById('themeBtn'));
  console.log('3) botón tema existe:', themeBtn);
  const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#themeBtn');
  await page.waitForTimeout(400);
  const bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const themeAttr = await page.evaluate(() => document.documentElement.dataset.theme);
  console.log('4) fondo claro:', bgLight, '| fondo oscuro:', bgDark, '| data-theme:', themeAttr);
  console.log('errores JS:', errs.length ? errs : 'ninguno');
  await browser.close();
})();
