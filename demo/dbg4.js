const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  const token = await page.evaluate(() => document.querySelector('form').getAttribute('data-token'));
  const bodyText = await page.locator('body').innerText();
  const ip = (bodyText.match(/hosted by:\s*([0-9.]+)/) || [])[1];
  console.log('token?', !!token, 'ip:', ip);
  const resp = await page.request.post('https://tintajunta-sala.loca.lt/continue/' + token, { data: { endpoint: ip } });
  console.log('POST status:', resp.status(), (await resp.text()).slice(0, 100));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  console.log('title:', await page.title());
  console.log('nameInput:', await page.locator('#nameInput').count());
  await browser.close();
})();
