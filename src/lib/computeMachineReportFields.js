// GPA standard base conditions: 14.696 psia (1 atm) and 60°F
const STD_PRESSURE_PSIA = 14.696;
const STD_TEMPERATURE_F = 60;
const STD_CF_PER_MOL = 379.49;

function roundTo4(value) {
  return Math.round(value * 10000) / 10000;
}

function computeGpmAtStandardConditions(molPct, galPerLbMol) {
  if (molPct == null || galPerLbMol == null) return null;
  // GPM = [(Mol% / 100) / Cf/Mol] × 1000 × Gal/#Mol
  return roundTo4((molPct / 100 / STD_CF_PER_MOL) * 1000 * galPerLbMol);
}

function computeNormalizedByPosition(results) {
  const sumByPosition = new Map();
  for (const row of results) {
    if (row.concentration == null) continue;
    const key = row.analysis_position;
    sumByPosition.set(key, (sumByPosition.get(key) || 0) + row.concentration);
  }

  return results.map((row) => {
    if (row.component === "H2S") {
      return row;
    }
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

function buildComponentDescription(componentCode, componentMasterMap) {
  const master = componentMasterMap.get(componentCode);
  if (master?.component_name) {
    return `${master.component_name} (${componentCode})`;
  }
  return componentCode;
}

function applyComponentDescriptions(results, componentMasterMap) {
  return results.map((row) => ({
    ...row,
    component_description: buildComponentDescription(
      row.component,
      componentMasterMap,
    ),
  }));
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
    const h2sConcentration = fieldH2s / 10000;

    output.push({
      ...first,
      component: "H2S",
      concentration: h2sConcentration,
      normalized_concentration: null,
      normalized: h2sConcentration,
    });
    output.push(...positionRows);
  }

  return output;
}

function computeDerivedFields(
  results,
  componentMasterMap,
  pressureBaseFactor = 0,
) {
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
    let dry_gross_ideal = null;
    let wet_sample_ideal = null;

    if (mol_pct != null) {
      const master = componentMasterMap.get(row.component);
      const mw =
        master?.molecular_weight != null
          ? Number(master.molecular_weight)
          : null;
      const grossHeatingValue =
        master?.gross_heating_value != null
          ? Number(master.gross_heating_value)
          : null;
      if (grossHeatingValue != null) {
        dry_gross_ideal = roundTo4((mol_pct * grossHeatingValue) / 100);
        wet_sample_ideal = roundTo4(
          grossHeatingValue *
            (mol_pct / 100) *
            (1 - pressureBaseFactor),
        );
      }
      if (mw != null) {
        const totalWeight = weightSumByPosition.get(row.analysis_position);
        if (totalWeight) {
          wt_pct = roundTo4((100 * mol_pct * mw) / totalWeight);
        }
        const galPerLbMol =
          master.gal_per_lb_mol != null ? Number(master.gal_per_lb_mol) : null;
        if (galPerLbMol != null) {
          gpm = computeGpmAtStandardConditions(mol_pct, galPerLbMol);
        }
      }
    }

    return { ...row, mol_pct, wt_pct, gpm, dry_gross_ideal, wet_sample_ideal };
  });
}

function sumDryGrossIdealByPosition(results) {
  const sums = new Map();
  for (const row of results) {
    if (row.dry_gross_ideal == null) continue;
    const key = row.analysis_position;
    sums.set(key, (sums.get(key) || 0) + row.dry_gross_ideal);
  }
  for (const [key, total] of sums) {
    sums.set(key, roundTo4(total));
  }
  return sums;
}

function sumWetSampleIdealByPosition(results) {
  const sums = new Map();
  for (const row of results) {
    if (row.wet_sample_ideal == null) continue;
    const key = row.analysis_position;
    sums.set(key, (sums.get(key) || 0) + row.wet_sample_ideal);
  }
  for (const [key, total] of sums) {
    sums.set(key, roundTo4(total));
  }
  return sums;
}

module.exports = {
  STD_PRESSURE_PSIA,
  STD_TEMPERATURE_F,
  STD_CF_PER_MOL,
  roundTo4,
  computeGpmAtStandardConditions,
  computeNormalizedByPosition,
  buildComponentMasterMap,
  buildComponentDescription,
  applyComponentDescriptions,
  buildFieldH2sByPosition,
  prependH2sRows,
  computeDerivedFields,
  sumDryGrossIdealByPosition,
  sumWetSampleIdealByPosition,
};
