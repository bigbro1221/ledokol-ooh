-- Backfill Screen.typeId from the legacy `Screen.type` enum column.
--
-- The reference table is mapped to the Prisma model `ScreenTypeRef`, which
-- becomes the Postgres relation `"ScreenTypeRef"` (the legacy enum type still
-- occupies the name `ScreenType` until a later task drops it).
UPDATE "Screen" s
SET "typeId" = st."id"
FROM "ScreenTypeRef" st
WHERE st."code" = s."type"::text
  AND s."typeId" IS NULL;
