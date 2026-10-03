const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const page = await (await browser.newContext()).newPage();
  page.on('console', m => console.log('CONSOLE:', m.text().slice(0,120)));
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)));
  const r = await page.goto('https://tintajunta-sala.loca.lt/', { timeout: 30000 });
  console.log('status:', r.status());
  await page.waitForTimeout(4000);
  console.log('title:', await page.title());
  console.log('nameInput:', await page.locator('#nameInput').count());
  console.log('body snippet:', (await page.locator('body').innerText()).slice(0,150).replace(/\n/g,' | '));
  await browser.close();
})();
