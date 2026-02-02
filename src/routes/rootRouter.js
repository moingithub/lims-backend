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
const cylinderCheckoutRouter = require("./cylinder_checkout.routes");
const sampleCheckinRouter = require("./sample_checkin.routes");
const authRouter = require("./auth.routes");
const jwtAuth = require("../middleware/jwtAuth");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "LIMS API is running", version: "1.0.0" });
});

// Protect API routes with JWT auth middleware (allow /auth unauthenticated)
router.use("/roles", jwtAuth, authorize("roles"), rolesRouter);
router.use("/users", jwtAuth, authorize("users"), usersRouter);
router.use("/modules", jwtAuth, authorize("modules"), modulesRouter);
router.use("/companies", jwtAuth, authorize("companies"), companiesRouter);
router.use(
  "/role_modules",
  jwtAuth,
  authorize("role_modules"),
  roleModulesRouter
);
router.use(
  "/company_areas",
  jwtAuth,
  authorize("company_areas"),
  companyAreasRouter
);
router.use(
  "/company_contacts",
  jwtAuth,
  authorize("company_contacts"),
  companyContactsRouter
);
router.use("/cylinders", jwtAuth, authorize("cylinders"), cylindersRouter);
router.use(
  "/analysis_pricing",
  jwtAuth,
  authorize("analysis_pricing"),
  analysisPricingRouter
);
router.use(
  "/cylinder_checkout",
  jwtAuth,
  authorize("cylinder_checkout"),
  cylinderCheckoutRouter
);
router.use(
  "/sample_checkin",
  jwtAuth,
  authorize("sample_checkin"),
  sampleCheckinRouter
);
router.use("/auth", authRouter);

module.exports = router;
