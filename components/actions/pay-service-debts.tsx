"use client";

import { CreditCard, FileText, ShieldCheck, X, Zap } from "lucide-react";
import {
  resolveHumanAction,
  type ActionCall
} from "@/stores/action-bridge-store";

type Debt = {
  id?: unknown;
  serviceLabel?: unknown;
  accountNumber?: unknown;
  description?: unknown;
  dueDate?: unknown;
  amount?: unknown;
  amountLabel?: unknown;
  statusLabel?: unknown;
};

type PaymentMethod = {
  label?: unknown;
  detail?: unknown;
};

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getPaymentState(status: ActionCall["status"]) {
  if (status === "completed") {
    return {
      title: "Pago realizado",
      body: "Tus servicios fueron pagados y el asistente ya recibio la confirmacion.",
      tone: "paid"
    };
  }

  if (status === "cancelled") {
    return {
      title: "Pago cancelado",
      body: "No se realizo ningun cargo y el asistente ya fue notificado.",
      tone: "cancelled"
    };
  }

  return {
    title: "Confirmacion requerida",
    body: "Revisa las deudas y confirma el pago para continuar.",
    tone: "waiting"
  };
}

function getOperationCode() {
  return `OP-${Date.now().toString().slice(-6)}`;
}

export function PayServiceDebts({ call }: { call: ActionCall }) {
  const debts = asArray<Debt>(call.args.debts);
  const paymentMethod = (call.args.paymentMethod ?? {}) as PaymentMethod;
  const totalLabel = asText(call.args.totalLabel, "S/ 0.00");
  const disabled = call.status !== "waiting";
  const state = getPaymentState(call.status);
  const debtCount = debts.length;
  const debtCountLabel = debtCount === 1 ? "1 deuda" : `${debtCount} deudas`;

  function payDebts() {
    const operationCode = getOperationCode();

    resolveHumanAction(call.id, {
      status: "completed",
      data: {
        paid: true,
        operationCode,
        total: totalLabel,
        debts: debts.map((debt) => ({
          id: asText(debt.id),
          accountNumber: asText(debt.accountNumber),
          amount: asNumber(debt.amount)
        }))
      }
    });
  }

  function cancelPayment() {
    resolveHumanAction(call.id, {
      status: "cancelled",
      data: {
        paid: false,
        reason: "user_cancelled_payment"
      }
    });
  }

  return (
    <section className="payment-debts-panel" aria-label="Pago de servicios">
      <div className={`payment-state payment-${state.tone}`}>
        <ShieldCheck size={18} />
        <div>
          <strong>{state.title}</strong>
          <span>{state.body}</span>
        </div>
      </div>

      <div className="payment-header">
        <div>
          <span>Pago de servicios</span>
          <h3>{asText(call.args.title, "Paga tus deudas pendientes")}</h3>
        </div>
        <strong>{debtCountLabel}</strong>
      </div>

      <div className="payment-debt-list">
        {debts.map((debt, index) => (
          <article
            className="payment-debt-row"
            key={`${asText(debt.id, "debt")}_${index}`}
          >
            <span className="payment-debt-icon">
              <FileText size={20} />
            </span>
            <div>
              <strong>{asText(debt.serviceLabel, "Servicio")}</strong>
              <span>
                {asText(debt.description, "Recibo pendiente")} -{" "}
                {asText(debt.accountNumber, "-")}
              </span>
              <small>{asText(debt.dueDate, "Vencimiento pendiente")}</small>
            </div>
            <mark>{asText(debt.amountLabel, "S/ 0.00")}</mark>
          </article>
        ))}
      </div>

      <div className="payment-method-row">
        <span className="payment-method-icon">
          <CreditCard size={18} />
        </span>
        <div>
          <strong>{asText(paymentMethod.label, "Metodo de pago")}</strong>
          <span>{asText(paymentMethod.detail, "Seleccionado")}</span>
        </div>
      </div>

      <div className="payment-total-row">
        <span>Total a pagar</span>
        <strong>{totalLabel}</strong>
      </div>

      <div className="payment-actions">
        <button
          className="secondary-button"
          disabled={disabled}
          type="button"
          onClick={cancelPayment}
        >
          <X size={16} />
          Cancelar
        </button>
        <button
          className="primary-button compact payment-button"
          disabled={disabled || debts.length === 0}
          type="button"
          onClick={payDebts}
        >
          <Zap size={16} />
          Pagar ahora
        </button>
      </div>
    </section>
  );
}
