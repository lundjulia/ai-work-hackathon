import { createDb } from "@claude-impact-lab/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
