import type { NextRequest } from "next/server";

import { DEMO_COOKIE, DEMO_USER_ID } from "../demo-session";

export const DEMO_NO_STORE_HEADERS = { "Cache-Control": "no-store" };

type DemoRequestError =
  | { error: "not_signed_in"; status: 401 }
  | { error: "invalid_origin"; status: 403 };

/** The cookie is an approved demo sign-in mock, not production authentication. */
export function checkDemoRequest(request: Pick<NextRequest, "cookies" | "headers" | "url">): DemoRequestError | null {
  if (request.cookies.get(DEMO_COOKIE)?.value !== DEMO_USER_ID) {
    return { error: "not_signed_in", status: 401 };
  }

  const origin = request.headers.get("origin");
  if (
    (origin !== null && origin !== new URL(request.url).origin)
    || request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site"
  ) {
    return { error: "invalid_origin", status: 403 };
  }
  return null;
}

type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; error: "Body too large"; status: 413 }
  | { ok: false; error: "Body must be JSON"; status: 400 };

/** Counts streamed bytes, so absent or understated Content-Length cannot bypass the limit. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError("maxBytes must be a positive integer");

  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) {
    return { ok: false, error: "Body too large", status: 413 };
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    reader = request.body?.getReader();
    if (!reader) return { ok: false, error: "Body must be JSON", status: 400 };

    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        // A stream's cancellation error must not change a size rejection into a JSON error.
        await reader.cancel().catch(() => undefined);
        return { ok: false, error: "Body too large", status: 413 };
      }
      chunks.push(value);
    }

    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(body)) };
  } catch {
    return { ok: false, error: "Body must be JSON", status: 400 };
  } finally {
    reader?.releaseLock();
  }
}
