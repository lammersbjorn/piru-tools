// Oracle tests: every tool's output must equal an independent edit of the parsed backup,
// serialized in the same layout, byte for byte.
const assert = require('assert');
const load = require('./load'), G = require('./gen');
const enc = s => new TextEncoder().encode(s);
let count = 0, fails = 0;
function test(name, fn) { try { fn(); count++; } catch (e) { fails++; console.log('FAIL', name, '\n ', e.message.split('\n').slice(0, 6).join('\n  ')); } }
const clone = o => JSON.parse(JSON.stringify(o));
const LAYOUTS = [{}, { eol: '\r\n' }, { bom: true, trailingNewline: true }, { compact: true }, { indent: '\t' }, { indent: '    ', trailingNewline: true }];
function eachDose(file, fn) { file.sessions.forEach((s, si) => s.doses.forEach((d, di) => fn(d, si, di))); file.orphanDoses.forEach((d, di) => fn(d, -1, di)); }
function flat(file) { const out = []; eachDose(file, d => out.push(d)); return out; }
// Piru's own import pass (upstream importPiruNative): first row per key wins, in file order.
const piruMs = ts => Math.trunc((((ts / 1000) - 978307200) + 978307200) * 1000);
const amt = a => Object.is(a, -0) ? '-0' : String(a);
function piruKey(d) { return d.substance.toLowerCase() + '|' + piruMs(d.timestamp) + '|' + amt(d.amount) + '|' + d.unit.toLowerCase() + '|' + d.route; }
function piruImportKept(file) { const seen = new Set(), kept = []; flat(file).forEach((d, i) => { const k = piruKey(d); if (!seen.has(k)) { seen.add(k); kept.push(i); } }); return kept; }

