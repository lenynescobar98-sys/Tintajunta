const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', m => console.log('CONSOLE:', m.text().slice(0,130)));
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  await page.fill('#nameInput', 'King');
  await page.click('#joinBtn');
  await page.waitForSelector('.w', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const a = await page.locator('.w').nth(8).boundingBox();
  const b = await page.locator('.w').nth(30).boundingBox();
  console.log('word8 box:', JSON.stringify(a), 'word30 box:', JSON.stringify(b));
  await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const sel = await page.evaluate(() => {
    const s = window.getSelection();
    return { rangeCount: s.rangeCount, collapsed: s.isCollapsed,
      text: s.toString().slice(0, 60),
      anchorNode: s.anchorNode ? s.anchorNode.nodeName + '#' + s.anchorNode.nodeType : null,
      anchorParent: s.anchorNode && s.anchorNode.parentElement ? s.anchorNode.parentElement.className : null };
  });
  console.log('selection:', JSON.stringify(sel));
  console.log('toolbar hidden?', await page.locator('#toolbar.hidden').count());
  await browser.close();
})();
