// The film: renders each shot of tools/film/shots.mjs frame by frame on a virtual clock (so every
// frame is drawn complete, however long it takes), with the camera, the hour and the characters
// driven by the shot, captions drawn over the picture, and the game's own interface hidden.
//
//   node tools/film/film.mjs                     every shot (needs `npm run dev`)
//   SHOT=dawn,boat node tools/film/film.mjs       only these
//   PREVIEW=1 node tools/film/film.mjs            four small stills per shot, to check the framing
//
// Frames go to e:/Games/_assets/film/frames/<shot>/00000.jpg; previews to e:/Games/_assets/film/preview/.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { shots } from './shots.mjs';

const P = JSON.parse(readFileSync(new URL('./places.json', import.meta.url)));
const FPS = 30, W = 1920, H = 1080, preview = !!process.env.PREVIEW, DSF = preview ? 0.5 : +(process.env.DSF || 1.5);
const OUT = 'e:/Games/_assets/film';
const only = process.env.SHOT ? process.env.SHOT.split(',') : null;

const RUNTIME = async ({ shot, P }) => {
  const url = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
  const imp = (n) => import(url(n));
  const [S, ST, R, Q, TM, PL, AN, FR, BO, CF, IN] = await Promise.all(['/src/core/shape.js', '/src/core/state.js', '/src/core/render.js', '/src/systems/quality.js', '/src/systems/time.js', '/src/characters/player.js', '/src/characters/animals.js', '/src/features/friend.js', '/src/characters/boat.js', '/src/features/campfire.js', '/src/systems/input.js'].map(imp));
  const fn = (src) => (src ? (0, eval)('(' + src + ')') : null);
  const F = { setup: fn(shot.setup), frame: fn(shot.frame) };
  // the best pictures, the same every frame
  Q.setQuality('ultra');
  // the game's own interface hidden; captions drawn over the picture
  const css = document.createElement('style');
  css.textContent = `body > *:not(#world):not(#film) { display: none !important; }
    #film { position: fixed; inset: 0; pointer-events: none; z-index: 99; font-family: 'Cormorant Garamond', serif; color: #fffaf0; text-shadow: 0 2px 18px rgba(20, 24, 30, 0.55), 0 1px 3px rgba(20, 24, 30, 0.5); }
    #film .cap { position: absolute; left: 0; right: 0; text-align: center; opacity: 0; }
    #film .title { top: 34%; }
    #film .title h1 { margin: 0; font-style: italic; font-weight: 600; font-size: 118px; letter-spacing: 0.01em; }
    #film .title p { margin: 14px 0 0; font-family: Manrope, sans-serif; font-weight: 600; font-size: 24px; letter-spacing: 0.42em; text-transform: uppercase; opacity: 0.92; }
    #film .lower { bottom: 11%; font-style: italic; font-weight: 500; font-size: 52px; }
    #film .end { top: 38%; }
    #film .end h1 { margin: 0; font-style: italic; font-weight: 600; font-size: 104px; }
    #film .end p { margin: 18px 0 0; font-family: Manrope, sans-serif; font-weight: 600; font-size: 22px; letter-spacing: 0.4em; text-transform: uppercase; }`;
  document.head.appendChild(css);
  const film = document.createElement('div'); film.id = 'film'; document.body.appendChild(film);
  const caps = (shot.text || []).map((c) => { const d = document.createElement('div'); d.className = 'cap ' + (c.cls || 'lower'); d.innerHTML = c.html; film.appendChild(d); return { ...c, d }; });
  // a virtual clock: time moves only when the film says so
  let vt = performance.now(), q = [];
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  // what a shot gets to work with
  const c = {
    P, S, M: window.__meadow, player: PL.player, hero: PL.hero, animals: AN.animals, friend: () => FR.friend, boat: BO.boat, sk: BO.sk, fire: CF.fire, camState: IN.camState, timeCtl: TM.timeCtl,
    h: (x, z) => S.height(x, z), g: (x, z) => S.groundAt(x, z),
    lerp: (a, b, u) => a + (b - a) * u, ease: (u) => u * u * (3 - 2 * u), mix3: (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u],
    hour: (h) => { TM.timeCtl.live = false; TM.timeCtl.hour = h; TM.timeCtl.target = h; },
    hideHero: false, hideFriend: false, t: 0, u: 0, dur: shot.dur, look: null,
  };
  // the camera is the shot's
  ST.hooks.camera.unshift((dt, camTarget) => {
    const f = F.frame ? F.frame(c, c.t, c.u) : null;
    if (!f) return false;
    if (f.hour !== undefined) c.hour(f.hour);
    R.camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
    R.camera.lookAt(f.look[0], f.look[1], f.look[2]);
    if (f.fov && R.camera.fov !== f.fov) { R.camera.fov = f.fov; R.camera.updateProjectionMatrix(); }
    camTarget.set(f.look[0], f.look[1], f.look[2]); // (the shadows are drawn round what the camera looks at)
    if (c.hideHero && PL.hero) PL.hero.root.visible = false;
    if (c.hideFriend && FR.friend && FR.friend.k) FR.friend.k.root.visible = false;
    if (c.each) c.each(c, c.t, c.u);
    return true;
  });
  // and a say after everything has moved this frame (to hold an animal still, say)
  ST.hooks.frame.push(() => { if (c.after) c.after(c, c.t, c.u); });
  if (F.setup) F.setup(c);
  window.__film = {
    c,
    /** One frame of the shot, at shot time t. */
    step(t, dt = 1 / 30) {
      c.t = t; c.u = Math.min(1, t / shot.dur);
      vt += dt * 1000;
      const cbs = q; q = []; cbs.forEach((cb) => cb(vt));
      for (const k of caps) { const a = Math.min(1, Math.max(0, (t - k.from) / (k.fade || 0.9)), Math.max(0, (k.to - t) / (k.fade || 0.9))); k.d.style.opacity = a.toFixed(3); k.d.style.transform = `translateY(${((1 - a) * 10).toFixed(1)}px)`; }
    },
  };
  return true;
};

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
for (const shot of shots) {
  if (only && !only.includes(shot.name)) continue;
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  ERR', shot.name, e.message));
  const u = shot.url || {}, at = shot.at || [P.spawn.x, P.spawn.z];
  await page.goto(`http://127.0.0.1:8080/?seed=1&weather=${u.weather || 'clear'}&season=${u.season || 'summer'}&at=${at[0].toFixed(1)},${at[1].toFixed(1)}#${u.hour ?? 12}`);
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 180000 });
  await page.waitForTimeout(4000); // (the models and the fonts)
  const src = { name: shot.name, dur: shot.dur, text: shot.text, setup: shot.setup && shot.setup.toString(), frame: shot.frame && shot.frame.toString() };
  await page.evaluate(RUNTIME, { shot: src, P });
  const step = (t, n = 1) => page.evaluate(([t, n]) => { for (let i = 0; i < n; i++) window.__film.step(t); }, [t, n]);
  // warm up: the ground and the woods built all along the camera's way, then settle at the start
  await step(0, 90);
  for (let k = 0; k <= 12; k++) await step((k / 12) * shot.dur, 14);
  await step(0, 60);
  const dir = `${OUT}/${preview ? 'preview' : 'frames/' + shot.name}`;
  if (!preview && existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const N = Math.round(shot.dur * FPS), keysDown = new Set();
  const want = preview ? new Set([0, Math.round(N / 3), Math.round((2 * N) / 3), N - 1]) : null;
  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    // keys held for a while (the boy walking)
    for (const k of shot.keys || []) { const on = t >= k.from && t < k.to; if (on && !keysDown.has(k.key)) { await page.keyboard.down(k.key); keysDown.add(k.key); } if (!on && keysDown.has(k.key)) { await page.keyboard.up(k.key); keysDown.delete(k.key); } }
    await step(t);
    if (want && !want.has(f)) continue;
    const file = preview ? `${dir}/${shot.name}-${String(f).padStart(4, '0')}.jpg` : `${dir}/${String(f).padStart(5, '0')}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: preview ? 80 : 93 });
  }
  for (const k of keysDown) await page.keyboard.up(k);
  await ctx.close();
  console.log(`${shot.name}: ${N} frames in ${Math.round((Date.now() - t0) / 1000)} s`);
}
await browser.close();