// ---------------- Core ----------------
const core = load('index').PiruCore;
test('core: parse rejects duplicate keys or not', () => {
  const r = core.analyze(enc('{"piruExportVersion":2,"sessions":[{"id":"a","startDate":1,"doses":[{"substance":"x","timestamp":1,"timestamp":2,"amount":1,"unit":"mg","route":"oral"}]}]}'), 'a.json');
  assert.ok(!r.ok, 'a dose with two timestamp keys must be refused: tool and Piru may read different values');
});
test('core: parse round-trips every layout', () => {
  for (let s = 1; s <= 40; s++) { G.setSeed(s); const f = G.backup({ dupes: 1, orphans: 1 }); for (const L of LAYOUTS) { const t = G.serialize(f, L); const r = core.analyze(enc(t), 'x.json'); assert.ok(r.ok, 'seed ' + s); assert.strictEqual(core.applyEdits(r.model.text, []), r.model.text); } }
});
test('core: refuses encrypted, psylog, legacy, newer-than-number, non-object', () => {
  const cases = [['{"sealed":"x","kind":"y"}', 'encrypted'], ['{"experiences":[]}', 'psylog'], ['{"doseEntries":[]}', 'legacy'], ['[1]', 'notpiru'], ['{"piruExportVersion":"2"}', 'notpiru'], ['{"piruExportVersion":2.5}', 'notpiru'], ['', 'empty'], ['{"a":1', 'notjson'], ['{"piruExportVersion":2,"sessions":{}}', 'notpiru']];
  cases.forEach(c => { const r = core.analyze(enc(c[0]), 'f.json'); assert.strictEqual(r.ok, false, c[0]); assert.strictEqual(r.error, c[1], c[0]); });
  assert.strictEqual(core.analyze(enc('{}'), 'x.piruenc').error, 'encrypted');
  assert.strictEqual(core.analyze(new Uint8Array([0xff, 0xfe, 0x7b]), 'x.json').error, 'notjson');
});
test('core: Piru refuses a newer format, so the tools must too', () => {
  G.setSeed(5); const f = G.backup(); f.piruExportVersion = 3;
  const r = core.analyze(enc(G.serialize(f)), 'x.json');
  assert.ok(!r.ok && r.error === 'newer', 'version 3: Piru import throws newerFormat; got ' + JSON.stringify(r.ok ? 'ok' : r.error));
});
test('core: convert is exact for mass and volume, micro signs agree', () => {
  const C = core;
  assert.strictEqual(C.convert(500, 'mg', 'g'), 0.5);
  assert.strictEqual(C.convert(0.08, 'g', 'mg'), 80);
  assert.strictEqual(C.convert(0.1, 'mg', 'µg'), 100);
  assert.strictEqual(C.convert(1.005, 'g', 'mg'), 1005);
  assert.strictEqual(C.convert(150, 'μg', 'mg'), 0.15);
  assert.strictEqual(C.convert(150, 'µg', 'μg'), 150);
  assert.strictEqual(C.convert(5, 'MCG', 'mg'), 0.005);
  assert.strictEqual(C.convert(2, ' mL ', 'cc'), 2);
  assert.strictEqual(C.convert(5, 'mL', 'mg'), null);
  assert.strictEqual(C.convert(5, 'mg (freebase)', 'g'), null);
  assert.strictEqual(C.convert(5, 'µg/kg', 'mg'), null);
  assert.strictEqual(C.convert(5, 'IU', 'mg'), null);
  for (let i = 0; i < 2000; i++) { const a = Math.round(Math.random() * 1e6) / 1000; const g = C.convert(a, 'mg', 'g'); assert.strictEqual(C.convert(g, 'g', 'mg'), a, String(a)); }
});
test('core: fromWall handles DST gaps and repeats', () => {
  const C = core, z = 'Europe/Paris';
  const gap = C.fromWall({ y: 2026, mo: 3, d: 29, h: 2, mi: 30, s: 0, ms: 0 }, z);
  assert.ok(gap.gap); assert.strictEqual(new Date(gap.ts).toISOString(), '2026-03-29T01:30:00.000Z');
  const rep = C.fromWall({ y: 2026, mo: 10, d: 25, h: 2, mi: 30, s: 0, ms: 0 }, z);
  assert.ok(rep.ambiguous); assert.strictEqual(new Date(rep.ts).toISOString(), '2026-10-25T00:30:00.000Z');
  const rep2 = C.fromWall({ y: 2026, mo: 10, d: 25, h: 2, mi: 30, s: 0, ms: 0 }, z, 60);
  assert.strictEqual(new Date(rep2.ts).toISOString(), '2026-10-25T01:30:00.000Z');
  // Across a DST change a day shift keeps the wall-clock time.
  const t = Date.parse('2026-03-28T20:15:00.123Z'); // 21:15 CET
  const r = C.shiftDays(t, 2, z); assert.strictEqual(new Date(r.ts).toISOString(), '2026-03-30T19:15:00.123Z');
  const lh = C.shiftDays(Date.parse('2026-04-04T12:00:00Z'), 1, 'Australia/Lord_Howe'); // 30 min DST
  assert.strictEqual(C.dayKey(lh.ts, 'Australia/Lord_Howe'), '2026-04-05');
  assert.strictEqual(C.wall(lh.ts, 'Australia/Lord_Howe').h, C.wall(Date.parse('2026-04-04T12:00:00Z'), 'Australia/Lord_Howe').h);
  assert.strictEqual(C.dayStart('2026-03-29', z), Date.parse('2026-03-28T23:00:00Z'));
  assert.strictEqual(C.dayStart('2026-03-29', z, 1), Date.parse('2026-03-29T22:00:00Z'));
  assert.strictEqual(C.dayStart('2026-10-25', 'America/Sao_Paulo'), Date.parse('2026-10-25T03:00:00Z'));
  assert.strictEqual(C.dayStart('2018-11-04', 'America/Sao_Paulo'), Date.parse('2018-11-04T03:00:00Z')); // midnight skipped by DST
});
test('core: dedupKey matches Piru import key (incl. 1970-era ms truncation, -0)', () => {
  for (const ts of [2, 5, 10, 1700000000123, -1500]) {
    const d = { sub: 'X', ts, amount: -0, unit: 'MG', route: 'oral' };
    assert.strictEqual(core.dedupKey(d), piruKey({ substance: 'X', timestamp: ts, amount: -0, unit: 'MG', route: 'oral' }), String(ts));
  }
});

