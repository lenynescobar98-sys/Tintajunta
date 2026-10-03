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
  await page.fill('#libNameInput', 'KingAutor');
  await page.dispatchEvent('#libNameInput', 'change');
  // publicar
  await page.click('#publishBtn');
  await page.waitForSelector('#publishPop:not(.hidden)', { timeout: 5000 });
  await page.fill('#pubTitle', 'Mi primer cuento');
  await page.fill('#pubPrice', '1.99');
  await page.fill('#pubText', 'Había una vez un lápiz mágico.\n\nEl lápiz pintaba historias en el aire.\n\nY todos podían verlas.');
  await page.click('#pubSave');
  await page.waitForTimeout(3000);
  const nBooks = await page.locator('.book-card').count();
  const titles = await page.locator('.book-card h3').allTextContents();
  console.log('1) libros tras publicar:', nBooks, '| títulos:', titles.join(' | ').slice(0, 80));
  // comprar el libro de pago (La tinta compartida, $2.99)
  const cards = await page.locator('.book-card').all();
  let buyIdx = -1;
  for (let i = 0; i < cards.length; i++) {
    const btn = await cards[i].locator('button').textContent();
    const price = await cards[i].locator('.book-price').textContent();
    if (btn === 'Ver' && price.includes('$')) { buyIdx = i; break; }
  }
  console.log('2) libro de pago encontrado en índice:', buyIdx);
  if (buyIdx >= 0) {
    await cards[buyIdx].locator('button').click();
    await page.waitForSelector('#buyPop:not(.hidden)', { timeout: 5000 });
    const bp = await page.evaluate(() => document.getElementById('buyPrice').textContent);
    console.log('3) modal de compra, precio:', bp);
    await page.click('#buyConfirm');
    await page.waitForSelector('.w', { timeout: 30000 });
    console.log('4) compra simulada OK, libro abierto para leer');
  }
  console.log('errores JS:', errs.length ? errs : 'ninguno');
  await browser.close();
})();
