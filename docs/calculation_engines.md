# Photometric Toolbox 2.14: Calculation Engines Reference

This document details the decompiled symbols, methods, and algorithms recovered from the proprietary .NET assemblies of Photometric Toolbox.

---

## 1. `LAICalcNETRev2.dll` (Core Photometrics & Rating Engine)

* **Assembly Name**: `LAICalcNETRev2`
* **Version**: `19.1.8196.23212`
* **Target Framework**: `.NETFramework,Version=v4.0`
* **Dependencies**: `mscorlib`, `System`, `System.Core`, `Microsoft.VisualBasic`, `System.Drawing`
* **Type Library**: `laicalcnetrev2.tlb`

### Key Types & Data Structures
* `LCSRatingType`: Encapsulates the IES TM-15 Luminaire Classification System (LCS) results.
* `LCSRatingZoneType`: Zone breakdown (Backlight, Uplight, Glare zones).
* `utilities`: Geometry and matrix transformation routines.

### Core Calculation Functions
| Method | Algorithm / Standard | Purpose |
| :--- | :--- | :--- |
| `CalcBUGRating()` | **IES TM-15-11 / Addendum A** | Computes the Backlight (B0–B5), Uplight (U0–U5), and Glare (G0–G5) ratings from candela distribution. |
| `CalcCU()` / `gsbCalcCU()` | **IES Zonal Cavity Method** | Calculates the full Coefficients of Utilization (CU) table for RCR 0–10 across standard ceiling/wall reflectances, plus Spacing Criteria Along ($0^\circ$) and Across ($90^\circ$). |
| `CalcCUShort()` / `gfnCalcCUShort()` | **IESNA Flux Transfer Quadrature** | Evaluates CU for a single RCR cell given ceiling/wall/floor cavity reflectances, direct ratio, % upward, and % downward flux. |
| `CalcRCR()` / `gsbCalcRCR()` | **Zonal Cavity Geometry** | Calculates Room Cavity Ratio ($RCR = \frac{5 \cdot H_{cav} \cdot (L + W)}{L \cdot W}$) from room dimensions and cavity heights. |
| `CalcZonalLumens()` | **Zonal Cavity Method / Simpson's Rule** | Computes integrated luminous flux (lumens) across 10° or 5° angular zones. |
| `CalcZoneIntensity()` | Photometric Integration | Computes average and peak intensity within specific zonal cones. |
| `CalcLuminaireLumens()` | Absolute / Relative Photometry | Calculates total luminaire emitted lumens from lamp lumens and candela matrix. |
| `CalcLER()` | **NEMA LE 5 / LE 5B** | Luminaire Efficacy Rating ($LER = \frac{\text{Total Luminaire Lumens} \times \text{Total Efficiency}}{\text{Input Watts}}$). |
| `CalcUWLRLumens()` | Dark Sky / BUG Standards | Upward Waste Light Ratio: percentage of total luminaire lumens emitted above 90° horizontal. |
| `CalcSTV()` | **IES RP-8 (Roadway Lighting)** | Small Target Visibility calculations for roadway luminaire arrays. |
| `CalcVL()` | Adrian Visibility Model | Visibility Level calculation of target contrast against road surface luminance. |
| `CalcAimPt()`, `CalcTVAngles()` | 3D Aiming Geometry | Computes aiming vector, tilt, roll, and transverse/vertical aiming coordinates. |
| `ConvertPhotoData()`, `HorConvert()` | Coordinate Transformation | Handles bilinear interpolation and symmetry conversions (Full, 90°, 180° symmetry). |

---

### Decompiled Coefficient of Utilization (CU) Mathematical Engine

From `LAICalcNETRev2.dll` (tokens `0x06000010` `gsbCalcCU` and `0x06000012` `gfnCalcCUShort`):

#### 1. Direct Ratio ($DR$)
For each Room Cavity Ratio $RCR \in [0..10]$, the fraction of downward flux reaching the floor work plane directly is computed via exponential zonal weighting coefficients $(A_i, B_i)$ for the 8 primary downward zones:
$$DR(RCR) = \frac{\sum_{i=1}^{8} \Phi_i \cdot \exp(-A_i \cdot RCR^{B_i})}{\sum_{i=1}^{9} \Phi_i}$$

| Zone $i$ | Angular Range | $A_i$ | $B_i$ |
| :---: | :---: | :---: | :---: |
| 1 | $0^\circ - 10^\circ$ | 0.041 | 0.98 |
| 2 | $10^\circ - 20^\circ$ | 0.070 | 1.05 |
| 3 | $20^\circ - 30^\circ$ | 0.100 | 1.12 |
| 4 | $30^\circ - 40^\circ$ | 0.136 | 1.16 |
| 5 | $40^\circ - 50^\circ$ | 0.190 | 1.25 |
| 6 | $50^\circ - 60^\circ$ | 0.315 | 1.25 |
| 7 | $60^\circ - 70^\circ$ | 0.640 | 1.25 |
| 8 | $70^\circ - 80^\circ$ | 2.100 | 0.80 |

