// The loading screen, the full-screen button, and the "turn your phone sideways" prompt.
// The loading screen itself is plain HTML and CSS in index.html, so it is on screen before any
// script has run; this file only moves its bar, changes its line of text, and fades it out once
// the meadow has drawn its first frame.
const $ = (id) => document.getElementById(id);

/** Move the bar to `frac` (0..1) and, if given, change the line under the title. */
export function loadingStep(frac, text) {
  const bar = $('loadingBar'), label = $('loadingText');
  if (bar) bar.style.width = `${Math.round(Math.max(0.04, Math.min(1, frac)) * 100)}%`;
  if (label && text) label.textContent = text;
}
/** Let the browser draw what has changed before the next (blocking) piece of work. */
export const paint = () => new Promise((resolve) => {
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  requestAnimationFrame(() => setTimeout(go, 0));
  setTimeout(go, 60); // a hidden tab gets no animation frames: don't wait for one forever
});
/** The meadow is on screen: fade the loading screen away. */
export function loadingDone() {
  const el = $('loading');
  if (!el) return;
  loadingStep(1, 'Welcome');
  el.classList.add('done');
  setTimeout(() => { el.hidden = true; }, 800);
}

export function initScreen() {
  // ── full screen ──
  const btn = $('fullscreenBtn'), root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (btn && request && exit) { // (iPhone browsers have no full screen for pages: the button stays hidden there)
    btn.hidden = false;
    const goFull = async () => {
      try {
        await request.call(root);
        // on a phone, full screen is also the moment the browser lets a page hold the screen sideways
        if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
      } catch (e) { /* refused (not from a tap, or not allowed): nothing to do */ }
    };
    btn.addEventListener('click', () => { if (isFull()) exit.call(document); else goFull(); btn.blur(); });
    const sync = () => { btn.setAttribute('aria-pressed', String(isFull())); btn.title = isFull() ? 'Leave full screen' : 'Full screen'; btn.setAttribute('aria-label', btn.title); };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
  }

  // ── a phone held upright ──
  const rotate = $('rotate'), skip = $('rotateSkip');
  if (rotate && window.matchMedia) {
    const upright = window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 820px)');
    let skipped = false;
    try { skipped = sessionStorage.getItem('meadow-upright') === '1'; } catch (e) { /* private window */ }
    const sync = () => { rotate.hidden = skipped || !upright.matches; };
    (upright.addEventListener ? upright.addEventListener('change', sync) : upright.addListener(sync));
    window.addEventListener('resize', sync); window.addEventListener('orientationchange', sync); // (some phones only report the turn this way)
    skip.addEventListener('click', () => { skipped = true; try { sessionStorage.setItem('meadow-upright', '1'); } catch (e) { /* private window */ } sync(); });
    sync();
  }
}
