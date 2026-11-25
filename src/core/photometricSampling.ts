import type { PhotometricData } from "./types";

/** Stored angles retain their file convention; all sampler queries use Type C directions. */
export type PhotometricWeb = Pick<PhotometricData,
  "verticalAngles" | "horizontalAngles" | "candela" | "multiplier" | "photometricType">;
export interface PhotometricDirection { x: number; y: number; z: number }
const RAD = Math.PI / 180;
const EPS = 1e-7;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;

export function directionFromAngles(type: 1 | 2 | 3, vertical: number, horizontal: number): PhotometricDirection {
  const v = vertical * RAD, h = horizontal * RAD;
  if (type === 1) return { x: Math.sin(v) * Math.cos(h), y: Math.sin(v) * Math.sin(h), z: -Math.cos(v) };
  if (type === 2) {
    const cosH = near(Math.abs(horizontal), 90) ? 0 : Math.cos(h);
    return { x: cosH * Math.sin(v), y: -Math.sin(h), z: -cosH * Math.cos(v) };
  }
  throw new Error("Type A photometry is not supported for directional analysis or conversion.");
}

export function anglesFromDirection(type: 1 | 2, ray: PhotometricDirection): { vertical: number; horizontal: number } {
  const length = Math.hypot(ray.x, ray.y, ray.z);
  if (!Number.isFinite(length) || length === 0) throw new Error("Invalid photometric direction.");
  const x = ray.x / length, y = ray.y / length, z = ray.z / length;
  if (type === 1) return {
    vertical: Math.acos(Math.max(-1, Math.min(1, -z))) / RAD,
    horizontal: ((Math.atan2(y, x) / RAD) % 360 + 360) % 360,
  };
  return { vertical: Math.atan2(x, -z) / RAD, horizontal: Math.asin(Math.max(-1, Math.min(1, -y))) / RAD };
}

/** Physical C-plane breaks, unfolded without duplicating the 0/360 seam. */
export function canonicalHorizontalAngles(web: PhotometricWeb): number[] {
  const a = web.horizontalAngles;
  if (web.photometricType !== 1) return Array.from({ length: 361 }, (_, i) => i);
  if (a.length === 1) return [0, 360];
  const first = a[0], last = a[a.length - 1];
  const angles = [0, 90, 180, 270, 360];
  for (const h of a) {
    angles.push(h);
    if (near(first, 0) && near(last, 90)) angles.push(180 - h, 180 + h, 360 - h);
    else if (near(first, 0) && near(last, 180)) angles.push(360 - h);
    else if (near(first, 90) && near(last, 270)) {
      angles.push(((180 - h) % 360 + 360) % 360);
    }
  }
  return [...new Set(angles.filter(h => h >= 0 && h <= 360))].sort((x, y) => x - y);
}

function bracket(axis: number[], value: number): [number, number, number] {
  if (axis.length === 1) return [0, 0, 0];
  let low = 0, high = axis.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (axis[mid] <= value) low = mid; else high = mid;
  }
  return [low, high, (value - axis[low]) / (axis[high] - axis[low])];
}

