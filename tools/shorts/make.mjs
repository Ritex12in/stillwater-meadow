// Makes a short from its shot list (tools/shorts/shorts/<id>-<name>.mjs; the pipeline is in docs/shorts):
//   1. the voice: every line spoken by the AI voice, with each word's time (voice.py)
//   2. the timing: a line lasts as long as it takes to say; its shots share that time
//   3. the film: each shot rendered frame by frame from its own version of the game, 1080 x 1920, the
//      interface hidden, on a virtual clock (every frame drawn complete, however long it takes)
//   4. the captions: the spoken words a few at a time, as pictures in the game's display font, inside
//      the safe areas; and the end card
//   5. the edit: the shots cut together, the captions laid over, the voice over the game's own music
//
//   node tools/shorts/make.mjs 001            everything      (-> e:/Games/_assets/shorts/001-the-character/001-the-character.mp4)
//   REUSE=1 node tools/shorts/make.mjs 001    keep the voice and any shot already filmed at the right length
//   ONLY=3,4 ...                              film only these shots (numbered from 1), then edit
//   STILLS=1 ...                              one still from the middle of each shot, no video (to check framing)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { openVersion } from './version.mjs';

const FRAME = { width: 1080, height: 1920, top: 250, bottom: 450, side: 60 }, FPS = 30, GAP = 0.28;
const id = process.argv[2];
if (!id) { console.log('node tools/shorts/make.mjs <id>'); process.exit(1); }
const file = readdirSync(new URL('./shorts/', import.meta.url)).find((f) => f.startsWith(id + '-') && f.endsWith('.mjs'));
if (!file) { console.log('no shot list for ' + id); process.exit(1); }
const spec = (await import('./shorts/' + file)).default, NAME = `${spec.id}-${spec.name}`, OUT = `e:/Games/_assets/shorts/${NAME}`;
mkdirSync(OUT, { recursive: true });
const reuse = !!process.env.REUSE, stills = !!process.env.STILLS, only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const FF = execFileSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const ff = (args) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

// ── 1. the voice ──
const said = spec.lines.map((l) => l.text).concat(spec.end && spec.end.say ? [spec.end.say] : []);
if (!(reuse && existsSync(OUT + '/voice/voice.json') && JSON.parse(readFileSync(OUT + '/voice/voice.json')).lines.map((l) => l.text).join('|') === said.join('|'))) {
  writeFileSync(OUT + '/lines.json', JSON.stringify(said));
  execFileSync('python', ['tools/shorts/voice.py', OUT + '/lines.json', OUT + '/voice', spec.voice], { stdio: 'inherit' });
}
const voice = JSON.parse(readFileSync(OUT + '/voice/voice.json')).lines;
const spoken = (l) => { const w = l.words[l.words.length - 1]; return w.at + w.dur; };

// ── 2. the timing ──
let t = 0.25;
const lines = spec.lines.map((l, i) => { const v = voice[i], from = t, dur = spoken(v) + GAP + (l.pad || 0); t += dur; return { ...l, v, from, dur }; });
const endSay = spec.end && spec.end.say ? voice[voice.length - 1] : null, lastShot = lines[lines.length - 1].shots[lines[lines.length - 1].shots.length - 1];
const tail = Math.max(lastShot.tail || 0, endSay ? spoken(endSay) + 0.9 : 0), endFrom = t + 0.15, total = t + tail;
const shots = [];
let at = 0;
lines.forEach((l, i) => {
  // a line's shots share its time by weight; or a shot begins on a word of the line (`cue`: the word as written)
  const sum = l.shots.reduce((a, s) => a + (s.weight || 1), 0), lead = i === 0 ? l.from : 0, start = at, words = l.text.split(/\s+/);
  const begins = l.shots.map((s, k) => {
    if (k === 0) return start;
    if (s.cue) { const w = words.indexOf(s.cue); if (w < 0 || !l.v.words[w]) throw new Error(`line ${i + 1}: no word "${s.cue}" to cut on`); return l.from + l.v.words[w].at - 0.1; }
    return start + (l.dur + lead) * l.shots.slice(0, k).reduce((a, q) => a + (q.weight || 1), 0) / sum;
  });
  l.shots.forEach((s, k) => {
    const end = k < l.shots.length - 1 ? begins[k + 1] : start + l.dur + lead, dur = end - begins[k] + (s === lastShot ? tail : 0);
    shots.push({ ...s, n: shots.length + 1, from: begins[k], dur, frames: Math.round(dur * FPS), line: i + 1 });
  });
  at = start + l.dur + lead + (l.shots.includes(lastShot) ? tail : 0);
});
console.log(`${NAME}: ${total.toFixed(1)} s, ${lines.length} lines, ${shots.length} shots, voice ${spec.voice}`);
for (const s of shots) console.log(`  shot ${String(s.n).padStart(2)}  ${s.from.toFixed(2).padStart(6)} s  ${s.dur.toFixed(2)} s  ${s.commit.padEnd(8)} line ${s.line}`);

