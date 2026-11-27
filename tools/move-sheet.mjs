// Dev tool: picture sheets of the player's moves (characters/moves.js), for judging the animation:
// each move is played in the game as it is and its frames set side by side, seen from the side.
//   node tools/move-sheet.mjs [name ...]     (dev server running; sheets go to e:/Games/_assets/previews/move-<name>.png)
//   names: jump runjump heavy roll climb slide glide
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const want = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8080/?seed=7&weather=clear&season=summer&glider=1#11');
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
await p.waitForTimeout(2500);
await p.mouse.click(640, 360); // (focus, so held keys count)
await p.keyboard.press('Escape');

/** Play a move and gather its frames: `every` seconds apart, `n` of them, cropped round you. */
const film = (name, o) => p.evaluate(async ([name, o]) => {
  const m = window.__meadow, P = m.player, cv = document.querySelector('canvas'), W = o.crop || 300, cols = o.cols || 6;
  const sheet = document.createElement('canvas'); sheet.width = W * cols; sheet.height = (W + 22) * Math.ceil(o.n / cols) + 30;
  const ctx = sheet.getContext('2d'); ctx.fillStyle = '#12181c'; ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = '#f7f4ec'; ctx.font = '600 16px sans-serif'; ctx.fillText(o.title, 8, 20);
  const side = () => { m.camState.yaw = o.yaw !== undefined ? o.yaw : P.rot + Math.PI + (o.angle === undefined ? Math.PI * 0.62 : o.angle); m.camState.pitch = o.pitch === undefined ? 0.12 : o.pitch; m.camState.dist = o.dist || 5; };
  side();
  await new Promise((r) => setTimeout(r, o.settle || 700));
  let k = 0;
  const t0 = performance.now();
  await new Promise((done) => {
    const grab = () => {
      if (o.follow !== false) side();
      const t = (performance.now() - t0) / 1000;
      if (t >= k * o.every) {
        const s = cv.width / cv.clientWidth, cw = W * 1.5 * s, x = (k % cols) * W, y = 30 + Math.floor(k / cols) * (W + 22);
        ctx.drawImage(cv, cv.width / 2 - cw / 2, cv.height / 2 - cw / 2 + cw * (o.low === undefined ? 0.1 : o.low), cw, cw, x, y, W, W);
        ctx.fillStyle = '#f7f4ec'; ctx.font = '12px sans-serif'; ctx.fillText(t.toFixed(2) + ' s · ' + (m.moves.mode || (m.moves.rolling ? 'roll' : m.moves.landing ? 'land' : 'ground')), x + 6, y + W + 15);
        k++;
      }
      if (k >= o.n) done(); else requestAnimationFrame(grab);
    };
    requestAnimationFrame(grab);
  });
  return sheet.toDataURL('image/png');
}, [name, o]);
const save = (name, png) => { writeFileSync('e:/Games/_assets/previews/move-' + name + '.png', Buffer.from(png.split(',')[1], 'base64')); console.log('move-' + name + '.png'); };
const home = () => p.evaluate(() => { const m = window.__meadow; m.travelTo(m.spawn.x + 14, m.spawn.z + 14, m.spawn.x + 60, m.spawn.z + 14); });
const face = () => p.evaluate(async () => { // a steep face near home: stand at its foot, facing it
  const m = window.__meadow, url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js')), S = await import(url), H = m.home;
  for (let r = 300; r < 3000; r += 40) for (let a = 0; a < 6.28; a += 0.15) {
    const x = H.x + Math.cos(a) * r, z = H.z + Math.sin(a) * r;
    if (!S.walkable(x, z) || S.height(x, z) < 2) continue;
    for (let q = 0; q < 6.28; q += 0.5) { const dx = Math.cos(q), dz = Math.sin(q); let ok = S.height(x + dx * 14, z + dz * 14) > S.height(x, z) + 14; for (let d = 1.5; ok && d < 14; d += 1.5) if (S.walkable(x + dx * d, z + dz * d)) ok = false; if (ok && S.walkable(x - dx * 2, z - dz * 2)) return { x, z, dx, dz }; }
  }
  return null;
});
const run = (name) => !want.length || want.includes(name);
// at the foot of the face, seen from the side (the camera square to the way up it, so A walks you into it); then on it, and up for a while
const sideYaw = (f, turn = 0) => Math.atan2(f.dz, -f.dx) + turn;
const toFace = async (f, climbFor) => {
  await p.evaluate(([f, yaw]) => { const m = window.__meadow; m.travelTo(f.x, f.z, f.x + f.dx * 5, f.z + f.dz * 5); m.camState.yaw = yaw; m.camState.pitch = 0.1; m.camState.dist = 5.5; }, [f, sideYaw(f)]);
  await p.waitForTimeout(5000);
  if (climbFor === undefined) return;
  await p.keyboard.down('KeyA');
  await p.waitForFunction(() => window.__meadow.moves.mode === 'climb', null, { timeout: 8000 }).catch(() => console.log('never took hold'));
  await p.keyboard.up('KeyA');
  if (climbFor) { await p.keyboard.down('KeyW'); await p.waitForTimeout(climbFor); await p.keyboard.up('KeyW'); }
};

