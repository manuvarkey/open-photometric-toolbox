import { computePhotometrics } from "./calculations";
import type { PhotometricData } from "./types";

/**
 * Parser for IES LM-63 photometric data files (LM-63-1986, 1991, 1995, 2002).
 */
export function parseIES(content: string, fileName = "luminaire.ies"): PhotometricData {
  const lines = content.split(/\r?\n/);
  let lineIdx = 0;

  let headerVersion = "IESNA:LM-63";
  const keywords: Record<string, string> = {};
  let foundTilt = false;

  // 1. Parse header lines and keywords
  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx].trim();
    lineIdx++;
    if (!rawLine) continue;

    if (rawLine.toUpperCase().startsWith("IESNA")) {
      headerVersion = rawLine;
      continue;
    }

    if (rawLine.startsWith("[")) {
      const closeBracket = rawLine.indexOf("]");
      if (closeBracket !== -1) {
        const key = rawLine.substring(1, closeBracket).trim().toUpperCase();
        const val = rawLine.substring(closeBracket + 1).trim();
        keywords[key] = keywords[key] ? `${keywords[key]}\n${val}` : val;
      }
      continue;
    }

    if (rawLine.toUpperCase().startsWith("TILT=")) {
      foundTilt = true;
      const tiltType = rawLine.substring(5).trim().toUpperCase();
      if (tiltType !== "NONE") {
        // Skip tilt data rows if present
        // Format specifies: <lamp-to-luminaire geometry>, <num pairs>, angles..., factors...
        // Usually 4 lines follow when TILT != NONE
        lineIdx += 4;
      }
      break;
    }
  }

  if (!foundTilt) {
    throw new Error("Missing IES TILT record. LDT import is not currently supported.");
  }

  // 2. Tokenize all remaining numbers across arbitrary whitespace/newlines
  const remainingText = lines.slice(lineIdx).join(" ");
  const tokens = remainingText.trim().split(/\s+/).filter((t) => t.length > 0);
  let tokIdx = 0;

  function nextFloat(): number {
    if (tokIdx >= tokens.length) return 0;
    const val = parseFloat(tokens[tokIdx]);
    tokIdx++;
    return isNaN(val) ? 0 : val;
  }

  function nextInt(): number {
    return Math.round(nextFloat());
  }

  const lampCount = nextInt();
  const lumensPerLamp = nextFloat();
  const multiplier = nextFloat() || 1.0;
  const numVerticalAngles = nextInt();
  const numHorizontalAngles = nextInt();
  const photometricTypeRaw = nextInt();
  const photometricType = (photometricTypeRaw === 2 ? 2 : photometricTypeRaw === 3 ? 3 : 1) as 1 | 2 | 3;
  const unitsType = (nextInt() === 2 ? 2 : 1) as 1 | 2;
  const luminousWidth = nextFloat();
  const luminousLength = nextFloat();
  const luminousHeight = nextFloat();

  const ballastFactor = nextFloat() || 1.0;
  nextFloat(); // ballast-lamp factor / future use
  const inputWatts = nextFloat();

  if (numVerticalAngles < 1 || numHorizontalAngles < 1 || tokens.length - tokIdx < numVerticalAngles + numHorizontalAngles + numVerticalAngles * numHorizontalAngles) {
    throw new Error("Incomplete or invalid IES angle and candela data.");
  }

  // 3. Read vertical angles
  const verticalAngles: number[] = [];
  for (let i = 0; i < numVerticalAngles; i++) {
    verticalAngles.push(nextFloat());
  }

  // 4. Read horizontal angles
  const horizontalAngles: number[] = [];
  for (let i = 0; i < numHorizontalAngles; i++) {
    horizontalAngles.push(nextFloat());
  }

  // 5. Read candela matrix: [h_idx][v_idx]
  const candela: number[][] = [];
  for (let h = 0; h < numHorizontalAngles; h++) {
    const slice: number[] = [];
    for (let v = 0; v < numVerticalAngles; v++) {
      slice.push(nextFloat());
    }
    candela.push(slice);
  }

  // 6. Compute photometrics using reverse-engineered algorithms
  const calculated = computePhotometrics(
    verticalAngles,
    horizontalAngles,
    candela,
    lampCount,
    lumensPerLamp,
    multiplier,
    inputWatts,
    luminousLength,
    luminousWidth,
    luminousHeight,
    unitsType
  );

  return {
    fileName,
    fileFormat: "IES",
    headerVersion,
    keywords,
    lampCount,
    lumensPerLamp,
    multiplier,
    numVerticalAngles,
    numHorizontalAngles,
    photometricType,
    unitsType,
    luminousWidth,
    luminousLength,
    luminousHeight,
    ballastFactor,
    inputWatts,
    verticalAngles,
    horizontalAngles,
    candela,
    calculated,
  };
}

/**
 * Serializes PhotometricData back to standard IES LM-63-2002 format.
 */
export function serializeIES(data: PhotometricData): string {
  const lines: string[] = ["IESNA:LM-63-2002"];

  for (const [key, val] of Object.entries(data.keywords)) {
    for (const subline of val.split(/\r?\n/)) {
      lines.push(`[${key}] ${subline}`);
    }
  }

  lines.push("TILT=NONE");
  lines.push(
    `${data.lampCount} ${data.lumensPerLamp} ${data.multiplier} ${data.numVerticalAngles} ${data.numHorizontalAngles} ${data.photometricType} ${data.unitsType} ${data.luminousWidth.toFixed(3)} ${data.luminousLength.toFixed(3)} ${data.luminousHeight.toFixed(3)}`
  );
  lines.push(`${data.ballastFactor} 1.0 ${data.inputWatts.toFixed(1)}`);

  // Format angles in lines of up to 10 numbers
  function formatNumbers(arr: number[]): string {
    const chunks: string[] = [];
    for (let i = 0; i < arr.length; i += 10) {
      chunks.push(arr.slice(i, i + 10).map((n) => n.toString()).join(" "));
    }
    return chunks.join("\n");
  }

  lines.push(formatNumbers(data.verticalAngles));
  lines.push(formatNumbers(data.horizontalAngles));

  for (let h = 0; h < data.numHorizontalAngles; h++) {
    lines.push(formatNumbers(data.candela[h]));
  }

  return lines.join("\n") + "\n";
}
