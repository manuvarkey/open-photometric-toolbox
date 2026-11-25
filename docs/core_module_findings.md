# Core module investigation — 25 November 2026

Scope: core mathematics, coordinate conversion, interpolation, contours, and photometric file formats. No legacy UI executables were decompiled, and no proprietary binaries were executed. This records the pre-implementation investigation; subsequent changes and validation are tracked in the [implementation plan](feature_implementation_plan.md). Derived C# stays outside the repository under `/tmp/photometric-core-re/`; only findings and measurements are retained here.

## Evidence identity and coverage

| Artifact | Identity | Static evidence |
| --- | --- | --- |
| `extracted_installer/cab_contents/laicalcnetrev2.dll` | SHA-256 `4ee2cbdeac018fa3b17d7fed7988058ca857ef95cf717905e956f1963ffb209c`; MVID `fbdf46f7-b082-4787-b3a8-ac908fc71ec9` | REA identity `ev_35445b1561b916ae1de65c18357623bb22d28c6f1dd1614b69a72cf38abb4458`; members `ev_619eeb4336c0ff6edda5831e0069aea5ec15eecf984d9e6c195b45a00c303e9f` |
| `extracted_installer/cab_contents/laiglarenet.dll` | SHA-256 `269d5f7eb224f3382871073fab9bda8b54fe2bd194ce64e34e6caefc413f9d53` | REA members `ev_5170a4d5ccf62a6a431a6f9f1294438972dc74fe7c2426f923bab8ff3b2a2c75` |
| `extracted_installer/cab_contents/laicontournet1.dll` | SHA-256 `12892d91f28cda4160a894df298cb390e1234541ac46be6f3d3ac18c95ba4b4c`; MVID `e13b3ea8-014e-48c9-8aea-61467b201c27` | REA identity `ev_a0fad27e68f032599b5ab1fade9631dbfcf58197cb88d24ea9329c2dc3a8b409`; members `ev_8fb0d5839a7e32863cc15625371d2d3380982b3556e3026630bebfcd156548d1` |

REA inspected file-backed CLI metadata and CIL without a CLR execution of the target. ILSpyCmd 10.1.1.8388 reconstructed selected core classes using the installed .NET runtime; the decompiler itself was acquired in `/tmp`, with no system tool installation. Overall calculation-assembly signature coverage is partial; the conversion, integration, interpolation, and LDT method bodies cited below decoded completely with no truncated instructions. Static behavior is not runtime validation or proof of compliance with an engineering standard.

## Conversion and integrated flux

**Observed in the core:**

| Method | Build-local token | Finding |
| --- | --- | --- |
| `LAICalcNET.utilities.CalcLuminaireLumens` | `0x06000052` | Dispatches Type B to flood integration; other photometric types take a separate path. |
| `LAICalcNET.Module1.gsbCalcZonalLumensFlood` | `0x06000032` | Type B cell solid angle is `ΔV(rad) × (sin H1 − sin H0)`, multiplied by mean corner intensity and source symmetry. |
| `LAICalcNET.Module1.gsbCalcZonalLumens2` | `0x06000031` | Type C integration uses differences of cos(vertical angle) and horizontal span weighting. The current documentation's claim that this is a recovered 1° Simpson integration is inaccurate. |
| `LAICalcNET.Module1.gsbConvertPhotoFile` | `0x06000011` | Implements conversion with explicit target angular ranges, increments, and orientation inputs. |
| `LAICalcNET.utilities.ConvertPhotoData` | `0x06000088` | Wraps that conversion method. |
| `LAICalcNET.Module1.gfnCandelaValue` | `0x0600002d` | Handles source symmetry before interpolation; Type B signs are retained unless a zero-start grid declares reflection symmetry. |

The conversion implementation is in **LAICalcNET**, not LAIGlareNet. Inspection of the latter found UGR functionality referring to the calculation core. Existing comments and documentation attributing conversion to LAIGlareNet need correction.

**Reproduced in the current TypeScript implementation at `5d18755`:**

| Measurement | Lumens |
| --- | ---: |
| Generated 3,600 lm / 55° downlight, current Type C calculation | 3,653 |
| Current conversion and current calculation of the resulting Type B data | 1,205 |
| The same converted candela values, using the recovered Type B solid-angle integration | 3,607.919 |

No intensity rescaling was used. The wrong coordinate-system quadrature explains the severe apparent loss. The remaining difference from the analytic 3,600 lm target is a separate source integration/interpolation error. The experiment used a new TypeScript reproduction script in `/tmp/photometric-core-re/reproduce.mjs`, not execution of the legacy assembly.

Baseline implementation mechanisms at `5d18755` (subsequently repaired):

- `src/core/calculations.ts:138` has no photometric-type argument. It applies Type C vertical weighting to every source, and averages horizontal samples without angular-span weighting.
- `src/components/GoniometerConverterModal.vue:95` creates only positive Type B H/V angles, imposing symmetry even on asymmetric data.
- The inverse conversion uses absolute values and an incorrect inverse trigonometric expression, losing quadrant information.
- Its sampler normalizes signed Type B angles as if they were Type C azimuths and has incomplete symmetry/seam handling.
- The generated flood preset declared Type B with C-style vertical angles through 180°. The built-in flood sample instead has 0–90° vertical angles, but its H90 row varies with V despite that B pole representing one physical ray. Both are invalid Type B references; the fixed sample is a C distribution and the generator must emit a genuine signed B grid.

**Derived coordinate convention for implementation tests:** at zero orientation, the legacy Type B ray in a world with upward Z is

