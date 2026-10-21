import type { Context as ApiContext } from "@claude-impact-lab/api/context";
import type { NextRequest } from "next/server";

export async function createContext(_req: NextRequest): Promise<ApiContext> {
  return {};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
