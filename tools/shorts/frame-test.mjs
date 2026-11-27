// A test of the shorts' tall frame (docs/shorts, ADR 0002): the game at 1080 x 1920 with its interface
// hidden, the safe areas drawn over it (red: where the apps put their own buttons and text; the green
// box: where captions and anything to be read must stay), and a sample caption in the game's display
// font. To be looked at on a phone before the numbers are trusted.
//   node tools/shorts/frame-test.mjs [commit]     -> e:/Games/_assets/shorts/frame-test.png and frame-test-clean.png
import { chromium } from 'playwright';
import { openVersion } from './version.mjs';

export const FRAME = { width: 1080, height: 1920, top: 250, bottom: 450, side: 60 };
/** Hide the game's interface (old versions and new: everything but the canvas). */
export const hideInterface = (page) => page.addStyleTag({ content: 'body > *:not(canvas):not(#world):not(#shortsOver) { display: none !important; } html, body { background: #000 !important; }' });

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const v = await openVersion(browser, process.argv[2] || 'HEAD', { width: FRAME.width, height: FRAME.height, query: 'weather=clear&season=summer', hash: '#17.5' });
await hideInterface(v.page);
// the boy close and low, as a tall frame wants him: from his front quarter, by the lake
await v.page.evaluate(() => { const m = window.__meadow; if (!m || !m.camState) return; m.camState.dist = 3.4; m.camState.pitch = 0.1; m.camState.yaw = m.player.rot + 2.6; });
await v.page.waitForTimeout(2500);
await v.page.screenshot({ path: 'e:/Games/_assets/shorts/frame-test-clean.png' });
await v.page.evaluate((F) => {
  const o = document.createElement('div'); o.id = 'shortsOver'; o.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;font-family:"Cormorant Garamond",Georgia,serif';
  const box = (css, text) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;' + css; if (text) d.textContent = text; o.appendChild(d); return d; };
  box(`left:0;right:0;top:0;height:${F.top}px;background:rgba(220,40,40,0.28);color:#fff;font:600 30px sans-serif;display:grid;place-items:center`, `top ${F.top}px: the app's own header`);
  box(`left:0;right:0;bottom:0;height:${F.bottom}px;background:rgba(220,40,40,0.28);color:#fff;font:600 30px sans-serif;display:grid;place-items:center`, `bottom ${F.bottom}px: the app's caption, name and buttons`);
  box(`left:${F.side}px;right:${F.side}px;top:${F.top}px;bottom:${F.bottom}px;border:4px solid rgba(80,230,120,0.9)`);
  box(`left:${F.side + 30}px;right:${F.side + 30}px;bottom:${F.bottom + 70}px;text-align:center;color:#fff;font:italic 600 76px/1.08 "Cormorant Garamond",Georgia,serif;text-shadow:0 3px 14px rgba(0,0,0,0.75),0 0 3px rgba(0,0,0,0.9)`, 'This character has no 3D model.');
  document.body.appendChild(o);
}, FRAME);
await v.page.waitForTimeout(400);
await v.page.screenshot({ path: 'e:/Games/_assets/shorts/frame-test.png' });
console.log('frame-test.png and frame-test-clean.png in e:/Games/_assets/shorts/ (from ' + v.sha + ')');
await v.close();
await browser.close();
process.exit(0);
