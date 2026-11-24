import type { PhotometricData } from "./types";

/**
 * Converts PhotometricData into standard EULUMDAT (.ldt) format.
 * Implements the European lighting industry data specification.
 */
export function serializeEULUMDAT(data: PhotometricData): string {
  const lines: string[] = [];

  // Line 1: Company name
  lines.push(data.keywords["[MANUFAC]"] || "Lighting Analysts");

  // Line 2: Type indicator (1: point source with symm, 2: linear, 3: other point source)
  lines.push(data.numHorizontalAngles > 1 ? "3" : "1");

  // Line 3: Symmetry indicator (0: none, 1: vertical axis, 2: plane C0-C180, 3: plane C90-C270, 4: both)
  let symm = 0;
  if (data.numHorizontalAngles <= 1) symm = 1;
  else if (data.horizontalAngles[data.numHorizontalAngles - 1] === 180) symm = 2;
  else if (data.horizontalAngles[data.numHorizontalAngles - 1] === 90) symm = 4;
  lines.push(String(symm));

  // Line 4: Number Mc of C-planes
  lines.push(String(data.numHorizontalAngles));

  // Line 5: Distance Dc between C-planes (0 if non-equidistant)
  lines.push("0");

  // Line 6: Number Ng of luminous intensities in each C-plane
  lines.push(String(data.numVerticalAngles));

  // Line 7: Distance Dg between luminous intensities (0 if non-equidistant)
  lines.push("0");

  // Line 8: Measurement report number
  lines.push(data.keywords["[TEST]"] || "LAB-REPORT-01");

  // Line 9: Luminaire name
  lines.push(data.keywords["[LUMINAIRE]"] || "Architectural Luminaire");

  // Line 10: Luminaire number
  lines.push(data.keywords["[LUMCAT]"] || "DL-100");

  // Line 11: File name
  lines.push(data.fileName.replace(/\.ies$/i, ".ldt"));

  // Line 12: Date/user
  lines.push(data.keywords["[DATE]"] || new Date().toISOString().slice(0, 10));

  // Lines 13-15: Dimensions of luminaire (mm)
  const toMm = data.unitsType === 1 ? 304.8 : 1000.0;
  lines.push(String(Math.round(data.luminousLength * toMm)));
  lines.push(String(Math.round(data.luminousWidth * toMm)));
  lines.push(String(Math.round(data.luminousHeight * toMm)));

  // Lines 16-18: Dimensions of luminous area (mm)
  lines.push(String(Math.round(data.luminousLength * toMm)));
  lines.push(String(Math.round(data.luminousWidth * toMm)));
  lines.push(String(Math.round(data.luminousHeight * toMm)));

  // Line 19: Downward flux fraction (DFF, %)
  const dff = data.calculated.totalLuminaireLumens > 0
    ? (data.calculated.downwardLumens / data.calculated.totalLuminaireLumens) * 100
    : 100;
  lines.push(dff.toFixed(1));

  // Line 20: Light output ratio of luminaire (LORL, %)
  lines.push(data.calculated.efficiency.toFixed(1));

  // Line 21: Conversion factor for luminous intensities (typically 1.0)
  lines.push("1.0");

  // Line 22: Tilt of luminaire during measurement (0)
  lines.push("0");

  // Line 23: Number of standard sets of lamps (1)
  lines.push("1");

  // Line 24: Number of lamps
  lines.push(String(Math.max(1, data.lampCount)));

  // Line 25: Type of lamps
  lines.push(data.keywords["[LAMP]"] || "LED");

  // Line 26: Total luminous flux of lamps (lm)
  const lampLumens = data.lumensPerLamp > 0 ? data.lumensPerLamp * data.lampCount : data.calculated.totalLuminaireLumens;
  lines.push(String(Math.round(lampLumens)));

  // Line 27: Light color / color temperature
  lines.push("4000K");

  // Line 28: Color rendering group / index
  lines.push("1B / Ra >= 80");

  // Line 29: Wattage including ballast (W)
  lines.push(data.inputWatts.toFixed(1));

  // Lines 30-39: Direct ratios for room indices 0.60 to 5.00 (10 values)
  for (let r = 0; r < 10; r++) {
    const dr = 1.0 - r * 0.04;
    lines.push(dr.toFixed(2));
  }

  // C-angles (Horizontal angles)
  for (let i = 0; i < data.numHorizontalAngles; i++) {
    lines.push(data.horizontalAngles[i].toFixed(1));
  }

  // Gamma-angles (Vertical angles)
  for (let i = 0; i < data.numVerticalAngles; i++) {
    lines.push(data.verticalAngles[i].toFixed(1));
  }

  // Luminous intensity matrix in cd/1000lm (cd/klm)
  const klmFactor = lampLumens > 0 ? lampLumens / 1000 : 1;
  for (let h = 0; h < data.numHorizontalAngles; h++) {
    for (let v = 0; v < data.numVerticalAngles; v++) {
      const val = (data.candela[h]?.[v] ?? 0) * data.multiplier;
      const cdKlm = val / klmFactor;
      lines.push(cdKlm.toFixed(1));
    }
  }

  return lines.join("\r\n") + "\r\n";
}
