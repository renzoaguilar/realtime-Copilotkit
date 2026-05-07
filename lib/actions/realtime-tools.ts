"use client";

import { tool } from "@openai/agents/realtime";
import { z } from "zod";
import {
  pushHumanAction,
  pushViewAction
} from "@/stores/action-bridge-store";

type RealtimeToolDetails = {
  toolCall?: {
    id?: string;
    callId?: string;
  };
};

function getActionCallOptions(details?: RealtimeToolDetails) {
  return {
    itemId: details?.toolCall?.id,
    toolCallId: details?.toolCall?.callId
  };
}

const metricSchema = z.object({
  label: z.string().describe("Short metric label."),
  value: z.string().describe("Metric value formatted for display."),
  tone: z
    .enum(["neutral", "positive", "warning", "critical"])
    .optional()
    .describe("Visual tone for the metric.")
});

const detailSchema = z.object({
  label: z.string(),
  value: z.string()
});

const itemSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string().optional()
});

const fieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["text", "number", "email", "date"]).default("text"),
  required: z.boolean().default(true),
  placeholder: z.string().optional()
});

function withDemoItems(input: {
  title?: string;
  filterLabel?: string;
  items?: z.infer<typeof itemSchema>[];
}) {
  const items =
    Array.isArray(input.items) && input.items.length > 0
      ? input.items
      : [
          {
            title: "Preparar informe semanal",
            description: "Consolidar avances y pendientes principales.",
            status: "Pendiente"
          },
          {
            title: "Revisar configuración",
            description: "Validar cambios antes de publicar.",
            status: "Pendiente"
          },
          {
            title: "Coordinar reunión",
            description: "Alinear próximos pasos con el equipo.",
            status: "Pendiente"
          },
          {
            title: "Actualizar documentación",
            description: "Registrar decisiones y criterios usados.",
            status: "Pendiente"
          },
          {
            title: "Cerrar incidencias",
            description: "Resolver bloqueos críticos del flujo.",
            status: "Pendiente"
          }
        ];

  return {
    ...input,
    title: input.title ?? "Tareas pendientes demo",
    filterLabel: input.filterLabel ?? "Datos de ejemplo",
    items
  };
}

export function createRealtimeActionTools() {
  return [
    tool({
      name: "showWorkspaceOverview",
      description:
        "Show a generic visual overview with metrics, status and suggested next steps. Use it when a visual summary helps the user.",
      parameters: z.object({
        title: z.string().default("Resumen"),
        summary: z.string().optional(),
        metrics: z.array(metricSchema).default([]),
        nextSteps: z.array(z.string()).default([])
      }),
      execute: async (input, _context, details) => {
        return JSON.stringify(
          pushViewAction(
            "showWorkspaceOverview",
            input,
            getActionCallOptions(details)
          )
        );
      }
    }),
    tool({
      name: "showItemList",
      description:
        "Show a generic list of items such as records, tasks, cases, products or tickets. If the user asks for a demo list and no data source is available, create clearly demo items.",
      parameters: z.object({
        title: z.string().default("Elementos"),
        filterLabel: z.string().optional(),
        items: z.array(itemSchema).default([])
      }),
      execute: async (input, _context, details) => {
        return JSON.stringify(
          pushViewAction(
            "showItemList",
            withDemoItems(input),
            getActionCallOptions(details)
          )
        );
      }
    }),
    tool({
      name: "collectRequiredInfo",
      description:
        "Show a visual form for missing information. After the tool returns status waiting, speak the returned spokenCta and wait for the UI result before continuing.",
      parameters: z.object({
        title: z.string().default("Completar informacion"),
        description: z.string().optional(),
        fields: z.array(fieldSchema).min(1),
        submitLabel: z.string().default("Enviar")
      }),
      execute: async (input, _context, details) => {
        return JSON.stringify(
          pushHumanAction(
            "collectRequiredInfo",
            input,
            getActionCallOptions(details)
          )
        );
      }
    }),
    tool({
      name: "confirmOperation",
      description:
        "Show a visual confirmation request. After the tool returns status waiting, speak the returned spokenCta and wait for the UI result before continuing.",
      parameters: z.object({
        title: z.string().default("Confirmar operacion"),
        description: z.string().optional(),
        details: z.array(detailSchema).default([]),
        confirmLabel: z.string().default("Confirmar"),
        cancelLabel: z.string().default("Cancelar")
      }),
      execute: async (input, _context, details) => {
        return JSON.stringify(
          pushHumanAction(
            "confirmOperation",
            input,
            getActionCallOptions(details)
          )
        );
      }
    })
  ];
}
