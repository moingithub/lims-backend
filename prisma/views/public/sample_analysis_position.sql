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
FROM
  (
    sample_checkin sc
    INNER JOIN companies c ON ((sc.company_id = c.id))
    LEFT JOIN import_machine_reports imr ON ((imr.id = sc.import_machine_report_id))
  );
