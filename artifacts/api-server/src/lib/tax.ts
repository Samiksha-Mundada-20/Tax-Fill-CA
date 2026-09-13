export type TaxInput = {
  grossSalary: number;
  otherIncome?: number;
  deductions80c?: number;
  deductions80d?: number;
  deductions80g?: number;
  homeLoanInterest?: number;
  hraReceived?: number;
  rentPaid?: number;
  basicSalary?: number;
  isMetro?: boolean;
  age?: number;
};

export type RegimeResult = {
  taxableIncome: number;
  baseTax: number;
  cess: number;
  totalTax: number;
  effectiveRate: number;
  rebateApplied: boolean;
  deductions: number;
};

export type TaxSummary = {
  grossIncome: number;
  newRegime: RegimeResult;
  oldRegime: RegimeResult;
  recommendedRegime: "new" | "old";
  savings: number;
  calculatedAt: string;
};

const round = (value: number) => Math.round(value);

function progressiveTax(
  taxableIncome: number,
  slabs: Array<{ upto: number; rate: number }>,
): number {
  let remaining = taxableIncome;
  let previous = 0;
  let tax = 0;

  for (const slab of slabs) {
    const amount = Math.max(0, Math.min(remaining, slab.upto - previous));
    tax += amount * slab.rate;
    remaining -= amount;
    previous = slab.upto;
    if (remaining <= 0) break;
  }

  return tax;
}

function surcharge(taxableIncome: number, baseTax: number): number {
  if (taxableIncome > 50_000_000) return baseTax * 0.3;
  if (taxableIncome > 20_000_000) return baseTax * 0.25;
  if (taxableIncome > 10_000_000) return baseTax * 0.15;
  if (taxableIncome > 5_000_000) return baseTax * 0.1;
  return 0;
}

function makeResult(
  taxableIncome: number,
  baseTaxBeforeRebate: number,
  deductions: number,
  rebateLimit: number,
): RegimeResult {
  const rebateApplied = taxableIncome <= rebateLimit;
  const baseTax = rebateApplied ? 0 : baseTaxBeforeRebate;
  const surchargeAmount = surcharge(taxableIncome, baseTax);
  const cess = (baseTax + surchargeAmount) * 0.04;
  const totalTax = round(baseTax + surchargeAmount + cess);

  return {
    taxableIncome: round(taxableIncome),
    baseTax: round(baseTax + surchargeAmount),
    cess: round(cess),
    totalTax,
    effectiveRate: taxableIncome > 0 ? Number((totalTax / taxableIncome).toFixed(4)) : 0,
    rebateApplied,
    deductions: round(deductions),
  };
}

export function calculateTax(input: TaxInput): TaxSummary {
  const grossIncome = Math.max(0, input.grossSalary + (input.otherIncome ?? 0));
  const newTaxableIncome = Math.max(0, grossIncome - 75_000);

  const hraExemption = Math.min(
    input.hraReceived ?? 0,
    Math.max(0, (input.rentPaid ?? 0) - 0.1 * (input.basicSalary ?? 0)),
    (input.basicSalary ?? 0) * (input.isMetro ? 0.5 : 0.4),
  );
  const oldDeductions =
    50_000 +
    Math.min(input.deductions80c ?? 0, 150_000) +
    Math.min(input.deductions80d ?? 0, (input.age ?? 30) >= 60 ? 50_000 : 25_000) +
    Math.max(0, input.deductions80g ?? 0) +
    Math.min(input.homeLoanInterest ?? 0, 200_000) +
    hraExemption;
  const oldTaxableIncome = Math.max(0, grossIncome - oldDeductions);

  const newBaseTax = progressiveTax(newTaxableIncome, [
    { upto: 400_000, rate: 0 },
    { upto: 800_000, rate: 0.05 },
    { upto: 1_200_000, rate: 0.1 },
    { upto: 1_600_000, rate: 0.15 },
    { upto: 2_000_000, rate: 0.2 },
    { upto: 2_400_000, rate: 0.25 },
    { upto: Number.POSITIVE_INFINITY, rate: 0.3 },
  ]);
  const oldBaseTax = progressiveTax(oldTaxableIncome, [
    { upto: 250_000, rate: 0 },
    { upto: 500_000, rate: 0.05 },
    { upto: 1_000_000, rate: 0.2 },
    { upto: Number.POSITIVE_INFINITY, rate: 0.3 },
  ]);

  const newRegime = makeResult(newTaxableIncome, newBaseTax, 75_000, 1_200_000);
  const oldRegime = makeResult(oldTaxableIncome, oldBaseTax, oldDeductions, 500_000);
  const recommendedRegime = newRegime.totalTax <= oldRegime.totalTax ? "new" : "old";

  return {
    grossIncome: round(grossIncome),
    newRegime,
    oldRegime,
    recommendedRegime,
    savings: Math.abs(newRegime.totalTax - oldRegime.totalTax),
    calculatedAt: new Date().toISOString(),
  };
}