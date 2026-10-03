const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { timeout: 30000 });
  await page.waitForTimeout(2000);
  const html = await page.content();
  require('fs').writeFileSync('/tmp/interstitial.html', html);
  console.log('inputs:', await page.locator('input').count());
  for (let i = 0; i < await page.locator('input').count(); i++) {
    const el = page.locator('input').nth(i);
    console.log('input', i, await el.getAttribute('name'), await el.getAttribute('type'), await el.getAttribute('placeholder'));
  }
  console.log('buttons:', await page.locator('button').count());
  await browser.close();
})();
