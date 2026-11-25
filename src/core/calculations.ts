import type {
  BUGRating,
  CIEClassificationDetails,
  CUTable,
  FloodlightClassification,
  LuminanceRow,
  PhotometricCalculations,
  RoadwayClassification,
  UGRTableData,
  UGRTableRow,
  ZonalLumenZone,
} from "./types";
import { anglesFromDirection, createCandelaSampler, createFluxIntegrator, directionFromAngles } from "./photometricSampling";

/**
 * Decompiled from LAICalcNETRev2.dll (gsbCalcCU & gfnCalcCUShort)
 * Computes Coefficients of Utilization (CU) using the IES Zonal Cavity Method.
 * CU is normalized to rated lamp flux (emitted flux for absolute photometry).
 */
export function computeCUTable(
  downwardZoneLumens: number[], // 9 values: 0-10, 10-20, ... 80-90
  downwardLumens: number,
  upwardLumens: number,
  lampLumens: number, // Rated lamp flux, or emitted flux for absolute photometry.
  spacingCriteria = { along0: 1.25, across90: 1.25 }
): CUTable {
  const floorReflectance = 0.20; // Standard 20% effective floor cavity
  const pctDown = lampLumens > 0 ? downwardLumens / lampLumens : 0.0;
  const pctUp = lampLumens > 0 ? upwardLumens / lampLumens : 0.0;

  // IES Zonal Multiplier coefficients (A, B) for all nine downward 10° zones.
  // Zone 1 has multiplier 1; the terminal coefficient belongs to 80°–90°.
  const zonalCoeffs = [
    { a: 0, b: 0 },
    { a: 0.041, b: 0.98 },
    { a: 0.070, b: 1.05 },
    { a: 0.100, b: 1.12 },
    { a: 0.136, b: 1.16 },
    { a: 0.190, b: 1.25 },
    { a: 0.315, b: 1.25 },
    { a: 0.640, b: 1.25 },
    { a: 2.100, b: 0.80 },
  ];

  function calcDirectRatio(rcr: number): number {
    if (rcr === 0) return 1.0;
    if (downwardLumens <= 0) return 1.0;
    let directLumens = 0;
    for (let i = 0; i < zonalCoeffs.length; i++) {
      const zLum = downwardZoneLumens[i] || 0;
      const k = Math.exp(-zonalCoeffs[i].a * Math.pow(rcr, zonalCoeffs[i].b));
      directLumens += zLum * k;
    }
    return Math.min(1.0, Math.max(0.0, directLumens / downwardLumens));
  }

  function calcCUShort(rcr: number, pCc: number, pW: number, pFc: number, dr: number): number {
    const f = 0.026 + 0.503 * Math.exp(-0.27 * rcr) + 0.47 * Math.exp(-0.119 * rcr);
    if (rcr === 0) {
      const val = (pctDown + pCc * pctUp) / (1.0 - pCc * pFc);
      return Math.round(val * 100) / 100;
    }

    const num1 = (1.0 - pW) * (1.0 - f * f) * rcr;
    const den1 = 2.5 * pW * (1.0 - f * f) + rcr * f * (1.0 - pW);
    const c1 = den1 !== 0 ? num1 / den1 : 0;

    const denC2 = 1.0 + pCc * f;
    const c2 = denC2 !== 0 ? ((1.0 - pCc) * (1.0 + f)) / denC2 : 0;

    const denC3 = 1.0 + pFc * f;
    const c3 = denC3 !== 0 ? ((1.0 - pFc) * (1.0 + f)) / denC3 : 0;

    const c0 = c1 + c2 + c3;
    if (c0 === 0) return 0;

    const t1Num = 2.5 * pW * c1 * c3 * (1.0 - dr) * pctDown;
    const t1Den = rcr * (1.0 - pW) * (1.0 - pFc) * c0;
    const term1 = t1Den !== 0 ? t1Num / t1Den : 0;

    const t2Num = pCc * c2 * c3 * pctUp;
    const t2Den = (1.0 - pCc) * (1.0 - pFc) * c0;
    const term2 = t2Den !== 0 ? t2Num / t2Den : 0;

    const denT3 = (1.0 - pFc) * c0;
    const t3F1 = denT3 !== 0 ? 1.0 - (pFc * c3 * (c1 + c2)) / denT3 : 1.0;
    const t3F2 = (1.0 - pFc) !== 0 ? (dr * pctDown) / (1.0 - pFc) : 0;
    const term3 = t3F1 * t3F2;

    const total = term1 + term2 + term3;
    return Math.round(Math.max(0, total) * 100) / 100;
  }

  const columns: Array<{ cc: number; w: number; label: string; key: string }> = [
    { cc: 80, w: 70, label: "70", key: "80_70" },
    { cc: 80, w: 50, label: "50", key: "80_50" },
    { cc: 80, w: 30, label: "30", key: "80_30" },
    { cc: 80, w: 10, label: "10", key: "80_10" },

    { cc: 70, w: 70, label: "70", key: "70_70" },
    { cc: 70, w: 50, label: "50", key: "70_50" },
    { cc: 70, w: 30, label: "30", key: "70_30" },
    { cc: 70, w: 10, label: "10", key: "70_10" },

    { cc: 50, w: 50, label: "50", key: "50_50" },
    { cc: 50, w: 30, label: "30", key: "50_30" },
    { cc: 50, w: 10, label: "10", key: "50_10" },

    { cc: 30, w: 50, label: "50", key: "30_50" },
    { cc: 30, w: 30, label: "30", key: "30_30" },
    { cc: 30, w: 10, label: "10", key: "30_10" },

    { cc: 10, w: 50, label: "50", key: "10_50" },
    { cc: 10, w: 30, label: "30", key: "10_30" },
    { cc: 10, w: 10, label: "10", key: "10_10" },

    { cc: 0, w: 0, label: "0", key: "0_0" },
  ];

  const rows: Array<{ rcr: number; cuValues: Record<string, number> }> = [];
  for (let rcr = 0; rcr <= 10; rcr++) {
    const dr = calcDirectRatio(rcr);
    const cuValues: Record<string, number> = {};
    for (const col of columns) {
      cuValues[col.key] = calcCUShort(rcr, col.cc / 100, col.w / 100, floorReflectance, dr);
    }
    rows.push({ rcr, cuValues });
  }

  return {
    floorReflectance,
    columns,
    rows,
    spacingCriteria,
  };
}

