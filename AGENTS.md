# Piru tools agent rules

Offline single-page tools for [Piru](https://github.com/kageroumado/piru) backups, served by GitHub Pages at https://lammersbjorn.github.io/piru-tools/. Read [CONTRIBUTING.md](CONTRIBUTING.md) before editing; it holds the rules and the commit format. This file adds what an agent needs on top.

## Layout

| Path | What |
| --- | --- |
| `site/` | The pages. One standalone HTML file per tool, deployed as-is; `site/x.html` is served at `/piru-tools/x.html`. |
| `tests/` | `logic.test.js` (tool logic in a Node VM), `kbd.js` (keyboard), `e2e.js` (Chromium), `check.js` (static CSP and link check), `gen.js` (synthetic backups), `load.js` (loads a page's logic scripts) |
| `.github/` | CI, PR title check, Pages deploy, issue and PR templates |
| `.githooks/commit-msg` | The Conventional Commits header check, also used by CI on PR titles |
| `PRIVACY.md`, `LICENSE` | Linked from every page's footer by URL; keep them at the root |

## Rules

- Each page keeps the exact strict CSP, makes no network requests and loads nothing from outside the file. `npm run check` enforces this.
- Edit pages byte for byte: change only what the task needs. Don't reformat, reindent or reorder a page, and don't touch the `piru-core` script on one page without the same change on every page (`logic.test.js` checks they are identical).
- Every user-visible string goes into both the English and French i18n tables.
- Tools must preserve every byte of a backup they don't intend to change, and refuse encrypted backups and format versions above 2.
- Use synthetic data only. Tests generate backups with `tests/gen.js` at run time. Never read, commit or paste a real backup or journal, and never commit `.json` fixtures.
- No runtime dependencies and no build step. `devDependencies` are for tests only, pinned to exact versions.
- Conventional Commits for commits and PR titles (`fix(unit-fixer): …`); squash merge uses the PR title. Declare AI assistance in the PR template.

## Test

```bash
npm ci
npx playwright install chromium   # once
npm test && npm run check && npm run test:e2e
```

For a page change, also look at the page at 390 px wide in dark and light mode, in English and French. A tool change needs a logic test on synthetic backups that fails without the change.
