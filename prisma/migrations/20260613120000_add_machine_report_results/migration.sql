-- AlterTable
ALTER TABLE "import_machine_reports" ADD COLUMN "method_name" TEXT;

-- CreateTable
CREATE TABLE "machine_report_results" (
    "id" SERIAL NOT NULL,
    "import_machine_report_id" INTEGER NOT NULL,
    "analysis_position" INTEGER NOT NULL,
    "sample_time" TIMESTAMP(3),
    "sample_name" TEXT,
    "detector_module" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "method_name" TEXT,
    "rt_s" DECIMAL(12,6),
    "area" DECIMAL(18,6),
    "normalized_concentration" DECIMAL(18,12),
    "concentration" DECIMAL(18,12),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_report_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "machine_report_results_import_machine_report_id_idx" ON "machine_report_results"("import_machine_report_id");

-- CreateIndex
CREATE INDEX "machine_report_results_analysis_position_idx" ON "machine_report_results"("analysis_position");

-- CreateIndex
CREATE INDEX "machine_report_results_component_idx" ON "machine_report_results"("component");

-- CreateIndex
CREATE UNIQUE INDEX "machine_report_results_import_machine_report_id_analysis_position_detector_module_component_key" ON "machine_report_results"("import_machine_report_id", "analysis_position", "detector_module", "component");

-- AddForeignKey
ALTER TABLE "machine_report_results" ADD CONSTRAINT "machine_report_results_import_machine_report_id_fkey" FOREIGN KEY ("import_machine_report_id") REFERENCES "import_machine_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
