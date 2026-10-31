-- Block deleting company areas still linked from sample check-ins or contacts.
ALTER TABLE "sample_checkin" DROP CONSTRAINT "sample_checkin_area_id_fkey";

ALTER TABLE "sample_checkin" ADD CONSTRAINT "sample_checkin_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "company_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_contacts" DROP CONSTRAINT "company_contacts_company_area_id_fkey";

ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_area_id_fkey" FOREIGN KEY ("company_area_id") REFERENCES "company_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
