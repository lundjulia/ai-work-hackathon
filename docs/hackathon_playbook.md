# Hackathon playbook

A thought scaffold for developers and agents during a hackathon. Use as a flexible reference; adapt to the idea, development progress, and time remaining.

Use [the hackathon skill](../.agents/skills/hackathon/SKILL.md) for main-thread and worker coordination, shared requirements and status, and integration. This playbook supplies event and product prompts as needed.

## Setup

### Pin the hackathon context

Document the context in `docs/`; keep it concise so agents have the context needed to make decisions.

- Timeframe, team size
- Theme
- Judging criteria
- Optional additions and constraints on the solution
- Demo format: live or recorded video
- *Turn the intro transcript into context*

Optimize for a working demo at the deadline, not for clean code.

### Write a one-page brief + rules

- Hard requirements, e.g. deadline, submission requirements

### Define scaffolding early; get the agents started

- What interface / app will the solution be built on? Web, mobile, or both? Frontends are chosen when the app is created.
- Check with the developer for an existing scaffold before creating one.
- Delegate scaffolding to an agent early while the idea and solution take shape. Use the [scaffold guide](../.agents/skills/hackathon/references/scaffold.md) (Better-T-Stack and Vercel), and deploy as soon as it runs.

## Lock Idea

- What are the requirements for the available prizes and tracks? What should the solution optimize for?
- An agent can help brainstorm. Agents often underestimate what is possible within the timeframe. Do not scale down ideas based on agent time estimates alone.
    - Generate 10 ideas; include a one-line pitch, the aha demo moment, and implementation risks.
    - Define hard constraints, e.g. maximum demo duration and whether the solution must be demonstrated live.
    - Is the demo easy to follow? Will it be impressive and spark interest? Does it clearly showcase the technical depth and innovation?
- Consider mock implementations for difficult or deferred features where they help the demo. Use carefully; developer green light required before substituting a mock for intended functionality.

## Plan

- Update `AGENTS.md`; document the key context needed by agents and the team.
- Sketch out `PRD.md`.
    - Have an agent interview the developer or designer to turn their knowledge into the spec. Surface all open questions together rather than one at a time, and propose an answer for each.
    - Explicit "out of scope".
    - Keep milestones few and loose: possible stopping points with something demonstrable if the Panic Button is needed.
- Capture ideas for the demo and what makes the solution special. Revisit as development progresses; finalize the pitch after the build.

## Build

- Delegate complete outcomes using the hackathon skill. Let domain workers implement, document, and verify their work while the main thread reconciles requirements and integration.
- Avoid redundant testing and validation across subagents and the primary agent. Coordinate checks; repeated validation can become a time sink.

## Demoable

- Script out the high-level presentation / pitch. Revisit the hackathon context and idea: what makes this solution special, and what could make it win?

## Panic Button

- Prioritize the remaining work. Suspend new feature development; it is time to reduce scope.
- Bring the current build as close as possible to a demonstrable, deliverable state.
- List features in progress and prioritize fixes needed for the demo.
