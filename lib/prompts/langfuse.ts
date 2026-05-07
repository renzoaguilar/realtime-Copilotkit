import { LangfuseClient } from "@langfuse/client";
import {
  DEFAULT_REALTIME_SYSTEM_PROMPT,
  DEFAULT_TRANSCRIPTION_PROMPT,
  REALTIME_ACTION_RUNTIME_RULES,
  REALTIME_DEMO_RUNTIME_RULES,
  REALTIME_PROMPT_NAME,
  TRANSCRIPTION_PROMPT_NAME
} from "@/lib/prompts/defaults";
import { formatActionCatalogForPrompt } from "@/lib/actions/action-catalog";

type RuntimePrompts = {
  realtimeInstructions: string;
  transcriptionPrompt: string;
  source: "langfuse" | "fallback";
};

const promptLabel = process.env.LANGFUSE_PROMPT_LABEL ?? "production";

function hasLangfuseCredentials() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

function withRuntimeActionRules(prompt: string) {
  const blocks = [];

  if (!prompt.includes("spokenCta")) {
    blocks.push(REALTIME_ACTION_RUNTIME_RULES);
  }

  if (!prompt.includes("modo demo") && !prompt.includes("datos de ejemplo")) {
    blocks.push(REALTIME_DEMO_RUNTIME_RULES);
  }

  if (blocks.length === 0) {
    return prompt;
  }

  return `${prompt.trim()}\n\n${blocks.join("\n\n")}`;
}

async function getTextPrompt(
  client: LangfuseClient,
  name: string,
  fallback: string
) {
  const prompt = await client.prompt.get(name, {
    type: "text",
    label: promptLabel,
    fallback,
    cacheTtlSeconds: 300,
    maxRetries: 1,
    fetchTimeoutMs: 2500
  });

  return prompt.compile({
    actionCatalog: formatActionCatalogForPrompt(),
    locale: "es"
  });
}

export async function loadRuntimePrompts(): Promise<RuntimePrompts> {
  if (!hasLangfuseCredentials()) {
    return {
      realtimeInstructions: withRuntimeActionRules(DEFAULT_REALTIME_SYSTEM_PROMPT),
      transcriptionPrompt: DEFAULT_TRANSCRIPTION_PROMPT,
      source: "fallback"
    };
  }

  try {
    const client = new LangfuseClient({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL
    });

    const [realtimeInstructions, transcriptionPrompt] = await Promise.all([
      getTextPrompt(client, REALTIME_PROMPT_NAME, DEFAULT_REALTIME_SYSTEM_PROMPT),
      getTextPrompt(
        client,
        TRANSCRIPTION_PROMPT_NAME,
        DEFAULT_TRANSCRIPTION_PROMPT
      )
    ]);

    return {
      realtimeInstructions: withRuntimeActionRules(realtimeInstructions),
      transcriptionPrompt,
      source: "langfuse"
    };
  } catch (error) {
    console.warn("Langfuse prompt fetch failed; using local fallbacks.", error);

    return {
      realtimeInstructions: withRuntimeActionRules(DEFAULT_REALTIME_SYSTEM_PROMPT),
      transcriptionPrompt: DEFAULT_TRANSCRIPTION_PROMPT,
      source: "fallback"
    };
  }
}
