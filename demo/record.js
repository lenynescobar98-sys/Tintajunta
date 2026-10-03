'use strict';
/* Graba un video demo de la sala TintaJunta: entrar, subrayar, dejar nota. */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--proxy-server=http://127.0.0.1:9999'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    // UA neutro: el túnel muestra su página intermedia solo a navegadores
    userAgent: 'curl/8.5.0',
    recordVideo: { dir: __dirname + '/videos', size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  // Por la URL pública (el túnel): el Chromium automatizado bloquea localhost.
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#nameInput', { timeout: 30000 });

  // Entrar a la sala
  await page.fill('#nameInput', 'King');
  await page.click('#joinBtn');
  await page.waitForSelector('.w', { timeout: 15000 });
  await page.waitForTimeout(1200);

  // 1) Subrayar un pasaje arrastrando con el ratón
  async function dragSelect(from, to) {
    const a = await page.locator('.w').nth(from).boundingBox();
    const b = await page.locator('.w').nth(to).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
    await page.mouse.up();
  }
  await dragSelect(8, 30);
  await page.waitForSelector('#toolbar:not(.hidden)', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.click('#btnHighlight');
  await page.waitForTimeout(1800);

  // 2) Dejar una nota al margen en otro pasaje
  await dragSelect(60, 78);
  await page.waitForSelector('#toolbar:not(.hidden)', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.click('#btnNote');
  await page.waitForSelector('#notepop:not(.hidden)', { timeout: 8000 });
  await page.fill('#noteText', 'Así se ve una nota al margen (demo)');
  await page.waitForTimeout(500);
  await page.click('#noteSave');
  await page.waitForTimeout(2500);

  await context.close();
  await browser.close();
  console.log('VIDEO LISTO');
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
