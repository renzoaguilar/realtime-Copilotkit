export type ServiceDebtItem = {
  id: string;
  serviceLabel: string;
  accountNumber: string;
  description: string;
  dueDate: string;
  amount: number;
  amountLabel: string;
  statusLabel: string;
};

export const serviceDebtItems: ServiceDebtItem[] = [
  {
    id: "debt_mobile_955123456",
    serviceLabel: "Linea movil",
    accountNumber: "955123456",
    description: "Max Ilimitado 69.90",
    dueDate: "Vence el 18/02",
    amount: 69.9,
    amountLabel: "S/ 69.90",
    statusLabel: "Pendiente"
  }
];

export const defaultPaymentMethod = {
  label: "Tarjeta Visa",
  detail: "terminada en 4242"
};

export function getDebtTotal(debts = serviceDebtItems) {
  return debts.reduce((total, debt) => total + debt.amount, 0);
}

export function formatSolesAmount(amount: number) {
  return `S/ ${amount.toFixed(2)}`;
}
