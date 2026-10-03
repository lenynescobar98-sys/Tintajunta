(async () => {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--proxy-server=http://127.0.0.1:9999'] });
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto('https://tintajunta-sala.loca.lt/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1500);
  const token = await p.evaluate(() => document.querySelector('form').getAttribute('data-token'));
  const bodyText = await p.locator('body').innerText();
  const ip = (bodyText.match(/hosted by:\s*([0-9.]+)/) || [])[1];
  await browser.close();
  const r = await fetch('https://tintajunta-sala.loca.lt/continue/' + token, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'endpoint=' + encodeURIComponent(ip),
  });
  const txt = await r.text();
  const cookies = r.headers.getSetCookie();
  console.log('POST', r.status, txt.slice(0, 40), '| cookies:', cookies.length);
  require('fs').writeFileSync('/tmp/lt-cookie.json', JSON.stringify({ cookies }));
})();
