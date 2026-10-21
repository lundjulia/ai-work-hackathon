export type LiveEvent = {
  type: string;
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  session?: { id?: string; model?: string; delegation?: { type?: string } | null };
  delegation?: { id?: string; type?: string; target?: string };
  error?: { message?: string };
};

/** Live transcript fragments follow audio cadence, not semantic turn boundaries. */
export class LiveTranscripts {
  private sequence = 0;
  private current: Partial<Record<"user" | "assistant", { id: string; text: string; end: number }>> = {};
  private lastRole?: "user" | "assistant";

  append(event: LiveEvent) {
    const role: "user" | "assistant" | null = event.type === "session.input_transcript.delta" ? "user" : event.type === "session.output_transcript.delta" ? "assistant" : null;
    if (!role || typeof event.delta !== "string" || !event.delta) return null;
    const previous = this.current[role];
    const start = typeof event.start_ms === "number" ? event.start_ms : previous?.end ?? 0;
    const end = typeof event.end_ms === "number" ? event.end_ms : start;
    const newEntry = !previous || this.lastRole !== role || start - previous.end > 1_500;
    const entry = { id: newEntry ? `live_${++this.sequence}` : previous.id, text: (newEntry ? "" : previous.text) + event.delta, end };
    this.current[role] = entry;
    this.lastRole = role;
    return { role, id: entry.id, text: entry.text, fragment: event.delta, newEntry };
  }
}

/** General context uses null; correlated work uses the client delegation ID. No Realtime events. */
export function liveThinking(content: string, delegationId: string | null = null) {
  // 500-token provider limit. A 400-character cap also handles unusually token-dense inputs.
  return { type: "session.thinking.append", event_id: crypto.randomUUID(), delegation_id: delegationId, content: content.slice(0, 400) };
}

/** Repeated appends are documented; preserve the complete answer instead of cutting off figures. */
export function liveThinkingParts(content: string, delegationId: string | null = null) {
  const characters = Array.from(content);
  const parts = [];
  for (let offset = 0; offset < characters.length; offset += 350) {
    parts.push(liveThinking(characters.slice(offset, offset + 350).join(""), delegationId));
  }
  return parts;
}

export function validLiveSession(event: LiveEvent, sessionId: string, model: string) {
  return event.type === "session.started" && event.session?.id === sessionId && event.session.model === model
    && (event.session.delegation == null || event.session.delegation.type === "client");
}

/** Wait for gathered candidates before handing the SDP offer to the server. */
export async function liveOffer(peer: RTCPeerConnection, signal: AbortSignal) {
  await peer.setLocalDescription(await peer.createOffer());
  if (peer.iceGatheringState !== "complete") await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      peer.removeEventListener("icegatheringstatechange", changed);
      signal.removeEventListener("abort", canceled);
      if (error) reject(error); else resolve();
    };
    const changed = () => { if (peer.iceGatheringState === "complete") finish(); };
    const canceled = () => finish(new Error("Voice connection canceled"));
    const timer = setTimeout(() => finish(new Error("Voice couldn't prepare its connection. Please retry.")), 5_000);
    peer.addEventListener("icegatheringstatechange", changed);
    signal.addEventListener("abort", canceled, { once: true });
    if (signal.aborted) canceled(); else changed();
  });
  if (signal.aborted || !peer.localDescription?.sdp) throw new Error("Voice connection canceled");
  return peer.localDescription.sdp;
}
