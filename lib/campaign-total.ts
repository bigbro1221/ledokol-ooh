import { Decimal } from '@prisma/client/runtime/library';

export type CampaignTotalInput = {
  rawAmount: Decimal | number;
  acRate: Decimal | number;
  vatRate: Decimal | number;
};

export type CampaignTotalBreakdown = {
  rawAmount: Decimal;
  acAmount: Decimal;
  subtotal: Decimal;
  vatAmount: Decimal;
  total: Decimal;
};

export function computeCampaignTotal(input: CampaignTotalInput): CampaignTotalBreakdown {
  const raw = new Decimal(input.rawAmount.toString());
  const ac = new Decimal(input.acRate.toString());
  const vat = new Decimal(input.vatRate.toString());

  const acAmount = raw.mul(ac);
  const subtotal = raw.add(acAmount);
  const vatAmount = subtotal.mul(vat);
  const total = subtotal.add(vatAmount);

  return { rawAmount: raw, acAmount, subtotal, vatAmount, total };
}

/*
Test: rawAmount=1000000, acRate=0.15, vatRate=0.12
  acAmount  = 1 000 000 × 0.15 = 150 000
  subtotal  = 1 000 000 + 150 000 = 1 150 000
  vatAmount = 1 150 000 × 0.12 = 138 000
  total     = 1 150 000 + 138 000 = 1 288 000
*/
