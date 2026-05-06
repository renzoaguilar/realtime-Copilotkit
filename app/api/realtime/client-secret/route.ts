import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-1.5";
const TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Falta OPENAI_API_KEY. Crea .env.local usando .env.example como referencia."
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const voice = typeof body.voice === "string" ? body.voice : "marin";

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  try {
    const clientSecret = await openai.realtime.clientSecrets.create({
      expires_after: {
        anchor: "created_at",
        seconds: 600
      },
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions:
          "Eres una IA de voz en tiempo real. Conversas en espanol de forma clara, natural y breve. Si el usuario mezcla idiomas, sigue su idioma. Mantienes respuestas utiles y conversacionales.",
        output_modalities: ["audio"],
        audio: {
          input: {
            transcription: {
              model: TRANSCRIBE_MODEL,
              language: "es"
            },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "medium",
              create_response: true,
              interrupt_response: true
            },
            noise_reduction: {
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

    return NextResponse.json({
      clientSecret: clientSecret.value,
      expiresAt: clientSecret.expires_at,
      model: REALTIME_MODEL,
      voice
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear el token.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
