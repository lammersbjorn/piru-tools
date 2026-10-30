# Security and data safety

These tools edit people's journal data. A bug that corrupts or loses data, or that could send a backup anywhere, is treated as a security problem.

## Report privately

Report these privately, not in a public issue:

- a tool's output that Piru imports with wrong, missing or extra entries, or that changes values the person didn't choose
- output that Piru refuses to import, or that breaks the original file
- anything that lets a page make a network request or load outside code despite the Content-Security-Policy

Use GitHub's private vulnerability reporting: **[Report a vulnerability](https://github.com/lammersbjorn/piru-tools/security/advisories/new)** (Security tab, "Report a vulnerability"). Only the maintainer can see it.

Include the tool, the browser and device, the steps, and what went wrong. **Never attach a real backup.** If the problem depends on the backup's content, describe its shape or build a small made-up backup that shows it.

## What happens next

You'll get a reply within a week. A confirmed data-corrupting bug is fixed first, with a regression test on synthetic data. If a fix takes time, the affected tool gets a warning or is taken offline in the meantime. You'll be credited in the advisory unless you'd rather not be.

## Supported versions

Only the live site at https://lammersbjorn.github.io/piru-tools/ and the `main` branch are supported. Keep your original backup until you've checked a result in Piru.
