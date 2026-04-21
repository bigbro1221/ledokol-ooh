import { z } from 'zod';

export const ScreenRowSchema = z.object({
  type: z.enum(['LED', 'STATIC', 'STOP', 'AIRPORT', 'BUS']),
  city: z.string().min(1, 'City is required'),
  address: z.string().min(1, 'Address is required'),
  size: z.string().nullable(),
  resolution: z.string().nullable(),
  externalId: z.string().nullable(),
  photoUrl: z.string().url().nullable().or(z.literal(null)),
  impressionsPerDay: z.number().nullable(),
  priceUnit: z.number().nullable(),
  priceDiscounted: z.number().nullable(),
  priceTotal: z.number().nullable(),
  priceRub: z.number().nullable(),
  commissionPct: z.number().nullable(),
  agencyFeeAmt: z.number().nullable(),
  productionCost: z.number().nullable(),
  otsPlan: z.number().nullable(),
  ratingPlan: z.number().nullable(),
  otsFact: z.number().nullable(),
  ratingFact: z.number().nullable(),
  universe: z.number().nullable(),
});

export type ScreenRow = z.infer<typeof ScreenRowSchema>;

export const CampaignDataSchema = z.object({
  clientName: z.string().min(1),
  project: z.string().nullable(),
  yandexMapUrl: z.string().url().nullable().or(z.literal(null)),
  totalBudgetUzs: z.number().nullable(),
  totalBudgetRub: z.number().nullable(),
});

export type CampaignData = z.infer<typeof CampaignDataSchema>;

export interface ParseError {
  sheet: string;
  row: number;
  field: string;
  message: string;
}

export interface ParseWarning {
  sheet: string;
  message: string;
}

export interface ParseResult {
  campaign: CampaignData;
  screens: ScreenRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
}
