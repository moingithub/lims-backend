-- AlterTable
ALTER TABLE "machine_report_results" ADD COLUMN "normalized" DECIMAL(18, 4);

-- Backfill: Round(100 / sum(concentration) * concentration, 4) per (import_machine_report_id, analysis_position)
UPDATE "machine_report_results" AS mrr
SET "normalized" = ROUND(
  (100.0 / totals.sum_concentration) * mrr."concentration",
  4
)
FROM (
  SELECT
    "import_machine_report_id",
    "analysis_position",
    SUM("concentration") AS sum_concentration
  FROM "machine_report_results"
  WHERE "concentration" IS NOT NULL
  GROUP BY "import_machine_report_id", "analysis_position"
  HAVING SUM("concentration") <> 0
) AS totals
WHERE mrr."import_machine_report_id" = totals."import_machine_report_id"
  AND mrr."analysis_position" = totals."analysis_position"
  AND mrr."concentration" IS NOT NULL;