// ---------------- Duplicates ----------------
const DUP = load('duplicates');
test('duplicates: default removal equals what Piru import skips', () => {
  for (let s = 1; s <= 200; s++) {
    G.setSeed(s); const f = G.backup({ dupes: 1, orphans: s % 2, empty: 1 });
    const r = DUP.PiruCore.analyze(enc(G.serialize(f)), 'x.json'); if (!r.ok) continue;
    const found = DUP.PiruDuplicates.find(r.model);
    const removed = DUP.PiruDuplicates.defaultRemoval(found.exact);
    const kept = new Set(piruImportKept(f));
    r.model.doses.forEach(d => assert.strictEqual(!removed.has(d.i), kept.has(d.i), 'seed ' + s + ' dose ' + d.i));
  }
});
test('duplicates: output equals the oracle byte for byte, all layouts', () => {
  for (let s = 1; s <= 120; s++) for (const L of LAYOUTS) {
    G.setSeed(s); const f = G.backup({ dupes: 1, orphans: s % 2, empty: 1 });
    const text = G.serialize(f, L), r = DUP.PiruCore.analyze(enc(text), 'x.json'); if (!r.ok) continue;
    const m = r.model, D = DUP.PiruDuplicates, found = D.find(m);
    const groups = found.exact.concat(s % 3 ? found.near : []);
    const remove = D.defaultRemoval(groups);
    if (s % 4 === 0 && groups[0]) { remove.delete(groups[0].members[1]); remove.add(groups[0].members[0]); } // keep a later copy
    if (s % 5 === 0 && groups[0]) groups[0].members.forEach(k => remove.add(k)); // remove every copy
    const dropEmpty = s % 2 === 0, dropAlready = s % 3 === 0;
    const p = D.plan(m, remove, { dropEmpty, dropAlreadyEmpty: dropAlready, groups });
    const out = D.apply(m, p);
    // Oracle
    const o = clone(f), all = flat(f), rm = new Set(Array.from(remove).map(k => all[k]));
    const keptFor = new Map();
    groups.forEach(g => { const kept = g.members.find(k => !remove.has(k)); if (kept == null) return; g.members.forEach(k => { if (remove.has(k)) keptFor.set(all[k].id, all[kept].id); }); });
    o.sessions = o.sessions.filter((sess, si) => {
      const orig = f.sessions[si];
      const wasEmpty = !orig.doses.length;
      sess.doses = sess.doses.filter((d, di) => !rm.has(orig.doses[di]));
      if (wasEmpty) return !dropAlready;
      return sess.doses.length || !dropEmpty;
    });
    o.orphanDoses = o.orphanDoses.filter((d, di) => !rm.has(f.orphanDoses[di]));
    o.routineOccurrences.forEach(x => { if (keptFor.has(x.satisfyingEntryID)) x.satisfyingEntryID = keptFor.get(x.satisfyingEntryID); });
    assert.strictEqual(out, G.serialize(o, L), 'seed ' + s + ' layout ' + JSON.stringify(L));
  }
});

// ---------------- Unit fixer ----------------
const UF = load('unit-fixer');
test('unit-fixer: convert and relabel equal the oracle', () => {
  for (let s = 1; s <= 150; s++) for (const L of LAYOUTS.slice(0, 4)) {
    G.setSeed(s); const f = G.backup({ orphans: 1 });
    const text = G.serialize(f, L), r = UF.PiruCore.analyze(enc(text), 'x.json'); if (!r.ok) continue;
    const m = r.model, sub = m.substances[s % m.substances.length].name;
    const idxs = m.doses.filter(d => d.sub === sub && (s % 3 || d.i % 2)).map(d => d.i);
    const action = s % 2 ? { mode: 'convert', to: ['µg', 'mg', 'g', 'mL'][s % 4] } : { mode: 'relabel', to: ['g', 'IU', 'μg', 'mg (freebase)'][s % 4], factor: [1, 1000, 0.001, 2.5][s % 4] };
    const p = UF.PiruUnits.plan(m, idxs, action), out = UF.PiruUnits.apply(m, p);
    const o = clone(f), all = flat(o);
    p.changing.forEach(row => { all[row.i].amount = row.after.amount; all[row.i].unit = row.after.unit; });
    assert.strictEqual(out, G.serialize(o, L), 'seed ' + s);
    // Independent check of the conversion maths.
    p.changing.forEach(row => { if (action.mode === 'convert') { const f2 = { 'µg': 1e-3, 'μg': 1e-3, mcg: 1e-3, ug: 1e-3, mg: 1, g: 1000, ml: 1 }; const a = f2[row.before.unit.trim().toLowerCase()], b = f2[action.to.toLowerCase()]; assert.ok(Math.abs(row.before.amount * a / b - row.after.amount) <= 1e-9 * Math.max(1, Math.abs(row.after.amount)), JSON.stringify(row)); } });
  }
});
test('unit-fixer: µ and μ are distinct units for Piru import, relabel fixes them', () => {
  G.setSeed(9); const f = G.backup({ sessions: 1 }); const d0 = f.sessions[0].doses[0]; d0.unit = 'μg'; d0.substance = 'LSD-test';
  const r = UF.PiruCore.analyze(enc(G.serialize(f)), 'x.json'); const m = r.model;
  const p = UF.PiruUnits.plan(m, [0], { mode: 'convert', to: 'µg' });
  assert.strictEqual(p.changing.length, 1); assert.strictEqual(p.changing[0].after.unit, 'µg'); assert.strictEqual(p.changing[0].after.amount, d0.amount);
  assert.ok(/"unit" : "µg"/.test(UF.PiruUnits.apply(m, p)));
});
test('unit-fixer: factor parsing', () => {
  const P = UF.PiruUnits.parseFactor;
  assert.strictEqual(P('1/1000'), 0.001); assert.strictEqual(P('0,001'), 0.001); assert.strictEqual(P(' 1000 '), 1000);
  assert.strictEqual(P('0'), null); assert.strictEqual(P('abc'), null); assert.strictEqual(P('1/0'), null); assert.strictEqual(P('1e3'), null); assert.strictEqual(P(''), null);
});

