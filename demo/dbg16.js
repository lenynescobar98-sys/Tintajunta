const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  await page.fill('#nameInput', 'KingDbg3');
  await page.click('#joinBtn');
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected, null, { timeout: 25000 });
  await page.locator('.w').nth(100).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const a = await page.locator('.w').nth(100).boundingBox();
  const b = await page.locator('.w').nth(115).boundingBox();
  console.log('coords a:', a ? `${Math.round(a.x)},${Math.round(a.y)}` : 'null', 'b:', b ? `${Math.round(b.x)},${Math.round(b.y)}` : 'null');
  await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const sel = await page.evaluate(() => ({ rc: window.getSelection().rangeCount, txt: window.getSelection().toString().slice(0, 50) }));
  console.log('selección después:', JSON.stringify(sel));
  const log = require('fs').readFileSync('/tmp/tintajunta-client.log', 'utf8').split('\n').filter(l => l.includes('lápiz') || l.includes('KingDbg3') && l.includes('rango')).slice(-6);
  console.log('--- log:'); log.forEach(l => console.log(l.slice(0, 120)));
  await browser.close();
})();
