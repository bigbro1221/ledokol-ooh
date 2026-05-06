-- =============================================================================
-- One-shot production migration: brings prod DB from the pre-multi-period
-- baseline (release fe5b505) to the current schema.prisma.
--
-- Wraps everything in a single transaction so a failure rolls back cleanly.
-- Run order:
--   1. Create new enums + reference tables
--   2. Add new columns (Screen.typeId nullable for now)
--   3. Seed reference tables (ScreenTypeRef, CurrencyRef)
--   4. Backfill: Screen.typeId from Screen.type, currency-pair from totalBudgetRub
--   5. Tighten constraints (Screen.typeId NOT NULL, add FKs)
--   6. Drop legacy: Screen.type column, ScreenType enum, Campaign.totalBudgetRub
--
-- Pre-flight on the VPS (from /opt/ooh-dashboard):
--   docker compose exec -T db pg_dump -U postgres ooh_dashboard \
--     > /opt/ooh-dashboard/backup-pre-mediatype-$(date +%Y%m%d-%H%M%S).sql
--
-- Apply (from the same dir, after the new image has been pulled but BEFORE the
-- new container starts handling traffic):
--   docker compose exec -T db psql -U postgres -d ooh_dashboard \
--     < prisma/migrations/manual/2026-05-06-prod-migration.sql
-- =============================================================================

BEGIN;

