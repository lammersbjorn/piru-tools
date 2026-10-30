<!-- Title: Conventional Commits, such as "fix(unit-fixer): keep the unit when a conversion is cancelled". Squash merges use it as the commit header. See CONTRIBUTING.md. -->

## Summary

<!-- What changed for the person using the tools, and why. Link the issue: Closes #N. For a new tool, say why it can't live in Piru yet. -->

## Testing

<!-- The commands you ran, such as `pnpm test`, and their results, and which pages you checked in a browser: phone width (390 px), dark and light, English and at least one other language. Add screenshots of changed pages, made with made-up data. -->

## Checklist

- [ ] I tested with synthetic, made-up data only. This PR, its tests and its screenshots contain no real backup or journal entries.
- [ ] Every page keeps the strict Content-Security-Policy and makes no network requests (`pnpm check` and `pnpm test:e2e` pass).
- [ ] Edits change only the intended bytes, and new strings are in every language table.

## AI assistance

<!-- Pick one and keep it. -->

- [ ] No AI assistance.
- [ ] Written with AI assistance (name the tool). I reviewed and tested every change myself.