// ── 3. the film ──
const RUNTIME = async (src) => {
  try { const url = performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes('/src/systems/quality.js')); if (url) { const Q = await import(url); if (Q.setQuality) Q.setQuality('ultra'); } } catch (e) { /* an old version without it */ }
  const css = document.createElement('style');
  css.textContent = 'body > *:not(canvas):not(#world) { display: none !important; } html, body { background: #000 !important; }';
  document.head.appendChild(css);
  // a virtual clock: time moves only when the film says so, a sixtieth of a second at a time
  let vt = performance.now(), q = [];
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  const fn = src ? (0, eval)('(' + src + ')') : null, c = { m: window.__meadow };
  window.__short = { c, step(t, u) { if (fn) { try { fn(c, t, u); } catch (e) { c.err = String(e); } } for (let k = 0; k < 2; k++) { vt += 1000 / 60; const cbs = q; q = []; cbs.forEach((cb) => cb(vt)); } } };
  return true;
};
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const s of shots) {
  if (only && !only.includes(s.n)) continue;
  const dir = `${OUT}/frames/s${String(s.n).padStart(2, '0')}`;
  if (!stills && reuse && !only && existsSync(dir) && readdirSync(dir).length === s.frames) continue;
  const t0 = Date.now(), v = await openVersion(browser, s.commit, { width: FRAME.width, height: FRAME.height, query: s.query || '', hash: s.hash || '#15', wait: 7000 });
  await v.page.evaluate(RUNTIME, s.frame || null);
  const step = (tt, n = 1) => v.page.evaluate(([tt, dur, n]) => { for (let i = 0; i < n; i++) window.__short.step(tt, Math.min(1, tt / dur)); return window.__short.c.err || null; }, [tt, s.dur, n]);
  await step(0, 120); // (settle: the camera comes round, the land and the models arrive)
  await v.page.waitForTimeout(1500);
  await step(0, 60);
  if (stills) {
    await step(s.dur / 2, 1);
    mkdirSync(OUT + '/stills', { recursive: true });
    await v.page.screenshot({ path: `${OUT}/stills/s${String(s.n).padStart(2, '0')}-${v.sha}.jpg`, type: 'jpeg', quality: 85 });
  } else {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    mkdirSync(dir, { recursive: true });
    let err = null;
    for (let f = 0; f < s.frames; f++) { err = (await step(f / FPS)) || err; await v.page.screenshot({ path: `${dir}/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 }); }
    if (err) console.log('   shot ' + s.n + ' frame function failed: ' + err);
  }
  console.log(`  shot ${s.n} (${v.sha}, ${v.date}): ${stills ? 'still' : s.frames + ' frames'} in ${Math.round((Date.now() - t0) / 1000)} s${v.problems.length ? ' · page problems: ' + v.problems[0].slice(0, 90) : ''}`);
  await v.close();
}
if (stills) { await browser.close(); console.log('stills in ' + OUT + '/stills'); process.exit(0); }

// ── 4. the captions and the end card: pictures with clear backgrounds ──
const caps = [];
lines.forEach((l) => {
  let cur = null;
  l.v.words.forEach((w, k) => {
    const word = l.text.split(/\s+/)[k] || w.text; // (the script's own spelling and punctuation)
    if (!cur) { cur = { text: word, from: l.from + w.at - 0.06 }; caps.push(cur); } else cur.text += ' ' + word;
    cur.to = l.from + w.at + w.dur + 0.12;
    const left = l.v.words.length - 1 - k, ends = /[.!?,:]$/.test(word), nextEnds = left >= 1 && /[.!?,:]$/.test(l.text.split(/\s+/)[k + 1] || '');
    if (ends || ((cur.text.split(' ').length >= 4 || cur.text.length > 22) && !nextEnds)) cur = null; // (a few words at a time; never one word left on its own at a sentence's end)
  });
});
caps.forEach((c, i) => { const next = caps[i + 1]; if (next && next.from - c.to < 0.5) c.to = next.from; c.to = Math.min(c.to, endFrom - 0.05); });
mkdirSync(OUT + '/caps', { recursive: true });
const cp = await browser.newPage({ viewport: { width: FRAME.width, height: FRAME.height } });
await cp.setContent(`<!doctype html><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600&family=Manrope:wght@600;700&display=swap">
<style>html,body{margin:0;background:transparent}#c{position:absolute;left:${FRAME.side + 30}px;right:${FRAME.side + 30}px;bottom:${FRAME.bottom + 60}px;text-align:center;color:#fffaf0;font:italic 600 84px/1.06 "Cormorant Garamond",Georgia,serif;text-shadow:0 3px 16px rgba(0,0,0,.8),0 0 4px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.9)}
#e{position:absolute;inset:0;display:none;background:linear-gradient(rgba(10,16,20,0) 20%,rgba(10,16,20,.55) 45%,rgba(10,16,20,.55) 62%,rgba(10,16,20,0) 85%)}#e h1{position:absolute;left:0;right:0;top:${Math.round(FRAME.height * 0.4)}px;margin:0;text-align:center;color:#fffaf0;font:italic 600 118px/1 "Cormorant Garamond",Georgia,serif;text-shadow:0 3px 18px rgba(0,0,0,.6)}
#e p{position:absolute;left:0;right:0;top:${Math.round(FRAME.height * 0.4) + 150}px;margin:0;text-align:center;color:#fffaf0;font:700 30px Manrope,sans-serif;letter-spacing:.34em;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.7)}</style><div id="c"></div><div id="e"><h1></h1><p></p></div>`);
await cp.evaluate(() => document.fonts.ready);
await cp.waitForTimeout(800);
for (const [i, c] of caps.entries()) { await cp.evaluate((tx) => { document.getElementById('c').textContent = tx; }, c.text); c.file = `${OUT}/caps/c${String(i).padStart(2, '0')}.png`; await cp.screenshot({ path: c.file, omitBackground: true }); }
let endCard = null;
if (spec.end) { await cp.evaluate((e) => { document.getElementById('c').textContent = ''; const el = document.getElementById('e'); el.style.display = 'block'; el.querySelector('h1').textContent = e.title; el.querySelector('p').textContent = e.sub; }, spec.end); endCard = OUT + '/caps/end.png'; await cp.screenshot({ path: endCard, omitBackground: true }); }
await browser.close();

// ── 5. the edit ──
// the shots, cut one after another
const vin = shots.flatMap((s) => ['-framerate', String(FPS), '-i', `${OUT}/frames/s${String(s.n).padStart(2, '0')}/%05d.jpg`]);
ff([...vin, '-filter_complex', shots.map((_, i) => `[${i}:v]`).join('') + `concat=n=${shots.length}:v=1:a=0,scale=in_range=full:out_range=limited,format=yuv420p[v]`, '-map', '[v]', '-color_range', 'tv', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-r', String(FPS), `${OUT}/picture.mp4`]);
// the captions over them; the voice over the game's own music
const over = caps.concat(endCard ? [{ file: endCard, from: endFrom, to: total + 1, fade: true }] : []);
let chain = '', last = '[0:v]';
over.forEach((c, i) => { const tag = `[v${i}]`; chain += (c.fade ? `[${i + 1}:v]format=rgba,fade=t=in:st=${c.from.toFixed(2)}:d=0.5:alpha=1[e${i}];${last}[e${i}]overlay=enable='gte(t,${c.from.toFixed(2)})'${tag};` : `${last}[${i + 1}:v]overlay=enable='between(t,${c.from.toFixed(3)},${c.to.toFixed(3)})'${tag};`); last = tag; });
chain += `${last}fade=t=out:st=${(total - 0.5).toFixed(2)}:d=0.5,format=yuv420p[v];`;
const a0 = 1 + over.length, vl = lines.map((l, i) => ({ file: `${OUT}/voice/${l.v.file}`, at: l.from })).concat(endSay ? [{ file: `${OUT}/voice/${endSay.file}`, at: endFrom + 0.2 }] : []);
vl.forEach((l, i) => { chain += `[${a0 + i}:a]adelay=${Math.round(l.at * 1000)}|${Math.round(l.at * 1000)},volume=1.6[a${i}];`; });
const music = 'e:/Games/_assets/film/audio-day.webm', hasMusic = existsSync(music);
if (hasMusic) chain += `[${a0 + vl.length}:a]atrim=start=3:duration=${total.toFixed(2)},asetpts=PTS-STARTPTS,volume=0.3,afade=t=in:st=0:d=0.6,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2[m];`;
chain += vl.map((_, i) => `[a${i}]`).join('') + (hasMusic ? '[m]' : '') + `amix=inputs=${vl.length + (hasMusic ? 1 : 0)}:normalize=0:duration=longest,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000[a]`;
const out = `${OUT}/${NAME}.mp4`;
ff(['-i', `${OUT}/picture.mp4`, ...over.flatMap((c) => (c.fade ? ['-loop', '1', '-t', (total + 1).toFixed(2), '-i', c.file] : ['-i', c.file])), ...vl.flatMap((l) => ['-i', l.file]), ...(hasMusic ? ['-i', music] : []),
  '-filter_complex', chain, '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '10M', '-bufsize', '20M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-movflags', '+faststart', out]);
ff(['-ss', '0.8', '-i', out, '-frames:v', '1', '-q:v', '2', `${OUT}/${NAME}-poster.jpg`]);
// a strip of frames, one every two seconds, to look the whole thing over at a glance
ff(['-i', out, '-vf', `fps=1/2,scale=216:384,tile=${Math.ceil(total / 2)}x1`, '-frames:v', '1', '-q:v', '3', `${OUT}/${NAME}-strip.jpg`]);
writeFileSync(`${OUT}/timing.json`, JSON.stringify({ total, shots: shots.map((s) => ({ n: s.n, commit: s.commit, from: +s.from.toFixed(2), dur: +s.dur.toFixed(2), line: s.line })), captions: caps.map((c) => ({ text: c.text, from: +c.from.toFixed(2), to: +c.to.toFixed(2) })) }, null, 1));
console.log(`${out}: ${total.toFixed(1)} s${hasMusic ? '' : ' (no music found: voice only)'}`);
process.exit(0);
