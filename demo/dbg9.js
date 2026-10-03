const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  const token = await page.evaluate(() => document.querySelector('form').getAttribute('data-token'));
  const bodyText = await page.locator('body').innerText();
  const ip = (bodyText.match(/hosted by:\s*([0-9.]+)/) || [])[1];
  console.log('token len:', token && token.length, '| ip:', ip);
  // POST desde Node con el token real
  const r = await fetch('https://tintajunta-sala.loca.lt/continue/' + token, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'endpoint=' + encodeURIComponent(ip),
  });
  console.log('POST:', r.status, (await r.text()).slice(0, 60));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  console.log('title:', await page.title(), '| nameInput:', await page.locator('#nameInput').count());
  await browser.close();
})();
