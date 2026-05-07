import { create } from "zustand";

export type ActionKind = "view" | "hitl";
export type ActionStatus =
  | "visible"
  | "waiting"
  | "completed"
  | "cancelled"
  | "failed";

export type ActionCall = {
  id: string;
  itemId?: string;
  toolCallId?: string;
  name: string;
  kind: ActionKind;
  args: Record<string, unknown>;
  status: ActionStatus;
  result?: unknown;
  createdAt: number;
  resolvedAt?: number;
};

export type ActionResolution = {
  status: "completed" | "cancelled";
  data?: unknown;
};

type ActionCallOptions = {
  itemId?: string;
  toolCallId?: string;
};

type ActionBridgeState = {
  calls: ActionCall[];
  activeCallId?: string;
  addCall: (call: ActionCall) => void;
  updateCall: (id: string, patch: Partial<ActionCall>) => void;
  clearCalls: () => void;
};

function createActionId(name: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return `${name}_${random}`;
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatNaturalList(items: string[]) {
  const cleanItems = items.map((item) => item.trim()).filter(Boolean);

  if (cleanItems.length === 0) {
    return "";
  }

  if (cleanItems.length === 1) {
    return cleanItems[0];
  }

  if (cleanItems.length === 2) {
    return `${cleanItems[0]} y ${cleanItems[1]}`;
  }

  return `${cleanItems.slice(0, -1).join(", ")} y ${cleanItems.at(-1)}`;
}

function getFieldLabels(args: Record<string, unknown>) {
  if (!Array.isArray(args.fields)) {
    return [];
  }

  return args.fields.flatMap((field) => {
    if (!field || typeof field !== "object") {
      return [];
    }

    const maybeField = field as Record<string, unknown>;
    const label = asText(maybeField.label, asText(maybeField.id));

    if (!label) {
      return [];
    }

    return maybeField.required === false ? [] : [label];
  });
}

function getDetailSummary(args: Record<string, unknown>) {
  if (!Array.isArray(args.details)) {
    return "";
  }

  const details = args.details.flatMap((detail) => {
    if (!detail || typeof detail !== "object") {
      return [];
    }

    const maybeDetail = detail as Record<string, unknown>;
    const label = asText(maybeDetail.label);
    const value = asText(maybeDetail.value);

    if (!label || !value) {
      return [];
    }

    return [`${label}: ${value}`];
  });

  return formatNaturalList(details);
}

export const useActionBridgeStore = create<ActionBridgeState>((set) => ({
  calls: [],
  addCall: (call) =>
    set((state) => ({
      calls: state.calls.some((current) => current.id === call.id)
        ? state.calls.map((current) =>
            current.id === call.id ? { ...current, ...call } : current
          )
        : [...state.calls, call],
      activeCallId: call.id
    })),
  updateCall: (id, patch) =>
    set((state) => ({
      calls: state.calls.map((call) =>
        call.id === id ? { ...call, ...patch } : call
      )
    })),
  clearCalls: () => set({ calls: [], activeCallId: undefined })
}));

export function pushViewAction(
  name: string,
  args: Record<string, unknown>,
  options: ActionCallOptions = {}
) {
  const call: ActionCall = {
    id: options.itemId ?? options.toolCallId ?? createActionId(name),
    itemId: options.itemId,
    toolCallId: options.toolCallId,
    name,
    kind: "view",
    args,
    status: "visible",
    createdAt: Date.now()
  };

  useActionBridgeStore.getState().addCall(call);

  return {
    callId: call.id,
    status: "visible",
    message: `La vista ${name} fue mostrada.`
  };
}

function getHumanActionSpokenCta(name: string, args: Record<string, unknown>) {
  if (name === "collectRequiredInfo") {
    const title = asText(args.title, "el formulario");
    const description = asText(args.description);
    const fields = formatNaturalList(getFieldLabels(args));
    const intro = description
      ? `Abri ${title}. ${description}`
      : `Abri ${title}.`;

    if (fields) {
      return `${intro} Completa estos campos: ${fields}. Luego presiona enviar para que pueda continuar.`;
    }

    return `${intro} Completa la informacion solicitada y presiona enviar para que pueda continuar.`;
  }

  if (name === "confirmOperation") {
    const title = asText(args.title, "la operacion");
    const description = asText(args.description);
    const details = getDetailSummary(args);
    const intro = description
      ? `Abri ${title}. ${description}`
      : `Abri ${title}.`;

    if (details) {
      return `${intro} Revisa estos detalles: ${details}. Luego confirma o cancela para que pueda continuar.`;
    }

    return `${intro} Revisa la informacion y elige confirmar o cancelar para que pueda continuar.`;
  }

  return "Te acabo de mostrar una accion que necesita tu respuesta. Completala para que pueda continuar.";
}

export function pushHumanAction(
  name: string,
  args: Record<string, unknown>,
  options: ActionCallOptions = {}
) {
  const call: ActionCall = {
    id: options.itemId ?? options.toolCallId ?? createActionId(name),
    itemId: options.itemId,
    toolCallId: options.toolCallId,
    name,
    kind: "hitl",
    args,
    status: "waiting",
    createdAt: Date.now()
  };

  useActionBridgeStore.getState().addCall(call);

  return {
    callId: call.id,
    status: "waiting",
    spokenCta: getHumanActionSpokenCta(name, args),
    instruction:
      "Di el spokenCta en voz de forma breve y natural. Luego espera a que la interfaz envie el resultado de esta accion antes de continuar."
  };
}

export function resolveHumanAction(
  id: string,
  resolution: ActionResolution
) {
  useActionBridgeStore.getState().updateCall(id, {
    status: resolution.status,
    result: resolution.data,
    resolvedAt: Date.now()
  });

  return {
    callId: id,
    ...resolution
  };
}