export function createCandelaSampler(web: PhotometricWeb): (gamma: number, cPlane: number) => number {
  if (web.photometricType === 3) throw new Error("Type A photometry is not supported for directional analysis or conversion.");
  const { verticalAngles: v, horizontalAngles: h, candela: cd, multiplier } = web;
  if (!v.length || !h.length || !Number.isFinite(multiplier) || multiplier < 0) throw new Error("Invalid photometric grid or multiplier.");
  for (const axis of [v, h]) {
    if (axis.some((a, i) => !Number.isFinite(a) || (i > 0 && a <= axis[i - 1]))) throw new Error("Photometric angles must be finite and strictly increasing.");
  }
  const type = web.photometricType;
  if (v[0] < (type === 1 ? 0 : -90) - EPS || v[v.length - 1] > (type === 1 ? 180 : 90) + EPS ||
      h[0] < (type === 1 ? 0 : -90) - EPS || h[h.length - 1] > (type === 1 ? 360 : 90) + EPS) {
    throw new Error(`Invalid Type ${type === 1 ? "C" : "B"} angular range.`);
  }
  if (type === 2 && (v.length < 2 || h.length < 2)) throw new Error("Type B data requires two-dimensional H/V angle grids.");
  if (cd.length !== h.length || cd.some(row => row.length !== v.length || row.some(n => !Number.isFinite(n) || n < 0))) {
    throw new Error("Candela data must be finite, nonnegative, and match the angle grid.");
  }
  let peak = 0;
  for (const row of cd) for (const value of row) peak = Math.max(peak, value);
  // Reconcile file rounding only; conflicting values on the same ray are invalid.
  const tolerance = Math.max(0.1, peak * 1e-5);
  const reconcile = (values: number[], name: string) => {
    const min = Math.min(...values), max = Math.max(...values);
    if (max - min > tolerance) throw new Error(`Conflicting candela values at the ${name}.`);
    return values.reduce((sum, n) => sum + n, 0) / values.length;
  };
  const cPoles = new Map<number, number>();
  const bPoles = new Map<number, number>();
  if (type === 1) {
    for (const index of [0, v.length - 1]) if (near(v[index], 0) || near(v[index], 180)) {
      cPoles.set(index, reconcile(cd.map(row => row[index]), `Type C ${v[index]}° pole`));
    }
  } else {
    for (const index of [0, h.length - 1]) if (near(Math.abs(h[index]), 90)) bPoles.set(index, reconcile(cd[index], `Type B H${h[index]}° pole`));
  }
  const firstH = h[0], lastH = h[h.length - 1];
  const seam = type === 1 && near(firstH, 0) && near(lastH, 360)
    ? v.map((_, index) => reconcile([cd[0][index], cd[h.length - 1][index]], "C0/C360 seam")) : null;
  const at = (hi: number, vi: number): number => {
    if (cPoles.has(vi)) return cPoles.get(vi)!;
    if (bPoles.has(hi)) return bPoles.get(hi)!;
    if (seam && (hi === 0 || hi === h.length - 1)) return seam[vi];
    return cd[hi][vi];
  };
  return (gamma: number, cPlane: number): number => {
    if (!Number.isFinite(gamma) || !Number.isFinite(cPlane) || gamma < -EPS || gamma > 180 + EPS) return 0;
    let vv = Math.max(0, Math.min(180, gamma));
    let hh = ((cPlane % 360) + 360) % 360;
    if (type === 2) {
      if (vv > 90 + EPS) return 0; // The native B grid covers its forward hemisphere.
      const native = anglesFromDirection(2, directionFromAngles(1, vv, hh));
      vv = native.vertical; hh = native.horizontal;
      if (near(v[0], 0)) vv = Math.abs(vv);
      if (near(firstH, 0)) hh = Math.abs(hh);
    } else if (h.length === 1) hh = firstH;
    else if (near(firstH, 0) && near(lastH, 90)) {
      hh %= 180; if (hh > 90) hh = 180 - hh;
    } else if (near(firstH, 0) && near(lastH, 180)) {
      if (hh > 180) hh = 360 - hh;
    } else if (near(firstH, 90) && near(lastH, 270)) {
      if (hh < 90) hh = 180 - hh;
      else if (hh > 270) hh = 540 - hh;
    }
    if (vv < v[0] - EPS || vv > v[v.length - 1] + EPS || hh < firstH - EPS || hh > lastH + EPS) return 0;
    vv = Math.max(v[0], Math.min(v[v.length - 1], vv));
    hh = Math.max(firstH, Math.min(lastH, hh));
    const [v0, v1, tv] = bracket(v, vv), [h0, h1, th] = bracket(h, hh);
    const a = at(h0, v0) * (1 - tv) + at(h0, v1) * tv;
    const b = at(h1, v0) * (1 - tv) + at(h1, v1) * tv;
    return Math.max(0, (a * (1 - th) + b * th) * multiplier);
  };
}

/**
 * Integrate physical directions, not stored array indices. Type B is sampled in
 * its signed native chart and integrated in the equivalent canonical measure
 * sin(gamma) dgamma dC (its native measure is cos(H) dH dV).
 * C-plane interpolation is linear, so native C breaks integrate exactly in C;
 * B directions use a bounded 1-degree C grid. Simpson's 1/3 rule integrates each
 * vertical interval, split at measured C angles and at most one degree wide.
 */
export function createFluxIntegrator(web: PhotometricWeb, sample = createCandelaSampler(web)) {
  const horizontalBreaks = canonicalHorizontalAngles(web);
  const averageCache = new Map<string, number>();
  function horizontalIntegral(gamma: number, start: number, end: number): number {
    const key = `${gamma}:${start}:${end}`;
    const cached = averageCache.get(key);
    if (cached !== undefined) return cached;
    const points = [start, ...horizontalBreaks.filter(a => a > start && a < end), end];
    let sum = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      // A partial measured range has zero outside its boundary, rather than
      // an invented triangular transition to the next cardinal plane.
      const edge = Math.min(1e-5, (b - a) / 1000);
      sum += (sample(gamma, a + edge) + sample(gamma, b - edge)) * (b - a) * RAD / 2;
    }
    averageCache.set(key, sum);
    return sum;
  }
  return (startGamma = 0, endGamma = 180, startC = 0, endC = 360): number => {
    const start = Math.max(0, startGamma, web.photometricType === 1 ? web.verticalAngles[0] : 0);
    const end = Math.min(endGamma, web.photometricType === 2 ? 90 : web.verticalAngles[web.verticalAngles.length - 1]);
    if (end <= start || endC <= startC) return 0;
    const breaks = [start, ...(web.photometricType === 1 ? web.verticalAngles.filter(v => v > start && v < end) : []), end];
    let flux = 0;
    for (let i = 0; i < breaks.length - 1; i++) {
      const count = Math.max(1, Math.ceil(breaks[i + 1] - breaks[i]));
      const step = (breaks[i + 1] - breaks[i]) / count;
      for (let j = 0; j < count; j++) {
        const a = breaks[i] + j * step, b = a + step, mid = (a + b) / 2;
        const weighted = (v: number) => horizontalIntegral(v, startC, endC) * Math.sin(v * RAD);
        flux += step * RAD / 6 * (weighted(a) + 4 * weighted(mid) + weighted(b));
      }
    }
    return Math.max(0, flux);
  };
}
