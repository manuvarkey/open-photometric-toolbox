import { contours } from "d3-contour";
import { createCandelaSampler, type PhotometricWeb } from "./photometricSampling";

export function illuminanceAt(sample: (gamma: number, c: number) => number, x: number, y: number): number {
  const radius = Math.hypot(x, y);
  const gamma = Math.atan(radius) * 180 / Math.PI;
  const c = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  return sample(gamma, c) / Math.pow(1 + radius * radius, 1.5);
}

/** Field at height 1; x/y are multiples of mounting height. Units/height only scale values. */
export function buildIlluminanceField(data: PhotometricWeb, resolution = 121, extent = 4.5) {
  if (!Number.isInteger(resolution) || resolution < 3 || resolution > 501 || !(extent > 0)) throw new Error("Invalid illuminance grid.");
  const sample = createCandelaSampler(data);
  const values = new Float64Array(resolution * resolution);
  let maximum = 0;
  for (let row = 0; row < resolution; row++) {
    const y = extent - row * 2 * extent / (resolution - 1);
    for (let col = 0; col < resolution; col++) {
      const x = -extent + col * 2 * extent / (resolution - 1);
      const value = illuminanceAt(sample, x, y);
      values[row * resolution + col] = value;
      maximum = Math.max(maximum, value);
    }
  }
  const thresholds = maximum > 0 ? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9].map(ratio => ratio * maximum) : [];
  const bands = contours().size([resolution, resolution]).thresholds(thresholds)(Array.from(values)).map(band => ({
    value: band.value,
    path: band.coordinates.map(polygon => polygon.map(ring => ring.map(([x, y], index) =>
      `${index ? 'L' : 'M'}${((x - .5) * 600 / (resolution - 1)).toFixed(2)},${((y - .5) * 600 / (resolution - 1)).toFixed(2)}`
    ).join(' ') + ' Z').join(' ')).join(' ')
  }));
  return { resolution, extent, values, maximum, bands, at: (x: number, y: number) => illuminanceAt(sample, x, y) };
}
