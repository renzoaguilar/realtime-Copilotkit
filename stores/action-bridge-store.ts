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

function getDebtSummary(args: Record<string, unknown>) {
  if (!Array.isArray(args.debts)) {
    return "";
  }

  const debts = args.debts.flatMap((debt) => {
    if (!debt || typeof debt !== "object") {
      return [];
    }

    const maybeDebt = debt as Record<string, unknown>;
    const service = asText(maybeDebt.serviceLabel, "servicio");
    const amount = asText(maybeDebt.amountLabel);

    if (!amount) {
      return [];
    }

    return [`${service} por ${amount}`];
  });

  return formatNaturalList(debts);
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
  if (name === "payServiceDebts") {
    const title = asText(args.title, "el pago de servicios");
    const debts = getDebtSummary(args);
    const total = asText(args.totalLabel);

    if (debts && total) {
      return `Abri ${title}. Tienes pendiente ${debts}, total ${total}. Revisa la informacion y presiona pagar ahora o cancelar.`;
    }

    return `Abri ${title}. Revisa las deudas pendientes y presiona pagar ahora o cancelar.`;
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
