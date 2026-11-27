// Dev tool: pictures of the downloaded pines beside the pines grown from code (tools/studio/pines.html), in a row of five and one of each close up, for both kinds. Needs `npm run dev`. Pictures go to e:/Games/_assets/previews/ (pine-compare*.png, slimpine-compare*.png).
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1500, height: 820 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 300)); });
for (const [q, name] of [['kind=Pine', 'pine-compare'], ['kind=Pine&close=1', 'pine-compare-close'], ['kind=SlimPine', 'slimpine-compare'], ['kind=SlimPine&close=1', 'slimpine-compare-close']]) {
  await p.goto('http://127.0.0.1:8080/tools/studio/pines.html?' + q);
  await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await p.screenshot({ path: 'e:/Games/_assets/previews/' + name + '.png' });
  console.log(name, JSON.stringify(await p.evaluate(() => window.__info)));
}
await b.close();
