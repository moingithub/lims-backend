const ANALYSIS_RESULT_METRIC_TYPES = [
  "gross_heating_value",
  "specific_gravity",
  "compressibility_factor",
  "gpm",
];

async function insertAnalysisResultMetrics(
  tx,
  {
    import_machine_report_id,
    analysis_position,
    dryGrossIdealByPosition,
    wetSampleIdealByPosition,
  },
) {
  await tx.analysis_result_metrics.createMany({
    data: ANALYSIS_RESULT_METRIC_TYPES.map((metric) => ({
      import_machine_report_id,
      analysis_position,
      metric,
      dry_ideal:
        metric === "gross_heating_value"
          ? (dryGrossIdealByPosition?.get(analysis_position) ?? null)
          : null,
      dry_real: null,
      wet_ideal:
        metric === "gross_heating_value"
          ? (wetSampleIdealByPosition?.get(analysis_position) ?? null)
          : null,
      wet_real: null,
    })),
    skipDuplicates: true,
  });
}

async function insertAnalysisResultMetricsForImport(
  tx,
  {
    import_machine_report_id,
    analysis_positions,
    dryGrossIdealByPosition,
    wetSampleIdealByPosition,
  },
) {
  const uniquePositions = [...new Set(analysis_positions)];

  for (const analysis_position of uniquePositions) {
    await insertAnalysisResultMetrics(tx, {
      import_machine_report_id,
      analysis_position,
      dryGrossIdealByPosition,
      wetSampleIdealByPosition,
    });
  }
}

/**
 * Insert full dry/wet ideal/real metrics from a user Excel report.
 * Does not alter the machine-import insert path above.
 */
async function insertUserReportAnalysisResultMetrics(
  tx,
  { import_machine_report_id, analysis_position, analysisResults, gpmSummary },
) {
  const metricValues = {
    gross_heating_value: analysisResults?.gross_heating_value || {},
    specific_gravity: analysisResults?.specific_gravity || {},
    compressibility_factor: analysisResults?.compressibility_factor || {},
    // C2+ / C3+ dry-real GPM stored on the gpm metric row for report assembly
    gpm: {
      dry_ideal: null,
      dry_real: gpmSummary?.c2_plus ?? null,
      wet_ideal: null,
      wet_real: gpmSummary?.c3_plus ?? null,
    },
  };

  await tx.analysis_result_metrics.createMany({
    data: ANALYSIS_RESULT_METRIC_TYPES.map((metric) => {
      const values = metricValues[metric] || {};
      return {
        import_machine_report_id,
        analysis_position,
        metric,
        dry_ideal: values.dry_ideal ?? null,
        dry_real: values.dry_real ?? null,
        wet_ideal: values.wet_ideal ?? null,
        wet_real: values.wet_real ?? null,
      };
    }),
    skipDuplicates: true,
  });
}

module.exports = {
  ANALYSIS_RESULT_METRIC_TYPES,
  insertAnalysisResultMetrics,
  insertAnalysisResultMetricsForImport,
  insertUserReportAnalysisResultMetrics,
};
