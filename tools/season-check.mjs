// Dev tool: is the season fixed by place? Loads the game as a player does (no season in the address) on
// two real dates half a game year apart, and prints what the year is doing at home, at a grove's heart,
// and at a temperate, a polar and a tropical spot far to the south. The two columns must be the same.
//   node tools/season-check.mjs        (dev server running; SEED=1)
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const rows = [];
for (const days of [0, 4]) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.addInitScript((ms) => { const now = Date.now.bind(Date); Date.now = () => now() + ms; }, days * 86400000);
  await p.addInitScript(() => { try { const k = Object.keys(localStorage).find((q) => /save|meadow$/i.test(q)); if (k) { const s = JSON.parse(localStorage.getItem(k)); s.season = 'winter'; localStorage.setItem(k, JSON.stringify(s)); } } catch (e) { /* no save yet */ } });
  await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 1) + '&weather=clear#12');
  await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  await p.waitForTimeout(2500);
  rows.push(await p.evaluate(async () => {
    const find = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
    const S = await import(find('/src/core/shape.js')), Y = await import(find('/src/core/year.js')), m = window.__meadow, st = m.year.state, H = S.HOME;
    const heart = S.sitesNear(H.x, H.z, 8000, 'heart')[0], spots = { home: [H.x, H.z], 'grove heart': [heart.x, heart.z] };
    // going south from home: the first land in each belt (and one a long way south, where the other half-year used to be)
    for (let z = H.z; z < H.z + 60000; z += 150) for (const dx of [0, 400, -400, 1200, -1200]) {
      const x = H.x + dx, h = S.height(x, z); if (h < 2 || S.seaAt(x, z) > 0) continue;
      const belt = S.beltOf(S.latitudeAt(x, z)), far = z - H.z > 9000;
      for (const k of [belt + (far ? ', far south' : '')]) if (!spots[k] && k !== 'temperate') spots[k] = [x, z];
    }
    const out = [`year: phase ${st.phase.toFixed(3)}, season value ${st.season.toFixed(3)}, here "${st.nameHere}", home winter ${st.homeWinter}, home lake ice ${st.ice.toFixed(2)}`];
    for (const [name, [x, z]] of Object.entries(spots)) {
      const h = S.height(x, z), c = S.coldAt(x, z, h), y = S.yearAt(x, z), yy = { A: y.A, m: y.m };
      out.push(`${name.padEnd(24)} chill ${c.toFixed(2)} · year moves it ${yy.A.toFixed(2)}, half-year ${yy.m.toFixed(2)} · snow ${Y.snowFrom(c, st.season, yy).toFixed(2)} · leaves ${Y.leavesAt(c, st.season, st.cooling, yy)} · flowers ${Y.flowersOut(c, st.season, st.cooling, yy).toFixed(2)} · wet season ${S.wetSeasonAt(x, z, st.season).toFixed(2)} · grove ${S.groveAt(x, z).toFixed(2)}`);
    }
    return out;
  }));
  await p.close();
}
console.log('today:\n  ' + rows[0].join('\n  ') + '\nfour real days on (half a game year):\n  ' + rows[1].join('\n  '));
console.log(JSON.stringify(rows[0]) === JSON.stringify(rows[1]) ? 'THE SAME on both dates' : 'DIFFERENT between the dates');
await b.close();
