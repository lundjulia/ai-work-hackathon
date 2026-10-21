---
provenance: Unvetted Synthetic
---

# Google Drive MCP

This repo configures Google's hosted Drive MCP server at `https://drivemcp.googleapis.com/mcp/v1` for Claude Code in `.mcp.json` and Codex in `.codex/config.toml`.

The project folder is [Shared Google Drive](https://drive.google.com/drive/folders/1g5H0jGdhj13NfrhxoRa9aI-Vjjd_4aZi?usp=sharing), with folder ID `1g5H0jGdhj13NfrhxoRa9aI-Vjjd_4aZi`. Include that folder URL or ID in agent requests. The MCP configuration does not restrict access to that folder. Access follows the signed-in account's permissions and granted OAuth scopes.

## Connect

Authentication is per user and is not included in git. Google's authorization server requires a registered OAuth client. A plain login without one fails with `Dynamic client registration not supported`.

- **Codex:** trust this repo when starting Codex so its project configuration loads. The installed CLI's `mcp` subcommands do not load project configuration, so pass the server URL explicitly when checking or logging in:

  ```sh
  codex mcp -c 'mcp_servers.google-drive.url="https://drivemcp.googleapis.com/mcp/v1"' get google-drive
  codex mcp -c 'mcp_servers.google-drive.url="https://drivemcp.googleapis.com/mcp/v1"' login google-drive
  ```

  Configure the registered client's `client_id` and, if required, `client_secret` under `[mcp_servers.google-drive.oauth]` in your private `~/.codex/config.toml` before login. Register the callback URI required by your client. See [Codex OAuth client configuration](https://learn.chatgpt.com/docs/extend/mcp#oauth-client-registration-and-callbacks). Restart the agent session after login to load the tools.
- **Claude Code:** approve the project's `google-drive` MCP entry when prompted, then use `/mcp` to authenticate. Restart the session if the tools do not appear.

  To configure an existing OAuth client without changing the shared repo configuration, add a local override:

  ```sh
  claude mcp add --scope local --transport http --client-id "$GOOGLE_DRIVE_CLIENT_ID" google-drive https://drivemcp.googleapis.com/mcp/v1
  ```

  Add `--client-secret` if the client requires a secret. Claude prompts for it privately. Use `--callback-port` if your client requires a fixed callback port.

Keep client secrets and tokens out of the repository. Register redirect URIs to match your agent client's OAuth callback.

Verify Claude's loaded configuration with `claude mcp get google-drive`. After authentication, ask the agent to list files in the project folder to verify account access. MCP initialization and tool discovery alone do not prove access to Drive files.
