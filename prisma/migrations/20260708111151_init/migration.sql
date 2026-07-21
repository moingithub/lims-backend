-- CreateEnum
CREATE TYPE "analysis_result_metric_type" AS ENUM ('gross_heating_value', 'specific_gravity', 'compressibility_factor', 'gpm');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role_id" INTEGER,
    "company_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "billing_ref" TEXT,
    "billing_ref_no" TEXT,
    "billing_address" TEXT,
    "charge_h2_pop_fee" BOOLEAN NOT NULL DEFAULT false,
    "h2_pop_fee_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pressure_base" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "pressure_base_factor" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_modules" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_areas" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "area" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_contacts" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "company_area_id" INTEGER,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cylinders" (
    "id" SERIAL NOT NULL,
    "cylinder_number" TEXT NOT NULL,
    "cylinder_type" TEXT NOT NULL,
    "track_inventory" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cylinders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_pricing" (
    "id" SERIAL NOT NULL,
    "analysis_type" TEXT NOT NULL,
    "description" TEXT,
    "standard_rate" DECIMAL(12,2) NOT NULL,
    "rushed_rate" DECIMAL(12,2) NOT NULL,
    "sample_fee" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cylinder_checkout" (
    "id" SERIAL NOT NULL,
    "cylinder_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "company_contact_id" INTEGER NOT NULL,
    "is_returned" BOOLEAN NOT NULL DEFAULT false,
    "returned_at" TIMESTAMP(3),
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cylinder_checkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_checkin" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "company_contact_id" INTEGER NOT NULL,
    "analysis_type_id" INTEGER NOT NULL,
    "area_id" INTEGER,
    "customer_cylinder" BOOLEAN NOT NULL DEFAULT false,
    "rushed" BOOLEAN NOT NULL DEFAULT false,
    "sampled_by_lab" BOOLEAN NOT NULL DEFAULT false,
    "cylinder_id" INTEGER,
    "cylinder_number" TEXT,
    "analysis_number" TEXT NOT NULL,
    "analysis_position" INTEGER,
    "producer" TEXT,
    "well_name" TEXT,
    "meter_number" TEXT,
    "sample_type" TEXT NOT NULL,
    "flow_rate" TEXT,
    "pressure" TEXT,
    "pressure_unit" TEXT,
    "temperature" TEXT,
    "field_h2s" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pressure_base_factor" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "cost_code" TEXT,
    "checkin_type" TEXT NOT NULL,
    "invoice_ref_name" TEXT,
    "invoice_ref_value" TEXT,
    "remarks" TEXT,
    "scanned_tag_image" TEXT,
    "work_order_number" TEXT,
    "status" TEXT NOT NULL,
    "standard_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "applied_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sample_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "h2_pop_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "spot_composite_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "import_machine_report_id" INTEGER,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sample_checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workorder_headers" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "work_order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "work_order_number" TEXT NOT NULL,
    "cylinders" INTEGER NOT NULL DEFAULT 0,
    "mileage_fee" DECIMAL(12,2) NOT NULL,
    "miscellaneous_charges" DECIMAL(12,2) NOT NULL,
    "hourly_fee" DECIMAL(12,2) NOT NULL,
    "miles" DECIMAL(12,2) NOT NULL,
    "rate_per_mile" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workorder_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_headers" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "service_start_date" DATE,
    "service_end_date" DATE,
    "po_number" TEXT,
    "location" TEXT,
    "miles" DECIMAL(12,2) NOT NULL,
    "rate_per_mile" DECIMAL(12,2) NOT NULL,
    "mileage_fee" DECIMAL(12,2) NOT NULL,
    "miscellaneous_charges" DECIMAL(12,2) NOT NULL,
    "hourly_fee" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2),
    "tax_amount" DECIMAL(12,2),
    "total_amount" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payment_status" TEXT NOT NULL DEFAULT 'Pending',
    "authorized_by" TEXT,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "sample_checkin_id" INTEGER NOT NULL,
    "analysis_number" TEXT NOT NULL,
    "description" TEXT,
    "service_date" DATE,
    "report_number" TEXT,
    "analysis_method" TEXT,
    "quantity" DECIMAL(12,2),
    "unit_price" DECIMAL(12,2),
    "amount" DECIMAL(12,2),
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_machine_reports" (
    "id" SERIAL NOT NULL,
    "import_id" TEXT NOT NULL,
    "source_machine" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Imported',
    "file_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "method_name" TEXT,
    "company_id" INTEGER,
    "pressure_base" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "pressure_base_factor" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_machine_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_report_results" (
    "id" SERIAL NOT NULL,
    "import_machine_report_id" INTEGER NOT NULL,
    "analysis_position" INTEGER NOT NULL,
    "sample_time" TIMESTAMP(3),
    "sample_name" TEXT,
    "component" TEXT NOT NULL,
    "component_description" VARCHAR(150) NOT NULL,
    "method_name" TEXT,
    "normalized_concentration" DECIMAL(18,12),
    "concentration" DECIMAL(18,12),
    "normalized" DECIMAL(18,4),
    "mol_pct" DECIMAL(18,4),
    "wt_pct" DECIMAL(18,4),
    "gpm" DECIMAL(18,4),
    "dry_gross_ideal" DECIMAL(18,4),
    "wet_sample_ideal" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_report_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_result_metrics" (
    "id" SERIAL NOT NULL,
    "import_machine_report_id" INTEGER NOT NULL,
    "analysis_position" INTEGER NOT NULL,
    "metric" "analysis_result_metric_type" NOT NULL,
    "dry_ideal" DECIMAL(18,6),
    "dry_real" DECIMAL(18,6),
    "wet_ideal" DECIMAL(18,6),
    "wet_real" DECIMAL(18,6),

    CONSTRAINT "analysis_result_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gas_component_master" (
    "component_id" SERIAL NOT NULL,
    "component_code" VARCHAR(10) NOT NULL,
    "component_name" VARCHAR(100) NOT NULL,
    "chemical_formula" VARCHAR(50),
    "calculation_formula" TEXT,
    "comments" TEXT,
    "display_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "molecular_weight" DECIMAL(8,4),
    "gal_per_lb_mol" DECIMAL(10,4),
    "gross_heating_value" DECIMAL(10,4),
    "has_gpm" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gas_component_master_pkey" PRIMARY KEY ("component_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "users_created_by_id_idx" ON "users"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_created_by_id_idx" ON "companies"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_created_by_id_idx" ON "roles"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");

-- CreateIndex
CREATE INDEX "modules_created_by_id_idx" ON "modules"("created_by_id");

-- CreateIndex
CREATE INDEX "role_modules_module_id_idx" ON "role_modules"("module_id");

-- CreateIndex
CREATE INDEX "role_modules_created_by_id_idx" ON "role_modules"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_modules_role_id_module_id_key" ON "role_modules"("role_id", "module_id");

-- CreateIndex
CREATE INDEX "company_areas_created_by_id_idx" ON "company_areas"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_areas_company_id_area_key" ON "company_areas"("company_id", "area");

-- CreateIndex
CREATE INDEX "company_contacts_company_area_id_idx" ON "company_contacts"("company_area_id");

-- CreateIndex
CREATE INDEX "company_contacts_created_by_id_idx" ON "company_contacts"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_contacts_company_id_name_key" ON "company_contacts"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "cylinders_cylinder_number_key" ON "cylinders"("cylinder_number");

-- CreateIndex
CREATE INDEX "cylinders_created_by_id_idx" ON "cylinders"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_pricing_analysis_type_key" ON "analysis_pricing"("analysis_type");

-- CreateIndex
CREATE INDEX "analysis_pricing_created_by_id_idx" ON "analysis_pricing"("created_by_id");

-- CreateIndex
CREATE INDEX "cylinder_checkout_cylinder_id_idx" ON "cylinder_checkout"("cylinder_id");

-- CreateIndex
CREATE INDEX "cylinder_checkout_company_id_idx" ON "cylinder_checkout"("company_id");

-- CreateIndex
CREATE INDEX "cylinder_checkout_company_contact_id_idx" ON "cylinder_checkout"("company_contact_id");

-- CreateIndex
CREATE INDEX "cylinder_checkout_created_by_id_idx" ON "cylinder_checkout"("created_by_id");

-- CreateIndex
CREATE INDEX "cylinder_checkout_is_returned_idx" ON "cylinder_checkout"("is_returned");

-- CreateIndex
CREATE UNIQUE INDEX "sample_checkin_analysis_number_key" ON "sample_checkin"("analysis_number");

-- CreateIndex
CREATE INDEX "sample_checkin_company_id_idx" ON "sample_checkin"("company_id");

-- CreateIndex
CREATE INDEX "sample_checkin_company_contact_id_idx" ON "sample_checkin"("company_contact_id");

-- CreateIndex
CREATE INDEX "sample_checkin_analysis_type_id_idx" ON "sample_checkin"("analysis_type_id");

-- CreateIndex
CREATE INDEX "sample_checkin_area_id_idx" ON "sample_checkin"("area_id");

-- CreateIndex
CREATE INDEX "sample_checkin_cylinder_id_idx" ON "sample_checkin"("cylinder_id");

-- CreateIndex
CREATE INDEX "sample_checkin_import_machine_report_id_idx" ON "sample_checkin"("import_machine_report_id");

-- CreateIndex
CREATE INDEX "sample_checkin_created_by_id_idx" ON "sample_checkin"("created_by_id");

-- CreateIndex
CREATE INDEX "sample_checkin_status_idx" ON "sample_checkin"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sample_checkin_work_order_number_analysis_position_key" ON "sample_checkin"("work_order_number", "analysis_position");

-- CreateIndex
CREATE UNIQUE INDEX "workorder_headers_work_order_number_key" ON "workorder_headers"("work_order_number");

-- CreateIndex
CREATE INDEX "workorder_headers_company_id_idx" ON "workorder_headers"("company_id");

-- CreateIndex
CREATE INDEX "workorder_headers_created_by_id_idx" ON "workorder_headers"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_headers_invoice_number_key" ON "invoice_headers"("invoice_number");

-- CreateIndex
CREATE INDEX "invoice_headers_company_id_idx" ON "invoice_headers"("company_id");

-- CreateIndex
CREATE INDEX "invoice_headers_created_by_id_idx" ON "invoice_headers"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_sample_checkin_id_key" ON "invoice_lines"("sample_checkin_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_analysis_number_key" ON "invoice_lines"("analysis_number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_lines_created_by_id_idx" ON "invoice_lines"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_machine_reports_import_id_key" ON "import_machine_reports"("import_id");

-- CreateIndex
CREATE INDEX "import_machine_reports_created_by_id_idx" ON "import_machine_reports"("created_by_id");

-- CreateIndex
CREATE INDEX "import_machine_reports_company_id_idx" ON "import_machine_reports"("company_id");

-- CreateIndex
CREATE INDEX "import_machine_reports_status_idx" ON "import_machine_reports"("status");

-- CreateIndex
CREATE INDEX "machine_report_results_import_machine_report_id_idx" ON "machine_report_results"("import_machine_report_id");

-- CreateIndex
CREATE INDEX "machine_report_results_analysis_position_idx" ON "machine_report_results"("analysis_position");

-- CreateIndex
CREATE INDEX "machine_report_results_component_idx" ON "machine_report_results"("component");

-- CreateIndex
CREATE UNIQUE INDEX "machine_report_results_import_machine_report_id_analysis_po_key" ON "machine_report_results"("import_machine_report_id", "analysis_position", "component");

-- CreateIndex
CREATE INDEX "analysis_result_metrics_import_machine_report_id_idx" ON "analysis_result_metrics"("import_machine_report_id");

-- CreateIndex
CREATE INDEX "analysis_result_metrics_analysis_position_idx" ON "analysis_result_metrics"("analysis_position");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_result_metrics_import_machine_report_id_analysis_p_key" ON "analysis_result_metrics"("import_machine_report_id", "analysis_position", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "gas_component_master_component_code_key" ON "gas_component_master"("component_code");

-- CreateIndex
CREATE INDEX "gas_component_master_display_order_idx" ON "gas_component_master"("display_order");

-- CreateIndex
CREATE INDEX "gas_component_master_is_active_idx" ON "gas_component_master"("is_active");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_areas" ADD CONSTRAINT "company_areas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_areas" ADD CONSTRAINT "company_areas_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_area_id_fkey" FOREIGN KEY ("company_area_id") REFERENCES "company_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinders" ADD CONSTRAINT "cylinders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_pricing" ADD CONSTRAINT "analysis_pricing_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_checkout" ADD CONSTRAINT "cylinder_checkout_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_checkout" ADD CONSTRAINT "cylinder_checkout_cylinder_id_fkey" FOREIGN KEY ("cylinder_id") REFERENCES "cylinders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_checkout" ADD CONSTRAINT "cylinder_checkout_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_checkout" ADD CONSTRAINT "cylinder_checkout_company_contact_id_fkey" FOREIGN KEY ("company_contact_id") REFERENCES "company_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_analysis_type_id_fkey" FOREIGN KEY ("analysis_type_id") REFERENCES "analysis_pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "company_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_company_contact_id_fkey" FOREIGN KEY ("company_contact_id") REFERENCES "company_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_cylinder_id_fkey" FOREIGN KEY ("cylinder_id") REFERENCES "cylinders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_import_machine_report_id_fkey" FOREIGN KEY ("import_machine_report_id") REFERENCES "import_machine_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workorder_headers" ADD CONSTRAINT "workorder_headers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workorder_headers" ADD CONSTRAINT "workorder_headers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_headers" ADD CONSTRAINT "invoice_headers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_headers" ADD CONSTRAINT "invoice_headers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_sample_checkin_id_fkey" FOREIGN KEY ("sample_checkin_id") REFERENCES "sample_checkin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_machine_reports" ADD CONSTRAINT "import_machine_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_machine_reports" ADD CONSTRAINT "import_machine_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_report_results" ADD CONSTRAINT "machine_report_results_import_machine_report_id_fkey" FOREIGN KEY ("import_machine_report_id") REFERENCES "import_machine_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_result_metrics" ADD CONSTRAINT "analysis_result_metrics_import_machine_report_id_fkey" FOREIGN KEY ("import_machine_report_id") REFERENCES "import_machine_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
