# Scaffold

Default: scaffold a Next.js app with [Better-T-Stack](https://better-t-stack.dev) in the repository root, deploy it to Vercel, then build features. The API runs inside Next.js (tRPC route handlers), so one Vercel service serves everything. Verified with `create-better-t-stack` 3.47.0; if flags have changed, check `pnpm create better-t-stack@latest --help`.

## Decide before creating

These choices are fixed at creation time. `add` cannot add apps or auth later.

- **Mobile:** add `native-uniwind` to `--frontend` if the demo needs a phone app (Expo).
- **Database:** Turso or Neon, unless the developer names another.
  - **Turso (SQLite):** `--database sqlite --db-setup turso`. Use for the lightest setup: a local file in development, Turso when deployed.
  - **Neon (Postgres):** `--database postgres --db-setup neon`. Use when you want Postgres features or SQL tooling.
  - **Another database:** run `--help` and check the combination with `--dry-run`.
- **Auth:** `--auth none` unless the idea needs user accounts. If it does, use `--auth better-auth` now; adding it later means wiring it up by hand.

## Create

Start from a clean, committed tree. This example uses Turso and web only:

```bash
pnpm create better-t-stack@latest . --directory-conflict merge \
  --frontend next --backend self --runtime none --api trpc \
  --database sqlite --orm drizzle --db-setup turso --manual-db \
  --auth none --payments none --addons turborepo --examples none \
  --web-deploy vercel --server-deploy none \
  --package-manager pnpm --install --no-git --disable-analytics

mv README.md docs/stack.md   # keep the generated run and deploy notes
git restore .                # the merge replaces README.md and reformats existing Markdown/HTML
```

Then link `docs/stack.md` from the README.

**Env:** `apps/web/.env` is the only env file; the db package reads `DATABASE_*` from it.

- Turso in local development:

  ```
  DATABASE_URL=file:../../local.db
  DATABASE_AUTH_TOKEN=local-dev-token-unused
  ```

  Use a token of 8+ characters, because Varlock fails the build when a short secret value shows up in the build output. For deploys, use the Turso database URL and token.

- Neon: set `DATABASE_URL` to the connection string from the Neon console.

**Run:**

- Push the schema with `pnpm -C packages/db db:push`. The root `pnpm db:push` goes through turbo, which needs an interactive terminal.
- Start the app with `pnpm dev`. Web runs on `http://localhost:3001`.
- For mobile, run `pnpm dev:native` and set `EXPO_PUBLIC_SERVER_URL` in `apps/native/.env` to your LAN IP.

**Notes:**

- Pass every flag shown. An omitted choice opens an interactive prompt, which fails in a non-interactive agent shell. `--manual-db` skips interactive database provisioning.
- Use pnpm, not npm: the generated npm workspaces require npm 11.16 or later.
- Next.js writes `apps/web/AGENTS.md`, which tells agents to read the bundled docs in `node_modules/next/dist/docs/`. Keep it and follow it.
- Generated UI uses shadcn/ui primitives in `packages/ui`.
- For an AI chat starter, use `--examples ai`.

## Deploy to Vercel

Deploy as soon as the scaffold runs, so the delivery route is proven before features depend on it:

```bash
pnpm dlx vercel login      # first time only
pnpm deploy:setup          # link the project
pnpm env:production        # push apps/web/.env values to Vercel; run before the first deploy
pnpm deploy:prod           # or: pnpm env:preview && pnpm deploy
```

- Local `.env` values are the source of truth. Switch them to the hosted database before syncing; a `file:` URL does not persist on Vercel.
- Re-run the env sync and redeploy after any env change. Preview and production keep separate stores.
- `pnpm deploy:check` does a dry run.
- Deployment Protection can block server-side calls on preview URLs. Demo from production, or see the [Vercel guide](https://www.better-t-stack.dev/docs/guides/vercel).
- Expo apps do not deploy to Vercel. Demo mobile in Expo Go or a simulator, with `EXPO_PUBLIC_SERVER_URL` pointed at the deployed URL.

## Native Swift app

The skill, playbook, status, and deck work for any language. For a Swift app:

- **Location:** create the Xcode project in `apps/ios/`, so a Next.js backend can sit in `apps/web/` next to it. pnpm and turbo skip folders without a `package.json`. Commit right after creating the project.
- **Project file:** new Xcode projects use folder-synced groups, so agents can add Swift files without editing `project.pbxproj`. Leave targets, signing, and capabilities to the developer in Xcode.
- **Backend:** skip Better-T-Stack if the app needs none. To keep API keys out of the app binary, or to share data, scaffold the Next.js default and add JSON route handlers under `apps/web/src/app/api/` for the Swift client. Swift cannot call tRPC directly.
- **Verify from the CLI:** list simulators with `xcrun simctl list devices available`, build with `xcodebuild -scheme <App> -destination 'platform=iOS Simulator,name=<device>' build`, and capture the screen with `xcrun simctl io booted screenshot <file>.png`. If no runtime is installed, run `xcodebuild -downloadPlatform iOS`. Agents cannot tap through the UI with `simctl`, so UI flows need an XCUITest or the developer.
- **Demo:** run on a device or the simulator. When the app uses a deployed backend, point it at the production URL.
