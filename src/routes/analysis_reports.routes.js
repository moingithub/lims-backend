const express = require("express");
const { prisma, prismaErrorDetail } = require("../lib/common");
const { buildAnalysisReport } = require("../lib/buildAnalysisReport");

const router = express.Router();

function isCustomerWithCompany(req) {
  return (
    req &&
    req.user &&
    typeof req.user.role === "string" &&
    req.user.role.trim().toLowerCase() === "customer" &&
    req.user.company_id !== undefined &&
    req.user.company_id !== null
  );
}

// GET /analysis_reports/:sample_checkin_id — gas analysis report payload
router.get("/:sample_checkin_id", async (req, res) => {
  const sampleCheckinId = Number(req.params.sample_checkin_id);
  if (!Number.isInteger(sampleCheckinId) || sampleCheckinId <= 0) {
    return res.status(400).json({ error: "Invalid sample_checkin_id" });
  }

  try {
    if (isCustomerWithCompany(req)) {
      const checkin = await prisma.sample_checkin.findUnique({
        where: { id: sampleCheckinId },
        select: { company_id: true },
      });
      if (!checkin) {
        return res.status(404).json({ error: "Sample check-in not found" });
      }
      if (Number(checkin.company_id) !== Number(req.user.company_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const report = await buildAnalysisReport(sampleCheckinId);
    if (!report) {
      return res.status(404).json({ error: "Sample check-in not found" });
    }

    return res.json(report);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch analysis report",
      detail: prismaErrorDetail(err),
    });
  }
});

module.exports = router;
