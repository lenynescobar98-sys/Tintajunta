const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);
  const token = await page.evaluate(() => document.querySelector('form').getAttribute('data-token'));
  const ip = ((await page.locator('body').innerText()).match(/hosted by:\s*([0-9.]+)/) || [])[1];
  // POST con curl para ver cabeceras crudas
  const { execSync } = require('child_process');
  const out = execSync(`curl -s -i --max-time 20 -X POST https://tintajunta-sala.loca.lt/continue/${token} -d "endpoint=${ip}"`).toString();
  console.log(out.slice(0, 900));
  await browser.close();
})();
