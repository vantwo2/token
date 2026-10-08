# Mistakes log

Record every mistake here (format in CLAUDE.md). Read before starting a task.

## Guessed $.ui.notice signature
- Date: 2026-10-08
- What happened: used $.ui.notice(text) in session.end; the real signature is notice(tool_use_id, text).
- Root cause: did not read the signature in the types before writing.
- Fix / rule to follow next time: grep the engine's types file for the exact signature before calling any $ method.

## Indexed array in test without checking for undefined
- Date: 2026-10-08
- What happened: wrote closed[1].status in the agent-monitor test; tsc failed with TS2532 (possibly undefined).
- Root cause: did not type-check the test file before writing it; assumed index access is safe.
- Fix / rule to follow next time: compare whole arrays (map to fields, toEqual) instead of indexing, and run tsc before reporting.
