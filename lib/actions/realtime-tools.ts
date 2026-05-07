"use client";

import { tool } from "@openai/agents/realtime";
import { z } from "zod";
import {
  pushHumanAction,
  pushViewAction
} from "@/stores/action-bridge-store";
import {
  findPhonePlanLine,
  getPhonePlanLineOptions
} from "@/lib/actions/phone-plan-data";
import {
  defaultPaymentMethod,
  formatSolesAmount,
  getDebtTotal,
  serviceDebtItems
} from "@/lib/actions/service-debts-data";
import { serviceStatusItems } from "@/lib/actions/service-status-data";

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

export function createRealtimeActionTools() {
  return [
    tool({
      name: "showPhonePlanStatus",
      description:
        "Show the status of one of the user's phone plans. The user has exactly three lines: 955123456 is a postpaid mobile plan Max Ilimitado 69.90, 988654321 is a prepaid mobile plan, and 015103000 is the home line with Internet 300 Mbps + TV + fixed phone. Use when the user says things like 'quiero ver estado de mi plan del numero 955123456'.",
      parameters: z.object({
        phoneNumber: z
          .string()
          .describe("Phone number requested by the user.")
      }),
      execute: async (input, _context, details) => {
        const line = findPhonePlanLine(input.phoneNumber);

        return JSON.stringify(
          pushViewAction(
            "showPhonePlanStatus",
            {
              requestedNumber: input.phoneNumber,
              line: line ?? null,
              availableLines: line ? [] : getPhonePlanLineOptions(),
              notFoundMessage: line
                ? ""
                : "No encontre una linea asociada a ese numero."
            },
            getActionCallOptions(details)
          )
        );
      }
    }),
    tool({
      name: "showServiceStatus",
      description:
        "Show a visual status card for the user's home services. Use when the user asks 'estado de mis servicios', 'estado del internet, telefono y tv', or asks to see whether services are OK or failing.",
      parameters: z.object({
        title: z.string().default("Estado de tus servicios")
      }),
      execute: async (input, _context, details) => {
        return JSON.stringify(
          pushViewAction(
            "showServiceStatus",
            {
              title: input.title,
              services: serviceStatusItems
            },
            getActionCallOptions(details)
          )
        );
      }
    }),
    tool({
      name: "payServiceDebts",
      description:
        "Start a human-in-the-loop payment flow for pending service debts. Use when the user asks to pay services with debts, pay pending receipts, or settle service bills. After the tool returns status waiting, speak the returned spokenCta and wait for the UI result before continuing.",
      parameters: z.object({
        title: z.string().default("Paga tus deudas pendientes")
      }),
      execute: async (input, _context, details) => {
        const total = getDebtTotal(serviceDebtItems);

        return JSON.stringify(
          pushHumanAction(
            "payServiceDebts",
            {
              title: input.title,
              debts: serviceDebtItems,
              total,
              totalLabel: formatSolesAmount(total),
              paymentMethod: defaultPaymentMethod
            },
            getActionCallOptions(details)
          )
        );
      }
    })
  ];
}
