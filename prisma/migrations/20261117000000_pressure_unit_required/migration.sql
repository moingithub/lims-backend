-- Backfill first in case any environment still has NULLs
UPDATE "sample_checkin" SET "pressure_unit" = 'psi' WHERE "pressure_unit" IS NULL;

ALTER TABLE "sample_checkin" ALTER COLUMN "pressure_unit" SET NOT NULL;