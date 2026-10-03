const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let boots = 0;
  await page.exposeFunction('countBoot', () => { boots++; console.log('BOOT #' + boots, new Date().toISOString().slice(17)); });
  await page.addInitScript(() => {
    window.addEventListener('load', () => window.countBoot && window.countBoot());
  });
  page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('NAVEGACIÓN a:', f.url().slice(0, 60)); });
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  console.log('--- antes del clic, boots =', boots);
  await page.fill('#nameInput', 'KingObs');
  await page.click('#joinBtn');
  await page.waitForTimeout(8000);
  console.log('--- después del clic, boots =', boots);
  await browser.close();
})();
