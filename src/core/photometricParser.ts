import { parseIES } from "./iesParser";
import { parseEULUMDAT } from "./eulumdatConverter";
import type { PhotometricData } from "./types";

/** One format dispatch for workspace, comparison and library file entry. */
export function parsePhotometric(content: string, fileName = "luminaire.ies"): PhotometricData {
  if (/\.ldt$/i.test(fileName)) return parseEULUMDAT(content, fileName);
  if (/^\s*(?:IESNA[^\n]*|\[[^\n]*|TILT\s*=)/im.test(content)) return parseIES(content, fileName);
  // Text files have no reliable extension. Only admit an LDT-shaped header;
  // the parser below still validates every field and the complete table.
  const lines = content.replace(/^\uFEFF/, "").split(/\r\n?|\n/);
  if (/^[123]$/.test(lines[1]?.trim() ?? "") && /^[0-4]$/.test(lines[2]?.trim() ?? "")) {
    return parseEULUMDAT(content, fileName);
  }
  throw new Error("Unrecognized photometric format. Open an IES LM-63 or EULUMDAT (.ldt) file.");
}
