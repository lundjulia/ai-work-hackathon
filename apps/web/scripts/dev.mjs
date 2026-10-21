import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// Local app configuration wins over stale credentials inherited from the agent host.
const local = parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"));
const environment = { ...process.env };
for (const key of ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_REALTIME_DEPLOYMENT"]) {
  if (key in local) environment[key] = local[key];
}
const child = spawn(process.execPath, [new URL("../node_modules/next/dist/bin/next", import.meta.url).pathname, "dev", "--port", "3001"], { stdio: "inherit", env: environment });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
