const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const fails = [];
  page.on('requestfailed', r => fails.push(r.url().slice(-40) + ' :: ' + (r.failure()||{}).errorText));
  page.on('response', r => { if (!r.ok()) console.log('HTTP', r.status(), r.url().slice(-50)); });
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('título:', await page.title());
  try {
    await page.waitForSelector('#nameInput', { timeout: 20000 });
    console.log('join OK');
    await page.fill('#nameInput', 'KingDbg');
    await page.click('#joinBtn');
    await page.waitForSelector('.w', { timeout: 20000 });
    console.log('texto OK, palabras:', await page.locator('.w').count());
  } catch (e) {
    console.log('FALLO:', e.message.split('\n')[0]);
    console.log('contenido #paras:', (await page.evaluate(() => document.getElementById('paras')?.innerHTML.slice(0, 200) || 'SIN #paras')));
    console.log('URL actual:', page.url());
  }
  console.log('peticiones fallidas:', fails.length ? fails : 'ninguna');
  await browser.close();
})();
