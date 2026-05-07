export type PhonePlanLine =
  | {
      type: "mobile-postpaid";
      number: string;
      owner: "Personal";
      planName: string;
      cycleLabel: string;
      dataRemaining: number;
      dataUnit: string;
      dataPercent: number;
      features: string[];
      receiptLabel: string;
      receiptAmount: string;
    }
  | {
      type: "mobile-prepaid";
      number: string;
      owner: "Personal";
      planName: string;
      balanceDueLabel: string;
      dataRemaining: number;
      dataUnit: string;
      dataPercent: number;
      callsUsed: number;
      callsTotal: number;
      smsUsed: number;
      smsTotal: number;
      balance: string;
    }
  | {
      type: "home";
      number: string;
      owner: "Hogar";
      statusLabel: string;
      planName: string;
      cycleLabel: string;
      internetSpeed: string;
      tvChannels: string;
      fixedPhone: string;
    };

export const phonePlanLines: PhonePlanLine[] = [
  {
    type: "mobile-postpaid",
    number: "955123456",
    owner: "Personal",
    planName: "Max Ilimitado 69.90",
    cycleLabel: "18/02 reinicia tu ciclo",
    dataRemaining: 40,
    dataUnit: "GB restantes",
    dataPercent: 0.68,
    features: ["Llamadas y SMS ilimitados"],
    receiptLabel: "Tienes un recibo pendiente de pago",
    receiptAmount: "S/ 69.90"
  },
  {
    type: "mobile-prepaid",
    number: "988654321",
    owner: "Personal",
    planName: "Prepago",
    balanceDueLabel: "tu saldo vence el 18/02",
    dataRemaining: 278,
    dataUnit: "MB restantes",
    dataPercent: 0.82,
    callsUsed: 320,
    callsTotal: 500,
    smsUsed: 320,
    smsTotal: 500,
    balance: "S/ 5.50"
  },
  {
    type: "home",
    number: "015103000",
    owner: "Hogar",
    statusLabel: "Pago al dia",
    planName: "Internet 300 Mbps + TV",
    cycleLabel: "18/02 reinicia tu ciclo",
    internetSpeed: "300 Mbps",
    tvChannels: "120+ canales HD",
    fixedPhone: "Ilimitado"
  }
];

export function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function findPhonePlanLine(phoneNumber: string) {
  const normalized = normalizePhoneNumber(phoneNumber);

  return phonePlanLines.find((line) => {
    const lineNumber = normalizePhoneNumber(line.number);

    return (
      normalized === lineNumber ||
      normalized.endsWith(lineNumber) ||
      lineNumber.endsWith(normalized)
    );
  });
}

export function getPhonePlanLineOptions() {
  return phonePlanLines.map((line) => ({
    number: line.number,
    owner: line.owner,
    planName: line.planName,
    type: line.type
  }));
}
