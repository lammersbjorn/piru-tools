// Static check of every page in site/: the strict CSP, no network APIs or external resources,
// and links that resolve. Runtime requests are covered by e2e.js.
const fs = require('fs'), path = require('path');
const SITE = path.join(__dirname, '../site');
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'";
// Places a page may link to. Links are navigation only; the CSP still blocks every request.
const LINK_HOSTS = ['https://github.com/', 'https://lammersbjorn.github.io/piru-tools/'];
const NETWORK_APIS = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|RTCPeerConnection|SharedWorker|serviceWorker)\b|\bimport\(|\bnew\s+Worker\b/;

const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html')).sort();
const problems = [];
const fail = (page, msg) => problems.push(page + ': ' + msg);

if (!pages.includes('index.html')) fail('site', 'index.html is missing');
for (const page of pages) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  const metas = html.match(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/gi) || [];
  if (metas.length !== 1) fail(page, 'expected one CSP meta tag, found ' + metas.length);
  else if (!metas[0].includes('content="' + CSP + '"')) fail(page, 'CSP differs from the strict policy: ' + metas[0]);
  else if (html.indexOf(metas[0]) > html.search(/<(script|style|link)\b/i)) fail(page, 'the CSP meta tag must come before any script, style or link');
  // No external scripts, styles, frames, images or other loaded resources.
  for (const m of html.matchAll(/<(script|link|iframe|frame|embed|object|img|source|audio|video|track|base)\b[^>]*>/gi)) {
    const tag = m[0];
    if (/\bsrc\s*=|<link\b|<base\b|\bdata\s*=/i.test(tag) && !/\bsrc\s*=\s*"data:/i.test(tag)) fail(page, 'loads a resource: ' + tag.slice(0, 120));
  }
  if (/url\(\s*['"]?(https?:)?\/\//i.test(html)) fail(page, 'CSS url() points off the page');
  if (/@import\b/i.test(html)) fail(page, 'CSS @import');
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const code = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const hit = code.match(NETWORK_APIS);
    if (hit) fail(page, 'script uses a network API: ' + hit[0]);
  }
  if (/<form\b[^>]*\baction\s*=/i.test(html)) fail(page, 'form with an action');
  // Links: local pages must exist; external links only to the allowed hosts.
  for (const m of html.matchAll(/\bhref\s*=\s*"([^"]*)"/gi)) {
    const href = m[1];
    if (href.startsWith('#')) continue;
    if (/^[a-z0-9-]+\.html(#.*)?$/.test(href)) { if (!pages.includes(href.split('#')[0])) fail(page, 'broken link ' + href); continue; }
    if (!LINK_HOSTS.some(h => href.startsWith(h))) fail(page, 'link outside the allowed hosts: ' + href);
  }
}
// Every tool is listed on the index.
const index = pages.includes('index.html') ? fs.readFileSync(path.join(SITE, 'index.html'), 'utf8') : '';
for (const page of pages) if (page !== 'index.html' && !index.includes('href="' + page + '"')) fail(page, 'not linked from index.html');

// Every language table has every key English has, with the same shape, on every page, and no
// string or message shows "undefined". The page scripts run in a VM with a stand-in DOM.
const vm = require('vm');
const LANGS = ['en', 'fr', 'zh-Hans', 'es', 'de', 'nl', 'pt-BR', 'ru'];
function pageStrings(page, html, lang) {
  const any = new Proxy(function () {}, {
    get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'then' ? undefined : any,
    apply: () => any, construct: () => any, set: () => true
  });
  const store = { getItem: () => lang, setItem: () => {} };
  const ctx = vm.createContext({ TextDecoder, TextEncoder, Intl, Date, Math, JSON, Map, Set, Number, String, Array, Object, RegExp, Error, console,
    document: any, navigator: { languages: ['en'], language: 'en' }, localStorage: store, setTimeout: () => 0, clearTimeout: () => {},
    requestAnimationFrame: () => 0, matchMedia: () => ({ matches: false }), addEventListener: () => {}, FileReader: function () {}, Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} } });
  ctx.window = ctx;
  for (const m of html.matchAll(/<script id="([a-z-]+)">([\s\S]*?)<\/script>/g)) vm.runInContext(m[2], ctx, { filename: page + '#' + m[1] });
  if (!ctx.PiruUI || !ctx.PiruUI.strings()) throw new Error('no strings');
  return { T: ctx.PiruUI.strings(), PiruUI: ctx.PiruUI, codes: ctx.PiruUI.langs };
}
const BAD = /undefined|NaN|\[object|function \(/;
// Strings shown as HTML: data-i18n-html targets, the steps they are built from, and file errors.
const HTML_KEYS = new Set(pages.flatMap(p => Array.from(fs.readFileSync(path.join(SITE, p), 'utf8').matchAll(/data-i18n-html="([^"]+)"/g), m => m[1])));
const isHTML = w => HTML_KEYS.has(w) || /^step/.test(w) || /^err\./.test(w);
// Sample arguments for message functions: counts that hit every plural form, and names.
const ARGS = [[1, 1, 1, 1], [2, 3, 4, 2], [5, 11, 21, 7], [0, 0, 0, 0], ['a.json', 'B', 'C', 'D'], [1.5, 2, 3, 4]];
function compare(page, l, en, x, where, PiruUI) {
  for (const k of Object.keys(en)) {
    const w = where + k;
    if (!(k in x)) { fail(page, l + ' is missing ' + w); continue; }
    if (typeof en[k] !== typeof x[k] || (en[k] === null) !== (x[k] === null)) { fail(page, l + ' ' + w + ' is ' + typeof x[k] + ', English has ' + typeof en[k]); continue; }
    // Markup only works where English has it too: other strings are set as plain text.
    if (typeof en[k] === 'string') {
      if ((!x[k].trim() && en[k].trim()) || BAD.test(x[k])) fail(page, l + ' ' + w + ' is empty or shows ' + (x[k].match(BAD) || [''])[0]);
      if (/</.test(x[k]) && !isHTML(w)) fail(page, l + ' ' + w + ' has markup, but it is shown as plain text');
    }
    else if (typeof en[k] === 'function') {
      for (const a of ARGS) {
        let e, y;
        try { e = String(en[k].apply(null, a)); } catch (err) { continue; } // English doesn't take these arguments either
        try { y = String(x[k].apply(null, a)); } catch (err) { fail(page, l + ' ' + w + '(' + a + ') throws ' + err.message); break; }
        if (!y.trim() || (BAD.test(y) && !BAD.test(e))) { fail(page, l + ' ' + w + '(' + a + ') gives ' + JSON.stringify(y.slice(0, 80))); break; }
        if (/</.test(y) && !isHTML(w)) { fail(page, l + ' ' + w + ' has markup, but it is shown as plain text'); break; }
      }
    } else if (en[k] && typeof en[k] === 'object') compare(page, l, en[k], x[k], w + '.', PiruUI);
  }
  for (const k of Object.keys(x)) if (!(k in en)) fail(page, l + ' has ' + where + k + ', which English does not have');
}
for (const page of pages) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  let r;
  try { r = pageStrings(page, html, 'en'); } catch (e) { fail(page, 'strings could not be loaded: ' + e.message); continue; }
  if (r.codes.join() !== LANGS.join()) fail(page, 'languages are ' + r.codes.join() + ', expected ' + LANGS.join());
  const menu = (html.match(/<select id="lang"[\s\S]*?<\/select>/) || [''])[0];
  const opts = Array.from(menu.matchAll(/<option value="([^"]+)" lang="([^"]+)">/g)).map(m => m[1] === m[2] ? m[1] : '?');
  if (opts.join() !== LANGS.join()) fail(page, 'the language menu lists ' + opts.join());
  // Plural rules follow the current language, so each table's messages run with it selected.
  for (const l of LANGS) {
    if (l === 'en') continue;
    let x;
    try { x = pageStrings(page, html, l); } catch (e) { fail(page, l + ': strings could not be loaded: ' + e.message); continue; }
    if (x.PiruUI.lang() !== l) { fail(page, l + ' is not selectable'); continue; }
    if (!x.T[l]) { fail(page, 'no ' + l + ' table'); continue; }
    compare(page, l, r.T.en, x.T[l], '', x.PiruUI);
  }
}

if (problems.length) { console.log(problems.join('\n')); console.log(problems.length + ' problems in ' + pages.length + ' pages'); process.exitCode = 1; }
else console.log('check: ' + pages.length + ' pages keep the strict CSP, load nothing, link correctly and have every string in ' + LANGS.length + ' languages');