if (run('jump')) { await home(); const j = film('jump', { title: 'Jump, standing (Space)', every: 0.085, n: 12, angle: Math.PI * 0.78, dist: 4.2, crop: 360 }); await p.waitForTimeout(800); await p.evaluate(() => window.__meadow.jump()); save('jump', await j); }
if (run('runjump')) {
  await home(); await p.evaluate(() => { window.__meadow.camState.yaw = Math.atan2(-1, 0); });
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW');
  const j = film('runjump', { title: 'Running jump (Shift + W, Space)', every: 0.085, n: 12, follow: false, settle: 600 });
  await p.waitForTimeout(800); await p.evaluate(() => window.__meadow.jump());
  const png = await j; await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft'); save('runjump', png);
}
if (run('heavy')) { await home(); const j = film('heavy', { title: 'A fall of 4 m: the heavy landing, a hand to the ground', every: 0.1, n: 12, dist: 6 }); await p.waitForTimeout(800); await p.evaluate(() => window.__meadow.dropFrom(4)); save('heavy', await j); }
if (run('roll')) { await home(); const j = film('roll', { title: 'A fall of 9 m: the long fall, then a roll over one shoulder and up', every: 0.12, n: 18, dist: 5.5, angle: Math.PI * 0.78, crop: 360 }); await p.waitForTimeout(800); await p.evaluate(() => window.__meadow.dropFrom(9, 3)); save('roll', await j); }
if (run('climb') || run('slide') || run('glide')) {
  const f = await face();
  console.log('face', JSON.stringify(f));
  if (f && run('climb')) {
    await toFace(f);
    const j0 = film('climb', { title: 'Climbing: walking into the face, taking hold, then up (W)', every: 0.16, n: 18, dist: 5, yaw: sideYaw(f, 0.25), pitch: 0.08, settle: 200 });
    await p.keyboard.down('KeyA');
    await p.waitForFunction(() => window.__meadow.moves.mode === 'climb', null, { timeout: 8000 }).catch(() => console.log('never took hold'));
    await p.keyboard.up('KeyA'); await p.keyboard.down('KeyW');
    save('climb', await j0);
    save('climb-back', await film('climb-back', { title: 'Climbing, from behind', every: 0.14, n: 12, dist: 4.5, angle: 0, pitch: 0.3, settle: 100 }));
    await p.keyboard.up('KeyW');
    const j3 = film('climb-rest', { title: 'Climbing: resting on the face, then sideways (D), then down (S)', every: 0.25, n: 18, dist: 5, yaw: sideYaw(f, 0.25), pitch: 0.08, settle: 100 });
    await p.waitForTimeout(1700); await p.keyboard.down('KeyD'); await p.waitForTimeout(1400); await p.keyboard.up('KeyD'); await p.keyboard.down('KeyS');
    const png3 = await j3; await p.keyboard.up('KeyS'); save('climb-rest', png3);
  }
  if (f && run('slide')) {
    await toFace(f, 9000);
    const j = film('slide', { title: 'Jumping off a climb (Space), landing on the face and sliding down it', every: 0.14, n: 18, dist: 6.5, yaw: sideYaw(f, 0.25), pitch: 0.1, settle: 300 });
    await p.waitForTimeout(700); await p.evaluate(() => window.__meadow.jump()); save('slide', await j);
  }
  if (f && run('glide')) {
    await toFace(f, 14000);
    const j = film('glide', { title: 'Off the face (Space), the glider opens (Space): glide, turn (D), dive (W), flare (S)', every: 0.25, n: 24, dist: 6.5, angle: Math.PI * 0.62, pitch: 0.1, settle: 300 });
    await p.waitForTimeout(700); await p.evaluate(() => window.__meadow.jump()); await p.waitForTimeout(350); await p.evaluate(() => window.__meadow.jump());
    await p.waitForTimeout(1500); await p.keyboard.down('KeyD'); await p.waitForTimeout(1100); await p.keyboard.up('KeyD'); await p.keyboard.down('KeyW'); await p.waitForTimeout(1100); await p.keyboard.up('KeyW'); await p.keyboard.down('KeyS');
    const png = await j; await p.keyboard.up('KeyS'); save('glide', png);
    console.log('after glide:', JSON.stringify(await p.evaluate(() => ({ mode: window.__meadow.moves.mode, y: window.__meadow.player.y }))));
  }
}
await b.close();
