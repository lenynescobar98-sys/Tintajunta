const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const page = await (await browser.newContext()).newPage();
  page.on('console', m => console.log('CONSOLE:', m.type(), m.text().slice(0,150)));
  page.on('dialog', async d => { console.log('DIALOG:', d.type(), d.message().slice(0,150)); await d.dismiss(); });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,150)));
  page.on('requestfailed', r => console.log('REQFAIL:', r.url().slice(0,80), r.failure()?.errorText));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  const bodyText = await page.locator('body').innerText();
  const ip = (bodyText.match(/hosted by:\s*([0-9.]+)/) || [])[1];
  await page.fill('input[placeholder*="203.0.113"]', ip);
  await page.click('button');
  await page.waitForTimeout(6000);
  console.log('title:', await page.title());
  await browser.close();
})();
