# hckthn

[Shared Google Drive folder](https://drive.google.com/drive/folders/1g5H0jGdhj13NfrhxoRa9aI-Vjjd_4aZi?usp=sharing). [Google Drive MCP setup](docs/google-drive-mcp.md) for agent access.

A hackathon template for developers and agents. Keep context in the repository, get started quickly, and adapt as the idea takes shape.

- [Hackathon skill](.agents/skills/hackathon/SKILL.md): coordinate main and worker threads, with guides for the [app scaffold and Vercel deploy](.agents/skills/hackathon/references/scaffold.md), [branding](.agents/skills/hackathon/references/branding.md), and a reusable HTML presentation.
- [Hackathon playbook](docs/hackathon_playbook.md): a flexible thought scaffold for setup, ideas, planning, building, and the demo.
- [Demo data availability](docs/demo-data-availability.md): fetchable bank data, derived insights, and realistic mock options for Danske Bank, Revolut, and Saxo. [Detailed API reference](docs/open-banking-data-support.md).
- [AGENTS.md](AGENTS.md): coding guidelines; adapt to the project as needed.

## Get started

Use `$hackathon` (Codex) or `/hackathon` (Claude Code) in the main thread. Include the skill in worker briefs so both roles share the same workflow. Tools that do not discover repository skills can read `.agents/skills/hackathon/SKILL.md` directly.

Capture the hackathon context, sketch out `PRD.md`, and scaffold the app with the [scaffold guide](.agents/skills/hackathon/references/scaffold.md). Use an existing status document or create `status.md` when parallel work needs a shared record. Any agent can update it; the main thread reconciles requirements, changes, and evidence as work arrives.