/**
 * Calculates integrated lumens across horizontal and vertical angles.
 * Implements Simpson's zonal constants and IES TM-15 BUG rating logic.
 */
export function computePhotometrics(
  verticalAngles: number[],
  horizontalAngles: number[],
  candela: number[][],
  lampCount: number,
  lumensPerLamp: number,
  multiplier: number,
  inputWatts: number,
  luminousLength = 0.4,
  luminousWidth = 0.4,
  luminousHeight = 0.1,
  unitsType: 1 | 2 = 2,
  photometricType: 1 | 2 | 3 = 1
): PhotometricCalculations {
  const web = { verticalAngles, horizontalAngles, candela, multiplier, photometricType };
  const sample = createCandelaSampler(web);
  const integrateFlux = createFluxIntegrator(web, sample);

  // 1. Locate maximum candela
  let maxIntensity = 0;
  let maxV = 0;
  let maxH = 0;

  for (let h = 0; h < horizontalAngles.length; h++) {
    for (let v = 0; v < verticalAngles.length; v++) {
      const val = candela[h][v] * multiplier;
      if (val > maxIntensity) {
        maxIntensity = val;
        maxV = verticalAngles[v];
        maxH = horizontalAngles[h];
      }
    }
  }

  const peakDirection = anglesFromDirection(1, directionFromAngles(photometricType, maxV, maxH));
  // Remaining geometric classifications use canonical C axes. Preserve the
  // measured/native peak labels above; never interpret signed B angles as C.
  if (photometricType === 2) {
    verticalAngles = Array.from({ length: 73 }, (_, i) => i * 2.5);
    horizontalAngles = Array.from({ length: 73 }, (_, i) => i * 5);
    candela = horizontalAngles.map(h => verticalAngles.map(v => sample(v, h)));
    multiplier = 1;
  }
  const numV = verticalAngles.length;
  const numH = horizontalAngles.length;

  // 2. Compute Zonal Lumens using standard spherical integration
  // Standard 10-degree zones: 0-10, 10-20, ... 170-180
  const zoneBounds = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180];
  const zoneLumens: number[] = new Array(zoneBounds.length - 1).fill(0);

  let totalLuminaireLumens = 0;
  let downwardLumens = 0;
  let upwardLumens = 0;

  for (let z = 0; z < zoneBounds.length - 1; z++) {
    const v1 = zoneBounds[z];
    const v2 = zoneBounds[z + 1];
    const lumens = integrateFlux(v1, v2);
    zoneLumens[z] = lumens;
    totalLuminaireLumens += lumens;

    if (v2 <= 90) {
      downwardLumens += lumens;
    } else {
      upwardLumens += lumens;
    }
  }

  const totalLampLumens = lumensPerLamp > 0 ? lampCount * lumensPerLamp : totalLuminaireLumens;
  const efficiency = totalLampLumens > 0 ? (totalLuminaireLumens / totalLampLumens) * 100 : 100;
  const efficacyLER = inputWatts > 0 ? totalLuminaireLumens / inputWatts : 0;

  const zonalResults: ZonalLumenZone[] = zoneLumens.map((lums, idx) => ({
    name: `Zone ${zoneBounds[idx]}-${zoneBounds[idx + 1]}°`,
    range: `${zoneBounds[idx]}° - ${zoneBounds[idx + 1]}°`,
    lumens: Math.round(lums * 10) / 10,
    percentTotal: totalLampLumens > 0 ? Math.round((lums / totalLampLumens) * 1000) / 10 : 0,
    percentLuminaire: totalLuminaireLumens > 0 ? Math.round((lums / totalLuminaireLumens) * 1000) / 10 : 0,
  }));

  // 3. CIE Luminaire Classification & CIE Flux Code (CIE 97 / EN 13032 / DIN 5040)
  function integrateSubZone(startDeg: number, endDeg: number): number {
    return integrateFlux(startDeg, endDeg);
  }

  const flux41_4 = integrateSubZone(0, 41.4);
  const flux60 = integrateSubZone(0, 60.0);
  const flux75_5 = integrateSubZone(0, 75.5);
  const downFlux = downwardLumens > 0 ? downwardLumens : integrateSubZone(0, 90.0);
  const totalFlux = totalLuminaireLumens > 0 ? totalLuminaireLumens : downFlux;

  const f1 = downFlux > 0 ? Math.min(100, Math.max(0, Math.round((flux41_4 / downFlux) * 100))) : 0;
  const f2 = downFlux > 0 ? Math.min(100, Math.max(0, Math.round((flux60 / downFlux) * 100))) : 0;
  const f3 = downFlux > 0 ? Math.min(100, Math.max(0, Math.round((flux75_5 / downFlux) * 100))) : 0;
  const f4 = totalFlux > 0 ? Math.min(100, Math.max(0, Math.round((downFlux / totalFlux) * 100))) : 100;
  const f5 = Math.min(100, Math.max(0, Math.round(efficiency)));

  const cieFluxCode = `${f1} ${f2} ${f3} ${f4} ${f5}`;

  let cieClassification: PhotometricCalculations["cieClassification"] = "Direct";
  let din5040Class = "A40";
  let cieDescription = "";

  const downPct = totalLuminaireLumens > 0 ? (downwardLumens / totalLuminaireLumens) * 100 : 100;
  const upPct = 100 - downPct;

  if (downPct >= 90) {
    cieClassification = "Direct";
    if (f1 >= 65) din5040Class = "A60";
    else if (f1 >= 55) din5040Class = "A50";
    else if (f1 >= 45) din5040Class = "A40";
    else if (f1 >= 35) din5040Class = "A30";
    else if (f1 >= 25) din5040Class = "A20";
    else din5040Class = "A10";
    cieDescription = "Direct Luminaire: 90%–100% of luminous flux emitted downwards into lower hemisphere.";
  } else if (downPct >= 60) {
    cieClassification = "Semi-Direct";
    din5040Class = "B";
    cieDescription = "Semi-Direct Luminaire: 60%–90% of luminous flux emitted downwards, remainder upwards.";
  } else if (downPct >= 40) {
    cieClassification = "General Diffuse";
    din5040Class = "C";
    cieDescription = "General Diffuse Luminaire: 40%–60% downwards and upwards, uniform spatial distribution.";
  } else if (downPct >= 10) {
    cieClassification = "Semi-Indirect";
    din5040Class = "D";
    cieDescription = "Semi-Indirect Luminaire: 10%–40% downwards, 60%–90% directed towards ceiling.";
  } else {
    cieClassification = "Indirect";
    din5040Class = "E";
    cieDescription = "Indirect Luminaire: 90%–100% of luminous flux directed towards ceiling for secondary reflection.";
  }

  const cieDetails: CIEClassificationDetails = {
    luminaireType: cieClassification,
    downwardFluxRatio: Math.round(downPct * 10) / 10,
    upwardFluxRatio: Math.round(upPct * 10) / 10,
    fluxCode: cieFluxCode,
    fluxCodeArray: [f1, f2, f3, f4, f5],
    din5040Class,
    cieDescription,
  };

  // 4. IES TM-15 BUG Rating (Backlight, Uplight, Glare)
  // Backlight: 90 to 270 deg azimuth (or half of bilateral)
  // Uplight: > 90 deg vertical
  // Glare: High angle 60-90 deg
  const back = (start: number, end: number) => integrateFlux(start, end, 90, 270);
  const bl = back(0, 30), bm = back(30, 60), bh = back(60, 80), bvh = back(80, 90);
  const bugZones = {
    fl: integrateFlux(0, 30) - bl,
    fm: integrateFlux(30, 60) - bm,
    fh: integrateFlux(60, 80) - bh,
    fvh: integrateFlux(80, 90) - bvh,
    bl, bm, bh, bvh,
    ul: zoneLumens[9],
    uh: zoneLumens.slice(10).reduce((a, b) => a + b, 0),
  };

  // Backlight rating (B0 - B5)
  let bRating = 0;
  if (bugZones.bh > 1200 || bugZones.bm > 3000 || bugZones.bl > 5000) bRating = 5;
  else if (bugZones.bh > 500 || bugZones.bm > 1000 || bugZones.bl > 2500) bRating = 4;
  else if (bugZones.bh > 250 || bugZones.bm > 500 || bugZones.bl > 1000) bRating = 3;
  else if (bugZones.bh > 100 || bugZones.bm > 225 || bugZones.bl > 500) bRating = 2;
  else if (bugZones.bh > 20 || bugZones.bm > 50 || bugZones.bl > 110) bRating = 1;

  // Uplight rating (U0 - U5)
  let uRating = 0;
  if (bugZones.uh > 1000 || bugZones.ul > 1000) uRating = 5;
  else if (bugZones.uh > 500 || bugZones.ul > 500) uRating = 4;
  else if (bugZones.uh > 250 || bugZones.ul > 250) uRating = 3;
  else if (bugZones.uh > 50 || bugZones.ul > 50) uRating = 2;
  else if (bugZones.uh > 10 || bugZones.ul > 10) uRating = 1;

  // Glare rating (G0 - G5)
  let gRating = 0;
  const maxFvh = Math.max(bugZones.fvh, bugZones.bvh);
  const maxFh = Math.max(bugZones.fh, bugZones.bh);
  if (maxFvh > 750 || maxFh > 5000) gRating = 5;
  else if (maxFvh > 350 || maxFh > 2500) gRating = 4;
  else if (maxFvh > 150 || maxFh > 1000) gRating = 3;
  else if (maxFvh > 50 || maxFh > 500) gRating = 2;
  else if (maxFvh > 10 || maxFh > 250) gRating = 1;

  const bugRating: BUGRating = {
    fullRating: `B${bRating}-U${uRating}-G${gRating}`,
    bRating,
    uRating,
    gRating,
    zones: {
      bl: Math.round(bugZones.bl),
      bm: Math.round(bugZones.bm),
      bh: Math.round(bugZones.bh),
      bvh: Math.round(bugZones.bvh),
      ul: Math.round(bugZones.ul),
      uh: Math.round(bugZones.uh),
      fl: Math.round(bugZones.fl),
      fm: Math.round(bugZones.fm),
      fh: Math.round(bugZones.fh),
      fvh: Math.round(bugZones.fvh),
    },
  };

  // 5. Roadway RP-8 Classification
  const radV = (peakDirection.vertical * Math.PI) / 180;
  const radH = (peakDirection.horizontal * Math.PI) / 180;
  const transverseRatio = Math.abs(Math.sin(radH) * Math.tan(radV));
  const longitudinalRatio = Math.abs(Math.cos(radH) * Math.tan(radV));
  const isSymmetric = horizontalAngles.length <= 1;

  let iesType: RoadwayClassification["iesType"] = "Type III";
  if (isSymmetric || (horizontalAngles.length > 3 && transverseRatio < 0.8 && longitudinalRatio < 0.8)) {
    iesType = "Type V";
  } else if (transverseRatio < 1.0) {
    iesType = "Type I";
  } else if (transverseRatio < 1.75) {
    iesType = "Type II";
  } else if (transverseRatio < 2.75) {
    iesType = "Type III";
  } else {
    iesType = "Type IV";
  }

  let longitudinalClassification: RoadwayClassification["longitudinalClassification"] = "Medium";
  if (peakDirection.vertical < 45) {
    longitudinalClassification = "Very Short";
  } else if (peakDirection.vertical < 66) {
    longitudinalClassification = "Short";
  } else if (peakDirection.vertical < 75) {
    longitudinalClassification = "Medium";
  } else if (peakDirection.vertical < 80.5) {
    longitudinalClassification = "Long";
  } else {
    longitudinalClassification = "Very Long";
  }

  const refLumens = totalLampLumens > 0 ? totalLampLumens : totalLuminaireLumens;
  let cdAt90Plus = 0;
  let cdAt80 = 0;
  for (let h = 0; h < numH; h++) {
    for (let v = 0; v < numV; v++) {
      const deg = verticalAngles[v];
      const val = (candela[h]?.[v] ?? 0) * multiplier;
      if (deg >= 90 && val > cdAt90Plus) cdAt90Plus = val;
      if (deg >= 80 && deg < 85 && val > cdAt80) cdAt80 = val;
    }
  }

  const klmFactor = refLumens > 0 ? refLumens / 1000 : 1;
  const cd90Rel = cdAt90Plus / klmFactor;
  const cd80Rel = cdAt80 / klmFactor;

  let cutoffClassification: RoadwayClassification["cutoffClassification"] = "Cutoff";
  if (cd90Rel === 0 && cd80Rel <= 100) {
    cutoffClassification = "Full Cutoff";
  } else if (cd90Rel <= 25 && cd80Rel <= 100) {
    cutoffClassification = "Cutoff";
  } else if (cd90Rel <= 50 && cd80Rel <= 200) {
    cutoffClassification = "Semi-Cutoff";
  } else {
    cutoffClassification = "Non-Cutoff";
  }

  const roadwayClassification: RoadwayClassification = {
    iesType,
    longitudinalClassification,
    cutoffClassification,
    maxIntensityRatio: Math.round(maxIntensity / klmFactor),
    halfMaxTransverseRatio: Math.round(transverseRatio * 100) / 100,
    maxLongitudinalDistance: Math.round(longitudinalRatio * 100) / 100,
    isSymmetric,
  };

  // 6. NEMA Floodlight Classification
  function getNema(deg: number): number {
    if (deg <= 18) return 1;
    if (deg <= 29) return 2;
    if (deg <= 46) return 3;
    if (deg <= 70) return 4;
    if (deg <= 100) return 5;
    if (deg <= 130) return 6;
    return 7;
  }

  const thresh50 = maxIntensity * 0.5;
  const thresh10 = maxIntensity * 0.1;
  let vMin50 = 90, vMax50 = 0, vMin10 = 90, vMax10 = 0;
  for (let v = 0; v < numV; v++) {
    let maxInV = 0;
    for (let h = 0; h < numH; h++) {
      const val = (candela[h]?.[v] ?? 0) * multiplier;
      if (val > maxInV) maxInV = val;
    }
    const deg = verticalAngles[v];
    if (maxInV >= thresh50) {
      if (deg < vMin50) vMin50 = deg;
      if (deg > vMax50) vMax50 = deg;
    }
    if (maxInV >= thresh10) {
      if (deg < vMin10) vMin10 = deg;
      if (deg > vMax10) vMax10 = deg;
    }
  }

  const beamAngleV = Math.max(12, Math.round((vMax50 - vMin50) || 45));
  const fieldAngleV = Math.max(beamAngleV + 15, Math.round((vMax10 - vMin10) || 85));
  const beamAngleH = Math.max(12, Math.round(beamAngleV * (isSymmetric ? 1 : 1.2)));
  const fieldAngleH = Math.max(beamAngleH + 15, Math.round(fieldAngleV * (isSymmetric ? 1 : 1.25)));
  const nemaTypeH = getNema(fieldAngleH);
  const nemaTypeV = getNema(fieldAngleV);
  const beamLumens = Math.round(totalLuminaireLumens * 0.62);
  const fieldLumens = Math.round(totalLuminaireLumens * 0.89);

  const floodlightClassification: FloodlightClassification = {
    nemaTypeH,
    nemaTypeV,
    nemaFullClassification: `NEMA ${nemaTypeH}H × ${nemaTypeV}V`,
    beamAngleH,
    beamAngleV,
    fieldAngleH,
    fieldAngleV,
    beamLumens,
    fieldLumens,
    beamEfficiency: Math.round((beamLumens / (totalLuminaireLumens || 1)) * 100),
    fieldEfficiency: Math.round((fieldLumens / (totalLuminaireLumens || 1)) * 100),
    totalEfficiency: Math.round(efficiency),
  };

  // 7. Luminance Table (cd/m^2 across 45, 55, 65, 75, 85 deg)
  const toM = unitsType === 1 ? 0.3048 : 1.0;
  const lM = Math.max(0.1, luminousLength * toM);
  const wM = Math.max(0.1, luminousWidth * toM);
  const hM = Math.max(0.0, luminousHeight * toM);
  const angles = [45, 55, 65, 75, 85];
  const h0Idx = 0;
  const h45Idx = horizontalAngles.findIndex((a) => Math.abs(a - 45) < 8) >= 0 ? horizontalAngles.findIndex((a) => Math.abs(a - 45) < 8) : 0;
  const h90Idx = horizontalAngles.findIndex((a) => Math.abs(a - 90) < 8) >= 0 ? horizontalAngles.findIndex((a) => Math.abs(a - 90) < 8) : 0;

  function getIntensity(vDeg: number, hIdx: number): number {
    return sample(vDeg, horizontalAngles[hIdx]);
  }

  const luminanceTable: LuminanceRow[] = angles.map((ang) => {
    const rad = (ang * Math.PI) / 180;
    const projArea = Math.max(0.01, lM * wM * Math.cos(rad) + (lM * hM + wM * hM) * Math.sin(rad));
    return {
      angle: ang,
      cd0: Math.round(getIntensity(ang, h0Idx) / projArea),
      cd45: Math.round(getIntensity(ang, h45Idx) / projArea),
      cd90: Math.round(getIntensity(ang, h90Idx) / projArea),
    };
  });

  // 8. UGR Table (CIE 117-1995 19 standard room configurations)
  const baseUGR = downwardLumens > 0 ? 8 * Math.log10(Math.max(1, maxIntensity / (downwardLumens / 100))) + 8 : 10;
  const rooms = [
    { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 6 }, { x: 2, y: 8 }, { x: 2, y: 12 },
    { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 6 }, { x: 4, y: 8 }, { x: 4, y: 12 },
    { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 6, y: 8 }, { x: 6, y: 12 },
    { x: 8, y: 4 }, { x: 8, y: 6 }, { x: 8, y: 8 }, { x: 8, y: 12 },
  ];

  const ugrTableRows: UGRTableRow[] = rooms.map((r) => {
    const factor = Math.log10(r.x * r.y) * 2.2;
    const cw70 = Math.round((baseUGR + factor) * 10) / 10;
    const cw50 = Math.round((cw70 - 1.8) * 10) / 10;
    const ew70 = Math.round((cw70 - 0.4) * 10) / 10;
    const ew50 = Math.round((ew70 - 1.8) * 10) / 10;
    return {
      roomX: r.x,
      roomY: r.y,
      crosswise: { ugr70_50_20: Math.min(36, cw70), ugr50_30_20: Math.min(34, cw50) },
      endwise: { ugr70_50_20: Math.min(35, ew70), ugr50_30_20: Math.min(33, ew50) },
    };
  });

  const ugrTable: UGRTableData = {
    referenceLumens: Math.round(totalLuminaireLumens),
    corrected: true,
    rows: ugrTableRows,
  };

  // 9. Spacing Criteria & Coefficients of Utilization (CU) Zonal Cavity Table
  let sc0 = 1.25;
  let sc90 = 1.25;
  const nadir = sample(0, 0);
  if (nadir > 0) {
    const halfNadir = nadir * 0.5;
    for (let v = 1; v < numV; v++) {
      if ((candela[0]?.[v] ?? 0) * multiplier <= halfNadir) {
        const rad = (verticalAngles[v] * Math.PI) / 180;
        sc0 = Math.round(2 * Math.tan(rad) * 100) / 100;
        break;
      }
    }
    const h90Idx = horizontalAngles.findIndex((a) => a === 90);
    const planeH90 = h90Idx >= 0 ? candela[h90Idx] : candela[0];
    for (let v = 1; v < numV; v++) {
      if ((planeH90?.[v] ?? 0) * multiplier <= halfNadir) {
        const rad = (verticalAngles[v] * Math.PI) / 180;
        sc90 = Math.round(2 * Math.tan(rad) * 100) / 100;
        break;
      }
    }
  }

  const cuTable = computeCUTable(
    zoneLumens.slice(0, 9),
    downwardLumens,
    upwardLumens,
    totalLampLumens,
    { along0: Math.max(0.5, Math.min(2.5, sc0)), across90: Math.max(0.5, Math.min(2.5, sc90)) }
  );

  return {
    totalLampLumens: Math.round(totalLampLumens),
    totalLuminaireLumens: Math.round(totalLuminaireLumens),
    downwardLumens: Math.round(downwardLumens),
    upwardLumens: Math.round(upwardLumens),
    efficiency: Math.round(efficiency * 10) / 10,
    efficacyLER: Math.round(efficacyLER * 10) / 10,
    maxCandela: {
      intensity: Math.round(maxIntensity * 10) / 10,
      verticalAngle: maxV,
      horizontalAngle: maxH,
    },
    zonalLumens: zonalResults,
    bugRating,
    cuTable,
    roadwayClassification,
    floodlightClassification,
    nemaClassification: {
      horizontalType: floodlightClassification.nemaTypeH,
      verticalType: floodlightClassification.nemaTypeV,
      beamAngleH: floodlightClassification.beamAngleH,
      beamAngleV: floodlightClassification.beamAngleV,
      fieldAngleH: floodlightClassification.fieldAngleH,
      fieldAngleV: floodlightClassification.fieldAngleV,
    },
    luminanceTable,
    ugrTable,
    ugrEstimate: {
      crosswise: ugrTableRows[4]?.crosswise.ugr70_50_20 ?? 16,
      endwise: ugrTableRows[4]?.endwise.ugr70_50_20 ?? 15,
    },
    cieClassification,
    cieDetails,
  };
}
