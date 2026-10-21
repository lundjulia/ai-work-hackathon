---
provenance: Unvetted Synthetic
---

# Google Drive MCP

This repo uses the local, third-party [`@piotr-agier/google-drive-mcp`](https://github.com/piotr-agier/google-drive-mcp) server, pinned to version `2.13.0`. Claude Code loads `.mcp.json`; Codex loads `.codex/config.toml` in a trusted repo. Node.js 18 or later and `npx` are required.

The project folder is [Claude Impact Lab](https://drive.google.com/drive/folders/1g5H0jGdhj13NfrhxoRa9aI-Vjjd_4aZi?usp=sharing), with ID `1g5H0jGdhj13NfrhxoRa9aI-Vjjd_4aZi`. Include the folder ID in agent requests. Access follows the signed-in account's permissions; configuration does not restrict the server to this folder.

## Connect

1. Enable **Google Drive API** in the Google Cloud project that owns your OAuth client.
2. Create a **Desktop app** OAuth client. Configure the consent screen and add yourself as a test user if the app uses external testing.
3. Save the downloaded client JSON outside the repository at `~/.config/google-drive-mcp/gcp-oauth.keys.json`.
4. Authenticate with the same scopes used by the repo configuration:

   ```sh
   GOOGLE_DRIVE_MCP_SCOPES=drive.readonly,drive.file npx -y @piotr-agier/google-drive-mcp@2.13.0 auth
   ```

5. Restart the agent session. Approve Claude Code's project MCP entry or trust the repo in Codex when prompted.

Tokens are stored at `~/.config/google-drive-mcp/tokens.json` and refresh automatically. Keep both credential files private and out of git. Google may expire refresh tokens after seven days for OAuth apps in testing; rerun authentication when needed.

The requested scopes permit reading accessible Drive files and managing files authorized for this app. Additional Docs, Sheets, Slides, or Calendar scopes are not requested by this repo.

## Verify access

Ask the agent to run `search` with `rawQuery: true` and query:

```text
name = 'Claude Impact Lab' and mimeType = 'application/vnd.google-apps.folder' and trashed = false
```

The result should include folder ID `1g5H0jGdhj13NfrhxoRa9aI-Vjjd_4aZi`. Then search for children with:

```text
'1g5H0jGdhj13NfrhxoRa9aI-Vjjd_4aZi' in parents and trashed = false
```

## Hosted Google alternative

Google also offers `https://drivemcp.googleapis.com/mcp/v1`. Its [setup guide](https://developers.google.com/workspace/drive/api/guides/configure-mcp-server) requires approved Google Workspace Developer Preview access, enabled **Google Drive API** and **Drive MCP API**, and an OAuth client with **Use this client for an AI-powered agent** selected.

During setup, the hosted server authenticated and exposed eight tools, but file calls returned "The caller does not have permission" even though the same account could read the project folder through Drive API. The remaining hosted-server denial is unresolved. The repo uses the local server because its MCP folder search succeeded with the same account.
