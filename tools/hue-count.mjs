// Dev tool: count a picture's colours by hue, as the cherry blossom valley's analysis does
// (docs/endless-world.md): the share of pink, red and warm brown, gold, green, blue, violet and grey, how
// much of it is bright, and its mean brightness. Each picture is read 320 pixels wide.
//   node tools/hue-count.mjs <picture> [<picture> ...]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
const b = await chromium.launch({ channel: 'chrome' }), p = await b.newPage();
for (const f of process.argv.slice(2)) {
  const url = 'data:image/png;base64,' + readFileSync(f).toString('base64');
  const r = await p.evaluate(async (url) => {
    const im = new Image(); im.src = url; await im.decode();
    const w = 320, h = Math.max(1, Math.round(320 * im.height / im.width)), c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d');
    g.drawImage(im, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, bins = { pink: 0, red: 0, gold: 0, green: 0, blue: 0, violet: 0, grey: 0 };
    let bright = 0, sum = 0; const n = w * h;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255, v = Math.max(R, G, B), m = Math.min(R, G, B), s = v ? (v - m) / v : 0;
      let hue = 0; if (v > m) { hue = v === R ? ((G - B) / (v - m)) % 6 : v === G ? (B - R) / (v - m) + 2 : (R - G) / (v - m) + 4; hue = (hue * 60 + 360) % 360; }
      sum += v; if (v > 0.8) bright++;
      bins[s < 0.12 || v < 0.15 ? 'grey' : hue >= 285 && hue < 350 ? 'pink' : hue >= 350 || hue < 40 ? 'red' : hue < 70 ? 'gold' : hue < 170 ? 'green' : hue < 250 ? 'blue' : 'violet']++;
    }
    return Object.entries(bins).map(([k, q]) => k + ' ' + Math.round(100 * q / n) + '%').join(' ') + ' · bright ' + Math.round(100 * bright / n) + '% · mean ' + (sum / n).toFixed(2);
  }, url);
  console.log(basename(f).slice(0, 34).padEnd(36), r);
}
await b.close();
