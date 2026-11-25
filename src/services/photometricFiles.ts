/** Manufacturer photometry commonly uses Windows-1252 metadata, not UTF-8. */
export function decodePhotometricBytes(bytes: Uint8Array | ArrayBuffer): string {
  try { return new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
}
export async function readPhotometricText(file: File): Promise<string> {
  return decodePhotometricBytes(await file.arrayBuffer());
}
