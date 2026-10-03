const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  console.log('input count:', await page.locator('input[placeholder*="203.0.113"]').count());
  const pw = (await (await fetch('https://loca.lt/mytunnelpassword')).text()).trim();
  console.log('password:', pw);
  await page.fill('input[placeholder*="203.0.113"]', pw);
  await page.waitForTimeout(500);
  await page.click('button');
  await page.waitForTimeout(4000);
  console.log('title now:', await page.title());
  console.log('nameInput:', await page.locator('#nameInput').count());
  console.log('url:', page.url());
  await browser.close();
})();
