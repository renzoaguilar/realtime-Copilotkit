# OpenAI Realtime History Demo

Demo monolito con Next.js, WebRTC y OpenAI Realtime API.

## Setup

1. Copia `.env.example` a `.env.local`.
2. Agrega `OPENAI_API_KEY`.
3. Ejecuta:

```bash
npm run dev
```

La ruta `POST /api/realtime/client-secret` crea un client secret efimero. El
frontend usa ese token con `@openai/agents/realtime` para abrir la conexion
WebRTC, activar microfono/audio y pintar el historial de tu voz y de la IA.
