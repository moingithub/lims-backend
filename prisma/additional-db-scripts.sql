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
ADD CONSTRAINT chk_location
CHECK (location IN ('Clean Cylinder', 'Checked Out','Checked In'));

ALTER TABLE cylinders
ALTER COLUMN location SET NOT NULL;

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
    ON ih.company_id = comp.id