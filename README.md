# Piru tools

Small, free helpers for [Piru](https://github.com/kageroumado/piru) backups. They run entirely in your browser: your backup never leaves your device.

**Open the tools: https://lammersbjorn.github.io/piru-tools/**

| Tool | What it does |
| --- | --- |
| Inspect a backup | Shows what a backup contains and spots possible problems. Changes nothing. |
| Move entries to another substance | Fixes doses logged under the wrong substance. |
| Remove duplicates | Finds entries logged twice and keeps one of each, using Piru's own rule. |
| Fix units | Converts entries between units, or fixes an amount logged in the wrong unit. |
| Shift entries in time | Moves entries by hours and minutes, or to another date. |
| Split out entries | Moves chosen entries, such as a friend's, into a separate backup. |
| Make a prompt to contribute | Builds a prompt for your AI coding assistant to bring a tool into Piru, or add a new tool here. |

## How they work

1. In Piru, export a normal Piru backup (not an encrypted one). Keep this original file safe.
2. Open a tool, choose the backup, and follow the steps.
3. Download the corrected backup. Your original file is never changed.
4. In Piru, choose Delete Everything, then import the corrected file. Plain Piru imports always merge, so deleting first avoids duplicates.

The tools support Piru backup format version 2 and refuse newer versions, which Piru can't import either. Encrypted backups can't be edited.

## Safety

These tools edit your journal data. They change only the values you choose and keep everything else in the file byte for byte, and they were tested on thousands of made-up backups. Still, always keep your original backup until you've checked the result in Piru. They come with no warranty; see the licence.

## Privacy

Nothing is uploaded, and there are no analytics or cookies. See [PRIVACY.md](PRIVACY.md).

## About

Made by Bjorn Lammers while building Saiko Next, a private journal inspired by Piru. Not affiliated with or endorsed by Piru or its developers. "Piru" is used only to describe compatibility.

Found a bug or have an idea? [Open an issue](https://github.com/lammersbjorn/piru-tools/issues/new/choose). A bug that changes or loses data: see [SECURITY.md](SECURITY.md).

## Contributing

Often the best contribution is a pull request to Piru itself, so it can do these things natively. You can also add a tool here. [Make a prompt to contribute](https://lammersbjorn.github.io/piru-tools/prompt-maker.html) builds a ready-to-paste prompt for an AI coding assistant. [CONTRIBUTING.md](CONTRIBUTING.md) has both paths and the rules.

When Piru includes one of these tools, please [let us know](https://github.com/lammersbjorn/piru-tools/issues/new?template=piru-includes-tool.yml) with the merged Piru pull request, so the tool can be removed here.

## Development

The pages are in `site/`, one standalone HTML file each, with no build step. Tests are in `tests/` and use synthetic backups only.

```bash
npm ci
npx playwright install chromium
npm test           # logic and keyboard tests
npm run check      # strict CSP and no network on every page
npm run test:e2e   # every page in Chromium
```

Pull requests run these checks in CI. Merging to `main` deploys `site/` to GitHub Pages.

## License

[MIT](LICENSE) © 2026 Bjorn Lammers
