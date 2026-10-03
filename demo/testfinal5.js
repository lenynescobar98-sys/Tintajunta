const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://hatch-runtime:f463927f7f0b48038b90992bf4de1d0b@hatch-egress-proxy:3128'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0,100)));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.book-card', { timeout: 30000 });
  await page.fill('#libNameInput', 'KingV2');
  await page.dispatchEvent('#libNameInput', 'change');
  await page.locator('.book-card button').first().click();
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForFunction(() => typeof netOnline !== 'undefined' && netOnline === true, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  // 1) marcar con arrastre táctil (CDP)
  const r1 = await page.evaluate(() => {
    const words = [...document.querySelectorAll('.w')];
    const a = words[10].getBoundingClientRect(), b = words[16].getBoundingClientRect();
    return { ax: a.x + a.width/2, ay: a.y + a.height/2, bx: b.x + b.width/2, by: b.y + b.height/2 };
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r1.ax, y: r1.ay, id: 1 }] });
  for (let i = 1; i <= 8; i++)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r1.ax + (r1.bx - r1.ax) * i/8, y: r1.ay, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(3000);
  const n1 = await page.evaluate(() => highlights.filter(h => h.name === 'KingV2').length);
  console.log('1) marcas creadas:', n1);
  // 2) pulsación larga sobre la marca para borrar
  const hp = await page.evaluate(() => {
    const w = document.querySelectorAll('.w')[12].getBoundingClientRect();
    return { x: w.x + w.width/2, y: w.y + w.height/2 };
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hp.x, y: hp.y, id: 2 }] });
  await page.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(3000);
  const n2 = await page.evaluate(() => highlights.filter(h => h.name === 'KingV2').length);
  console.log('2) tras pulsación larga:', n2, n2 === 0 ? 'OK BORRADO' : 'FALLO');
  // 3) tema blanco/oscuro
  const hasBtn = await page.evaluate(() => !!document.getElementById('themeBtn'));
  const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.evaluate(() => document.getElementById('themeBtn').click());
  await page.waitForTimeout(500);
  const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const dt = await page.evaluate(() => document.documentElement.dataset.theme);
  console.log('3) botón tema:', hasBtn, '| fondo antes:', bgBefore, '| después:', bgAfter, '| data-theme:', JSON.stringify(dt));
  console.log('errores JS:', errs.length ? errs : 'ninguno');
  await browser.close();
})();
