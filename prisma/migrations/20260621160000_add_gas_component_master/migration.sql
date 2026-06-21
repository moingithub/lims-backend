-- Table may already exist outside Prisma migrations; ensure indexes are present.
CREATE INDEX IF NOT EXISTS "gas_component_master_display_order_idx" ON "gas_component_master"("display_order");
CREATE INDEX IF NOT EXISTS "gas_component_master_is_active_idx" ON "gas_component_master"("is_active");
