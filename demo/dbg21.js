const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.book-card', { timeout: 30000 });
  await page.fill('#libNameInput', 'KingDbgO');
  await page.dispatchEvent('#libNameInput', 'change');
  await page.locator('.book-card button').first().click();
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForFunction(() => typeof netOnline !== 'undefined' && netOnline === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  console.log('pencil inicial:', await page.evaluate(() => typeof pencilMode !== 'undefined' ? pencilMode : 'n/a'));
  await page.click('#pencilBtn');
  await page.waitForTimeout(300);
  console.log('tras apagar:', await page.evaluate(() => pencilMode));
  await page.click('#pencilBtn');
  await page.waitForTimeout(300);
  console.log('tras prender:', await page.evaluate(() => pencilMode));
  console.log('localStorage:', await page.evaluate(() => localStorage.getItem('tj_pencil')));
  await browser.close();
})();
