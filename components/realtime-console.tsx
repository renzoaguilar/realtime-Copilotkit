"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AlertCircle,
  Circle,
  ListChecks,
  LoaderCircle,
  Mic,
  MicOff,
  PauseCircle,
  Play,
  Radio,
  Send,
  Square,
  Trash2,
  Waves
} from "lucide-react";
import {
  RealtimeAgent,
  RealtimeSession,
  type RealtimeItem,
  type TransportEvent
} from "@openai/agents/realtime";
import {
  ActionMessage,
  useActionBridgeStore
} from "@/components/actions/action-workbench";
import { createRealtimeActionTools } from "@/lib/actions/realtime-tools";
import {
  getActionAnchors,
  mergeHistoryAndDrafts,
  normalizeRealtimeHistory,
  type TranscriptEntry
} from "@/lib/realtime/history";
import { genericActionCatalog } from "@/lib/actions/action-catalog";
import type { ActionCall } from "@/stores/action-bridge-store";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";
type TimelineEntry =
  | { type: "transcript"; id: string; createdAt: number; entry: TranscriptEntry }
  | {
      type: "action";
      id: string;
      createdAt: number;
      call: ActionCall;
    };

type ClientSecretResponse = {
  clientSecret?: string;
  expiresAt?: number;
  model?: string;
  voice?: string;
  realtimeInstructions?: string;
  transcription?: {
    model: string;
    language: string;
    prompt: string;
  };
  promptSource?: "langfuse" | "fallback";
  error?: string;
};

const VOICES = ["marin", "cedar", "coral", "verse"] as const;

const fallbackAgentInstructions =
  "Eres un asistente de voz generico en tiempo real. Responde en espanol claro, calido y breve.";

function appendDraft(
  drafts: Record<string, TranscriptEntry>,
  draft: Omit<TranscriptEntry, "text">,
  delta: string
) {
  const previous = drafts[draft.id];

  return {
    ...drafts,
    [draft.id]: {
      ...draft,
      text: `${previous?.text ?? ""}${delta}`,
      createdAt: previous?.createdAt ?? draft.createdAt
    }
  };
}

function removeDraft(
  drafts: Record<string, TranscriptEntry>,
  itemId?: string
) {
  if (!itemId || !drafts[itemId]) {
    return drafts;
  }

  const next = { ...drafts };
  delete next[itemId];
  return next;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Ocurrio un error inesperado.";
}

function readTransportError(event: TransportEvent) {
  if (event.type !== "error") {
    return null;
  }

  const maybeError = event.error;

  if (maybeError instanceof Error) {
    return maybeError.message;
  }

  if (
    maybeError &&
    typeof maybeError === "object" &&
    "message" in maybeError &&
    typeof maybeError.message === "string"
  ) {
    return maybeError.message;
  }

  return "El transporte realtime reporto un error.";
}

function stringifyForInstruction(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "null";
  }
}

function buildHumanActionResultInstruction(call: ActionCall) {
  const result = stringifyForInstruction(call.result);

  if (call.status === "cancelled") {
    return `Mensaje interno de la interfaz: el usuario cancelo la action human-in-the-loop ${call.name}. Resultado: ${result}. Responde por voz de forma breve, reconoce la cancelacion y no continues con esa operacion. No menciones que este es un mensaje interno.`;
  }

  return `Mensaje interno de la interfaz: el usuario completo la action human-in-the-loop ${call.name}. Resultado: ${result}. Responde por voz de forma breve y continua con el flujo usando estos datos. No menciones que este es un mensaje interno.`;
}

function sendHiddenRealtimeInstruction(
  session: RealtimeSession,
  instruction: string
) {
  session.transport.sendEvent({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [
        {
          type: "input_text",
          text: instruction
        }
      ]
    }
  });

  if (session.transport.requestResponse) {
    session.transport.requestResponse();
    return;
  }

  session.transport.sendEvent({ type: "response.create" });
}

