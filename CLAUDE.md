# Multi-SubAgent Working Rules

## Model
- Every agent, including subagents, uses `claude-haiku-5-5` at `low` effort. Pass `model: "haiku"` on every Agent call. Never use Sonnet or Opus.
- Haiku is weaker at long reasoning: use small steps and checks, not longer thinking. Hard design calls go to the user.

## Start of every task
1. Read `docs/memory.md` (verified facts) and `docs/mistakes.md` (rules to follow).
2. Reuse a fact or a `docs/cache/` result if its source hashes still match. Note any reuse in the worklog.
3. Write a plan: goal, steps, files, check.

## Work
- Split into small steps. Each subagent gets one step with a self-contained prompt (file paths, goal, expected return).
- Launch independent subagents together, in the background, in one turn. Run dependent steps in order.
- Each worker writes a checklist first and ticks each item with evidence (command output or file content).
- Read a file and grep the API name before editing. Fetch (WebSearch/WebFetch) instead of guessing; cite the source.
- A separate `Explore` or `general-purpose` verifier checks each result. Start it as soon as its worker finishes. A worker never grades its own work.
- On failure, send the exact error to a fresh worker. Max 3 loops per step, then report the blocker and what was tried.
- Unsure about a fact, the intended reading, a risky step, or whether a fix is right: stop and ask the user, with options and a recommendation. Don't guess.
- Report only verified results. List anything not run.

## Record
- **Worklog:** append to `docs/worklog/YYYY-MM-DD.md`: Goal, Plan, Changes (files), Test/verification, Result, Revert.
- **Mistakes:** any error (wrong assumption, failed call or check, bad edit, second try) goes in `docs/mistakes.md`: slug, date, what happened, root cause, rule for next time.
- **Memory:** add a fact to `docs/memory.md` only after a verifier passes it: fact, source, date, verifier.
- **Cache:** store step results in `docs/cache/<step-slug>.md` with input sha256 values.

## Shutdown
- An agent stops when its step ends. Don't start agents for finished steps.
- Before the final report, check for running agents. Stop leftovers with `TaskStop` and name them in the report.

## Speed
- Fan out in one turn; pipeline verifiers; keep startup hooks to quick reads.
- Background agents auto-deny prompts: pre-approve what they need first.
- Give parallel editors separate files or worktrees (confirm the worktree field name in official docs).
- Keep `CLAUDE_CODE_PROMPT_CACHE_TTL=1h` (needs Claude Code v2.1.242+; confirm the installed version). Keep reasoning on.

## Safety
- No destructive commands (delete, force-push, overwrite user data) without asking.
- Never commit secrets or API keys.
