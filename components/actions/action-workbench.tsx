"use client";

import { FormEvent, useState } from "react";
import {
  AlertCircle,
  Check,
  ClipboardList,
  Eye,
  ListChecks,
  Send,
  X
} from "lucide-react";
import {
  resolveHumanAction,
  useActionBridgeStore,
  type ActionCall
} from "@/stores/action-bridge-store";

type Metric = {
  label?: unknown;
  value?: unknown;
  tone?: unknown;
};

type Item = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
};

type Field = {
  id?: unknown;
  label?: unknown;
  type?: unknown;
  required?: unknown;
  placeholder?: unknown;
};

type Detail = {
  label?: unknown;
  value?: unknown;
};

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getCollectInfoCta(status: ActionCall["status"]) {
  if (status === "completed") {
    return {
      title: "Informacion enviada",
      body: "La IA ya recibio tus datos y puede continuar."
    };
  }

  if (status === "cancelled") {
    return {
      title: "Solicitud cancelada",
      body: "La IA fue notificada de que no quieres continuar con este formulario."
    };
  }

  return {
    title: "Accion requerida",
    body: "Completa los campos solicitados y presiona enviar para que la IA continue."
  };
}

function getConfirmCta(status: ActionCall["status"]) {
  if (status === "completed") {
    return {
      title: "Operacion confirmada",
      body: "La IA ya recibio tu aprobacion y puede continuar."
    };
  }

  if (status === "cancelled") {
    return {
      title: "Operacion cancelada",
      body: "La IA fue notificada de que rechazaste esta operacion."
    };
  }

  return {
    title: "Tu aprobacion es necesaria",
    body: "Revisa los detalles y elige confirmar o cancelar para que la IA continue."
  };
}

function HumanActionCta({
  title,
  body,
  status
}: {
  title: string;
  body: string;
  status: ActionCall["status"];
}) {
  return (
    <div className={`human-action-cta cta-${status}`}>
      <AlertCircle size={17} />
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
    </div>
  );
}

function ActionShell({
  call,
  icon,
  children
}: {
  call: ActionCall;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className={`action-card action-${call.kind}`}>
      <div className="action-card-header">
        <span className="action-icon">{icon}</span>
        <div>
          <p>{call.name}</p>
          <strong>{call.status}</strong>
        </div>
      </div>
      {children}
    </article>
  );
}

