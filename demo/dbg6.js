(async () => {
  // 1) GET interstitial con node para ver si pone cookie de sesión
  const r1 = await fetch('https://tintajunta-sala.loca.lt/');
  console.log('GET cookies:', r1.headers.getSetCookie().length);
  const html = await r1.text();
  const token = (html.match(/data-token="([^"]+)"/) || [])[1];
  console.log('token?', !!token, '| es interstitial?', html.includes('Tunnel website ahead'));
  // 2) POST con las cookies del GET
  const jar = r1.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  console.log('jar:', jar.slice(0, 60));
  const r2 = await fetch('https://tintajunta-sala.loca.lt/continue/' + token, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': jar },
    body: 'endpoint=87.81.231.88',
  });
  console.log('POST', r2.status, (await r2.text()).slice(0, 40));
  console.log('POST cookies:', JSON.stringify(r2.headers.getSetCookie()).slice(0, 200));
  // 3) GET de nuevo con todas las cookies
  const jar2 = jar + '; ' + r2.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const r3 = await fetch('https://tintajunta-sala.loca.lt/', { headers: { 'Cookie': jar2 } });
  const h3 = await r3.text();
  console.log('GET2 es app?', h3.includes('id="nameInput"'), '| es interstitial?', h3.includes('Tunnel website ahead'));
})();
