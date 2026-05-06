"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AlertCircle,
  Circle,
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
  mergeHistoryAndDrafts,
  normalizeRealtimeHistory,
  type TranscriptEntry
} from "@/lib/realtime/history";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

type ClientSecretResponse = {
  clientSecret?: string;
  expiresAt?: number;
  model?: string;
  voice?: string;
  error?: string;
};

const VOICES = ["marin", "cedar", "coral", "verse"] as const;

const agentInstructions =
  "Eres una IA de voz en tiempo real. Conversas en espanol de forma clara, natural y breve. Si el usuario mezcla idiomas, sigue su idioma. Mantienes respuestas utiles y conversacionales.";

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

export function RealtimeConsole() {
  const sessionRef = useRef<RealtimeSession | null>(null);
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
  }>({});

  const entries = useMemo(() => {
    return mergeHistoryAndDrafts(
      normalizeRealtimeHistory(history),
      Object.values(drafts)
    ).filter((entry) => entry.text.trim().length > 0);
  }, [drafts, history]);

  const connected = connection === "connected";
  const busy = connection === "connecting";

  const stop = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setConnection("idle");
    setActivity("Desconectado");
    setMuted(false);
  }, []);

  const handleTransportEvent = useCallback((event: TransportEvent) => {
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
  }, []);

  const start = useCallback(async () => {
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
        name: "Asistente Realtime",
        instructions: agentInstructions,
        voice
      });

      const session = new RealtimeSession(agent, {
        transport: "webrtc",
        model: payload.model ?? "gpt-realtime-1.5",
        config: {
          outputModalities: ["audio"],
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
        expiresAt: payload.expiresAt
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
  }, [handleTransportEvent, voice]);

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    sessionRef.current?.mute(nextMuted);
    setMuted(nextMuted);
    setActivity(nextMuted ? "Microfono pausado" : "Escuchando");
  }, [muted]);

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
    setActivity("Respuesta detenida");
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setDrafts({});
    sessionRef.current?.updateHistory([]);
  }, []);

  const sendTextMessage = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const message = textMessage.trim();

      if (!message || !sessionRef.current || !connected) {
        return;
      }

      sessionRef.current.sendMessage(message);
      setTextMessage("");
      setActivity("Mensaje enviado");
    },
    [connected, textMessage]
  );

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Realtime controls">
        <div>
          <p className="eyebrow">OpenAI Realtime API</p>
          <h1>Voice history demo</h1>
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

          <div className="session-meta">
            <div>
              <span>Modelo</span>
              <strong>{sessionMeta.model ?? "gpt-realtime-1.5"}</strong>
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

        <section className="history-panel" aria-label="Conversation history">
          <div className="history-header">
            <div>
              <p className="eyebrow">Historial</p>
              <h2>Tu voz y la IA</h2>
            </div>
            <Waves size={22} />
          </div>

          <div className="timeline" aria-live="polite">
            {entries.length === 0 ? (
              <div className="empty-state">
                <Mic size={28} />
                <p>Sin historial todavia</p>
              </div>
            ) : (
              entries.map((entry) => (
                <article
                  className={`transcript-item role-${entry.role}`}
                  key={entry.id}
                >
                  <div className="transcript-meta">
                    <span>{entry.role === "user" ? "Tu" : "IA"}</span>
                    <span>{entry.status.replace("_", " ")}</span>
                  </div>
                  <p>{entry.text}</p>
                </article>
              ))
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
    </main>
  );
}
