-- Rename cylinders.location -> status (same allowed values)
ALTER TABLE "cylinders" DROP CONSTRAINT IF EXISTS "chk_location";

ALTER TABLE "cylinders" RENAME COLUMN "location" TO "status";

ALTER TABLE "cylinders"
ADD CONSTRAINT "chk_cylinder_status"
CHECK ("status" IN ('Clean Cylinder', 'Checked Out', 'Checked In'));

ALTER TABLE "cylinders" ALTER COLUMN "status" SET DEFAULT 'Clean Cylinder';
