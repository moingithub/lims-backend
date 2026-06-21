-- AlterTable
ALTER TABLE "machine_report_results" ADD COLUMN IF NOT EXISTS "mol_pct" DECIMAL(18, 4);
ALTER TABLE "machine_report_results" ADD COLUMN IF NOT EXISTS "wt_pct" DECIMAL(18, 4);
ALTER TABLE "machine_report_results" ADD COLUMN IF NOT EXISTS "gpm" DECIMAL(18, 4);

-- Backfill mol_pct from normalized
UPDATE "machine_report_results"
SET "mol_pct" = "normalized"
WHERE "normalized" IS NOT NULL;

-- Backfill wt_pct: Round(100 * normalized * molecular_weight / sum(normalized * molecular_weight), 4)
UPDATE "machine_report_results" AS mrr
SET "wt_pct" = calc."wt_pct"
FROM (
  SELECT
    m."id",
    ROUND(
      (100.0 * m."normalized" * gcm."molecular_weight") /
      NULLIF(
        SUM(m."normalized" * gcm."molecular_weight") OVER (
          PARTITION BY m."import_machine_report_id", m."analysis_position"
        ),
        0
      ),
      4
    ) AS "wt_pct"
  FROM "machine_report_results" AS m
  INNER JOIN "gas_component_master" AS gcm
    ON gcm."component_code" = m."component"
  WHERE m."normalized" IS NOT NULL
    AND gcm."molecular_weight" IS NOT NULL
) AS calc
WHERE mrr."id" = calc."id";

-- Backfill gpm for liquefiable components (GPA factor 0.002767)
UPDATE "machine_report_results" AS mrr
SET "gpm" = ROUND(mrr."normalized" * gcm."molecular_weight" * 0.002767, 4)
FROM "gas_component_master" AS gcm
WHERE gcm."component_code" = mrr."component"
  AND gcm."has_gpm" = true
  AND mrr."normalized" IS NOT NULL
  AND gcm."molecular_weight" IS NOT NULL;
