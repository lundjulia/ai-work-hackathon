"use client";

import { useEffect, useRef, useState } from "react";

import { refreshDemoState } from "@/components/app-state";
import { applyLocalDemoOperation } from "@/lib/demo-operations";
import { getLocalDemoStore } from "@/lib/local-demo-store";
import { LiveTranscripts, liveOffer, liveThinking, liveThinkingParts, validLiveSession, type LiveEvent } from "./live-protocol";
import { voiceArtifactSchema, type VoiceArtifact, type VoiceMode } from "@/lib/voice-artifacts";

export type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";
export type TranscriptEntry =
  | { kind: "user" | "assistant"; id: string; text: string; final: boolean }
  | { kind: "tool"; id: string; name: string; state: "running" | "done" | "error" };
export type ArtifactEntry = {
  callId: string;
  inputRevision: number;
  artifact: VoiceArtifact;
  confirmationState?: "pending" | "saving" | "saved" | "stale" | "error";
  message?: string;
};
export type VoiceOptions = { mode?: VoiceMode; notificationId?: string; autoStart?: boolean };
type ChatMessage = { role: "user" | "assistant"; content: string };
function micErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Allow microphone access to talk, or type below.";
  if (name === "NotFoundError") return "There is no microphone connected. You can type below.";
  if (name === "NotReadableError") return "Another app is using the microphone. You can type below.";
  return "I couldn't start the microphone. You can type below.";
}

/** Keeps bounded, alternating history for the stateless text assistant. */
function chatHistory(messages: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  for (const message of messages) {
    const content = message.content.trim().slice(0, 2_000);
    if (!content) continue;
    const previous = merged.at(-1);
    if (previous?.role === message.role) previous.content = `${previous.content}\n${content}`.slice(-2_000);
    else merged.push({ role: message.role, content });
  }
  while (merged[0]?.role === "assistant") merged.shift();
  while (merged.length > 23 || merged.reduce((total, message) => total + message.content.length, 0) > 24_000) {
    merged.splice(0, 2);
  }
  return merged;
}

