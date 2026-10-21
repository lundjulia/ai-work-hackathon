---
name: hackathon
description: Run a time-boxed hackathon build with an agent fleet, from requirements and PRD through parallel worker threads, shared status, integration, deadline scope cuts, and demo and submission delivery, including an HTML pitch deck, optional landing page, and brand or logo exploration. Use in the main thread to plan, delegate, and reconcile work, and in a worker thread that received a hackathon brief. Trigger on hackathon planning, PRD.md or status.md upkeep, briefing or integrating workers, cutting scope near a deadline, demo or pitch preparation, and branding for the hackathon project.
---

# Hackathon

Ship the intended product, demonstrably working, by the deadline. Adapt to the existing stack, tools, and team.

## Role and context

- **Main thread:** owns product understanding, the high-level PRD, priorities, delegation, integration, commits, and delivery.
- **Worker thread:** owns its assigned outcome end to end: domain detail, implementation, docs, and checks.
- Infer the role from the conversation or brief. A short history does not make a worker the coordinator.

Before editing, read `AGENTS.md`, the event context in `docs/`, the PRD, status, the relevant domain docs, and the working tree. `PRD.md`, `status.md`, and domain PRDs are conventions; use existing paths. For setup, ideation, pitch, and panic-mode prompts, read `docs/hackathon_playbook.md`.

Treat examples as test inputs, not the spec. Try fresh scenarios and keep useful old ones as regressions.

## Timeline and scope

The developer drives timing. Agent time estimates are unreliable, so do not estimate durations or plan and cut scope from them.

- Record the deadline with timezone, submission requirements, demo format, and any freezes the developer sets at the top of status.
- Build a thin end-to-end path through the real runtime first, then deepen it.
- Keep a demo candidate: commit the last revision that passes the demo path and record it in status. Replace it only with a revision that also passes.
- Scope cuts, freezes, and mocks that replace intended behavior are the developer's call. Present the trade-off with evidence of actual progress, and label any approved mock in status and in the pitch.

## Specialist work

- App scaffold: use the [scaffold guide](references/scaffold.md) for Next.js on Vercel or a native Swift app. Pick the platforms before creating the app.
- Brand identity, logos, visual directions, brand boards: use the [branding guide](references/branding.md) and include its path in the design worker's brief.
- Web UI: default to shadcn/ui unless the project or native target already has a component system.
- Pitch deck and landing page: use the [presentation guide](references/presentation.md).

## Main thread

- **Map the work.** Capture users, workflow, event requirements, constraints, and open decisions in a concise PRD. Keep facts, decisions, hypotheses, and observed behavior distinct. Split the work into outcomes that can advance in parallel, name the shared interfaces, and delegate early, including discovery and scaffolding. Size the fleet to the independent work available, not to tool capacity.
- **Brief** with the [delegation brief](references/coordination.md#delegation-brief) so a worker can act without chat history. Reuse a domain owner whose context still helps.
- **Interfaces.** Agree on enough of each interface for dependent tracks to proceed. Repeated back-and-forth between tracks means a decision is missing or the split is poor; fix that instead of relaying messages.
- **Reconcile** when a worker completes or reports a cross-domain change, before assigning dependent work, and before delivery. Read the actual diff and evidence, compare them with user intent and other tracks, then accept or correct. Patch the PRD and status, and tell only the affected workers. See [reconciliation](references/coordination.md#main-thread-reconciliation).
- While workers build, integrate, settle product questions, or exercise the running product.

## Worker thread

- Make local decisions within the brief. Raise one actionable question at a time and keep doing unaffected work.
- Implement, verify, and update your domain doc and status entry. Keep intended behavior distinct from tested behavior.
- Report changes to shared interfaces, other tracks' assumptions, or the product understanding to the main thread with evidence, affected work, and a proposal. Mark the change unresolved until it is reconciled. Peers may settle bounded technical questions directly.
- Report blockers immediately: what is blocked, who can resolve it, and your recommendation. On completion, return a [worker result](references/coordination.md#worker-result). Do not narrate every command.

## Shared documents and checkout

| Record             | Owner                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| High-level PRD     | Main thread reconciles; workers propose edits and evidence.                                         |
| Domain PRD or docs | Domain worker; links to global requirements instead of copying them.                                |
| Status             | Any agent patches its own entries; main thread maintains the summary, timeline, and demo candidate. |
| README             | Keep setup and entry points working; link to status.                                                |

Create documents only for an active need. Read the current file, then patch narrowly.

The shared checkout is the default. The Git index, branch, and lockfile are shared:

- Workers edit owned files plus narrow patches to shared docs. Never run `git add -A`, `git add .`, `git stash`, `git checkout`, `git switch`, `git reset`, or a rebase, and never `git restore` others' files. If asked to commit, stage explicit paths.
- Route dependency installs, lockfile changes, and shared config changes through the main thread or one named owner. Sequence single-writer resources such as app builders, migrations, and deploys.
- The main thread owns commits and the demo candidate unless it delegates them. Use a worktree only when requested or when a concrete isolation need justifies it.

## Verify and deliver

- Workers run focused checks; the main thread verifies integration through the real product. Record the revision and environment with each result. Re-check only after a change, a failure, or real doubt.
- Verify real input and output, state transitions, recovery, and target devices. A passing build is not a working workflow. Test AI output with unfamiliar cases as well as regressions.
- Near the deadline, favor integration and required behavior over polish. For a live demo, record a fallback of the demo path. Pitch claims must match the demonstrated candidate.
- Before finishing, check the submission route and public links, record the final candidate and its gaps, and reconcile status. Commits, publishing, deploys, and external messages follow existing authorization; this skill grants none.
