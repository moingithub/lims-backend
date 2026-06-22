-- Link sample_checkin to the machine report used for analysis (set later, not at check-in creation).
ALTER TABLE "sample_checkin"
ADD COLUMN "import_machine_report_id" INTEGER;

ALTER TABLE "sample_checkin"
ADD CONSTRAINT "sample_checkin_import_machine_report_id_fkey"
FOREIGN KEY ("import_machine_report_id")
REFERENCES "import_machine_reports"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "sample_checkin_import_machine_report_id_idx"
ON "sample_checkin"("import_machine_report_id");
