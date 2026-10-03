const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0,120)));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  await page.fill('#nameInput', 'KingLapiz');
  await page.click('#joinBtn');
  await page.waitForSelector('.w', { timeout: 15000 });
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected, null, { timeout: 20000 });
  console.log('lápiz activo?', await page.evaluate(() => document.getElementById('pencilBtn').classList.contains('on')));
  // arrastrar con lápiz: debe subrayar SIN mostrar la barra
  await page.locator('.w').nth(100).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const a = await page.locator('.w').nth(100).boundingBox();
  const b = await page.locator('.w').nth(115).boundingBox();
  await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({
    toolbarHidden: document.getElementById('toolbar').classList.contains('hidden'),
    painted: [...document.querySelectorAll('.w')].filter(s => s.style.background).length,
  }));
  console.log('barra oculta (debe ser true):', st.toolbarHidden, '| palabras pintadas:', st.painted);
  // verificar en el servidor
  const res = await page.evaluate(() => fetch('/api/state').then(r => r.json()));
  const mine = res.highlights.filter(h => h.name === 'KingLapiz');
  console.log('subrayados guardados de KingLapiz:', mine.length, mine.length ? `rango ${mine[0].start}-${mine[0].end}` : '');
  console.log('errores JS:', errs.length ? errs : 'ninguno');
  await browser.close();
})();
