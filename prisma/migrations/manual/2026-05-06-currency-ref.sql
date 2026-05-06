-- Backfill Campaign.additionalCurrencyId / CampaignPeriod.additionalCurrencyId
-- from the legacy free-text `additionalCurrency` column. Idempotent: only
-- updates rows where the FK column is still NULL.
UPDATE "Campaign" c
SET "additionalCurrencyId" = cr."id"
FROM "CurrencyRef" cr
WHERE cr."code" = c."additionalCurrency"
  AND c."additionalCurrencyId" IS NULL;

UPDATE "CampaignPeriod" cp
SET "additionalCurrencyId" = cr."id"
FROM "CurrencyRef" cr
WHERE cr."code" = cp."additionalCurrency"
  AND cp."additionalCurrencyId" IS NULL;
