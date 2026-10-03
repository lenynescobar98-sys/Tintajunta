const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  const res = await page.evaluate(async () => {
    const token = document.querySelector('form').getAttribute('data-token');
    const ip = (document.body.innerText.match(/hosted by:\s*([0-9.]+)/) || [])[1];
    const r = await fetch('/continue/' + token, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'endpoint=' + encodeURIComponent(ip) });
    return { status: r.status, body: (await r.text()).slice(0,60), cookies: document.cookie.slice(0,80) };
  });
  console.log(JSON.stringify(res));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  console.log('tras reload -> title:', await page.title(), '| nameInput:', await page.locator('#nameInput').count());
  console.log('cookies ahora:', (await page.evaluate(() => document.cookie)).slice(0, 100));
  await browser.close();
})();