export function useRealtimeVoice({ mode = "assistant", notificationId, autoStart = false }: VoiceOptions = {}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [muted, setMuted] = useState(false);
  const [chatPending, setChatPending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [textConversation, setTextConversation] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const textAbortRef = useRef<AbortController | null>(null);
  const attemptRef = useRef(0);
  const chatBusyRef = useRef(false);
  const historyRef = useRef<ChatMessage[]>([]);
  const liveSessionRef = useRef<{ id: string; model: string } | null>(null);
  const liveReadyRef = useRef(false);
  const transcriptsRef = useRef(new LiveTranscripts());
  const delegationRef = useRef<{ id: string; generation: number; abort: AbortController } | null>(null);
  const delegationIdsRef = useRef(new Set<string>());
  const inputGenerationRef = useRef(0);
  const transcriptHistoryRef = useRef(new Map<string, ChatMessage>());
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingCalls = useRef(new Set<string>());
  const mountedRef = useRef(true);

  function upsertText(kind: "user" | "assistant", id: string, update: (previous: string) => string, final: boolean) {
    if (!mountedRef.current) return;
    setEntries((previous) => {
      const index = previous.findIndex((entry) => entry.id === id && entry.kind === kind);
      if (index === -1) return [...previous, { kind, id, text: update(""), final }];
      const next = previous.slice();
      const current = next[index] as Extract<TranscriptEntry, { kind: "user" | "assistant" }>;
      next[index] = { ...current, text: update(current.text), final: final || current.final };
      return next;
    });
  }

  function setTool(id: string, name: string, state: "running" | "done" | "error") {
    if (!mountedRef.current) return;
    setEntries((previous) => {
      const index = previous.findIndex((entry) => entry.kind === "tool" && entry.id === id);
      const entry: TranscriptEntry = { kind: "tool", id, name, state };
      if (index === -1) return [...previous, entry];
      const next = previous.slice();
      next[index] = entry;
      return next;
    });
  }

  function addArtifact(callId: string, inputRevision: number, artifact: VoiceArtifact) {
    if (!mountedRef.current) return;
    setArtifacts((previous) => [...previous.filter((entry) => entry.callId !== callId && (artifact.kind !== "settings" || entry.artifact.kind !== "settings")), {
      callId, inputRevision, artifact,
      ...(artifact.kind === "settings" ? { confirmationState: "pending" as const } : {}),
    }].slice(-12));
  }

  function send(event: object) {
    const channel = dcRef.current;
    if (channel?.readyState !== "open") return false;
    channel.send(JSON.stringify(event));
    return true;
  }

  function teardown() {
    attemptRef.current++;
    voiceAbortRef.current?.abort();
    delegationRef.current?.abort.abort();
    delegationRef.current = null;
    liveSessionRef.current = null;
    liveReadyRef.current = false;
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    pcRef.current?.close();
    micRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    audioRef.current = null;
    voiceAbortRef.current = null;
  }

  function stop() {
    send({ type: "session.close" });
    teardown();
    setStatus("idle");
    setConnected(false);
    setMuted(false);
  }

  async function runDelegation(id: string, attempt: number) {
    const task = { id, generation: -1, abort: new AbortController() };
    delegationRef.current?.abort.abort();
    delegationRef.current = task;
    const current = () => attempt === attemptRef.current && delegationRef.current === task && !task.abort.signal.aborted;
    setTool(id, "Claude financial assistant", "running");
    setStatus("thinking");
    try {
      // Metadata has no task text. Allow trailing transcript fragments to arrive first.
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (!current()) return;
      task.generation = inputGenerationRef.current;
      const conversation = chatHistory([...historyRef.current, ...transcriptHistoryRef.current.values()]);
      while (conversation.at(-1)?.role === "assistant") conversation.pop();
      const messages = conversation.length ? conversation : [{ role: "user" as const, content: notificationId ? "I opened this notification. Explain it and help me choose what to do next." : "Please help me get started." }];
      for (let retry = 0; retry < 2; retry++) {
        const before = await getLocalDemoStore().read();
        const response = await fetch("/api/assistant/chat", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: task.abort.signal,
          body: JSON.stringify({ snapshot: before.state, mode, notificationId, messages }),
        });
        const output = await response.json() as { text?: string; artifacts?: unknown[]; message?: string };
        if (!current() || task.generation !== inputGenerationRef.current) return;
        if (!response.ok || !output.text?.trim() || !Array.isArray(output.artifacts)) throw new Error(output.message ?? "The financial assistant couldn't finish. Please try again.");
        const artifacts = output.artifacts.map((artifact) => voiceArtifactSchema.safeParse(artifact));
        if (artifacts.some((artifact) => !artifact.success)) throw new Error("The assistant returned an unreadable card.");
        const latest = await getLocalDemoStore().read();
        if (latest.revision !== before.revision) continue;
        if (!current()) return;
        artifacts.forEach((artifact, index) => { if (artifact.success) addArtifact(`${id}_${index}`, before.revision, artifact.data); });
        // The authoritative answer remains visible in full even though Live context is bounded.
        upsertText("assistant", `${id}_answer`, () => output.text!, true);
        historyRef.current = chatHistory([...messages, { role: "assistant", content: output.text }]);
        transcriptHistoryRef.current.clear();
        liveThinkingParts(`Financial assistant result for the user's current request: ${output.text}`, id).forEach(send);
        setTool(id, "Claude financial assistant", "done");
        return;
      }
      throw new Error("Your saved information changed. Please ask again for current numbers.");
    } catch (failure) {
      if (!current()) return;
      const message = failure instanceof Error ? failure.message : "The financial assistant couldn't finish.";
      setTool(id, "Claude financial assistant", "error");
      setError(message);
      send(liveThinking(`The financial lookup failed. Explain that current figures could not be verified and ask the user to retry. ${message}`, id));
    } finally {
      if (delegationRef.current === task) delegationRef.current = null;
    }
  }

  function onServerEvent(event: LiveEvent, attempt: number) {
    if (attempt !== attemptRef.current) return;
    if (event.type === "error") { const message = event.error?.message ?? "Voice hit a problem. Please try again."; stop(); setError(message); return; }
    if (event.type === "session.closed") { stop(); return; }
    if (event.type === "session.started") {
      const expected = liveSessionRef.current;
      if (!expected || !validLiveSession(event, expected.id, expected.model)) { stop(); setError("Voice returned an unexpected session configuration."); return; }
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      liveReadyRef.current = true;
      micRef.current?.getAudioTracks().forEach((track) => { track.enabled = true; });
      if (audioRef.current) { audioRef.current.muted = false; if (audioRef.current.srcObject) void audioRef.current.play().catch(() => setError("Tap to allow voice audio in your browser.")); }
      setConnected(true);
      setStatus("listening");
      return;
    }
    if (!liveReadyRef.current || dcRef.current?.readyState !== "open") return;
    const transcript = transcriptsRef.current.append(event);
    if (transcript) {
      upsertText(transcript.role, transcript.id, () => transcript.text, true);
      transcriptHistoryRef.current.set(transcript.id, { role: transcript.role, content: transcript.text });
      if (transcript.role === "user") {
        inputGenerationRef.current++;
        if (delegationRef.current && delegationRef.current.generation >= 0) delegationRef.current.abort.abort();
        setStatus("listening");
      } else {
        setStatus("speaking");
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        // Live has no audio-done event; this reflects transcript inactivity, not a provider turn end.
        statusTimerRef.current = setTimeout(() => { if (attempt === attemptRef.current) setStatus("listening"); }, 1_500);
      }
      return;
    }
    if (event.type === "session.delegation.created") {
      const delegation = event.delegation;
      if (delegation?.target !== "client" || delegation.type !== "delegation" || !delegation.id || delegationIdsRef.current.has(delegation.id)) return;
      delegationIdsRef.current.add(delegation.id);
      void runDelegation(delegation.id, attempt);
    }
  }

  async function start(): Promise<boolean> {
    if (pcRef.current || status === "connecting" || chatBusyRef.current) return connected;
    const attempt = ++attemptRef.current;
    const stale = () => attempt !== attemptRef.current;
    const abort = new AbortController();
    voiceAbortRef.current = abort;
    setError(null);
    setStatus("connecting");
    try {
      const configResponse = await fetch("/api/realtime/session", { cache: "no-store", signal: abort.signal });
      if (stale()) return false;
      if (!configResponse.ok) throw new Error("I couldn't check voice access. Please sign in and try again.");
      const config = await configResponse.json() as { configured?: boolean };
      if (stale()) return false;
      if (!config.configured) {
        setNotConfigured(true);
        stop();
        return false;
      }
      setNotConfigured(false);
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Voice needs HTTPS or localhost and a browser with microphone support. You can type below.");
      let mic: MediaStream;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (failure) { throw new Error(micErrorMessage(failure)); }
      if (stale()) { mic.getTracks().forEach((track) => track.stop()); return false; }
      micRef.current = mic;
      mic.getAudioTracks().forEach((track) => { track.enabled = false; });
      transcriptsRef.current = new LiveTranscripts();
      transcriptHistoryRef.current.clear();
      delegationIdsRef.current.clear();
      const peer = new RTCPeerConnection();
      pcRef.current = peer;
      const audio = new Audio();
      audio.autoplay = true;
      audio.muted = true;
      audioRef.current = audio;
      peer.ontrack = (event) => {
        if (stale()) return;
        audio.srcObject = event.streams[0] ?? null;
        if (!audio.muted) void audio.play().catch(() => setError("Tap the talk button again if your browser blocked the audio."));
      };
      for (const track of mic.getAudioTracks()) peer.addTrack(track, mic);
      peer.onconnectionstatechange = () => {
        if ((peer.connectionState === "failed" || peer.connectionState === "closed") && pcRef.current === peer) {
          stop(); setError("Voice disconnected. You can retry or type below.");
        }
      };
      const channel = peer.createDataChannel("oai-events");
      dcRef.current = channel;
      channel.onopen = () => {
        if (stale()) return;
        if (!liveReadyRef.current) readyTimerRef.current = setTimeout(() => { if (!stale()) { stop(); setError("Voice did not confirm its session. Please retry."); } }, 10_000);
      };
      channel.onclose = () => { if (!stale()) stop(); };
      channel.onmessage = (event) => {
        try { onServerEvent(JSON.parse(event.data as string) as LiveEvent, attempt); }
        catch { setError("I missed a voice response. Please try again."); }
      };
      const offerSdp = await liveOffer(peer, abort.signal);
      const snapshot = (await getLocalDemoStore().read()).state;
      if (stale()) return false;
      const response = await fetch("/api/realtime/session", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
        body: JSON.stringify({ snapshot, mode, notificationId, sdp: offerSdp }),
      });
      const session = await response.json().catch(() => ({})) as { sdp?: string; session_id?: string; model?: string; provider?: string; error?: string; message?: string };
      if (stale()) return false;
      if (response.status === 503 && (session.error === "voice_not_configured" || session.error === "voice_configuration_invalid")) { setNotConfigured(true); stop(); return false; }
      if (!response.ok || !session.sdp || !session.session_id || !session.model || session.provider !== "azure") throw new Error(session.message ?? "Voice couldn't connect. Please retry or type below.");
      liveSessionRef.current = { id: session.session_id, model: session.model };
      await peer.setRemoteDescription({ type: "answer", sdp: session.sdp });
      return true;
    } catch (failure) {
      if (stale()) return false;
      stop();
      setError(failure instanceof Error ? failure.message : "Voice couldn't connect. You can type below.");
      return false;
    }
  }

  async function sendChat(text: string): Promise<boolean> {
    const content = text.trim().slice(0, 2_000);
    if (!content || chatBusyRef.current || status === "connecting") return false;
    chatBusyRef.current = true;
    setChatPending(true);
    setTextConversation(true);
    setTextError(null);
    const abort = new AbortController();
    textAbortRef.current = abort;
    const id = crypto.randomUUID();
    upsertText("user", id, () => content, true);
    const messages = chatHistory([...historyRef.current, ...transcriptHistoryRef.current.values(), { role: "user", content }]);
    transcriptHistoryRef.current.clear();
    historyRef.current = messages;
    try {
      for (let retry = 0; retry < 2; retry++) {
        const before = await getLocalDemoStore().read();
        const response = await fetch("/api/assistant/chat", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
          body: JSON.stringify({ snapshot: before.state, mode, notificationId, messages }),
        });
        const output = await response.json() as { text?: string; artifacts?: unknown[]; message?: string };
        if (!response.ok) throw new Error(output.message ?? "I couldn't answer that just now. Please try again.");
        if (!output.text?.trim() || !Array.isArray(output.artifacts)) throw new Error("I couldn't read the reply. Please try again.");
        const parsed = output.artifacts.map((artifact) => voiceArtifactSchema.safeParse(artifact));
        if (parsed.some((artifact) => !artifact.success)) throw new Error("I couldn't read the card in that reply. Please ask again.");
        const latest = await getLocalDemoStore().read();
        if (latest.revision !== before.revision) continue;
        if (!mountedRef.current || abort.signal.aborted) return false;
        upsertText("assistant", `${id}_reply`, () => output.text!, true);
        historyRef.current = chatHistory([...messages, { role: "assistant", content: output.text }]);
        parsed.forEach((artifact, index) => { if (artifact.success) addArtifact(`${id}_${index}`, before.revision, artifact.data); });
        if (dcRef.current?.readyState === "open") liveThinkingParts(`The user typed: ${content}. The financial assistant answered: ${output.text}`).forEach(send);
        return true;
      }
      throw new Error("Your saved information changed while I checked. Please ask again for the latest numbers.");
    } catch (failure) {
      if (mountedRef.current && !abort.signal.aborted) setTextError(failure instanceof Error ? failure.message : "I couldn't reply. Please try again.");
      return false;
    } finally {
      chatBusyRef.current = false;
      if (mountedRef.current) setChatPending(false);
    }
  }

  async function sendText(text: string) {
    if (dcRef.current?.readyState === "open") {
      inputGenerationRef.current++;
      delegationRef.current?.abort.abort();
    }
    return sendChat(text);
  }

  function updateConfirmation(callId: string, confirmationState: ArtifactEntry["confirmationState"], message?: string) {
    if (!mountedRef.current) return;
    setArtifacts((previous) => previous.map((entry) => entry.callId === callId ? { ...entry, confirmationState, message } : entry));
  }

  async function confirmSettings(entry: ArtifactEntry): Promise<boolean> {
    if (entry.artifact.kind !== "settings" || savingCalls.current.has(entry.callId)
      || entry.confirmationState === "saved" || entry.confirmationState === "stale") return false;
    savingCalls.current.add(entry.callId);
    updateConfirmation(entry.callId, "saving");
    try {
      const store = getLocalDemoStore();
      const current = await store.read();
      if (current.revision !== entry.inputRevision) {
        updateConfirmation(entry.callId, "stale", "Your plan changed. Ask Penny to show the latest plan before saving.");
        return false;
      }
      const next = await applyLocalDemoOperation(current.state, {
        operation: entry.artifact.finishOnboarding ? "completeOnboarding" : "saveGoals", goals: entry.artifact.goals,
      });
      if (!await store.compareAndSwap(entry.inputRevision, next)) {
        updateConfirmation(entry.callId, "stale", "Your plan changed while saving. Please review the latest plan first.");
        return false;
      }
      await refreshDemoState();
      updateConfirmation(entry.callId, "saved", "Saved. Penny will use this plan in future conversations.");
      const saved = (await store.read()).state;
      // The proposal tool already returned. Report this separate, explicit UI confirmation as context.
      void sendText(`settingsSaved:true. I clicked Save my plan. The app has now saved my plan successfully${saved.onboarded ? " and completed onboarding" : ""}. Please use my saved settings from now on and tell me what happens next.`);
      return true;
    } catch (failure) {
      updateConfirmation(entry.callId, "error", failure instanceof Error ? failure.message : "Your plan wasn't saved. Please try again.");
      return false;
    } finally { savingCalls.current.delete(entry.callId); }
  }

  function notifyActionDecision(id: string, decision: "approved" | "dismissed") {
    void sendText(`The app saved my decision for action ${id}: ${decision}. Please check the saved action and explain what this means. If it was a transfer, it was only simulated and no real money moved.`);
  }

  function toggleMute() {
    const next = !muted;
    micRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    send({ type: next ? "session.input_audio.mute" : "session.input_audio.unmute" });
    setMuted(next);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/realtime/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ configured?: boolean }> : null)
      .then((config) => { if (!cancelled && config) setNotConfigured(config.configured === false); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; textAbortRef.current?.abort(); teardown(); };
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    let cancelled = false;
    void start().then((started) => {
      if (!started && !cancelled && mountedRef.current)
        void sendChat(notificationId ? "I opened this notification. Please explain what happened and help me choose what to do next." : "Please help me get started.");
    });
    return () => { cancelled = true; };
    // Start only once for this entry point, never after every transcript update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, mode, notificationId]);

  return {
    status, active: status !== "idle", connected, entries, artifacts, error, textError, notConfigured,
    muted, chatPending, textConversation, start, stop, toggleMute, sendText, confirmSettings, notifyActionDecision,
    clear: () => { setEntries([]); setArtifacts([]); historyRef.current = []; },
  };
}
