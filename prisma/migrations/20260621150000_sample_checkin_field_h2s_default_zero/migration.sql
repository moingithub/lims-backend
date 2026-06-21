-- AlterTable
UPDATE "sample_checkin" SET "field_h2s" = 0 WHERE "field_h2s" IS NULL;

ALTER TABLE "sample_checkin" ALTER COLUMN "field_h2s" SET DEFAULT 0;
ALTER TABLE "sample_checkin" ALTER COLUMN "field_h2s" SET NOT NULL;
