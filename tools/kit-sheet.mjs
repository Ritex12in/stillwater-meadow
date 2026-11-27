// Dev tool: what in the game is not made in code, as two picture sheets (needs `npm run dev`):
//   not-coded-models.png    every downloaded model the game loads (tools/studio/kit.html draws them)
//   not-coded-pictures.png  every downloaded picture file: the ground's textures and the models' own
// Both go to e:/Games/_assets/previews/.   node tools/kit-sheet.mjs
import { chromium } from 'playwright';
import { writeFileSync, readdirSync } from 'node:fs';
const OUT = 'e:/Games/_assets/previews/';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8080/tools/studio/kit.html');
await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
writeFileSync(OUT + 'not-coded-models.png', Buffer.from((await p.evaluate(() => window.__sheet)).split(',')[1], 'base64'));
console.log((await p.evaluate(() => window.__names)).length, 'models -> not-coded-models.png');

const files = [];
for (const dir of ['ground', 'nature', 'meadow', 'props']) for (const f of readdirSync('public/assets/' + dir)) if (/\.(png|jpe?g)$/i.test(f)) files.push(dir + '/' + f);
const png = await p.evaluate(async (files) => {
  const T = 230, cols = 6, rows = Math.ceil(files.length / cols), cv = document.createElement('canvas');
  cv.width = cols * T; cv.height = rows * (T + 24) + 36;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#12181c'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#f7f4ec'; ctx.font = '600 17px sans-serif'; ctx.fillText(`Downloaded picture files in the game (${files.length}): the ground's textures, and the textures the downloaded models wear`, 8, 22);
  for (let i = 0; i < files.length; i++) {
    const im = new Image(); im.src = '/assets/' + files[i]; await im.decode();
    const x = (i % cols) * T, y = 36 + Math.floor(i / cols) * (T + 24), k = Math.min((T - 8) / im.width, (T - 8) / im.height);
    ctx.fillStyle = '#7d8a8f'; ctx.fillRect(x + 4, y + 4, im.width * k, im.height * k); // (grey behind what is see-through)
    ctx.drawImage(im, x + 4, y + 4, im.width * k, im.height * k);
    ctx.fillStyle = '#f7f4ec'; ctx.font = '12px sans-serif'; ctx.fillText(files[i], x + 6, y + T + 14);
  }
  return cv.toDataURL('image/png');
}, files);
writeFileSync(OUT + 'not-coded-pictures.png', Buffer.from(png.split(',')[1], 'base64'));
console.log(files.length, 'pictures -> not-coded-pictures.png');
await b.close();
