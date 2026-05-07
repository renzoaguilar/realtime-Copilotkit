"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  CalendarDays,
  FileText,
  Phone,
  Smartphone,
  Tv,
  Wifi,
  Zap
} from "lucide-react";
import type { ActionCall } from "@/stores/action-bridge-store";
import type { PhonePlanLine } from "@/lib/actions/phone-plan-data";

type AvailableLine = {
  number?: unknown;
  owner?: unknown;
  planName?: unknown;
};

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readLine(value: unknown): PhonePlanLine | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeLine = value as PhonePlanLine;

  if (
    maybeLine.type === "mobile-postpaid" ||
    maybeLine.type === "mobile-prepaid" ||
    maybeLine.type === "home"
  ) {
    return maybeLine;
  }

  return null;
}

function ProgressRing({
  value,
  unit,
  percent,
  tone
}: {
  value: string;
  unit: string;
  percent: number;
  tone: "blue" | "mint";
}) {
  const progress = Math.max(0, Math.min(1, percent)) * 360;

  return (
    <div
      className={`plan-ring ring-${tone}`}
      style={{ "--progress": `${progress}deg` } as CSSProperties}
    >
      <strong>{value}</strong>
      <span>{unit}</span>
    </div>
  );
}

function DatePill({ children }: { children: ReactNode }) {
  return (
    <span className="plan-date-pill">
      <CalendarDays size={15} />
      {children}
    </span>
  );
}

function MobilePostpaidPlan({ line }: { line: PhonePlanLine & { type: "mobile-postpaid" } }) {
  return (
    <section className="phone-plan-card plan-postpaid" aria-label="Postpaid mobile plan">
      <div className="plan-card-main">
        <div className="plan-copy">
          <span className="plan-owner">{line.owner}</span>
          <h3>{line.planName}</h3>
          <DatePill>{line.cycleLabel}</DatePill>
          {line.features.map((feature) => (
            <span className="plan-feature-pill" key={feature}>
              <Phone size={15} />
              {feature}
            </span>
          ))}
        </div>
        <ProgressRing
          value={String(line.dataRemaining)}
          unit={line.dataUnit}
          percent={line.dataPercent}
          tone="blue"
        />
      </div>

      <div className="plan-alert-row">
        <span className="plan-alert-icon">
          <FileText size={18} />
        </span>
        <span>{line.receiptLabel}</span>
        <strong>{line.receiptAmount}</strong>
      </div>
    </section>
  );
}

function UsageBar({
  label,
  used,
  total,
  suffix
}: {
  label: string;
  used: number;
  total: number;
  suffix: string;
}) {
  const percent = total > 0 ? `${Math.min(100, (used / total) * 100)}%` : "0%";

  return (
    <div className="plan-usage-row">
      <div>
        <span>{label}</span>
        <strong>
          {used} / {total} {suffix}
        </strong>
      </div>
      <span className="plan-usage-track">
        <span style={{ width: percent }} />
      </span>
    </div>
  );
}

function MobilePrepaidPlan({ line }: { line: PhonePlanLine & { type: "mobile-prepaid" } }) {
  return (
    <section className="phone-plan-card plan-prepaid" aria-label="Prepaid mobile plan">
      <div className="plan-card-main">
        <div className="plan-copy">
          <span className="plan-owner">{line.owner}</span>
          <h3>{line.planName}</h3>
          <DatePill>{line.balanceDueLabel}</DatePill>
        </div>
        <ProgressRing
          value={String(line.dataRemaining)}
          unit={line.dataUnit}
          percent={line.dataPercent}
          tone="mint"
        />
      </div>

      <div className="plan-usage-stack">
        <UsageBar
          label="Llamadas"
          used={line.callsUsed}
          total={line.callsTotal}
          suffix="min"
        />
        <UsageBar
          label="SMS"
          used={line.smsUsed}
          total={line.smsTotal}
          suffix="SMS"
        />
      </div>

      <div className="plan-balance-row">
        <Zap size={20} />
        <div>
          <span>Saldo disponible</span>
          <strong>{line.balance}</strong>
        </div>
      </div>
    </section>
  );
}

function HomePlan({ line }: { line: PhonePlanLine & { type: "home" } }) {
  const services = [
    {
      icon: <Wifi size={18} />,
      label: "Internet",
      value: line.internetSpeed
    },
    {
      icon: <Tv size={18} />,
      label: "TV",
      value: line.tvChannels
    },
    {
      icon: <Phone size={18} />,
      label: "Telefonia fija",
      value: line.fixedPhone
    }
  ];

  return (
    <section className="phone-plan-card plan-home" aria-label="Home plan">
      <span className="plan-paid-badge">{line.statusLabel}</span>
      <div className="plan-copy">
        <span className="plan-owner">{line.owner}</span>
        <h3>{line.planName}</h3>
        <DatePill>{line.cycleLabel}</DatePill>
      </div>

      <div className="home-service-list">
        {services.map((service) => (
          <div className="home-service-row" key={service.label}>
            <span>
              {service.icon}
              {service.label}
            </span>
            <strong>{service.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhonePlanNotFound({ call }: { call: ActionCall }) {
  const availableLines = asArray<AvailableLine>(call.args.availableLines);

  return (
    <section className="phone-plan-card plan-not-found" aria-label="Phone plan not found">
      <div className="plan-not-found-header">
        <Smartphone size={22} />
        <div>
          <h3>Linea no encontrada</h3>
          <p>{asText(call.args.notFoundMessage, "No encontre ese numero.")}</p>
        </div>
      </div>

      {availableLines.length > 0 ? (
        <div className="plan-options-list">
          {availableLines.map((line, index) => (
            <div key={`${asText(line.number, "line")}_${index}`}>
              <span>{asText(line.owner, "Linea")}</span>
              <strong>{asText(line.number, "-")}</strong>
              <small>{asText(line.planName, "Plan")}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PhonePlanStatus({ call }: { call: ActionCall }) {
  const line = readLine(call.args.line);

  if (!line) {
    return <PhonePlanNotFound call={call} />;
  }

  if (line.type === "mobile-postpaid") {
    return <MobilePostpaidPlan line={line} />;
  }

  if (line.type === "mobile-prepaid") {
    return <MobilePrepaidPlan line={line} />;
  }

  return <HomePlan line={line} />;
}
