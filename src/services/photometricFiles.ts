import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

/** Manufacturer photometry commonly uses Windows-1252 metadata, not UTF-8. */
export function decodePhotometricBytes(bytes: Uint8Array | ArrayBuffer): string {
  try { return new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
}
export async function readPhotometricText(file: File): Promise<string> {
  return decodePhotometricBytes(await file.arrayBuffer());
}

/** Returns the saved/downloaded name, or null when the native chooser is cancelled. */
export async function savePhotometricText(content: string, fileName: string, format: "ies" | "ldt"): Promise<string | null> {
  const suggestedName = fileName.replace(/\.(ies|ldt|txt)$/i, "") + `.${format}`;
  if (isTauri()) {
    const path = await save({ defaultPath: suggestedName, filters: [{ name: format === "ies" ? "IES Luminaire Files" : "EULUMDAT Files", extensions: [format] }] });
    if (!path) return null;
    await invoke("save_photometric_file", { path, content });
    return path.split(/[\\/]/).pop() || suggestedName;
  }
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return suggestedName;
}
