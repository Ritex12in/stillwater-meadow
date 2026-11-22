// The film's sound: the game's own music and the meadow's sounds, recorded as they play (needs
// `npm run dev`). Two takes at the home lake: by day and by night (the music turns minor at night).
//   node tools/film/audio.mjs        writes e:/Games/_assets/film/audio-day.webm and audio-night.webm
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'e:/Games/_assets/film';
mkdirSync(OUT, { recursive: true });
const takes = [{ name: 'day', hour: 10, secs: 80 }, { name: 'night', hour: 22, secs: 34 }];
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const take of takes) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(`http://127.0.0.1:8080/?seed=1&weather=clear&season=summer&at=300,270#${take.hour}`);
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  // the boy at the water's edge, so the lake laps and the birds sing round him
  await page.evaluate(() => window.__meadow.travelTo(300, 270, 318, 261));
  await page.mouse.click(640, 400);
  await page.keyboard.press('KeyM'); // (sound and music on, as a player would: the M key)
  await page.waitForTimeout(500);
  const b64 = await page.evaluate(async (secs) => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes('/src/systems/audio.js'));
    const { audio } = await import(url);
    const dest = audio.ctx.createMediaStreamDestination();
    audio.master.connect(dest);
    const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 });
    const parts = [];
    rec.ondataavailable = (e) => parts.push(e.data);
    const done = new Promise((res) => { rec.onstop = res; });
    rec.start(1000);
    await new Promise((r) => setTimeout(r, secs * 1000));
    rec.stop(); await done;
    const buf = await new Blob(parts, { type: 'audio/webm' }).arrayBuffer();
    let s = ''; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, take.secs);
  writeFileSync(`${OUT}/audio-${take.name}.webm`, Buffer.from(b64, 'base64'));
  console.log(take.name, Math.round(b64.length * 0.75 / 1024), 'KB');
  await ctx.close();
}
await browser.close();
