import { z } from 'zod';

export const ScreenRowSchema = z.object({
  // Canonical screen-type code (LED/STATIC/STOP/AIRPORT/BUS/ROOF/BRANDMAUER/CINEMA/METRO)
  // OR a normalised fallback (uppercase Cyrillic+Latin) when the file uses an
  // unrecognised type. Confirm route auto-creates a ScreenTypeRef row for the
  // fallback codes so unknown types don't block the upload.
  typeCode: z.string().min(1),
  // Original free-form text from the file's "Тип" column. When typeCode is
  // a fallback, this gets stored as the new ScreenTypeRef's locale names so
  // the admin sees the original spelling and can rename later.
  typeName: z.string().nullable().optional(),
  city: z.string().min(1, 'City is required'),
  address: z.string().min(1, 'Address is required'),
  size: z.string().nullable(),
  resolution: z.string().nullable(),
  externalId: z.string().nullable(),
  photoUrl: z.string().url().nullable().or(z.literal(null)),
  impressionsPerDay: z.number().nullable(),
  spotDurationSec: z.number().nullable(),
  workingHours: z.string().nullable(),
  spotsPerBlock: z.number().nullable(),
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

export const MultiPeriodRowSchema = z.object({
  screen: ScreenRowSchema,
  periodStart: z.date(),
  periodEnd: z.date(),
  periodLabel: z.string(),
});

export type MultiPeriodRow = z.infer<typeof MultiPeriodRowSchema>;

export interface MultiPeriodParseResult {
  campaign: CampaignData;
  rows: MultiPeriodRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
}

export const CampaignDataSchema = z.object({
  clientName: z.string().min(1),
  project: z.string().nullable(),
  yandexMapUrl: z.string().url().nullable().or(z.literal(null)),
  totalBudgetUzs: z.number().nullable(),
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
