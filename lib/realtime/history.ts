import type { RealtimeItem } from "@openai/agents/realtime";

export type TranscriptRole = "user" | "assistant" | "system" | "tool";

export type TranscriptEntry = {
  id: string;
  role: TranscriptRole;
  text: string;
  status: "in_progress" | "completed" | "incomplete" | "failed";
  source: "history" | "transport";
  createdAt: number;
};

type MessageContentPart =
  | { type: "input_text"; text?: string }
  | { type: "input_audio"; transcript?: string | null }
  | { type: "output_text"; text?: string }
  | { type: "output_audio"; transcript?: string | null }
  | { type: string; [key: string]: unknown };

function extractMessageText(content: MessageContentPart[]) {
  return content
    .map((part) => {
      if (part.type === "input_text" || part.type === "output_text") {
        return part.text ?? "";
      }

      if (part.type === "input_audio" || part.type === "output_audio") {
        return part.transcript ?? "";
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function normalizeRealtimeHistory(
  history: RealtimeItem[]
): TranscriptEntry[] {
  return history.map((item, index) => {
    if (item.type === "message") {
      const content = item.content as MessageContentPart[];

      return {
        id: item.itemId,
        role: item.role,
        text: extractMessageText(content),
        status: "status" in item ? item.status : "completed",
        source: "history",
        createdAt: index
      };
    }

    if (item.type === "function_call") {
      return {
        id: item.itemId,
        role: "tool",
        text: `${item.name}(${item.arguments})`,
        status: item.status,
        source: "history",
        createdAt: index
      };
    }

    if (item.type === "mcp_call" || item.type === "mcp_tool_call") {
      return {
        id: item.itemId,
        role: "tool",
        text: `${item.name}(${item.arguments})`,
        status: item.status,
        source: "history",
        createdAt: index
      };
    }

    if (item.type === "mcp_approval_request") {
      return {
        id: item.itemId,
        role: "tool",
        text: item.name,
        status: item.approved === false ? "failed" : "in_progress",
        source: "history",
        createdAt: index
      };
    }

    return {
      id: item.itemId,
      role: "tool",
      text: "Evento realtime",
      status: "in_progress",
      source: "history",
      createdAt: index
    };
  });
}

export function mergeHistoryAndDrafts(
  history: TranscriptEntry[],
  drafts: TranscriptEntry[]
) {
  const byId = new Map(history.map((entry) => [entry.id, entry]));

  for (const draft of drafts) {
    const existing = byId.get(draft.id);

    if (!existing || draft.text.length > existing.text.length) {
      byId.set(draft.id, draft);
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
}
