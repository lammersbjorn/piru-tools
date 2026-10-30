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

Found a bug or have an idea? [Open an issue](https://github.com/lammersbjorn/piru-tools/issues).

## Contributing

These tools fix Piru backups from the outside. It would be better if Piru could do these things itself, so the most useful contribution is often a pull request to Piru rather than to this repository.

[Make a prompt to contribute](https://lammersbjorn.github.io/piru-tools/prompt-maker.html) builds a ready-to-paste prompt for an AI coding assistant such as Claude Code, Codex or Cursor. It runs in your browser and sends nothing anywhere.

There are two ways to contribute:

1. **Bring a feature into Piru.** Open a pull request on [kageroumado/piru](https://github.com/kageroumado/piru) that builds one of these tools, or something new, natively into the app. Use the matching page here as the reference for behaviour, edge cases and safety rules, and credit it: "Behaviour based on lammersbjorn/piru-tools (MIT)." The Piru developer decides what gets merged.
2. **Add a tool to this site.** Open a pull request here for a tool you're missing. Copy the structure of an existing page exactly: one standalone HTML file, the same strict Content-Security-Policy with no network access, the shared CSS, the English and French strings, the same footer, and the shared backup parsing that refuses encrypted backups and versions above 2. Edits must change only the intended bytes. Add a small node test on synthetic backups, add the tool to `index.html` and this README, and check the page at phone width in dark and light mode.

For either path:

- Send one small pull request per tool or feature.
- Test on your own copy with made-up data, never a real journal.
- Say in the pull request that it was written with AI assistance, if it was, and that you reviewed and tested it.

**Remove once merged into Piru.** When Piru includes a tool, please open an issue or pull request here that links the merged Piru pull request, so the tool can be removed from this site.

## License

[MIT](LICENSE) © 2026 Bjorn Lammers
