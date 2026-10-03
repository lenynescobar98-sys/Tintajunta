const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0,100)));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#library:not(.hidden)', { timeout: 30000 });
  await page.waitForSelector('.book-card', { timeout: 20000 });
  const nBooks = await page.locator('.book-card').count();
  console.log('1) biblioteca visible, libros:', nBooks);
  // nombre
  await page.fill('#libNameInput', 'KingLib');
  await page.dispatchEvent('#libNameInput', 'change');
  // abrir el libro gratis (primero)
  await page.locator('.book-card button').first().click();
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForFunction(() => typeof netOnline !== 'undefined' && netOnline === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const title = await page.evaluate(() => document.getElementById('chapterTitle').textContent);
  const roomLabel = await page.evaluate(() => document.getElementById('roomLabel').textContent);
  console.log('2) libro abierto:', title.slice(0, 30), '| etiqueta:', roomLabel.slice(0, 40));
  // marcar en el libro
  await page.locator('.w').nth(20).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const a = await page.locator('.w').nth(20).boundingBox();
  const b = await page.locator('.w').nth(28).boundingBox();
  await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  const myRoom = await page.evaluate(() => myRoom);
  const st = await page.evaluate((rm) => fetch('/api/rooms/' + rm + '/state').then(r => r.json()), myRoom);
  const mine = st.highlights.filter(h => h.name === 'KingLib');
  console.log('3) marca en libro guardada:', mine.length > 0 ? `SÍ (${mine[0].start}-${mine[0].end}) en sala ${myRoom}` : 'FALLO');
  // volver a la biblioteca
  await page.click('#backBtn');
  await page.waitForSelector('#library:not(.hidden)', { timeout: 10000 });
  console.log('4) de vuelta en biblioteca OK');
  console.log('errores JS:', errs.length ? errs : 'ninguno');
  await browser.close();
})();