// ---------------- Time shift ----------------
const TSP = load('time-shift');
test('time-shift: output equals the oracle (shift and date modes)', () => {
  const zones = ['Europe/Paris', 'America/New_York', 'Australia/Lord_Howe', 'UTC', 'Asia/Kolkata'];
  for (let s = 1; s <= 150; s++) for (const L of LAYOUTS.slice(0, 3)) {
    G.setSeed(s); const f = G.backup({ orphans: s % 2 });
    const text = G.serialize(f, L), r = TSP.PiruCore.analyze(enc(text), 'x.json'); if (!r.ok) continue;
    const m = r.model, zone = zones[s % zones.length], C = TSP.PiruCore;
    const idxs = m.doses.filter(d => (s % 3 === 0) || d.session === (s % m.sessions.length)).map(d => d.i);
    const action = s % 2 ? { mode: 'shift', ms: (s % 5 - 2) * 3600e3 + 7 * 60e3 } : { mode: 'date', day: '2026-03-' + String(20 + s % 10) };
    const p = TSP.PiruTime.plan(m, idxs, action, zone, 1.9e12), shiftNotes = s % 2 === 0;
    const out = TSP.PiruTime.apply(m, p, { shiftNotes });
    const o = clone(f), all = flat(o), sel = new Set(idxs);
    const first = Math.min(...idxs.map(k => all[k].timestamp));
    const days = action.mode === 'date' ? C.daysBetween(C.dayKey(first, zone), action.day) : 0;
    const mv = ts => action.mode === 'shift' ? ts + action.ms : C.shiftDays(ts, days, zone).ts;
    idxs.forEach(k => { all[k].timestamp = mv(all[k].timestamp); });
    o.sessions.forEach((sess, si) => {
      const ks = m.sessions[si].doses; if (!ks.some(k => sel.has(k))) return;
      sess.startDate = Math.min(...sess.doses.map(d => d.timestamp));
      if (shiftNotes && ks.every(k => sel.has(k)) && sess.notes) sess.notes.forEach(n => { n.timestamp = mv(n.timestamp); });
    });
    assert.strictEqual(out, G.serialize(o, L), 'seed ' + s + ' ' + JSON.stringify(action) + ' ' + zone);
    if (action.mode === 'date') idxs.forEach(k => { const b = C.wall(flat(f)[k].timestamp, zone), a = C.wall(all[k].timestamp, zone); if (!p.gaps.includes(k)) assert.ok(a.h === b.h && a.mi === b.mi, 'wall clock kept'); });
  }
});
test('time-shift: timestamps stay integers', () => {
  G.setSeed(77); const f = G.backup(); const r = TSP.PiruCore.analyze(enc(G.serialize(f)), 'x.json');
  const p = TSP.PiruTime.plan(r.model, [0, 1], { mode: 'shift', ms: 1.5 }, 'UTC', 1.9e12);
  const out = JSON.parse(TSP.PiruTime.apply(r.model, p, {}));
  flat(out).forEach(d => assert.ok(Number.isInteger(d.timestamp)));
  out.sessions.forEach(s => assert.ok(Number.isInteger(s.startDate)));
});
test('time-shift: absurd shifts are refused, not written', () => {
  G.setSeed(78); const f = G.backup(); const r = TSP.PiruCore.analyze(enc(G.serialize(f)), 'x.json');
  const p = TSP.PiruTime.plan(r.model, [0], { mode: 'shift', ms: 1e9 * 3600e3 }, 'UTC', 1.9e12);
  assert.ok(p.invalid && p.invalid.length === 1, 'a timestamp outside the dates JavaScript and Piru can show must be flagged');
});

