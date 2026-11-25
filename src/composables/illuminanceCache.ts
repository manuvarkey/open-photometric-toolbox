import { buildIlluminanceField } from "../core/illuminance";
import type { PhotometricData } from "../core/types";

// Immutable document identity invalidates the cache; WeakMap does not retain closed documents.
const fields = new WeakMap<PhotometricData, ReturnType<typeof buildIlluminanceField>>();
export function illuminanceField(data: PhotometricData) {
  let field = fields.get(data);
  if (!field) { field = buildIlluminanceField(data); fields.set(data, field); }
  return field;
}
