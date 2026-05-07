# Realtime Action Framework

Base generica con Next.js, OpenAI Realtime por WebRTC, historial de voz y un
primer puente de actions visuales/human-in-the-loop. La idea es poder adaptar
despues el mismo esqueleto a banca, salud, retail, soporte, operaciones u otro
sector sin cambiar la arquitectura principal.

## Que incluye

- `app/api/realtime/client-secret/route.ts`: crea el client secret efimero.
- `lib/prompts/langfuse.ts`: carga prompts desde Langfuse Prompt Management.
- `lib/actions/action-catalog.ts`: catalogo compartido de actions.
- `lib/actions/realtime-tools.ts`: tools del agente Realtime.
- `stores/action-bridge-store.ts`: Zustand store para vistas, tool calls y HITL.
- `components/actions/action-workbench.tsx`: render visual de actions.
- `components/realtime-console.tsx`: conexion WebRTC, transcripcion e historial.

## Actions iniciales

- `showWorkspaceOverview`: vista generica de resumen.
- `showItemList`: vista generica de lista.
- `collectRequiredInfo`: formulario human-in-the-loop.
- `confirmOperation`: confirmacion human-in-the-loop.

## Prompts Langfuse

La app busca estos prompts de texto en Langfuse:

- `generic-realtime-system`
- `generic-realtime-transcription`

Puedes cambiar los nombres con:

```bash
LANGFUSE_REALTIME_PROMPT_NAME=generic-realtime-system
LANGFUSE_TRANSCRIPTION_PROMPT_NAME=generic-realtime-transcription
LANGFUSE_PROMPT_LABEL=production
```

Si Langfuse no esta configurado o falla, usa prompts fallback locales para que
el demo siga funcionando.

## Setup

1. Copia `.env.example` a `.env.local`.
2. Agrega `OPENAI_API_KEY`.
3. Opcionalmente agrega credenciales Langfuse.
4. Ejecuta:

```bash
npm run dev
```

La ruta `POST /api/realtime/client-secret` crea un token efimero. El frontend
usa ese token con `@openai/agents/realtime` para abrir la conexion WebRTC,
registrar tools, activar microfono/audio y pintar historial + actions.
