-- Recreate view to expose sample_checkin.import_machine_report_id.
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
  sc.import_machine_report_id
FROM sample_checkin sc
INNER JOIN companies c ON sc.company_id = c.id;
