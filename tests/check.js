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

if (problems.length) { console.log(problems.join('\n')); console.log(problems.length + ' problems in ' + pages.length + ' pages'); process.exitCode = 1; }
else console.log('check: ' + pages.length + ' pages keep the strict CSP, load nothing and link correctly');
