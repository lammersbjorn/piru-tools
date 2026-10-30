// Synthetic Piru backup generator (made-up data only) and an Apple-style serializer.
let seed = 1;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function setSeed(s) { seed = s; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function uuid() { const h = () => Math.floor(rnd() * 16).toString(16); let s = ''; for (let i = 0; i < 32; i++) s += h(); return (s.slice(0,8)+'-'+s.slice(8,12)+'-4'+s.slice(13,16)+'-a'+s.slice(17,20)+'-'+s.slice(20,32)).toUpperCase(); }
const SUBS = ['Caffeine', 'Melatonin', 'Testsubstanz', 'Ibuprofen', 'Ketamine', 'Café ñ', 'L-Theanine', 'Fakeamine "quoted"', 'Emoji 💊'];
const UNITS = ['mg', 'µg', 'μg', 'g', 'mL', 'IU', 'mg (freebase)', 'MG', 'mcg', 'drops'];
const ROUTES = ['oral', 'insufflated', 'sublingual', 'smoked', 'intravenous', 'other'];
const AMTS = [0, 1, 2.5, 5, 10, 0.1, 0.3, 100, 250, 1e-7, 1.005, 12345.678];
// Serializer mimicking Foundation's JSONEncoder [.prettyPrinted, .sortedKeys]: "k" : v, two-space indent,
// empty arrays as "[\n\n<indent>]", slashes escaped.
function str(s) { return JSON.stringify(s).replace(/\//g, '\\/'); }
function ser(v, ind, opts) {
  opts = opts || {}; const I = opts.indent == null ? '  ' : opts.indent, NL = opts.compact ? '' : (opts.eol || '\n'), C = opts.compact ? ':' : ' : ';
  if (v === null) return 'null';
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return str(v);
  const in1 = ind + I;
  if (Array.isArray(v)) {
    if (!v.length) return opts.compact ? '[]' : '[' + NL + NL + ind + ']';
    return '[' + NL + v.map(x => (opts.compact ? '' : in1) + ser(x, in1, opts)).join(',' + NL) + NL + (opts.compact ? '' : ind) + ']';
  }
  let keys = Object.keys(v); if (!opts.unsorted) keys.sort(); else keys.reverse();
  if (!keys.length) return opts.compact ? '{}' : '{' + NL + NL + ind + '}';
  return '{' + NL + keys.map(k => (opts.compact ? '' : in1) + str(k) + C + ser(v[k], in1, opts)).join(',' + NL) + NL + (opts.compact ? '' : ind) + '}';
}
function serialize(obj, opts) { opts = opts || {}; return (opts.bom ? '﻿' : '') + ser(obj, '', opts) + (opts.trailingNewline ? (opts.eol || '\n') : ''); }

function dose(ts, o) {
  o = o || {};
  const d = { id: uuid(), substance: o.sub || pick(SUBS), amount: o.amount != null ? o.amount : pick(AMTS), unit: o.unit || pick(UNITS), route: o.route || pick(ROUTES),
    timestamp: ts, tags: rnd() < 0.2 ? ['t/1'] : [], isBackgroundMed: false, isApproximate: false, isUnknownDose: rnd() < 0.05 };
  if (rnd() < 0.3) d.notes = 'note ' + Math.floor(rnd() * 100) + (rnd() < 0.5 ? ' with "quotes" and \\ and \n newline' : '');
  if (rnd() < 0.3) d.substanceUID = 'psid:' + d.substance.toLowerCase();
  if (rnd() < 0.1) d.saltForm = 'HCl';
  if (rnd() < 0.1) d.displayNameSnapshot = d.substance;
  return d;
}
function backup(o) {
  o = o || {};
  const nSess = o.sessions != null ? o.sessions : 3 + Math.floor(rnd() * 6);
  let t = o.start || 1700000000000 + Math.floor(rnd() * 1e9);
  const sessions = [], allDoses = [];
  for (let s = 0; s < nSess; s++) {
    const n = o.empty && rnd() < 0.2 ? 0 : 1 + Math.floor(rnd() * 5);
    const doses = [];
    for (let k = 0; k < n; k++) { t += Math.floor(rnd() * 3 * 3600e3) + 1; const d = dose(t); doses.push(d); allDoses.push(d); }
    if (o.dupes && doses.length && rnd() < 0.5) { const c = JSON.parse(JSON.stringify(pick(doses))); c.id = uuid(); doses.push(c); allDoses.push(c); }
    if (o.dupes && doses.length && rnd() < 0.3) { const c = JSON.parse(JSON.stringify(pick(doses))); c.id = uuid(); c.timestamp += 30000; doses.push(c); allDoses.push(c); }
    const sess = { id: uuid(), startDate: doses.length ? Math.min(...doses.map(d => d.timestamp)) : t, doses: doses };
    if (rnd() < 0.4) sess.title = 'Session ' + s;
    if (rnd() < 0.3) sess.note = 'summary';
    if (rnd() < 0.4) sess.notes = [{ id: uuid(), timestamp: t + 1000, text: 'obs', descriptors: [], kind: 'observation' }];
    if (rnd() < 0.3) { sess.checkInIntervalMinutes = 30; sess.checkInOffered = true; }
    sessions.push(sess);
    t += 30 * 3600e3;
  }
  const orphanDoses = [];
  if (o.orphans) for (let k = 0; k < 2; k++) { t += 3600e3; const d = dose(t); orphanDoses.push(d); allDoses.push(d); }
  // A cross-session exact duplicate (Piru keeps the first in file order).
  if (o.dupes && allDoses.length > 2) { const c = JSON.parse(JSON.stringify(allDoses[0])); c.id = uuid(); sessions[sessions.length - 1].doses.push(c); }
  const file = {
    appVersion: 'Piru 9.9 (999)', exportedAt: t + 1000, piruExportVersion: 2, sessions, orphanDoses,
    dailyDoseItems: [{ substance: 'Melatonin', amount: 3, unit: 'mg', route: 'oral', sortOrder: 0, category: 'x', isBackgroundMed: false, frequencyRaw: 'daily', frequencyDays: [], startDate: 1700000000000 }],
    substanceColors: [{ substance: 'Caffeine', p3: { r: 0.5, g: 0.2, b: 0.1 } }],
    favorites: [{ substance: 'Caffeine', createdAt: 1700000000000 }],
    customSubstances: [{ name: 'Testsubstanz', displayName: 'Test' }, { name: 'Emoji 💊' }],
    routineOccurrences: allDoses.slice(0, 3).map(d => ({ routineName: 'r', substance: d.substance, route: d.route, dueDay: 1, state: 'taken', satisfyingEntryID: d.id })),
    inventory: [], quickLogDoses: []
  };
  return file;
}
module.exports = { setSeed, rnd, pick, uuid, serialize, backup, dose, SUBS, UNITS };
