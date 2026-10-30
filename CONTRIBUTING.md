# Contributing to Piru tools

These tools fix Piru backups from the outside. It is better when Piru can do these things itself, so the most useful contribution is often a pull request to [Piru](https://github.com/kageroumado/piru) rather than to this repository.

[Make a prompt to contribute](https://lammersbjorn.github.io/piru-tools/prompt-maker.html) builds a ready-to-paste prompt for an AI coding assistant such as Claude Code, Codex or Cursor, for either path below. It runs in your browser and sends nothing anywhere.

## Two ways to contribute

### 1. Port a tool into Piru

1. Open a pull request on [kageroumado/piru](https://github.com/kageroumado/piru) that builds one of these tools, or something new, natively into the app. Use the matching page in `site/` as the reference for behaviour, edge cases and safety rules, and credit it: "Behaviour based on lammersbjorn/piru-tools (MIT)." The Piru developer decides what gets merged.
2. Once it is merged, open a ["Piru now includes this tool"](https://github.com/lammersbjorn/piru-tools/issues/new?template=piru-includes-tool.yml) issue here with the link to the merged Piru pull request, or a pull request that removes the tool from this site.

### 2. Add a new tool here

Open an issue first if you're unsure whether it fits. Then send one pull request per tool:

1. Copy the structure of an existing page, such as `site/unit-fixer.html`, exactly.
2. Add the tool to `site/index.html` and to the README's table.
3. Add a test in `tests/` that runs the tool's logic on synthetic backups from `tests/gen.js`, and add the page to the flows in `tests/e2e.js`.
4. Check the page in a browser at phone width (390 px), in dark and light mode, in English and French.

## Rules

- **One standalone HTML file per tool**, in `site/`. Inline CSS and JavaScript, no build step, no external files, no frameworks.
- **The strict Content-Security-Policy**, unchanged: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'`.
- **No network.** No requests, analytics, external fonts, scripts or images. A backup never leaves the device.
- **English and French.** Every string goes into both i18n tables, with the same language switch and footer as the other pages.
- **Byte-preserving edits.** A tool changes only the values the person chose. Unknown fields, key order, spacing, line endings and the byte order mark stay exactly as they were. Keep the shared `piru-core` script identical on every page; it refuses encrypted backups and format versions above 2, as Piru does.
- **Data safety.** Show exactly what will change before anything is downloaded, never change the original file, and explain how to import the result into Piru.
- **Tests on synthetic data only.** Tests generate made-up backups at run time. Never commit, attach or paste a real backup, journal entry or screenshot of one, anywhere: code, tests, issues, pull requests.
- **Declare AI help.** If AI wrote any of the change, say so in the pull request, name the tool, and confirm you reviewed and tested it yourself.
- **Small pull requests.** One tool or fix per pull request.

## Development

Needs Node.js (version in `.nvmrc`). The pages themselves need nothing: open any file in `site/` in a browser.

```bash
npm ci
npx playwright install chromium   # once: headless Chromium for the browser tests
git config core.hooksPath .githooks   # once per clone: checks commit headers

npm test            # logic tests on synthetic backups, plus keyboard checks
npm run check       # every page keeps the strict CSP, loads nothing, links resolve
npm run test:e2e    # every page in Chromium: dark and light, English and French, axe, downloads, no requests
```

All three run in CI on every pull request.

## Commits and pull requests

Commits and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): subject`.

- **Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `revert`.
- **Scopes** (optional, lowercase): a tool's page name, such as `duplicates`, `unit-fixer`, `time-shift`, `split-out`, `move-substance`, `inspector`, `prompt-maker` or `index`; `core` for the shared backup parsing; `site` for changes across pages; `i18n` for translations; `deps` for dependencies.
- **Subject:** imperative, lowercase unless it starts with a name, no trailing period, header at most 72 characters.
- **Breaking changes:** add `!` after the type or scope, such as `feat(core)!: …`, when a tool's output or a page URL changes in a way people notice.

Examples:

```text
feat(duplicates): keep the entry with a note when two match
fix(site): move focus to the download status on every page
docs: explain how to import a fixed backup
test(time-shift): cover the daylight saving gap
ci: cache the Playwright browser
chore(deps): bump playwright to 1.65.0
```

Pull requests are squash-merged, and the pull request title becomes the commit header, so CI checks the title with `.githooks/commit-msg`. Fill in the pull request template. Merging needs the `PR title follows Conventional Commits`, `Tests` and `End-to-end (Chromium)` checks to pass. Merging to `main` deploys `site/` to GitHub Pages.

## Reporting problems

Bugs and ideas: [open an issue](https://github.com/lammersbjorn/piru-tools/issues/new/choose). A bug that changes, loses or exposes data: report it privately, as [SECURITY.md](SECURITY.md) describes.

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE) and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
