// Dev tool: the downloaded pines and the code-grown ones measured part by part (tools/studio/pine-study.js),
// printed as a table of averages and saved in full to e:/Games/_assets/previews/pine-study.json. Needs `npm run dev`.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 300)); });
await p.goto('http://127.0.0.1:8080/tools/studio/pine-study.html');
await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
const S = await p.evaluate(() => window.__study);
writeFileSync('e:/Games/_assets/previews/pine-study.json', JSON.stringify(S, null, 1));
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length);
const f = (v, d = 2) => (typeof v === 'number' ? v.toFixed(d) : String(v));
for (const fam of ['kit Pine_', 'code Pine_', 'kit PineTree_', 'code SlimPine_']) {
  const T = [1, 2, 3, 4, 5].map((i) => S[fam + i]), L = T.map((t) => t.leaves), W = T.map((t) => t.wood);
  const m = (g) => f(avg(L.map(g)));
  console.log('\n== ' + fam + '1..5 ==');
  console.log('wood   triangles ' + f(avg(W.map((w) => w.triangles)), 0) + ' pieces ' + f(avg(W.map((w) => w.pieces)), 1) + ' | radius ground ' + f(avg(W.map((w) => (w.radiusAtGround || {}).r || 0))) + ' quarter ' + f(avg(W.map((w) => (w.radiusAtQuarter || {}).r || 0))) + ' half ' + f(avg(W.map((w) => (w.radiusAtHalf || {}).r || 0))) + ' 3/4 ' + f(avg(W.map((w) => (w.radiusAtThreeQuarters || {}).r || 0))));
  console.log('leaves triangles ' + m((l) => l.triangles) + ' pieces ' + m((l) => l.pieces) + ' tris/piece med ' + m((l) => l.trianglesPerPiece.med) + ' max ' + m((l) => l.trianglesPerPiece.max) + ' | area ' + m((l) => l.area) + ' m2, per triangle ' + f(avg(L.map((l) => l.area / l.triangles)), 3));
  console.log('begins at ' + m((l) => l.beginsAtShareOfHeight) + ' of the height | widest ' + m((l) => l.widestShareOfHeight) + ' of the height | tiers ' + m((l) => l.tiers) + ' gap ' + m((l) => l.gapBetweenTiers ? l.gapBetweenTiers.mean : 0) + ' sd ' + m((l) => l.gapBetweenTiers ? l.gapBetweenTiers.sd : 0));
  console.log('silhouette (radius in ten bands, bottom to top): ' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => f(avg(L.map((l) => l.silhouette[k])))).join(' '));
  console.log('piece length med ' + m((l) => l.pieceLength.med) + ' max ' + m((l) => l.pieceLength.max) + ' | drop per metre out: mean ' + m((l) => l.pieceDropPerMetreOut.mean) + ' sd ' + m((l) => l.pieceDropPerMetreOut.sd) + ' | faces level ' + m((l) => l.faceLevelness.mean));
  for (const k of ['bottom', 'middle', 'top']) console.log('  ' + k.padEnd(6) + ' pieces ' + f(avg(L.map((l) => l.thirds[k].pieces)), 1) + ' slope ' + f(avg(L.map((l) => (l.thirds[k].slope || {}).mean || 0))) + ' level ' + f(avg(L.map((l) => (l.thirds[k].level || {}).mean || 0))) + ' reach ' + f(avg(L.map((l) => (l.thirds[k].reach || {}).mean || 0))) + ' normal up ' + f(avg(L.map((l) => (l.thirds[k].normalUp || {}).mean || 0))) + ' shade ' + f(avg(L.map((l) => (l.thirds[k].shade || {}).mean || 0))));
  console.log('normals: up ' + m((l) => l.normalUp.mean) + ' (min ' + m((l) => l.normalUp.min) + ') outward ' + m((l) => l.normalOutward.mean) + ' | vertex shade mean ' + m((l) => l.shade.mean) + ' min ' + m((l) => l.shade.min) + ' max ' + m((l) => l.shade.max));
  console.log('picture used per piece: across ' + m((l) => l.pictureUsed.across.med) + ' along ' + m((l) => l.pictureUsed.along.med) + ' | biggest empty angle round the trunk (bottom, middle, top): ' + [0, 1, 2].map((k) => f(avg(L.map((l) => l.biggestGapRound[k])), 0)).join(', ') + ' degrees | lopsided ' + m((l) => l.lopsided));
  console.log('per tree: tiers ' + L.map((l) => l.tiers).join(',') + ' | pieces per tier (tree 2): ' + L[1].piecesPerTier.join(',') + ' | tier reach (tree 2): ' + L[1].tierReach.join(' '));
}
await b.close();
