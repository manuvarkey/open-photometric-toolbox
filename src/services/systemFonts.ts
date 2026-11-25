import { invoke, isTauri } from "@tauri-apps/api/core";

let cached: Promise<string[]> | undefined;
export const nativeFonts = () => isTauri();
export function listSystemFonts(): Promise<string[]> {
  if (cached) return cached;
  cached = (async () => {
    let families: string[];
    if (isTauri()) families = await invoke<string[]>("list_system_font_families");
    else {
      const query = (window as unknown as {queryLocalFonts?: () => Promise<{family: string}[]>}).queryLocalFonts;
      if (!query) throw new Error("System font discovery is unavailable in this browser. Use the desktop app to select installed fonts.");
      families = (await query.call(window)).map(font => font.family);
    }
    return Array.from(new Set(families)).filter(Boolean).sort((a, b) => a.localeCompare(b));
  })().catch(error => { cached = undefined; throw error; });
  return cached;
}

/** A CSS string, also safe inside an HTML style element (font bytes stay local). */
export function reportFontCSS(family: string): string {
  if (family === 'system-ui') return 'system-ui, sans-serif';
  const escaped = family.replace(/[\x00-\x1f\x7f"\\<>]/g, character => `\\${character.codePointAt(0)!.toString(16)} `);
  return `"${escaped}", system-ui, sans-serif`;
}
