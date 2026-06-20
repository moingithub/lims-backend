-- AlterTable
ALTER TABLE "sample_checkin" ADD COLUMN "analysis_position" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "sample_checkin_work_order_number_analysis_position_key" ON "sample_checkin"("work_order_number", "analysis_position");
