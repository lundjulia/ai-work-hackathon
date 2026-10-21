"use client";

import { useEffect, useRef, useState } from "react";

// Browser side of the voice feature: WebRTC straight to OpenAI Realtime with an ephemeral key
// from /api/realtime/session. Tool calls are executed through /api/realtime/tool. See docs/voice.md.

export type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export type TranscriptEntry =
  | { kind: "user" | "assistant"; id: string; text: string; final: boolean }
  | { kind: "tool"; id: string; name: string; state: "running" | "done" | "error" };

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

type ServerEvent = {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  item?: { type?: string; call_id?: string; name?: string };
  response?: { output?: { type?: string; call_id?: string; name?: string; arguments?: string }[] };
  error?: { message?: string; code?: string };
};

function micErrorMessage(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access is blocked. Allow the microphone for this site and try again.";
  if (name === "NotFoundError") return "No microphone found.";
  if (name === "NotReadableError") return "The microphone is in use by another app.";
  return "Couldn't start the microphone.";
}

export function useRealtimeVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const attemptRef = useRef(0);
  const handledCalls = useRef(new Set<string>());

  function upsertText(kind: "user" | "assistant", id: string, update: (prev: string) => string, final: boolean) {
    setEntries((prev) => {
      const i = prev.findIndex((e) => e.id === id && e.kind === kind);
      if (i === -1) return [...prev, { kind, id, text: update(""), final }];
      const next = prev.slice();
      const cur = next[i] as Extract<TranscriptEntry, { kind: "user" | "assistant" }>;
      next[i] = { ...cur, text: update(cur.text), final: final || cur.final };
      return next;
    });
  }

  function setTool(id: string, name: string, state: "running" | "done" | "error") {
    setEntries((prev) => {
      const i = prev.findIndex((e) => e.kind === "tool" && e.id === id);
      if (i === -1) return [...prev, { kind: "tool", id, name, state }];
      const next = prev.slice();
      next[i] = { kind: "tool", id, name, state };
      return next;
    });
  }

  function send(event: object) {
    const dc = dcRef.current;
    if (dc?.readyState === "open") dc.send(JSON.stringify(event));
  }

  function teardown() {
    attemptRef.current++;
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    micRef.current?.getTracks().forEach((t) => t.stop());
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    audioRef.current = null;
  }

  function stop() {
    teardown();
    setStatus("idle");
    setMuted(false);
  }

  async function runToolCalls(calls: { call_id: string; name: string; arguments?: string }[]) {
    const results = await Promise.all(
      calls.map(async (c) => {
        setTool(c.call_id, c.name, "running");
        try {
          const res = await fetch("/api/realtime/tool", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: c.name, arguments: c.arguments ?? "{}" }),
          });
          const out = (await res.json()) as { ok: boolean; result?: unknown; error?: string };
          setTool(c.call_id, c.name, out.ok ? "done" : "error");
          return { call_id: c.call_id, output: JSON.stringify(out.ok ? out.result : { error: out.error }) };
        } catch {
          setTool(c.call_id, c.name, "error");
          return { call_id: c.call_id, output: JSON.stringify({ error: "Tool request failed" }) };
        }
      }),
    );
    for (const r of results) {
      send({ type: "conversation.item.create", item: { type: "function_call_output", ...r } });
    }
    send({ type: "response.create" });
  }

  function onServerEvent(ev: ServerEvent) {
    switch (ev.type) {
      case "input_audio_buffer.speech_started":
        setStatus("listening");
        if (ev.item_id) upsertText("user", ev.item_id, (t) => t, false);
        break;
      case "input_audio_buffer.speech_stopped":
        setStatus("thinking");
        break;
      case "conversation.item.input_audio_transcription.delta":
        if (ev.item_id) upsertText("user", ev.item_id, (t) => t + (ev.delta ?? ""), false);
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (ev.item_id) upsertText("user", ev.item_id, () => (ev.transcript ?? "").trim(), true);
        break;
      case "conversation.item.input_audio_transcription.failed":
        if (ev.item_id) upsertText("user", ev.item_id, () => "(couldn't transcribe)", true);
        break;
      case "response.created":
        setStatus((s) => (s === "speaking" ? s : "thinking"));
        break;
      case "response.output_audio_transcript.delta":
        if (ev.item_id) upsertText("assistant", ev.item_id, (t) => t + (ev.delta ?? ""), false);
        break;
      case "response.output_audio_transcript.done":
        if (ev.item_id) upsertText("assistant", ev.item_id, () => ev.transcript ?? "", true);
        break;
      case "response.output_item.added":
        if (ev.item?.type === "function_call" && ev.item.call_id && ev.item.name)
          setTool(ev.item.call_id, ev.item.name, "running");
        break;
      case "output_audio_buffer.started":
        setStatus("speaking");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        setStatus("listening");
        break;
      case "response.done": {
        const calls = (ev.response?.output ?? []).filter(
          (o): o is { type: string; call_id: string; name: string; arguments?: string } =>
            o.type === "function_call" && !!o.call_id && !!o.name && !handledCalls.current.has(o.call_id),
        );
        if (calls.length) {
          calls.forEach((c) => handledCalls.current.add(c.call_id));
          setStatus("thinking");
          void runToolCalls(calls);
        } else {
          setStatus((s) => (s === "thinking" ? "listening" : s));
        }
        break;
      }
      case "error":
        // Non-fatal protocol errors (the call stays up). Surface them for debugging.
        setError(ev.error?.message ?? "Voice error");
        break;
    }
  }

  async function start() {
    if (pcRef.current || status === "connecting") return;
    const attempt = ++attemptRef.current;
    const stale = () => attempt !== attemptRef.current;
    setError(null);
    setStatus("connecting");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice needs a secure page (HTTPS or localhost) and a browser with microphone support.");
      setStatus("idle");
      return;
    }

    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      if (!stale()) {
        setError(micErrorMessage(err));
        setStatus("idle");
      }
      return;
    }
    if (stale()) {
      mic.getTracks().forEach((t) => t.stop());
      return;
    }
    micRef.current = mic;

    try {
      const tokenRes = await fetch("/api/realtime/session", { method: "POST" });
      const token = (await tokenRes.json().catch(() => ({}))) as { value?: string; message?: string; error?: string };
      if (stale()) return;
      if (tokenRes.status === 503) {
        setNotConfigured(true);
        stop();
        return;
      }
      if (!tokenRes.ok || !token.value) throw new Error(token.message ?? token.error ?? "Couldn't start a voice session.");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0] ?? null;
        void audio.play().catch(() => {});
      };
      for (const track of mic.getAudioTracks()) pc.addTrack(track, mic);
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" && pcRef.current === pc) {
          setError("Connection lost.");
          stop();
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => setStatus("listening");
      dc.onmessage = (e) => {
        try {
          onServerEvent(JSON.parse(e.data as string) as ServerEvent);
        } catch {}
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/sdp" },
      });
      if (stale()) return;
      if (!sdpRes.ok) throw new Error(`OpenAI refused the call (${sdpRes.status}).`);
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    } catch (err) {
      if (stale()) return;
      teardown();
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Couldn't connect.");
    }
  }

  function toggleMute() {
    const next = !muted;
    micRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }

  /** Typed fallback: send a text question into the live session. */
  function sendText(text: string) {
    if (dcRef.current?.readyState !== "open") return false;
    const id = `local_${Date.now()}`;
    upsertText("user", id, () => text, true);
    send({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    });
    send({ type: "response.create" });
    setStatus("thinking");
    return true;
  }

  // Check server config up front so the UI can degrade before asking for the mic.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/realtime/session", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ configured?: boolean }>) : null))
      .then((d) => {
        if (!cancelled && d && d.configured === false) setNotConfigured(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Leave the tab or page: hang up and release the microphone.
  useEffect(() => () => teardown(), []);

  return {
    status,
    active: status !== "idle",
    entries,
    error,
    notConfigured,
    muted,
    start,
    stop,
    toggleMute,
    sendText,
    clear: () => setEntries([]),
  };
}
