function numAt(arr, idx) {
  if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) return null;
  const v = arr[idx];
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildPositionMaps(annotations, times) {
  const positionToIndex = new Map();
  const positionToName = new Map();

  if (Array.isArray(annotations)) {
    annotations.forEach((ann, idx) => {
      const position = Number(ann?.valcoPosition);
      if (!Number.isInteger(position) || position <= 0) return;
      positionToIndex.set(position, idx);
      positionToName.set(position, ann.name ?? null);
    });
  }

  return { positionToIndex, positionToName, times: Array.isArray(times) ? times : [] };
}

function inferPositions(arrayLength) {
  const positions = [];
  for (let i = 1; i <= arrayLength; i += 1) positions.push(i);
  return positions;
}

/**
 * Parse Inficon/Scion FUSION JSON export into flat result rows.
 * @param {string|object} content JSON string or parsed object
 * @returns {{ method_name: string|null, results: object[] }}
 */
function parseMachineReportJson(content) {
  const data =
    typeof content === "string" ? JSON.parse(content) : content;

  if (!data || typeof data !== "object") {
    throw new Error("Machine report JSON must be an object");
  }

  const method_name = data.methodName ? String(data.methodName) : null;
  const { positionToIndex, positionToName, times } = buildPositionMaps(
    data.annotations,
    data.times,
  );
  const detectors = data.detectors;
  if (!detectors || typeof detectors !== "object") {
    throw new Error("Machine report JSON is missing detectors");
  }

  const results = [];

  for (const [detector_module, componentList] of Object.entries(detectors)) {
    if (!Array.isArray(componentList)) continue;

    for (const componentObj of componentList) {
      if (!componentObj || typeof componentObj !== "object") continue;

      for (const [component, metrics] of Object.entries(componentObj)) {
        if (!metrics || typeof metrics !== "object") continue;

        const series =
          metrics["RT(s)"] ||
          metrics.area ||
          metrics.normalizedConcentration ||
          metrics.concentration ||
          [];
        const positions =
          positionToIndex.size > 0
            ? [...positionToIndex.keys()].sort((a, b) => a - b)
            : inferPositions(Array.isArray(series) ? series.length : 0);

        for (const analysis_position of positions) {
          const idx =
            positionToIndex.get(analysis_position) ?? analysis_position - 1;
          const sampleTimeRaw = times[idx];
          let sample_time = null;
          if (sampleTimeRaw) {
            const parsed = new Date(sampleTimeRaw);
            if (!Number.isNaN(parsed.getTime())) sample_time = parsed;
          }

          results.push({
            analysis_position,
            sample_time,
            sample_name: positionToName.get(analysis_position) ?? null,
            detector_module,
            component,
            method_name,
            rt_s: numAt(metrics["RT(s)"], idx),
            area: numAt(metrics.area, idx),
            normalized_concentration: numAt(
              metrics.normalizedConcentration,
              idx,
            ),
            concentration: numAt(metrics.concentration, idx),
          });
        }
      }
    }
  }

  if (results.length === 0) {
    throw new Error("No machine report results found in JSON");
  }

  return { method_name, results };
}

function isJsonMachineReportFile(fileName) {
  const lower = String(fileName || "").toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  return ext === ".json" || ext === ".fusion-data";
}

module.exports = {
  parseMachineReportJson,
  isJsonMachineReportFile,
};
