import { computePhotometrics } from "./calculations";
import { toTypeCData } from "./goniometerConversion";
import { canonicalHorizontalAngles, createCandelaSampler } from "./photometricSampling";
import type { EulumdatLampSet, EulumdatMetadata, PhotometricData } from "./types";

const EPSILON = 1e-6;
const MAX_ANGLES = 4096;
const MAX_VALUES = 2_000_000;
const fullTurn = (angle: number) => ((angle % 360) + 360) % 360;
const angleKey = (angle: number) => Math.round(fullTurn(angle) * 1e6);

function invalid(message: string): never {
  throw new Error(`Invalid EULUMDAT: ${message}`);
}

function finiteNumber(value: string, field: string): number {
  // Number(), unlike parseFloat(), must consume the complete field. Empty
  // strings must not silently become zero and shifted headers must fail.
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[Ee][+-]?\d+)?$/.test(value.trim())) {
    invalid(`${field} must be a finite number.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) invalid(`${field} must be a finite number.`);
  return parsed;
}

function inRange(value: number, low: number, high: number, field: string): number {
  if (value < low || value > high) invalid(`${field} must be between ${low} and ${high}.`);
  return value;
}

function whole(value: number, low: number, high: number, field: string): number {
  if (!Number.isInteger(value)) invalid(`${field} must be an integer.`);
  return inRange(value, low, high, field);
}

function checkAngles(angles: number[], field: string, maximum: number) {
  for (let i = 0; i < angles.length; i++) {
    inRange(angles[i], 0, maximum, field);
    if (i > 0 && angles[i] <= angles[i - 1]) invalid(`${field} must be strictly increasing.`);
  }
}

/**
 * EULUMDAT record order and symmetry: DIAL's published format description.
 * Reads full Mc C angles, then the reduced intensity rows prescribed by Isym.
 * All output intensities are physical cd; source scaling is applied once.
 */
export function parseEULUMDAT(content: string, fileName = "luminaire.ldt"): PhotometricData {
  const lines = content.replace(/^\uFEFF/, "").split(/\r\n?|\n/);
  let line = 0;
  const text = (field: string): string => {
    if (line >= lines.length) invalid(`missing ${field} at line ${line + 1}.`);
    return lines[line++].trim();
  };
  const number = (field: string): number => finiteNumber(text(field), `${field} (line ${line})`);
  const nonnegative = (field: string): number => inRange(number(field), 0, Number.MAX_SAFE_INTEGER, field);
  const manufacturer = text("manufacturer");
  const typeIndicator = whole(number("type indicator"), 1, 3, "type indicator") as 1 | 2 | 3;
  const symmetry = whole(number("symmetry"), 0, 4, "symmetry") as EulumdatMetadata["symmetry"];
  const mc = whole(number("Mc C-plane count"), 1, MAX_ANGLES, "Mc C-plane count");
  const dc = inRange(number("C-plane spacing"), 0, 360, "C-plane spacing");
  const ng = whole(number("Ng gamma-angle count"), 2, MAX_ANGLES, "Ng gamma-angle count");
  const dg = inRange(number("gamma spacing"), 0, 180, "gamma spacing");
  if (mc * ng > MAX_VALUES) invalid(`angle table exceeds ${MAX_VALUES} values.`);
  const test = text("measurement report");
  const luminaire = text("luminaire name");
  const catalog = text("catalog number");
  const originalFileName = text("original filename");
  const dateUser = text("date/user");
  const bodyDimensionsMm: [number, number, number] = [nonnegative("body length"), nonnegative("body width"), nonnegative("body height")];
  const lengthMm = nonnegative("luminous-area length");
  const widthMm = nonnegative("luminous-area width");
  const heightsMm: [number, number, number, number] = [
    nonnegative("luminous height C0"), nonnegative("luminous height C90"),
    nonnegative("luminous height C180"), nonnegative("luminous height C270"),
  ];
  const downwardFluxFraction = inRange(number("downward flux fraction"), 0, 100, "downward flux fraction");
  const lightOutputRatio = inRange(number("light output ratio"), 0, 100, "light output ratio");
  const conversionFactor = number("intensity conversion factor");
  if (conversionFactor <= 0) invalid("intensity conversion factor must be positive.");
  const measurementTilt = inRange(number("measurement tilt"), -180, 180, "measurement tilt");
  const lampSetCount = whole(number("lamp-set count"), 1, 64, "lamp-set count");
  const lampSets: EulumdatLampSet[] = [];
  for (let i = 0; i < lampSetCount; i++) {
    const lampCount = whole(number(`lamp count for set ${i + 1}`), -32767, 32767, "lamp count");
    if (lampCount === 0) invalid("lamp count cannot be zero.");
    const lampType = text(`lamp type for set ${i + 1}`);
    const totalFlux = nonnegative(`total flux for set ${i + 1}`);
    if (totalFlux === 0) invalid("lamp-set flux must be positive to normalize cd/klm.");
    const colorTemperature = text(`lamp colour for set ${i + 1}`);
    const colorRendering = text(`lamp colour rendering for set ${i + 1}`);
    const watts = nonnegative(`input watts for set ${i + 1}`);
    lampSets.push({ lampCount, lampType, totalFlux, colorTemperature, colorRendering, watts });
  }
  const directRatios = Array.from({ length: 10 }, (_, i) => inRange(number(`direct ratio ${i + 1}`), 0, 1, `direct ratio ${i + 1}`));
  const tokens = lines.slice(line).join(" ").trim().split(/\s+/).filter(Boolean);
  let token = 0;
  const next = (field: string): number => {
    if (token >= tokens.length) invalid(`incomplete ${field} table.`);
    return finiteNumber(tokens[token++], field);
  };
  const cAngles = Array.from({ length: mc }, () => next("C-angle"));
  const verticalAngles = Array.from({ length: ng }, () => next("gamma-angle"));
  checkAngles(cAngles, "C angles", 360);
  checkAngles(verticalAngles, "gamma angles", 180);
  if (Math.abs(cAngles[0]) > EPSILON) invalid("the full C-angle list must start at 0°.");
  if (![0, 90].some(v => Math.abs(verticalAngles[0] - v) < EPSILON)
    || ![90, 180].some(v => Math.abs(verticalAngles.at(-1)! - v) < EPSILON)) {
    invalid("gamma angles must span 0°–90°, 0°–180°, or 90°–180°.");
  }
  if (dc > 0 && cAngles.some((a, i) => i > 0 && Math.abs(a - cAngles[i - 1] - dc) > EPSILON)) invalid("C-plane spacing disagrees with the angle list.");
  if (dg > 0 && verticalAngles.some((a, i) => i > 0 && Math.abs(a - verticalAngles[i - 1] - dg) > EPSILON)) invalid("gamma spacing disagrees with the angle list.");

  let storedIndices: number[];
  if (symmetry === 1) storedIndices = [0];
  else if (symmetry === 0) storedIndices = cAngles.map((_, i) => i);
  else {
    if (cAngles.at(-1)! >= 360 - EPSILON) invalid("reduced symmetry requires Mc C angles without a duplicated 360° endpoint.");
    const divisor = symmetry === 2 ? 2 : 4;
    if (mc % divisor !== 0) invalid(`Mc must be divisible by ${divisor} for symmetry ${symmetry}.`);
    const requiredAngle = symmetry === 2 ? 180 : 90;
    if (Math.abs(cAngles[mc / divisor] - requiredAngle) > EPSILON) invalid("C-angle grid does not include the symmetry boundary.");
    if (symmetry === 3 && Math.abs(cAngles[3 * mc / 4] - 270) > EPSILON) invalid("symmetry 3 requires a C270 plane.");
    const count = symmetry === 4 ? mc / 4 + 1 : mc / 2 + 1;
    const start = symmetry === 3 ? 3 * mc / 4 : 0;
    storedIndices = Array.from({ length: count }, (_, i) => (start + i) % mc);
  }
  const first = lampSets[0];
  const scale = first.totalFlux * conversionFactor / 1000;
  const rows = new Map<number, number[]>();
  for (const index of storedIndices) {
    const row = Array.from({ length: ng }, () => {
      const cdKlm = next("intensity");
      if (cdKlm < 0) invalid("intensities cannot be negative.");
      const cd = cdKlm * scale;
      if (!Number.isFinite(cd)) invalid("normalized intensity exceeds the supported numeric range.");
      return cd;
    });
    const key = angleKey(cAngles[index]);
    if (rows.has(key)) {
      if (row.some((v, i) => Math.abs(v - rows.get(key)![i]) > EPSILON * Math.max(1, v))) invalid("C360 must repeat the C0 intensities.");
    } else rows.set(key, row);
  }
  if (token !== tokens.length) invalid(`unexpected extra data after ${storedIndices.length} intensity planes; check Mc, Ng and lamp-set count.`);
  const horizontalAngles = symmetry === 1 ? [0] : [...cAngles.filter(a => a < 360 - EPSILON), 360];
  const candela = horizontalAngles.map(c => {
    let source = fullTurn(c);
    if (symmetry === 1) source = 0;
    if (symmetry === 2 && source > 180) source = 360 - source;
    if (symmetry === 3 && source > 90 && source < 270) source = fullTurn(180 - source);
    if (symmetry === 4) {
      if (source > 180) source = 360 - source;
      if (source > 90) source = 180 - source;
    }
    const row = rows.get(angleKey(source));
    if (!row) invalid(`C${c} has no matching measured plane after applying symmetry ${symmetry}.`);
    return [...row];
  });
  const lampCount = Math.abs(first.lampCount);
  const lumensPerLamp = first.lampCount < 0 ? -1 : first.totalFlux / lampCount;
  const circular = widthMm === 0 && lengthMm > 0;
  const luminousLength = (circular ? -lengthMm : lengthMm) / 1000;
  const luminousWidth = (circular ? -lengthMm : widthMm) / 1000;
  const luminousHeight = Math.max(...heightsMm) / 1000;
  const eulumdat: EulumdatMetadata = {
    typeIndicator, symmetry, bodyDimensionsMm, luminousArea: { lengthMm, widthMm, heightsMm },
    downwardFluxFraction, lightOutputRatio, conversionFactor, measurementTilt,
    lampSets, directRatios, originalFileName, dateUser,
  };
  return {
    fileName, fileFormat: "LDT", headerVersion: "EULUMDAT", eulumdat,
    keywords: { MANUFAC: manufacturer, TEST: test, LUMINAIRE: luminaire, LUMCAT: catalog, DATE: dateUser, LAMP: first.lampType },
    lampCount, lumensPerLamp, multiplier: 1, numVerticalAngles: ng, numHorizontalAngles: horizontalAngles.length,
    photometricType: 1, unitsType: 2, luminousLength, luminousWidth, luminousHeight, ballastFactor: 1, inputWatts: first.watts,
    verticalAngles, horizontalAngles, candela,
    calculated: computePhotometrics(verticalAngles, horizontalAngles, candela, lampCount, lumensPerLamp, 1, first.watts, luminousLength, luminousWidth, luminousHeight, 2, 1),
  };
}

const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Cannot export EULUMDAT: a field is not finite.");
  return String(Number(value.toPrecision(12)));
}
function uniformSpacing(angles: number[]): number {
  if (angles.length < 2) return 0;
  const step = angles[1] - angles[0];
  return angles.every((a, i) => i === 0 || Math.abs(a - angles[i - 1] - step) < EPSILON) ? step : 0;
}

/**
 * Deterministic standard-order export. Compact IES symmetry is expanded to a
 * complete C grid (Isym 0); truly rotational one-plane data uses Isym 1.
 * Direct ratios must be measured/supplied: the IES CU approximation is not a
 * validated substitute for the LITG room-index values required by EULUMDAT.
 */
export function serializeEULUMDAT(source: PhotometricData): string {
  const ratios = source.eulumdat?.directRatios;
  if (!ratios || ratios.length !== 10 || ratios.some(r => !Number.isFinite(r) || r < 0 || r > 1)) {
    throw new Error("Cannot export EULUMDAT: ten validated LITG direct ratios are required. This IES file does not contain them; open an LDT source with measured direct ratios. IES export remains available.");
  }
  const data = toTypeCData(source);
  const sample = createCandelaSampler(data);
  const metadata = data.eulumdat;
  const conversionFactor = metadata?.conversionFactor ?? 1;
  const rotational = data.horizontalAngles.length === 1;
  const horizontalAngles = rotational ? [0] : canonicalHorizontalAngles(data).filter(c => c < 360 - EPSILON);
  if (horizontalAngles[0] !== 0) throw new Error("Cannot export EULUMDAT: Type C grid must include C0.");
  checkAngles(data.verticalAngles, "gamma angles", 180);
  const toMm = data.unitsType === 1 ? 304.8 : 1000;
  const circular = data.luminousLength < 0 || data.luminousWidth < 0;
  const areaLength = Math.abs(data.luminousLength * toMm);
  const areaWidth = circular ? 0 : Math.abs(data.luminousWidth * toMm);
  const areaHeight = Math.abs(data.luminousHeight * toMm);
  const areaHeights = metadata && Math.abs(Math.max(...metadata.luminousArea.heightsMm) - areaHeight) < EPSILON
    ? metadata.luminousArea.heightsMm : [areaHeight, areaHeight, areaHeight, areaHeight];
  const body = metadata?.bodyDimensionsMm ?? [areaLength, areaWidth, areaHeight];
  const originalLamp = metadata?.lampSets[0];
  const absolute = data.lumensPerLamp <= 0;
  const flux = absolute ? originalLamp?.totalFlux ?? data.calculated.totalLuminaireLumens : data.lumensPerLamp * data.lampCount;
  if (!(flux > 0)) throw new Error("Cannot export EULUMDAT: a positive normalization flux is required.");
  const lampSets: EulumdatLampSet[] = [{
    lampCount: (absolute ? -1 : 1) * data.lampCount,
    lampType: data.keywords.LAMP ?? originalLamp?.lampType ?? "",
    totalFlux: flux, colorTemperature: originalLamp?.colorTemperature ?? "", colorRendering: originalLamp?.colorRendering ?? "", watts: data.inputWatts,
  }, ...(metadata?.lampSets.slice(1) ?? [])];
  const total = data.calculated.totalLuminaireLumens;
  const lines: string[] = [
    oneLine(data.keywords.MANUFAC ?? ""), String(metadata?.typeIndicator ?? (rotational ? 1 : 3)), String(rotational ? 1 : 0),
    String(horizontalAngles.length), formatNumber(uniformSpacing(horizontalAngles)), String(data.verticalAngles.length), formatNumber(uniformSpacing(data.verticalAngles)),
    oneLine(data.keywords.TEST ?? ""), oneLine(data.keywords.LUMINAIRE ?? ""), oneLine(data.keywords.LUMCAT ?? ""),
    oneLine(data.fileName.replace(/\.(?:ies|ldt|txt)$/i, "") + ".ldt"), oneLine(data.keywords.DATE ?? metadata?.dateUser ?? ""),
    ...body.map(formatNumber), formatNumber(areaLength), formatNumber(areaWidth), ...areaHeights.map(formatNumber),
    formatNumber(metadata?.downwardFluxFraction ?? (total > 0 ? 100 * data.calculated.downwardLumens / total : 0)),
    formatNumber(metadata?.lightOutputRatio ?? (absolute ? 100 : data.calculated.efficiency)), formatNumber(conversionFactor), formatNumber(metadata?.measurementTilt ?? 0), String(lampSets.length),
  ];
  for (const lamp of lampSets) lines.push(String(lamp.lampCount), oneLine(lamp.lampType), formatNumber(lamp.totalFlux), oneLine(lamp.colorTemperature), oneLine(lamp.colorRendering), formatNumber(lamp.watts));
  lines.push(...ratios.map(formatNumber), ...horizontalAngles.map(formatNumber), ...data.verticalAngles.map(formatNumber));
  for (const c of horizontalAngles) for (const gamma of data.verticalAngles) lines.push(formatNumber(sample(gamma, c) * 1000 / (flux * conversionFactor)));
  return lines.join("\r\n") + "\r\n";
}