// ---------------- Split out ----------------
const SPL = load('split-out');
test('split-out: kept + split add up to the original, both equal the oracle', () => {
  for (let s = 1; s <= 150; s++) for (const L of LAYOUTS) {
    G.setSeed(s); const f = G.backup({ orphans: s % 2, empty: 1 });
    const text = G.serialize(f, L), r = SPL.PiruCore.analyze(enc(text), 'x.json'); if (!r.ok) continue;
    const m = r.model, sub = m.substances[s % m.substances.length].name;
    const idxs = m.doses.filter(d => d.sub === sub || (s % 4 === 0 && d.session === 0)).map(d => d.i);
    const p = SPL.PiruSplit.plan(m, idxs), inc = s % 2 === 0;
    const kept = SPL.PiruSplit.applyKept(m, p), split = SPL.PiruSplit.applySplit(m, p, { includeCustoms: inc });
    const take = new Set(idxs.map(k => flat(f)[k]));
    const ok = clone(f);
    ok.sessions = ok.sessions.filter((sess, si) => { const orig = f.sessions[si]; const n = orig.doses.length; sess.doses = sess.doses.filter((d, di) => !take.has(orig.doses[di])); return !(n && !sess.doses.length); });
    ok.orphanDoses = ok.orphanDoses.filter((d, di) => !take.has(f.orphanDoses[di]));
    assert.strictEqual(kept, G.serialize(ok, L), 'kept seed ' + s);
    const so = { appVersion: f.appVersion, exportedAt: f.exportedAt, piruExportVersion: 2, orphanDoses: f.orphanDoses.filter(d => take.has(d)), sessions: [] };
    f.sessions.forEach(orig => {
      const td = orig.doses.filter(d => take.has(d)); if (!td.length) return;
      if (td.length === orig.doses.length) { so.sessions.push(clone(orig)); return; }
      const c = clone(orig); SPL.PiruSplit.PARTIAL_DROP.forEach(k => delete c[k]); c.doses = clone(td); c.startDate = Math.min(...td.map(d => d.timestamp)); so.sessions.push(c);
    });
    const subs = new Set(Array.from(take).map(d => d.substance));
    const cs = f.customSubstances.filter(c => subs.has(c.name)); if (inc && cs.length) so.customSubstances = clone(cs);
    assert.strictEqual(split, G.serialize(so, Object.assign({}, L)), 'split seed ' + s + ' ' + JSON.stringify(L));
    const canon = d => G.serialize(d, { compact: true }); const strip = t => JSON.parse(t.replace(/^\uFEFF/, ''));
    const a = flat(strip(kept)).concat(flat(strip(split))).map(canon).sort();
    const b = flat(f).map(canon).sort();
    assert.deepStrictEqual(a, b, 'sum seed ' + s);
  }
});

