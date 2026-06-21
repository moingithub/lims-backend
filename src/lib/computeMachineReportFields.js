const GPM_FACTOR = 0.002767;

function roundTo4(value) {
  return Math.round(value * 10000) / 10000;
}

function computeNormalizedByPosition(results) {
  const sumByPosition = new Map();
  for (const row of results) {
    if (row.concentration == null) continue;
    const key = row.analysis_position;
    sumByPosition.set(key, (sumByPosition.get(key) || 0) + row.concentration);
  }

  return results.map((row) => {
    const total = sumByPosition.get(row.analysis_position);
    let normalized = null;
    if (row.concentration != null && total) {
      normalized = roundTo4((100 / total) * row.concentration);
    }
    return { ...row, normalized };
  });
}

function buildComponentMasterMap(components) {
  return new Map(components.map((component) => [component.component_code, component]));
}

function buildFieldH2sByPosition(checkins, results) {
  const positions = [...new Set(results.map((row) => row.analysis_position))];
  const sampleNameByPosition = new Map();
  for (const row of results) {
    if (!sampleNameByPosition.has(row.analysis_position)) {
      sampleNameByPosition.set(row.analysis_position, row.sample_name);
    }
  }

  const map = new Map();
  for (const position of positions) {
    const candidates = checkins.filter(
      (checkin) => checkin.analysis_position === position,
    );
    if (candidates.length === 0) {
      map.set(position, 0);
      continue;
    }

    const sampleName = sampleNameByPosition.get(position);
    const matched = sampleName
      ? candidates.find((checkin) => checkin.analysis_number === sampleName)
      : null;
    map.set(position, Number((matched ?? candidates[0]).field_h2s) || 0);
  }
  return map;
}

function prependH2sRows(results, fieldH2sByPosition) {
  const rowsByPosition = new Map();
  for (const row of results) {
    if (!rowsByPosition.has(row.analysis_position)) {
      rowsByPosition.set(row.analysis_position, []);
    }
    rowsByPosition.get(row.analysis_position).push(row);
  }

  const output = [];
  for (const position of [...rowsByPosition.keys()].sort((a, b) => a - b)) {
    const positionRows = rowsByPosition.get(position);
    const first = positionRows[0];
    const fieldH2s = fieldH2sByPosition.get(position) ?? 0;

    output.push({
      ...first,
      component: "H2S",
      concentration: fieldH2s / 10000,
    });
    output.push(...positionRows);
  }

  return output;
}

function computeDerivedFields(results, componentMasterMap) {
  const withNormalized = computeNormalizedByPosition(results);
  const weightSumByPosition = new Map();

  for (const row of withNormalized) {
    if (row.normalized == null) continue;
    const master = componentMasterMap.get(row.component);
    if (master?.molecular_weight == null) continue;
    const mw = Number(master.molecular_weight);
    const key = row.analysis_position;
    weightSumByPosition.set(
      key,
      (weightSumByPosition.get(key) || 0) + row.normalized * mw,
    );
  }

  return withNormalized.map((row) => {
    const mol_pct = row.normalized ?? null;
    let wt_pct = null;
    let gpm = null;

    if (mol_pct != null) {
      const master = componentMasterMap.get(row.component);
      const mw =
        master?.molecular_weight != null
          ? Number(master.molecular_weight)
          : null;
      if (mw != null) {
        const totalWeight = weightSumByPosition.get(row.analysis_position);
        if (totalWeight) {
          wt_pct = roundTo4((100 * mol_pct * mw) / totalWeight);
        }
        if (master.has_gpm) {
          gpm = roundTo4(mol_pct * mw * GPM_FACTOR);
        }
      }
    }

    return { ...row, mol_pct, wt_pct, gpm };
  });
}

module.exports = {
  GPM_FACTOR,
  roundTo4,
  computeNormalizedByPosition,
  buildComponentMasterMap,
  buildFieldH2sByPosition,
  prependH2sRows,
  computeDerivedFields,
};
