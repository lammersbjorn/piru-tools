// End-to-end checks in headless Chromium at 390 px: every page, dark and light, in every language.
// E2E_LANGS=de,nl limits the run to some languages.
const fs = require('fs'), assert = require('assert');
const { chromium } = require('playwright');
const load = require('./load');
// Playwright's own headless Chromium; CHROMIUM_PATH overrides it.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const SITE = 'file://' + require('path').join(__dirname, '../site/'), FILE = require('path').join(require('os').tmpdir(), 'piru-tools-fixture-' + process.pid + '.json');
{ const G = require('./gen'), fs0 = require('fs'); G.setSeed(2026); const f = G.backup({ sessions: 25, dupes: 1, orphans: 1, empty: 1 }); const fl = f.sessions.flatMap(s => s.doses); fl[3].unit = '\u03bcg'; fl[3].substance = 'Caffeine'; fs0.writeFileSync(FILE, G.serialize(f, { trailingNewline: true })); process.on('exit', () => { try { fs0.unlinkSync(FILE); } catch (e) {} }); }
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ZONE = 'Europe/Paris';
const text = fs.readFileSync(FILE, 'utf8'), bytes = new Uint8Array(fs.readFileSync(FILE));
const expected = {};
{ const X = load('duplicates'), m = X.PiruCore.analyze(bytes, 'x').model, f = X.PiruDuplicates.find(m);
  expected['duplicates'] = X.PiruDuplicates.apply(m, X.PiruDuplicates.plan(m, X.PiruDuplicates.defaultRemoval(f.exact), { dropEmpty: true, groups: f.exact })); }
{ const X = load('unit-fixer'), m = X.PiruCore.analyze(bytes, 'x').model; const idx = m.doses.filter(d => d.sub === 'Caffeine').map(d => d.i);
  expected['unit-fixer'] = X.PiruUnits.apply(m, X.PiruUnits.plan(m, idx, { mode: 'convert', to: 'g' })); }
{ const X = load('time-shift'), m = X.PiruCore.analyze(bytes, 'x').model; const idx = m.doses.filter(d => d.sub === 'Caffeine').map(d => d.i);
  expected['time-shift'] = X.PiruTime.apply(m, X.PiruTime.plan(m, idx, { mode: 'shift', ms: 2 * 3600e3 + 30 * 60e3 }, ZONE), { shiftNotes: true }); }
{ const X = load('split-out'), m = X.PiruCore.analyze(bytes, 'x').model; const idx = m.doses.filter(d => d.sub === 'Caffeine').map(d => d.i); const p = X.PiruSplit.plan(m, idx);
  expected['split-out:kept'] = X.PiruSplit.applyKept(m, p); expected['split-out:split'] = X.PiruSplit.applySplit(m, p, { includeCustoms: true }); }
{ const X = load('move-substance'), m = X.PiruFix.analyze(bytes, 'x').model;
  expected['move-substance'] = X.PiruFix.apply(m, X.PiruFix.plan(m, m.substances[0].name, m.substances[1].name, {})); }

const selFirst = async (p, id, i) => { const o = await p.$$eval('#' + id + ' option', os => os.map(o => o.value).filter(v => v && v[0] !== '\u0000')); await p.selectOption('#' + id, o[i || 0]); };
const flows = {
  index: { run: async p => {} },
  'prompt-maker': { run: async p => {} },
  inspector: { run: async p => { await p.setInputFiles('#file', FILE); await p.waitForSelector('#load-status .msg'); await p.click('#details-card > summary'); } },
  'move-substance': { run: async p => { await p.setInputFiles('#file', FILE); await p.waitForSelector('#load-status .msg'); await selFirst(p, 'from'); await selFirst(p, 'to', 0); }, dl: ['#download'] },
  duplicates: { run: async p => { await p.setInputFiles('#file', FILE); await p.waitForSelector('#load-status .msg'); }, dl: ['#download'] },
  'unit-fixer': { run: async p => { await p.setInputFiles('#file', FILE); await p.waitForSelector('#load-status .msg'); await p.selectOption('#picker-sub', 'Caffeine'); await p.selectOption('#conv-to', 'g'); }, dl: ['#download'] },
  'time-shift': { run: async p => { await p.setInputFiles('#file', FILE); await p.waitForSelector('#load-status .msg'); await p.selectOption('#picker-sub', 'Caffeine'); await p.fill('#hours', '2'); await p.fill('#minutes', '30'); }, dl: ['#download'] },
  'split-out': { run: async p => { await p.setInputFiles('#file', FILE); await p.waitForSelector('#load-status .msg'); await p.selectOption('#picker-sub', 'Caffeine'); }, dl: ['#download-kept', '#download-split'] },
};
const LANGS = ['en', 'fr', 'zh-Hans', 'es', 'de', 'nl', 'pt-BR', 'ru'];
const RUN_LANGS = process.env.E2E_LANGS ? process.env.E2E_LANGS.split(',') : LANGS;
let pass = 0, fail = 0; const heights = {}; const problems = [];
function check(name, cond, info) { if (cond) pass++; else { fail++; problems.push(name + (info ? ' ' + info : '')); } }

