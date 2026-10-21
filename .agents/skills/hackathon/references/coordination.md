# Coordination patterns

Use these as checklists, not forms. Adapt existing documents and task tools rather than adding a second tracker.

## Delegation brief

```text
Role: Worker. Main thread/contact: ...
Outcome: The complete result this assignment should produce.
Product context: Relevant user intent, event constraints, and requirements.
Current state: What exists, what has been checked, important uncertainty.
Ownership: Domain/files/resources; known overlaps and their owners.
Dependencies: Inputs, agreed interfaces, consumers, open decisions.
Local authority: Decisions the worker makes; changes to raise with main.
Completion: Behavior/checks required and where to record evidence.
Return: Changed files, decisions, evidence, gaps, effects on other tracks.
```

Give exact paths, the relevant requirement and interface excerpts, and task IDs, without dumping all available context. For an existing owner, send only the change, the next outcome, and the dependency.

Tell workers to load the skill in worker mode: `$hackathon` in Codex, `/hackathon` in Claude Code, or `.agents/skills/hackathon/SKILL.md` directly. Use child-task tools for delegated work and create separate top-level conversations only on request. Follow the orchestration tool's semantics for follow-ups, notifications, and cancellation.

## Shared status

Use `status.md`, an existing status document, or the team's task system. Keep it small and current:

- **Timeline:** the deadline with timezone, submission requirements and route, and any freezes the developer set. Record these from the start.
- **Summary:** current state, the key decision or uncertainty, and the next integration target.
- **Work:** one row per outcome. Workers update their own rows.
- **To reconcile:** the proposed change, its reason, the affected tracks, and an owner. Remove the entry once resolved and record the outcome in its owning document.
- **Demo candidate:** the last revision that passed the demo path, how to run it, its last check and environment, and known gaps.

```markdown
| Outcome | Owner / task | State | Dependency or blocker | Result / evidence |
| ------- | ------------ | ----- | --------------------- | ----------------- |
```

Patch sections narrowly. A completion claim names what was checked; unknown or failed behavior stays explicit.

## Worker result

```text
Outcome: Complete, partial, or blocked, with the concrete result.
Changes: Files and behavior changed, including doc/status edits.
Decisions: Local choices; cross-domain changes needing reconciliation.
Evidence: Checks run, revision/environment, observed results, limits.
Next dependency: What main or another owner must do, if anything.
```

Scale the result to the task; a few sentences can be enough. Send blockers immediately.

## Main-thread reconciliation

Read the changed requirements and code, not just the status label:

- Does the behavior still meet the user's current intent and the event requirements?
- Did a local assumption become a global requirement without being reconciled?
- Have another worker's inputs, interfaces, or completion conditions changed?
- Does the evidence apply to the current candidate?
- Which decision or integration step unlocks the most useful work now?

In a shared checkout, an uncommitted diff can mix several workers' changes; review each worker's named files. Avoid duplicate validation: the worker verifies its domain, and the main thread verifies how it connects. When a worker exposes a flawed assumption, change the plan rather than defending the original split.

## Handoff or resumed work

Identify your role and task, then read the current requirements, status, and recent changes against the latest user instructions. Record task IDs and evidence links before handing off. A stale status entry is a reason to inspect the work, not to redo it.
