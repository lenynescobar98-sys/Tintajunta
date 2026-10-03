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
  await page.fill('#libNameInput', 'KingBorr');
  await page.dispatchEvent('#libNameInput', 'change');
  await page.locator('.book-card button').first().click();
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForFunction(() => typeof netOnline !== 'undefined' && netOnline === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const myRoom = await page.evaluate(() => myRoom);
  // 1) marcar dos pasajes con lápiz
  for (const [s, e] of [[10, 16], [30, 36]]) {
    await page.locator('.w').nth(s).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const a = await page.locator('.w').nth(s).boundingBox();
    const b = await page.locator('.w').nth(e).boundingBox();
    await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1500);
  }
  let st = await page.evaluate((rm) => fetch('/api/rooms/' + rm + '/state').then(r => r.json()), myRoom);
  console.log('1) marcas creadas:', st.highlights.filter(h => h.name === 'KingBorr').length);
  // 2) activar borrador y tocar una marca
  await page.click('#eraserBtn');
  await page.waitForTimeout(400);
  const erOn = await page.evaluate(() => document.getElementById('eraserBtn').classList.contains('on'));
  console.log('2) borrador activo:', erOn);
  const w = await page.locator('.w').nth(12).boundingBox();
  await page.mouse.click(w.x + w.width/2, w.y + w.height/2);
  await page.waitForTimeout(2000);
  st = await page.evaluate((rm) => fetch('/api/rooms/' + rm + '/state').then(r => r.json()), myRoom);
  console.log('3) tras tocar con borrador, marcas:', st.highlights.filter(h => h.name === 'KingBorr').length, '(debe ser 1)');
  // 3) arrastrar el borrador sobre la otra marca
  const c = await page.locator('.w').nth(30).boundingBox();
  const d = await page.locator('.w').nth(36).boundingBox();
  await page.mouse.move(c.x + c.width/2, c.y + c.height/2);
  await page.mouse.down();
  await page.mouse.move(d.x + d.width/2, d.y + d.height/2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  st = await page.evaluate((rm) => fetch('/api/rooms/' + rm + '/state').then(r => r.json()), myRoom);
  console.log('4) tras arrastrar borrador, marcas:', st.highlights.filter(h => h.name === 'KingBorr').length, '(debe ser 0)');
  console.log('errores JS:', errs.length ? errs : 'ninguno');
  await browser.close();
})();
