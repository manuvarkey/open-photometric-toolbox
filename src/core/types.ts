export interface PhotometricData {
  fileName: string;
  fileFormat: "IES" | "LDT";
  headerVersion: string;
  keywords: Record<string, string>;
  // Source-format fields that have no equivalent in LM-63. Intensities in
  // candela remain normalized to physical cd; this metadata is not a multiplier.
  eulumdat?: EulumdatMetadata;
  
  // Standard parameters
  lampCount: number;
  lumensPerLamp: number;
  multiplier: number;
  numVerticalAngles: number;
  numHorizontalAngles: number;
  photometricType: 1 | 2 | 3; // 1: Type C, 2: Type B, 3: Type A
  unitsType: 1 | 2; // 1: Feet, 2: Meters
  luminousWidth: number;
  luminousLength: number;
  luminousHeight: number;
  ballastFactor: number;
  inputWatts: number;
  
  // Coordinate grids
  verticalAngles: number[];
  horizontalAngles: number[];
  
  // Candela matrix [h_index][v_index]
  candela: number[][];
  
  // Calculated properties
  calculated: PhotometricCalculations;
}

export interface EulumdatLampSet {
  /** Negative counts identify absolute photometry in EULUMDAT. */
  lampCount: number;
  lampType: string;
  totalFlux: number;
  colorTemperature: string;
  colorRendering: string;
  watts: number;
}

export interface EulumdatMetadata {
  typeIndicator: 0 | 1 | 2 | 3;
  symmetry: 0 | 1 | 2 | 3 | 4;
  bodyDimensionsMm: [number, number, number];
  luminousArea: {
    lengthMm: number;
    widthMm: number;
    heightsMm: [number, number, number, number];
  };
  downwardFluxFraction: number;
  lightOutputRatio: number;
  conversionFactor: number;
  measurementTilt: number;
  lampSets: EulumdatLampSet[];
  /** Measured LITG room-index values, not the IES CU approximation. */
  directRatios: number[];
  originalFileName: string;
  dateUser: string;
}

export interface ZonalLumenZone {
  name: string;
  range: string;
  lumens: number;
  percentTotal: number;
  percentLuminaire: number;
}

export interface BUGRating {
  fullRating: string; // e.g. "B2-U1-G1"
  bRating: number;
  uRating: number;
  gRating: number;
  zones: {
    bl: number;  // 0 - 30 deg backlight
    bm: number;  // 30 - 60 deg backlight
    bh: number;  // 60 - 80 deg backlight
    bvh: number; // 80 - 90 deg backlight
    ul: number;  // 90 - 100 deg uplight
    uh: number;  // 100 - 180 deg uplight
    fl: number;  // 0 - 30 deg forward light
    fm: number;  // 30 - 60 deg forward light
    fh: number;  // 60 - 80 deg forward light
    fvh: number; // 80 - 90 deg forward light
  };
}

export interface CURow {
  rcr: number;
  cuValues: Record<string, number>; // key: "cc_w" e.g. "80_70", "80_50"
}

export interface CUTable {
  floorReflectance: number; // default 0.20 (20%)
  columns: Array<{ cc: number; w: number; label: string; key: string }>;
  rows: CURow[]; // RCR 0..10
  spacingCriteria: {
    along0: number;
    across90: number;
  };
}

export interface RoadwayClassification {
  iesType: "Type I" | "Type II" | "Type III" | "Type IV" | "Type V";
  longitudinalClassification: "Very Short" | "Short" | "Medium" | "Long" | "Very Long";
  cutoffClassification: "Full Cutoff" | "Cutoff" | "Semi-Cutoff" | "Non-Cutoff";
  maxIntensityRatio: number; // cd per 1000 lamp lumens
  halfMaxTransverseRatio: number; // Ratio of mounting height (MH)
  maxLongitudinalDistance: number; // Ratio of MH
  isSymmetric: boolean;
}

export interface FloodlightClassification {
  nemaTypeH: number; // 1 to 7
  nemaTypeV: number; // 1 to 7
  nemaFullClassification: string; // e.g. "NEMA 5H × 5V"
  beamAngleH: number; // 50% max candela angle
  beamAngleV: number;
  fieldAngleH: number; // 10% max candela angle
  fieldAngleV: number;
  beamLumens: number;
  fieldLumens: number;
  beamEfficiency: number; // %
  fieldEfficiency: number; // %
  totalEfficiency: number; // %
}

export interface LuminanceRow {
  angle: number; // 45, 55, 65, 75, 85 deg
  cd0: number; // cd/m^2 along 0 deg
  cd45: number; // cd/m^2 along 45 deg
  cd90: number; // cd/m^2 along 90 deg
}

export interface UGRTableRow {
  roomX: number; // e.g. 2, 4, 6, 8 (in units of H)
  roomY: number; // e.g. 2, 3, 4, 6, 8, 12
  crosswise: {
    ugr70_50_20: number;
    ugr50_30_20: number;
  };
  endwise: {
    ugr70_50_20: number;
    ugr50_30_20: number;
  };
}

export interface UGRTableData {
  referenceLumens: number;
  corrected: boolean;
  rows: UGRTableRow[];
}

export interface CIEClassificationDetails {
  luminaireType: "Direct" | "Semi-Direct" | "General Diffuse" | "Semi-Indirect" | "Indirect";
  downwardFluxRatio: number; // Downward flux / total flux (0..100%)
  upwardFluxRatio: number; // Upward flux / total flux (0..100%)
  fluxCode: string; // e.g. "54 86 98 100 100"
  fluxCodeArray: [number, number, number, number, number];
  din5040Class: string; // e.g. "A40" or "A50"
  cieDescription: string;
}

export interface PhotometricCalculations {
  totalLampLumens: number;
  totalLuminaireLumens: number;
  downwardLumens: number;
  upwardLumens: number;
  efficiency: number; // Percentage
  efficacyLER: number; // Lumens per Watt
  maxCandela: {
    intensity: number;
    verticalAngle: number;
    horizontalAngle: number;
  };
  zonalLumens: ZonalLumenZone[];
  bugRating: BUGRating;
  cuTable: CUTable;
  roadwayClassification: RoadwayClassification;
  floodlightClassification: FloodlightClassification;
  luminanceTable: LuminanceRow[];
  ugrTable: UGRTableData;
  cieClassification: "Direct" | "Semi-Direct" | "General Diffuse" | "Semi-Indirect" | "Indirect";
  cieDetails: CIEClassificationDetails;
  nemaClassification: {
    horizontalType: number;
    verticalType: number;
    beamAngleH: number;
    beamAngleV: number;
    fieldAngleH: number;
    fieldAngleV: number;
  };
  ugrEstimate: {
    crosswise: number;
    endwise: number;
  };
}
