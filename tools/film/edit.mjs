// The film's edit: each shot's frames into a clip, the clips joined with dissolves (quick ones through
// the country montage), faded up from black and down to black, with the game's own music and sounds
// (the day take, giving way to the night take as night falls), levelled for loudness.
//   node tools/film/edit.mjs     ->  e:/Games/_assets/film/Stillwater-Meadow.mp4 (1920x1080, 30 fps, H.264 + AAC)
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { shots } from './shots.mjs';

const FF = execFileSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const OUT = 'e:/Games/_assets/film', FPS = 30;
const ff = (args) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
// the order on screen (the seasons before the day ends; night after)
const ORDER = ['dawn', 'friends', 'boat', 'rise', 'cascade', 'bridge', 'stones', 'pagoda', 'skyisles', 'ship', 'winter', 'dusk', 'campfire', 'end'];
const QUICK = new Set(['skyisles', 'ship']); // (cut quickly into these: the montage)
const byName = Object.fromEntries(shots.map((s) => [s.name, s]));

// 1. each shot's frames into a clip, scaled down from the larger frames for clean edges
mkdirSync(`${OUT}/clips`, { recursive: true });
const clips = ORDER.map((name) => {
  const dir = `${OUT}/frames/${name}`, out = `${OUT}/clips/${name}.mp4`;
  if (!existsSync(dir)) throw new Error('no frames for ' + name);
  const n = readdirSync(dir).length;
  if (!process.env.REUSE || !existsSync(out)) ff(['-framerate', String(FPS), '-i', `${dir}/%05d.jpg`, '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-r', String(FPS), out]);
  return { name, out, dur: n / FPS };
});

// 2. join them: a dissolve between each pair, quick ones in the montage
let chain = '', last = '[0:v]', t = 0, nightAt = 0;
clips.forEach((c, i) => {
  if (i === 0) { t = c.dur; return; }
  const d = QUICK.has(c.name) ? 0.35 : 0.9, off = t - d;
  const tag = `[v${i}]`;
  chain += `${last}[${i}:v]xfade=transition=fade:duration=${d}:offset=${off.toFixed(3)}${tag};`;
  last = tag;
  if (c.name === 'dusk') nightAt = off + 5.5; // (the music turns to night as the dusk deepens)
  t = off + c.dur;
});
const total = t;
chain += `${last}fade=t=in:st=0:d=1.6,fade=t=out:st=${(total - 2.2).toFixed(3)}:d=2.2,format=yuv420p[v];`;

// 3. the sound: the day take until night falls, crossfading into the night take
const day = `${OUT}/audio-day.webm`, night = `${OUT}/audio-night.webm`;
const X = 4; // seconds of crossfade
const a = `[${clips.length}:a]atrim=start=2:duration=${(nightAt + X).toFixed(3)},asetpts=PTS-STARTPTS[ad];` +
  `[${clips.length + 1}:a]atrim=start=2:duration=${(total - nightAt + 0.5).toFixed(3)},asetpts=PTS-STARTPTS[an];` +
  `[ad][an]acrossfade=d=${X}:c1=tri:c2=tri,afade=t=in:st=0:d=2.5,afade=t=out:st=${(total - 3.5).toFixed(3)}:d=3.5,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`;
const inputs = clips.flatMap((c) => ['-i', c.out]).concat(['-i', day, '-i', night]);
const out = `${OUT}/Stillwater-Meadow.mp4`;
ff([...inputs, '-filter_complex', chain + a, '-map', '[v]', '-map', '[a]', '-t', total.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
// a still for a thumbnail: the title over the dawn lake
ff(['-ss', '5.2', '-i', out, '-frames:v', '1', '-q:v', '2', `${OUT}/Stillwater-Meadow-poster.jpg`]);
console.log(`${out}: ${total.toFixed(1)} s (night music from ${nightAt.toFixed(1)} s)`);
void byName;