`r = (cos H × sin V, −sin H, −cos H × cos V)`.

With Type C direction `(sin γ cos C, sin γ sin C, −cos γ)`, the stable inverse on the representable hemisphere is

`H = asin(−sin γ sin C)` and `V = atan2(sin γ cos C, cos γ)`.

Consequently C90/γ30 maps to H−30/V0, while C270/γ30 maps to H+30/V0. These signed landmarks must be tested; two positive-quadrant examples cannot establish correctness. A default Type B grid over H/V ±90° represents a hemisphere. C uplight outside it must be explicitly reported rather than invented or hidden by renormalization. The manufacturer's [conversion documentation](https://www.agi32.com/docs/PhotometricToolbox/Content/Convert_Tool/convert_photometric_type_and_or_angles.htm) independently describes complete signed grids and this coverage restriction.

## LDT input and output

Observed method: `LAICalcNET.utilities.InputPhotoFileEulumdat`, token `0x06000099`, RVA `95836`, 3,753 IL bytes, 1,696 decoded instructions. `InputPhotoFileUniversal`, token `0x06000094`, dispatches `.LDT`/`.EXL` to it. EXL support is outside the requested implementation scope.

- The header contains luminous-area length and width followed by **four** directional heights. The current exporter writes only one height, shifting all later records three positions early.
- `Mc` describes the full-circle C-angle array, which is read before symmetry reduces the number of stored intensity planes. The current exporter incorrectly uses its compact IES plane count for both.
- Stored plane counts for Isym 0/1/2/3/4 are respectively `Mc`, `1`, `Mc/2+1`, `Mc/2+1`, and `Mc/4+1`.
- Isym 3 intensities begin at C270 and wrap through C0 toward C90. The legacy code subsequently reconstructs its angle grid; preserve physical directions and test this independently rather than copying the transformation uncritically.
- Relative intensity normalization multiplies cd/klm by the first lamp set's total flux divided by 1,000 and by the conversion factor. Negative lamp count signals absolute photometry; its supplied normalization flux is still used.
- Every lamp set is consumed and retained in metadata, but the first drives the active lamp count, flux, and watts. Geometry, measurement tilt, and ten direct ratios are also read.
- The parser distinguishes truncated arrays, invalid terminal gamma, negative intensities, all-zero data, inconsistent pole intensities, and general parse failure. Imported data is Type C, metres, ballast factor 1.
- Full-circle closure may be added by copying C0 to C360. This closure must not receive duplicate angular weight in integration.
- The bounded direct-ratio check found a single-RCR IES zonal weighting calculation and storage of the ten imported LDT ratios, but no LDT export generator or unknown-value sentinel. The relation `RCR = 5/k` is geometrically motivated; matching EULUMDAT/LITG direct-ratio definitions remains unverified. Preserve imported values and require independent definition/validation before replacing the fabricated writer values.

The primary [DIAL LDT specification](https://evo.support-de.dial.de/support/solutions/articles/9000074127-beschreibung-des-eulumdat-formats) confirms the field ordering, full `Mc` array, reduced intensity counts, and Isym 3 ordering. No real `.ldt` sample was found in the extracted application tree. Interoperability therefore needs independently authored fixtures and at least one documented manufacturer fixture; a round trip through our own writer is insufficient proof.

Other writer issues: Type B cannot be serialized directly into Type C LDT angles; `1 − 0.04r` direct ratios are fabricated rather than derived from the distribution; the current date fallback prevents deterministic output. These are part of the LDT repair, not separate UI polish.

## Contour core and current plot performance

`LAIContourNET1.CONTOUR.gsbInitialize` (`0x0600000c`) accepts sampled grid values, contour levels, spacings, labels, and transforms. It produces segment and label coordinate arrays. `gsbContourNow` (`0x0600000a`) traverses level crossings; `gsbLookforPt` (`0x0600000b`) follows crossings; `gsbCalcSegment` (`0x06000009`) interpolates a crossing along a grid edge. This establishes a numeric grid → vector segment boundary; it does not establish how a legacy UI rendered those segments.

The current `IsoIlluminanceViewer.vue` instead performs 90,000 intensity lookups per 600 × 600 heatmap redraw, scans the angular arrays at every lookup, allocates a pixel buffer, and reads the source through Vue's deep reactive data. It repeats this work after mounting-height changes, although the normalized MH-space distribution can be reused. Its current lookup picks lower/nearest samples rather than performing full bilinear interpolation.

One instrumented run on the current checkout, Chromium headless at 1400 × 900 / 100%, measured the heatmap portion from `createImageData` to `putImageData` entry:

| Input/action | Time |
| --- | ---: |
| Built-in downlight, initial illuminance view | 497 ms |
| Mounting height change | 457 ms |
| Synthetic Type C file with 181 vertical × 73 horizontal angles | 2,720 ms |

These are individual observations, not portable performance guarantees. The retained [measurement record](core-performance-baseline.json) also records mixed fonts: body `system-ui`, tab button `Arial`, and height input `monospace`. Interface design and bundle decisions are based on current source/runtime evidence, without decompiling UI modules.

## Consequences for the plan

The [implementation plan](feature_implementation_plan.md) must establish typed directional sampling and integration before updating conversion, LDT, or contours. Existing ribbon acceptance evidence remains valid for the previously tested UI workflows; its numeric parity checks only proved equality to the old implementation and do not independently validate these formulas or the old malformed LDT output. Corrected numerical expectations must be justified with analytic fixtures and independent format cases.
