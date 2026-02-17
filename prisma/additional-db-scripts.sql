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
