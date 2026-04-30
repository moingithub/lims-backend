const express = require("express");

const rolesRouter = require("./roles.routes");
const usersRouter = require("./users.routes");
const modulesRouter = require("./modules.routes");
const companiesRouter = require("./companies.routes");
const roleModulesRouter = require("./role_modules.routes");
const companyAreasRouter = require("./company_areas.routes");
const companyContactsRouter = require("./company_contacts.routes");
const cylindersRouter = require("./cylinders.routes");
const analysisPricingRouter = require("./analysis_pricing.routes");
const workorderHeadersRouter = require("./workorder_headers.routes");
const cylinderCheckoutRouter = require("./cylinder_checkout.routes");
const sampleCheckinRouter = require("./sample_checkin.routes");
const ocrRouter = require("./ocr.routes");
const authRouter = require("./auth.routes");
const cylinderInventoryRouter = require("./cylinder_inventory.routes");
const invoicesRouter = require("./invoices.routes");
const jwtAuth = require("../middleware/jwtAuth");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "LIMS API is running", version: "1.0.0" });
});

// Protect API routes with JWT auth middleware (allow /auth unauthenticated)
// For master/lookup data, rely on per-route authorization so read-only
// endpoints remain available to all authenticated users while writes stay
// protected inside each router.
router.use("/roles", jwtAuth, rolesRouter);
router.use("/users", jwtAuth, usersRouter);
router.use("/modules", jwtAuth, modulesRouter);
router.use("/companies", jwtAuth, companiesRouter);
router.use("/role_modules", jwtAuth, roleModulesRouter);
router.use("/company_areas", jwtAuth, companyAreasRouter);
router.use("/company_contacts", jwtAuth, companyContactsRouter);
router.use("/cylinders", jwtAuth, cylindersRouter);
router.use("/analysis_pricing", jwtAuth, analysisPricingRouter);
router.use("/cylinder_checkout", jwtAuth, cylinderCheckoutRouter);
router.use("/sample_checkin", jwtAuth, sampleCheckinRouter);
router.use("/ocr", jwtAuth, ocrRouter);
router.use("/workorder_headers", jwtAuth, workorderHeadersRouter);
router.use("/cylinder_inventory", jwtAuth, cylinderInventoryRouter);
router.use("/invoices", jwtAuth, invoicesRouter);
router.use("/auth", authRouter);

module.exports = router;