// ---------------- Move substance ----------------
const MV = load('move-substance');
test('move-substance: only the moved entries and chosen records change', () => {
  for (let s = 1; s <= 150; s++) for (const L of LAYOUTS.slice(0, 4)) {
    G.setSeed(s); const f = G.backup({ orphans: 1 });
    const text = G.serialize(f, L), r = MV.PiruFix.analyze(enc(text), 'x.json'); if (!r.ok) continue;
    const m = r.model; if (m.substances.length < 2) continue;
    const from = m.substances[0].name, to = s % 3 ? m.substances[1].name : 'Brand New ' + s;
    const opts = { shortcuts: s % 2 === 0, meds: s % 3 === 0, stock: false };
    const p = MV.PiruFix.plan(m, from, to, opts), out = MV.PiruFix.apply(m, p);
    const got = JSON.parse(out.replace(/^﻿/, ''));
    const o = clone(f), id = p.identity;
    eachDose(o, d => { if (d.substance !== from) return; d.substance = to; ['isomer', 'releaseForm', 'productName', 'saltForm', 'material'].forEach(k => delete d[k]);
      if (id.uid) d.substanceUID = id.uid; else delete d.substanceUID; if (id.snap) d.displayNameSnapshot = id.snap; else delete d.displayNameSnapshot; });
    const short = id.uid || id.anyUID;
    if (opts.shortcuts && !o.favorites.some(x => x.substance === to)) o.favorites.forEach(x => { if (x.substance === from) { x.substance = to; if (short) x.substanceUID = short; else delete x.substanceUID; } });
    if (opts.meds && !o.dailyDoseItems.some(x => x.substance === to)) {
      o.dailyDoseItems.forEach(x => { if (x.substance === from) { x.substance = to; if (short) x.substanceUID = short; else delete x.substanceUID; } });
      o.routineOccurrences.forEach(x => { if (x.substance === from) { x.substance = to; if (short) x.substanceUID = short; else delete x.substanceUID; } });
    }
    assert.strictEqual(G.serialize(got, { compact: true }), G.serialize(o, { compact: true }), 'seed ' + s);
    // Bytes before the first change are untouched.
    const first = Math.min(...p.doses.map(d => d.node.s), ...Object.values(p.extra).flat().map(x => x.s));
    assert.ok(out.slice(0, first) === text.slice(0, first), 'prefix seed ' + s + ' first=' + first + ' ' + JSON.stringify(L));
  }
});

console.log(count + ' passed, ' + fails + ' failed');
process.exitCode = fails ? 1 : 0;

// ---------------- Regressions for the fixes in this review ----------------
const extra = [];
function test2(name, fn) { try { fn(); count++; } catch (e) { fails++; console.log('FAIL', name, '\n ', e.message.split('\n')[0]); } }
test2('move-substance: refuses a newer format and repeated keys too', () => {
  G.setSeed(5); const f = G.backup(); f.piruExportVersion = 3;
  assert.strictEqual(MV.PiruFix.analyze(enc(G.serialize(f)), 'x.json').error, 'newer');
  const t = G.serialize(G.backup()).replace('"amount" : ', '"amount" : 1, "amount" : ');
  assert.strictEqual(MV.PiruFix.analyze(enc(t), 'x.json').error, 'repeated');
});
test2('inspector: still opens a newer format read-only', () => {
  const I = load('inspector'); G.setSeed(5); const f = G.backup(); f.piruExportVersion = 3;
  const r = I.PiruCore.analyze(enc(G.serialize(f)), 'x.json', { allowNewer: true, allowEmpty: true });
  assert.ok(r.ok && r.model.newer);
});
test2('unit-fixer: typographic minus factor, negative results counted', () => {
  assert.strictEqual(UF.PiruUnits.parseFactor('−1'), -1);
  G.setSeed(9); const r = UF.PiruCore.analyze(enc(G.serialize(G.backup())), 'x.json'); const m = r.model;
  const idx = m.doses.filter(d => d.amount > 0).map(d => d.i).slice(0, 3);
  const p = UF.PiruUnits.plan(m, idx, { mode: 'relabel', to: 'mg', factor: -1 });
  assert.strictEqual(p.negative, p.changing.filter(x => x.after.amount < 0).length); assert.ok(p.negative > 0);
});
test2('time-shift: apply refuses out-of-range times', () => {
  G.setSeed(78); const r = TSP.PiruCore.analyze(enc(G.serialize(G.backup())), 'x.json');
  const p = TSP.PiruTime.plan(r.model, [0], { mode: 'shift', ms: -60 * 365 * 864e5 }, 'UTC', 1.9e12);
  assert.ok(p.invalid.length === 1); assert.throws(() => TSP.PiruTime.apply(r.model, p, {}));
});
test2('all pages: shared core is identical', () => {
  const fs = require('fs'); const re = /<script id="piru-core">([\s\S]*?)<\/script>/; const base = re.exec(fs.readFileSync(require('path').join(__dirname, '../site/index.html'), 'utf8'))[1];
  ['inspector', 'duplicates', 'unit-fixer', 'time-shift', 'split-out', 'move-substance'].forEach(pg => assert.strictEqual(re.exec(fs.readFileSync(require('path').join(__dirname, '../site/') + pg + '.html', 'utf8'))[1], base, pg));
});
console.log('after regressions: ' + count + ' passed, ' + fails + ' failed');
process.exitCode = fails ? 1 : 0;
