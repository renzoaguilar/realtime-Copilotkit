export type GenericActionKind = "view" | "hitl";

export type GenericActionCatalogItem = {
  name:
    | "showWorkspaceOverview"
    | "showItemList"
    | "collectRequiredInfo"
    | "confirmOperation";
  kind: GenericActionKind;
  title: string;
  description: string;
  examplePrompt: string;
};

export const genericActionCatalog = [
  {
    name: "showWorkspaceOverview",
    kind: "view",
    title: "Resumen visual",
    description:
      "Shows a generic visual overview with metrics, status cards and next steps.",
    examplePrompt:
      "Muéstrame un resumen demo del workspace con tres métricas y próximos pasos."
  },
  {
    name: "showItemList",
    kind: "view",
    title: "Lista de elementos",
    description:
      "Shows a generic list of records, tasks, cases, products or any domain item.",
    examplePrompt:
      "Muéstrame una lista demo de tareas pendientes con cinco elementos."
  },
  {
    name: "collectRequiredInfo",
    kind: "hitl",
    title: "Formulario HITL",
    description:
      "Shows a dynamic form and waits for the user to provide missing information.",
    examplePrompt:
      "Necesito registrar un contacto demo, pídeme nombre, email y fecha de seguimiento."
  },
  {
    name: "confirmOperation",
    kind: "hitl",
    title: "Confirmación HITL",
    description:
      "Shows a review card and waits for the user to confirm or cancel before continuing.",
    examplePrompt:
      "Antes de publicar una configuración demo, muéstrame una confirmación."
  }
] satisfies GenericActionCatalogItem[];

export function formatActionCatalogForPrompt() {
  return genericActionCatalog
    .map(
      (action) =>
        `- ${action.name} (${action.kind}): ${action.description} Ejemplo: "${action.examplePrompt}"`
    )
    .join("\n");
}