-- pgcrypto powers gen_random_uuid(); a no-op if already installed.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. New enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "MediaType" AS ENUM ('SCREENS', 'OTHER_CARRIERS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CreativeKind" AS ENUM ('CREATIVE', 'REPORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. New reference tables
-- ---------------------------------------------------------------------------
-- updatedAt has no DB default — Prisma manages it from the app via @updatedAt.
-- We pass CURRENT_TIMESTAMP explicitly in the seed INSERTs below.
CREATE TABLE IF NOT EXISTS "ScreenTypeRef" (
  "id"        TEXT PRIMARY KEY,
  "code"      TEXT NOT NULL UNIQUE,
  "nameRu"    TEXT NOT NULL,
  "nameEn"    TEXT NOT NULL,
  "nameUz"    TEXT NOT NULL,
  "category"  TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "CurrencyRef" (
  "id"        TEXT PRIMARY KEY,
  "code"      TEXT NOT NULL UNIQUE,
  "nameRu"    TEXT NOT NULL,
  "nameEn"    TEXT NOT NULL,
  "nameUz"    TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- ---------------------------------------------------------------------------
-- 3. New columns (additive — Screen.typeId stays nullable until backfill)
-- ---------------------------------------------------------------------------
ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "mediaType"            "MediaType" NOT NULL DEFAULT 'SCREENS',
  ADD COLUMN IF NOT EXISTS "additionalCurrencyId" TEXT,
  ADD COLUMN IF NOT EXISTS "additionalAmount"     BIGINT;

ALTER TABLE "CampaignPeriod"
  ADD COLUMN IF NOT EXISTS "additionalCurrencyId" TEXT,
  ADD COLUMN IF NOT EXISTS "additionalAmount"     BIGINT;

ALTER TABLE "Screen"
  ADD COLUMN IF NOT EXISTS "typeId" TEXT;

ALTER TABLE "Creative"
  ADD COLUMN IF NOT EXISTS "kind" "CreativeKind" NOT NULL DEFAULT 'CREATIVE';

-- ---------------------------------------------------------------------------
-- 4. Seed reference tables (idempotent via ON CONFLICT)
-- ---------------------------------------------------------------------------
INSERT INTO "ScreenTypeRef" ("id","code","nameRu","nameEn","nameUz","category","sortOrder","isActive","updatedAt") VALUES
  (gen_random_uuid()::text, 'LED',        'Лед экраны',              'LED screens',         'LED ekranlar',           'SCREENS',         10, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'STATIC',     'Статические щиты',        'Static boards',       'Statik bannerlar',       'SCREENS',         20, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'STOP',       'Диджитальные остановки',  'Digital stops',       'Raqamli bekatlar',       'SCREENS',         30, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'AIRPORT',    'Аэропорт',                'Airport',             'Aeroport',               'SCREENS',         40, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'BUS',        'Автобусы',                'Buses',               'Avtobuslar',             'OTHER_CARRIERS',  50, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ROOF',       'Крышные конструкции',     'Rooftop structures',  'Tom konstruksiyalari',   'OTHER_CARRIERS',  60, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'BRANDMAUER', 'Брендмауры',              'Brandmauers',         'Brendmauerlar',          'OTHER_CARRIERS',  70, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CINEMA',     'Кинотеатры',              'Cinemas',             'Kinoteatrlar',           'OTHER_CARRIERS',  80, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'METRO',      'Метро',                   'Metro',               'Metro',                  'OTHER_CARRIERS',  90, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
  SET "nameRu" = EXCLUDED."nameRu",
      "nameEn" = EXCLUDED."nameEn",
      "nameUz" = EXCLUDED."nameUz",
      "category" = EXCLUDED."category",
      "sortOrder" = EXCLUDED."sortOrder",
      "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CurrencyRef" ("id","code","nameRu","nameEn","nameUz","sortOrder","isActive","updatedAt") VALUES
  (gen_random_uuid()::text, 'UZS', 'Узбекский сум',    'Uzbekistani sum', 'O''zbek so''mi', 10, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'RUB', 'Российский рубль', 'Russian ruble',   'Rossiya rubli',  20, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'USD', 'Доллар США',       'US dollar',       'AQSH dollari',   30, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
  SET "nameRu" = EXCLUDED."nameRu",
      "nameEn" = EXCLUDED."nameEn",
      "nameUz" = EXCLUDED."nameUz",
      "sortOrder" = EXCLUDED."sortOrder",
      "updatedAt" = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 5. Backfill
-- ---------------------------------------------------------------------------
-- Screen.typeId from the legacy enum column. Casts the enum to text so the
-- equality matches ScreenTypeRef.code (LED=LED, STATIC=STATIC, etc.).
UPDATE "Screen" s
SET "typeId" = ref."id"
FROM "ScreenTypeRef" ref
WHERE ref."code" = s."type"::text
  AND s."typeId" IS NULL;

-- Sanity check — fail the transaction loudly if any Screen row is still
-- without a typeId (e.g. the enum had a value we didn't seed). The migration
-- rolls back so the user can investigate.
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM "Screen" WHERE "typeId" IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Screen.typeId backfill incomplete: % rows still NULL', missing_count;
  END IF;
END $$;

-- Campaign.totalBudgetRub → (additionalCurrency='RUB', additionalAmount=value)
UPDATE "Campaign" c
SET "additionalCurrencyId" = (SELECT "id" FROM "CurrencyRef" WHERE "code" = 'RUB'),
    "additionalAmount"     = c."totalBudgetRub"
WHERE c."totalBudgetRub" IS NOT NULL
  AND c."additionalAmount" IS NULL;

-- ---------------------------------------------------------------------------
-- 6. Tighten constraints + add FKs (Prisma-compatible names)
-- ---------------------------------------------------------------------------
ALTER TABLE "Screen" ALTER COLUMN "typeId" SET NOT NULL;

ALTER TABLE "Screen"
  ADD CONSTRAINT "Screen_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "ScreenTypeRef"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_additionalCurrencyId_fkey"
  FOREIGN KEY ("additionalCurrencyId") REFERENCES "CurrencyRef"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignPeriod"
  ADD CONSTRAINT "CampaignPeriod_additionalCurrencyId_fkey"
  FOREIGN KEY ("additionalCurrencyId") REFERENCES "CurrencyRef"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Screen_typeId_idx" ON "Screen"("typeId");

-- ---------------------------------------------------------------------------
-- 7. Drop legacy
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "Screen_type_idx";
ALTER TABLE "Screen" DROP COLUMN IF EXISTS "type";

DROP TYPE IF EXISTS "ScreenType";

ALTER TABLE "Campaign" DROP COLUMN IF EXISTS "totalBudgetRub";

COMMIT;

-- =============================================================================
-- Post-flight verification queries — run AFTER COMMIT, separately:
--
-- SELECT COUNT(*) FROM "ScreenTypeRef";       -- expect 9
-- SELECT COUNT(*) FROM "CurrencyRef";         -- expect 3
-- SELECT COUNT(*) FROM "Screen" WHERE "typeId" IS NULL;  -- expect 0
-- SELECT "code" FROM "ScreenTypeRef" ORDER BY "sortOrder";
-- =============================================================================