function WorkspaceOverview({ call }: { call: ActionCall }) {
  const metrics = asArray<Metric>(call.args.metrics);
  const nextSteps = asArray<string>(call.args.nextSteps);

  return (
    <ActionShell call={call} icon={<Eye size={18} />}>
      <h3>{asText(call.args.title, "Resumen")}</h3>
      {asText(call.args.summary) ? <p>{asText(call.args.summary)}</p> : null}

      {metrics.length > 0 ? (
        <div className="metric-grid">
          {metrics.map((metric, index) => (
            <div
              className={`metric-card tone-${asText(metric.tone, "neutral")}`}
              key={`${asText(metric.label, "metric")}_${index}`}
            >
              <span>{asText(metric.label, "Metrica")}</span>
              <strong>{asText(metric.value, "-")}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {nextSteps.length > 0 ? (
        <ul className="action-list">
          {nextSteps.map((step, index) => (
            <li key={`${step}_${index}`}>{step}</li>
          ))}
        </ul>
      ) : null}
    </ActionShell>
  );
}

function ItemList({ call }: { call: ActionCall }) {
  const items = asArray<Item>(call.args.items);

  return (
    <ActionShell call={call} icon={<ListChecks size={18} />}>
      <h3>{asText(call.args.title, "Elementos")}</h3>
      {asText(call.args.filterLabel) ? (
        <p>{asText(call.args.filterLabel)}</p>
      ) : null}
      <div className="item-stack">
        {items.map((item, index) => (
          <div className="item-row" key={`${asText(item.id, "item")}_${index}`}>
            <div>
              <strong>{asText(item.title, "Elemento")}</strong>
              {asText(item.description) ? (
                <span>{asText(item.description)}</span>
              ) : null}
            </div>
            {asText(item.status) ? <mark>{asText(item.status)}</mark> : null}
          </div>
        ))}
      </div>
    </ActionShell>
  );
}

function CollectRequiredInfo({ call }: { call: ActionCall }) {
  const fields = asArray<Field>(call.args.fields);
  const [values, setValues] = useState<Record<string, string>>({});
  const disabled = call.status !== "waiting";
  const cta = getCollectInfoCta(call.status);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resolveHumanAction(call.id, {
      status: "completed",
      data: { values }
    });
  }

  return (
    <ActionShell call={call} icon={<ClipboardList size={18} />}>
      <HumanActionCta title={cta.title} body={cta.body} status={call.status} />
      <h3>{asText(call.args.title, "Completar informacion")}</h3>
      {asText(call.args.description) ? (
        <p>{asText(call.args.description)}</p>
      ) : null}
      <form className="hitl-form" onSubmit={submit}>
        {fields.map((field) => {
          const id = asText(field.id);

          if (!id) {
            return null;
          }

          return (
            <label key={id}>
              <span>{asText(field.label, id)}</span>
              <input
                disabled={disabled}
                required={field.required !== false}
                type={asText(field.type, "text")}
                placeholder={asText(field.placeholder)}
                value={values[id] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [id]: event.target.value
                  }))
                }
              />
            </label>
          );
        })}
        <div className="hitl-actions">
          <button
            className="secondary-button"
            disabled={disabled}
            type="button"
            onClick={() =>
              resolveHumanAction(call.id, {
                status: "cancelled",
                data: { reason: "user_cancelled" }
              })
            }
          >
            <X size={16} />
            Cancelar
          </button>
          <button className="primary-button compact" disabled={disabled} type="submit">
            <Send size={16} />
            {asText(call.args.submitLabel, "Enviar")}
          </button>
        </div>
      </form>
    </ActionShell>
  );
}

function ConfirmOperation({ call }: { call: ActionCall }) {
  const details = asArray<Detail>(call.args.details);
  const disabled = call.status !== "waiting";
  const cta = getConfirmCta(call.status);

  return (
    <ActionShell call={call} icon={<Check size={18} />}>
      <HumanActionCta title={cta.title} body={cta.body} status={call.status} />
      <h3>{asText(call.args.title, "Confirmar operacion")}</h3>
      {asText(call.args.description) ? (
        <p>{asText(call.args.description)}</p>
      ) : null}

      {details.length > 0 ? (
        <dl className="detail-list">
          {details.map((detail, index) => (
            <div key={`${asText(detail.label, "detail")}_${index}`}>
              <dt>{asText(detail.label, "Dato")}</dt>
              <dd>{asText(detail.value, "-")}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="hitl-actions">
        <button
          className="secondary-button"
          disabled={disabled}
          type="button"
          onClick={() =>
            resolveHumanAction(call.id, {
              status: "cancelled",
              data: { confirmed: false }
            })
          }
        >
          <X size={16} />
          {asText(call.args.cancelLabel, "Cancelar")}
        </button>
        <button
          className="primary-button compact"
          disabled={disabled}
          type="button"
          onClick={() =>
            resolveHumanAction(call.id, {
              status: "completed",
              data: { confirmed: true }
            })
          }
        >
          <Check size={16} />
          {asText(call.args.confirmLabel, "Confirmar")}
        </button>
      </div>
    </ActionShell>
  );
}

export function ActionMessage({ call }: { call: ActionCall }) {
  switch (call.name) {
    case "showWorkspaceOverview":
      return <WorkspaceOverview call={call} />;
    case "showItemList":
      return <ItemList call={call} />;
    case "collectRequiredInfo":
      return <CollectRequiredInfo call={call} />;
    case "confirmOperation":
      return <ConfirmOperation call={call} />;
    default:
      return (
        <ActionShell call={call} icon={<Eye size={18} />}>
          <h3>Action generica</h3>
          <pre>{JSON.stringify(call.args, null, 2)}</pre>
        </ActionShell>
      );
  }
}

export { useActionBridgeStore };
