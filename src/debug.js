// Debug tools, loaded only with ?debug: a frame-time graph and live tuning sliders.
import Stats from 'stats.js';
import GUI from 'lil-gui';

export function initDebug(m) {
  const stats = new Stats();
  stats.dom.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:50';
  document.body.appendChild(stats.dom);
  (function loop() { stats.update(); requestAnimationFrame(loop); })();

  const gui = new GUI({ title: 'Meadow debug' });
  const t = { hour: m.hour(), live: m.timeCtl.live };
  gui.add(t, 'hour', 0, 24, 0.1).name('hour').onChange((v) => { m.timeCtl.live = false; m.timeCtl.target = v; });
  gui.add(m.timeCtl, 'live').name('live clock').listen();
  const w = gui.addFolder('Weather (live values)');
  ['cloud', 'rain', 'storm', 'fog', 'snow', 'wind', 'wet', 'cover'].forEach((k) => w.add(m.wx, k, 0, 1, 0.01).listen());
  w.add(m.wx, 'type', ['clear', 'rain', 'storm', 'fog', 'snow']).onChange(() => { m.wx.auto = false; });
  const s = gui.addFolder('Season');
  s.add(m.seasonState, 'ice', 0, 1, 0.01).listen();
  s.add(m.seasonState, 'bugs', 0, 1, 0.01).listen();
  const q = gui.addFolder('Quality');
  q.add(m.quality, 'level').listen();
  q.add(m.quality, 'fps').listen();
  const p = gui.addFolder('Player');
  p.add(m.activity, 'current').name('activity').listen();
  p.add(m.player, 'x').listen();
  p.add(m.player, 'z').listen();
  gui.close();
}
