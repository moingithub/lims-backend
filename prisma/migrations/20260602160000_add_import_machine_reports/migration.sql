-- CreateTable
CREATE TABLE "import_machine_reports" (
    "id" SERIAL NOT NULL,
    "import_id" TEXT NOT NULL,
    "source_machine" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Imported',
    "file_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_machine_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_machine_reports_import_id_key" ON "import_machine_reports"("import_id");

-- CreateIndex
CREATE INDEX "import_machine_reports_created_by_id_idx" ON "import_machine_reports"("created_by_id");

-- CreateIndex
CREATE INDEX "import_machine_reports_status_idx" ON "import_machine_reports"("status");

-- AddForeignKey
ALTER TABLE "import_machine_reports" ADD CONSTRAINT "import_machine_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
