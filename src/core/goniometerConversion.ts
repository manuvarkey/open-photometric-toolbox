import { computePhotometrics } from "./calculations";
import { anglesFromDirection, createCandelaSampler, directionFromAngles } from "./photometricSampling";
import type { PhotometricData } from "./types";

function grid(start: number, end: number, step: number): number[] {
  const count = Math.ceil((end - start) / step);
  return Array.from({ length: count + 1 }, (_, i) => Math.min(end, start + i * step));
}

/** Resample physical rays without changing intensities to conceal flux error. */
export function convertPhotometric(data: PhotometricData, targetType: 1 | 2, step = 2.5): PhotometricData {
  if (data.photometricType === 3) throw new Error("Type A photometry is not supported for directional analysis or conversion.");
  if (targetType !== 1 && targetType !== 2) throw new Error("Conversion target must be Type B or Type C.");
  if (data.photometricType === targetType) return data;
  if (!Number.isFinite(step) || step < 0.25 || step > 15) throw new Error("Angular sampling must be between 0.25° and 15°.");
  const sample = createCandelaSampler(data);
  // A B web has no rear hemisphere. Ending C gamma at 90 explicitly retains
  // that support; adding zero rows above 90 would interpolate false uplight.
  const verticalAngles = grid(targetType === 1 ? 0 : -90, 90, step);
  const horizontalAngles = grid(targetType === 1 ? 0 : -90, targetType === 1 ? 360 : 90, step);
  const candela = horizontalAngles.map(h => verticalAngles.map(v => {
    if (targetType === 1) return sample(v, h);
    const direction = directionFromAngles(2, v, h);
    const canonical = anglesFromDirection(1, direction);
    // At the horizon use the inward limit, so upper-only C data is not
    // interpolated back into the representable B hemisphere.
    return sample(Math.min(canonical.vertical, 90 - 1e-5), canonical.horizontal);
  }));
  const fileName = `${data.fileName.replace(/\.(?:ies|ldt|txt)$/i, "")}_Type${targetType === 1 ? "C" : "B"}.ies`;
  return {
    ...data,
    fileName,
    // Clipping uplight changes the measured distribution: source LDT ratios and
    // output-ratio metadata no longer describe this derived luminaire.
    eulumdat: targetType === 2 && data.calculated.upwardLumens > 0 ? undefined : data.eulumdat,
    fileFormat: "IES",
    headerVersion: "IESNA:LM-63-2002",
    photometricType: targetType,
    multiplier: 1,
    verticalAngles,
    horizontalAngles,
    numVerticalAngles: verticalAngles.length,
    numHorizontalAngles: horizontalAngles.length,
    candela,
    keywords: {
      ...data.keywords,
      CONVERSION: `Resampled Type ${data.photometricType === 1 ? "C" : "B"} to Type ${targetType === 1 ? "C" : "B"} at ${step} degrees. ${targetType === 2 ? "Type B covers the forward hemisphere; source uplight is excluded." : "Physical intensities and source coverage retained."}`,
    },
    calculated: computePhotometrics(verticalAngles, horizontalAngles, candela, data.lampCount, data.lumensPerLamp,
      1, data.inputWatts, data.luminousLength, data.luminousWidth, data.luminousHeight, data.unitsType, targetType),
  };
}

export function toTypeCData(data: PhotometricData, step = 2.5): PhotometricData {
  return convertPhotometric(data, 1, step);
}
