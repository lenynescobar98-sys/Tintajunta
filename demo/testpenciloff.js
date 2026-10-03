const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0,100)));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.book-card', { timeout: 30000 });
  await page.fill('#libNameInput', 'KingOff');
  await page.dispatchEvent('#libNameInput', 'change');
  await page.locator('.book-card button').first().click();
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForFunction(() => typeof netOnline !== 'undefined' && netOnline === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  // apagar el lápiz
  await page.click('#pencilBtn');
  await page.waitForTimeout(500);
  const off = await page.evaluate(() => !document.getElementById('pencilBtn').classList.contains('on'));
  console.log('1) lápiz apagado:', off);
  const hint = await page.evaluate(() => document.querySelector('.hint').textContent.slice(0, 40));
  console.log('2) ayuda:', hint);
  // intentar marcar con ratón
  await page.locator('.w').nth(20).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const a = await page.locator('.w').nth(20).boundingBox();
  const b = await page.locator('.w').nth(28).boundingBox();
  await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(2000);
  const tbHidden = await page.evaluate(() => document.getElementById('toolbar').classList.contains('hidden'));
  const myRoom = await page.evaluate(() => myRoom);
  const st = await page.evaluate((rm) => fetch('/api/rooms/' + rm + '/state').then(r => r.json()), myRoom);
  const mine = st.highlights.filter(h => h.name === 'KingOff');
  console.log('3) barra oculta:', tbHidden, '| marcas guardadas:', mine.length, mine.length === 0 ? 'OK (nada)' : 'FALLO');
  // volver a prender y marcar
  await page.click('#pencilBtn');
  await page.waitForTimeout(500);
  await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  const st2 = await page.evaluate((rm) => fetch('/api/rooms/' + rm + '/state').then(r => r.json()), myRoom);
  const mine2 = st2.highlights.filter(h => h.name === 'KingOff');
  console.log('4) lápiz prendido, marcas:', mine2.length, mine2.length > 0 ? 'OK' : 'FALLO');
  console.log('errores JS:', errs.length ? errs : 'ninguno');
  await browser.close();
})();
