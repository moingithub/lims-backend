-- Expose import_machine_reports.import_id on sample_analysis_position view.
DROP VIEW IF EXISTS "sample_analysis_position";

CREATE VIEW "sample_analysis_position" AS
SELECT
  sc.id AS sample_checkin_id,
  c.name AS company_name,
  sc.work_order_number,
  sc.cylinder_number,
  sc.analysis_number,
  sc.status,
  sc.analysis_position,
  sc.import_machine_report_id,
  imr.import_id
FROM sample_checkin sc
INNER JOIN companies c ON c.id = sc.company_id
LEFT JOIN import_machine_reports imr ON imr.id = sc.import_machine_report_id;
