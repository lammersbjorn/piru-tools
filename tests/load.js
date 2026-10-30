// Loads a tool page's logic blocks into a fresh VM context (no DOM).
const fs = require('fs'), vm = require('vm');
const SITE = require('path').join(__dirname, '../site/');
module.exports = function load(page) {
  const html = fs.readFileSync(SITE + page + '.html', 'utf8');
  const ctx = vm.createContext({ TextDecoder, Intl, Date, Math, JSON, Map, Set, console });
  const re = /<script id="(piru-core|tool-logic|piru-logic)">([\s\S]*?)<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(html))) { vm.runInContext(m[2].replace(/^"use strict";/, ''), ctx, { filename: page + '#' + m[1] }); n++; }
  if (!n) throw new Error('no logic in ' + page);
  return ctx;
};
