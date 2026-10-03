const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('NAV:', new Date().toISOString().slice(17), f.url().slice(0, 55)); });
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  await page.fill('#nameInput', 'KingRCon2');
  console.log('fill hecho');
  await page.click('#joinBtn');
  console.log('clic hecho');
  await page.waitForSelector('.w', { timeout: 30000 });
  console.log('.w listo');
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected, null, { timeout: 25000 });
  console.log('socket conectado');
  await page.waitForTimeout(3000);
  const n = await page.evaluate(() => window.__bootCount || 'sin contador');
  console.log('fin, boots:', n);
  await browser.close();
})();
