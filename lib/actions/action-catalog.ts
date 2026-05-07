export type GenericActionKind = "view" | "hitl";

export type GenericActionCatalogItem = {
  name:
    | "showPhonePlanStatus"
    | "showServiceStatus"
    | "payServiceDebts";
  kind: GenericActionKind;
  title: string;
  description: string;
  examplePrompt: string;
};

export const genericActionCatalog = [
  {
    name: "showPhonePlanStatus",
    kind: "view",
    title: "Estado de plan",
    description:
      "Shows the status of one of the user's three phone lines: two mobile lines and one home line with internet, TV and fixed phone.",
    examplePrompt:
      "Quiero ver estado de mi plan del numero 955123456."
  },
  {
    name: "showServiceStatus",
    kind: "view",
    title: "Estado de servicios",
    description:
      "Shows the current status of home services: internet, fixed phone and TV.",
    examplePrompt: "Quiero ver el estado de mis servicios."
  },
  {
    name: "payServiceDebts",
    kind: "hitl",
    title: "Pago de deudas",
    description:
      "Shows pending service debts and waits for the user to confirm or cancel payment.",
    examplePrompt: "Quiero pagar los servicios que tengan deudas."
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
