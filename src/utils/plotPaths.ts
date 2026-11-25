import { createCandelaSampler } from "../core/photometricSampling";
import type { PhotometricData } from "../core/types";

/** A physical C0/C180 cut; the opposite half is sampled rather than mirrored. */
export function polarPath(data: PhotometricData | null, cx: number, cy: number, radius: number, maximum?: number): string {
  if (!data) return "";
  const sample = createCandelaSampler(data);
  const scale = radius / Math.max(1, maximum ?? data.calculated.maxCandela.intensity);
  const points: string[] = [];
  for (let angle = -180; angle <= 180; angle += 2.5) {
    const gamma = Math.abs(angle);
    const r = sample(gamma, angle < 0 ? 180 : 0) * scale;
    const radians = angle * Math.PI / 180;
    points.push(`${(cx + r * Math.sin(radians)).toFixed(2)} ${(cy + r * Math.cos(radians)).toFixed(2)}`);
  }
  return `M ${points.join(' L ')} Z`;
}
