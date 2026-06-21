-- AlterTable
ALTER TABLE "sample_checkin"
ALTER COLUMN "field_h2s" TYPE DOUBLE PRECISION
USING (
  NULLIF(
    REGEXP_REPLACE("field_h2s", '[^0-9.+\-]', '', 'g'),
    ''
  )::double precision
);
