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
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
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
    "producer" TEXT,
    "well_name" TEXT,
    "meter_number" TEXT,
    "sample_type" TEXT NOT NULL,
    "flow_rate" TEXT,
    "pressure" TEXT,
    "pressure_unit" TEXT NOT NULL,
    "temperature" TEXT,
    "field_h2s" TEXT,
    "cost_code" TEXT,
    "checkin_type" TEXT NOT NULL,
    "invoice_ref_name" TEXT,
    "invoice_ref_value" TEXT,
    "remarks" TEXT,
    "scanned_tag_image" TEXT,
    "work_order_number" TEXT,
    "status" TEXT NOT NULL,
    "standard_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sample_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "h2_pop_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "spot_composite_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sample_checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workorder_headers" (
    "id" SERIAL NOT NULL,
    "work_order_number" TEXT NOT NULL,
    "mileage_fee" DECIMAL(12,2) NOT NULL,
    "miscellaneous_charges" DECIMAL(12,2) NOT NULL,
    "hourly_fee" DECIMAL(12,2) NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workorder_headers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_modules_role_id_module_id_key" ON "role_modules"("role_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_areas_company_id_area_key" ON "company_areas"("company_id", "area");

-- CreateIndex
CREATE UNIQUE INDEX "company_contacts_company_id_name_key" ON "company_contacts"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "cylinders_cylinder_number_key" ON "cylinders"("cylinder_number");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_pricing_analysis_type_key" ON "analysis_pricing"("analysis_type");

-- CreateIndex
CREATE INDEX "cylinder_checkout_is_returned_idx" ON "cylinder_checkout"("is_returned");

-- CreateIndex
CREATE UNIQUE INDEX "sample_checkin_analysis_number_key" ON "sample_checkin"("analysis_number");

-- CreateIndex
CREATE INDEX "sample_checkin_company_id_idx" ON "sample_checkin"("company_id");

-- CreateIndex
CREATE INDEX "sample_checkin_status_idx" ON "sample_checkin"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workorder_headers_work_order_number_key" ON "workorder_headers"("work_order_number");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_areas" ADD CONSTRAINT "company_areas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_areas" ADD CONSTRAINT "company_areas_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinders" ADD CONSTRAINT "cylinders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_pricing" ADD CONSTRAINT "analysis_pricing_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_checkout" ADD CONSTRAINT "cylinder_checkout_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_company_contact_id_fkey" FOREIGN KEY ("company_contact_id") REFERENCES "company_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_analysis_type_id_fkey" FOREIGN KEY ("analysis_type_id") REFERENCES "analysis_pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "company_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_cylinder_id_fkey" FOREIGN KEY ("cylinder_id") REFERENCES "cylinders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workorder_headers" ADD CONSTRAINT "workorder_headers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
