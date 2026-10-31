SELECT
  sc.company_id,
  sc.id AS sample_checkin_id,
  c.name AS company_name,
  ap.analysis_type,
  sc.cylinder_number,
  sc.analysis_number,
  sc.well_name,
  sc.meter_number,
  COALESCE(sc.sample_date::date, sc.created_at::date) AS sample_date,
  sc.status,
  sc.work_order_number,
  sc.pressure AS sample_pressure,
  sc.pressure_measured,
  sc.pressure_unit,
  sc.scanned_tag_image AS tag_image,
  sc.instrument,
  sc.analyzed_on,
  sc.analyzed_by,
  sc.effective_start_date,
  sc.effective_end_date
FROM sample_checkin sc
LEFT JOIN companies c ON c.id = sc.company_id
LEFT JOIN analysis_pricing ap ON ap.id = sc.analysis_type_id;
