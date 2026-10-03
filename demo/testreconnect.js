const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext({ userAgent: 'curl/8.5.0', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0,100)));
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });
  await page.fill('#nameInput', 'KingRCon');
  await page.click('#joinBtn');
  await page.waitForSelector('.w', { timeout: 30000 });
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected, null, { timeout: 25000 });
  console.log('1) conectado inicial OK');
  // simular el corte del túnel: desconectar y reconectar
  await page.evaluate(() => { window.__sid1 = socket.id; socket.disconnect(); });
  await page.waitForTimeout(800);
  await page.evaluate(() => socket.connect());
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && socket.id !== window.__sid1, null, { timeout: 25000 });
  await page.waitForTimeout(1500); // dar tiempo al re-join
  console.log('2) reconectado con re-join OK');
  // marcar con lápiz tras la reconexión
  await page.locator('.w').nth(100).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const a = await page.locator('.w').nth(100).boundingBox();
  const b = await page.locator('.w').nth(112).boundingBox();
  await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => fetch('/api/state').then(r => r.json()));
  const mine = st.highlights.filter(h => h.name === 'KingRCon');
  console.log('3) subrayados guardados tras reconexión:', mine.length, mine.length ? `rango ${mine[0].start}-${mine[0].end}` : 'FALLO');
  const painted = await page.evaluate(() => [...document.querySelectorAll('.w')].filter(s => s.style.background).length);
  console.log('4) palabras pintadas en pantalla:', painted);
  console.log('errores JS:', errs.length ? errs : 'ninguno');
  await browser.close();
})();
