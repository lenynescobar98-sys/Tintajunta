const { chromium } = require('playwright-core');
(async () => {
  const px = new URL(process.env.https_proxy);
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--log-net-log=/tmp/netlog.json','--net-log-capture-mode=Everything'] });
  const ctx = await browser.newContext({ proxy: { server: `${px.protocol}//${px.hostname}:${px.port}`,
    username: decodeURIComponent(px.username), password: decodeURIComponent(px.password) } });
  const page = await ctx.newPage();
  try { await page.goto('https://example.com/', { timeout: 20000 }); console.log('OK'); }
  catch (e) { console.log('FALLO:', e.message.split('\n')[0]); }
  await browser.close();
})();
