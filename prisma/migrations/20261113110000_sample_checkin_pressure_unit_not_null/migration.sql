-- Align with additional-db-scripts.sql (pressure_unit NOT NULL)
UPDATE "sample_checkin"
SET "pressure_unit" = 'PSIG'
WHERE "pressure_unit" IS NULL OR TRIM("pressure_unit") = '';

ALTER TABLE "sample_checkin" ALTER COLUMN "pressure_unit" SET NOT NULL;
