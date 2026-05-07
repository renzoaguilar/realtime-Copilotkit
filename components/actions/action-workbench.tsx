"use client";

import type { ReactNode } from "react";
import {
  useActionBridgeStore,
  type ActionCall
} from "@/stores/action-bridge-store";
import { PayServiceDebts } from "@/components/actions/pay-service-debts";
import { PhonePlanStatus } from "@/components/actions/phone-plan-status";
import { ServiceStatus } from "@/components/actions/service-status";

function ActionShell({
  call,
  children
}: {
  call: ActionCall;
  children: ReactNode;
}) {
  return (
    <article className={`action-card action-${call.kind}`}>
      {children}
    </article>
  );
}

export function ActionMessage({ call }: { call: ActionCall }) {
  switch (call.name) {
    case "showPhonePlanStatus":
      return (
        <ActionShell call={call}>
          <PhonePlanStatus call={call} />
        </ActionShell>
      );
    case "showServiceStatus":
      return (
        <ActionShell call={call}>
          <ServiceStatus call={call} />
        </ActionShell>
      );
    case "payServiceDebts":
      return (
        <ActionShell call={call}>
          <PayServiceDebts call={call} />
        </ActionShell>
      );
    default:
      return (
        <ActionShell call={call}>
          <h3>Action no disponible</h3>
          <pre>{JSON.stringify(call.args, null, 2)}</pre>
        </ActionShell>
      );
  }
}

export { useActionBridgeStore };