export function RealtimeConsole() {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const notifiedHumanActionResultsRef = useRef<Set<string>>(new Set());
  const [history, setHistory] = useState<RealtimeItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TranscriptEntry>>({});
  const [connection, setConnection] = useState<ConnectionStatus>("idle");
  const [activity, setActivity] = useState("Listo");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [voice, setVoice] = useState<(typeof VOICES)[number]>("marin");
  const [textMessage, setTextMessage] = useState("");
  const [sessionMeta, setSessionMeta] = useState<{
    model?: string;
    expiresAt?: number;
    promptSource?: string;
  }>({});
  const actionCalls = useActionBridgeStore((state) => state.calls);
  const clearActions = useActionBridgeStore((state) => state.clearCalls);

  const entries = useMemo(() => {
    return mergeHistoryAndDrafts(
      normalizeRealtimeHistory(history),
      Object.values(drafts)
    ).filter((entry) => entry.text.trim().length > 0);
  }, [drafts, history]);

  const actionAnchors = useMemo(() => getActionAnchors(history), [history]);

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const anchorById = new Map(
      actionAnchors.map((anchor) => [anchor.id, anchor.createdAt])
    );

    function getActionPosition(call: ActionCall, index: number) {
      const anchoredAt =
        (call.itemId ? anchorById.get(call.itemId) : undefined) ??
        anchorById.get(call.id);

      if (anchoredAt !== undefined && call.kind === "hitl") {
        const spokenCta = entries.find(
          (entry) => entry.role === "assistant" && entry.createdAt > anchoredAt
        );

        if (spokenCta) {
          return spokenCta.createdAt + 0.1;
        }
      }

      return anchoredAt ?? history.length + index + 1;
    }

    return [
      ...entries.map((entry) => ({
        type: "transcript" as const,
        id: entry.id,
        createdAt: entry.createdAt,
        entry
      })),
      ...actionCalls.map((call, index) => {
        return {
          type: "action" as const,
          id: call.id,
          createdAt: getActionPosition(call, index),
          call
        };
      })
    ].sort((a, b) => a.createdAt - b.createdAt);
  }, [actionAnchors, actionCalls, entries, history.length]);

  const connected = connection === "connected";
  const busy = connection === "connecting";

  useEffect(() => {
    if (!connected || !sessionRef.current) {
      return;
    }

    for (const call of actionCalls) {
      const shouldNotify =
        call.kind === "hitl" &&
        (call.status === "completed" || call.status === "cancelled") &&
        !notifiedHumanActionResultsRef.current.has(call.id);

      if (!shouldNotify) {
        continue;
      }

      notifiedHumanActionResultsRef.current.add(call.id);
      sendHiddenRealtimeInstruction(
        sessionRef.current,
        buildHumanActionResultInstruction(call)
      );
    }
  }, [actionCalls, connected]);

  function stop() {
    sessionRef.current?.close();
    sessionRef.current = null;
    setConnection("idle");
    setActivity("Desconectado");
    setMuted(false);
  }

  function handleTransportEvent(event: TransportEvent) {
    const now = Date.now();
    const transportError = readTransportError(event);

    if (transportError) {
      setError(transportError);
      setConnection("error");
      return;
    }

    switch (event.type) {
      case "conversation.item.input_audio_transcription.delta": {
        const itemId = event.item_id as string | undefined;
        const delta = event.delta as string | undefined;

        if (!itemId || !delta) {
          return;
        }

        setActivity("Transcribiendo tu voz");
        setDrafts((current) =>
          appendDraft(
            current,
            {
              id: itemId,
              role: "user",
              status: "in_progress",
              source: "transport",
              createdAt: now
            },
            delta
          )
        );
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        setActivity("Turno enviado");
        setDrafts((current) =>
          removeDraft(current, event.item_id as string | undefined)
        );
        break;
      }

      case "conversation.item.input_audio_transcription.failed": {
        setError("No se pudo transcribir el audio de entrada.");
        setActivity("Transcripcion fallida");
        break;
      }

      case "response.output_audio_transcript.delta": {
        const itemId = event.item_id as string | undefined;
        const delta = event.delta as string | undefined;

        if (!itemId || !delta) {
          return;
        }

        setActivity("La IA esta respondiendo");
        setDrafts((current) =>
          appendDraft(
            current,
            {
              id: itemId,
              role: "assistant",
              status: "in_progress",
              source: "transport",
              createdAt: now
            },
            delta
          )
        );
        break;
      }

      case "response.output_audio_transcript.done": {
        setActivity("Respuesta completada");
        setDrafts((current) =>
          removeDraft(current, event.item_id as string | undefined)
        );
        break;
      }

      case "input_audio_buffer.speech_started":
        setActivity("Escuchando");
        break;

      case "input_audio_buffer.speech_stopped":
        setActivity("Procesando");
        break;
    }
  }

  async function start() {
    setConnection("connecting");
    setActivity("Conectando");
    setError(null);

    try {
      const response = await fetch("/api/realtime/client-secret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ voice })
      });

      const payload = (await response.json()) as ClientSecretResponse;

      if (!response.ok || !payload.clientSecret) {
        throw new Error(payload.error ?? "No se pudo crear la sesion realtime.");
      }

      const agent = new RealtimeAgent({
        name: "Generic Realtime Assistant",
        instructions: payload.realtimeInstructions ?? fallbackAgentInstructions,
        voice,
        tools: createRealtimeActionTools()
      });

      const session = new RealtimeSession(agent, {
        transport: "webrtc",
        model: payload.model ?? "gpt-realtime-1.5",
        config: {
          outputModalities: ["audio"],
          audio: {
            input: {
              transcription: payload.transcription,
              turnDetection: {
                type: "semantic_vad",
                eagerness: "medium",
                createResponse: true,
                interruptResponse: true
              },
              noiseReduction: {
                type: "near_field"
              }
            },
            output: {
              voice,
              speed: 1
            }
          },
          tracing: "auto"
        }
      });

      session.on("history_updated", setHistory);
      session.on("transport_event", handleTransportEvent);
      session.on("audio_start", () => setActivity("Audio de IA activo"));
      session.on("audio_stopped", () => setActivity("Listo"));
      session.on("audio_interrupted", () => setActivity("Interrumpido"));
      session.on("error", (event) => {
        setConnection("error");
        setError(getErrorMessage(event.error));
      });

      sessionRef.current = session;
      setSessionMeta({
        model: payload.model,
        expiresAt: payload.expiresAt,
        promptSource: payload.promptSource
      });

      await session.connect({
        apiKey: payload.clientSecret
      });

      setConnection("connected");
      setActivity("Conectado");
    } catch (err) {
      sessionRef.current?.close();
      sessionRef.current = null;
      setConnection("error");
      setActivity("Error");
      setError(getErrorMessage(err));
    }
  }

  function toggleMute() {
    const nextMuted = !muted;
    sessionRef.current?.mute(nextMuted);
    setMuted(nextMuted);
    setActivity(nextMuted ? "Microfono pausado" : "Escuchando");
  }

  function interrupt() {
    sessionRef.current?.interrupt();
    setActivity("Respuesta detenida");
  }

  function clearHistory() {
    setHistory([]);
    setDrafts({});
    notifiedHumanActionResultsRef.current.clear();
    clearActions();
    sessionRef.current?.updateHistory([]);
  }

  function sendTextMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = textMessage.trim();

    if (!message || !sessionRef.current || !connected) {
      return;
    }

    sessionRef.current.sendMessage(message);
    setTextMessage("");
    setActivity("Mensaje enviado");
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Realtime controls">
        <div>
          <p className="eyebrow">Realtime Action Framework</p>
          <h1>Voz, historial y actions</h1>
        </div>

        <div className="status-cluster">
          <span className={`status-pill status-${connection}`}>
            {connection === "connecting" ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Circle size={12} fill="currentColor" />
            )}
            {connection}
          </span>
          <span className="activity-pill">
            <Radio size={15} />
            {activity}
          </span>
        </div>
      </section>

      <section className="workspace">
        <aside className="control-panel" aria-label="Session controls">
          <div className="control-group">
            <label htmlFor="voice">Voz</label>
            <select
              id="voice"
              value={voice}
              disabled={connected || busy}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setVoice(event.target.value as (typeof VOICES)[number])
              }
            >
              {VOICES.map((currentVoice) => (
                <option key={currentVoice} value={currentVoice}>
                  {currentVoice}
                </option>
              ))}
            </select>
          </div>

          <div className="button-grid">
            {!connected ? (
              <button className="primary-button" disabled={busy} onClick={start}>
                {busy ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <Play size={18} />
                )}
                Iniciar
              </button>
            ) : (
              <button className="danger-button" onClick={stop}>
                <Square size={17} />
                Detener
              </button>
            )}

            <button
              className="secondary-button"
              disabled={!connected}
              onClick={toggleMute}
              title={muted ? "Reactivar microfono" : "Pausar microfono"}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
              {muted ? "Reactivar" : "Pausar"}
            </button>

            <button
              className="secondary-button"
              disabled={!connected}
              onClick={interrupt}
            >
              <PauseCircle size={18} />
              Cortar IA
            </button>

            <button className="secondary-button" onClick={clearHistory}>
              <Trash2 size={18} />
              Limpiar
            </button>
          </div>

          <section className="action-guide" aria-label="Available actions">
            <div className="action-guide-header">
              <ListChecks size={17} />
              <div>
                <span>Actions disponibles</span>
                <strong>{genericActionCatalog.length} ejemplos</strong>
              </div>
            </div>

            <div className="action-guide-list">
              {genericActionCatalog.map((action) => (
                <article className="action-guide-item" key={action.name}>
                  <div>
                    <strong>{action.title}</strong>
                    <span>{action.kind === "hitl" ? "HITL" : "Vista"}</span>
                  </div>
                  <code>{action.name}</code>
                  <button
                    type="button"
                    onClick={() => setTextMessage(action.examplePrompt)}
                  >
                    {action.examplePrompt}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <div className="session-meta">
            <div>
              <span>Modelo</span>
              <strong>{sessionMeta.model ?? "gpt-realtime-1.5"}</strong>
            </div>
            <div>
              <span>Prompts</span>
              <strong>{sessionMeta.promptSource ?? "pendiente"}</strong>
            </div>
            <div>
              <span>Token</span>
              <strong>
                {sessionMeta.expiresAt
                  ? new Date(sessionMeta.expiresAt * 1000).toLocaleTimeString()
                  : "pendiente"}
              </strong>
            </div>
          </div>

          {error ? (
            <div className="error-box" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          ) : null}
        </aside>

        <section className="main-panel" aria-label="Realtime workspace">
          <section className="history-panel" aria-label="Conversation history">
          <div className="history-header">
            <div>
              <p className="eyebrow">Historial</p>
              <h2>Chat, vistas y aprobaciones</h2>
            </div>
            <Waves size={22} />
          </div>

          <div className="timeline" aria-live="polite">
            {timelineEntries.length === 0 ? (
              <div className="empty-state">
                <Mic size={28} />
                <p>Sin historial todavia</p>
              </div>
            ) : (
              timelineEntries.map((item) =>
                item.type === "action" ? (
                  <div className="action-message" key={item.id}>
                    <ActionMessage call={item.call} />
                  </div>
                ) : (
                  <article
                    className={`transcript-item role-${item.entry.role}`}
                    key={item.id}
                  >
                    <div className="transcript-meta">
                      <span>{item.entry.role === "user" ? "Tu" : "IA"}</span>
                      <span>{item.entry.status.replace("_", " ")}</span>
                    </div>
                    <p>{item.entry.text}</p>
                  </article>
                )
              )
            )}
          </div>

          <form className="text-compose" onSubmit={sendTextMessage}>
            <input
              value={textMessage}
              disabled={!connected}
              onChange={(event) => setTextMessage(event.target.value)}
              placeholder="Mensaje de texto opcional"
            />
            <button disabled={!connected || !textMessage.trim()} type="submit">
              <Send size={18} />
              Enviar
            </button>
          </form>
          </section>
        </section>
      </section>
    </main>
  );
}