(async () => {
  const b = await chromium.launch(LAUNCH);
  for (const scheme of ['dark', 'light']) for (const lang of RUN_LANGS) for (const name of Object.keys(flows)) {
    const tag = name + '/' + scheme + '/' + lang;
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, acceptDownloads: true, timezoneId: ZONE, locale: 'en-GB' });
    await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    const p = await ctx.newPage(); const errs = [], reqs = [];
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    p.on('pageerror', e => errs.push(e.message));
    p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
    await p.goto(SITE + name + '.html');
    await p.selectOption('#lang', lang);
    // The menu shows the language, the page is marked with it, and every table has English's keys.
    const m = await p.evaluate(l => { const T = PiruUI.strings(), en = Object.keys(T.en), x = T[l] || {};
      return { value: document.getElementById('lang').value, dir: document.documentElement.dir, label: document.getElementById('lang').getAttribute('aria-label') === x.langLabel,
        saved: localStorage.getItem('piru-tool-lang'), missing: en.filter(k => !(k in x)) }; }, lang);
    check(tag + ' menu', m.value === lang && m.label && m.saved === lang, JSON.stringify(m));
    check(tag + ' dir', m.dir === 'ltr', m.dir);
    check(tag + ' keys', !m.missing.length, m.missing.join());
    const h0 = await p.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
    await flows[name].run(p); await p.waitForTimeout(250);
    const h1 = await p.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
    if (scheme === 'dark' && lang === 'en') heights[name] = { initial: h0, flow: h1 };
    // Structure and accessibility by hand. Footer links are inline text links, which WCAG 2.5.8 exempts from the target size.
    const a = await p.evaluate(() => {
      const vis = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden';
      const out = { h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang, landmarks: ['header', 'main', 'footer'].map(s => document.querySelectorAll('body > ' + s).length) };
      const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(h => +h.tagName[1]); out.headingJump = hs.some((l, i) => i && l > hs[i - 1] + 1);
      out.unlabelled = Array.from(document.querySelectorAll('input,select,button,textarea')).filter(e => e.type !== 'hidden' && (vis(e) || e.type === 'file')).filter(e => { const l = (e.labels && e.labels.length) || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.tagName === 'BUTTON' && e.textContent.trim()); return !l; }).map(e => e.id || e.tagName);
      out.small = Array.from(document.querySelectorAll('a,button,select,input,summary,label.btn,label.check')).filter(vis).filter(e => !e.classList.contains('file-input') && !e.closest('.footer-links')).filter(e => { if (e.type === 'checkbox' || e.type === 'radio') { const l = e.closest('label'); const r = (l || e).getBoundingClientRect(); return r.height < 44; } const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => (e.id || e.tagName) + ':' + e.textContent.trim().slice(0, 20) + ':' + Math.round(e.getBoundingClientRect().height));
      out.overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      out.missingText = Array.from(document.querySelectorAll('[data-i18n],[data-i18n-html]')).filter(e => !e.textContent.trim() || /undefined/.test(e.textContent)).map(e => e.getAttribute('data-i18n') || e.getAttribute('data-i18n-html'));
      out.undef = /undefined|NaN|\[object/.test(document.body.innerText);
      return out;
    });
    check(tag + ' one h1', a.h1 === 1);
    check(tag + ' lang', a.lang === lang);
    check(tag + ' landmarks', a.landmarks.join() === '1,1,1', a.landmarks.join());
    check(tag + ' heading order', !a.headingJump);
    check(tag + ' labels', !a.unlabelled.length, a.unlabelled.join());
    check(tag + ' 44pt targets', !a.small.length, a.small.join(' | '));
    check(tag + ' no horizontal overflow', !a.overflow);
    check(tag + ' strings', !a.missingText.length && !a.undef, a.missingText.join());
    // axe-core from the pinned devDependency.
    await p.evaluate(AXE);
    const ax = await p.evaluate(async () => { const r = await axe.run(document, { resultTypes: ['violations'] }); return r.violations.map(v => v.id + ' x' + v.nodes.length + ': ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')); });
    check(tag + ' axe', !ax.length, ax.join(' || '));
    // Downloads equal the tool logic run in Node.
    for (const sel of flows[name].dl || []) {
      const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]);
      const got = fs.readFileSync(await d.path(), 'utf8');
      const key = name === 'split-out' ? name + (sel === '#download-kept' ? ':kept' : ':split') : name;
      check(tag + ' download ' + key, got === expected[key], got.length + ' vs ' + (expected[key] || '').length);
      const f = await p.evaluate(() => document.activeElement && (document.activeElement.closest('#download-status') ? 'status' : document.activeElement.id));
      check(tag + ' focus after download', f === 'status', f);
    }
    // 200 % zoom: half the CSS width.
    await p.setViewportSize({ width: 195, height: 422 }); await p.waitForTimeout(100);
    const z = await p.evaluate(() => ({ o: document.documentElement.scrollWidth - document.documentElement.clientWidth, clip: Array.from(document.querySelectorAll('main *, header *')).filter(e => e.offsetWidth && !e.closest('.sr-only') && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible' && !['SELECT', 'INPUT'].includes(e.tagName)).map(e => e.id || e.className || e.tagName) }));
    check(tag + ' 200% zoom overflow', z.o <= 0, 'by ' + z.o);
    check(tag + ' 200% clipping', !z.clip.length, z.clip.join());
    const csp = await p.evaluate(() => window.__csp);
    check(tag + ' console', !errs.length, errs.join(' | '));
    check(tag + ' CSP', !csp.length, csp.join());
    check(tag + ' network', !reqs.length, reqs.join());
    await ctx.close();
  }
  // First visit: the browser's languages pick the page language; a choice in the menu wins after that.
  const firstVisit = { 'en-US': 'en', 'fr-CA': 'fr', 'zh-CN': 'zh-Hans', 'zh-Hans-SG': 'zh-Hans', 'zh-TW': 'en', 'es-MX': 'es', 'de-AT': 'de', 'nl-BE': 'nl', 'pt-PT': 'pt-BR', 'pt-BR': 'pt-BR', 'ru-RU': 'ru', 'ja-JP': 'en' };
  for (const [locale, want] of Object.entries(firstVisit)) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale }); const p = await ctx.newPage();
    await p.goto(SITE + 'index.html');
    const got = await p.evaluate(() => [document.documentElement.lang, document.getElementById('lang').value, localStorage.getItem('piru-tool-lang')]);
    check('first visit ' + locale, got[0] === want && got[1] === want && got[2] === null, got.join());
    await ctx.close();
  }
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' }); const p = await ctx.newPage();
    await p.goto(SITE + 'index.html'); await p.selectOption('#lang', 'ru');
    await p.goto(SITE + 'move-substance.html');
    const got = await p.evaluate(() => [document.documentElement.lang, document.getElementById('lang').value, document.title]);
    check('choice persists over the browser language', got[0] === 'ru' && got[1] === 'ru' && /[а-я]/i.test(got[2]), got.join());
    await ctx.close(); }
  await b.close();
  console.log(problems.join('\n')); console.log(pass + ' passed, ' + fail + ' failed'); console.log(JSON.stringify(heights)); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
