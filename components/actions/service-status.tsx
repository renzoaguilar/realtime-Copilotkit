"use client";

import { Phone, RotateCw, TriangleAlert, Tv, Wifi } from "lucide-react";
import type { ActionCall } from "@/stores/action-bridge-store";
import type {
  ServiceStatusItem,
  ServiceStatusTone
} from "@/lib/actions/service-status-data";

type RawService = {
  id?: unknown;
  label?: unknown;
  description?: unknown;
  statusLabel?: unknown;
  tone?: unknown;
};

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asTone(value: unknown): ServiceStatusTone {
  if (value === "ok" || value === "fault" || value === "restarting") {
    return value;
  }

  return "ok";
}

function getServiceIcon(id: string) {
  if (id === "internet") {
    return <Wifi size={22} />;
  }

  if (id === "fixed-phone") {
    return <Phone size={22} />;
  }

  return <Tv size={22} />;
}

function StatusMark({
  statusLabel,
  tone
}: {
  statusLabel: string;
  tone: ServiceStatusTone;
}) {
  if (tone === "fault") {
    return (
      <div className="service-status-mark">
        <strong>{statusLabel}</strong>
        <TriangleAlert size={19} />
      </div>
    );
  }

  if (tone === "restarting") {
    return (
      <div className="service-status-mark">
        <span className="restart-icon">
          <RotateCw size={17} />
        </span>
      </div>
    );
  }

  return (
    <div className="service-status-mark">
      <strong>{statusLabel}</strong>
      <span className="ok-dot" />
    </div>
  );
}

function normalizeService(raw: RawService): ServiceStatusItem {
  const id = asText(raw.id, "internet");
  const tone = asTone(raw.tone);

  return {
    id:
      id === "fixed-phone" || id === "tv" || id === "internet"
        ? id
        : "internet",
    label: asText(raw.label, "Servicio"),
    description: asText(raw.description, "Estado no disponible"),
    statusLabel: asText(raw.statusLabel, tone === "ok" ? "OK" : ""),
    tone
  };
}

export function ServiceStatus({ call }: { call: ActionCall }) {
  const services = asArray<RawService>(call.args.services).map(normalizeService);
  const title = asText(call.args.title, "Estado de tus servicios");

  return (
    <section className="service-status-panel" aria-label={title}>
      <div className="service-status-list">
        {services.map((service) => (
          <article
            className={`service-status-row service-${service.tone}`}
            key={service.id}
          >
            <span className="service-status-icon">
              {getServiceIcon(service.id)}
            </span>
            <div className="service-status-copy">
              <strong>{service.label}</strong>
              <span>{service.description}</span>
            </div>
            <StatusMark statusLabel={service.statusLabel} tone={service.tone} />
          </article>
        ))}
      </div>
    </section>
  );
}
