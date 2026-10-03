const { chromium } = require('playwright-core');
(async () => {
  const px = new URL(process.env.https_proxy || process.env.HTTPS_PROXY);
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({
    proxy: { server: `${px.protocol}//${px.hostname}:${px.port}`,
             username: decodeURIComponent(px.username), password: decodeURIComponent(px.password) },
  });
  const page = await ctx.newPage();
  for (const u of ['https://example.com/', 'https://tintajunta-sala.loca.lt/']) {
    try { const r = await page.goto(u, { timeout: 25000 }); console.log(u, '->', r.status()); }
    catch (e) { console.log(u, 'FALLO:', e.message.split('\n')[0]); }
  }
  await browser.close();
})();
