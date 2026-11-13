ALTER TABLE sample_checkin
ADD CONSTRAINT chk_sample_type
CHECK (sample_type IN ('Spot', 'Composite'));

ALTER TABLE sample_checkin
ALTER COLUMN sample_type SET NOT NULL;

ALTER TABLE sample_checkin
ADD CONSTRAINT chk_pressure_unit
CHECK (pressure_unit IN ('PSIG', 'PSIA'));

ALTER TABLE sample_checkin
ALTER COLUMN pressure_unit SET NOT NULL;

-- Add new constraint with updated allowed values
ALTER TABLE sample_checkin
ADD CONSTRAINT chk_checkin_type
CHECK (checkin_type IN ('Cylinder', 'Bottle', 'CP Cylinder'));

ALTER TABLE sample_checkin
ALTER COLUMN checkin_type SET NOT NULL;

--------------------------------------------------

ALTER TABLE cylinders
ADD CONSTRAINT chk_cylinder_type
CHECK (cylinder_type IN ('Gas', 'Liquid'));

ALTER TABLE cylinders
ALTER COLUMN cylinder_type SET NOT NULL;


ALTER TABLE cylinders
ADD CONSTRAINT chk_cylinder_status
CHECK (status IN ('Clean Cylinder', 'Checked Out','Checked In'));

ALTER TABLE cylinders
ALTER COLUMN status SET NOT NULL;

ALTER TABLE cylinders
ALTER COLUMN status SET DEFAULT 'Clean Cylinder';

--------------------------------------------------
CREATE VIEW open_checkout AS
SELECT
    cc.id,
    comp.name AS company_name,
    cyl.cylinder_type,
    cyl.cylinder_number,
    contact.name AS contact_name,
    contact.phone,
    contact.email,
    cc.created_at AS checkout_date
FROM cylinder_checkout cc
LEFT JOIN cylinders cyl 
    ON cc.cylinder_id = cyl.id
LEFT JOIN companies comp 
    ON cc.company_id = comp.id
LEFT JOIN company_contacts contact 
    ON cc.company_contact_id = contact.id
WHERE cc.is_returned = false;

--------------------------------------------------
CREATE VIEW Invoice_list AS
SELECT 
ih.id,
ih.invoice_date,
comp.name AS company_name,
ih.invoice_number,
ih.total_amount as amount,
ih.payment_status
FROM
invoice_headers ih
LEFT JOIN companies comp 
    ON ih.company_id = comp.id;

--------------------------------------------------

CREATE OR REPLACE VIEW sample_analysis_position AS
SELECT
    sc.id   AS sample_checkin_id,
    c.name  AS company_name,
    sc.work_order_number,
    sc.cylinder_number,
    sc.analysis_number,
    sc.status,
    sc.analysis_position,
    sc.import_machine_report_id,
    imr.import_id
FROM sample_checkin           sc
INNER JOIN companies          c   ON c.id  = sc.company_id
LEFT  JOIN import_machine_reports imr ON imr.id = sc.import_machine_report_id;

--------------------------------------------------

CREATE VIEW report_file_list AS
SELECT
    sc.company_id ,
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
	sc.pressure as sample_pressure,
	sc.pressure_measured,
	sc.pressure_unit,
	sc.scanned_tag_image AS tag_image,
	sc.instrument,
	sc.analyzed_on,
	sc.analyzed_by,
	sc.effective_start_date,
	sc.effective_end_date
FROM sample_checkin sc
LEFT JOIN companies c
    ON c.id = sc.company_id
LEFT JOIN analysis_pricing ap
    ON ap.id = sc.analysis_type_id
ORDER BY sc.id;