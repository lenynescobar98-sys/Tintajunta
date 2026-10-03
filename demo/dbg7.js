const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  const bodyText = await page.locator('body').innerText();
  const ip = (bodyText.match(/hosted by:\s*([0-9.]+)/) || [])[1];
  console.log('IP que pide la página:', ip);
  await page.fill('input[placeholder*="203.0.113"]', ip);
  await page.click('button');
  await page.waitForTimeout(5000);
  console.log('title:', await page.title());
  console.log('nameInput:', await page.locator('#nameInput').count());
  await browser.close();
})();
