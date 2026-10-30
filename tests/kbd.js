// Keyboard checks in headless Chromium: reach the file input and the main button by Tab, download with Enter.
const SITE = 'file://' + require('path').join(__dirname, '../site/'), FILE = require('path').join(require('os').tmpdir(), 'piru-tools-kbd-' + process.pid + '.json');
{ const G = require('./gen'), fs0 = require('fs'); G.setSeed(2026); fs0.writeFileSync(FILE, G.serialize(G.backup({ sessions: 25, dupes: 1, orphans: 1 }))); process.on('exit', () => { try { fs0.unlinkSync(FILE); } catch (e) {} }); }
const { chromium } = require('playwright');
// Playwright's own headless Chromium; CHROMIUM_PATH overrides it.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
(async () => { const b = await chromium.launch(LAUNCH); let ok = 0, bad = 0;
 for (const pg of ['unit-fixer', 'duplicates', 'split-out']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const p = await ctx.newPage();
  await p.goto(SITE + pg + '.html');
  // Reach the file input by keyboard and check its focus ring shows on the visible button.
  let found = false; for (let i = 0; i < 10 && !found; i++) { await p.keyboard.press('Tab'); found = await p.evaluate(() => document.activeElement.id === 'file'); }
  const ring = await p.evaluate(() => getComputedStyle(document.querySelector('label[for=file]')).outlineStyle);
  await p.setInputFiles('#file', FILE); await p.waitForTimeout(300);
  if (pg !== 'duplicates') { await p.selectOption('#picker-sub', 'Caffeine'); await p.waitForTimeout(150); }
  if (pg === 'unit-fixer') { await p.selectOption('#conv-to', 'g'); await p.waitForTimeout(150); }
  // Tab forward to the main button and press Enter.
  const target = pg === 'split-out' ? 'download-kept' : 'download'; let at = false;
  for (let i = 0; i < 60 && !at; i++) { await p.keyboard.press('Tab'); at = await p.evaluate(t => document.activeElement.id === t, target); }
  let dl = false; if (at) { const ev = p.waitForEvent('download', { timeout: 3000 }).then(() => dl = true).catch(() => {}); await p.keyboard.press('Enter'); await ev; }
  const res = [found, ring !== 'none', at, dl]; console.log(pg, 'file input reachable, ring, button reachable, download by Enter:', res.join(' '));
  res.every(Boolean) ? ok++ : bad++; await ctx.close(); }
 console.log(ok + ' passed, ' + bad + ' failed'); await b.close(); process.exitCode = bad ? 1 : 0; })().catch(e => { console.error(e); process.exit(1); });
