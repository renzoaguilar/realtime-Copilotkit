export type ServiceStatusTone = "ok" | "fault" | "restarting";

export type ServiceStatusItem = {
  id: "internet" | "fixed-phone" | "tv";
  label: string;
  description: string;
  statusLabel: string;
  tone: ServiceStatusTone;
};

export const serviceStatusItems: ServiceStatusItem[] = [
  {
    id: "internet",
    label: "Internet",
    description: "Servicio funcionando correctamente",
    statusLabel: "OK",
    tone: "ok"
  },
  {
    id: "fixed-phone",
    label: "Telefonia fija",
    description: "Presenta fallas intermitentes",
    statusLabel: "FALLA",
    tone: "fault"
  },
  {
    id: "tv",
    label: "TV",
    description: "Servicio reiniciandose...",
    statusLabel: "",
    tone: "restarting"
  }
];