#### 2. Zonal Cavity Form Factors ($f$)
The form factor transfer function between the room cavity surfaces is evaluated as:
$$f = 0.026 + 0.503 \cdot e^{-0.27 \cdot RCR} + 0.47 \cdot e^{-0.119 \cdot RCR}$$

#### 3. Interreflection Surface Coefficients ($C_1, C_2, C_3, C_0$)
- **Wall component ($C_1$)**:
  $$C_1 = \frac{(1 - \rho_w)(1 - f^2) \cdot RCR}{2.5 \cdot \rho_w (1 - f^2) + RCR \cdot f (1 - \rho_w)}$$
- **Ceiling cavity component ($C_2$)**:
  $$C_2 = \frac{(1 - \rho_{cc})(1 + f)}{1 + \rho_{cc} \cdot f}$$
- **Floor cavity component ($C_3$)**:
  $$C_3 = \frac{(1 - \rho_{fc})(1 + f)}{1 + \rho_{fc} \cdot f}$$
- **Sum ($C_0$)**: $C_0 = C_1 + C_2 + C_3$

#### 4. Three-Surface Flux Transfer Solution
For $RCR = 0$:
$$CU(0) = \frac{\%Dn + \rho_{cc} \cdot \%Up}{1 - \rho_{cc} \cdot \rho_{fc}}$$

For $RCR > 0$:
$$CU = \underbrace{\frac{2.5 \cdot \rho_w \cdot C_1 C_3 (1 - DR) \cdot \%Dn}{RCR (1 - \rho_w)(1 - \rho_{fc}) C_0}}_{\text{Wall direct interreflection}} + \underbrace{\frac{\rho_{cc} \cdot C_2 C_3 \cdot \%Up}{(1 - \rho_{cc})(1 - \rho_{fc}) C_0}}_{\text{Ceiling upward interreflection}} + \underbrace{\left[1 - \frac{\rho_{fc} C_3 (C_1 + C_2)}{(1 - \rho_{fc}) C_0}\right] \frac{DR \cdot \%Dn}{1 - \rho_{fc}}}_{\text{Work-plane direct & floor cavity reflection}}$$

---

## 2. `laiglarenet.dll` (CIE Unified Glare Rating Engine)

* **Assembly Name**: `LAIGlareNet`
* **Target Framework**: `.NETFramework,Version=v4.0`
* **Type Library**: `laiglarenet.tlb`

### Key Types & Data Structures
* `UGRTable`: Table of tabular UGR values for 19 standard room dimensions and reflectances.
* `FluxTransferValues`: Form factors and radiant flux exchange coefficients.
* `ReflectanceValues`: Standard ceiling/wall/floor reflectance combinations (70/50/20, 50/30/20, etc.).
* `RoomIndex`: Room indices ranging from 0.6 to 5.0 (CIE 117-1995).
* `PhotoData`: Normalized candela matrix and luminous dimensions.

### Core Calculation Functions
| Method | Algorithm / Standard | Purpose |
| :--- | :--- | :--- |
| `CalcUGR()` | **CIE 117-1995** | Calculates the Unified Glare Rating: $$UGR = 8 \log_{10} \left( \frac{0.25}{L_b} \sum \frac{L^2 \omega}{p^2} \right)$$ where $L$ is luminance, $L_b$ background luminance, $\omega$ solid angle, and $p$ Guth position index. |
| `CalcUGRTable()` | CIE Standard Glare Tables | Populates the standard $4H \times 8H$ tabular UGR report for crosswise and endwise observer viewpoints. |
| `Convert_BC()`, `Convert_CB()` | Goniophotometer Photometric Web | Converts candela matrices between Type B (floodlights) and Type C (architectural/roadway) angular coordinate frames. |
| `TotalDnLumens()`, `TotalUpLumens()` | Downward / Upward Flux | Separates lower and upper hemisphere total luminous flux. |

---

## 3. `laicontournet1.dll` (Contour Plotting Engine)

* **Assembly Name**: `LAIContourNET1`
* **Target Framework**: `.NETFramework,Version=v4.0`
* **Type Library**: `laicontournet1.tlb`

### Key Types & Functions
* `CONTOUR`: Main class for 2D isoline generation.
* `gfnCalcDistance()`: Euclidean metric distance between photometric grid coordinates.
* `gsbCalcSegment()`: Marching squares / segment tracing algorithm for iso-illuminance (lux / footcandles) and iso-candela contour lines.

---

## 4. `laiinfonet.dll` (Licensing & Client Telemetry)

* **Assembly Name**: `LaiInfoNet`
* **Dependencies**: `Newtonsoft.Json.dll`, `mscorlib`, `System.Web`
* **Type Library**: `laiinfonet.tlb`

### Components
* `LaiInfoNet.License`: License validation, subscription expiration checks, and offline activation.
* `LaiInfoNet.Dongle`: Hardware key (dongle) interrogation and validation.
* `LaiInfoNet.g3API` / `LaiDexG3`: Cloud licensing API communication.
* `LaiInfoNet.LaiWeb`: REST endpoints for product updates and account entitlement.
