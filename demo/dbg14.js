const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  await page.fill('#nameInput', 'KingLapiz2');
  await page.click('#joinBtn');
  await page.waitForSelector('.w', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const sock = await page.evaluate(() => ({ hasSocket: typeof socket !== 'undefined' && !!socket, connected: !!(typeof socket !== 'undefined' && socket && socket.connected) }));
  console.log('socket:', JSON.stringify(sock));
  const a = await page.locator('.w').nth(100).boundingBox();
  const b = await page.locator('.w').nth(115).boundingBox();
  await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const sel = await page.evaluate(() => {
    const s = window.getSelection();
    return { rc: s.rangeCount, collapsed: s.isCollapsed, text: s.toString().slice(0,40) };
  });
  console.log('selección tras mouseup:', JSON.stringify(sel));
  const log = require('fs').readFileSync('/tmp/tintajunta-client.log', 'utf8').split('\n').filter(l => l.includes('KingLapiz2') || l.includes('lápiz') || l.includes('showToolbar')).slice(-8);
  console.log('--- log cliente:'); log.forEach(l => console.log(l.slice(0, 110)));
  await browser.close();
})();
