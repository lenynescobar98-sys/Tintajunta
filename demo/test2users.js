const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const mk = async (name) => {
    const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#nameInput', { timeout: 30000 });
    await page.fill('#nameInput', name);
    await page.click('#joinBtn');
    await page.waitForSelector('.w', { timeout: 30000 });
    await page.waitForFunction(() => typeof netOnline !== 'undefined' && netOnline === true, null, { timeout: 30000 });
    return page;
  };
  const a = await mk('Ana');
  const b = await mk('Beto');
  console.log('1) dos usuarios dentro');
  // Ana marca con lápiz
  await a.locator('.w').nth(40).scrollIntoViewIfNeeded();
  await a.waitForTimeout(800);
  const x1 = await a.locator('.w').nth(40).boundingBox();
  const x2 = await a.locator('.w').nth(50).boundingBox();
  await a.mouse.move(x1.x + x1.width/2, x1.y + x1.height/2);
  await a.mouse.down();
  await a.mouse.move(x2.x + x2.width/2, x2.y + x2.height/2, { steps: 15 });
  await a.mouse.up();
  await a.waitForTimeout(1500);
  // Beto espera el sondeo y verifica
  await b.waitForTimeout(4000);
  const seen = await b.evaluate(() => [...document.querySelectorAll('.w')].filter(s => s.style.background).length);
  const roster = await b.evaluate(() => document.getElementById('presence').textContent);
  console.log('2) Beto ve palabras pintadas:', seen, '| presencia:', roster.trim().slice(0, 60));
  console.log(seen > 0 ? 'SINCRONIZACIÓN OK' : 'FALLO DE SINCRONIZACIÓN');
  await browser.close();
})();
